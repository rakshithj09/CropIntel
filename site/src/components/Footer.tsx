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
      { label: "FAQ", href: "#faq" },
      { label: "Model overview", href: "#accuracy" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
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
            Crop disease, diagnosed from a single photo — private model pipeline, on-device experience.
          </p>
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
        <p>© {new Date().getFullYear()} CropIntel. All rights reserved.</p>
        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-leaf" />
          All systems operational
        </p>
      </div>
    </footer>
  );
}
