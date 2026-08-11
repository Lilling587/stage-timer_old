import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Speaker = {
  id: string;
  name: string;
  duration_minutes: number;
  position: number;
};

export type TimerState = {
  id: string;
  current_speaker_id: string | null;
  status: "running" | "paused" | "stopped";
  elapsed_seconds: number;
  started_at: string | null;
  message: string | null;
  message_sent_at: string | null;
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

  const refresh = useCallback(async () => {
    const [s, t] = await Promise.all([
      supabase.from("speakers").select("*").order("position", { ascending: true }),
      supabase.from("timer_state").select("*").eq("id", STATE_ID).maybeSingle(),
    ]);
    if (s.data) setSpeakers(s.data as Speaker[]);
    if (t.data) setState(t.data as TimerState);
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

export function toneFor(remaining: number) {
  if (remaining <= 0) return "over" as const;
  if (remaining < 120) return "danger" as const;
  if (remaining < 300) return "warn" as const;
  return "safe" as const;
}