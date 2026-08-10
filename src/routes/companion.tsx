import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMPANION_ACTIONS } from "@/lib/companion-actions";

export const Route = createFileRoute("/companion")({
  head: () => ({
    meta: [
      { title: "Bitfocus Companion setup — Conference speaker timer" },
      {
        name: "description",
        content:
          "Copy-paste HTTP endpoints to control the stage timer from Bitfocus Companion, even when the app window is not focused.",
      },
      { property: "og:title", content: "Bitfocus Companion setup — Conference speaker timer" },
      {
        property: "og:description",
        content: "Control start, pause, speakers, talk length and stage messages from Companion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanionPage,
});

function CompanionPage() {
  const [origin, setOrigin] = useState("");
  const [key, setKey] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function urlFor(action: string, params?: string) {
    const query = new URLSearchParams(params);
    query.set("key", key || "YOUR_CONTROL_KEY");
    return `${origin || "https://your-app.lovable.app"}/api/public/companion/${action}?${query.toString()}`;
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("URL copied");
    } catch {
      toast.error("Copy failed — select the URL and copy manually");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Bitfocus Companion setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            These URLs control the show over HTTP, so they work from any machine and whether or not
            the app window is focused, minimised, or even closed.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin">Back to control room</Link>
        </Button>
      </header>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">How to set it up</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>In Companion, add a connection using the Generic HTTP module.</li>
          <li>Create a button and add the action HTTP GET.</li>
          <li>Paste one of the URLs below into the URL field. That is the whole setup.</li>
          <li>
            Optional: use the status URL with the Generic HTTP variables so buttons can show the
            live countdown.
          </li>
        </ol>
        <div className="mt-4 max-w-sm space-y-1.5">
          <Label htmlFor="control-key">Control key</Label>
          <Input
            id="control-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your control key to fill the URLs"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Typed here only to build the URLs below — it is never saved in the browser.
          </p>
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        {COMPANION_ACTIONS.map((item) => {
          const url = urlFor(item.action, item.params);
          const { preset } = item;
          const presetText = [
            `Button text: ${preset.buttonText}`,
            `Background: ${preset.bgColor}`,
            `Text colour: ${preset.textColor}`,
            `Action: ${preset.companionAction}`,
            `URL: ${url}`,
          ].join("\n");
          return (
            <Card key={item.action} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-56 flex-1">
                  <h3 className="font-medium">{item.label}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(url)}>
                    Copy URL
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copy(presetText)}>
                    Copy preset
                  </Button>
                </div>
              </div>
              <code className="mt-3 block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
                {url}
              </code>

              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md border border-dashed p-3">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md text-center text-[10px] leading-tight font-semibold whitespace-pre-line"
                  style={{ backgroundColor: preset.bgColor, color: preset.textColor }}
                  aria-label={`Button preview: ${preset.buttonText.replace(/\\n/g, " ")}`}
                >
                  {preset.buttonText.replace(/\\n/g, "\n")}
                </div>
                <dl className="grid flex-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="inline text-muted-foreground">Button text: </dt>
                    <dd className="inline font-mono">{preset.buttonText}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Companion action: </dt>
                    <dd className="inline">{preset.companionAction}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Background: </dt>
                    <dd className="inline font-mono">{preset.bgColor}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Text colour: </dt>
                    <dd className="inline font-mono">{preset.textColor}</dd>
                  </div>
                  {preset.notes ? (
                    <div className="sm:col-span-2 text-muted-foreground">{preset.notes}</div>
                  ) : null}
                </dl>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Every request must include the control key, either as the <code>key</code> query parameter
        shown above or as an <code>x-control-key</code> header. POST works the same as GET.
      </p>
    </main>
  );
}