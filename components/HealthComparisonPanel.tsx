'use client'

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { ArrowLeftRight, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import {
  compareHealth,
  trendLabel,
  trendDetail,
  type HealthTrend,
  type HealthComparison,
} from '@/lib/healthComparison'
import type { PredictionPayload } from '@/lib/stateDiseaseMap'

type Props = {
  crop: string
  applyRegionalFilter: (raw: PredictionPayload) => PredictionPayload
}

interface PredictResult {
  payload: PredictionPayload
  crop_mismatch: boolean
  suggested_crop: string | null
}

async function runPredict(file: File, crop: string): Promise<PredictResult> {
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
    payload: {
      disease: data.disease,
      confidence: data.confidence,
      is_healthy: data.is_healthy,
      meets_threshold: data.meets_threshold,
      all_predictions: data.all_predictions,
    },
    crop_mismatch: !!data.crop_mismatch,
    suggested_crop: data.suggested_crop ?? null,
  }
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function trendStyles(t: HealthTrend) {
  switch (t) {
    case 'improving':
      return {
        border: 'border-primary-300',
        bg: 'bg-primary-50',
        text: 'text-primary-900',
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
  // Scored from the RAW (unfiltered) distributions so the health estimate stays
  // region-independent; the cards still display the region-consistent label.
  const [comparison, setComparison] = useState<HealthComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPastSelect = (file: File | null) => {
    setPastFile(file)
    setPastUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
    setPastPred(null)
    setComparison(null)
  }

  const onCurrentSelect = (file: File | null) => {
    setCurrentFile(file)
    setCurrentUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
    setCurrentPred(null)
    setComparison(null)
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
    setComparison(null)
    try {
      const [past, current] = await Promise.all([
        runPredict(pastFile, crop),
        runPredict(currentFile, crop),
      ])
      // If a photo isn't this crop, comparing diagnoses is meaningless.
      const wrong = past.crop_mismatch ? past : current.crop_mismatch ? current : null
      if (wrong) {
        const which = past.crop_mismatch ? 'earlier' : "today's"
        setError(
          wrong.suggested_crop
            ? `The ${which} photo looks more like a ${cap(wrong.suggested_crop)} leaf, not ${cap(crop)}. Use two ${cap(crop)} photos to compare.`
            : `The ${which} photo doesn't look like a ${cap(crop)} leaf. Use two clear ${cap(crop)} photos to compare.`,
        )
        return
      }
      // Score from the raw distributions (full softmax, incl. Healthy); display
      // the regionally-filtered label.
      setComparison(compareHealth(past.payload, current.payload, crop))
      setPastPred(applyRegionalFilter(past.payload))
      setCurrentPred(applyRegionalFilter(current.payload))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const trend = comparison?.trend ?? null
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

      {pastPred && currentPred && comparison && trend && ts && (
        <div className="mt-8 space-y-6">
          <div
            className={`flex flex-col gap-4 rounded-2xl border px-6 py-5 sm:flex-row sm:items-center ${ts.border} ${ts.bg}`}
          >
            <ts.Icon className={`h-10 w-10 shrink-0 ${ts.text}`} />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className={`text-xs font-semibold uppercase tracking-wide ${ts.text} opacity-80`}>Comparison</p>
              <p className={`text-2xl font-bold ${ts.text}`}>
                {trendLabel(trend)}
                {comparison.delta !== 0 && (
                  <span className="ml-2 align-middle text-base font-semibold tabular-nums opacity-80">
                    {comparison.delta > 0 ? '+' : ''}
                    {comparison.delta} pts
                  </span>
                )}
              </p>
              <p className="mt-1 max-w-md text-sm text-slate-600">{trendDetail(comparison)}</p>
            </div>
            {/* Health score read-out: earlier → today */}
            <div className="flex items-center justify-center gap-3 sm:flex-col sm:items-end sm:gap-1">
              <span className="text-sm tabular-nums text-slate-500">
                {comparison.pastScore}
                <span className="mx-1">→</span>
                <span className={`text-lg font-bold ${ts.text}`}>{comparison.currentScore}</span>
                <span className="ml-1 text-xs text-slate-400">/100 health</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ComparisonCard label="Earlier" imageUrl={pastUrl} prediction={pastPred} score={comparison.pastScore} accent="border-slate-200" />
            <ComparisonCard label="Today" imageUrl={currentUrl} prediction={currentPred} score={comparison.currentScore} accent="border-primary-200" />
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
  score,
  accent,
}: {
  label: string
  imageUrl: string | null
  prediction: PredictionPayload
  score: number
  accent: string
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${accent}`}>
      <div className="flex items-center justify-between border-b border-field-soil/10 bg-field-cream px-4 py-2">
        <span className="text-sm font-bold text-slate-800">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-500">
          Health {score}/100
        </span>
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
