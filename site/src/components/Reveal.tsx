import type { ReactNode } from "react";

/**
 * Fade + rise — PURE CSS, no JavaScript. Content is always visible even if
 * client JS never runs (the previous framer-motion version baked opacity:0
 * into the HTML and depended on JS to reveal it, so any hydration failure left
 * text invisible). The animation here is a progressive enhancement that simply
 * degrades to "visible". Honors prefers-reduced-motion via CSS.
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
  return (
    <div
      className={`reveal-rise${className ? ` ${className}` : ""}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
