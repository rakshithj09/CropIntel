'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  Flag,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  Save,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import type { OutbreakReport } from '@/lib/outbreakReport'
import {
  CROP_TROUBLE_REPORT_REASONS,
  type CreateCropTroubleReportInput,
  type CropTroubleReportReason,
} from '@/src/lib/cropTroubleReports'
import type { Farm } from '@/src/lib/types'

type ReportSeverity = OutbreakReport['severity']
type ReportStatus = OutbreakReport['status']

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
  currentUserId: string
  selectedFarm: Farm | null
  loadingReports?: boolean
  reportsError?: string | null
  onReportSubmit?: (report: Omit<CreateCropTroubleReportInput, 'userId' | 'farmId'>) => Promise<void>
  onSeeingToo?: (reportId: string) => Promise<void>
  onReportPost?: (reportId: string, reason: CropTroubleReportReason, summary: string) => Promise<void>
  onDeleteReport?: (reportId: string) => Promise<void>
}

type ReportFormData = {
  crop: string
  issueType: string
  severity: ReportSeverity
  description: string
  sharePhoto: boolean
  photoFile: File | null
}

const initialFormData: ReportFormData = {
  crop: '',
  issueType: '',
  severity: 'medium',
  description: '',
  sharePhoto: false,
  photoFile: null,
}

const reportReasonLabels: Record<CropTroubleReportReason, string> = {
  false_or_misleading: 'False or misleading',
  unsafe_advice: 'Unsafe advice',
  spam_or_duplicate: 'Spam or duplicate',
  private_information: 'Private information',
  harassment_or_abuse: 'Harassment or abuse',
  other: 'Other',
}

type ModerationDraft = {
  report: OutbreakReport
  reason: CropTroubleReportReason
  summary: string
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

function formatStatus(status: ReportStatus) {
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'resolved') return 'Resolved'
  return 'New'
}

function formatSeverity(severity: ReportSeverity) {
  if (severity === 'high') return 'High'
  if (severity === 'low') return 'Low'
  return 'Medium'
}

