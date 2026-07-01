import { ArrowRight } from "lucide-react";
import GradientField from "./GradientField";
import ScanCard from "./ScanCard";
import Reveal from "./Reveal";

const APP_URL = "https://jaithrap-cropintel.hf.space";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-4 pb-24 pt-36 sm:pt-40">
      <GradientField />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* copy */}
        <Reveal>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface/60 px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
            Crop disease, diagnosed on your phone
          </p>
          <h1 className="font-display text-[clamp(2.75rem,6vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.02em] text-ink">
            Take a clear photo of an affected leaf.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            CropIntel helps you identify likely leaf disease symptoms, estimate
            how much of the leaf is affected, and decide what to check next, even
            with no signal.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-semibold shadow-[0_14px_34px_-10px_rgba(22,35,28,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Try the scanner
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a href="#how" className="text-sm font-semibold text-ink underline-offset-4 hover:underline">
              See how it works
            </a>
          </div>
        </Reveal>

        {/* signature scan card */}
        <div className="flex justify-center lg:justify-end">
          <div className="floaty">
            <ScanCard />
          </div>
        </div>
      </div>
    </section>
  );
}
