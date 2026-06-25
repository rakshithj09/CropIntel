'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { signOutUser, subscribeToAuth } from '@/src/lib/auth'
import { getUserFarms } from '@/src/lib/farms'
import type { Farm } from '@/src/lib/types'

export default function FarmsPage() {
  const router = useRouter()
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    return subscribeToAuth(async (user) => {
      if (!user) {
        router.replace('/login')
        return
      }

      setFarms(await getUserFarms(user.uid))
      setLoading(false)
    })
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
                className={`cropintel-menu-link text-sm font-medium transition-colors ${
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
            className={`touch-manipulation flex min-h-[40px] items-center justify-center rounded-full px-2 py-2 text-center text-[11px] font-semibold transition-all sm:text-sm ${
              item.active ? 'bg-ink text-white shadow-sm' : 'text-ink-soft hover:bg-white/70 hover:text-ink'
            }`}
          >
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-primary-900">Your farms</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/onboarding" className="btn-primary">
              <Plus className="h-4 w-4" />
              Add farm
            </Link>
          </div>
        </div>

        {farms.length === 0 ? (
          <section className="surface rounded-2xl p-6 text-center">
            <p className="text-sm text-field-soil">No farms are connected to this account yet.</p>
            <Link href="/onboarding" className="btn-primary mt-5">
              Create or join a farm
            </Link>
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {farms.map((farm) => (
              <article key={farm.id} className="surface rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-primary-900">{farm.name}</h2>
                    <p className="mt-1 text-sm text-field-soil">{farm.address}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase text-slate-600">
                    {farm.verificationStatus}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-white/70 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-field-soil">Join code</p>
                    <p className="mt-1 font-mono text-lg font-bold tracking-[0.2em] text-primary-900">{farm.joinCode}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-field-soil">State</p>
                    <p className="mt-1 font-bold text-primary-900">{farm.stateCode}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {farm.crops.map((crop) => (
                    <span key={crop} className="rounded-full bg-field-cream px-3 py-1 text-sm font-semibold capitalize text-field-soil">
                      {crop}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
