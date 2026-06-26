'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, AlertTriangle, X, Save, Maximize2, Minimize2 } from 'lucide-react'
import type { OutbreakReport } from '@/lib/outbreakReport'

// Dynamically import Google Maps component to avoid SSR issues
const GoogleMapComponent = dynamic(() => import('./GoogleMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[280px] w-full items-center justify-center rounded-xl border border-field-soil/10 bg-white sm:min-h-[400px]">
      <div className="px-4 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary-700"></div>
        <p className="text-sm font-semibold text-primary-800 sm:text-base">Loading map...</p>
      </div>
    </div>
  ),
})

interface USOutbreakMapProps {
  reports?: OutbreakReport[]
  onReportSubmit?: (report: OutbreakReport) => void
}

function triggerMapResize(map: google.maps.Map | null) {
  if (!map || typeof google === 'undefined') return
  window.setTimeout(() => {
    google.maps.event.trigger(map, 'resize')
  }, 120)
}

function getFullscreenElement(): Element | null {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null
  }
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

async function requestElementFullscreen(el: HTMLElement): Promise<boolean> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => void
  }
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen()
      return true
    }
  } catch {
    /* try webkit */
  }
  try {
    if (anyEl.webkitRequestFullscreen) {
      anyEl.webkitRequestFullscreen()
      return true
    }
  } catch {
    /* fall through */
  }
  return false
}

async function exitDocumentFullscreen(): Promise<void> {
  const doc = document as Document & { webkitExitFullscreen?: () => void }
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen()
      return
    }
  } catch {
    /* try webkit */
  }
  try {
    if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen()
    }
  } catch {
    /* ignore */
  }
}

