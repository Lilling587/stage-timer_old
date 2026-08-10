export type CompanionAction = {
  action: string;
  label: string;
  description: string;
  params?: string;
};

export const COMPANION_ACTIONS: CompanionAction[] = [
  { action: "start", label: "Start", description: "Start the countdown for the current speaker." },
  { action: "pause", label: "Pause", description: "Pause the countdown where it is." },
  { action: "toggle", label: "Start / pause", description: "One button that starts or pauses." },
  { action: "reset", label: "Reset", description: "Reset the clock to the full talk length." },
  { action: "next", label: "Next speaker", description: "Move to the next speaker and reset." },
  { action: "previous", label: "Previous speaker", description: "Move back one speaker and reset." },
  {
    action: "select",
    label: "Set live speaker",
    description: "Put a speaker on stage by their position in the list.",
    params: "position=2",
  },
  {
    action: "set-duration",
    label: "Set talk length",
    description:
      "Set the talk length in minutes. Without position, it changes the speaker on stage.",
    params: "minutes=15&position=2",
  },
  {
    action: "adjust",
    label: "Add or remove time",
    description: "Shift the running clock, for example 1 or -2 minutes.",
    params: "minutes=1",
  },
  {
    action: "set-remaining",
    label: "Set time remaining",
    description: "Jump the clock so this much time is left.",
    params: "minutes=5",
  },
  {
    action: "message",
    label: "Send message",
    description: "Show a message on the stage screen for 10 seconds.",
    params: "text=Please wrap up",
  },
  { action: "clear-message", label: "Clear message", description: "Remove the stage message now." },
  {
    action: "status",
    label: "Status (feedback)",
    description: "Returns speaker, remaining time and run state as JSON for Companion variables.",
  },
];