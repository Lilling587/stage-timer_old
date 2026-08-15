import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2, Wifi, WifiOff } from "lucide-react";
import { StageScreen } from "@/components/StageScreen";
import { useNow, useShow, useStageDisplayMode, useStageThresholds } from "@/lib/show";

export const Route = createFileRoute("/stage")({
  head: () => ({
    meta: [
      { title: "Stage timer — Conference speaker timer" },
      {
        name: "description",
        content:
          "Full-screen countdown for the stage: current speaker, time remaining, and live messages from the crew.",
      },
      { property: "og:title", content: "Stage timer — Conference speaker timer" },
      {
        property: "og:description",
        content: "Full-screen countdown display for conference stages and projectors.",
      },
    ],
  }),
  component: StagePage,
});

function StagePage() {
  const { speakers, state, syncStatus } = useShow();
  const displayMode = useStageDisplayMode();
  const thresholds = useStageThresholds();
  const now = useNow(true);
  const speaker = speakers.find((s) => s.id === state?.current_speaker_id) ?? null;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  const idleTimer = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const toggleFullscreen = useCallback(async () => {
    if (isIOS) {
      setShowIOSHint(true);
      window.setTimeout(() => setShowIOSHint(false), 5000);
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen may be blocked; ignore */
    }
  }, [isIOS]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  useEffect(() => {
    const bump = () => {
      setIdle(false);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), 3000);
    };
    bump();
    window.addEventListener("mousemove", bump);
    window.addEventListener("touchstart", bump);
    window.addEventListener("keydown", bump);
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("touchstart", bump);
      window.removeEventListener("keydown", bump);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        const lock = await nav.wakeLock?.request("screen");
        if (lock) {
          if (cancelled) void lock.release();
          else wakeLock.current = lock;
        }
      } catch {
        /* wake lock unsupported */
      }
    };
    void request();
    return () => {
      cancelled = true;
      void wakeLock.current?.release();
      wakeLock.current = null;
    };
  }, [isFullscreen]);

  const syncLabel =
    syncStatus === "connected" ? "Connected" : syncStatus === "syncing" ? "Syncing…" : "Disconnected";
  const syncClass =
    syncStatus === "connected"
      ? "border-stage-safe/30 bg-stage-safe/10 text-stage-safe"
      : syncStatus === "syncing"
        ? "border-stage-warn/30 bg-stage-warn/10 text-stage-warn"
        : "border-stage-danger/30 bg-stage-danger/10 text-stage-danger";

  return (
    <main className={`h-screen w-screen bg-stage-bg ${idle ? "cursor-none" : ""}`}>
      <h1 className="sr-only">Stage timer</h1>
      <StageScreen
        speaker={speaker}
        state={state}
        now={now}
        showElapsed={displayMode === "elapsed"}
        thresholds={thresholds}
      />
      <div
        role="status"
        aria-live="polite"
        aria-label={`Real-time sync ${syncLabel}`}
        className={`fixed left-6 top-6 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur transition-opacity duration-300 ${syncClass}`}
      >
        {syncStatus === "connected" ? (
          <Wifi className="size-3.5" />
        ) : syncStatus === "syncing" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <WifiOff className="size-3.5" />
        )}
        <span>{syncLabel}</span>
      </div>
      {!(isIOS && isStandalone) && <button
        type="button"
        onClick={() => void toggleFullscreen()}
        aria-label={isFullscreen ? "Exit TV mode" : "Enter TV mode"}
        className={`fixed right-6 top-6 z-50 flex items-center gap-2 rounded-full border border-stage-fg/20 bg-stage-fg/10 px-4 py-2 text-sm font-medium text-stage-fg backdrop-blur transition-opacity duration-300 hover:bg-stage-fg/20 focus-visible:opacity-100 ${
          idle ? "opacity-0" : "opacity-100"
        }`}
      >
        {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        {isFullscreen ? "Exit TV mode" : isIOS ? "TV mode ⓘ" : "TV mode"}
      </button>}
    {showIOSHint && (
        <div className="fixed inset-x-6 top-20 z-50 rounded-xl border border-stage-fg/20 bg-stage-bg/90 px-4 py-4 text-center text-sm text-stage-fg backdrop-blur">
          On iPhone, tap <strong>Share → Add to Home Screen</strong> to use fullscreen mode.
        </div>
      )}
    </main>
  );
}
