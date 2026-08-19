import { createServerFn } from "@tanstack/react-start";
import { adminActionInputSchema } from "@/lib/admin-actions";

/**
 * Every write to the speaker list and timer state runs here. The tables are
 * read-only for anonymous visitors, so the browser can never mutate the show
 * without the shared control key.
 */
export const adminAction = createServerFn({ method: "POST" })
  .validator((input: unknown) => adminActionInputSchema.parse(input))
  .handler(async ({ data }) => {
    const stateId = "main";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const action = data.action;

    if (action.type === "addSpeaker") {
            const { error } = await supabaseAdmin.from("speakers").insert({
        name: action.name,
        duration_minutes: action.duration_minutes,
        position: action.position,
        notes: action.notes ?? "",
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
      if (action.notes !== undefined) patch["notes"] = action.notes;
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
    if (Object.keys(action.patch).length === 0) {
      const { data: current } = await supabaseAdmin
        .from("timer_state")
        .select("revision")
        .eq("id", stateId)
        .maybeSingle();
      return {
        ok: true as const,
        conflict: false as const,
        revision: current?.revision ?? null,
      };
    }

    let query = supabaseAdmin
      .from("timer_state")
      .update({ ...action.patch } as never)
      .eq("id", stateId);
    if (action.expected_revision !== undefined) {
      query = query.eq("revision", action.expected_revision);
    }
    const { data: updated, error } = await query.select("revision");
    if (error) throw new Error(error.message);

    if (!updated || updated.length === 0) {
      const { data: latest } = await supabaseAdmin
        .from("timer_state")
        .select("*")
        .eq("id", stateId)
        .maybeSingle();
      return { ok: false as const, conflict: true as const, latest };
    }

    return { ok: true as const, conflict: false as const, revision: updated[0]?.revision ?? null };
  });
