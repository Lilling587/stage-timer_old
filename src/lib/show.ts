import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Speaker = {
  id: string;
  name: string;
  notes: string;
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
  display_mode: string;
  show_clock: boolean;
  message: string | null;
  message_sent_at: string | null;
  revision: number;
};

export type SyncStatus = "connected" | "syncing" | "disconnected";

export const STATE_ID = "main";

/**
 * A speed change point: from this wall-clock moment onwards the timer runs at `rate`.
 * Integrating over segments keeps speed changes seamless — seconds already counted
 * always stay counted at the speed they were counted with.
 */
export type SpeedSegment = { from: number; rate: number };

function integrateSpeed(startMs: number, endMs: number, speed: number | SpeedSegment[]) {
  if (endMs <= startMs) return 0;
  if (typeof speed === "number") return ((endMs - startMs) / 1000) * speed;
  const segments = [...speed].sort((a, b) => a.from - b.from);
  let total = 0;
  let cursor = startMs;
  let rate = 1;
  for (const segment of segments) {
    if (segment.from <= cursor) {
      rate = segment.rate;
      continue;
    }
    if (segment.from >= endMs) break;
    total += ((segment.from - cursor) / 1000) * rate;
    cursor = segment.from;
    rate = segment.rate;
  }
  total += ((endMs - cursor) / 1000) * rate;
  return total;
}

