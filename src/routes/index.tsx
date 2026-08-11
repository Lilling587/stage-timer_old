import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Speaker timer — live stage countdown" },
      {
        name: "description",
        content:
          "Run your conference on time: manage speakers from the control room and show a live countdown on the stage screen.",
      },
      { property: "og:title", content: "Speaker Timer — live stage countdown" },
      {
        property: "og:description",
        content: "Control room and stage display that stay in sync in real time.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="max-w-xl">
        <h1 className="text-4xl font-semibold tracking-tight">Speaker Timer</h1>
        <p className="mt-3 text-muted-foreground">
          Open the control room on your computer and the stage view on the projector. Everything
          stays in sync in real time.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/admin">Open control room</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/stage">Open stage view</Link>
        </Button>
      </div>
    </main>
  );
}
