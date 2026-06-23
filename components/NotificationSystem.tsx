'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Bell, X, AlertTriangle, MapPin, Check } from 'lucide-react'
import {
  findAffectedFarmers,
  generateNotificationMessage,
  type OutbreakLocation,
  type FarmerLocation,
  type Notification,
} from '@/lib/notifications'
import type { OutbreakReport } from '@/lib/outbreakReport'

interface NotificationSystemProps {
  outbreaks: OutbreakReport[]
  currentFarmerLocation?: { lat: number; lng: number; crops: string[] }
}

const SEVERITY_SORT = { high: 0, medium: 1, low: 2 } as const

export default function NotificationSystem({
  outbreaks,
  currentFarmerLocation,
}: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  /** Outbreak IDs the user dismissed — otherwise the sync effect recreates them */
  const [dismissedOutbreakIds, setDismissedOutbreakIds] = useState<Set<string>>(() => new Set())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    // Bubble-phase click avoids capture-phase pointer handlers stealing taps before button onClick runs.
    const onDocumentClick = (e: MouseEvent) => {
      const root = rootRef.current
      if (root && !root.contains(e.target as Node)) setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onDocumentClick)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onDocumentClick)
    }
  }, [isOpen])

  /** Demo persona when no farm is registered — must match `findAffectedFarmers` ids */
  const DEMO_FARMER_ID = 'farmer-1'

  // Recompute when registration changes (useState initializer only runs once)
  const farmers = useMemo<FarmerLocation[]>(() => [
    // Arkansas area farmers
    {
      id: 'farmer-1',
      name: 'John Smith',
      email: 'john@example.com',
      lat: 35.5, // Near Russellville, AR (~20 miles)
      lng: -93.2,
      crops: ['corn', 'wheat', 'soybean'],
      radius: 250,
    },
    {
      id: 'farmer-2',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      lat: 35.1, // Within 250 miles of Russellville (~30 miles)
      lng: -92.8,
      crops: ['corn', 'rice'],
      radius: 250,
    },
    {
      id: 'farmer-3',
      name: 'Mike Davis',
      email: 'mike@example.com',
      lat: 36.0, // Within 250 miles of Russellville (~50 miles)
      lng: -93.5,
      crops: ['corn', 'wheat', 'soybean'],
      radius: 250,
    },
    {
      id: 'farmer-4',
      name: 'Arkansas Farm Co.',
      email: 'info@arkfarm.com',
      lat: 34.7, // Little Rock area - within 250 miles (~80 miles)
      lng: -92.3,
      crops: ['corn', 'soybean'],
      radius: 250,
    },
    // California farmers
    {
      id: 'farmer-5',
      name: 'Central Valley Farms',
      email: 'contact@cvfarms.com',
      lat: 36.5, // Near Fresno, CA
      lng: -119.5,
      crops: ['wheat', 'corn'],
      radius: 250,
    },
    {
      id: 'farmer-6',
      name: 'Golden State Agriculture',
      email: 'info@gsag.com',
      lat: 37.0, // Near Modesto, CA
      lng: -120.5,
      crops: ['wheat', 'corn', 'soybean'],
      radius: 250,
    },
    // Texas farmers
    {
      id: 'farmer-7',
      name: 'Lone Star Crops',
      email: 'hello@lonestarcrops.com',
      lat: 32.0, // Near Abilene, TX
      lng: -99.5,
      crops: ['corn', 'wheat'],
      radius: 250,
    },
    {
      id: 'farmer-8',
      name: 'Texas Grain Co.',
      email: 'info@texasgrain.com',
      lat: 31.5, // Near San Angelo, TX
      lng: -100.0,
      crops: ['corn', 'soybean'],
      radius: 250,
    },
    // Iowa farmers
    {
      id: 'farmer-9',
      name: 'Iowa Corn Growers',
      email: 'contact@iowacorn.com',
      lat: 41.5, // Near Des Moines, IA
      lng: -93.0,
      crops: ['corn', 'soybean'],
      radius: 250,
    },
    {
      id: 'farmer-10',
      name: 'Midwest Agriculture',
      email: 'info@midwestag.com',
      lat: 42.0, // Near Cedar Rapids, IA
      lng: -91.5,
      crops: ['corn', 'soybean', 'wheat'],
      radius: 250,
    },
    // Illinois farmers
    {
      id: 'farmer-11',
      name: 'Prairie Farms',
      email: 'hello@prairiefarms.com',
      lat: 40.0, // Near Champaign, IL
      lng: -88.5,
      crops: ['corn', 'soybean'],
      radius: 250,
    },
    // Kansas farmers
    {
      id: 'farmer-12',
      name: 'Kansas Wheat Growers',
      email: 'info@kswheat.com',
      lat: 38.5, // Near Wichita, KS
      lng: -98.0,
      crops: ['wheat', 'corn'],
      radius: 250,
    },
    {
      id: 'farmer-13',
      name: 'Sunflower State Farms',
      email: 'contact@sunflowerfarms.com',
      lat: 39.0, // Near Topeka, KS
      lng: -95.5,
      crops: ['wheat', 'corn', 'soybean'],
      radius: 250,
    },
    // Nebraska farmers
    {
      id: 'farmer-14',
      name: 'Cornhusker Agriculture',
      email: 'info@cornhuskerag.com',
      lat: 41.0, // Near Lincoln, NE
      lng: -96.5,
      crops: ['corn', 'soybean'],
      radius: 250,
    },
    // North Carolina farmers
    {
      id: 'farmer-15',
      name: 'Carolina Crops',
      email: 'hello@carolinacrops.com',
      lat: 35.5, // Near Charlotte, NC
      lng: -80.5,
      crops: ['corn', 'soybean'],
      radius: 250,
    },
    // Ohio farmers
    {
      id: 'farmer-16',
      name: 'Buckeye Farms',
      email: 'info@buckeyefarms.com',
      lat: 40.0, // Near Columbus, OH
      lng: -83.0,
      crops: ['corn', 'soybean', 'wheat'],
      radius: 250,
    },
    // Add current user if location is available
    ...(currentFarmerLocation
      ? [
          {
            id: 'current-user',
            name: 'You',
            lat: currentFarmerLocation.lat,
            lng: currentFarmerLocation.lng,
            crops: currentFarmerLocation.crops,
            radius: 250,
          } as FarmerLocation,
        ]
      : []),
  ], [currentFarmerLocation])

  const toOutbreakLocation = (report: OutbreakReport): OutbreakLocation => ({
    id: report.id,
    lat: report.lat,
    lng: report.lng,
    crop: report.crop,
    disease: report.disease,
    severity: report.severity,
    date: report.date,
    description: report.description,
  })

  useEffect(() => {
    if (outbreaks.length === 0) {
      setNotifications([])
      return
    }

    const targetFarmerId = currentFarmerLocation ? 'current-user' : DEMO_FARMER_ID

    setNotifications((prev) => {
      const readByOutbreak = new Map<string, boolean>()
      const createdByOutbreak = new Map<string, string>()
      for (const n of prev) {
        if (n.read) readByOutbreak.set(n.outbreakId, true)
        createdByOutbreak.set(n.outbreakId, n.createdAt)
      }

      const next: Notification[] = []
      for (const report of outbreaks) {
        if (dismissedOutbreakIds.has(report.id)) continue

        const outbreakLocation = toOutbreakLocation(report)
        const affected = findAffectedFarmers(outbreakLocation, farmers)
        const match = affected.find((a) => a.farmer.id === targetFarmerId)
        if (!match) continue

        const verifiedTail =
          report.reporterVerified === true
            ? ' (verified farmer report)'
            : report.reporterVerified === false
              ? ' (unverified farmer report)'
              : ' (community report)'

        next.push({
          id: `${report.id}-${targetFarmerId}`,
          farmerId: targetFarmerId,
          outbreakId: report.id,
          distance: match.distance,
          message: `${generateNotificationMessage(outbreakLocation, match.distance)}${verifiedTail}`,
          severity: outbreakLocation.severity,
          read: readByOutbreak.get(report.id) ?? false,
          createdAt: createdByOutbreak.get(report.id) ?? new Date().toISOString(),
        })
      }

      next.sort((a, b) => {
        const s = SEVERITY_SORT[a.severity] - SEVERITY_SORT[b.severity]
        if (s !== 0) return s
        return a.distance - b.distance
      })

      return next
    })
  }, [outbreaks, farmers, currentFarmerLocation, dismissedOutbreakIds])

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
  }

  const deleteNotification = (notificationId: string) => {
    setNotifications((prev) => {
      const n = prev.find((x) => x.id === notificationId)
      if (n) {
        setDismissedOutbreakIds((s) => new Set(s).add(n.outbreakId))
      }
      return prev.filter((x) => x.id !== notificationId)
    })
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div
      ref={rootRef}
      className="relative z-[200] inline-flex shrink-0 items-center justify-center self-center"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="touch-manipulation relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-2 shadow-sm transition-all hover:border-primary-400 hover:shadow-md"
        aria-label="Crop alerts"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-6 w-6 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disease-alerts-title"
          className="absolute right-0 top-[calc(100%+10px)] flex max-h-[min(420px,70dvh)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl ring-1 ring-slate-900/10"
        >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
                <div className="min-w-0 flex-1">
                  <h3
                    id="disease-alerts-title"
                    className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-lg font-bold leading-tight text-slate-900 sm:text-xl"
                  >
                    <span className="inline-flex shrink-0 items-center gap-2">
                      <Bell className="h-5 w-5 shrink-0 text-primary-700" />
                      <span>Crop alerts</span>
                    </span>
                    {unreadCount > 0 && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                        {unreadCount} new
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Close notifications"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-2">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-slate-600">
                    <Bell className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                    <p className="font-semibold text-slate-800">No alerts yet</p>
                    <p className="mt-1 text-sm text-slate-500">
                      You&apos;ll be notified when reported crop trouble is within 250 miles
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notification) => {
                      const outbreak = outbreaks.find((o) => o.id === notification.outbreakId) as
                        | OutbreakReport
                        | undefined
                      return (
                        <div
                          key={notification.id}
                          className={`rounded-xl border p-4 transition-all ${
                            notification.read
                              ? 'border-slate-200 bg-slate-50'
                              : 'border-red-200 bg-red-50/95 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex gap-2">
                                <AlertTriangle
                                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                                    notification.severity === 'high'
                                      ? 'text-red-600'
                                      : notification.severity === 'medium'
                                        ? 'text-orange-600'
                                        : 'text-yellow-600'
                                  }`}
                                />
                                <p className="text-sm font-bold leading-snug text-slate-900">
                                  {notification.message}
                                </p>
                              </div>
                              {outbreak && (
                                <div className="mt-2 space-y-1 pl-0 sm:pl-7">
                                  {outbreak.reporterVerified !== undefined && (
                                    <p className="text-xs">
                                      <span
                                        className={`inline-block rounded-md border px-2 py-0.5 font-bold ${
                                          outbreak.reporterVerified
                                            ? 'border-emerald-200 bg-emerald-100 text-emerald-900'
                                            : 'border-slate-200 bg-slate-100 text-slate-700'
                                        }`}
                                      >
                                        {outbreak.reporterVerified ? 'Verified farmer' : 'Unverified farmer'}
                                      </span>
                                    </p>
                                  )}
                                  <p className="flex items-center gap-1 text-xs text-slate-600">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {notification.distance.toFixed(1)} miles away
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(notification.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-start gap-1">
                              {!notification.read && (
                                <button
                                  type="button"
                                  onClick={() => markAsRead(notification.id)}
                                  className="rounded-lg p-1.5 text-green-700 transition-colors hover:bg-white"
                                  title="Mark as read"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteNotification(notification.id)}
                                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
                                title="Delete"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="shrink-0 border-t border-slate-200 bg-slate-100/90 p-3">
                  <p className="text-center text-xs text-slate-600">
                    Alerts within 250 miles of your farm (or demo location). Dismissed alerts stay hidden until refresh.
                  </p>
                </div>
              )}
        </div>
      )}
    </div>
  )
}
