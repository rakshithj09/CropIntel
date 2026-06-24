'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { MapPin, Sparkles, History as HistoryIcon, ArrowRight, Loader2, Camera, ArrowLeftRight } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import CropSelector from '@/components/CropSelector'
import StateSelector from '@/components/StateSelector'
import PredictionResults from '@/components/PredictionResults'
import DiseaseInfo from '@/components/DiseaseInfo'
import PredictionHistory from '@/components/PredictionHistory'
import ExportResults from '@/components/ExportResults'
import TipsAndGuidelines from '@/components/TipsAndGuidelines'
import Diagnosis from '@/components/Diagnosis'
import NotificationSystem from '@/components/NotificationSystem'
import FarmerRegistration from '@/components/FarmerRegistration'
import FarmerVerificationBadge from '@/components/FarmerVerificationBadge'
import HealthComparisonPanel from '@/components/HealthComparisonPanel'
import { savePredictionToHistory } from '@/components/PredictionHistory'
import { CROPS } from '@/lib/crops'
import type { OutbreakReport } from '@/lib/outbreakReport'
import { loadFarmerProfile, saveFarmerProfile, type StoredFarmerProfile } from '@/lib/farmerProfile'
import {
  applyStateDiseaseFilter,
  getRelevantDiseasesForCropState,
  type PredictionPayload,
} from '@/lib/stateDiseaseMap'

