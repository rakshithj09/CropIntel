import { ArrowRight } from "lucide-react";
import GradientField from "./GradientField";
import Reveal from "./Reveal";

const APP_URL = "https://jaithrap-cropintel.hf.space";

export default function FinalCTA() {
  return (
    <section className="relative px-4 py-16">
      <div className="glass relative mx-auto max-w-5xl overflow-hidden rounded-[32px] px-6 py-24 text-center">
        <GradientField />
        <div className="relative z-10">
          <Reveal>
            <h2 className="mx-auto max-w-2xl font-display text-[clamp(2.25rem,5vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
              Point your phone at the problem.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft">
              Get a diagnosis, a severity read, and a next step — in seconds.
            </p>
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary group mt-9 inline-flex items-center gap-2 rounded-full px-7 py-4 font-semibold shadow-[0_16px_40px_-12px_rgba(22,35,28,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Try the scanner
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
