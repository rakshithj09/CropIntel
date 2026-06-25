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
import PredictionHistory from '@/components/PredictionHistory'
import ExportResults from '@/components/ExportResults'
import TipsAndGuidelines from '@/components/TipsAndGuidelines'
import Diagnosis from '@/components/Diagnosis'
import NotificationSystem from '@/components/NotificationSystem'
import HealthComparisonPanel from '@/components/HealthComparisonPanel'
import { savePredictionToHistory } from '@/components/PredictionHistory'
import type { OutbreakReport } from '@/lib/outbreakReport'
import {
  applyRegionalPrior,
  getRelevantDiseasesForCropState,
  normalizePredictionPayload,
  type PredictionPayload,
} from '@/lib/stateDiseaseMap'
import { subscribeToAuth, signOutUser } from '@/src/lib/auth'
import { getUserFarms, saveDiagnosis } from '@/src/lib/farms'
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
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [activeView] = useState<MainView>(initialView)
  // Initialize with a sample outbreak in Russellville, Arkansas
  const [outbreakReports, setOutbreakReports] = useState<OutbreakReport[]>([
    {
      id: 'russellville-outbreak-1',
      lat: 35.2784,
      lng: -93.1338,
      crop: 'corn',
      disease: 'Common Rust',
      severity: 'high',
      date: new Date().toISOString(),
      description: 'Severe rust outbreak detected in corn fields. Multiple farms affected in the area.',
    },
    {
      id: 'high-severity-130-miles',
      lat: 33.6234, // Exactly 130 miles south of farmer-1 (35.5, -93.2)
      lng: -93.2,
      crop: 'corn',
      disease: 'Southern Corn Leaf Blight',
      severity: 'high',
      date: new Date().toISOString(),
      description: 'CRITICAL: Severe southern corn leaf blight outbreak detected. Immediate action required. Multiple farms at risk within 150-mile radius.',
    },
    {
      id: 'california-outbreak-1',
      lat: 36.7783,
      lng: -119.4179,
      crop: 'wheat',
      disease: 'Leaf Rust',
      severity: 'high',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Widespread leaf rust detected in wheat fields across Central Valley.',
    },
    {
      id: 'texas-outbreak-1',
      lat: 31.9686,
      lng: -99.9018,
      crop: 'corn',
      disease: 'Gray Leaf Spot',
      severity: 'medium',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Gray leaf spot spreading in corn crops. Farmers advised to monitor closely.',
    },
    {
      id: 'iowa-outbreak-1',
      lat: 41.8780,
      lng: -93.0977,
      crop: 'soybean',
      disease: 'Powdery Mildew',
      severity: 'medium',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Powdery mildew detected in soybean fields. Early treatment recommended.',
    },
    {
      id: 'illinois-outbreak-1',
      lat: 40.3495,
      lng: -88.9861,
      crop: 'corn',
      disease: 'Common Rust',
      severity: 'low',
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Minor rust outbreak in isolated corn fields. Monitoring in progress.',
    },
    {
      id: 'kansas-outbreak-1',
      lat: 38.5729,
      lng: -98.3833,
      crop: 'wheat',
      disease: 'Stripe Rust',
      severity: 'high',
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Severe stripe rust outbreak affecting wheat crops. Immediate action required.',
    },
    {
      id: 'nebraska-outbreak-1',
      lat: 41.4925,
      lng: -99.9018,
      crop: 'corn',
      disease: 'Northern Corn Leaf Blight',
      severity: 'medium',
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Northern corn leaf blight detected. Fungicide application recommended.',
    },
    {
      id: 'minnesota-outbreak-1',
      lat: 46.7296,
      lng: -94.6859,
      crop: 'soybean',
      disease: 'Bacterial Blight',
      severity: 'low',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Bacterial blight found in soybean fields. Isolated cases reported.',
    },
    {
      id: 'north-carolina-outbreak-1',
      lat: 35.2271,
      lng: -80.8431,
      crop: 'corn',
      disease: 'Southern Corn Leaf Blight',
      severity: 'high',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Severe southern corn leaf blight outbreak. Multiple counties affected.',
    },
    {
      id: 'missouri-outbreak-1',
      lat: 38.5729,
      lng: -92.1893,
      crop: 'soybean',
      disease: 'Sudden Death Syndrome',
      severity: 'medium',
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Sudden death syndrome detected in soybean crops. Root health monitoring advised.',
    },
    {
      id: 'indiana-outbreak-1',
      lat: 39.7684,
      lng: -86.1581,
      crop: 'corn',
      disease: 'Common Rust',
      severity: 'low',
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Minor rust spots detected. Early stage monitoring.',
    },
    {
      id: 'ohio-outbreak-1',
      lat: 40.3888,
      lng: -82.7649,
      crop: 'corn',
      disease: 'Gray Leaf Spot',
      severity: 'medium',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Gray leaf spot spreading in corn fields. Weather conditions favorable for spread.',
    },
  ])
  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) ?? null
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
          setSelectedFarmId((current) => (userFarms.some((farm) => farm.id === current) ? current : ''))
        } catch (err: any) {
          setStartupError(err.message || 'Could not load your farm data.')
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
  }, [router])

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

      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Prediction failed')
      }

      const data = await response.json()
      const rawPayload: PredictionPayload = {
        disease: data.disease,
        confidence: data.confidence,
        is_healthy: data.is_healthy,
        meets_threshold: data.meets_threshold,
        all_predictions: data.all_predictions,
      }
      const filtered = applyRegionalFilter(rawPayload)
      const merged = normalizePredictionPayload({ ...data, ...filtered })
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
    } catch (err: any) {
      setError(err.message || 'An error occurred')
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
      } catch (err: any) {
        setError(err.message || 'Could not read the selected image.')
      }
    } else {
      setImageUrl(null)
    }
  }

  const handleHistorySelect = (record: any) => {
    // Load image from history
    setImageUrl(record.imageUrl)
    setSelectedCrop(record.crop)
    // Note: We can't reload the File object from URL, but we can show the prediction
    // In a real app, you might want to store more data in history
  }

  const handleOutbreakReport = (report: OutbreakReport) => {
    setOutbreakReports([...outbreakReports, report])
  }

  const handleSignOut = async () => {
    await signOutUser()
    router.replace('/login')
  }

  if (authLoading || farmsLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-700" aria-label="Loading" />
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
              <button type="button" onClick={handleSignOut} className="btn-secondary px-4 py-2 text-sm">
                Sign out
              </button>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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
                      <ImageUpload selectedImage={selectedImage} onImageSelect={handleImageSelect} onClear={handleClear} />
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handlePredict}
                          disabled={!selectedImage || !hasSelectedCrop || loading}
                          className="btn-primary w-full md:max-w-md"
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

            <aside className="lg:col-span-1 space-y-6">
              <TipsAndGuidelines />

              <div className="surface rounded-2xl p-4 sm:p-6">
                <h3 className="text-base font-bold text-primary-900">Watch my area</h3>
                <p className="mt-1 text-sm leading-6 text-field-soil">
                  Farm location from Firestore powers crop issue alerts within 250 miles.
                </p>
                <div className="mt-4 sm:hidden space-y-3">
                  <Link href="/farms" className="btn-secondary w-full">
                    Manage farms
                  </Link>
                </div>
              </div>
            </aside>
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
                onReportSubmit={handleOutbreakReport}
              />
            </div>
          </section>
        )}

        <footer className="mt-10 mb-6 border-t border-field-soil/10 pt-5 text-center text-field-soil">
          <p className="cropintel-footer-pill mb-5 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface/60 px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
            Models: EfficientNet / TensorFlow Lite
          </p>
        </footer>
      </div>
    </main>
  )
}
