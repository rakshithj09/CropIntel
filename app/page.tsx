'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Bell, MapPin, Sparkles, History as HistoryIcon, ArrowRight, Loader2, Camera, ArrowLeftRight } from 'lucide-react'
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

  const applyRegionalFilter = useCallback(
    (raw: PredictionPayload) => applyStateDiseaseFilter(raw, selectedCrop, selectedState),
    [selectedCrop, selectedState]
  )

  const regionNote =
    getRelevantDiseasesForCropState(selectedCrop, selectedState) !== null
      ? `Regional filter: showing labels common for ${selectedCrop} in ${selectedState} (illustrative). Other states or crops may show all labels.`
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
      `Farm "${location.name}" registered! You'll now receive alerts for outbreaks within 250 miles.${
        location.verifiedFarmer ? ' You are marked as a Verified farmer.' : ''
      }`
    )
  }

  return (
    <main className="min-h-screen min-h-[100dvh] px-3 sm:px-4 py-4 sm:py-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-7xl">
        {/* Top bar */}
        <header className="sticky top-0 z-40 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 border-b border-slate-200/60 bg-white/95">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-white flex items-center justify-center shadow-sm overflow-hidden">
                <Image
                  src="/brand/wheat-mark-transparent.png"
                  alt="CropIntel"
                  width={22}
                  height={44}
                  className="opacity-95 object-contain drop-shadow-[0_1px_0_rgba(0,0,0,0.08)]"
                  priority
                />
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">CropIntel</div>
                <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">Crop health insights</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 justify-end">
              {farmerProfile && (
                <FarmerVerificationBadge verified={farmerProfile.verifiedFarmer} compact />
              )}
              <button
                type="button"
                onClick={() => setActiveView('diagnose')}
                className="hidden items-center gap-2 rounded-xl bg-primary-700 px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-primary-800 sm:flex"
              >
                Diagnose
              </button>
              <div className="hidden sm:block">
                <FarmerRegistration onRegister={handleFarmerRegister} crops={Object.keys(CROPS)} />
              </div>
              <div className="relative z-50">
                <NotificationSystem outbreaks={outbreakReports} currentFarmerLocation={farmerLocation || undefined} />
              </div>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-5 sm:mt-8 mb-5 sm:mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-slate-900 tracking-tight text-balance">
                Diagnose crop issues from a photo
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                Upload a leaf image, pick the crop, and get a ranked set of labels with confidence.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 rounded-xl border border-slate-200 bg-white/80 text-sm text-slate-700 flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary-700" />
                Outbreak alerts
              </div>
            </div>
          </div>
        </section>

        {/* Views */}
        <div className="grid grid-cols-3 gap-2 mb-5 sm:mb-6 sm:flex sm:flex-wrap sm:items-center">
          {(
            [
              { id: 'diagnose', label: 'Diagnose', icon: Sparkles },
              { id: 'history', label: 'History', icon: HistoryIcon },
              { id: 'outbreaks', label: 'Outbreaks', icon: MapPin },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={`touch-manipulation min-h-[44px] px-2 sm:px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeView === id
                  ? 'bg-primary-700 text-white border-primary-700'
                  : 'bg-white/70 text-slate-700 border-slate-200 hover:bg-white hover:border-primary-300'
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
                    <h2 className="text-base font-semibold text-slate-900">Photo analysis</h2>
                    <p className="text-sm text-slate-600 mt-1">Best results with a sharp, well-lit close-up.</p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Step <span className="font-semibold text-slate-700">1</span> of 3
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPhotoMode('single')}
                    className={`touch-manipulation min-h-[44px] px-4 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all ${
                      photoMode === 'single'
                        ? 'bg-primary-700 text-white border-primary-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-primary-300'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    Single photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoMode('compare')}
                    className={`touch-manipulation min-h-[44px] px-4 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all ${
                      photoMode === 'compare'
                        ? 'bg-primary-700 text-white border-primary-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-primary-300'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Past vs current
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
                          className="touch-manipulation min-h-[48px] w-full md:max-w-md inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-700 text-white font-semibold shadow-sm hover:bg-primary-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                          {loading ? 'Analyzing…' : 'Run analysis'}
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
                <h3 className="text-base font-semibold text-slate-900">Alerts</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Register a farm location to receive outbreak notifications within 250 miles.
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
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">Outbreak map</h2>
              <p className="text-sm text-slate-600 mt-1">
                Tap or click to report a potential outbreak and help track disease spread.
              </p>
            </div>
            <div className="bg-white rounded-xl p-2 sm:p-4 border border-slate-200 -mx-1 sm:mx-0">
              <USOutbreakMap
                reports={outbreakReports}
                onReportSubmit={handleOutbreakReport}
                reporterVerified={farmerProfile?.verifiedFarmer ?? false}
              />
            </div>
          </section>
        )}

        <footer className="text-center mt-10 mb-6 text-slate-500">
          <p className="text-xs">Models: EfficientNet / TensorFlow Lite</p>
        </footer>
      </div>
    </main>
  )
}
