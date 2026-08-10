export type CompanionAction = {
  action: string;
  label: string;
  description: string;
  params?: string;
  /** Ready-made Bitfocus Companion button preset for this control. */
  preset: CompanionPreset;
};

export type CompanionPreset = {
  /** Text to paste into the button's Text field. */
  buttonText: string;
  /** Background colour, as entered in Companion's colour picker. */
  bgColor: string;
  /** Foreground/text colour. */
  textColor: string;
  /** Companion action to add to the button. */
  companionAction: string;
  /** Extra setup worth knowing for this button. */
  notes?: string;
};

const GET = "Generic HTTP: GET";

export const COMPANION_ACTIONS: CompanionAction[] = [
  {
    action: "start",
    label: "Start",
    description: "Start the countdown for the current speaker.",
    preset: {
      buttonText: "START",
      bgColor: "#1B7F3B",
      textColor: "#FFFFFF",
      companionAction: GET,
      notes: "Put this on the top-left button of your page so it is easy to hit under pressure.",
    },
  },
  {
    action: "pause",
    label: "Pause",
    description: "Pause the countdown where it is.",
    preset: {
      buttonText: "PAUSE",
      bgColor: "#B58A00",
      textColor: "#000000",
      companionAction: GET,
    },
  },
  {
    action: "toggle",
    label: "Start / pause",
    description: "One button that starts or pauses.",
    preset: {
      buttonText: "START\\nPAUSE",
      bgColor: "#14532D",
      textColor: "#FFFFFF",
      companionAction: GET,
      notes: "Use this instead of separate start and pause buttons when you are short on space.",
    },
  },
  {
    action: "reset",
    label: "Reset",
    description: "Reset the clock to the full talk length.",
    preset: {
      buttonText: "RESET",
      bgColor: "#374151",
      textColor: "#FFFFFF",
      companionAction: GET,
      notes: "Set the button to Latch/Release off, and consider a 2-step press so it is not hit by mistake.",
    },
  },
  {
    action: "next",
    label: "Next speaker",
    description: "Move to the next speaker and reset.",
    preset: {
      buttonText: "NEXT ▶",
      bgColor: "#1D4ED8",
      textColor: "#FFFFFF",
      companionAction: GET,
    },
  },
  {
    action: "previous",
    label: "Previous speaker",
    description: "Move back one speaker and reset.",
    preset: {
      buttonText: "◀ PREV",
      bgColor: "#1E3A8A",
      textColor: "#FFFFFF",
      companionAction: GET,
    },
  },
  {
    action: "select",
    label: "Set live speaker",
    description: "Put a speaker on stage by their position in the list.",
    params: "position=2",
    preset: {
      buttonText: "SPEAKER\\n2",
      bgColor: "#312E81",
      textColor: "#FFFFFF",
      companionAction: GET,
      notes: "Duplicate this button per speaker and change position=1, 2, 3 … in each URL.",
    },
  },
  {
    action: "set-duration",
    label: "Set talk length",
    description:
      "Set the talk length in minutes. Without position, it changes the speaker on stage.",
    params: "minutes=15&position=2",
    preset: {
      buttonText: "SET 15\\nMIN",
      bgColor: "#0F766E",
      textColor: "#FFFFFF",
      companionAction: GET,
      notes: "Drop position from the URL to change the talk that is currently on stage.",
    },
  },
  {
    action: "adjust",
    label: "Add or remove time",
    description: "Shift the running clock, for example 1 or -2 minutes.",
    params: "minutes=1",
    preset: {
      buttonText: "+1 MIN",
      bgColor: "#0E7490",
      textColor: "#FFFFFF",
      companionAction: GET,
      notes: "Make a matching −1 button by changing the URL to minutes=-1.",
    },
  },
  {
    action: "set-remaining",
    label: "Set time remaining",
    description: "Jump the clock so this much time is left.",
    params: "minutes=5",
    preset: {
      buttonText: "5 MIN\\nLEFT",
      bgColor: "#7C2D12",
      textColor: "#FFFFFF",
      companionAction: GET,
    },
  },
  {
    action: "message",
    label: "Send message",
    description: "Show a message on the stage screen for 10 seconds.",
    params: "text=Please wrap up",
    preset: {
      buttonText: "WRAP UP",
      bgColor: "#B91C1C",
      textColor: "#FFFFFF",
      companionAction: GET,
      notes: "Copy the button for each standing message, e.g. text=5 minutes left or text=Time is up.",
    },
  },
  {
    action: "clear-message",
    label: "Clear message",
    description: "Remove the stage message now.",
    preset: {
      buttonText: "CLEAR\\nMSG",
      bgColor: "#4B5563",
      textColor: "#FFFFFF",
      companionAction: GET,
    },
  },
  {
    action: "status",
    label: "Status (feedback)",
    description: "Returns speaker, remaining time and run state as JSON for Companion variables.",
    preset: {
      buttonText: "$(timer:speaker)\\n$(timer:mmss)",
      bgColor: "#000000",
      textColor: "#FFFFFF",
      companionAction: "Generic HTTP: GET with variables (poll every 1000 ms)",
      notes:
        "Name the Generic HTTP connection 'timer' and point its polling URL here, so $(timer:mmss), $(timer:speaker) and $(timer:status) stay live on the button.",
    },
  },
];