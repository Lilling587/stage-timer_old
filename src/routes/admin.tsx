import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { StageScreen } from "@/components/StageScreen";
import type { AdminActionInput } from "@/lib/admin-actions";
import { adminAction } from "@/lib/admin.functions";
import {
  elapsedFor,
  formatClock,
  toneFor,
  useAdjustmentSettings,
  useAdminPresence,
  useDisplayModeControl,
  useNow,
  useQuickMessages,
  useShow,
  useThresholdControl,
  type Speaker,
} from "@/lib/show";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Run of show — Stage Timer" },
      {
        name: "description",
        content:
          "Manage speakers, control the countdown, and send messages to the stage screen in real time.",
      },
      { property: "og:title", content: "Run of show — Stage Timer" },
      {
        property: "og:description",
        content: "Admin control room for the Stage Timer.",
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

type CsvRow = { name: string; minutes: number; notes: string };

const CSV_TEMPLATE = "Name,Minutes,Notes\nExample Speaker,20,Optional notes here\n";

function splitCsvLine(line: string) {
  const separator = line.split(";").length > line.split(",").length ? ";" : ",";
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

function parseSpeakerCsv(text: string): { rows: CsvRow[]; skipped: number } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const rows: CsvRow[] = [];
  let skipped = 0;
  lines.slice(1).forEach((line) => {
    const [rawName = "", rawMinutes = "", rawNotes = ""] = splitCsvLine(line);
    const minutes = Number(rawMinutes.replace(",", "."));
    if (!Number.isFinite(minutes) || !Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
      skipped += 1;
      return;
    }
    rows.push({
      name: rawName.slice(0, 80),
      minutes,
      notes: rawNotes.slice(0, 500),
    });
  });
  return { rows, skipped };
}

type SpeakerCardProps = {
  speaker: Speaker;
  index: number;
  total: number;
  isLive: boolean;
  confirming: boolean;
  onConfirmChange: (id: string | null) => void;
  onMove: (index: number, delta: number) => void;
  onSelect: (speaker: Speaker) => void;
  onEdit: (speaker: Speaker) => void;
  onRemove: (speaker: Speaker) => void;
};

function SpeakerCard({
  speaker,
  index,
  total,
  isLive,
  confirming,
  onConfirmChange,
  onMove,
  onSelect,
  onEdit,
  onRemove,
}: SpeakerCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: speaker.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative overflow-hidden rounded-xl border p-3 transition-colors ${
        isDragging ? "z-10 opacity-80 shadow-lg" : ""
      } ${
        isLive
          ? "border-console-accent/50 bg-console-panel shadow-[0_8px_30px_-12px_var(--console-accent)]"
          : "border-console-line bg-console-surface hover:border-console-raised"
      }`}
    >
      {isLive ? <span className="absolute inset-y-0 left-0 w-1 bg-console-accent" /> : null}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            aria-label={`Reorder ${displayName(speaker.name)}`}
            className="mt-1 cursor-grab touch-none rounded-md p-1 text-console-dim transition-colors hover:bg-console-raised hover:text-console-fg active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
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
            {speaker.notes ? (
              <p className="mt-1 text-[10px] italic text-console-dim">
                {speaker.notes}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            aria-label={`Move ${displayName(speaker.name)} up`}
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="rounded-md p-1.5 text-xs text-console-muted transition-colors hover:bg-console-raised hover:text-console-fg disabled:pointer-events-none disabled:opacity-30"
          >
            ↑
          </button>
          <button
            aria-label={`Move ${displayName(speaker.name)} down`}
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="rounded-md p-1.5 text-xs text-console-muted transition-colors hover:bg-console-raised hover:text-console-fg disabled:pointer-events-none disabled:opacity-30"
          >
            ↓
          </button>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        {confirming ? (
          <>
            <span className="flex-1 self-center text-[11px] text-console-muted">
              Delete {displayName(speaker.name)}?
            </span>
            <button
              onClick={() => {
                onConfirmChange(null);
                void onRemove(speaker);
              }}
              className="rounded-lg border border-console-danger/40 bg-console-danger/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-console-danger transition-colors hover:bg-console-danger/25"
            >
              Confirm
            </button>
            <button onClick={() => onConfirmChange(null)} className={ghostButton}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelect(speaker)}
              disabled={isLive}
              className={`flex-1 ${isLive ? accentButton : ghostButton}`}
            >
              {isLive ? "On stage" : "Set live"}
            </button>
            <button onClick={() => onEdit(speaker)} className={ghostButton}>
              Edit
            </button>
            <button
              onClick={() => onConfirmChange(speaker.id)}
              aria-label={`Delete ${displayName(speaker.name)}`}
              className="rounded-lg border border-console-danger/30 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-console-danger transition-colors hover:bg-console-danger/15"
            >
              Delete?
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function AdminPage() {
  const { speakers, state, refresh, syncStatus } = useShow();
  const adminCount = useAdminPresence();
  const { displayMode, setDisplayMode } = useDisplayModeControl();
  const { thresholds } = useThresholdControl();
  const { adjustments } = useAdjustmentSettings();
  const { quickMessages } = useQuickMessages();
  const now = useNow(true);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("20");
  const [message, setMessage] = useState("");
    const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [csvSkipped, setCsvSkipped] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
        notes: notes.trim(),
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
        notes: notes.trim(),
      });
      if (!ok) return;
      toast.success("Speaker added");
    }
        setName("");
    setDuration("20");
    setNotes("");
  }

  function startEdit(speaker: Speaker) {
    setCsvRows(null);
    setEditingId(speaker.id);
    setName(speaker.name);
    setDuration(String(speaker.duration_minutes));
    setNotes(speaker.notes ?? "");
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= speakers.length) return;
    const a = speakers[index]!;
    const b = speakers[target]!;
    await run({ type: "updateSpeaker", id: a.id, position: b.position });
    await run({ type: "updateSpeaker", id: b.id, position: a.position });
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = speakers.findIndex((s) => s.id === active.id);
    const to = speakers.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    const ordered = arrayMove(speakers, from, to);
    const positions = speakers.map((s) => s.position).sort((x, y) => x - y);
    for (let i = 0; i < ordered.length; i += 1) {
      const speaker = ordered[i]!;
      const position = positions[i]!;
      if (speaker.position === position) continue;
      await run({ type: "updateSpeaker", id: speaker.id, position });
    }
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
              <aside className="order-3 flex w-full flex-col border-console-line bg-console-surface lg:order-1 lg:h-screen lg:w-80 lg:shrink-0 lg:border-r">
                       <div className="hidden items-center justify-between border-b border-console-line bg-console-panel px-4 py-3 lg:flex">
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

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <form
            onSubmit={submitSpeaker}
            className="rounded-xl border border-console-line bg-console-panel p-3"
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-console-dim">
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
                  className={`${fieldClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                  type="number"
                  min={1}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
                        <div className="mt-2">
              <label htmlFor="speaker-notes" className="sr-only">Notes</label>
              <textarea
                id="speaker-notes"
                value={notes}
                maxLength={500}
                rows={2}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Private notes (pronunciation, topic, cues…)"
                className={`${fieldClass} resize-none`}
              />
            </div>
            <div className="mt-2 flex gap-2">
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
                    setNotes("");
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={speakers.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {speakers.map((speaker, index) => (
                  <SpeakerCard
                    key={speaker.id}
                    speaker={speaker}
                    index={index}
                    total={speakers.length}
                    isLive={speaker.id === state?.current_speaker_id}
                    confirming={confirmingId === speaker.id}
                    onConfirmChange={setConfirmingId}
                    onMove={move}
                    onSelect={selectSpeaker}
                    onEdit={startEdit}
                    onRemove={remove}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
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
              <div className="order-1 flex items-center justify-between border-b border-console-line bg-console-panel px-4 py-3 lg:hidden">
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
      <main className="order-2 flex min-w-0 flex-1 flex-col lg:order-2 lg:h-screen lg:overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-console-line bg-console-surface/80 px-4 py-2.5 lg:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-console-accent font-sora text-base font-bold text-console-accent-fg">
                C
              </span>
              <h1 className="font-sora text-lg font-extrabold uppercase tracking-tight">Command</h1>
            </div>
            <span className="hidden h-5 w-px bg-console-line sm:block" />
            <nav className="flex gap-4">
              <a
                href="/companion"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-console-muted transition-colors hover:text-console-fg"
              >
                Companion
              </a>
              <a
                href="/settings"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-console-muted transition-colors hover:text-console-fg"
              >
                Settings
              </a>
            </nav>
          </div>
         <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-console-dim">
                Realtime sync
              </span>
              <span className="flex items-center gap-2 font-console-mono text-[11px] font-bold text-console-accent">
                {syncLabel}
                <span className={`h-2 w-2 rounded-full ${syncDot}`} />
              </span>
            </div>
            <a
              href="/stage"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-console-accent px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-console-accent-fg transition-all hover:bg-console-accent-hover active:scale-95"
            >
              Stage view ↗
            </a>
          </div>
        </header>

        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-12 lg:gap-5 lg:p-5">
          <section className="flex flex-col gap-4 lg:col-span-8">
           <div className="relative w-[288px] h-[162px] overflow-hidden rounded-2xl border border-console-line bg-black shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
              <div style={{ width: 1280, height: 720, transform: "scale(0.225)", transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
                <StageScreen
                  speaker={current}
                  state={state}
                  now={now}
                  showElapsed={displayMode === "elapsed"}
                  thresholds={thresholds}
                />
              </div>
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
                <span className="rounded-md bg-console-danger px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-console-accent-fg">
                  Live feed
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-console-line bg-console-surface p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-console-dim">
                  Time adjustments
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {adjustments.map((delta) => (
                    <button
                      key={delta}
                      onClick={() => adjustTime(delta)}
                      disabled={!current}
                      className="rounded-xl border border-console-line bg-console-bg py-2.5 font-console-mono text-sm text-console-accent transition-all hover:border-console-accent/50 hover:bg-console-panel active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                    >
                      {delta > 0 ? `+${delta}m` : `${delta}m`}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-end gap-3">
                  {current ? (
                    <span
                      aria-label={
                        displayMode === "elapsed"
                          ? "Time elapsed for the speaker on stage"
                          : "Time remaining for the speaker on stage"
                      }
                      className={`shrink-0 font-console-mono text-lg tabular-nums ${
                        {
                          over: "text-console-danger",
                          danger: "text-console-danger",
                          warn: "text-console-accent",
                          safe: "text-console-ok",
                        }[
                          toneFor(
                            current.duration_minutes * 60 - elapsedFor(state, now),
                            thresholds,
                          )
                        ]
                      }`}
                    >
                      {formatClock(
                        displayMode === "elapsed"
                          ? elapsedFor(state, now)
                          : current.duration_minutes * 60 - elapsedFor(state, now),
                      )}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col justify-center rounded-2xl border border-console-line bg-console-surface p-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={start}
                    disabled={state?.status === "running"}
                    className="min-w-0 truncate rounded-xl bg-console-accent py-3 text-xs font-bold uppercase tracking-[0.15em] text-console-accent-fg shadow-[0_10px_25px_-10px_var(--console-accent)] transition-all hover:bg-console-accent-hover active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 sm:text-sm sm:tracking-[0.2em]"
                  >
                    Start
                  </button>
                  <button
                    onClick={pause}
                    disabled={state?.status !== "running"}
                    className="min-w-0 truncate rounded-xl bg-console-raised py-3 text-xs font-bold uppercase tracking-[0.15em] text-console-fg transition-all hover:bg-console-line active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 sm:text-sm sm:tracking-[0.2em]"
                  >
                    Pause
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button onClick={reset} className={`min-w-0 truncate ${ghostButton}`}>
                    Reset timer
                  </button>
                  <button onClick={next} className={`min-w-0 truncate ${ghostButton}`}>
                    Next up
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="hidden sm:block" />
              <button
                type="button"
                onClick={() => patchState({ blackout: !(state?.blackout ?? false) })}
                className={`w-full truncate rounded-xl border px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
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
              <div className="border-b border-console-line bg-console-panel px-4 py-3">
                <h2 className="font-sora text-[11px] font-extrabold uppercase tracking-[0.3em] text-console-muted">
                  Stage messaging
                </h2>
              </div>
              <div className="flex-1 p-4">
                {state?.message ? (
                  <div className="mb-3 rounded-xl border border-console-accent/30 bg-console-accent/10 px-3 py-2 text-xs text-console-accent">
                    <span className="font-bold uppercase tracking-[0.2em]">Live on stage</span>
                    <p className="mt-1 italic text-console-fg">"{state.message}"</p>
                  </div>
                ) : null}
                {quickMessages.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {quickMessages.map((quick, i) => {
                      const active = state?.message === quick;
                      return (
                        <button
                          key={`${quick}-${i}`}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            patchState({ message: quick, message_sent_at: new Date().toISOString() })
                          }
                          className={`max-w-[14rem] truncate rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-all active:scale-95 ${
                            active
                              ? "bg-console-accent text-console-accent-fg hover:bg-console-accent-hover"
                              : "border border-console-line text-console-muted hover:bg-console-raised hover:text-console-fg"
                          }`}
                        >
                          {quick}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <textarea
                  value={message}
                  maxLength={200}
                  onChange={(e) => setMessage(e.target.value)}
                  aria-label="Message to stage"
                  className="h-28 w-full resize-none rounded-xl border border-console-line bg-console-bg p-4 text-sm leading-relaxed text-console-fg outline-none transition-colors placeholder:text-console-dim focus:border-console-accent lg:h-full lg:min-h-24"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-console-line bg-console-panel p-4">
                <button type="submit" className={accentButton}>
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => patchState({ message: "", message_sent_at: null })}
                  disabled={!state?.message}
                  className={ghostButton}
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-row gap-3">
              <button
                type="button"
                aria-pressed={displayMode === "elapsed"}
                onClick={() => {
                  const next = displayMode === "elapsed" ? "remaining" : "elapsed";
                  setDisplayMode(next);
                  void patchState({ display_mode: next });
                }}
                className={`flex-1 ${displayMode === "elapsed" ? accentButton : ghostButton}`}
              >
                Timer remaining/elapsed
              </button>
              <div className="flex flex-1 items-center justify-between rounded-xl border border-console-line bg-console-surface px-4 py-3">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-console-muted">
                  Clock mode
                </span>
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
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
