import Reveal from "./Reveal";
import CountUp from "./CountUp";

/*
 * REAL numbers from the repo (do not invent):
 *  - accuracy: mean of cropintel_model_metrics_overall.csv across corn/rice/
 *    soybean/wheat (94.8 / 99.2 / 96.6 / 92.9) ≈ 96%. NOTE: internal validation
 *    from the Jan model snapshot; field/external accuracy is lower for some
 *    crops. TODO: confirm against current deployed versions before publishing.
 *  - diseases: 25 non-"Healthy" classes across the 5 crops (corn 3, soybean 6,
 *    wheat 7, rice 2, tomato 7) from the deployed /models endpoint.
 *  - crops: 5 (corn, soybean, wheat, rice, tomato).
 *  - TODO: add real on-device inference time (ms) once measured.
 */
const STATS = [
  { value: "96%", label: "Mean validation accuracy", sub: "across 4 measured crops" },
  { value: "25", label: "Diseases detected", sub: "plus a healthy baseline" },
  { value: "5", label: "Crops supported", sub: "corn · soybean · wheat · rice · tomato" },
];

export default function Stats() {
  return (
    <section id="accuracy" className="relative px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 text-center">
          <span className="eyebrow">Accuracy</span>
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-tight tracking-[-0.02em] text-ink">
            Tested, measured, and honest about it.
          </h2>
        </Reveal>

        <Reveal>
          <div className="glass grid divide-y divide-ink/10 rounded-[var(--radius-card)] px-2 py-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((s) => (
              <div key={s.label} className="px-6 py-8 text-center">
                <CountUp
                  value={s.value}
                  className="block font-mono text-[clamp(2.75rem,6vw,4.5rem)] font-bold leading-none tracking-tight text-ink tabular-nums"
                />
                <p className="mt-4 font-display text-base font-bold text-ink">
                  {s.label}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{s.sub}</p>
              </div>
            ))}
          </div>
        </Reveal>

      </div>
    </section>
  );
}
