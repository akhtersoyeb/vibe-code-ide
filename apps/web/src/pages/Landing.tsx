import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

const PROMPT = "Build a pricing page for a coffee subscription";
const FILES = ["Navbar.jsx", "Hero.jsx", "PricingCard.jsx"];

type Stage = "typing" | "building" | "preview" | "hold";

/**
 * A small, looping dramatization of the product's actual mechanic — a
 * prompt typing out, files appearing, a preview building itself — rather
 * than an abstract hero graphic. One orchestrated sequence, not scattered
 * per-element animation.
 */
function LiveBuildDemo() {
  const [loopKey, setLoopKey] = useState(0);
  const [typed, setTyped] = useState("");
  const [stage, setStage] = useState<Stage>("typing");
  const [fileCount, setFileCount] = useState(0);
  const [revealCount, setRevealCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    setTyped("");
    setFileCount(0);
    setRevealCount(0);
    setStage("typing");

    let charIndex = 0;
    function typeNext() {
      if (cancelled) return;
      setTyped(PROMPT.slice(0, charIndex));
      if (charIndex < PROMPT.length) {
        charIndex++;
        timers.push(setTimeout(typeNext, 28));
      } else {
        timers.push(setTimeout(startBuilding, 500));
      }
    }

    function startBuilding() {
      if (cancelled) return;
      setStage("building");
      let n = 0;
      const id = setInterval(() => {
        n++;
        setFileCount(n);
        if (n >= FILES.length) {
          clearInterval(id);
          timers.push(setTimeout(startPreview, 300));
        }
      }, 260);
      intervals.push(id);
    }

    function startPreview() {
      if (cancelled) return;
      setStage("preview");
      let n = 0;
      const id = setInterval(() => {
        n++;
        setRevealCount(n);
        if (n >= 3) {
          clearInterval(id);
          timers.push(
            setTimeout(() => {
              setStage("hold");
              timers.push(
                setTimeout(() => !cancelled && setLoopKey((k) => k + 1), 2200),
              );
            }, 300),
          );
        }
      }, 320);
      intervals.push(id);
    }

    timers.push(setTimeout(typeNext, 400));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [loopKey]);

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
      </div>

      <div className="border-b border-line px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber/20 text-center font-mono text-[11px] leading-5 text-amber">
            &gt;
          </span>
          <p className="font-mono text-[13px] leading-5 text-paper">
            {typed}
            <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-amber" />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[88px_1fr]">
        <div className="space-y-1.5 border-r border-line bg-surface-2 px-3 py-3">
          {FILES.map((file, i) => (
            <div
              key={file}
              className={`truncate font-mono text-[10px] transition-all duration-300 ${
                i < fileCount
                  ? "translate-x-0 text-paper-muted opacity-100"
                  : "-translate-x-1 opacity-0"
              }`}
            >
              {file}
            </div>
          ))}
        </div>

        <div className="space-y-2 p-3">
          <div
            className={`h-3 w-2/3 rounded bg-paper-muted/40 transition-opacity duration-300 ${
              revealCount >= 1 ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`h-10 rounded-lg bg-gradient-to-br from-amber/20 to-transparent transition-opacity delay-150 duration-300 ${
              revealCount >= 2 ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`h-6 w-20 rounded-full bg-amber transition-all delay-300 duration-300 ${
              revealCount >= 3 ? "scale-100 opacity-100" : "scale-90 opacity-0"
            }`}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[11px] text-paper-muted">
        <span
          className={`h-1.5 w-1.5 rounded-full ${stage === "hold" ? "bg-mint" : "bg-amber"}`}
        />
        {stage === "typing" && "Describing the app…"}
        {stage === "building" && "Writing files…"}
        {stage === "preview" && "Rendering preview…"}
        {stage === "hold" && "Live in your browser"}
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Describe it",
    body: "Tell Tachi what you want to build, in plain English. A landing page, a dashboard, a form — whatever you need.",
  },
  {
    n: "2",
    title: "Watch it build",
    body: "Tachi writes real React files and runs them live, right in the browser, while you watch the preview update.",
  },
  {
    n: "3",
    title: "Keep refining",
    body: "Ask for changes the same way you started. Tachi edits the code and the preview updates again, in place.",
  },
];

export function Landing() {
  return (
    <div className="bg-ink">
      {/* Hero */}
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-16 px-6 pb-24 pt-20 lg:flex-row lg:pt-28">
        <div className="max-w-xl text-center lg:text-left">
          <h1 className="font-display text-[44px] font-semibold leading-[1.08] tracking-tight text-paper sm:text-[56px]">
            Describe the app.
            <br />
            Watch it get built.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-paper-muted lg:mx-0">
            Tachi writes real React code from a plain-language prompt, runs it
            live in your browser, and keeps building as you chat — no setup, no
            blank file.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <SignedOut>
              <Link
                to="/sign-up"
                className="rounded-full bg-amber px-6 py-3 text-[15px] font-medium text-ink transition hover:bg-amber-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Start building
              </Link>
              <Link
                to="/sign-in"
                className="text-[15px] text-paper-muted transition hover:text-paper"
              >
                Sign in
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                to="/dashboard"
                className="rounded-full bg-amber px-6 py-3 text-[15px] font-medium text-ink transition hover:bg-amber-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Go to your projects
              </Link>
            </SignedIn>
          </div>
        </div>

        <div className="flex w-full justify-center lg:w-auto">
          <LiveBuildDemo />
        </div>
      </section>

      {/* How it works — a genuine sequence, so numbering earns its place */}
      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-2xl font-semibold text-paper sm:text-3xl">
            How it works
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n}>
                <span className="font-mono text-sm text-amber">{step.n}</span>
                <h3 className="mt-3 font-display text-lg font-semibold text-paper">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-paper-muted">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature rows — alternating, not identical cards */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl font-semibold text-paper">
              Every change is saved, nothing is ever lost
            </h3>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-paper-muted">
              Every edit — yours or the AI's — becomes a snapshot you can step
              back to. Try something bold, and revert in one click if it doesn't
              work out.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="space-y-2">
              {[
                { label: "Initial template", current: false },
                { label: "You renamed the hero", current: false },
                { label: "AI added pricing cards", current: true },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px]"
                >
                  <span className="text-paper-muted">{row.label}</span>
                  {row.current && (
                    <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] text-mint">
                      current
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-20 grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 rounded-2xl border border-line bg-surface p-5 lg:order-1">
            <div className="flex items-center gap-2 font-mono text-[12px] text-paper-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              TypeError: doSomething is not a function
            </div>
            <div className="mt-3 flex items-center gap-2 text-[13px] text-mint">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              Fixed automatically
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h3 className="font-display text-2xl font-semibold text-paper">
              When something breaks, Tachi fixes it
            </h3>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-paper-muted">
              Runtime errors and broken builds are caught automatically. One
              click sends them back to the AI to diagnose and fix.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA — the one place this page spends its boldness */}
      <section className="bg-amber">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
            Start building your next idea
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-ink/70">
            No setup. No blank file. Just describe what you want.
          </p>
          <SignedOut>
            <Link
              to="/sign-up"
              className="mt-8 inline-block rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-paper transition hover:bg-surface"
            >
              Start building — it's free
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              to="/dashboard"
              className="mt-8 inline-block rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-paper transition hover:bg-surface"
            >
              Go to your projects
            </Link>
          </SignedIn>
        </div>
      </section>

      <footer className="border-t border-line bg-ink">
        <div className="mx-auto max-w-6xl px-6 py-10 text-[13px] text-paper-muted">
          Tachi
        </div>
      </footer>
    </div>
  );
}
