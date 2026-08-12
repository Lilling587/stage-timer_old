import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STATE_ID = "main";

const statusSchema = z.enum(["running", "paused", "stopped"]);

const statePatchSchema = z
  .object({
    current_speaker_id: z.string().uuid().nullable().optional(),
    status: statusSchema.optional(),
    elapsed_seconds: z.number().int().min(0).max(360000).optional(),
    started_at: z.string().datetime().nullable().optional(),
    message: z.string().max(200).nullable().optional(),
    message_sent_at: z.string().datetime().nullable().optional(),
    show_clock: z.boolean().optional(),
    blackout: z.boolean().optional(),
  })
  .strict();

const inputSchema = z.object({
  action: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("addSpeaker"),
      name: z.string().trim().max(80),
      duration_minutes: z.number().int().min(1).max(600),
      position: z.number().int().min(0).max(10000),
    }),
    z.object({
      type: z.literal("updateSpeaker"),
      id: z.string().uuid(),
      name: z.string().trim().max(80).optional(),
      duration_minutes: z.number().int().min(1).max(600).optional(),
      position: z.number().int().min(0).max(10000).optional(),
    }),
    z.object({ type: z.literal("deleteSpeaker"), id: z.string().uuid() }),
    z.object({
      type: z.literal("patchState"),
      patch: statePatchSchema,
      expected_revision: z.number().int().min(0).optional(),
    }),
  ]),
});

export type AdminActionInput = z.infer<typeof inputSchema>;

/**
 * Every write to the speaker list and timer state runs here. The tables are
 * read-only for anonymous visitors, so the browser can never mutate the show
 * without the shared control key.
 */
export const adminAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const action = data.action;

    if (action.type === "addSpeaker") {
      const { error } = await supabaseAdmin.from("speakers").insert({
        name: action.name,
        duration_minutes: action.duration_minutes,
        position: action.position,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (action.type === "updateSpeaker") {
      const patch: Record<string, unknown> = {};
      if (action.name !== undefined) patch["name"] = action.name;
      if (action.duration_minutes !== undefined)
        patch["duration_minutes"] = action.duration_minutes;
      if (action.position !== undefined) patch["position"] = action.position;
      const { error } = await supabaseAdmin.from("speakers").update(patch as never).eq("id", action.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (action.type === "deleteSpeaker") {
      const { error } = await supabaseAdmin.from("speakers").delete().eq("id", action.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Optimistic concurrency: only apply the patch if the state has not moved
    // on since this admin last saw it. A database trigger bumps `revision` on
    // every write, including ones made from Bitfocus Companion.
    let query = supabaseAdmin
      .from("timer_state")
      .update({ ...action.patch } as never)
      .eq("id", STATE_ID);
    if (action.expected_revision !== undefined) {
      query = query.eq("revision", action.expected_revision);
    }
    const { data: updated, error } = await query.select("revision");
    if (error) throw new Error(error.message);

    if (!updated || updated.length === 0) {
      const { data: latest } = await supabaseAdmin
        .from("timer_state")
        .select("*")
        .eq("id", STATE_ID)
        .maybeSingle();
      return { ok: false as const, conflict: true as const, latest };
    }

    return { ok: true as const, conflict: false as const, revision: updated[0]?.revision ?? null };
  });
