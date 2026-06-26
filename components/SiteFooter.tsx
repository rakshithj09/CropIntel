import Image from 'next/image'
import Link from 'next/link'
import { Mail, ShieldCheck } from 'lucide-react'

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/70 bg-surface/75 px-4 py-7 text-sm text-field-soil backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/diagnosis" className="flex w-fit items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-leaf shadow-sm">
            <Image
              src="/brand/wheat-mark-transparent.png"
              alt="CropIntel"
              width={24}
              height={24}
              className="h-6 w-auto object-contain"
            />
          </span>
          <span>
            <span className="block font-display text-base font-extrabold text-ink">CropIntel</span>
            <span className="block text-xs leading-5 text-field-soil">Private by design, useful in the field.</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-2 font-semibold text-primary-900 transition hover:border-leaf/30 hover:bg-white"
            href="/privacy"
          >
            <ShieldCheck className="h-4 w-4" />
            Privacy Policy
          </Link>
          <a
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-2 font-semibold text-primary-900 transition hover:border-leaf/30 hover:bg-white"
            href="mailto:privacy@cropintel.app"
          >
            <Mail className="h-4 w-4" />
            Contact
          </a>
        </nav>
      </div>
    </footer>
  )
}
