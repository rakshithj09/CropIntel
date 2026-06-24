"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * Counts an integer up from 0 to its target when it scrolls into view (once).
 * Preserves any non-numeric prefix/suffix in `value` (e.g. "96%"). Honors
 * prefers-reduced-motion by showing the final value immediately.
 */
export default function CountUp({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();

  const match = value.match(/^(\D*)(\d+)(.*)$/);
  const prefix = match ? match[1] : "";
  const target = match ? parseInt(match[2], 10) : 0;
  const suffix = match ? match[3] : "";
  const numeric = match !== null;

  const [n, setN] = useState(0);

  useEffect(() => {
    if (!numeric) return;
    if (!inView || reduce) {
      setN(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const dur = 1100;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // `target`/`numeric` are derived from the (static) `value` prop; depending
    // on the freshly-allocated `match` object would re-run this every render.
  }, [inView, reduce, target, numeric]);

  if (!match) {
    return (
      <span ref={ref} className={className}>
        {value}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      {prefix}
      {n}
      {suffix}
    </span>
  );
}
