# Multi-room support

Short answer: moderate, not hard. The app is already built around a single named state row (`main`), so rooms are mostly a matter of threading a room id through the data layer, the routes and the Companion API. Roughly a medium-size change touching 6 files plus one database migration. No rewrite of the timer logic.

## What you get

- Each room has its own speaker list, timer, message, blackout and clock toggle. Nothing is shared between rooms.
- Rooms are addressed by URL: `/stage/main-hall`, `/admin/main-hall`. Each projector machine bookmarks its own.
- Plain `/stage` and `/admin` keep working and mean the default room, so your current setup is untouched.
- The command page header gets a room switcher, and settings gets a "Rooms" card to create, rename and remove rooms.
- Companion keeps working as-is against the default room; every endpoint also accepts an optional `room=` parameter, and the `/companion` page gets a room selector that rewrites the URLs it shows.

## Effort breakdown

- Database: one migration (a `rooms` table, `speakers.room_id`, one timer state row per room). Small.
- Data layer: `useShow` takes a room id and filters on it; realtime channel names become per-room. Small, contained.
- Routes: the current `/stage` and `/admin` page bodies move into shared components so `/stage/$room` and `/admin/$room` can reuse them. Mechanical but touches the biggest file.
- Companion: optional `room` parameter on each action. Small.
- Display settings (thresholds, cue flash, speed, quick messages) are stored per browser today. They would become per-room keys so a room's projector keeps its own colours.

## Technical notes

- `rooms` table: `id` (text slug, primary key), `name`, `created_at`, seeded with `main` / "Main hall". Public read policy plus GRANTs matching the existing tables; writes stay server-side through the admin client.
- `speakers.room_id` text, default `'main'`, FK to `rooms.id` on delete cascade, index on `(room_id, position)`.
- `timer_state.id` is already a text key, so one row per room slug — a row is created on demand when a room is added.
- `src/lib/show.ts`: `useShow(roomId)` filters speakers and reads state by that id; `STATE_ID` stays the default. Channel names get the room suffix so two rooms don't cross-talk. localStorage keys for thresholds/cue/speed/quick messages get the room suffix too.
- New routes `src/routes/stage.$room.tsx` and `src/routes/admin.$room.tsx` render shared components with their own `head()` metadata; existing routes pass the default room.
- `src/lib/admin-actions.ts` / `admin.functions.ts`: actions carry `room_id`.
- Companion `$action.ts`: optional `room` param defaulting to `main`, echoed back in the status payload.

## Verification

Open two rooms side by side and confirm their timers, messages and blackout are independent; add and delete a room; confirm plain `/stage` and `/admin` still drive the default room; run Companion start / message / status with and without `room=`.
