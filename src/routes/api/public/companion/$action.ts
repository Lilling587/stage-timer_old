import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const STATE_ID = "main";

type SpeakerRow = { id: string; name: string; duration_minutes: number; position: number };
type StateRow = {
  id: string;
  current_speaker_id: string | null;
  status: string;
  elapsed_seconds: number;
  started_at: string | null;
  message: string | null;
  message_sent_at: string | null;
};

const minutesSchema = z.coerce.number().finite().min(-600).max(600);
const positiveMinutesSchema = z.coerce.number().int().min(1).max(600);
const positionSchema = z.coerce.number().int().min(1).max(500);
const textSchema = z.string().trim().min(1).max(200);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-control-key",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    },
  });
}

function elapsedSeconds(state: StateRow, now: number) {
  const base = state.elapsed_seconds ?? 0;
  if (state.status === "running" && state.started_at) {
    return base + Math.max(0, (now - new Date(state.started_at).getTime()) / 1000);
  }
  return base;
}

function formatClock(totalSeconds: number) {
  const abs = Math.floor(Math.abs(totalSeconds));
  const mm = String(Math.floor(abs / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  return `${totalSeconds < 0 ? "-" : ""}${mm}:${ss}`;
}

function toneFor(remaining: number) {
  if (remaining <= 0) return "over";
  if (remaining < 120) return "danger";
  if (remaining < 300) return "warn";
  return "safe";
}

function keyMatches(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readParams(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  if (request.method === "POST") {
    const raw = await request.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const [key, value] of Object.entries(parsed)) {
          if (value !== null && value !== undefined) params[key] = String(value);
        }
      } catch {
        new URLSearchParams(raw).forEach((value, key) => {
          params[key] = value;
        });
      }
    }
  }
  return params;
}

