# Stage timer

Build a conference speaker timer app with two separate views that sync in real time using Supabase.

Admin view (/admin):

	•	A form to add speakers to a list: speaker name (text) + talk duration (minutes)

	•	The speaker list shows all added speakers in order, with options to reorder (up/down buttons), edit, and delete

	•	Buttons to control the active speaker: Start, Pause, Reset, and Next Speaker

	•	A message field with a Send button — the message appears as an overlay on the stage view

	•	A small live preview showing what the stage screen currently displays

Stage view (/stage):

	•	Designed for a large external screen or projector — dark background

	•	Displays the current speaker’s name in large text at the top

	•	A large countdown timer in the center (MM:SS format)

	•	Color changes based on time remaining: green when more than 5 minutes left, yellow between 5 and 2 minutes, red under 2 minutes, and flashing red when time is up

	•	A message overlay at the bottom of the screen that appears when the admin sends a message, and fades out after 10 seconds

Data/sync:

	•	Use Supabase for real-time sync between admin and stage views

	•	Store the speaker list, current speaker index, timer state (running/paused/stopped), elapsed time, and any active message

	•	The stage view should update instantly when the admin makes changes — no page refresh needed

Design:

	•	Admin view: clean, functional, light theme

	•	Stage view: minimal, high contrast, dark theme — optimized for readability from a distance

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb78670e-d485-4c2f-90a0-43544ce96525).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
