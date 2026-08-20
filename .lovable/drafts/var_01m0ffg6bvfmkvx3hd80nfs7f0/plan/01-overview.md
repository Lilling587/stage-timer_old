# Timer speed control

Short answer: not hard. The clock is already computed from a start timestamp plus stored elapsed seconds, so a speed factor is just a multiplier applied to the time that has passed since the last start.

## What you get

- A speed control in the timer card on `/admin`: `0.5x`, `1x`, `1.25x`, `1.5x`, `2x`.
- Under each button, a short line spells out what it means in real time, so nobody does maths mid-show:
  - `0.5x` — 1 min timer = 2 min real
  - `1x` — real time
  - `1.25x` — 1 min timer = 48 s real
  - `1.5x` — 1 min timer = 40 s real
  - `2x` — 1 min timer = 30 s real
- Every screen — stage, live preview, admin readout — counts at the chosen speed instantly.
- Changing speed mid-talk does not jump the clock: the seconds already counted are banked, and only the time from that point on runs faster.
- Colour thresholds, cue flashes and the "over time" behaviour keep working, they just arrive sooner.

## Trade-off to know about

The Bitfocus Companion `status` endpoint computes remaining time on the server and has no knowledge of the speed setting, so its `mmss` value would drift while speed is not 1x. So speed stays a control-room-only tool for rehearsals and run-throughs: it is not exposed to Companion, and it resets to 1x on every page load, so a real show always starts at normal speed. Companion buttons (start/pause/reset/next) keep working exactly as today.

Nothing else changes: speaker list, messages, blackout, quick messages and settings are untouched.
