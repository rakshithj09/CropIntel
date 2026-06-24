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
  const otherPredictions = prediction.all_predictions.filter(
    (pred) => pred.disease.toLowerCase() !== prediction.disease.toLowerCase()
  )

  const getStatusColor = () => {
    if (prediction.not_in_catalog) {
      return 'bg-amber-50 text-amber-800 border-amber-200'
    }
    if (prediction.is_healthy) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    }
    if (prediction.meets_threshold) {
      return 'bg-rose-50 text-rose-800 border-rose-200'
    }
    return 'bg-amber-50 text-amber-800 border-amber-200'
  }

  const getStatusText = () => {
    if (prediction.not_in_catalog) {
      return 'No clear match'
    }
    if (prediction.is_healthy) {
      return 'Looks healthy'
    }
    if (prediction.meets_threshold) {
      return 'Possible disease'
    }
    return 'Needs another look'
  }

  const getFieldAction = () => {
    if (prediction.not_in_catalog) {
      return 'Take another clear photo from a different angle and compare symptoms with an agronomist before treating.'
    }
    if (prediction.is_healthy) {
      return 'Keep scouting this field. Recheck if new spots, yellowing, or spreading damage appears.'
    }
    if (prediction.meets_threshold) {
      return 'Scout nearby rows, compare the symptoms below, and plan treatment only after field confirmation.'
    }
    return 'Use a sharper close-up in daylight, then compare the top matches before making treatment decisions.'
  }

  return (
    <div className="mt-8 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_18px_52px_-34px_rgba(18,38,28,0.34)] ring-1 ring-ink/5 backdrop-blur sm:p-6">
      <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-primary-900">
        <svg className="h-6 w-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Field readout
      </h2>
      {regionNote && (
        <p className="-mt-2 mb-4 rounded-xl border border-primary-100 bg-primary-50/70 px-3 py-2 text-xs leading-5 text-field-soil">
          {regionNote}
        </p>
      )}

      {/* Main Result */}
      <div className="mb-5 rounded-2xl border border-field-soil/10 bg-white/65 p-5">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-field-soil">
              Likely field issue
            </h3>
            <p className="mt-1 text-2xl font-bold text-primary-900">
              {prediction.disease}
            </p>
          </div>
          <div className="sm:text-right">
            <h3 className="text-xs font-bold uppercase tracking-wide text-field-soil">
              Match strength
            </h3>
            <p className="mt-1 text-2xl font-bold tabular-nums text-primary-800">
              {Math.min(100, Math.max(0, toConfidencePercent(prediction.confidence))).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${getStatusColor()}`}
        >
          {prediction.is_healthy ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {getStatusText()}
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-field-soil/10 bg-field-cream/35 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary-800">What to do next</p>
        <p className="mt-1 text-sm leading-6 text-primary-950">{getFieldAction()}</p>
      </div>

      {/* Not-in-catalog notice: model couldn't confidently match any known disease */}
      {prediction.not_in_catalog && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">This may not be a crop issue CropIntel can identify</p>
              <p className="text-sm mt-1 leading-snug">
                {prediction.catalog_message ||
                  "The photo does not clearly match a known issue for this crop. The matches below are only a starting point. Do not treat from this result alone."}
              </p>
            </div>
          </div>
        </div>
      )}

      {otherPredictions.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <svg className="h-5 w-5 text-field-soil" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Other possible matches
          </h3>
          <div className="space-y-3">
            {otherPredictions.map((pred, index) => {
              const pctRaw = toConfidencePercent(pred.confidence)
              const pctClamped = Math.min(100, Math.max(0, pctRaw))
              const pctOneDecimal = pctClamped.toFixed(1)
              return (
                <div
                  key={`${pred.disease}-${index}`}
                  className="rounded-2xl border border-field-soil/10 bg-white/70 p-4 transition-all duration-200 hover:border-primary-200 hover:bg-white"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                    <p className="min-w-0 flex-1 text-left text-sm font-medium leading-snug text-slate-900 md:text-base">
                      {pred.disease}
                    </p>
                    <div className="flex w-full min-w-0 items-center gap-3 md:max-w-md md:flex-[1_1_40%]">
                      <div className="min-h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200/80">
                        <div
                          className="h-2 max-w-full rounded-full bg-gradient-to-r from-primary-700 to-leaf transition-all duration-500"
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
      )}
    </div>
  )
}
