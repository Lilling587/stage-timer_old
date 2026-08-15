export type CompanionAction = {
  action: string;
  label: string;
  description: string;
  params?: string;
  /** Ready-made Bitfocus Companion button preset for this control. */
  preset: CompanionPreset;
  /** Feedbacks that recolour the button from the live status endpoint. */
  feedbacks?: CompanionFeedback[];
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

/**
 * A Companion "Internal: Variable value" feedback, driven by the variables the
 * Generic HTTP connection polls from the status endpoint.
 */
export type CompanionFeedback = {
  /** Short name shown in the panel, e.g. "Running". */
  label: string;
  /** Companion variable to test, e.g. "$(timer:status)". */
  variable: string;
  /** Comparison operator as listed in Companion. */
  comparison: "Equal" | "Not equal";
  /** Value to compare against. */
  value: string;
  /** Style applied while the feedback is true. */
  bgColor: string;
  textColor: string;
  /** Plain-language explanation of what the operator sees. */
  description: string;
};

const GET = "Generic HTTP: GET";

const RUNNING = (bgColor: string, textColor: string, description: string): CompanionFeedback => ({
  label: "Timer running",
  variable: "$(timer:status)",
  comparison: "Equal",
  value: "running",
  bgColor,
  textColor,
  description,
});

const NOT_RUNNING = (
  bgColor: string,
  textColor: string,
  description: string,
): CompanionFeedback => ({
  label: "Timer not running",
  variable: "$(timer:status)",
  comparison: "Not equal",
  value: "running",
  bgColor,
  textColor,
  description,
});

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
    feedbacks: [
      RUNNING("#22C55E", "#000000", "Bright green while the clock is running, so you can see the show is live."),
      NOT_RUNNING("#14532D", "#FFFFFF", "Dimmed dark green while paused or stopped — the button is ready to press."),
    ],
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
    feedbacks: [
      RUNNING("#FACC15", "#000000", "Bright amber while running, because pausing is the useful next press."),
      {
        label: "Already paused",
        variable: "$(timer:status)",
        comparison: "Equal",
        value: "paused",
        bgColor: "#78350F",
        textColor: "#FFFFFF",
        description: "Dark amber once paused, so you can tell the pause landed.",
      },
    ],
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
    feedbacks: [
      RUNNING("#FACC15", "#000000", "Amber while running — the next press pauses."),
      NOT_RUNNING("#22C55E", "#000000", "Green while paused or stopped — the next press starts."),
    ],
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
    feedbacks: [
      {
        label: "Clock already at full length",
        variable: "$(timer:status)",
        comparison: "Equal",
        value: "stopped",
        bgColor: "#1F2937",
        textColor: "#9CA3AF",
        description: "Greyed out when the timer is stopped and there is nothing to reset.",
      },
      RUNNING("#DC2626", "#FFFFFF", "Turns red while the clock runs, as a reminder that a reset is destructive mid-talk."),
    ],
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
    feedbacks: [
      {
        label: "Talk finished",
        variable: "$(timer:tone)",
        comparison: "Equal",
        value: "over",
        bgColor: "#3B82F6",
        textColor: "#000000",
        description: "Lights up once the talk has run over, cueing you to move on.",
      },
      RUNNING("#1E3A8A", "#FFFFFF", "Dimmed while a talk is still running."),
    ],
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
    feedbacks: [
      {
        label: "First speaker on stage",
        variable: "$(timer:speaker_position)",
        comparison: "Equal",
        value: "1",
        bgColor: "#1F2937",
        textColor: "#9CA3AF",
        description: "Greyed out on the first speaker, where there is nothing to go back to.",
      },
    ],
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
    action: "blackout",
    label: "Blackout stage",
    description: "Toggle the stage to full black — use when you need to make changes without the audience seeing.",
    preset: {
      buttonText: "BLACK\nOUT",
      bgColor: "#1F2937",
      textColor: "#9CA3AF",
      companionAction: GET,
      notes: "The feedback turns it bright red while active — impossible to miss.",
    },
    feedbacks: [
      {
        label: "Blackout active",
        variable: "$(timer:blackout)",
        comparison: "Equal" as const,
        value: "true",
        bgColor: "#DC2626",
        textColor: "#FFFFFF",
        description: "Bright red while stage is blacked out.",
      },
      {
        label: "Blackout off",
        variable: "$(timer:blackout)",
        comparison: "Equal" as const,
        value: "false",
        bgColor: "#1F2937",
        textColor: "#9CA3AF",
        description: "Dark grey when stage is live and ready.",
      },
    ],
  },
  {
    action: "clock",
    label: "Clock mode",
    description: "Toggle the stage between the countdown timer and the current wall clock time.",
    preset: {
      buttonText: "CLOCK\nMODE",
      bgColor: "#1E3A8A",
      textColor: "#FFFFFF",
      companionAction: GET,
    },
    feedbacks: [
      {
        label: "Clock mode active",
        variable: "$(timer:show_clock)",
        comparison: "Equal" as const,
        value: "true",
        bgColor: "#3B82F6",
        textColor: "#000000",
        description: "Bright blue while showing wall clock time.",
      },
      {
        label: "Timer mode active",
        variable: "$(timer:show_clock)",
        comparison: "Equal" as const,
        value: "false",
        bgColor: "#1E3A8A",
        textColor: "#FFFFFF",
        description: "Dark blue while showing the countdown.",
      },
    ],
  },
  {
    action: "toggle-display",
    label: "Remaining / elapsed",
    description: "Switch the stage timer between time remaining and time elapsed.",
    preset: {
      buttonText: "REMAIN\nELAPSED",
      bgColor: "#374151",
      textColor: "#FFFFFF",
      companionAction: GET,
    },
    feedbacks: [
      {
        label: "Showing elapsed",
        variable: "$(timer:display_mode)",
        comparison: "Equal" as const,
        value: "elapsed",
        bgColor: "#F59E0B",
        textColor: "#000000",
        description: "Amber when showing elapsed time, dark when showing remaining.",
      },
    ],
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
