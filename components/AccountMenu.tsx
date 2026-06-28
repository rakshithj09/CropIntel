'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, LogOut, Settings, Sprout, Tractor, UserCircle } from 'lucide-react'
import type { User } from 'firebase/auth'
import { signOutUser } from '@/src/lib/auth'

type AccountMenuProps = {
  user: User | null
  loading?: boolean
}

function getAccountName(user: User | null) {
  return user?.displayName?.trim() || user?.email?.split('@')[0]?.trim() || 'CropIntel user'
}

function getInitials(name: string, email: string) {
  const source = name !== 'CropIntel user' ? name : email
  const parts = source
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)

  if (parts.length === 0) return 'CI'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function AccountMenu({ user, loading = false }: AccountMenuProps) {
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const email = user?.email?.trim() || 'No email on file'
  const name = getAccountName(user)
  const initials = useMemo(() => getInitials(name, email), [name, email])
  const photoStyle = user?.photoURL
    ? { backgroundImage: `url(${JSON.stringify(user.photoURL)})` }
    : undefined

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOutUser()
      router.replace('/login')
    } finally {
      setSigningOut(false)
      setOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[44px] items-center gap-2 rounded-full border border-ink/10 bg-surface/70 px-2.5 py-1.5 shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-field-cream text-leaf-deep">
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading account" />
        </div>
        <div className="hidden min-w-0 sm:block">
          <div className="h-3 w-24 rounded-full bg-ink/10" />
          <div className="mt-1.5 h-2.5 w-32 rounded-full bg-ink/10" />
        </div>
      </div>
    )
  }

  return (
    <div ref={menuRef} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-[44px] max-w-[15rem] touch-manipulation items-center gap-2 rounded-full border border-ink/10 bg-surface/80 px-2 py-1.5 text-left shadow-sm backdrop-blur transition hover:border-leaf/30 hover:bg-white focus:outline-none focus:ring-4 focus:ring-primary-200/60 sm:max-w-[18rem] sm:pr-3"
      >
        <span
          aria-hidden="true"
          style={photoStyle}
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink bg-cover bg-center text-sm font-extrabold text-white"
        >
          {!user?.photoURL && initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-bold leading-4 text-ink">{name}</span>
          <span className="block truncate text-xs font-medium leading-4 text-ink-soft">{email}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/80 bg-surface shadow-[0_24px_60px_-28px_rgba(18,38,28,0.45)] ring-1 ring-ink/5"
        >
          <div className="border-b border-ink/10 p-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                style={photoStyle}
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink bg-cover bg-center text-sm font-extrabold text-white"
              >
                {!user?.photoURL && initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-ink">{name}</p>
                <p className="truncate text-xs font-semibold text-ink-soft">{email}</p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <Link href="/profile" role="menuitem" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink transition hover:bg-field-cream">
              <UserCircle className="h-4 w-4 text-leaf-deep" />
              Profile
            </Link>
            <Link href="/farms" role="menuitem" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink transition hover:bg-field-cream">
              <Tractor className="h-4 w-4 text-leaf-deep" />
              My Farms
            </Link>
            <Link href="/settings" role="menuitem" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink transition hover:bg-field-cream">
              <Settings className="h-4 w-4 text-leaf-deep" />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-900 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>

          {!user && (
            <div className="flex items-start gap-2 border-t border-amber/20 bg-field-cream px-4 py-3 text-xs font-semibold text-amber-deep">
              <Sprout className="mt-0.5 h-4 w-4 shrink-0" />
              Account details are not available yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
