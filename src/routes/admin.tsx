import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { StageScreen } from "@/components/StageScreen";
import { adminAction, type AdminActionInput } from "@/lib/admin.functions";
import {
  elapsedFor,
  formatClock,
  toneFor,
  useAdminPresence,
  useNow,
  useShow,
  type Speaker,
} from "@/lib/show";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Run of show — Conference speaker timer" },
      {
        name: "description",
        content:
          "Manage speakers, control the countdown, and send messages to the stage screen in real time.",
      },
      { property: "og:title", content: "Run of show — Conference speaker timer" },
      {
        property: "og:description",
        content: "Admin control room for the conference speaker timer.",
      },
    ],
  }),
  component: AdminPage,
});

const speakerSchema = z.object({
  name: z.string().trim().max(80, "Name is too long"),
  duration: z.coerce.number().int().min(1, "Minimum 1 minute").max(600, "Maximum 600 minutes"),
});

const messageSchema = z
  .string()
  .trim()
  .min(1, "Write a message first")
  .max(200, "Keep it under 200 characters");

function displayName(name: string) {
  return name.trim() === "" ? "Unnamed" : name;
}

const fieldClass =
  "w-full rounded-lg border border-console-line bg-console-bg px-3 py-2 text-sm text-console-fg outline-none transition-colors placeholder:text-console-dim focus:border-console-accent";

const ghostButton =
  "rounded-lg border border-console-line px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-console-muted transition-all hover:bg-console-raised hover:text-console-fg active:scale-95 disabled:pointer-events-none disabled:opacity-40";

const accentButton =
  "rounded-lg bg-console-accent px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-console-accent-fg transition-all hover:bg-console-accent-hover active:scale-95 disabled:pointer-events-none disabled:opacity-40";

