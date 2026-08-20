import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CUE_SETTINGS,
  DEFAULT_QUICK_MESSAGES,
  DEFAULT_THRESHOLDS,
  MESSAGE_TONES,
  useAdjustmentSettings,
  useCueControl,
  useQuickMessages,
  useThresholdControl,
  type CueIntensity,
  type MessageTone,
} from "@/lib/show";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stage Timer" },
      {
        name: "description",
        content:
          "Set the colour thresholds for the stage countdown and choose whether the stage shows a clock or the timer.",
      },
      { property: "og:title", content: "Settings — Stage Timer" },
      {
        property: "og:description",
        content: "Colour thresholds and clock display options for the Stage Timer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const fieldClass =
  "w-full rounded-lg border border-console-line bg-console-bg px-3 py-2 text-sm text-console-fg outline-none transition-colors focus:border-console-accent";

const ghostButton =
  "rounded-lg border border-console-line px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-console-muted transition-all hover:bg-console-raised hover:text-console-fg active:scale-95 disabled:pointer-events-none disabled:opacity-40";

const accentButton =
  "rounded-lg bg-console-accent px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-console-accent-fg transition-all hover:bg-console-accent-hover active:scale-95 disabled:pointer-events-none disabled:opacity-40";

const toneDot: Record<MessageTone, string> = {
  info: "bg-console-muted",
  warn: "bg-console-warn",
  stop: "bg-console-danger",
};

const CUE_INTENSITIES: { value: CueIntensity; label: string }[] = [
  { value: "subtle", label: "Subtle" },
  { value: "normal", label: "Normal" },
  { value: "strong", label: "Strong" },
];

function SettingsPage() {
  const { thresholds, setThresholds } = useThresholdControl();
  const { adjustments, setAdjustments } = useAdjustmentSettings();
  const { quickMessages, setQuickMessages } = useQuickMessages();
  const { cue, setCue, testCue } = useCueControl();
  const [draft, setDraft] = useState("");
  const [draftTone, setDraftTone] = useState<MessageTone>("info");

  function addQuickMessage() {
    const value = draft.trim().slice(0, 200);
    if (!value) return;
    setQuickMessages([...quickMessages, { text: value, tone: draftTone }]);
    setDraft("");
    setDraftTone("info");
  }

  return (
    <div className="min-h-screen bg-console-bg font-manrope text-console-fg">
      <header className="flex items-center justify-between border-b border-console-line bg-console-surface/80 px-6 py-4">
        <h1 className="font-sora text-lg font-extrabold uppercase tracking-tight">Settings</h1>
        <Link
          to="/admin"
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-console-muted transition-colors hover:text-console-fg"
        >
          Back to command
        </Link>
      </header>

      <main className="mx-auto grid max-w-3xl gap-5 p-6">
       <section className="rounded-2xl border border-console-line bg-console-surface p-4">
          <h2 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-console-muted">
            Colour thresholds
          </h2>
         <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-console-muted">Timer colour warnings</span>
              <button
                type="button"
                role="switch"
                aria-checked={thresholds.enabled}
                aria-label="Enable timer colour warnings"
                onClick={() => setThresholds({ ...thresholds, enabled: !thresholds.enabled })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  thresholds.enabled ? "bg-console-accent" : "bg-console-raised"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-console-fg transition-all ${
                    thresholds.enabled ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>
            <label className={`flex flex-col gap-1 ${thresholds.enabled ? "" : "opacity-40"}`}>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-console-accent">Yellow at</span>
              <input
                type="number"
                min={0}
                max={120}
                step={0.5}
                disabled={!thresholds.enabled}
                value={thresholds.warnMinutes}
                onChange={(e) => setThresholds({ ...thresholds, warnMinutes: Number(e.target.value) })}
                className="w-20 rounded-lg border border-console-line bg-console-bg px-2 py-1.5 text-sm text-console-fg outline-none focus:border-console-accent"
                aria-label="Minutes remaining when the timer turns yellow"
              />
            </label>
            <label className={`flex flex-col gap-1 ${thresholds.enabled ? "" : "opacity-40"}`}>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-console-danger">Red at</span>
              <input
                type="number"
                min={0}
                max={120}
                step={0.5}
                disabled={!thresholds.enabled}
                value={thresholds.dangerMinutes}
                onChange={(e) => setThresholds({ ...thresholds, dangerMinutes: Number(e.target.value) })}
                className="w-20 rounded-lg border border-console-line bg-console-bg px-2 py-1.5 text-sm text-console-fg outline-none focus:border-console-accent"
                aria-label="Minutes remaining when the timer turns red"
              />
            </label>
            <button
              type="button"
              onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
              className={`shrink-0 ${ghostButton}`}
            >
              Reset
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-console-line bg-console-surface p-4">
          <h2 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-console-muted">
            Stage display
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-console-fg">Blink when over time</span>
              <span className="text-[11px] text-console-dim">
                Timer flashes red when the speaker runs past their allotted time
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={thresholds.blinkOnOver}
              aria-label="Blink timer when over time"
              onClick={() => setThresholds({ ...thresholds, blinkOnOver: !thresholds.blinkOnOver })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                thresholds.blinkOnOver ? "bg-console-accent" : "bg-console-raised"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-console-fg transition-all ${
                  thresholds.blinkOnOver ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>
        </section>

      <section className="rounded-2xl border border-console-line bg-console-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-console-muted">
              Time adjustment buttons
            </h2>
            <button
              type="button"
              onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
              className={ghostButton}
            >
              Reset
            </button>
          </div>
          <p className="mb-3 text-[11px] text-console-dim">
            Set the four time adjustment button values shown in the command page.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {adjustments.map((val, i) => (
              <label key={i} className="flex flex-col gap-1">
                <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${val < 0 ? "text-console-danger" : "text-console-ok"}`}>
                  {val < 0 ? `Button ${i + 1} (−)` : `Button ${i + 1} (+)`}
                </span>
                <input
                  type="number"
                  min={-600}
                  max={600}
                  value={val}
                  onChange={(e) => {
                    const next = [...adjustments];
                    next[i] = Number(e.target.value);
                    setAdjustments(next);
                  }}
                  className="w-full rounded-lg border border-console-line bg-console-bg px-2 py-1.5 text-sm text-console-fg outline-none focus:border-console-accent"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-console-line bg-console-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-console-muted">
              Quick messages
            </h2>
            <button
              type="button"
              onClick={() => setQuickMessages(DEFAULT_QUICK_MESSAGES)}
              className={ghostButton}
            >
              Reset
            </button>
          </div>
          <p className="mb-3 text-[11px] text-console-dim">
            One-tap messages shown above the message box in the command page.
          </p>
          <ul className="mb-3 flex flex-col gap-2">
            {quickMessages.length === 0 ? (
              <li className="text-[11px] italic text-console-dim">No quick messages yet.</li>
            ) : (
              quickMessages.map((msg, i) => (
                <li
                  key={`${msg}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-console-line bg-console-bg px-3 py-2"
                >
                  <span className="truncate text-sm text-console-fg">{msg}</span>
                  <button
                    type="button"
                    aria-label={`Delete quick message ${msg}`}
                    onClick={() => setQuickMessages(quickMessages.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded-md px-2 py-0.5 text-sm text-console-muted transition-colors hover:bg-console-raised hover:text-console-danger"
                  >
                    ×
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={200}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQuickMessage();
                }
              }}
              aria-label="New quick message"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={addQuickMessage}
              disabled={!draft.trim()}
              className={`shrink-0 ${accentButton}`}
            >
              Add
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
