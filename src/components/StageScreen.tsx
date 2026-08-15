import {
  DEFAULT_THRESHOLDS,
  elapsedFor,
  formatClock,
  toneFor,
  type Speaker,
  type Thresholds,
  type TimerState,
} from "@/lib/show";

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
  showElapsed = false,
  thresholds = DEFAULT_THRESHOLDS,
}: {
  speaker: Speaker | null;
  state: TimerState | null;
  now: number;
  compact?: boolean;
  showElapsed?: boolean;
  thresholds?: Thresholds;
}) {
  const message = state?.message ?? null;
  const messageVisible = Boolean(message);
  const showClock = state?.show_clock ?? false;
  const wallClock = new Date(now).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

  const total = (speaker?.duration_minutes ?? 0) * 60;
  const elapsed = elapsedFor(state, now);
  const remaining = speaker ? total - elapsed : 0;
  const tone = toneFor(remaining, thresholds);
  const isRunning = state?.status === "running";
  const toneStyle =
    tone === "over" && (!isRunning || !thresholds.blinkOnOver)
      ? "text-stage-danger"
      : toneClass[tone];

  if (state?.blackout && !compact) {
    return <div className="relative flex h-full w-full bg-black" />;
  }
  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-stage-bg ${
        compact ? "gap-2 px-4 py-6" : "gap-8 px-10 py-16"
      }`}
    >
     {!showClock ? (
        <p
          className={`max-w-full truncate font-semibold tracking-tight text-stage-fg ${
            compact ? "text-base" : "text-6xl"
          }`}
        >
          {speaker ? speaker.name : "No speaker selected"}
        </p>
      ) : null}

     <p
        className={`font-outfit tabular-nums leading-none ${showClock ? "text-stage-fg" : toneStyle} ${
          compact ? "text-5xl" : "text-[18vw] leading-[0.9]"
        }`}
      >
        {showClock
          ? wallClock
          : speaker
            ? formatClock(showElapsed ? elapsed : remaining)
            : "00:00"}
      </p>

      {messageVisible && message ? (
        <div
          className={`stage-message absolute inset-x-0 bottom-6 bg-stage-fg/10 text-center backdrop-blur ${
            compact ? "px-3 py-2" : "px-10 py-8"
          }`}
        >
          <p className={`font-medium text-stage-fg ${compact ? "text-xs" : "text-[3vw]"}`}>
            {message}
          </p>
        </div>
      ) : null}
    </div>
  );
}
