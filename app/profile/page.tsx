'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import AccountMenu from '@/components/AccountMenu'
import { subscribeToAuth } from '@/src/lib/auth'
import type { User } from 'firebase/auth'

function initialsFor(user: User | null) {
  const source = user?.displayName?.trim() || user?.email?.split('@')[0] || 'CropIntel user'
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CI'
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const initials = useMemo(() => initialsFor(user), [user])
  const photoStyle = user?.photoURL
    ? { backgroundImage: `url(${JSON.stringify(user.photoURL)})` }
    : undefined

  useEffect(() => {
    return subscribeToAuth((currentUser) => {
      if (!currentUser) {
        router.replace('/login')
        return
      }

      setUser(currentUser)
      setLoading(false)
    })
  }, [router])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/70 bg-surface/70 px-6 py-5 text-center shadow-sm backdrop-blur">
          <Loader2 className="h-8 w-8 animate-spin text-primary-700" aria-label="Loading" />
          <p className="text-sm font-semibold text-ink-soft">Loading your account...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <header className="fixed inset-x-0 top-0 z-50 px-4 py-3">
        <nav
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-3 transition-all duration-300 ${
            scrolled ? 'glass' : 'border border-transparent'
          }`}
        >
          <Link href="/diagnosis" className="cropintel-brand flex min-w-0 items-center gap-2 text-left">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-leaf">
              <Image
                src="/brand/wheat-mark-transparent.png"
                alt="CropIntel"
                width={20}
                height={20}
                className="h-5 w-auto object-contain opacity-95 drop-shadow-[0_1px_0_rgba(0,0,0,0.08)]"
                priority
              />
            </span>
            <span className="font-display truncate text-lg font-extrabold tracking-tight text-ink">CropIntel</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {[
              { label: 'Diagnosis', href: '/diagnosis' },
              { label: 'Saved checks', href: '/saved-checks' },
              { label: 'Local risk', href: '/local-risk' },
              { label: 'Farms', href: '/farms' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="cropintel-menu-link font-mono text-sm font-medium text-ink-soft transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <AccountMenu user={user} />
        </nav>
      </header>

      <div className="mx-auto mb-6 grid max-w-5xl grid-cols-4 gap-2 rounded-full border border-white/70 bg-surface/60 p-1.5 shadow-sm backdrop-blur md:hidden">
        {[
          { label: 'Diagnosis', href: '/diagnosis' },
          { label: 'Saved', href: '/saved-checks' },
          { label: 'Risk', href: '/local-risk' },
          { label: 'Farms', href: '/farms' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="touch-manipulation font-mono flex min-h-[40px] items-center justify-center rounded-full px-2 py-2 text-center text-[11px] font-semibold text-ink-soft transition-all hover:bg-white/70 hover:text-ink sm:text-sm"
          >
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>

      <section className="surface mx-auto max-w-3xl rounded-2xl p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            style={photoStyle}
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink bg-cover bg-center text-2xl font-extrabold text-white"
          >
            {!user?.photoURL && initials}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-field-soil">Profile</p>
            <h1 className="mt-1 truncate text-3xl font-extrabold text-primary-900">
              {user?.displayName || user?.email?.split('@')[0] || 'CropIntel user'}
            </h1>
            <p className="mt-1 truncate text-sm font-semibold text-field-soil">{user?.email || 'No email on file'}</p>
          </div>
        </div>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/70 p-4">
            <dt className="text-xs font-bold uppercase tracking-wide text-field-soil">Email status</dt>
            <dd className="mt-1 text-base font-bold text-primary-900">{user?.emailVerified ? 'Verified' : 'Not verified'}</dd>
          </div>
          <div className="rounded-xl bg-white/70 p-4">
            <dt className="text-xs font-bold uppercase tracking-wide text-field-soil">Account ID</dt>
            <dd className="mt-1 truncate font-mono text-sm font-bold text-primary-900">{user?.uid}</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
