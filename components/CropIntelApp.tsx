'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Camera, ArrowLeftRight } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import CropSelector from '@/components/CropSelector'
import FarmSelector from '@/components/FarmSelector'
import PredictionResults from '@/components/PredictionResults'
import PredictionHistory, { savePredictionToHistory, type PredictionRecord } from '@/components/PredictionHistory'
import ExportResults from '@/components/ExportResults'
import Diagnosis from '@/components/Diagnosis'
import NotificationSystem from '@/components/NotificationSystem'
import HealthComparisonPanel from '@/components/HealthComparisonPanel'
import AccountMenu from '@/components/AccountMenu'
import type { OutbreakReport, ReportStatus } from '@/lib/outbreakReport'
import {
  applyRegionalPrior,
  getRelevantDiseasesForCropState,
  normalizePredictionPayload,
  type PredictionPayload,
} from '@/lib/stateDiseaseMap'
import { subscribeToAuth } from '@/src/lib/auth'
import { getUserFarms, saveDiagnosis } from '@/src/lib/farms'
import {
  createCropTroubleReport,
  flagCropTroubleReport,
  getNearbyCropTroubleReports,
  markSeeingToo,
  updateCropTroubleReportStatus,
  type CreateCropTroubleReportInput,
} from '@/src/lib/cropTroubleReports'
import type { Farm } from '@/src/lib/types'
import type { User } from 'firebase/auth'

const USOutbreakMap = dynamic(() => import('@/components/USOutbreakMap'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 sm:min-h-[420px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary-700" aria-label="Loading map" />
    </div>
  ),
})

type MainView = 'diagnose' | 'history' | 'outbreaks'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePredictionResponse(value: unknown): PredictionPayload {
  if (!isPlainRecord(value)) {
    throw new Error('Prediction response was malformed.')
  }

  const allPredictions = value.all_predictions
  if (
    typeof value.disease !== 'string' ||
    typeof value.confidence !== 'number' ||
    typeof value.is_healthy !== 'boolean' ||
    typeof value.meets_threshold !== 'boolean' ||
    !Array.isArray(allPredictions)
  ) {
    throw new Error('Prediction response was malformed.')
  }

  const parsedPredictions = allPredictions.map((prediction) => {
    if (
      !isPlainRecord(prediction) ||
      typeof prediction.disease !== 'string' ||
      typeof prediction.confidence !== 'number'
    ) {
      throw new Error('Prediction response was malformed.')
    }

    return {
      disease: prediction.disease,
      confidence: prediction.confidence,
    }
  })

  return {
    disease: value.disease,
    confidence: value.confidence,
    is_healthy: value.is_healthy,
    meets_threshold: value.meets_threshold,
    all_predictions: parsedPredictions,
    not_in_catalog: typeof value.not_in_catalog === 'boolean' ? value.not_in_catalog : undefined,
    catalog_message: typeof value.catalog_message === 'string' ? value.catalog_message : undefined,
  }
}

async function getPredictionErrorMessage(response: Response) {
  try {
    const payload: unknown = await response.json()
    if (isPlainRecord(payload) && typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error
    }
  } catch {
    // The status code is still useful when the body is empty or not JSON.
  }

  return 'Prediction failed'
}

function fileToHistoryImageUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const source = typeof reader.result === 'string' ? reader.result : ''
      if (!source) {
        reject(new Error('Could not read the selected image.'))
        return
      }

      const image = new window.Image()
      image.onload = () => {
        const maxSize = 640
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')
        if (!context) {
          resolve(source)
          return
        }

        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.onerror = () => resolve(source)
      image.src = source
    }
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.readAsDataURL(file)
  })
}

