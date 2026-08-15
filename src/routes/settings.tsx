import { createFileRoute, Link } from "@tanstack/react-router";
import { DEFAULT_THRESHOLDS, useThresholdControl } from "@/lib/show";

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

function SettingsPage() {
  const { thresholds, setThresholds } = useThresholdControl();

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
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-console-muted">Colours</span>
              <button
                type="button"
                onClick={() => setThresholds({ ...thresholds, enabled: !thresholds.enabled })}
                aria-pressed={!thresholds.enabled}
                className={`shrink-0 ${thresholds.enabled ? ghostButton : accentButton}`}
              >
                {thresholds.enabled ? "On" : "Off"}
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

        
      </main>
    </div>
  );
}
