import { useEffect, useState } from "react";
import { elapsedFor, formatClock, toneFor, type Speaker, type TimerState } from "@/lib/show";

const MESSAGE_TTL_MS = 10_000;

const toneClass = {
  safe: "text-stage-safe",
  warn: "text-stage-warn",
  danger: "text-stage-danger",
  over: "text-stage-danger stage-flashing",
} as const;

export function StageScreen({
  speaker,
  state,
  now,
  compact = false,
}: {
  speaker: Speaker | null;
  state: TimerState | null;
  now: number;
  compact?: boolean;
}) {
  const [messageVisible, setMessageVisible] = useState(false);
  const sentAt = state?.message_sent_at ?? null;
  const message = state?.message ?? null;

  useEffect(() => {
    if (!message || !sentAt) {
      setMessageVisible(false);
      return;
    }
    const remaining = MESSAGE_TTL_MS - (Date.now() - new Date(sentAt).getTime());
    if (remaining <= 0) {
      setMessageVisible(false);
      return;
    }
    setMessageVisible(true);
    const id = window.setTimeout(() => setMessageVisible(false), remaining);
    return () => window.clearTimeout(id);
  }, [message, sentAt]);

  const total = (speaker?.duration_minutes ?? 0) * 60;
  const remaining = speaker ? total - elapsedFor(state, now) : 0;
  const tone = toneFor(remaining);

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-stage-bg ${
        compact ? "gap-2 px-4 py-6" : "gap-8 px-10 py-16"
      }`}
    >
      <p
        className={`max-w-full truncate font-semibold tracking-tight text-stage-fg ${
          compact ? "text-base" : "text-6xl"
        }`}
      >
        {speaker ? speaker.name : "No speaker selected"}
      </p>

      <p
        className={`font-mono font-bold tabular-nums leading-none ${toneClass[tone]} ${
          compact ? "text-5xl" : "text-[18vw] leading-[0.9]"
        }`}
      >
        {speaker ? formatClock(remaining) : "00:00"}
      </p>

      <p
        className={`uppercase tracking-[0.3em] text-stage-muted ${compact ? "text-[10px]" : "text-2xl"}`}
      >
        {speaker
          ? state?.status === "running"
            ? `${speaker.duration_minutes} min talk`
            : (state?.status ?? "stopped")
          : "Waiting to start"}
      </p>

      {messageVisible && message ? (
        <div
          className={`stage-message absolute inset-x-0 bottom-0 bg-stage-fg/10 text-center backdrop-blur ${
            compact ? "px-3 py-2" : "px-10 py-8"
          }`}
        >
          <p className={`font-medium text-stage-fg ${compact ? "text-xs" : "text-4xl"}`}>
            {message}
          </p>
        </div>
      ) : null}
    </div>
  );
}