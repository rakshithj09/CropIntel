'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Prediction {
  disease: string
  confidence: number
  is_healthy: boolean
  meets_threshold: boolean
  /** True when the model can't confidently match any disease in our catalog. */
  not_in_catalog?: boolean
  /** Farmer-facing explanation shown when not_in_catalog is true. */
  catalog_message?: string
  all_predictions: Array<{
    disease: string
    confidence: number
  }>
}

interface PredictionResultsProps {
  prediction: Prediction
  /** Shown when regional disease filter was applied */
  regionNote?: string
}

/** Model may send 0–1 or 0–100; UI always shows percent to one decimal. */
function toConfidencePercent(value: number): number {
  if (value > 0 && value <= 1) return value * 100
  return value
}

export default function PredictionResults({
  prediction,
  regionNote,
}: PredictionResultsProps) {
  const getStatusColor = () => {
    if (prediction.not_in_catalog) {
      return 'bg-amber-50 text-amber-900 border-amber-200'
    }
    if (prediction.is_healthy) {
      return 'bg-emerald-50 text-emerald-900 border-emerald-200'
    }
    if (prediction.meets_threshold) {
      return 'bg-rose-50 text-rose-900 border-rose-200'
    }
    return 'bg-amber-50 text-amber-900 border-amber-200'
  }

  const getStatusText = () => {
    if (prediction.not_in_catalog) {
      return 'No match in catalog'
    }
    if (prediction.is_healthy) {
      return 'Healthy'
    }
    if (prediction.meets_threshold) {
      return 'Disease detected'
    }
    return 'Low confidence'
  }

  return (
    <div className="mt-8 p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900 mb-5 flex items-center gap-2">
        <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Results
      </h2>
      {regionNote && (
        <p className="text-xs text-slate-600 mb-4 -mt-2 px-1 py-2 rounded-lg bg-sky-50 border border-sky-100">
          {regionNote}
        </p>
      )}

      {/* Main Result */}
      <div className="rounded-xl p-5 mb-6 border border-slate-200 bg-slate-50/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Top label
            </h3>
            <p className="text-2xl font-semibold text-slate-900 mt-1">
              {prediction.disease}
            </p>
          </div>
          <div className="text-right">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Confidence
            </h3>
            <p className="text-2xl font-semibold text-primary-700 mt-1 tabular-nums">
              {Math.min(100, Math.max(0, toConfidencePercent(prediction.confidence))).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border font-semibold text-sm ${getStatusColor()}`}
        >
          {prediction.is_healthy ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {getStatusText()}
        </div>
      </div>

      {/* Not-in-catalog notice: model couldn't confidently match any known disease */}
      {prediction.not_in_catalog && (
        <div className="rounded-xl p-4 mb-6 border border-amber-200 bg-amber-50 text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">This may not be a disease we detect</p>
              <p className="text-sm mt-1 leading-snug">
                {prediction.catalog_message ||
                  "The image doesn't clearly match any disease in our catalog for this crop. The labels below are the closest guesses, shown for reference only — treat with caution and consider an agricultural expert."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All Predictions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Other labels
        </h3>
        <div className="space-y-3">
          {prediction.all_predictions.map((pred, index) => {
            const pctRaw = toConfidencePercent(pred.confidence)
            const pctClamped = Math.min(100, Math.max(0, pctRaw))
            const pctOneDecimal = pctClamped.toFixed(1)
            return (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:border-primary-300 hover:bg-slate-50/50"
              >
                {/* Stacked on phones; row layout from md up */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <p className="min-w-0 flex-1 text-left text-sm font-medium leading-snug text-slate-900 md:text-base">
                    {pred.disease}
                  </p>
                  <div className="flex w-full min-w-0 items-center gap-3 md:max-w-md md:flex-[1_1_40%]">
                    <div className="min-h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-2 max-w-full rounded-full bg-gradient-to-r from-primary-600 to-blue-600 transition-all duration-500"
                        style={{ width: `${pctClamped}%` }}
                      />
                    </div>
                    <span className="min-w-[4.5rem] shrink-0 text-right text-sm font-semibold tabular-nums text-slate-700 md:text-base">
                      {pctOneDecimal}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
