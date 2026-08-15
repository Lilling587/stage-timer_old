import { z } from "zod";

const statusSchema = z.enum(["running", "paused", "stopped"]);

const statePatchSchema = z
  .object({
    current_speaker_id: z.string().uuid().nullable().optional(),
    status: statusSchema.optional(),
    elapsed_seconds: z.number().int().min(0).max(360000).optional(),
    started_at: z.string().datetime().nullable().optional(),
    message: z.string().max(200).nullable().optional(),
    message_sent_at: z.string().datetime().nullable().optional(),
    display_mode: z.enum(["remaining", "elapsed"]).optional(),
    show_clock: z.boolean().optional(),
    blackout: z.boolean().optional(),
  })
  .strict();

export const adminActionInputSchema = z.object({
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

export type AdminActionInput = z.infer<typeof adminActionInputSchema>;
