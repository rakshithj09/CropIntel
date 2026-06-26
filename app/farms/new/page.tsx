'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import FarmSetupForm from '@/components/FarmSetupForm'
import { signOutUser, subscribeToAuth } from '@/src/lib/auth'
import type { User } from 'firebase/auth'

export default function NewFarmPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeToAuth(
      (currentUser) => {
        if (!currentUser) {
          router.replace('/login')
          return
        }

        setUser(currentUser)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
  }, [router])

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSignOut = async () => {
    await signOutUser()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-700" aria-label="Loading" />
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
              { label: 'Diagnosis', href: '/diagnosis', active: false },
              { label: 'Saved checks', href: '/saved-checks', active: false },
              { label: 'Local risk', href: '/local-risk', active: false },
              { label: 'Farms', href: '/farms', active: true },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`cropintel-menu-link font-mono text-sm font-medium transition-colors ${
                  item.active ? 'text-ink' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <button type="button" onClick={handleSignOut} className="btn-secondary px-4 py-2 text-sm">
            Sign out
          </button>
        </nav>
      </header>

      <div className="mx-auto mb-6 grid max-w-5xl grid-cols-4 gap-2 rounded-full border border-white/70 bg-surface/60 p-1.5 shadow-sm backdrop-blur md:hidden">
        {[
          { label: 'Diagnosis', href: '/diagnosis', active: false },
          { label: 'Saved', href: '/saved-checks', active: false },
          { label: 'Risk', href: '/local-risk', active: false },
          { label: 'Farms', href: '/farms', active: true },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`touch-manipulation font-mono flex min-h-[40px] items-center justify-center rounded-full px-2 py-2 text-center text-[11px] font-semibold transition-all sm:text-sm ${
              item.active ? 'bg-ink text-white shadow-sm' : 'text-ink-soft hover:bg-white/70 hover:text-ink'
            }`}
          >
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="mx-auto max-w-4xl">
        <section className="surface rounded-2xl p-5 sm:p-8">
          <div className="mb-6">
            <p className="eyebrow">Farm management</p>
            <h1 className="mt-4 text-3xl font-extrabold text-primary-900 sm:text-4xl">Add a farm</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-field-soil">
              Create another farm for your operation or join a farm that already exists.
            </p>
          </div>

          {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}
          {user && <FarmSetupForm userId={user.uid} redirectTo="/farms" />}
        </section>
      </div>
    </main>
  )
}
