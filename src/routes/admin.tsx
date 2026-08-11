import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StageScreen } from "@/components/StageScreen";
import { adminAction, type AdminActionInput } from "@/lib/admin.functions";
import { STATE_ID, elapsedFor, useNow, useShow, type Speaker } from "@/lib/show";

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

const messageSchema = z.string().trim().min(1, "Write a message first").max(200, "Keep it under 200 characters");

const CONTROL_KEY_STORAGE = "stage-timer-control-key";

function displayName(name: string) {
  return name.trim() === "" ? "Unnamed" : name;
}

function AdminPage() {
  const { speakers, state } = useShow();
  const now = useNow(true);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("20");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [controlKey, setControlKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");

  useEffect(() => {
    setControlKey(window.localStorage.getItem(CONTROL_KEY_STORAGE) ?? "");
  }, []);

  const current = speakers.find((s) => s.id === state?.current_speaker_id) ?? null;
  const currentIndex = current ? speakers.findIndex((s) => s.id === current.id) : -1;

  async function run(action: AdminActionInput["action"]) {
    try {
      await adminAction({ data: { key: controlKey, action } });
      return true;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Something went wrong";
      toast.error(
        messageText.includes("Invalid control key")
          ? "That control key is not valid. Enter it again to make changes."
          : messageText,
      );
      return false;
    }
  }

  async function patchState(patch: Record<string, unknown>) {
    await run({ type: "patchState", patch: patch as never });
  }

  if (!controlKey) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-10">
        <Card className="p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Run of show</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your control key to manage speakers and the live timer. It is the same key you
            use for Bitfocus Companion, and it is stored on this device only.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = keyDraft.trim();
              if (!trimmed) {
                toast.error("Enter your control key");
                return;
              }
              window.localStorage.setItem(CONTROL_KEY_STORAGE, trimmed);
              setControlKey(trimmed);
              setKeyDraft("");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="control-key">Control key</Label>
              <Input
                id="control-key"
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="w-full">
              Unlock controls
            </Button>
          </form>
        </Card>
      </main>
    );
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
      await patchState({ current_speaker_id: null, status: "stopped", elapsed_seconds: 0, started_at: null });
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Run of show</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control the stage timer and send messages to your speakers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/companion">Companion setup</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/stage" target="_blank" rel="noreferrer">
              Open stage view
            </a>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">{editingId ? "Edit speaker" : "Add speaker"}</h2>
            <form onSubmit={submitSpeaker} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor="speaker-name">Speaker name</Label>
                <Input
                  id="speaker-name"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="w-32 space-y-1.5">
                <Label htmlFor="speaker-duration">Minutes</Label>
                <Input
                  id="speaker-duration"
                  type="number"
                  min={1}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <Button type="submit">{editingId ? "Save changes" : "Add speaker"}</Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setName("");
                    setDuration("20");
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold">Speaker list</h2>
            {speakers.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No speakers yet. Add the first one above.
              </p>
            ) : (
              <ul className="mt-4 divide-y">
                {speakers.map((speaker, index) => (
                  <li key={speaker.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-6 text-sm text-muted-foreground">{index + 1}</span>
                    <div className="min-w-40 flex-1">
                      <p className="font-medium">
                        {speaker.name.trim() === "" ? (
                          <span className="italic text-muted-foreground">Unnamed</span>
                        ) : (
                          speaker.name
                        )}
                        {speaker.id === state?.current_speaker_id ? (
                          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                            On stage
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted-foreground">{speaker.duration_minutes} min</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Move ${displayName(speaker.name)} up`}
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Move ${displayName(speaker.name)} down`}
                        onClick={() => move(index, 1)}
                        disabled={index === speakers.length - 1}
                      >
                        ↓
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => selectSpeaker(speaker)}>
                        Set live
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(speaker)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(speaker)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Timer controls</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {current ? (
                <>
                  On stage:{" "}
                  {current.name.trim() === "" ? <em className="italic">Unnamed</em> : current.name}
                </>
              ) : (
                "No speaker on stage yet"
              )}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={start} disabled={state?.status === "running"}>
                Start
              </Button>
              <Button variant="secondary" onClick={pause} disabled={state?.status !== "running"}>
                Pause
              </Button>
              <Button variant="outline" onClick={reset}>
                Reset
              </Button>
              <Button variant="outline" onClick={next}>
                Next speaker
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" onClick={() => adjustTime(-5)} disabled={!current}>
                −5 min
              </Button>
              <Button variant="outline" size="sm" onClick={() => adjustTime(-1)} disabled={!current}>
                −1 min
              </Button>
              <Button variant="outline" size="sm" onClick={() => adjustTime(1)} disabled={!current}>
                +1 min
              </Button>
              <Button variant="outline" size="sm" onClick={() => adjustTime(5)} disabled={!current}>
                +5 min
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold">Message to stage</h2>
            {state?.message ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-400 bg-amber-50 px-4 py-2.5 text-amber-800">
                <span className="text-sm font-semibold">⚠ Live on stage:</span>
                <span className="text-sm italic">"{state.message}"</span>
              </div>
            ) : null}
            <form onSubmit={sendMessage} className="mt-4 flex gap-2">
              <Input
                value={message}
                maxLength={200}
                onChange={(e) => setMessage(e.target.value)}
                aria-label="Message to stage"
              />
              <Button type="submit">Send</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => patchState({ message: "", message_sent_at: null })}
                disabled={!state?.message}
              >
                Clear message
              </Button>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b px-5 py-3">
              <h2 className="text-sm font-semibold">Live stage preview</h2>
            </div>
            <div className="h-56">
              <StageScreen speaker={current} state={state} now={now} compact />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
