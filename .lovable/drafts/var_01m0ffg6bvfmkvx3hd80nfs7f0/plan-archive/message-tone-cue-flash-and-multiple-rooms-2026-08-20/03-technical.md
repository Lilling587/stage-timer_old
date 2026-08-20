## Technical notes

**Database (must be applied from the main project — a draft cannot change the schema)**

- `shows` table: `id` (text slug, primary key), `name`, `created_at`. Seed row `main` / "Main hall". Public SELECT policy plus GRANTs matching the existing tables; writes stay server-side through the admin client.
- `speakers.show_id` text, default `'main'`, FK to `shows.id` on delete cascade, index on `(show_id, position)`.
- `timer_state.message_tone` text, default `'info'`, checked against `info | warn | stop`. `timer_state.id` is already a text key, so one row per show slug — no new column needed there; a row is created on demand when a room is added.

**Frontend**

- `src/lib/show.ts`: `useShow(showId)` filters speakers by `show_id` and reads `timer_state` by that id; `STATE_ID` stays as the default. New `useCueSettings` / `useCueControl` pair mirroring the existing thresholds pattern (localStorage + broadcast channel). `useQuickMessages` items become `{ text, tone }` with a one-time migration of stored plain strings.
- Routes: `src/routes/stage.$room.tsx` and `src/routes/admin.$room.tsx` render the same components as the existing `/stage` and `/admin`, so page bodies move into shared components and the current routes pass the default room. Each new route gets its own `head()` metadata.
- `StageScreen.tsx`: tone-driven classes on the message bar, plus a cue-flash overlay driven by remaining seconds crossing a mark (fires once per mark per talk, resets on speaker change or reset). Honours the compact preview mode.
- Colours come from tokens in `src/styles.css` — new tone tokens for info / warn / stop rather than hardcoded classes.
- `src/lib/admin-actions.ts` / `admin.functions.ts`: actions carry `show_id`; the state patch schema accepts `message_tone`.
- Companion `$action.ts`: optional `room` param resolving the show slug (default `main`), `tone` param on the message action, and `room` echoed in the status payload.

## Verification

Open two rooms side by side and confirm their timers and messages are independent; send each tone from a preset and from free text; watch the 5 / 2 / 0 marks flash on the stage and in the preview; check settings toggles change flash behaviour live; run the Companion start / message / status calls with and without `room=`.
