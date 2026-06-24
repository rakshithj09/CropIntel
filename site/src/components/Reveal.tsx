"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-triggered fade + rise that NEVER leaves content invisible.
 *
 * framer-motion's `whileInView` can miss elements that are already in view at
 * load — which happens on large monitors where the whole page fits without
 * scrolling, leaving that content stuck at opacity:0. So we drive it with a
 * direct IntersectionObserver (which reliably fires for already-visible
 * elements) plus a timeout safety net that reveals no matter what.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let revealed = false;
    const reveal = () => {
      if (!revealed) {
        revealed = true;
        setShown(true);
      }
    };

    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    obs.observe(el);

    // Safety net: content is never left hidden, even if the observer misbehaves.
    const t = window.setTimeout(reveal, 1200);

    return () => {
      obs.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
