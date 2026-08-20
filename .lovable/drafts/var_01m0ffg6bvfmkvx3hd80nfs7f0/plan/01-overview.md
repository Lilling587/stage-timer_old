# Timer speed control

Short answer: not hard. The clock is already computed from a start timestamp plus stored elapsed seconds, so a speed factor is just a multiplier applied to the time that has passed since the last start.

## What you get

- A speed control in the timer card on `/admin`: `1x`, `1.25x`, `1.5x`, `2x` (and `0.5x` for rehearsals).
- Every screen — stage, live preview, admin readout — counts at the chosen speed instantly.
- Changing speed mid-talk does not jump the clock: the seconds already counted are banked, and only the time from that point on runs faster.
- Colour thresholds, cue flashes and the "over time" behaviour keep working, they just arrive sooner.

## Trade-off to know about

The Bitfocus Companion `status` endpoint computes remaining time on the server and has no knowledge of the speed setting, so its `mmss` value would drift from the stage while the speed is not 1x. Two options:

1. Accept it — Companion is normally used at 1x, and the buttons (start/pause/next) still work correctly.
2. Keep speed a control-room-only feature and always reset to 1x before a real show.

Nothing else changes: speaker list, messages, blackout, quick messages and settings are untouched.
