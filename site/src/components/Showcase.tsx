import { WifiOff, Gauge, Sprout } from "lucide-react";
import Reveal from "./Reveal";

const CARDS = [
  {
    icon: WifiOff,
    wash: "from-grad-1/70",
    title: "Works offline, in the field",
    body: "The model is small enough to run on-device. No signal at the back forty? It still diagnoses — nothing leaves the phone.",
  },
  {
    icon: Gauge,
    wash: "from-grad-3/70",
    title: "Severity, not just a label",
    body: "A name alone doesn't tell you how worried to be. CropIntel rates how far the infection has progressed so you can triage.",
    accent: true,
  },
  {
    icon: Sprout,
    wash: "from-grad-2/70",
    title: "A recommended next step",
    body: "Every diagnosis comes with a concrete action — what to apply, what to remove, and how fast to move.",
  },
];

export default function Showcase() {
  return (
    <section className="relative px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <span className="eyebrow mb-5">Why CropIntel</span>
          <h2 className="max-w-2xl font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-tight tracking-[-0.02em] text-ink">
            More than a label on a leaf.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {CARDS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1}>
              <div
                className={`glass lift relative h-full overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br ${c.wash} to-transparent p-8`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    c.accent ? "bg-amber/20 text-amber-deep" : "bg-leaf/10 text-leaf-deep"
                  }`}
                >
                  <c.icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <h3 className="mt-6 font-display text-2xl font-bold leading-tight text-ink">
                  {c.title}
                </h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