export function elapsedFor(
  state: TimerState | null,
  now: number,
  speed: number | SpeedSegment[] = 1,
) {
  if (!state) return 0;
  const base = state.elapsed_seconds ?? 0;
  if (state.status === "running" && state.started_at) {
    const startedAt = new Date(state.started_at).getTime();
    return base + Math.max(0, integrateSpeed(startedAt, now, speed));
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
        // Fallback for networks that block WebSockets (guest wifi, filtering
    // proxies). Realtime still gives instant updates when it works; this
    // guarantees updates when it doesn't. Skipped while the tab is hidden.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refresh();
    }, 1000);

    return () => {
      window.clearInterval(poll);
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

export type Thresholds = { warnMinutes: number; dangerMinutes: number; enabled: boolean; blinkOnOver: boolean };

export const DEFAULT_THRESHOLDS: Thresholds = { warnMinutes: 5, dangerMinutes: 2, enabled: true, blinkOnOver: true };

export function toneFor(remaining: number, thresholds: Thresholds = DEFAULT_THRESHOLDS) {
  if (thresholds.enabled === false) return "safe" as const;
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
  return { warnMinutes: safeWarn, dangerMinutes: safeDanger, enabled: raw.enabled !== false, blinkOnOver: raw.blinkOnOver !== false };
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

const THRESHOLDS_CHANNEL = "stage-thresholds";
const THRESHOLDS_STORAGE = "stage-thresholds";

/**
 * Stage side: listens for the colour thresholds chosen in the control room.
 */
export function useStageThresholds() {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  useEffect(() => {
    const channel = supabase.channel(THRESHOLDS_CHANNEL);
    channel
      .on("broadcast", { event: "set" }, ({ payload }) => {
        const next = sanitizeThresholds((payload as { thresholds?: unknown })?.thresholds);
        if (next) setThresholds(next);
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

  return thresholds;
}

/**
 * Control room side: owns the colour thresholds, remembers them locally and
 * pushes them to every stage screen.
 */
export function useThresholdControl() {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const thresholdsRef = useRef<Thresholds>(DEFAULT_THRESHOLDS);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    try {
      const stored = sanitizeThresholds(
        JSON.parse(window.localStorage.getItem(THRESHOLDS_STORAGE) ?? "null"),
      );
      if (stored) {
        thresholdsRef.current = stored;
        setThresholds(stored);
      }
    } catch {
      // ignore unreadable storage
    }

    const channel = supabase.channel(THRESHOLDS_CHANNEL);
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "set" }, ({ payload }) => {
        // Another console (e.g. the settings page) changed the thresholds.
        const next = sanitizeThresholds((payload as { thresholds?: unknown })?.thresholds);
        if (next) {
          thresholdsRef.current = next;
          setThresholds(next);
        }
      })
      .on("broadcast", { event: "request" }, () => {
        void channel.send({
          type: "broadcast",
          event: "set",
          payload: { thresholds: thresholdsRef.current },
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.send({
            type: "broadcast",
            event: "set",
            payload: { thresholds: thresholdsRef.current },
          });
        }
      });
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, []);

  const updateThresholds = useCallback((next: Thresholds) => {
    const safe = sanitizeThresholds(next) ?? DEFAULT_THRESHOLDS;
    thresholdsRef.current = safe;
    setThresholds(safe);
    try {
      window.localStorage.setItem(THRESHOLDS_STORAGE, JSON.stringify(safe));
    } catch {
      // ignore unwritable storage
    }
    void channelRef.current?.send({
      type: "broadcast",
      event: "set",
      payload: { thresholds: safe },
    });
  }, []);

  return { thresholds, setThresholds: updateThresholds };
}

const ADJUSTMENTS_STORAGE = "stage-time-adjustments";

/* ------------------------------------------------------------------ */
/* Timer speed (rehearsal tool, control room only)                     */
/* ------------------------------------------------------------------ */

export const SPEED_OPTIONS = [0.5, 1, 1.25, 1.5, 2] as const;
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;
export const SPEED_STEP = 0.05;
/** Any speed between MIN_SPEED and MAX_SPEED; the presets are just shortcuts. */
export type SpeedRate = number;

const SPEED_CHANNEL = "stage-speed";

function sanitizeRate(value: unknown): SpeedRate | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, n));
  return Math.round(clamped / SPEED_STEP) * SPEED_STEP;
}

/** Trim float noise so 1.2000000000000002 reads as 1.2. */
export function formatRate(rate: number) {
  return Number(rate.toFixed(2)).toString();
}

/** Human readable caption: how long one timer minute takes in real time. */
export function speedCaption(rate: SpeedRate) {
  if (rate === 1) return "real time";
  const seconds = Math.round(60 / rate);
  return seconds % 60 === 0
    ? `1 min = ${seconds / 60} min real`
    : `1 min = ${seconds} s real`;
}

const INITIAL_SEGMENTS: SpeedSegment[] = [{ from: 0, rate: 1 }];

function sanitizeSegments(value: unknown): SpeedSegment[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned: SpeedSegment[] = [];
  for (const entry of value) {
    const from = Number((entry as { from?: unknown })?.from);
    const rate = sanitizeRate((entry as { rate?: unknown })?.rate);
    if (Number.isFinite(from) && rate) cleaned.push({ from, rate });
  }
  cleaned.sort((a, b) => a.from - b.from);
  return cleaned.length ? cleaned : null;
}

/** Stage side: follows the speed chosen in the control room. Always starts at 1x. */
export function useStageSpeed() {
  const [segments, setSegments] = useState<SpeedSegment[]>(INITIAL_SEGMENTS);

  useEffect(() => {
    const channel = supabase.channel(SPEED_CHANNEL);
    channel
      .on("broadcast", { event: "set" }, ({ payload }) => {
        const next = sanitizeSegments((payload as { segments?: unknown })?.segments);
        if (next) setSegments(next);
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

  const rate = (segments[segments.length - 1]?.rate ?? 1) as SpeedRate;
  return { rate, segments };
}

/**
 * Control room side: owns the timer speed and pushes it to every stage screen.
 * Deliberately not persisted — every fresh load starts at real time.
 */
export function useSpeedControl() {
  const [segments, setSegments] = useState<SpeedSegment[]>(INITIAL_SEGMENTS);
  const segmentsRef = useRef<SpeedSegment[]>(INITIAL_SEGMENTS);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel(SPEED_CHANNEL);
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "set" }, ({ payload }) => {
        const next = sanitizeSegments((payload as { segments?: unknown })?.segments);
        if (next) {
          segmentsRef.current = next;
          setSegments(next);
        }
      })
      .on("broadcast", { event: "request" }, () => {
        void channel.send({
          type: "broadcast",
          event: "set",
          payload: { segments: segmentsRef.current },
        });
      })
      .subscribe();
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, []);

  const setSpeed = useCallback((next: SpeedRate) => {
    const safe = sanitizeRate(next) ?? 1;
    const previous = segmentsRef.current;
    if ((previous[previous.length - 1]?.rate ?? 1) === safe) return;
    const updated = [...previous, { from: Date.now(), rate: safe }].slice(-200);
    segmentsRef.current = updated;
    setSegments(updated);
    void channelRef.current?.send({
      type: "broadcast",
      event: "set",
      payload: { segments: updated },
    });
  }, []);

  const rate = (segments[segments.length - 1]?.rate ?? 1) as SpeedRate;
  return { rate, segments, setSpeed };
}

export const DEFAULT_ADJUSTMENTS = [-5, -1, 1, 5];

export function useAdjustmentSettings() {
  const [adjustments, setAdjustmentsState] = useState<number[]>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(ADJUSTMENTS_STORAGE) ?? "null");
      if (Array.isArray(stored) && stored.length === 4 && stored.every(Number.isFinite))
        return stored as number[];
    } catch {
      // ignore
    }
    return DEFAULT_ADJUSTMENTS;
  });

  const setAdjustments = useCallback((next: number[]) => {
    setAdjustmentsState(next);
    try {
      window.localStorage.setItem(ADJUSTMENTS_STORAGE, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  return { adjustments, setAdjustments };
}

const QUICK_MESSAGES_STORAGE = "stage-quick-messages";

export type MessageTone = "info" | "warn" | "stop";
export type QuickMessage = { text: string; tone: MessageTone };

export const MESSAGE_TONES: { value: MessageTone; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "warn", label: "Warning" },
  { value: "stop", label: "Stop" },
];

/**
 * The tone travels inside the stored message text as a short marker, so every
 * screen and the Companion API stay on the single `timer_state.message` field.
 * Plain text (e.g. sent from Companion) reads as the neutral "info" tone.
 */
const TONE_MARKER = /^\[\[(info|warn|stop)\]\]/;

export function encodeStageMessage(text: string, tone: MessageTone) {
  return tone === "info" ? text : `[[${tone}]]${text}`;
}

export function decodeStageMessage(raw: string | null | undefined): {
  text: string;
  tone: MessageTone;
} {
  if (!raw) return { text: "", tone: "info" };
  const match = TONE_MARKER.exec(raw);
  if (!match) return { text: raw, tone: "info" };
  return { text: raw.slice(match[0].length), tone: match[1] as MessageTone };
}

export const DEFAULT_QUICK_MESSAGES: QuickMessage[] = [
  { text: "Vänligen avrunda", tone: "info" },
  { text: "2 minuter kvar", tone: "warn" },
  { text: "Tiden är ute", tone: "stop" },
];

function sanitizeQuickMessages(value: unknown): QuickMessage[] | null {
  if (!Array.isArray(value)) return null;
  const out: QuickMessage[] = [];
  for (const item of value) {
    // Older versions stored plain strings; keep them and default to info.
    if (typeof item === "string") {
      out.push({ text: item, tone: "info" });
      continue;
    }
    const row = item as Partial<QuickMessage>;
    if (typeof row?.text !== "string") return null;
    const tone: MessageTone =
      row.tone === "warn" || row.tone === "stop" ? row.tone : "info";
    out.push({ text: row.text, tone });
  }
  return out;
}

export function useQuickMessages() {
  const [quickMessages, setQuickMessagesState] = useState<QuickMessage[]>(DEFAULT_QUICK_MESSAGES);

  useEffect(() => {
    try {
      const stored = sanitizeQuickMessages(
        JSON.parse(window.localStorage.getItem(QUICK_MESSAGES_STORAGE) ?? "null"),
      );
      if (stored) setQuickMessagesState(stored);
    } catch {
      // ignore unreadable storage
    }
  }, []);

  const setQuickMessages = useCallback((next: QuickMessage[]) => {
    setQuickMessagesState(next);
    try {
      window.localStorage.setItem(QUICK_MESSAGES_STORAGE, JSON.stringify(next));
    } catch {
      // ignore unwritable storage
    }
  }, []);

  return { quickMessages, setQuickMessages };
}

/* ------------------------------------------------------------------ */
/* Cue flash                                                           */
/* ------------------------------------------------------------------ */

export type CueIntensity = "subtle" | "normal" | "strong";

export type CueSettings = {
  enabled: boolean;
  atWarn: boolean;
  atDanger: boolean;
  atZero: boolean;
  intensity: CueIntensity;
};

export const DEFAULT_CUE_SETTINGS: CueSettings = {
  enabled: true,
  atWarn: true,
  atDanger: true,
  atZero: true,
  intensity: "normal",
};

export const CUE_INTENSITY_OPACITY: Record<CueIntensity, number> = {
  subtle: 0.25,
  normal: 0.5,
  strong: 0.8,
};

export type CueMark = "warn" | "danger" | "over";

function sanitizeCueSettings(value: unknown): CueSettings | null {
  const raw = value as Partial<CueSettings> | undefined;
  if (!raw || typeof raw !== "object") return null;
  const intensity: CueIntensity =
    raw.intensity === "subtle" || raw.intensity === "strong" ? raw.intensity : "normal";
  return {
    enabled: raw.enabled !== false,
    atWarn: raw.atWarn !== false,
    atDanger: raw.atDanger !== false,
    atZero: raw.atZero !== false,
    intensity,
  };
}

const CUE_CHANNEL = "stage-cue-flash";
const CUE_STORAGE = "stage-cue-flash";
const CUE_TEST_EVENT = "test";

/** Stage side: listens for the cue flash settings chosen in the control room. */
export function useStageCueSettings() {
  const [cue, setCue] = useState<CueSettings>(DEFAULT_CUE_SETTINGS);
  const [testMark, setTestMark] = useState<{ mark: CueMark; at: number } | null>(null);

  useEffect(() => {
    const channel = supabase.channel(CUE_CHANNEL);
    channel
      .on("broadcast", { event: "set" }, ({ payload }) => {
        const next = sanitizeCueSettings((payload as { cue?: unknown })?.cue);
        if (next) setCue(next);
      })
      .on("broadcast", { event: CUE_TEST_EVENT }, ({ payload }) => {
        const mark = (payload as { mark?: CueMark })?.mark ?? "over";
        setTestMark({ mark, at: Date.now() });
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

  return { cue, testMark };
}

/**
 * Control room side: owns the cue flash settings, remembers them locally and
 * pushes them to every stage screen.
 */
export function useCueControl() {
  const [cue, setCue] = useState<CueSettings>(DEFAULT_CUE_SETTINGS);
  const cueRef = useRef<CueSettings>(DEFAULT_CUE_SETTINGS);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [testMark, setTestMark] = useState<{ mark: CueMark; at: number } | null>(null);

  useEffect(() => {
    try {
      const stored = sanitizeCueSettings(
        JSON.parse(window.localStorage.getItem(CUE_STORAGE) ?? "null"),
      );
      if (stored) {
        cueRef.current = stored;
        setCue(stored);
      }
    } catch {
      // ignore unreadable storage
    }

    const channel = supabase.channel(CUE_CHANNEL);
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "set" }, ({ payload }) => {
        const next = sanitizeCueSettings((payload as { cue?: unknown })?.cue);
        if (next) {
          cueRef.current = next;
          setCue(next);
        }
      })
      .on("broadcast", { event: CUE_TEST_EVENT }, ({ payload }) => {
        const mark = (payload as { mark?: CueMark })?.mark ?? "over";
        setTestMark({ mark, at: Date.now() });
      })
      .on("broadcast", { event: "request" }, () => {
        void channel.send({ type: "broadcast", event: "set", payload: { cue: cueRef.current } });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.send({ type: "broadcast", event: "set", payload: { cue: cueRef.current } });
        }
      });
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, []);

  const updateCue = useCallback((next: CueSettings) => {
    const safe = sanitizeCueSettings(next) ?? DEFAULT_CUE_SETTINGS;
    cueRef.current = safe;
    setCue(safe);
    try {
      window.localStorage.setItem(CUE_STORAGE, JSON.stringify(safe));
    } catch {
      // ignore unwritable storage
    }
    void channelRef.current?.send({ type: "broadcast", event: "set", payload: { cue: safe } });
  }, []);

  const testCue = useCallback((mark: CueMark = "over") => {
    setTestMark({ mark, at: Date.now() });
    void channelRef.current?.send({
      type: "broadcast",
      event: CUE_TEST_EVENT,
      payload: { mark },
    });
  }, []);

  return { cue, setCue: updateCue, testCue, testMark };
}

/**
 * Fires a short pulse the moment the countdown crosses a cue mark. Each mark
 * fires once per talk and resets when the speaker or the timer is reset.
 */
export function useCueFlash({
  remaining,
  running,
  speakerId,
  cue,
  thresholds,
  testMark,
}: {
  remaining: number;
  running: boolean;
  speakerId: string | null;
  cue: CueSettings;
  thresholds: Thresholds;
  testMark?: { mark: CueMark; at: number } | null;
}) {
  const [flash, setFlash] = useState<CueMark | null>(null);
  const firedRef = useRef<Set<CueMark>>(new Set());
  const lastRemainingRef = useRef<number>(remaining);
  const talkKey = `${speakerId ?? "none"}`;
  const talkKeyRef = useRef(talkKey);
  const timeoutRef = useRef<number | null>(null);

  const trigger = useCallback((mark: CueMark) => {
    setFlash(mark);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setFlash(null), 1400);
  }, []);

  // A manual test from settings always shows, whatever the timer is doing.
  useEffect(() => {
    if (!testMark) return;
    trigger(testMark.mark);
  }, [testMark?.at, testMark?.mark, trigger, testMark]);

  useEffect(() => {
    if (talkKeyRef.current !== talkKey) {
      talkKeyRef.current = talkKey;
      firedRef.current.clear();
    }

    const previous = lastRemainingRef.current;
    lastRemainingRef.current = remaining;

    // The clock went backwards (reset or time added) — let the marks fire again.
    if (remaining > previous + 1) firedRef.current.clear();
    if (!cue.enabled || !running) return;

    const marks: { mark: CueMark; at: number; on: boolean }[] = [
      { mark: "warn", at: thresholds.warnMinutes * 60, on: cue.atWarn },
      { mark: "danger", at: thresholds.dangerMinutes * 60, on: cue.atDanger },
      { mark: "over", at: 0, on: cue.atZero },
    ];

    for (const { mark, at, on } of marks) {
      if (!on || firedRef.current.has(mark)) continue;
      if (previous > at && remaining <= at) {
        firedRef.current.add(mark);
        trigger(mark);
      }
    }
  }, [remaining, running, talkKey, cue, thresholds, trigger]);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return flash;
}