const USOutbreakMap = dynamic(() => import('@/components/USOutbreakMap'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 sm:min-h-[420px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary-700" aria-label="Loading map" />
    </div>
  ),
})

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedCrop, setSelectedCrop] = useState<string>('corn')
  const [selectedState, setSelectedState] = useState<string>('IA')
  const [photoMode, setPhotoMode] = useState<'single' | 'compare'>('single')
  const [farmerProfile, setFarmerProfile] = useState<StoredFarmerProfile | null>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'diagnose' | 'history' | 'outbreaks'>('diagnose')
  // Nav is transparent at the top, frosts to glass on scroll — same as the marketing site.
  const [scrolled, setScrolled] = useState(false)
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
      reporterVerified: false,
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
      reporterVerified: false,
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
  const [farmerLocation, setFarmerLocation] = useState<{ lat: number; lng: number; crops: string[] } | null>(null)

  useEffect(() => {
    const p = loadFarmerProfile()
    if (p) {
      setFarmerProfile(p)
      setFarmerLocation({ lat: p.lat, lng: p.lng, crops: p.crops })
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const applyRegionalFilter = useCallback(
    (raw: PredictionPayload) => applyStateDiseaseFilter(raw, selectedCrop, selectedState),
    [selectedCrop, selectedState]
  )

  const regionNote =
    getRelevantDiseasesForCropState(selectedCrop, selectedState) !== null
      ? `Using common ${selectedCrop} disease patterns for ${selectedState}. If this does not match what you see, check the other possible matches below.`
      : undefined

  const handlePredict = async () => {
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
      const merged = { ...data, ...filtered }
      setPrediction(merged)

      // Save to history
      if (imageUrl) {
        const confidencePercent =
          typeof merged.confidence === 'number' && merged.confidence <= 1
            ? merged.confidence * 100
            : merged.confidence
        savePredictionToHistory(selectedCrop, merged.disease, confidencePercent, imageUrl)
      }
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

  const handleImageSelect = (file: File | null) => {
    setSelectedImage(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setImageUrl(url)
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

  const handleFarmerRegister = (location: {
    lat: number
    lng: number
    crops: string[]
    name: string
    email?: string
    usdaFarmCode?: string
    verifiedFarmer: boolean
  }) => {
    const profile: StoredFarmerProfile = {
      name: location.name,
      email: location.email,
      lat: location.lat,
      lng: location.lng,
      crops: location.crops,
      usdaFarmCode: location.usdaFarmCode,
      verifiedFarmer: location.verifiedFarmer,
    }
    saveFarmerProfile(profile)
    setFarmerProfile(profile)
    setFarmerLocation({
      lat: location.lat,
      lng: location.lng,
      crops: location.crops,
    })
    alert(
      `"${location.name}" is saved. CropIntel will watch for reported crop issues within 250 miles.${
        location.verifiedFarmer ? ' This farm is marked as verified.' : ''
      }`
    )
  }

  return (
    <main className="min-h-screen min-h-[100dvh] px-3 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5">
      <div className="mx-auto max-w-7xl">
        {/* Top bar — floating frosted pill, identical to the marketing site nav:
            transparent at the top, frosts to glass once scrolled. */}
        <header className="sticky top-0 z-40 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <nav
            className={`flex items-center justify-between gap-3 rounded-full px-5 py-3 transition-all duration-300 ${
              scrolled ? 'glass' : 'border border-transparent'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveView('diagnose')}
              className="flex min-w-0 items-center gap-2"
              aria-label="CropIntel home"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-500">
                <Image
                  src="/brand/wheat-mark-transparent.png"
                  alt="CropIntel"
                  width={16}
                  height={32}
                  className="h-5 w-auto object-contain"
                  priority
                />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight text-field-bark">
                CropIntel
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('diagnose')}
                className="btn-primary hidden !min-h-0 rounded-full !px-4 !py-2 text-sm sm:inline-flex"
              >
                Check crop
              </button>
              <div className="hidden sm:block">
                <FarmerRegistration onRegister={handleFarmerRegister} crops={Object.keys(CROPS)} />
              </div>
              <NotificationSystem outbreaks={outbreakReports} currentFarmerLocation={farmerLocation || undefined} />
            </div>
          </nav>
        </header>

        {/* Views */}
        <div className="mb-5 mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-field-soil/10 bg-white/70 p-1.5 shadow-sm sm:mb-6 sm:mt-7 sm:inline-grid">
          {(
            [
              { id: 'diagnose', label: 'Diagnosis', icon: Sparkles },
              { id: 'history', label: 'Saved checks', icon: HistoryIcon },
              { id: 'outbreaks', label: 'Local risk', icon: MapPin },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={`touch-manipulation min-h-[44px] rounded-xl px-2 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeView === id
                  ? 'bg-primary-700 text-white shadow-sm'
                  : 'text-primary-900 hover:bg-primary-50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
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
                    className={`touch-manipulation min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-all ${
                      photoMode === 'single'
                        ? 'border-primary-700 bg-primary-700 text-white shadow-sm'
                        : 'border-field-soil/20 bg-white text-primary-900 hover:border-primary-300 hover:bg-primary-50'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    One photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoMode('compare')}
                    className={`touch-manipulation min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-all ${
                      photoMode === 'compare'
                        ? 'border-primary-700 bg-primary-700 text-white shadow-sm'
                        : 'border-field-soil/20 bg-white text-primary-900 hover:border-primary-300 hover:bg-primary-50'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Compare field change
                  </button>
                </div>

                <div className="mt-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CropSelector crops={Object.keys(CROPS)} selectedCrop={selectedCrop} onCropChange={setSelectedCrop} />
                    <StateSelector selectedState={selectedState} onStateChange={setSelectedState} />
                  </div>

                  {photoMode === 'single' && (
                    <>
                      <ImageUpload selectedImage={selectedImage} onImageSelect={handleImageSelect} onClear={handleClear} />
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handlePredict}
                          disabled={!selectedImage || loading}
                          className="btn-primary w-full md:max-w-md"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                          {loading ? 'Checking photo...' : 'Check crop health'}
                        </button>
                      </div>
                    </>
                  )}

                  {photoMode === 'compare' && (
                    <HealthComparisonPanel crop={selectedCrop} applyRegionalFilter={applyRegionalFilter} />
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
                        confidence={
                          typeof prediction.confidence === 'number' && prediction.confidence <= 1
                            ? prediction.confidence * 100
                            : prediction.confidence
                        }
                        isHealthy={prediction.is_healthy}
                      />
                      <DiseaseInfo diseaseName={prediction.disease} crop={selectedCrop} />
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
                  Save your farm location to see crop issue alerts reported within 250 miles.
                </p>
                <div className="mt-4 sm:hidden space-y-3">
                  {farmerProfile && (
                    <FarmerVerificationBadge verified={farmerProfile.verifiedFarmer} />
                  )}
                  <FarmerRegistration onRegister={handleFarmerRegister} crops={Object.keys(CROPS)} />
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
                reporterVerified={farmerProfile?.verifiedFarmer ?? false}
              />
            </div>
          </section>
        )}

        <footer className="mt-10 mb-6 border-t border-field-soil/10 pt-5 text-center text-field-soil">
          <p className="text-xs">Models: EfficientNet / TensorFlow Lite</p>
        </footer>
      </div>
    </main>
  )
}
