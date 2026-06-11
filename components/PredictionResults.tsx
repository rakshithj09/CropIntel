'use client'

import { AlertTriangle, BarChart3, CheckCircle2 } from 'lucide-react'
import { getDiseaseInfo } from '@/lib/diseaseInfo'

interface Prediction {
  disease: string
  confidence: number
  is_healthy: boolean
  meets_threshold: boolean
  not_in_catalog?: boolean
  catalog_message?: string
  all_predictions: Array<{
    disease: string
    confidence: number
  }>
}

interface PredictionResultsProps {
  prediction: Prediction
  crop: string
  regionNote?: string
}

function toConfidencePercent(value: number): number {
  if (value > 0 && value <= 1) return value * 100
  return value
}

export default function PredictionResults({
  prediction,
  crop,
  regionNote,
}: PredictionResultsProps) {
  const confidence = Math.min(100, Math.max(0, toConfidencePercent(prediction.confidence)))
  const diseaseInfo = getDiseaseInfo(prediction.disease, crop)
  const severity = prediction.is_healthy ? 'Low' : diseaseInfo?.severity ? diseaseInfo.severity[0].toUpperCase() + diseaseInfo.severity.slice(1) : 'Review'

  const status = prediction.not_in_catalog
    ? {
        label: 'Needs a closer look',
        className: 'border-amber-200 bg-amber-50 text-amber-900',
        icon: AlertTriangle,
      }
    : prediction.is_healthy
      ? {
          label: 'Looks healthy',
          className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
          icon: CheckCircle2,
        }
      : prediction.meets_threshold
        ? {
            label: 'Likely disease',
            className: 'border-rose-200 bg-rose-50 text-rose-900',
            icon: AlertTriangle,
          }
        : {
            label: 'Low confidence',
            className: 'border-amber-200 bg-amber-50 text-amber-900',
            icon: AlertTriangle,
          }

  const StatusIcon = status.icon

  return (
    <div className="rounded-2xl border border-[#E2E4DD] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#6B7168]">Diagnosis result</p>
          <h2 className="mt-1 text-2xl font-bold leading-tight text-[#1F2A1F]">
            {prediction.disease}
          </h2>
        </div>
        <div
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${status.className}`}
        >
          <StatusIcon className="h-4 w-4" />
          {status.label}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] p-4">
          <p className="text-sm font-medium text-[#6B7168]">Confidence</p>
          <p className="mt-1 text-2xl font-bold text-[#1F2A1F]">{confidence.toFixed(0)}%</p>
        </div>
        <div className="rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] p-4">
          <p className="text-sm font-medium text-[#6B7168]">Severity</p>
          <p className="mt-1 text-2xl font-bold text-[#1F2A1F]">{severity}</p>
        </div>
      </div>

      <div className="mt-4">
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E2E4DD]">
            <div
              className="h-full rounded-full bg-[#2F6B3F] transition-all duration-500"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
        {regionNote && (
          <p className="mt-3 rounded-lg border border-[#E2E4DD] bg-[#F6F7F5] px-3 py-2 text-sm text-[#6B7168]">
            {regionNote}
          </p>
        )}
      </div>

      {prediction.not_in_catalog && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {prediction.catalog_message ||
            'This photo does not clearly match a disease in the current catalog. Use the possible matches below as a guide only.'}
        </div>
      )}

      <details className="mt-4 rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2F6B3F]">
          <BarChart3 className="h-4 w-4" />
          Similar diseases
        </summary>
        <div className="mt-4 space-y-3">
          {prediction.all_predictions.map((pred) => {
            const pct = Math.min(100, Math.max(0, toConfidencePercent(pred.confidence)))
            return (
              <div key={pred.disease} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
                <p className="text-sm font-medium text-[#1F2A1F]">{pred.disease}</p>
                <div className="flex items-center gap-3">
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#E2E4DD]">
                    <div className="h-full rounded-full bg-[#2F6B3F]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-14 text-right text-sm font-semibold tabular-nums text-[#6B7168]">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}
