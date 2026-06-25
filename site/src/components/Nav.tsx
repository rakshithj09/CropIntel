"use client";

import { ArrowRight } from "lucide-react";

const APP_URL = "https://jaithrap-cropintel.hf.space";

export default function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3.5">
      <nav className="nav-glass grid h-14 grid-cols-[1fr_auto] items-center gap-3 rounded-full px-2.5 md:grid-cols-[1fr_auto_1fr]">
        <a
          href={APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex h-[42px] min-w-0 items-center gap-2 rounded-full bg-white/55 py-1 pl-2 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_rgba(18,38,28,0.08)] backdrop-blur-xl backdrop-saturate-150 transition-all duration-200 hover:bg-white/65"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf">
            <img src="/brand/wheat-mark-transparent.png" alt="CropIntel" className="h-5 w-auto object-contain" />
          </span>
          <span className="hidden text-[13px] font-medium leading-none text-ink/55 sm:inline">
            the scanner
          </span>
          <span className="font-display text-sm font-semibold leading-none tracking-tight text-ink/90">
            CropIntel
          </span>
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-ink/45 transition-transform group-hover:translate-x-0.5 sm:block" />
        </a>

        <div className="hidden items-center gap-7 md:flex">
          <a href="#how" className="text-[13px] font-medium text-ink/60 transition-colors hover:text-ink/90">
            How it works
          </a>
          <a href="#accuracy" className="text-[13px] font-medium text-ink/60 transition-colors hover:text-ink/90">
            Accuracy
          </a>
          <a href="#faq" className="text-[13px] font-medium text-ink/60 transition-colors hover:text-ink/90">
            FAQ
          </a>
        </div>

        <div className="flex justify-end">
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex h-10 items-center whitespace-nowrap rounded-full px-[18px] text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Try the scanner
          </a>
        </div>
      </nav>
    </header>
  );
}
