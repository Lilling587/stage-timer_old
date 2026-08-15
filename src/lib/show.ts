import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Speaker = {
  id: string;
  name: string;
  duration_minutes: number;
  position: number;
};

export type TimerState = {
  id: string;
  blackout: boolean;
  current_speaker_id: string | null;
  status: "running" | "paused" | "stopped";
  elapsed_seconds: number;
  started_at: string | null;
  show_clock: boolean;
  message: string | null;
  message_sent_at: string | null;
  revision: number;
};

export type SyncStatus = "connected" | "syncing" | "disconnected";

export const STATE_ID = "main";

export function elapsedFor(state: TimerState | null, now: number) {
  if (!state) return 0;
  const base = state.elapsed_seconds ?? 0;
  if (state.status === "running" && state.started_at) {
    return base + Math.max(0, (now - new Date(state.started_at).getTime()) / 1000);
  }
  return base;
}

export function formatClock(totalSeconds: number) {
  const abs = Math.floor(Math.abs(totalSeconds));
  const mm = String(Math.floor(abs / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  return `${totalSeconds < 0 ? "-" : ""}${mm}:${ss}`;
}

export function useShow() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [state, setState] = useState<TimerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  // Guards against out-of-order responses rewinding the stage to older state.
  const seenRevision = useRef(-1);

  const refresh = useCallback(async () => {
    const [s, t] = await Promise.all([
      supabase.from("speakers").select("*").order("position", { ascending: true }),
      supabase.from("timer_state").select("*").eq("id", STATE_ID).maybeSingle(),
    ]);
    if (s.data) setSpeakers(s.data as Speaker[]);
    if (t.data) {
      const next = t.data as TimerState;
      const revision = next.revision ?? 0;
      if (revision >= seenRevision.current) {
        seenRevision.current = revision;
        setState(next);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    let wasConnected = false;
    const channel = supabase
      .channel("show-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "speakers" }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "timer_state" }, () => {
        void refresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Reconnected after a drop: pull the latest state we may have missed.
          if (wasConnected) {
            setSyncStatus("syncing");
            void refresh().then(() => setSyncStatus("connected"));
          } else {
            setSyncStatus("connected");
          }
          wasConnected = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setSyncStatus(wasConnected ? "syncing" : "disconnected");
          wasConnected = false;
        }
      });
    return () => {
      setSyncStatus("disconnected");
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Pull fresh state when the tab regains focus or the network comes back.
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState === "hidden") return;
      setSyncStatus((s) => (s === "connected" ? "syncing" : s));
      void refresh().then(() => setSyncStatus((s) => (s === "syncing" ? "connected" : s)));
    };
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [refresh]);

  return { speakers, state, loading, refresh, syncStatus };
}

export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export type Thresholds = { warnMinutes: number; dangerMinutes: number };

export const DEFAULT_THRESHOLDS: Thresholds = { warnMinutes: 5, dangerMinutes: 2 };

export function toneFor(remaining: number, thresholds: Thresholds = DEFAULT_THRESHOLDS) {
  if (remaining <= 0) return "over" as const;
  if (remaining < thresholds.dangerMinutes * 60) return "danger" as const;
  if (remaining < thresholds.warnMinutes * 60) return "warn" as const;
  return "safe" as const;
}

function sanitizeThresholds(value: unknown): Thresholds | null {
  const raw = value as Partial<Thresholds> | undefined;
  if (!raw) return null;
  const warn = Number(raw.warnMinutes);
  const danger = Number(raw.dangerMinutes);
  if (!Number.isFinite(warn) || !Number.isFinite(danger)) return null;
  const clamp = (n: number) => Math.min(120, Math.max(0, Math.round(n * 10) / 10));
  const safeDanger = clamp(danger);
  const safeWarn = Math.max(clamp(warn), safeDanger);
  return { warnMinutes: safeWarn, dangerMinutes: safeDanger };
}

/**
 * Tracks how many admin consoles are open right now, so operators can see when
 * someone else is also driving the show.
 */
export function useAdminPresence() {
  const [adminCount, setAdminCount] = useState(1);

  useEffect(() => {
    const key = Math.random().toString(36).slice(2);
    const channel = supabase.channel("admin-presence", { config: { presence: { key } } });
    channel
      .on("presence", { event: "sync" }, () => {
        setAdminCount(Math.max(1, Object.keys(channel.presenceState()).length));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ joined_at: new Date().toISOString() });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return adminCount;
}

export type DisplayMode = "remaining" | "elapsed";

const DISPLAY_MODE_CHANNEL = "stage-display-mode";

/**
 * Stage side: listens for the display mode chosen in the control room.
 * Asks for the current mode on connect so a reloading stage catches up.
 */
export function useStageDisplayMode() {
  const [mode, setMode] = useState<DisplayMode>("remaining");

  useEffect(() => {
    const channel = supabase.channel(DISPLAY_MODE_CHANNEL);
    channel
      .on("broadcast", { event: "set" }, ({ payload }) => {
        const next = (payload as { mode?: DisplayMode })?.mode;
        if (next === "remaining" || next === "elapsed") setMode(next);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.send({ type: "broadcast", event: "request", payload: {} });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return mode;
}

/**
 * Control room side: owns the display mode and pushes it to every stage screen.
 */
export function useDisplayModeControl() {
  const [mode, setMode] = useState<DisplayMode>("remaining");
  const modeRef = useRef<DisplayMode>("remaining");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel(DISPLAY_MODE_CHANNEL);
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "request" }, () => {
        void channel.send({ type: "broadcast", event: "set", payload: { mode: modeRef.current } });
      })
      .subscribe();
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, []);

  const setDisplayMode = useCallback((next: DisplayMode) => {
    modeRef.current = next;
    setMode(next);
    void channelRef.current?.send({ type: "broadcast", event: "set", payload: { mode: next } });
  }, []);

  return { displayMode: mode, setDisplayMode };
}
