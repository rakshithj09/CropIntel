'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, Loader2, LogOut, Plus, RefreshCw, RotateCcw, X } from 'lucide-react'
import AccountMenu from '@/components/AccountMenu'
import { subscribeToAuth } from '@/src/lib/auth'
import {
  approveFarmAccessRequest,
  denyFarmAccessRequest,
  getPendingFarmAccessRequestsForOwner,
  getUserFarmAccessRequests,
  getUserFarmSummaries,
  leaveFarm,
  refreshFarmSearchIndex,
  regenerateFarmJoinCode,
} from '@/src/lib/farms'
import type { Farm, FarmAccessRequest, FarmMember } from '@/src/lib/types'
import type { User } from 'firebase/auth'

type FarmSummary = {
  farm: Farm
  membership: FarmMember | null
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function FarmsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [farmSummaries, setFarmSummaries] = useState<FarmSummary[]>([])
  const [accessRequests, setAccessRequests] = useState<FarmAccessRequest[]>([])
  const [ownerRequests, setOwnerRequests] = useState<FarmAccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmingLeaveFarmId, setConfirmingLeaveFarmId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  const loadFarmData = async (uid: string) => {
    const [summaries, requests, pendingOwnerRequests] = await Promise.all([
      getUserFarmSummaries(uid),
      getUserFarmAccessRequests(uid),
      getPendingFarmAccessRequestsForOwner(uid),
    ])
    setFarmSummaries(summaries)
    setAccessRequests(requests)
    setOwnerRequests(pendingOwnerRequests)
  }

  useEffect(() => {
    return subscribeToAuth(async (user) => {
      if (!user) {
        router.replace('/login')
        return
      }

      setUser(user)
      try {
        await loadFarmData(user.uid)
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Could not load farm data.'))
      } finally {
        setLoading(false)
      }
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

  const runFarmAction = async (key: string, action: () => Promise<string>) => {
    if (!user) return false
    setActionLoading(key)
    setError(null)
    setMessage(null)
    try {
      const nextMessage = await action()
      await loadFarmData(user.uid)
      setMessage(nextMessage)
      return true
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not complete that action.'))
      return false
    } finally {
      setActionLoading(null)
    }
  }

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

          <AccountMenu user={user} />
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

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-primary-900">Your farms</h1>
            <p className="mt-1 text-sm text-field-soil">Manage every farm connected to this account.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/farms/new" className="btn-primary">
              <Plus className="h-4 w-4" />
              Add farm
            </Link>
          </div>
        </div>

        {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}
        {message && <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}

        {ownerRequests.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-primary-900">Pending access requests</h2>
              <button
                type="button"
                onClick={() => user && runFarmAction('refresh-requests', async () => {
                  await loadFarmData(user.uid)
                  return 'Requests refreshed.'
                })}
                className="btn-secondary px-3 py-2 text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            <div className="grid gap-3">
              {ownerRequests.map((request) => (
                <article key={request.id} className="surface rounded-2xl p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-primary-900">{request.farmName}</p>
                      <p className="mt-1 text-sm text-field-soil">
                        Requester ID: <span className="font-mono">{request.requesterId}</span>
                      </p>
                      <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase text-amber-800">
                        {request.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <button
                        type="button"
                        disabled={actionLoading === `approve-${request.id}`}
                        onClick={() => {
                          if (!user) return
                          runFarmAction(`approve-${request.id}`, async () => {
                            await approveFarmAccessRequest(user.uid, request)
                            return 'Access request approved.'
                          })
                        }}
                        className="btn-primary justify-center px-4 py-2 text-sm"
                      >
                        {actionLoading === `approve-${request.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === `deny-${request.id}`}
                        onClick={() => {
                          if (!user) return
                          runFarmAction(`deny-${request.id}`, async () => {
                            await denyFarmAccessRequest(user.uid, request)
                            return 'Access request denied.'
                          })
                        }}
                        className="btn-secondary justify-center px-4 py-2 text-sm"
                      >
                        {actionLoading === `deny-${request.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Deny
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {farmSummaries.length === 0 ? (
          <section className="surface rounded-2xl p-6 text-center">
            <p className="text-sm text-field-soil">No farms are connected to this account yet.</p>
            <Link href="/farms/new" className="btn-primary mt-5">
              Create or join a farm
            </Link>
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {farmSummaries.map(({ farm, membership }) => (
              <article key={farm.id} className="surface rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-primary-900">{farm.name}</h2>
                    <p className="mt-1 text-sm text-field-soil">{farm.address}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase text-slate-600">
                    {membership?.role ?? 'member'}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-white/70 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-field-soil">Join code</p>
                    <p className="mt-1 font-mono text-lg font-bold tracking-[0.2em] text-primary-900">{farm.joinCode}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-field-soil">State</p>
                    <p className="mt-1 text-lg font-bold text-primary-900">{farm.stateCode}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {farm.crops.map((crop) => (
                    <span key={crop} className="rounded-full bg-field-cream px-3 py-1 text-sm font-semibold capitalize text-field-soil">
                      {crop}
                    </span>
                  ))}
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {membership?.role === 'owner' ? (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading === `code-${farm.id}`}
                        onClick={() => {
                          if (!user) return
                          runFarmAction(`code-${farm.id}`, async () => {
                            await regenerateFarmJoinCode(user.uid, farm)
                            return 'Join code regenerated. The old code no longer works.'
                          })
                        }}
                        className="btn-secondary justify-center px-4 py-2 text-sm"
                      >
                        {actionLoading === `code-${farm.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        New code
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === `index-${farm.id}`}
                        onClick={() => {
                          if (!user) return
                          runFarmAction(`index-${farm.id}`, async () => {
                            await refreshFarmSearchIndex(user.uid, farm)
                            return 'Farm search listing refreshed.'
                          })
                        }}
                        className="btn-secondary justify-center px-4 py-2 text-sm"
                      >
                        {actionLoading === `index-${farm.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Search listing
                      </button>
                    </>
                  ) : confirmingLeaveFarmId === farm.id ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 sm:col-span-2">
                      <p className="text-sm font-bold text-rose-950">Leave {farm.name}?</p>
                      <p className="mt-1 text-sm text-rose-900">You will lose access to this farm unless an owner adds you again.</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={actionLoading === `leave-${farm.id}`}
                          onClick={() => setConfirmingLeaveFarmId(null)}
                          className="btn-secondary justify-center px-4 py-2 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!membership || actionLoading === `leave-${farm.id}`}
                          onClick={async () => {
                            if (!user || !membership) return
                            const succeeded = await runFarmAction(`leave-${farm.id}`, async () => {
                              await leaveFarm(user.uid, membership)
                              return `You left ${farm.name}.`
                            })
                            if (succeeded) setConfirmingLeaveFarmId(null)
                          }}
                          className="btn-primary justify-center px-4 py-2 text-sm"
                        >
                          {actionLoading === `leave-${farm.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                          Leave
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!membership || actionLoading === `leave-${farm.id}`}
                      onClick={() => setConfirmingLeaveFarmId(farm.id)}
                      className="btn-secondary justify-center px-4 py-2 text-sm sm:col-span-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Leave farm
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {accessRequests.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xl font-extrabold text-primary-900">Your access requests</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {accessRequests.map((request) => (
                <article key={request.id} className="surface rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-primary-900">{request.farmName}</h3>
                      <p className="mt-1 text-sm text-field-soil">{request.farmAddress}</p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${
                        request.status === 'approved'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : request.status === 'denied'
                            ? 'border-rose-200 bg-rose-50 text-rose-800'
                            : request.status === 'expired'
                              ? 'border-slate-200 bg-slate-50 text-slate-700'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
