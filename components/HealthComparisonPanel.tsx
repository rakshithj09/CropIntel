'use client'

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { ArrowLeftRight, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import { compareHealthTrend, trendLabel, type HealthTrend } from '@/lib/healthComparison'
import type { PredictionPayload } from '@/lib/stateDiseaseMap'

type Props = {
  crop: string
  applyRegionalFilter: (raw: PredictionPayload) => PredictionPayload
}

async function runPredict(file: File, crop: string): Promise<PredictionPayload> {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('crop', crop)
  const response = await fetch('/api/predict', { method: 'POST', body: formData })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Prediction failed')
  }
  const data = await response.json()
  return {
    disease: data.disease,
    confidence: data.confidence,
    is_healthy: data.is_healthy,
    meets_threshold: data.meets_threshold,
    all_predictions: data.all_predictions,
  }
}

function trendStyles(t: HealthTrend) {
  switch (t) {
    case 'improving':
      return {
        border: 'border-emerald-300',
        bg: 'bg-emerald-50',
        text: 'text-emerald-900',
        Icon: TrendingUp,
      }
    case 'worsening':
      return {
        border: 'border-rose-300',
        bg: 'bg-rose-50',
        text: 'text-rose-900',
        Icon: TrendingDown,
      }
    default:
      return {
        border: 'border-slate-300',
        bg: 'bg-slate-50',
        text: 'text-slate-800',
        Icon: Minus,
      }
  }
}

export default function HealthComparisonPanel({ crop, applyRegionalFilter }: Props) {
  const [pastFile, setPastFile] = useState<File | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [pastUrl, setPastUrl] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [pastPred, setPastPred] = useState<PredictionPayload | null>(null)
  const [currentPred, setCurrentPred] = useState<PredictionPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPastSelect = (file: File | null) => {
    setPastFile(file)
    setPastUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
    setPastPred(null)
  }

  const onCurrentSelect = (file: File | null) => {
    setCurrentFile(file)
    setCurrentUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
    setCurrentPred(null)
  }

  const clearPast = () => onPastSelect(null)
  const clearCurrent = () => onCurrentSelect(null)

  const handleCompare = async () => {
    if (!pastFile || !currentFile) {
      setError('Please upload both a past and a current photo.')
      return
    }
    setLoading(true)
    setError(null)
    setPastPred(null)
    setCurrentPred(null)
    try {
      const [rawPast, rawCurrent] = await Promise.all([
        runPredict(pastFile, crop),
        runPredict(currentFile, crop),
      ])
      setPastPred(applyRegionalFilter(rawPast))
      setCurrentPred(applyRegionalFilter(rawCurrent))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const trend =
    pastPred && currentPred
      ? compareHealthTrend(
          { disease: pastPred.disease, crop, is_healthy: pastPred.is_healthy },
          { disease: currentPred.disease, crop, is_healthy: currentPred.is_healthy }
        )
      : null

  const ts = trend ? trendStyles(trend) : null

  return (
    <div className="mt-8 border-t border-field-soil/10 pt-8">
      <h3 className="flex items-center gap-2 text-base font-bold text-primary-900">
        <ArrowLeftRight className="w-5 h-5 text-primary-700" />
        Compare field change
      </h3>
      <p className="mb-5 mt-1 text-sm leading-6 text-field-soil">
        Add an older photo and a current photo from the same crop to see whether the issue appears to be improving or spreading.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Earlier photo</p>
          <ImageUpload
            selectedImage={pastFile}
            onImageSelect={onPastSelect}
            onClear={clearPast}
            title="Earlier field photo"
            hint="Use a previous photo from this crop or field."
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Today&apos;s photo</p>
          <ImageUpload
            selectedImage={currentFile}
            onImageSelect={onCurrentSelect}
            onClear={clearCurrent}
            title="Today&apos;s field photo"
            hint="Use the newest photo from the same crop."
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleCompare}
        disabled={!pastFile || !currentFile || loading}
        className="btn-primary mt-6 w-full px-6 md:w-auto"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
        {loading ? 'Checking both photos...' : 'Compare field change'}
      </button>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      )}

      {pastPred && currentPred && trend && ts && (
        <div className="mt-8 space-y-6">
          <div
            className={`flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-5 sm:flex-row ${ts.border} ${ts.bg}`}
          >
            <ts.Icon className={`w-10 h-10 shrink-0 ${ts.text}`} />
            <div className="text-center sm:text-left">
              <p className={`text-xs font-semibold uppercase tracking-wide ${ts.text} opacity-80`}>Comparison</p>
              <p className={`text-2xl font-bold ${ts.text}`}>{trendLabel(trend)}</p>
              <p className="text-sm text-slate-600 mt-1 max-w-md">
                Based on the two photo checks. Scout the field before making treatment decisions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComparisonCard label="Past" imageUrl={pastUrl} prediction={pastPred} accent="border-slate-200" />
            <ComparisonCard label="Current" imageUrl={currentUrl} prediction={currentPred} accent="border-primary-200" />
          </div>
        </div>
      )}
    </div>
  )
}

function ComparisonCard({
  label,
  imageUrl,
  prediction,
  accent,
}: {
  label: string
  imageUrl: string | null
  prediction: PredictionPayload
  accent: string
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${accent}`}>
      <div className="border-b border-field-soil/10 bg-field-cream px-4 py-2">
        <span className="text-sm font-bold text-slate-800">{label}</span>
      </div>
      {imageUrl && (
        <div className="h-44 w-full bg-slate-100 flex items-center justify-center p-2">
          <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
        </div>
      )}
      <div className="p-4">
        <p className="text-xs text-slate-500 uppercase font-semibold">Likely issue</p>
        <p className="text-lg font-semibold text-slate-900 mt-0.5">{prediction.disease}</p>
        <p className="text-sm text-primary-800 font-semibold mt-2 tabular-nums">
          Match {typeof prediction.confidence === 'number' ? prediction.confidence.toFixed(1) : '—'}%
        </p>
      </div>
    </div>
  )
}