export default function USOutbreakMap({ reports = [], onReportSubmit }: USOutbreakMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showReportForm, setShowReportForm] = useState(false)
  const mapCardRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const [browserFullscreen, setBrowserFullscreen] = useState(false)
  /** iOS / browsers without element fullscreen */
  const [layoutFullscreen, setLayoutFullscreen] = useState(false)

  const expanded = browserFullscreen || layoutFullscreen

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapInstanceRef.current = map
  }, [])

  useEffect(() => {
    const syncFs = () => {
      const fsEl = getFullscreenElement()
      setBrowserFullscreen(fsEl === mapCardRef.current)
    }
    syncFs()
    document.addEventListener('fullscreenchange', syncFs)
    document.addEventListener('webkitfullscreenchange', syncFs)
    return () => {
      document.removeEventListener('fullscreenchange', syncFs)
      document.removeEventListener('webkitfullscreenchange', syncFs)
    }
  }, [])

  useEffect(() => {
    triggerMapResize(mapInstanceRef.current)
  }, [expanded])

  useEffect(() => {
    const onResize = () => triggerMapResize(mapInstanceRef.current)
    window.addEventListener('orientationchange', onResize)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('orientationchange', onResize)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const exitAllFullscreen = useCallback(async () => {
    if (getFullscreenElement()) {
      await exitDocumentFullscreen()
    }
    setLayoutFullscreen(false)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = mapCardRef.current
    if (!el) return

    if (expanded) {
      await exitAllFullscreen()
      triggerMapResize(mapInstanceRef.current)
      return
    }

    const enteredFs = await requestElementFullscreen(el)
    if (enteredFs) {
      triggerMapResize(mapInstanceRef.current)
      return
    }

    setLayoutFullscreen(true)
    triggerMapResize(mapInstanceRef.current)
  }, [expanded, exitAllFullscreen])

  useEffect(() => {
    if (!layoutFullscreen && !browserFullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [layoutFullscreen, browserFullscreen])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void exitAllFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, exitAllFullscreen])

  useEffect(() => {
    return () => {
      document.body.style.removeProperty('overflow')
      void exitDocumentFullscreen()
    }
  }, [])

  // Ensure modal closes on mount/unmount to prevent stuck overlays
  useEffect(() => {
    return () => {
      setShowReportForm(false)
      setSelectedLocation(null)
    }
  }, [])

  const [formData, setFormData] = useState({
    crop: '',
    disease: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    description: '',
  })

  const handleMapClick = (lat: number, lng: number) => {
    // Restrict to US bounds
    const clampedLat = Math.max(24.39, Math.min(49.38, lat))
    const clampedLng = Math.max(-125, Math.min(-66.93, lng))
    
    setSelectedLocation({ lat: clampedLat, lng: clampedLng })
    setShowReportForm(true)
  }

  const handleSubmitReport = () => {
    if (!selectedLocation || !formData.crop || !formData.disease) {
      alert('Please fill in all required fields')
      return
    }

    const newReport: OutbreakReport = {
      id: Date.now().toString(),
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      crop: formData.crop,
      disease: formData.disease,
      severity: formData.severity,
      date: new Date().toISOString(),
      description: formData.description,
    }

    if (onReportSubmit) {
      onReportSubmit(newReport)
    }

    setShowReportForm(false)
    setSelectedLocation(null)
    setFormData({
      crop: '',
      disease: '',
      severity: 'medium',
      description: '',
    })
  }

  return (
    <div className="relative w-full">
      {/* Map card: explicit height so the map fills the area (no aspect-ratio gap) */}
      <div
        ref={mapCardRef}
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-field-soil/10 bg-white shadow-sm ${
          layoutFullscreen
            ? 'fixed inset-0 z-[5000] h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-none rounded-none border-slate-300 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
            : ''
        } ${expanded ? 'h-full min-h-0' : ''}`}
      >
        <div
          className={`relative flex w-full min-h-0 flex-col ${
            expanded ? 'h-full min-h-0 flex-1' : ''
          }`}
        >
          <div
            className={`relative min-h-0 w-full overflow-hidden ${
              expanded
                ? 'min-h-0 flex-1'
                : 'h-[min(52dvh,560px)] min-h-[280px] sm:min-h-[420px]'
            }`}
          >
            <GoogleMapComponent
              reports={reports}
              onMapClick={handleMapClick}
              center={{ lat: 39.8283, lng: -98.5795 }}
              zoom={4}
              showMapClickHint={false}
              fullscreenControl
              onMapReady={handleMapReady}
            />

            <div className="pointer-events-auto absolute right-2 top-2 z-[1001] flex gap-1 sm:right-3 sm:top-3">
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="touch-manipulation rounded-lg border border-field-soil/15 bg-white/95 px-2.5 py-2 text-primary-900 shadow-md backdrop-blur-sm transition hover:bg-field-cream sm:px-3"
                aria-label={expanded ? 'Exit fullscreen map' : 'Fullscreen map'}
                title={expanded ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {expanded ? (
                  <Minimize2 className="h-5 w-5 sm:h-5 sm:w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5 sm:h-5 sm:w-5" />
                )}
              </button>
            </div>

            {selectedLocation && !showReportForm && (
              <div className="pointer-events-none absolute left-2 top-12 z-[1000] max-w-[calc(100%-4rem)] rounded-lg border border-primary-200 bg-white p-2 shadow-xl sm:left-3 sm:top-14 sm:p-3">
                <p className="mb-0.5 text-[11px] font-bold text-primary-900 sm:text-xs">Selected location</p>
                <p className="break-all font-mono text-[10px] text-slate-600 sm:text-xs">
                  {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-field-soil/10 bg-field-cream px-3 py-2.5 sm:px-4 sm:py-3">
            <MapPin className="h-4 w-4 shrink-0 text-primary-700" />
            <p className="text-xs font-semibold leading-snug text-primary-900 sm:text-sm">
              Tap the map where you are seeing crop trouble
            </p>
          </div>
        </div>
      </div>

      {/* Report Form Modal — no AnimatePresence exit on full-screen layer (opacity-0 still captures clicks). */}
      {showReportForm && (
        <div className="fixed inset-0 z-[6000] flex items-end justify-center sm:items-center sm:p-4">
          <div
            role="presentation"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowReportForm(false)
              setSelectedLocation(null)
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-field-soil/10 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6 sm:pb-6"
          >
              <div className="flex items-center justify-between mb-6">
                <h2 className="flex items-center gap-3 text-2xl font-bold text-primary-900">
                  <div className="rounded-lg bg-field-wheat/40 p-2">
                    <AlertTriangle className="h-6 w-6 text-field-soil" />
                  </div>
                  Report crop trouble
                </h2>
                <button
                  onClick={() => {
                    setShowReportForm(false)
                    setSelectedLocation(null)
                  }}
                  className="rounded-lg p-1 text-field-soil transition-colors hover:bg-field-cream hover:text-primary-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedLocation && (
                <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-primary-800">Location</p>
                  <p className="font-mono text-sm text-primary-900">
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Crop affected <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.crop}
                    onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                    placeholder="Corn, wheat, rice"
                    className="field-input py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    What it looks like <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.disease}
                    onChange={(e) => setFormData({ ...formData, disease: e.target.value })}
                    placeholder="Rust, blight, yellowing"
                    className="field-input py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    How bad is it? <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.severity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        severity: e.target.value as 'low' | 'medium' | 'high',
                      })
                    }
                    className="field-input py-2.5"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Field notes
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="How much of the field is affected? When did you notice it?"
                    rows={3}
                    className="field-input resize-none py-2.5"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmitReport}
                  className="btn-primary w-full"
                >
                  <Save className="w-5 h-5" />
                  Share report
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  )
}