async function handle(request: Request, action: string) {
  const controlKey = process.env["COMPANION_CONTROL_KEY"];
  if (!controlKey) {
    return json({ error: "Control key is not configured yet." }, 503);
  }

  const params = await readParams(request);
  const provided = request.headers.get("x-control-key") ?? params["key"] ?? "";
  if (!keyMatches(provided, controlKey)) {
    return json({ error: "Invalid control key" }, 401);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [speakersRes, stateRes] = await Promise.all([
    supabaseAdmin.from("speakers").select("*").order("position", { ascending: true }),
    supabaseAdmin.from("timer_state").select("*").eq("id", STATE_ID).maybeSingle(),
  ]);
  if (speakersRes.error) return json({ error: speakersRes.error.message }, 500);
  if (stateRes.error) return json({ error: stateRes.error.message }, 500);

  const speakers = (speakersRes.data ?? []) as SpeakerRow[];
  const state = (stateRes.data ?? {
    id: STATE_ID,
    current_speaker_id: null,
    status: "stopped",
    elapsed_seconds: 0,
    started_at: null,
    message: null,
    message_sent_at: null,
  }) as StateRow;

  const now = Date.now();
  const currentIndex = speakers.findIndex((s) => s.id === state.current_speaker_id);
  const current = currentIndex >= 0 ? speakers[currentIndex] : undefined;

  async function patch(values: Record<string, unknown>) {
    const { error } = await supabaseAdmin
      .from("timer_state")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", STATE_ID);
    return error?.message ?? null;
  }

  function statusPayload(overrides?: Partial<StateRow>, speakerOverride?: SpeakerRow) {
    const merged = { ...state, ...overrides } as StateRow;
    const speaker = speakerOverride ?? speakers.find((s) => s.id === merged.current_speaker_id);
    const total = (speaker?.duration_minutes ?? 0) * 60;
    const remaining = total - elapsedSeconds(merged, Date.now());
    return {
      ok: true,
      speaker: speaker?.name ?? null,
      speaker_position: speaker ? speakers.findIndex((s) => s.id === speaker.id) + 1 : null,
      duration_minutes: speaker?.duration_minutes ?? null,
      status: merged.status,
      remaining_seconds: Math.round(remaining),
      mmss: formatClock(remaining),
      tone: toneFor(remaining),
      message: merged.message,
      speakers: speakers.length,
    };
  }

  async function moveTo(speaker: SpeakerRow | undefined) {
    if (!speaker) return json({ error: "No speaker at that position" }, 400);
    const values = {
      current_speaker_id: speaker.id,
      status: "stopped",
      elapsed_seconds: 0,
      started_at: null,
    };
    const error = await patch(values);
    if (error) return json({ error }, 500);
    return json(statusPayload(values as Partial<StateRow>, speaker));
  }

  switch (action) {
    case "status":
      return json(statusPayload());

    case "start": {
      const speakerId = state.current_speaker_id ?? speakers[0]?.id ?? null;
      if (!speakerId) return json({ error: "No speakers yet" }, 400);
      if (state.status === "running") return json(statusPayload());
      const values = {
        current_speaker_id: speakerId,
        status: "running",
        started_at: new Date(now).toISOString(),
      };
      const error = await patch(values);
      if (error) return json({ error }, 500);
      return json(statusPayload(values as Partial<StateRow>));
    }

    case "pause": {
      if (state.status !== "running") return json(statusPayload());
      const values = {
        status: "paused",
        elapsed_seconds: Math.round(elapsedSeconds(state, now)),
        started_at: null,
      };
      const error = await patch(values);
      if (error) return json({ error }, 500);
      return json(statusPayload(values as Partial<StateRow>));
    }

    case "toggle":
      return handle(
        new Request(request.url, { method: "GET", headers: request.headers }),
        state.status === "running" ? "pause" : "start",
      );

    case "reset": {
      const values = { status: "stopped", elapsed_seconds: 0, started_at: null };
      const error = await patch(values);
      if (error) return json({ error }, 500);
      return json(statusPayload(values as Partial<StateRow>));
    }

    case "next":
      return moveTo(speakers[currentIndex + 1] ?? speakers[0]);

    case "previous":
      return moveTo(
        currentIndex > 0 ? speakers[currentIndex - 1] : speakers[speakers.length - 1],
      );

    case "select": {
      const parsed = positionSchema.safeParse(params["position"]);
      if (!parsed.success) return json({ error: "position must be 1 or higher" }, 400);
      return moveTo(speakers[parsed.data - 1]);
    }

    case "set-duration": {
      const parsedMinutes = positiveMinutesSchema.safeParse(params["minutes"]);
      if (!parsedMinutes.success) return json({ error: "minutes must be 1-600" }, 400);
      let target = current;
      if (params["position"] !== undefined) {
        const parsedPosition = positionSchema.safeParse(params["position"]);
        if (!parsedPosition.success) return json({ error: "position must be 1 or higher" }, 400);
        target = speakers[parsedPosition.data - 1];
      }
      if (!target) return json({ error: "No speaker to update" }, 400);
      const { error } = await supabaseAdmin
        .from("speakers")
        .update({ duration_minutes: parsedMinutes.data })
        .eq("id", target.id);
      if (error) return json({ error: error.message }, 500);
      const updated = { ...target, duration_minutes: parsedMinutes.data };
      return json(statusPayload(undefined, target.id === current?.id ? updated : undefined));
    }

    case "adjust": {
      const parsed = minutesSchema.safeParse(params["minutes"]);
      if (!parsed.success) return json({ error: "minutes must be between -600 and 600" }, 400);
      const delta = Math.round(parsed.data * 60);
      // Adding time means removing elapsed time.
      const nextElapsed = Math.max(0, Math.round(elapsedSeconds(state, now)) - delta);
      const values =
        state.status === "running"
          ? { elapsed_seconds: nextElapsed, started_at: new Date(now).toISOString() }
          : { elapsed_seconds: nextElapsed };
      const error = await patch(values);
      if (error) return json({ error }, 500);
      return json(statusPayload(values as Partial<StateRow>));
    }

    case "set-remaining": {
      const hasSeconds = params["seconds"] !== undefined;
      const parsed = hasSeconds
        ? z.coerce.number().int().min(0).max(36000).safeParse(params["seconds"])
        : z.coerce.number().min(0).max(600).safeParse(params["minutes"]);
      if (!parsed.success) return json({ error: "Provide minutes or seconds" }, 400);
      if (!current) return json({ error: "No speaker on stage" }, 400);
      const remaining = hasSeconds ? parsed.data : parsed.data * 60;
      const nextElapsed = Math.max(0, Math.round(current.duration_minutes * 60 - remaining));
      const values =
        state.status === "running"
          ? { elapsed_seconds: nextElapsed, started_at: new Date(now).toISOString() }
          : { elapsed_seconds: nextElapsed };
      const error = await patch(values);
      if (error) return json({ error }, 500);
      return json(statusPayload(values as Partial<StateRow>));
    }

    case "message": {
      const parsed = textSchema.safeParse(params["text"] ?? params["message"] ?? "");
      if (!parsed.success) return json({ error: "text is required (max 200 characters)" }, 400);
      const values = { message: parsed.data, message_sent_at: new Date().toISOString() };
      const error = await patch(values);
      if (error) return json({ error }, 500);
      return json(statusPayload(values as Partial<StateRow>));
    }

    case "clear-message": {
      const values = { message: null, message_sent_at: null };
      const error = await patch(values);
      if (error) return json({ error }, 500);
      return json(statusPayload(values as Partial<StateRow>));
    }

    default:
      return json({ error: `Unknown action "${action}"` }, 404);
  }
}

export const Route = createFileRoute("/api/public/companion/$action")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handle(request, params.action),
      POST: async ({ request, params }) => handle(request, params.action),
      OPTIONS: async () => json({ ok: true }),
    },
  },
});