function AdminPage() {
  const { speakers, state, refresh, syncStatus } = useShow();
  const adminCount = useAdminPresence();
  const now = useNow(true);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("20");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const current = speakers.find((s) => s.id === state?.current_speaker_id) ?? null;
  const currentIndex = current ? speakers.findIndex((s) => s.id === current.id) : -1;

  async function run(action: AdminActionInput["action"]) {
    try {
      const result = (await adminAction({ data: { action } })) as
        | { ok: boolean; conflict?: boolean }
        | undefined;
      if (result && result.conflict) {
        await refresh();
        toast.warning(
          "Another admin just changed the stage. We refreshed to the latest state — check it and try again.",
        );
        return false;
      }
      return true;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Something went wrong";
      toast.error(messageText);
      return false;
    }
  }

  // Every stage write carries the revision this console last saw. If someone
  // else changed the show in the meantime the write is rejected instead of
  // silently overwriting them, keeping one source of truth.
  async function patchState(patch: Record<string, unknown>) {
    return run({
      type: "patchState",
      patch: patch as never,
      expected_revision: state?.revision,
    });
  }

  async function submitSpeaker(e: React.FormEvent) {
    e.preventDefault();
    const parsed = speakerSchema.safeParse({ name, duration });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (editingId) {
      const ok = await run({
        type: "updateSpeaker",
        id: editingId,
        name: parsed.data.name,
        duration_minutes: parsed.data.duration,
      });
      if (!ok) return;
      toast.success("Speaker updated");
      setEditingId(null);
    } else {
      const nextPosition = speakers.length ? Math.max(...speakers.map((s) => s.position)) + 1 : 0;
      const ok = await run({
        type: "addSpeaker",
        name: parsed.data.name,
        duration_minutes: parsed.data.duration,
        position: nextPosition,
      });
      if (!ok) return;
      toast.success("Speaker added");
    }
    setName("");
    setDuration("20");
  }

  function startEdit(speaker: Speaker) {
    setEditingId(speaker.id);
    setName(speaker.name);
    setDuration(String(speaker.duration_minutes));
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= speakers.length) return;
    const a = speakers[index]!;
    const b = speakers[target]!;
    await run({ type: "updateSpeaker", id: a.id, position: b.position });
    await run({ type: "updateSpeaker", id: b.id, position: a.position });
  }

  async function remove(speaker: Speaker) {
    const ok = await run({ type: "deleteSpeaker", id: speaker.id });
    if (!ok) return;
    if (state?.current_speaker_id === speaker.id) {
      await patchState({
        current_speaker_id: null,
        status: "stopped",
        elapsed_seconds: 0,
        started_at: null,
      });
    }
    if (editingId === speaker.id) {
      setEditingId(null);
      setName("");
      setDuration("20");
    }
  }

  async function selectSpeaker(speaker: Speaker) {
    await patchState({
      current_speaker_id: speaker.id,
      status: "stopped",
      elapsed_seconds: 0,
      started_at: null,
    });
  }

  async function start() {
    const speakerId = state?.current_speaker_id ?? speakers[0]?.id ?? null;
    if (!speakerId) {
      toast.error("Add a speaker first");
      return;
    }
    await patchState({
      current_speaker_id: speakerId,
      status: "running",
      started_at: new Date().toISOString(),
    });
  }

  async function pause() {
    if (state?.status !== "running") return;
    await patchState({
      status: "paused",
      elapsed_seconds: Math.round(elapsedFor(state, Date.now())),
      started_at: null,
    });
  }

  async function reset() {
    await patchState({ status: "stopped", elapsed_seconds: 0, started_at: null });
  }

  async function next() {
    const nextSpeaker = speakers[currentIndex + 1] ?? speakers[0];
    if (!nextSpeaker) {
      toast.error("Add a speaker first");
      return;
    }
    await patchState({
      current_speaker_id: nextSpeaker.id,
      status: "stopped",
      elapsed_seconds: 0,
      started_at: null,
    });
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const parsed = messageSchema.safeParse(message);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the message");
      return;
    }
    await patchState({ message: parsed.data, message_sent_at: new Date().toISOString() });
    setMessage("");
    toast.success("Message sent to stage");
  }

  async function adjustTime(minutes: number) {
    if (!current) return;
    const newDuration = Math.max(1, current.duration_minutes + minutes);
    await run({ type: "updateSpeaker", id: current.id, duration_minutes: newDuration });
  }

  const syncLabel =
    syncStatus === "connected" ? "Connected" : syncStatus === "syncing" ? "Syncing" : "Offline";
  const syncDot =
    syncStatus === "connected"
      ? "bg-console-ok"
      : syncStatus === "syncing"
        ? "bg-console-accent animate-pulse"
        : "bg-console-danger";

  return (
    <div className="flex min-h-screen w-full flex-col bg-console-bg font-manrope text-console-fg lg:flex-row">
      {/* Sidebar: run of show */}
      <aside className="flex w-full flex-col border-console-line bg-console-surface lg:h-screen lg:w-80 lg:shrink-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-console-line bg-console-panel px-6 py-5">
          <h2 className="font-sora text-[11px] font-bold uppercase tracking-[0.2em] text-console-muted">
            Run of show
          </h2>
          {current ? (
            <span className="flex items-center gap-2 rounded-full border border-console-accent/30 bg-console-accent/10 px-2 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-console-accent" />
              <span className="font-console-mono text-[9px] font-bold uppercase text-console-accent">
                Live
              </span>
            </span>
          ) : null}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <form
            onSubmit={submitSpeaker}
            className="rounded-xl border border-console-line bg-console-panel p-4"
          >
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-console-dim">
              {editingId ? "Edit speaker" : "Add speaker"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label htmlFor="speaker-name" className="sr-only">
                  Speaker name
                </label>
                <input
                  id="speaker-name"
                  className={fieldClass}
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="speaker-duration" className="sr-only">
                  Minutes
                </label>
                <input
                  id="speaker-duration"
                  className={fieldClass}
                  type="number"
                  min={1}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="submit" className={`flex-1 ${accentButton}`}>
                {editingId ? "Save changes" : "Add speaker"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className={ghostButton}
                  onClick={() => {
                    setEditingId(null);
                    setName("");
                    setDuration("20");
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {speakers.length === 0 ? (
            <p className="px-1 text-xs text-console-muted">
              No speakers yet. Add the first one above.
            </p>
          ) : null}

          <ul className="space-y-3">
            {speakers.map((speaker, index) => {
              const isLive = speaker.id === state?.current_speaker_id;
              return (
                <li
                  key={speaker.id}
                  className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                    isLive
                      ? "border-console-accent/50 bg-console-panel shadow-[0_8px_30px_-12px_var(--console-accent)]"
                      : "border-console-line bg-console-surface hover:border-console-raised"
                  }`}
                >
                  {isLive ? (
                    <span className="absolute inset-y-0 left-0 w-1 bg-console-accent" />
                  ) : null}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {isLive ? (
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-console-accent">
                          Now speaking
                        </p>
                      ) : (
                        <p className="mb-1 font-console-mono text-[9px] uppercase tracking-[0.2em] text-console-dim">
                          {String(index + 1).padStart(2, "0")}
                        </p>
                      )}
                      <h3 className="truncate font-sora text-base font-bold leading-tight">
                        {speaker.name.trim() === "" ? (
                          <span className="italic text-console-muted">Unnamed</span>
                        ) : (
                          speaker.name
                        )}
                      </h3>
                      <p className="mt-1 font-console-mono text-[10px] text-console-muted">
                        {speaker.duration_minutes} min
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        aria-label={`Move ${displayName(speaker.name)} up`}
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="rounded-md p-1.5 text-xs text-console-muted transition-colors hover:bg-console-raised hover:text-console-fg disabled:pointer-events-none disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Move ${displayName(speaker.name)} down`}
                        onClick={() => move(index, 1)}
                        disabled={index === speakers.length - 1}
                        className="rounded-md p-1.5 text-xs text-console-muted transition-colors hover:bg-console-raised hover:text-console-fg disabled:pointer-events-none disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => selectSpeaker(speaker)}
                      disabled={isLive}
                      className={`flex-1 ${isLive ? accentButton : ghostButton}`}
                    >
                      {isLive ? "On stage" : "Set live"}
                    </button>
                    <button onClick={() => startEdit(speaker)} className={ghostButton}>
                      Edit
                    </button>
                    <button
                      onClick={() => remove(speaker)}
                      aria-label={`Delete ${displayName(speaker.name)}`}
                      className="rounded-lg border border-console-danger/30 px-3 text-console-danger transition-colors hover:bg-console-danger/15"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-console-line bg-console-bg px-4 py-3 font-console-mono text-[9px] text-console-muted">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${syncDot}`} />
            {syncLabel}
          </span>
          <span className="font-bold text-console-accent">
            {adminCount} admin{adminCount === 1 ? "" : "s"}
          </span>
        </div>
      </aside>

      {/* Main console */}
      <main className="flex min-w-0 flex-1 flex-col lg:h-screen lg:overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-console-line bg-console-surface/80 px-6 py-4 lg:px-8">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-console-accent font-sora text-lg font-bold text-console-accent-fg">
                C
              </span>
              <h1 className="font-sora text-xl font-extrabold uppercase tracking-tight">Command</h1>
            </div>
            <span className="hidden h-6 w-px bg-console-line sm:block" />
            <nav className="flex gap-6">
              <a
                href="/companion"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-console-muted transition-colors hover:text-console-fg"
              >
                Companion
              </a>
              <a
                href="/stage"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-console-muted transition-colors hover:text-console-fg"
              >
                Stage view
              </a>
            </nav>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-console-dim">
              Realtime sync
            </span>
            <span className="flex items-center gap-2 font-console-mono text-[11px] font-bold text-console-accent">
              {syncLabel}
              <span className={`h-2 w-2 rounded-full ${syncDot}`} />
            </span>
          </div>
        </header>

        <div className="grid flex-1 gap-6 p-6 lg:grid-cols-12 lg:gap-8 lg:p-8">
          <section className="flex flex-col gap-6 lg:col-span-8 lg:gap-8">
            <div className="relative aspect-video overflow-hidden rounded-3xl border border-console-line bg-black shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
              <StageScreen speaker={current} state={state} now={now} compact />
              <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-2">
                <span className="rounded-md bg-console-danger px-3 py-1 text-[9px] font-extrabold uppercase tracking-[0.2em] text-console-accent-fg">
                  Live feed
                </span>
                <span className="rounded-md border border-console-fg/10 bg-black/50 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-console-fg backdrop-blur-md">
                  Source: main
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-console-line bg-console-surface p-4 sm:p-6">
                <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-console-dim">
                  Time adjustments
                </p>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[-5, -1, 1, 5].map((delta) => (
                    <button
                      key={delta}
                      onClick={() => adjustTime(delta)}
                      disabled={!current}
                      className="rounded-xl border border-console-line bg-console-bg py-3 font-console-mono text-sm text-console-accent transition-all hover:border-console-accent/50 hover:bg-console-panel active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:py-3.5"
                    >
                      {delta > 0 ? `+${delta}m` : `${delta}m`}
                    </button>
                  ))}
                </div>
                <p className="mt-4 truncate text-[11px] text-console-muted">
                  {current ? (
                    <>
                      On stage:{" "}
                      {current.name.trim() === "" ? (
                        <em className="italic">Unnamed</em>
                      ) : (
                        current.name
                      )}
                    </>
                  ) : (
                    "No speaker on stage yet"
                  )}
                </p>
              </div>

              <div className="flex flex-col justify-center rounded-2xl border border-console-line bg-console-surface p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <button
                    onClick={start}
                    disabled={state?.status === "running"}
                    className="min-w-0 truncate rounded-xl bg-console-accent py-4 text-xs font-bold uppercase tracking-[0.15em] text-console-accent-fg shadow-[0_10px_25px_-10px_var(--console-accent)] transition-all hover:bg-console-accent-hover active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 sm:py-5 sm:text-sm sm:tracking-[0.2em]"
                  >
                    Start
                  </button>
                  <button
                    onClick={pause}
                    disabled={state?.status !== "running"}
                    className="min-w-0 truncate rounded-xl bg-console-raised py-4 text-xs font-bold uppercase tracking-[0.15em] text-console-fg transition-all hover:bg-console-line active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 sm:py-5 sm:text-sm sm:tracking-[0.2em]"
                  >
                    Pause
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4">
                  <button onClick={reset} className={`min-w-0 truncate ${ghostButton}`}>
                    Reset timer
                  </button>
                  <button onClick={next} className={`min-w-0 truncate ${ghostButton}`}>
                    Next up
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 grid gap-4 sm:grid-cols-2 sm:gap-6">
              <div className="hidden sm:block" />
              <button
                type="button"
                onClick={() => patchState({ blackout: !(state?.blackout ?? false) })}
                className={`w-full truncate rounded-xl border px-3 py-3 text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all active:scale-[0.98] sm:tracking-[0.25em] ${
                  state?.blackout
                    ? "blackout-blink border-console-danger bg-console-danger text-console-accent-fg"
                    : "border-console-danger/40 bg-console-danger/10 text-console-danger hover:bg-console-danger hover:text-console-accent-fg"
                }`}
              >
                {state?.blackout ? "Blackout on — restore stage" : "Blackout stage"}
              </button>
            </div>
          </section>

          <section className="flex flex-col lg:col-span-4">
            <form
              onSubmit={sendMessage}
              className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-console-line bg-console-surface"
            >
              <div className="border-b border-console-line bg-console-panel px-6 py-5">
                <h2 className="font-sora text-[11px] font-extrabold uppercase tracking-[0.3em] text-console-muted">
                  Stage messaging
                </h2>
              </div>
              <div className="flex-1 p-6">
                {state?.message ? (
                  <div className="mb-4 rounded-xl border border-console-accent/30 bg-console-accent/10 px-4 py-3 text-xs text-console-accent">
                    <span className="font-bold uppercase tracking-[0.2em]">Live on stage</span>
                    <p className="mt-1 italic text-console-fg">"{state.message}"</p>
                  </div>
                ) : null}
                <textarea
                  value={message}
                  maxLength={200}
                  onChange={(e) => setMessage(e.target.value)}
                  aria-label="Message to stage"
                  className="h-32 w-full resize-none rounded-2xl border border-console-line bg-console-bg p-5 text-sm leading-relaxed text-console-fg outline-none transition-colors placeholder:text-console-dim focus:border-console-accent lg:h-full lg:min-h-32"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-console-line bg-console-panel p-6">
                <button
                  type="button"
                  onClick={() => patchState({ message: "", message_sent_at: null })}
                  disabled={!state?.message}
                  className={ghostButton}
                >
                  Clear
                </button>
                <button type="submit" className={accentButton}>
                  Send
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-4 lg:mt-8">
              <div className="flex items-center justify-between rounded-2xl border border-console-line bg-console-surface p-5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-console-muted">
                    Clock display
                  </span>
                  <span className="text-[9px] text-console-dim">
                    Show the time of day instead of the timer
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={state?.show_clock ?? false}
                  aria-label="Show clock instead of timer"
                  onClick={() => patchState({ show_clock: !(state?.show_clock ?? false) })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    state?.show_clock ? "bg-console-accent" : "bg-console-raised"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-console-fg transition-all ${
                      state?.show_clock ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
