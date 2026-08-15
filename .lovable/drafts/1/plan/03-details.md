## Technical notes

- **`src/styles.css`** — add Sora + Manrope via a `<link>` in `src/routes/__root.tsx` head (remote CSS cannot be `@import`ed here), register `--font-sora` / `--font-manrope` in `@theme`, and add a set of console tokens (surface levels, ember accent, tally colours) in `:root` as `oklch` values converted from the chosen palette. All new styling uses these tokens — no hardcoded hex or `text-white` in components.
- **`src/routes/admin.tsx`** — rewritten presentationally into the sidebar shell. All handlers (`run`, `patchState`, `submitSpeaker`, `move`, `remove`, `selectSpeaker`, `start`, `pause`, `reset`, `next`, `sendMessage`, `adjustTime`), the Zod schemas, the revision-based conflict handling and the `useAdminPresence` badge stay exactly as they are; only JSX and classes change. The message input becomes a textarea; Send and Clear keep their current behaviour and disabled rules. Row action buttons keep their existing `aria-label`s and the "Unnamed" italic fallback.
- **The page stays dark** regardless of theme, matching a control room — scoped to this route, not applied globally. `/stage`, `/companion` and `/` are untouched.
- Layout targets a laptop screen without scrolling; below `lg` the sidebar stacks above the main column so an iPad still works.

## Verification

Load `/admin` in the browser and check: speaker add/edit/reorder/delete, Set live, Start/Pause/Reset/Next, the four minute nudges, blackout, clock toggle, send and clear message, and that the live preview mirrors the stage.