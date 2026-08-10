import { createFileRoute } from "@tanstack/react-router";
import { StageScreen } from "@/components/StageScreen";
import { useNow, useShow } from "@/lib/show";

export const Route = createFileRoute("/stage")({
  head: () => ({
    meta: [
      { title: "Stage timer — Conference speaker timer" },
      {
        name: "description",
        content:
          "Full-screen countdown for the stage: current speaker, time remaining, and live messages from the crew.",
      },
      { property: "og:title", content: "Stage timer — Conference speaker timer" },
      {
        property: "og:description",
        content: "Full-screen countdown display for conference stages and projectors.",
      },
    ],
  }),
  component: StagePage,
});

function StagePage() {
  const { speakers, state } = useShow();
  const now = useNow(true);
  const speaker = speakers.find((s) => s.id === state?.current_speaker_id) ?? null;

  return (
    <main className="h-screen w-screen bg-stage-bg">
      <h1 className="sr-only">Stage timer</h1>
      <StageScreen speaker={speaker} state={state} now={now} />
    </main>
  );
}