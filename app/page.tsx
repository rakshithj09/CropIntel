'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ArrowRight, Loader2 } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import CropSelector from '@/components/CropSelector'
import StateSelector from '@/components/StateSelector'
import PredictionResults from '@/components/PredictionResults'
import PredictionHistory from '@/components/PredictionHistory'
import Diagnosis from '@/components/Diagnosis'
import ExportResults from '@/components/ExportResults'
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
  const [analysisMode, setAnalysisMode] = useState<'single' | 'compare'>('single')
  const [farmerProfile, setFarmerProfile] = useState<StoredFarmerProfile | null>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'diagnose' | 'history' | 'alerts'>('diagnose')
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
      ? `Showing labels common for ${selectedCrop} in ${selectedState}.`
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

  const handleSaveCurrentResult = () => {
    if (!prediction || !imageUrl) return
    const confidencePercent =
      typeof prediction.confidence === 'number' && prediction.confidence <= 1
        ? prediction.confidence * 100
        : prediction.confidence
    savePredictionToHistory(selectedCrop, prediction.disease, confidencePercent, imageUrl)
  }

  return (
    <main className="min-h-screen min-h-[100dvh] bg-[#F1F6EF] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#1F2A1F] sm:px-6">
      <header className="-mx-4 border-b border-[#DDE6D8] bg-[#F1F6EF]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveView('diagnose')}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#2F6B3F]">
              <Image
                src="/brand/wheat-mark-transparent.png"
                alt="CropIntel"
                width={23}
                height={46}
                className="object-contain opacity-95"
                priority
              />
            </span>
            <span className="truncate text-lg font-semibold text-[#1F2A1F]">CropIntel</span>
          </button>

          <nav className="flex shrink-0 items-center gap-1 text-[15px] font-medium text-[#6B7168] sm:gap-2 sm:text-base">
            {[
              { id: 'diagnose', label: 'Diagnose' },
              { id: 'history', label: 'History' },
              { id: 'alerts', label: 'Alerts' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id as 'diagnose' | 'history' | 'alerts')}
                className={`min-h-11 rounded-lg px-3 transition-colors sm:px-4 ${
                  activeView === item.id
                    ? 'text-[#1F2A1F]'
                    : 'hover:bg-white hover:text-[#1F2A1F]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {activeView === 'diagnose' && (
        <div className="mx-auto max-w-[640px] py-8 sm:py-12">
          <section className="mb-6 text-center">
            <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#1F2A1F] sm:text-[32px]">
              Diagnose crop issue
            </h1>
            <p className="mt-2 text-[15px] leading-6 text-[#6B7168] sm:text-base">
              Take or upload a clear leaf photo.
            </p>
          </section>

          <section className="rounded-2xl border border-[#E2E4DD] bg-white p-5 shadow-sm sm:p-7">
            <div className="space-y-5">
              <CropSelector
                crops={Object.keys(CROPS)}
                selectedCrop={selectedCrop}
                onCropChange={setSelectedCrop}
              />
              <StateSelector selectedState={selectedState} onStateChange={setSelectedState} />

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F2A1F]">
                  Mode
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#CFE0C9] bg-[#E7F0E3] p-1">
                  {[
                    { id: 'single', label: 'Single photo' },
                    { id: 'compare', label: 'Compare photos' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setAnalysisMode(mode.id as 'single' | 'compare')
                        setError(null)
                        setPrediction(null)
                      }}
                      className={`min-h-[44px] rounded-lg px-3 text-sm font-semibold transition-colors ${
                        analysisMode === mode.id
                          ? 'bg-[#2F6B3F] text-white shadow-sm'
                          : 'text-[#2F6B3F] hover:bg-white/70 hover:text-[#285A35]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {analysisMode === 'single' ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1F2A1F]">
                      Add leaf photo
                    </label>
                    <ImageUpload
                      selectedImage={selectedImage}
                      onImageSelect={handleImageSelect}
                      onClear={handleClear}
                      title="Take a clear photo of one leaf."
                      hint=""
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePredict}
                    disabled={!selectedCrop || !selectedState || !selectedImage || loading}
                    className="flex min-h-[52px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#2F6B3F] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#285A35] disabled:cursor-not-allowed disabled:bg-[#B8BDB4] disabled:text-white"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {loading ? 'Analyzing...' : 'Analyze leaf'}
                  </button>

                  <details className="text-sm text-[#6B7168]">
                    <summary className="w-fit cursor-pointer rounded-lg px-1 py-1 font-medium text-[#2F6B3F] hover:text-[#285A35]">
                      Photo tips
                    </summary>
                    <ul className="mt-2 grid gap-1.5 rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] p-3">
                      {['Use one leaf', 'Keep it in focus', 'Use natural light', 'Avoid shadows'].map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <HealthComparisonPanel crop={selectedCrop} applyRegionalFilter={applyRegionalFilter} />
              )}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
                  <div className="text-sm font-semibold">Something went wrong</div>
                  <div className="mt-1 text-sm">{error}</div>
                </div>
              )}
            </div>
          </section>

          {analysisMode === 'single' && prediction && (
            <section className="mt-6 space-y-4">
              <PredictionResults prediction={prediction} crop={selectedCrop} regionNote={regionNote} />
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
              <ExportResults prediction={prediction} crop={selectedCrop} imageUrl={imageUrl} />
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleSaveCurrentResult}
                  disabled={!prediction || !imageUrl}
                  className="min-h-[48px] rounded-xl border border-[#E2E4DD] bg-white px-4 py-3 text-sm font-semibold text-[#1F2A1F] transition-colors hover:bg-[#F6F7F5] disabled:cursor-not-allowed disabled:text-[#9CA39A]"
                >
                  Save result
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="min-h-[48px] rounded-xl bg-[#2F6B3F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#285A35]"
                >
                  Analyze another leaf
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {activeView === 'history' && (
        <section className="mx-auto max-w-4xl py-8 sm:py-12">
          <PredictionHistory onSelectHistory={handleHistorySelect} />
        </section>
      )}

      {activeView === 'alerts' && (
        <section className="mx-auto max-w-5xl py-8 sm:py-12">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1F2A1F]">Area alerts</h1>
              <p className="mt-1 text-sm text-[#6B7168]">Track and report nearby crop disease outbreaks.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {farmerProfile && <FarmerVerificationBadge verified={farmerProfile.verifiedFarmer} />}
              <FarmerRegistration onRegister={handleFarmerRegister} crops={Object.keys(CROPS)} />
            </div>
          </div>
          <div className="rounded-2xl border border-[#E2E4DD] bg-white p-3 shadow-sm sm:p-5">
            <USOutbreakMap
              reports={outbreakReports}
              onReportSubmit={handleOutbreakReport}
              reporterVerified={farmerProfile?.verifiedFarmer ?? false}
            />
          </div>
        </section>
      )}
    </main>
  )
}
