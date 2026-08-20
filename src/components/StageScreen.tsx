import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_THRESHOLDS,
  CUE_INTENSITY_OPACITY,
  DEFAULT_CUE_SETTINGS,
  decodeStageMessage,
  elapsedFor,
  formatClock,
  toneFor,
  useCueFlash,
  type CueMark,
  type CueSettings,
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

const messageToneClass = {
  info: "border-t-4 border-stage-fg/30 bg-stage-fg/10 text-stage-fg",
  warn: "border-t-4 border-stage-warn bg-stage-warn/20 text-stage-warn",
  stop: "border-t-4 border-stage-danger bg-stage-danger/25 text-stage-danger",
} as const;

const cueColor: Record<CueMark, string> = {
  warn: "var(--stage-warn)",
  danger: "var(--stage-danger)",
  over: "var(--stage-danger)",
};

export function StageScreen({
  speaker,
  state,
  now,
  compact = false,
  showElapsed = false,
  thresholds = DEFAULT_THRESHOLDS,
  cue = DEFAULT_CUE_SETTINGS,
  cueTest = null,
}: {
  speaker: Speaker | null;
  state: TimerState | null;
  now: number;
  compact?: boolean;
  showElapsed?: boolean;
  thresholds?: Thresholds;
  cue?: CueSettings;
  cueTest?: { mark: CueMark; at: number } | null;
}) {
  const { text: messageText, tone: messageTone } = decodeStageMessage(state?.message);
  // Keep the last message mounted briefly so clearing it fades out instead of popping.
  const [shownMessage, setShownMessage] = useState({ text: messageText, tone: messageTone });
  const [leaving, setLeaving] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (messageText.length > 0) {
      setLeaving(false);
      setShownMessage({ text: messageText, tone: messageTone });
      return;
    }
    setLeaving(true);
    timeoutRef.current = setTimeout(() => {
      setLeaving(false);
      setShownMessage({ text: "", tone: "info" });
    }, 600);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [messageText, messageTone]);

  const messageVisible = shownMessage.text.length > 0;
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

  const flash = useCueFlash({
    remaining,
    running: isRunning,
    speakerId: speaker?.id ?? null,
    cue,
    thresholds,
    testMark: cueTest,
  });

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

      {flash ? (
        <div
          aria-hidden="true"
          className="stage-cue-flash pointer-events-none absolute inset-0 z-10"
          style={{
            backgroundColor: cueColor[flash],
            ["--cue-opacity" as string]: String(CUE_INTENSITY_OPACITY[cue.intensity]),
          }}
        />
      ) : null}

      {messageVisible ? (
        <div
          className={`${leaving ? "stage-message-leaving" : "stage-message"} absolute inset-x-0 bottom-6 z-20 text-center backdrop-blur ${
            messageToneClass[shownMessage.tone]
          } ${
            compact ? "px-3 py-2" : "px-10 py-8"
          }`}
        >
          <p className={`font-medium ${compact ? "text-xs" : "text-[3vw]"}`}>
            {shownMessage.text}
          </p>
        </div>
      ) : null}
    </div>
  );
}