function reportAge(date: string) {
  const elapsedMs = Date.now() - new Date(date).getTime()
  const minutes = Math.max(1, Math.round(elapsedMs / 60000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hr ago`
  return `${Math.round(hours / 24)} days ago`
}

function roundApprox(value: number) {
  return Math.round(value * 10) / 10
}

function friendlyError(error: unknown) {
  if (error instanceof Error && error.message) {
    if (error.message.trim().startsWith('[')) return 'Could not save that report. Check the details and try again.'
    if (error.message.includes('wait')) return error.message
    if (error.message.includes('photo') || error.message.includes('JPEG')) return error.message
  }
  return 'Could not save that report. Check the details and try again.'
}

export default function USOutbreakMap({
  reports = [],
  currentUserId,
  selectedFarm,
  loadingReports = false,
  reportsError = null,
  onReportSubmit,
  onSeeingToo,
  onReportPost,
  onDeleteReport,
}: USOutbreakMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showReportForm, setShowReportForm] = useState(false)
  const [formData, setFormData] = useState<ReportFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busyReportId, setBusyReportId] = useState<string | null>(null)
  const [confirmingDeleteReportId, setConfirmingDeleteReportId] = useState<string | null>(null)
  const [moderationDraft, setModerationDraft] = useState<ModerationDraft | null>(null)
  const [moderationMessage, setModerationMessage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const mapCardRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const [browserFullscreen, setBrowserFullscreen] = useState(false)
  const [layoutFullscreen, setLayoutFullscreen] = useState(false)

  const expanded = browserFullscreen || layoutFullscreen
  const stateCode = selectedFarm?.stateCode ?? ''

  useEffect(() => {
    setMounted(true)
  }, [])

  const closeModal = useCallback(() => {
    if (submitting) return
    setShowReportForm(false)
    setSelectedLocation(null)
    setFormData(initialFormData)
    setFormMessage(null)
  }, [submitting])

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
    if (!layoutFullscreen && !browserFullscreen && !showReportForm && !moderationDraft) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [layoutFullscreen, browserFullscreen, moderationDraft, showReportForm])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (moderationDraft) {
          setModerationDraft(null)
          setModerationMessage(null)
        } else if (showReportForm) closeModal()
        else if (expanded) void exitAllFullscreen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal, expanded, exitAllFullscreen, moderationDraft, showReportForm])

  useEffect(() => {
    return () => {
      document.body.style.removeProperty('overflow')
      void exitDocumentFullscreen()
    }
  }, [])

  const handleMapClick = (lat: number, lng: number) => {
    if (!currentUserId || !selectedFarm || !stateCode) return
    const clampedLat = Math.max(24.39, Math.min(49.38, lat))
    const clampedLng = Math.max(-125, Math.min(-66.93, lng))

    setSelectedLocation({ lat: clampedLat, lng: clampedLng })
    setFormData({
      ...initialFormData,
      crop: selectedFarm.crops[0] ?? '',
    })
    setFormMessage(null)
    setShowReportForm(true)
  }

  const handleSubmitReport = async () => {
    if (!onReportSubmit || !selectedLocation || !stateCode) return
    if (!formData.crop || !formData.issueType) {
      setFormMessage({ type: 'error', text: 'Add the crop and trouble reported.' })
      return
    }
    if (formData.description.length > 700) {
      setFormMessage({ type: 'error', text: 'Keep notes under 700 characters.' })
      return
    }
    if (formData.photoFile && !formData.sharePhoto) {
      setFormMessage({ type: 'error', text: 'Check the photo sharing box before adding a shared photo.' })
      return
    }

    setSubmitting(true)
    setFormMessage(null)
    try {
      await onReportSubmit({
        crop: formData.crop as CreateCropTroubleReportInput['crop'],
        issueType: formData.issueType,
        severity: formData.severity,
        description: formData.description,
        location: {
          lat: roundApprox(selectedLocation.lat),
          lng: roundApprox(selectedLocation.lng),
          stateCode: stateCode as CreateCropTroubleReportInput['location']['stateCode'],
          generalArea: stateCode,
          precision: 'approximate',
        },
        photoShared: formData.sharePhoto && Boolean(formData.photoFile),
        photoFile: formData.sharePhoto ? formData.photoFile : null,
      })
      setFormMessage({ type: 'success', text: 'Report shared with nearby farmers.' })
      window.setTimeout(closeModal, 900)
    } catch (error) {
      setFormMessage({ type: 'error', text: friendlyError(error) })
    } finally {
      setSubmitting(false)
    }
  }

  const runReportAction = async (reportId: string, action: () => Promise<void>, doneMessage?: string) => {
    setBusyReportId(reportId)
    try {
      await action()
      if (doneMessage) setFormMessage({ type: 'success', text: doneMessage })
      return true
    } catch {
      setFormMessage({ type: 'error', text: 'Could not update that report right now.' })
      return false
    } finally {
      setBusyReportId(null)
    }
  }

  const handleSubmitModerationReport = async () => {
    if (!moderationDraft || !onReportPost) return

    setModerationMessage(null)
    setBusyReportId(moderationDraft.report.id)
    try {
      await onReportPost(moderationDraft.report.id, moderationDraft.reason, moderationDraft.summary)
      setFormMessage({ type: 'success', text: 'Thanks. We will review it.' })
      setModerationDraft(null)
    } catch {
      setModerationMessage('Could not submit that report right now.')
    } finally {
      setBusyReportId(null)
    }
  }

  return (
    <div className="relative w-full space-y-5">
      <div
        ref={mapCardRef}
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-field-soil/10 bg-white shadow-sm ${
          layoutFullscreen
            ? 'fixed inset-0 z-[5000] h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-none rounded-none border-slate-300 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
            : ''
        } ${expanded ? 'h-full min-h-0' : ''}`}
      >
        <div className={`relative flex w-full min-h-0 flex-col ${expanded ? 'h-full min-h-0 flex-1' : ''}`}>
          <div
            className={`relative min-h-0 w-full overflow-hidden ${
              expanded ? 'min-h-0 flex-1' : 'h-[min(52dvh,560px)] min-h-[280px] sm:min-h-[420px]'
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
                {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-field-soil/10 bg-field-cream px-3 py-2.5 sm:px-4 sm:py-3">
            <MapPin className="h-4 w-4 shrink-0 text-primary-700" />
            <p className="text-xs font-semibold leading-snug text-primary-900 sm:text-sm">
              Tap the map where you are seeing crop trouble. Shared reports use only a general area.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-field-soil/10 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-primary-900">Nearby Crop Trouble</h3>
          </div>
          {loadingReports && <Loader2 className="h-5 w-5 animate-spin text-primary-700" aria-label="Loading reports" />}
        </div>

        {reportsError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
            {reportsError}
          </div>
        )}

        {formMessage && !showReportForm && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
              formMessage.type === 'success'
                ? 'border-leaf/30 bg-green-50 text-green-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {formMessage.text}
          </div>
        )}

        {reports.length === 0 && !loadingReports ? (
          <div className="rounded-xl border border-dashed border-field-soil/20 bg-field-cream px-4 py-8 text-center text-sm font-semibold text-field-soil">
            No nearby reports yet. Share what you see to help other farms.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {reports.map((report) => {
              const isOwner = report.userId === currentUserId
              const busy = busyReportId === report.id
              return (
                <article key={report.id} className="rounded-xl border border-field-soil/10 bg-field-cream p-4">
                  {report.photoShared && report.photoUrl && (
                    <div className="mb-3 overflow-hidden rounded-lg border border-field-soil/10 bg-white">
                      <Image
                        src={report.photoUrl}
                        alt={`${report.crop} trouble report`}
                        width={640}
                        height={360}
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-field-soil">Crop</p>
                      <h4 className="text-base font-bold text-primary-950">{report.crop}</h4>
                    </div>
                    <span className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-bold text-ink">
                      {formatStatus(report.status)}
                    </span>
                  </div>

                  <dl className="mt-3 grid gap-2 text-sm">
                    <div>
                      <dt className="font-bold text-primary-900">Trouble reported</dt>
                      <dd className="text-field-soil">{report.issueType}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="font-bold text-primary-900">Severity</dt>
                        <dd className="text-field-soil">{formatSeverity(report.severity)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-primary-900">Time reported</dt>
                        <dd className="text-field-soil">{reportAge(report.createdAt)}</dd>
                      </div>
                    </div>
                    <div>
                      <dt className="font-bold text-primary-900">General area</dt>
                      <dd className="text-field-soil">{report.location.generalArea}</dd>
                    </div>
                  </dl>

                  {report.description && (
                    <div className="mt-3">
                      <p className="mb-2 text-sm font-bold text-primary-900">Notes</p>
                      <p className="rounded-lg bg-white/70 p-3 text-sm leading-6 text-ink-soft">
                        {report.description}
                      </p>
                    </div>
                  )}

                  {isOwner ? (
                    <div className="mt-4">
                      {confirmingDeleteReportId === report.id ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-sm font-bold text-rose-950">Delete this alert?</p>
                          <p className="mt-1 text-sm text-rose-900">This removes the alert for everyone.</p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setConfirmingDeleteReportId(null)}
                              className="btn-secondary justify-center bg-white px-3 py-2 text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                if (!onDeleteReport) return
                                const succeeded = await runReportAction(report.id, () => onDeleteReport(report.id), 'Alert deleted.')
                                if (succeeded) setConfirmingDeleteReportId(null)
                              }}
                              className="btn-primary justify-center px-3 py-2 text-sm"
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmingDeleteReportId(report.id)}
                          className="btn-secondary bg-white px-3 py-2 text-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete alert
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onSeeingToo &&
                          void runReportAction(report.id, () => onSeeingToo(report.id), 'Thanks. We counted it.')
                        }
                        className="btn-secondary bg-white px-3 py-2 text-sm"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                        Seeing this too ({report.seeingTooCount})
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setModerationMessage(null)
                          setModerationDraft({ report, reason: 'false_or_misleading', summary: '' })
                        }}
                        className="btn-secondary bg-white px-3 py-2 text-sm"
                      >
                        <Flag className="h-4 w-4" />
                        Report
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {mounted && showReportForm && createPortal(
        <div className="fixed inset-0 z-[90000] flex items-center justify-center p-3 sm:p-4">
          <button
            type="button"
            aria-label="Close report form"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-crop-trouble-title"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-field-soil/10 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-field-soil/10 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 id="report-crop-trouble-title" className="flex items-center gap-2 text-xl font-bold text-primary-950">
                  <span className="rounded-lg bg-field-wheat/40 p-2">
                    <AlertTriangle className="h-5 w-5 text-field-soil" />
                  </span>
                  Report crop trouble
                </h2>
                <p className="mt-2 text-sm leading-5 text-field-soil">
                  Share only a general area. Names, emails, and exact farm addresses are not shown.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-full p-2 text-field-soil transition hover:bg-field-cream hover:text-primary-900 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {selectedLocation && (
                <div className="rounded-xl border border-primary-100 bg-primary-50 p-3 text-sm text-primary-900">
                  Map spot saved as an approximate area near {roundApprox(selectedLocation.lat).toFixed(1)},{' '}
                  {roundApprox(selectedLocation.lng).toFixed(1)}.
                </div>
              )}

              {formMessage && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                    formMessage.type === 'success'
                      ? 'border-leaf/30 bg-green-50 text-green-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  {formMessage.text}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900">Crop</label>
                <div className="relative">
                  <select
                    value={formData.crop}
                    onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                    className="field-input h-12 appearance-none py-0 pl-4 pr-11 leading-tight"
                  >
                    <option value="">Choose crop</option>
                    {(selectedFarm?.crops ?? []).map((crop) => (
                      <option key={crop} value={crop}>
                        {crop}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-field-soil" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900">Trouble reported</label>
                <input
                  type="text"
                  value={formData.issueType}
                  onChange={(e) => setFormData({ ...formData, issueType: e.target.value.slice(0, 120) })}
                  placeholder="Rust, blight, yellow leaves"
                  className="field-input py-2.5"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900">Severity</label>
                <div className="relative">
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as ReportSeverity })}
                    className="field-input h-12 appearance-none py-0 pl-4 pr-11 leading-tight"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-field-soil" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900">Notes</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 700) })}
                  placeholder="Add details about the affected area and when you noticed it."
                  rows={4}
                  className="field-input resize-none py-2.5"
                />
                <p className="mt-1 text-xs font-semibold text-field-soil">{formData.description.length}/700</p>
              </div>

              <div className="rounded-xl border border-field-soil/10 bg-field-cream p-3">
                <label className="flex items-start gap-3 text-sm font-semibold text-primary-900">
                  <input
                    type="checkbox"
                    checked={formData.sharePhoto}
                    onChange={(e) => setFormData({ ...formData, sharePhoto: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-field-soil/30"
                  />
                  Share the photo with other signed-in users
                </label>
                <label className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm">
                  <Camera className="h-4 w-4" />
                  {formData.photoFile ? formData.photoFile.name : 'Choose photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => setFormData({ ...formData, photoFile: e.target.files?.[0] ?? null })}
                  />
                </label>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-field-soil/10 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:px-5">
              <button type="button" onClick={closeModal} disabled={submitting} className="btn-secondary w-full sm:w-auto">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitReport()}
                disabled={submitting}
                className="btn-primary w-full sm:flex-1"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {submitting ? 'Sharing...' : 'Share report'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && moderationDraft && createPortal(
        <div className="fixed inset-0 z-[90000] flex items-center justify-center p-3 sm:p-4">
          <button
            type="button"
            aria-label="Close report dialog"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (busyReportId === moderationDraft.report.id) return
              setModerationDraft(null)
              setModerationMessage(null)
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-report-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-field-soil/10 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-field-soil/10 px-4 py-4 sm:px-5">
              <div>
                <h2 id="moderation-report-title" className="text-xl font-bold text-primary-950">Report alert</h2>
                <p className="mt-2 text-sm leading-5 text-field-soil">Tell us what needs review. Your report is stored for moderation.</p>
              </div>
              <button
                type="button"
                disabled={busyReportId === moderationDraft.report.id}
                onClick={() => {
                  setModerationDraft(null)
                  setModerationMessage(null)
                }}
                className="rounded-full p-2 text-field-soil transition hover:bg-field-cream hover:text-primary-900 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5">
              {moderationMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                  {moderationMessage}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900">Reason</label>
                <div className="grid gap-2">
                  {CROP_TROUBLE_REPORT_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                        moderationDraft.reason === reason
                          ? 'border-ink bg-ink text-white'
                          : 'border-field-soil/10 bg-field-cream text-ink hover:bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="moderation-reason"
                        value={reason}
                        checked={moderationDraft.reason === reason}
                        onChange={() => setModerationDraft({ ...moderationDraft, reason })}
                        className="sr-only"
                      />
                      {reportReasonLabels[reason]}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900">Summary optional</label>
                <textarea
                  value={moderationDraft.summary}
                  onChange={(event) => setModerationDraft({ ...moderationDraft, summary: event.target.value.slice(0, 280) })}
                  placeholder="Add context for the review team."
                  rows={3}
                  className="field-input resize-none py-2.5"
                />
                <p className="mt-1 text-xs font-semibold text-field-soil">{moderationDraft.summary.length}/280</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-field-soil/10 bg-white px-4 py-3 sm:flex-row sm:px-5">
              <button
                type="button"
                disabled={busyReportId === moderationDraft.report.id}
                onClick={() => {
                  setModerationDraft(null)
                  setModerationMessage(null)
                }}
                className="btn-secondary w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyReportId === moderationDraft.report.id}
                onClick={() => void handleSubmitModerationReport()}
                className="btn-primary w-full sm:flex-1"
              >
                {busyReportId === moderationDraft.report.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Flag className="h-5 w-5" />}
                Submit report
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
