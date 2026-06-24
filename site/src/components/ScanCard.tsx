"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ScanLine } from "lucide-react";

/**
 * The signature element — a frosted-glass scan result card floating, slightly
 * rotated, over the gradient washes. On load it runs a brief "Analyzing…"
 * pass (a green scan-line sweeps the real leaf photo) and then resolves to a
 * diagnosis: the label fades in, the confidence counts up, the severity bar
 * fills, and the recommended action staggers in — cluely's "live" feel.
 *
 * Placeholder result; not wired to the real model (this is the marketing site).
 */

const CONFIDENCE = 96; // %
const SEVERITY = 0.58; // 0–1, "Moderate"

export default function ScanCard() {
  const reduce = useReducedMotion();
  const [resolved, setResolved] = useState(false);
  const [count, setCount] = useState(0);

  // analyze → resolve
  useEffect(() => {
    if (reduce) {
      setResolved(true);
      setCount(CONFIDENCE);
      return;
    }
    const t = setTimeout(() => setResolved(true), 1500);
    return () => clearTimeout(t);
  }, [reduce]);

  // confidence count-up once resolved
  useEffect(() => {
    if (!resolved || reduce) return;
    let raf = 0;
    let start = 0;
    const dur = 750;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * CONFIDENCE));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [resolved, reduce]);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="scan-card glass relative w-[330px] overflow-hidden rounded-[var(--radius-card)] p-5 sm:w-[360px]"
    >
      <div className="scanline" />

      {/* real leaf photo */}
      <div className="relative mb-4 h-44 overflow-hidden rounded-2xl bg-grad-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/corn-common-rust.png"
          alt="Corn leaf showing rust-colored pustules"
          className="h-full w-full object-cover"
        />

        {/* analyzing overlay */}
        {!resolved && (
          <>
            <div className="absolute inset-0 bg-ink/15" />
            <div className="scan-sweep-line" />
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-surface">
              <ScanLine className="h-3 w-3 animate-pulse" strokeWidth={2.5} />
              Analyzing
            </span>
          </>
        )}

        {/* corner brackets (decorative scan framing) */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-surface/70" />
        <span className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-surface/70" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-surface/70" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-surface/70" />
      </div>

      {/* result row */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
            {resolved ? "Diagnosis · Corn" : "Analyzing…"}
          </p>
          <motion.p
            className="font-display text-xl font-bold text-ink"
            initial={false}
            animate={{ opacity: resolved ? 1 : 0.4 }}
            transition={{ duration: 0.4 }}
          >
            {resolved ? "Common Rust" : "—"}
          </motion.p>
        </div>
        <span
          className={`rounded-full px-3 py-1 font-mono text-sm font-medium tabular-nums transition-opacity duration-500 ${
            resolved ? "bg-amber/20 text-amber-deep opacity-100" : "opacity-0"
          }`}
        >
          {count}%
        </span>
      </div>

      {/* severity meter */}
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          <span>Severity</span>
          <span>{resolved ? "Moderate" : ""}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <motion.div
            className="h-full rounded-full bg-amber"
            initial={{ width: 0 }}
            animate={{ width: resolved ? `${SEVERITY * 100}%` : 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          />
        </div>
      </div>

      {/* recommended action */}
      <motion.div
        className="mt-4 flex items-start gap-2"
        initial={false}
        animate={{ opacity: resolved ? 1 : 0, y: resolved ? 0 : 6 }}
        transition={{ duration: 0.45, delay: 0.35 }}
      >
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-leaf" strokeWidth={2.5} />
        <p className="text-sm leading-snug text-ink-soft">
          Pustules across the canopy before tasseling — apply a foliar fungicide
          (triazole or strobilurin) now.
        </p>
      </motion.div>
    </motion.div>
  );
}
