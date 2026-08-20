# Message tone, cue flash and multiple rooms

Three additions to the timer, in the order they will be built.

## 1. Message presets with tone

Every stage message gets a tone: **info**, **warning** or **stop**.

- Quick messages in settings gain a tone selector, so each preset carries its own default tone. One click still sends it.
- Next to the free-text box on the command page there is a three-way tone selector, so a typed message can be sent as any tone.
- On stage the message bar is coloured by tone: info reads calm and neutral, warning amber, stop red and slightly heavier. Text stays large and high contrast; the tone changes the bar and edge, not the readability.
- The tone travels with the message through the same realtime sync, so /stage and the admin preview always agree.

## 2. Cue flash

Short full-screen pulses at the marks that matter, so a speaker who is not looking straight at the timer still catches it.

- Defaults: a pulse at 5 minutes left, 2 minutes left, and at 00:00.
- Settings gets a "Cue flash" card: a toggle per mark, an intensity choice (subtle / normal / strong), and a master off switch. Same style as the existing threshold card, and settings sync to the stage the same way the colour thresholds already do.
- A pulse is two brief flashes in the threshold colour of that mark, then straight back to normal. It never covers the countdown and never repeats while paused or stopped.
- The admin stage preview shows the pulse too, plus a "Test flash" button in settings so it can be checked before doors open.

## 3. Multiple shows / rooms

One deployment can drive several stages at once. Each room has its own speaker list, timer, message and blackout — nothing is shared.

- Rooms are addressed by URL: `/stage/main-hall`, `/admin/main-hall`. That is what each projector machine bookmarks.
- The plain `/stage` and `/admin` keep working and mean the default room, so nothing you have set up today breaks.
- The command page header gets a room switcher plus a "Rooms" section in settings to create, rename and remove rooms.
- Companion keeps working against the default room, and every endpoint accepts an optional `room=` parameter to target another one. The /companion page gains a room selector that rewrites the URLs it shows.
