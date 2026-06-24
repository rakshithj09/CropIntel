// lucide-react no longer ships brand logos, so inline the GitHub mark.
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  );
}

const REPO_URL = "https://github.com/rakshithj09/CropIntel";
const APP_URL = "https://jaithrap-cropintel.hf.space";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Try the scanner", href: APP_URL },
      { label: "How it works", href: "#how" },
      { label: "Accuracy", href: "#accuracy" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "GitHub repo", href: REPO_URL },
      { label: "FAQ", href: "#faq" },
      { label: "Model details", href: REPO_URL },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "License (MIT)", href: REPO_URL },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-ink/10 px-4 py-14">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/wheat-mark-transparent.png"
                alt="CropIntel"
                className="h-5 w-auto object-contain"
              />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-ink">
              CropIntel
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
            Crop disease, diagnosed from a single photo — open source, on-device.
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <GithubMark className="h-4 w-4" />
            rakshithj09/CropIntel
          </a>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <p className="font-mono text-xs uppercase tracking-widest text-ink-soft/70">
              {col.heading}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-ink-soft transition-colors hover:text-ink"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-start justify-between gap-3 border-t border-ink/10 pt-6 text-sm text-ink-soft sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} CropIntel. MIT licensed.</p>
        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-leaf" />
          All systems operational
        </p>
      </div>
    </footer>
  );
}