export default function CropIntelApp({ initialView = 'diagnose' }: { initialView?: MainView }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [farmsLoading, setFarmsLoading] = useState(true)
  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedCrop, setSelectedCrop] = useState('')
  const [photoMode, setPhotoMode] = useState<'single' | 'compare'>('single')
  const [prediction, setPrediction] = useState<PredictionPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [activeView] = useState<MainView>(initialView)
  const [outbreakReports, setOutbreakReports] = useState<OutbreakReport[]>([])
  const [outbreaksLoading, setOutbreaksLoading] = useState(false)
  const [outbreaksError, setOutbreaksError] = useState<string | null>(null)
  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? null
  const selectedFarmStateCode = selectedFarm?.stateCode ?? ''
  const availableCrops = useMemo(() => selectedFarm?.crops ?? [], [selectedFarm])
  const hasSelectedCrop = selectedFarm !== null && availableCrops.includes(selectedCrop)
  const farmLocation =
    selectedFarm && typeof selectedFarm.lat === 'number' && typeof selectedFarm.lng === 'number'
      ? { lat: selectedFarm.lat, lng: selectedFarm.lng, crops: selectedFarm.crops }
      : null

  // Hide decorative background when scrolled to the very top.
  const [showBackground, setShowBackground] = useState(false)
  // Track whether the page has been scrolled a bit (used to toggle nav styling)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      // show decorative background when scrolled any amount
      setShowBackground(window.scrollY > 0)
      // mark "scrolled" once user has moved a small amount (threshold = 12px)
      setScrolled(window.scrollY > 12)
    }
    // initialize based on current scroll position (useful if page wasn't loaded at top)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    return subscribeToAuth(
      async (currentUser) => {
        if (!currentUser) {
          router.replace('/login')
          return
        }

        setUser(currentUser)
        setAuthLoading(false)
        setFarmsLoading(true)
        try {
          const userFarms = await getUserFarms(currentUser.uid)
          if (userFarms.length === 0) {
            router.replace('/onboarding')
            return
          }
          setFarms(userFarms)
          setSelectedFarmId((current) =>
            userFarms.some((farm) => farm.id === current) ? current : activeView === 'outbreaks' ? userFarms[0].id : ''
          )
        } catch (err: unknown) {
          setStartupError(getErrorMessage(err, 'Could not load your farm data.'))
        } finally {
          setFarmsLoading(false)
        }
      },
      (err) => {
        setStartupError(err.message)
        setAuthLoading(false)
        setFarmsLoading(false)
      }
    )
  }, [activeView, router])

  const applyRegionalFilter = useCallback(
    (raw: PredictionPayload) =>
      hasSelectedCrop && selectedFarm ? applyRegionalPrior(raw, selectedCrop, selectedFarm.stateCode) : raw,
    [hasSelectedCrop, selectedCrop, selectedFarm]
  )

  const regionNote =
    hasSelectedCrop && selectedFarm && getRelevantDiseasesForCropState(selectedCrop, selectedFarm.stateCode) !== null
      ? `Regional adjustment: results are gently nudged toward diseases common for ${selectedCrop} at ${selectedFarm.name} (${selectedFarm.stateCode}). Other states or crops show the model's raw output.`
      : undefined

  const handleFarmChange = (farmId: string) => {
    setSelectedFarmId(farmId)
    setSelectedCrop('')
    setPrediction(null)
    setError(null)
  }

  const handleCropChange = (crop: string) => {
    setSelectedCrop(crop)
    setPrediction(null)
    setError(null)
  }

  const handlePredict = async () => {
    if (!user) {
      router.replace('/login')
      return
    }

    if (!selectedFarm) {
      setError('Select a farm before running disease detection.')
      return
    }

    if (!hasSelectedCrop) {
      setError(`Select a crop grown on ${selectedFarm.name} before running disease detection.`)
      return
    }

    if (!selectedImage) {
      setError('Please select an image first')
      return
    }

    setLoading(true)
    setError(null)
    setPrediction(null)

    try {
      const formData = new FormData()
      formData.append('image', selectedImage)
      formData.append('crop', selectedCrop)
      const idToken = await user.getIdToken()

      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await getPredictionErrorMessage(response))
      }

      const rawPayload = parsePredictionResponse(await response.json())
      const filtered = applyRegionalFilter(rawPayload)
      const merged = normalizePredictionPayload({ ...rawPayload, ...filtered })
      setPrediction(merged)

      // Save to history
      if (imageUrl) {
        const confidencePercent =
          typeof merged.confidence === 'number' && merged.confidence <= 1
            ? merged.confidence * 100
            : merged.confidence
        savePredictionToHistory(selectedCrop, merged.disease, confidencePercent, imageUrl, selectedFarm, merged)
      }

      await saveDiagnosis({
        userId: user.uid,
        farmId: selectedFarm.id,
        crop: selectedCrop,
        disease: merged.disease,
        confidence:
          typeof merged.confidence === 'number' && merged.confidence <= 1
            ? merged.confidence * 100
            : merged.confidence,
      })
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'An error occurred'))
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setSelectedImage(null)
    setPrediction(null)
    setError(null)
    setImageUrl(null)
  }

  const handleImageSelect = async (file: File | null) => {
    setSelectedImage(file)
    if (file) {
      setImageUrl(null)
      try {
        setImageUrl(await fileToHistoryImageUrl(file))
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Could not read the selected image.'))
      }
    } else {
      setImageUrl(null)
    }
  }

  const handleHistorySelect = (record: PredictionRecord) => {
    // Load image from history
    setImageUrl(record.imageUrl)
    setSelectedCrop(record.crop)
    // Note: We can't reload the File object from URL, but we can show the prediction
    // In a real app, you might want to store more data in history
  }

  const loadNearbyReports = useCallback(async () => {
    if (!selectedFarmStateCode) {
      setOutbreakReports([])
      return
    }

    setOutbreaksLoading(true)
    setOutbreaksError(null)
    try {
      setOutbreakReports(await getNearbyCropTroubleReports(selectedFarmStateCode))
    } catch {
      setOutbreaksError('Could not load nearby reports right now.')
    } finally {
      setOutbreaksLoading(false)
    }
  }, [selectedFarmStateCode])

  useEffect(() => {
    if (activeView !== 'outbreaks') return
    void loadNearbyReports()
  }, [activeView, loadNearbyReports])

  const handleOutbreakReport = async (input: Omit<CreateCropTroubleReportInput, 'userId' | 'farmId'>) => {
    if (!user) {
      router.replace('/login')
      return
    }
    await createCropTroubleReport({
      ...input,
      userId: user.uid,
      farmId: selectedFarm?.id ?? null,
    })
    await loadNearbyReports()
  }

  const handleSeeingToo = async (reportId: string) => {
    if (!user) {
      router.replace('/login')
      return
    }
    await markSeeingToo(reportId, user.uid)
    await loadNearbyReports()
  }

  const handleFlagReport = async (reportId: string) => {
    if (!user) {
      router.replace('/login')
      return
    }
    await flagCropTroubleReport(reportId, user.uid)
  }

  const handleReportStatusUpdate = async (reportId: string, status: Exclude<ReportStatus, 'new'>) => {
    await updateCropTroubleReportStatus(reportId, status)
    await loadNearbyReports()
  }

  if (authLoading || farmsLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/70 bg-surface/70 px-6 py-5 text-center shadow-sm backdrop-blur">
          <Loader2 className="h-8 w-8 animate-spin text-primary-700" aria-label="Loading" />
          <p className="text-sm font-semibold text-ink-soft">Loading your account...</p>
        </div>
      </main>
    )
  }

  if (startupError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
          <h1 className="text-xl font-bold">CropIntel could not start</h1>
          <p className="mt-3 text-sm leading-6">{startupError}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="cropintel-shell relative min-h-screen min-h-[100dvh] overflow-hidden px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-24 sm:pt-28">
      <div
        aria-hidden={!showBackground}
        className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-300 ${
          showBackground ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="blob bg-grad-1" style={{ width: 560, height: 560, top: -140, left: -100 }} />
        <div className="blob bg-grad-2" style={{ width: 480, height: 480, top: 40, right: -120, opacity: 0.5 }} />
        <div className="blob bg-grad-3" style={{ width: 420, height: 420, bottom: -160, left: '35%', opacity: 0.45 }} />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 px-4 py-3">
        <nav
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-3 transition-all duration-300 ${
            scrolled ? 'glass' : 'border border-transparent'
          }`}
        >
            <button
              type="button"
              onClick={() => router.push('/diagnosis')}
              className="cropintel-brand flex min-w-0 items-center gap-2 text-left"
            >
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
            </button>

            <div className="hidden items-center gap-8 md:flex">
              {(
                [
                  { id: 'diagnose', label: 'Diagnosis', href: '/diagnosis' },
                  { id: 'history', label: 'Saved checks', href: '/saved-checks' },
                  { id: 'outbreaks', label: 'Local risk', href: '/local-risk' },
                  { id: 'farms', label: 'Farms', href: '/farms' },
                ] as const
              ).map(({ id, label, href }) => (
                <Link
                  key={id}
                  href={href}
                  className={`cropintel-menu-link font-mono text-sm font-medium transition-colors ${
                    activeView === id ? 'text-ink' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
              <AccountMenu user={user} />
              <div className="relative z-50">
                <NotificationSystem outbreaks={outbreakReports} currentFarmerLocation={farmLocation || undefined} />
              </div>
            </div>
        </nav>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6 grid grid-cols-4 gap-2 rounded-full border border-white/70 bg-surface/60 p-1.5 shadow-sm backdrop-blur md:hidden">
          {(
            [
              { id: 'diagnose', label: 'Diagnosis', href: '/diagnosis' },
              { id: 'history', label: 'Saved checks', href: '/saved-checks' },
              { id: 'outbreaks', label: 'Local risk', href: '/local-risk' },
              { id: 'farms', label: 'Farms', href: '/farms' },
            ] as const
          ).map(({ id, label, href }) => (
            <Link
              key={id}
              href={href}
              className={`touch-manipulation font-mono flex min-h-[40px] items-center justify-center rounded-full px-2 py-2 text-center text-[11px] font-semibold transition-all sm:text-sm ${
                activeView === id
                  ? 'bg-ink text-white shadow-sm'
                  : 'text-ink-soft hover:bg-white/70 hover:text-ink'
              }`}
            >
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>

        {activeView === 'diagnose' && (
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-6">
              <section className="surface rounded-2xl p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-bold text-primary-900">Check this crop</h2>
                    <p className="mt-1 text-sm text-field-soil">Use a sharp, well-lit photo of the leaf or damaged area.</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPhotoMode('single')}
                    className={`touch-manipulation min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-all ${
                      photoMode === 'single'
                        ? 'border-ink bg-ink text-white shadow-sm'
                        : 'border-ink/10 bg-surface/70 text-ink hover:border-leaf/30 hover:bg-white'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    One photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoMode('compare')}
                    className={`touch-manipulation min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-all ${
                      photoMode === 'compare'
                        ? 'border-ink bg-ink text-white shadow-sm'
                        : 'border-ink/10 bg-surface/70 text-ink hover:border-leaf/30 hover:bg-white'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Compare field change
                  </button>
                </div>

                <div className="mt-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FarmSelector
                      farms={farms}
                      selectedFarmId={selectedFarmId}
                      onFarmChange={handleFarmChange}
                      loading={farmsLoading}
                    />
                    <CropSelector crops={availableCrops} selectedCrop={selectedCrop} onCropChange={handleCropChange} />
                  </div>

                  {photoMode === 'single' && (
                    <>
                      <ImageUpload
                        selectedImage={selectedImage}
                        onImageSelect={handleImageSelect}
                        onClear={handleClear}
                        onError={setError}
                      />
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handlePredict}
                          disabled={!selectedImage || !hasSelectedCrop || loading}
                          className="btn-primary w-full"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                          {loading ? 'Checking photo...' : 'Check crop health'}
                        </button>
                      </div>
                    </>
                  )}

                  {photoMode === 'compare' && (
                    hasSelectedCrop ? (
                      <HealthComparisonPanel crop={selectedCrop} applyRegionalFilter={applyRegionalFilter} />
                    ) : (
                      <div className="rounded-xl border border-dashed border-field-soil/20 bg-field-cream px-4 py-5 text-sm font-semibold text-field-soil">
                        Select a farm and crop before comparing field photos.
                      </div>
                    )
                  )}

                  {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
                      <div className="text-sm font-semibold">Something went wrong</div>
                      <div className="text-sm mt-1">{error}</div>
                    </div>
                  )}

                  {photoMode === 'single' && prediction && (
                    <>
                      <PredictionResults prediction={prediction} regionNote={regionNote} />
                      <Diagnosis
                        disease={prediction.disease}
                        crop={selectedCrop}
                        isHealthy={prediction.is_healthy}
                      />
                      <ExportResults prediction={prediction} crop={selectedCrop} imageUrl={imageUrl} />
                    </>
                  )}
                </div>
              </section>
            </div>

          </div>
        )}

        {activeView === 'history' && (
          <section className="surface rounded-2xl p-4 sm:p-6">
            <PredictionHistory onSelectHistory={handleHistorySelect} />
          </section>
        )}

        {activeView === 'outbreaks' && (
          <section className="surface rounded-2xl p-4 sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-primary-900">Nearby crop issues</h2>
              <p className="mt-1 text-sm leading-6 text-field-soil">
                Tap a field area to report what you are seeing and help nearby farms spot risk earlier.
              </p>
            </div>
            <div className="-mx-1 rounded-xl border border-field-soil/10 bg-field-cream p-2 sm:mx-0 sm:p-4">
              <USOutbreakMap
                reports={outbreakReports}
                currentUserId={user?.uid ?? ''}
                selectedFarm={selectedFarm}
                loadingReports={outbreaksLoading}
                reportsError={outbreaksError}
                onReportSubmit={handleOutbreakReport}
                onSeeingToo={handleSeeingToo}
                onReportPost={handleFlagReport}
                onStatusUpdate={handleReportStatusUpdate}
              />
            </div>
          </section>
        )}

        <footer className="mt-10 mb-6 border-t border-field-soil/10 pt-5 text-center text-field-soil" />
      </div>
    </main>
  )
}
