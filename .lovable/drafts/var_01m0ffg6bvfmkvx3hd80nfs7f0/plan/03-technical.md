## Technical notes

- `src/lib/show.ts`: give `elapsedFor(state, now, rate = 1)` a rate argument applied only to the live segment: `base + (now - started_at)/1000 * rate`. Add `useSpeedControl` (control room) and `useStageSpeed` (stage) mirroring the existing `useThresholdControl` / `useStageThresholds` broadcast + localStorage pattern, on a new `stage-speed` channel with a `request` handshake so a reloading stage catches up. Allowed values are clamped to a small set (0.5, 1, 1.25, 1.5, 2).
- `src/routes/admin.tsx`: a segmented speed row in the timer card. On change, if the timer is running, first `patchState({ elapsed_seconds: Math.round(elapsedFor(state, Date.now(), oldRate)), started_at: new Date().toISOString() })` so already-counted time is banked at the old rate, then broadcast the new rate. Pause/Reset/Next keep their current behaviour; Pause banks with the current rate.
- `src/components/StageScreen.tsx` and the admin readout pass the rate into `elapsedFor`. Cue flash and thresholds need no change — they read the resulting remaining seconds.
- No database change: the rate lives in the realtime broadcast plus localStorage, so it works inside the draft. `src/routes/api/public/companion/$action.ts` stays as is (server-side 1x).

## Verification

On `/admin`, set a short talk, start it, switch to 1.5x and confirm the stage and preview speed up without jumping, then back to 1x, and check pause/reset/next still behave.
