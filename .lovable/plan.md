# Companion (Bitfocus) control for the speaker timer

Bitfocus Companion can't press buttons in your browser, and browser keyboard shortcuts only work while the window is focused. The reliable way is to give the app a small HTTP control API that Companion hits with its "Generic HTTP" module. That works from any machine on any network, whether or not the app window is highlighted, minimised, or even closed.

## What you get

A set of URLs Companion can call, one per action:

- Start
- Pause
- Reset
- Next speaker
- Previous speaker
- Toggle start/pause (single button)
- Set live speaker by position (1, 2, 3, …)
- Send a message to the stage
- Clear the message
- Read current status (speaker name, remaining time, running state) for Companion button feedback

Every call writes to the same database the app already uses, so `/admin` and `/stage` update instantly through the existing realtime sync — no refresh, no focused window.

## Security

The endpoints are public URLs, so each request must carry a shared control key. Companion sends it as a header (or `?key=` for simplicity). Requests without the right key get rejected. I'll generate the key and store it as a project secret.

## Companion setup page

A new `/companion` page in the admin area that lists every endpoint with the full copy-pasteable URL (already including your project domain), the method, and a short "how to set this up in Companion" walkthrough. Includes a copy button per action so you can paste straight into a Companion Generic HTTP action.

## Technical details

- New server routes under `src/routes/api/public/companion/*` (the `/api/public/*` prefix bypasses site auth), each verifying the control key before touching data.
- Handlers use the service-role client loaded inside the handler and update `public.timer_state` / read `public.speakers` with the exact same field semantics the admin UI uses (`status`, `started_at`, `elapsed_seconds`, `current_speaker_id`, `message`, `message_sent_at`), so pause math stays consistent.
- Requests accept both `GET` (easiest in Companion) and `POST`; input parsed with Zod.
- A `GET /api/public/companion/status` returns JSON (`speaker`, `remaining_seconds`, `mmss`, `status`, `tone`) for Companion variables/feedback.
- Shared control key stored as a secret; no other data exposed by the endpoints.
- `/companion` route gets its own `head()` metadata; no changes to timer logic in `src/lib/show.ts`.
