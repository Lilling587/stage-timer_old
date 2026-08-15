import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { adminAction } from "@/lib/admin.functions";
import { DEFAULT_THRESHOLDS, useShow, useThresholdControl } from "@/lib/show";

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
  const { state, refresh } = useShow();
  const { thresholds, setThresholds } = useThresholdControl();

  async function patchState(patch: Record<string, unknown>) {
    try {
      const result = (await adminAction({
        data: {
          action: {
            type: "patchState",
            patch: patch as never,
            expected_revision: state?.revision,
          },
        },
      })) as { ok: boolean; conflict?: boolean } | undefined;
      if (result && result.conflict) {
        await refresh();
        toast.warning("Another admin just changed the stage. We refreshed to the latest state.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
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
        <section className="rounded-2xl border border-console-line bg-console-surface p-5">
          <h2 className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-console-muted">
            Colour thresholds
          </h2>
          <p className="mt-1 text-[11px] text-console-dim">
            Minutes left when the stage timer turns yellow, then red.
          </p>
          <button
            type="button"
            onClick={() => setThresholds({ ...thresholds, enabled: !thresholds.enabled })}
            aria-pressed={!thresholds.enabled}
            className={`mt-4 w-full ${thresholds.enabled ? ghostButton : accentButton}`}
          >
            {thresholds.enabled ? "Colours on" : "Always green"}
          </button>
          <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${thresholds.enabled ? "" : "opacity-40"}`}>
            <label className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-console-accent">
                Yellow at
              </span>
              <input
                type="number"
                min={0}
                max={120}
                step={0.5}
                disabled={!thresholds.enabled}
                value={thresholds.warnMinutes}
                onChange={(event) =>
                  setThresholds({ ...thresholds, warnMinutes: Number(event.target.value) })
                }
                className={fieldClass}
                aria-label="Minutes remaining when the timer turns yellow"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-console-danger">
                Red at
              </span>
              <input
                type="number"
                min={0}
                max={120}
                step={0.5}
                disabled={!thresholds.enabled}
                value={thresholds.dangerMinutes}
                onChange={(event) =>
                  setThresholds({ ...thresholds, dangerMinutes: Number(event.target.value) })
                }
                className={fieldClass}
                aria-label="Minutes remaining when the timer turns red"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
            className={`mt-4 w-full ${ghostButton}`}
          >
            Reset to 5 / 2 min
          </button>
        </section>

        <section className="flex items-center justify-between rounded-2xl border border-console-line bg-console-surface p-5">
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-console-muted">
              Clock display
            </span>
            <span className="text-[11px] text-console-dim">
              Show the time of day instead of the timer
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state?.show_clock ?? false}
            aria-label="Show clock instead of timer"
            onClick={() => patchState({ show_clock: !(state?.show_clock ?? false) })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              state?.show_clock ? "bg-console-accent" : "bg-console-raised"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-console-fg transition-all ${
                state?.show_clock ? "right-1" : "left-1"
              }`}
            />
          </button>
        </section>
      </main>
    </div>
  );
}