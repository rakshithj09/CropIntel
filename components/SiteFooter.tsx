import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-surface/80 px-4 py-6 text-sm text-field-soil">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>CropIntel</p>
        <nav className="flex flex-wrap gap-4">
          <Link className="font-semibold text-primary-800 hover:text-primary-950" href="/privacy">
            Privacy Policy
          </Link>
          <a className="font-semibold text-primary-800 hover:text-primary-950" href="mailto:privacy@cropintel.app">
            Privacy contact
          </a>
        </nav>
      </div>
    </footer>
  )
}
