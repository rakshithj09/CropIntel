'use client'

import { useState } from 'react'
import { ArrowLeftRight, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react'
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

function toPercent(value: number) {
  if (value > 0 && value <= 1) return value * 100
  return value
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
        border: 'border-[#E2E4DD]',
        bg: 'bg-[#F6F7F5]',
        text: 'text-[#1F2A1F]',
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

  const handleCompare = async () => {
    if (!pastFile || !currentFile) {
      setError('Please add both photos.')
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
      const message = e instanceof Error ? e.message : 'Comparison failed'
      setError(message)
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
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-[#1F2A1F]">
          <ArrowLeftRight className="h-5 w-5 text-[#2F6B3F]" />
          Compare leaf photos
        </h3>
        <p className="mt-1 text-sm text-[#6B7168]">Add an older photo and a current photo.</p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div>
          <p className="mb-2 text-sm font-medium text-[#1F2A1F]">Past photo</p>
          <ImageUpload
            selectedImage={pastFile}
            onImageSelect={onPastSelect}
            onClear={() => onPastSelect(null)}
            title="Add the older leaf photo."
            hint=""
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-[#1F2A1F]">Current photo</p>
          <ImageUpload
            selectedImage={currentFile}
            onImageSelect={onCurrentSelect}
            onClear={() => onCurrentSelect(null)}
            title="Add the current leaf photo."
            hint=""
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleCompare}
        disabled={!pastFile || !currentFile || loading}
        className="inline-flex min-h-[52px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#2F6B3F] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#285A35] disabled:cursor-not-allowed disabled:bg-[#B8BDB4]"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
        {loading ? 'Comparing...' : 'Compare photos'}
      </button>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      )}

      {pastPred && currentPred && trend && ts && (
        <div className="space-y-5">
          <div className={`flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-5 sm:flex-row ${ts.border} ${ts.bg}`}>
            <ts.Icon className={`h-10 w-10 shrink-0 ${ts.text}`} />
            <div className="text-center sm:text-left">
              <p className={`text-xs font-semibold uppercase tracking-wide ${ts.text} opacity-80`}>Comparison</p>
              <p className={`text-2xl font-bold ${ts.text}`}>{trendLabel(trend)}</p>
              <p className="mt-1 max-w-md text-sm text-[#6B7168]">Based on the two photo checks.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ComparisonCard label="Past" imageUrl={pastUrl} prediction={pastPred} accent="border-[#E2E4DD]" />
            <ComparisonCard label="Current" imageUrl={currentUrl} prediction={currentPred} accent="border-[#DDE6D8]" />
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
      <div className="border-b border-[#E2E4DD] bg-[#F6F7F5] px-4 py-2">
        <span className="text-sm font-bold text-[#1F2A1F]">{label}</span>
      </div>
      {imageUrl && (
        <div className="flex h-44 w-full items-center justify-center bg-[#F6F7F5] p-2">
          <img src={imageUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
      <div className="p-4">
        <p className="text-xs font-semibold uppercase text-[#6B7168]">Prediction</p>
        <p className="mt-0.5 text-lg font-semibold text-[#1F2A1F]">{prediction.disease}</p>
        <p className="mt-2 text-sm font-semibold tabular-nums text-[#2F6B3F]">
          Confidence {typeof prediction.confidence === 'number' ? toPercent(prediction.confidence).toFixed(0) : '-'}%
        </p>
      </div>
    </div>
  )
}
