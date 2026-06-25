'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react'
import { ChevronDown, Clock3, Trash2 } from 'lucide-react'
import { getDiseaseInfo } from '@/lib/diseaseInfo'

interface PredictionRecord {
  id: string
  timestamp: string
  crop: string
  farmName?: string
  farmState?: string
  disease: string
  confidence: number
  imageUrl: string
  isHealthy?: boolean
  allPredictions?: Array<{
    disease: string
    confidence: number
  }>
}

interface PredictionHistoryProps {
  onSelectHistory: (record: PredictionRecord) => void
}

export default function PredictionHistory({ onSelectHistory }: PredictionHistoryProps) {
  const [history, setHistory] = useState<PredictionRecord[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isConfirmingClear, setIsConfirmingClear] = useState(false)

  useEffect(() => {
    // Load history from localStorage (only in browser)
    if (typeof window === 'undefined') return
    
    try {
      const saved = localStorage.getItem('cropintel_history')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate it's an array
        if (Array.isArray(parsed)) {
          setHistory(parsed)
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e)
      // Clear corrupted data
      localStorage.removeItem('cropintel_history')
    }
  }, [])

  const clearHistory = () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem('cropintel_history')
    setHistory([])
    setExpandedId(null)
    setIsConfirmingClear(false)
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-field-soil/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-primary-900">
            <Clock3 className="h-5 w-5 text-primary-700" />
            Saved field checks
          </h3>
        </div>
        <p className="rounded-xl border border-dashed border-field-soil/20 bg-field-cream px-4 py-8 text-center text-sm text-field-soil">
          No saved checks yet. Run a crop health check and the result will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-field-soil/10 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-primary-900">
          <Clock3 className="h-5 w-5 text-primary-700" />
          Saved field checks ({history.length})
        </h3>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsConfirmingClear(true)}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {isConfirmingClear && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-rose-900">Clear all saved checks?</p>
              <p className="mt-1 text-sm text-rose-800">
                This removes every saved field check from this browser.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmingClear(false)}
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-800"
              >
                Clear checks
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {history.map((record) => {
            const isExpanded = expandedId === record.id
            const diseaseInfo = getDiseaseInfo(record.disease, record.crop)
            const otherPredictions = record.allPredictions?.filter(
              (pred) => pred.disease.toLowerCase() !== record.disease.toLowerCase()
            )
            const farmLabel = record.farmName
              ? `${record.farmName}${record.farmState ? ` (${record.farmState})` : ''}`
              : record.crop

            return (
              <div
                key={record.id}
                className="rounded-xl border border-field-soil/10 bg-white p-4 shadow-sm transition-all duration-200 hover:border-primary-300 hover:bg-primary-50/30"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : record.id)
                    onSelectHistory(record)
                  }}
                  className="flex w-full items-center gap-4 text-left"
                  aria-expanded={isExpanded}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-field-soil/15 bg-field-cream text-[10px] font-bold uppercase tracking-wide text-field-soil shadow-sm">
                      Image unavailable
                    </div>
                    <img
                      src={record.imageUrl}
                      alt="Saved field check"
                      className="absolute inset-0 h-20 w-20 rounded-xl border border-field-soil/15 bg-white object-cover shadow-sm"
                      style={{ display: 'block' }}
                      onError={(event) => {
                        console.error('Image failed to load:', record.imageUrl)
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                    <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary-700">
                      <span className="text-xs font-bold text-white">{Math.round(record.confidence)}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate text-base font-bold text-primary-900 sm:text-lg">{record.disease}</span>
                      <span className="text-xs font-medium text-field-soil">
                        {new Date(record.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="max-w-full truncate rounded-lg bg-field-cream px-3 py-1 text-sm font-semibold text-field-soil">
                        {farmLabel}
                      </span>
                      <span className="text-sm font-bold text-primary-700">
                        {record.confidence.toFixed(1)}% match
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-field-soil transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <div className="mt-4 border-t border-field-soil/10 pt-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-xl bg-field-cream/60 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-field-soil">Saved</p>
                        <p className="mt-1 font-semibold text-primary-900">
                          {new Date(record.timestamp).toLocaleString(undefined, {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl bg-field-cream/60 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-field-soil">Status</p>
                        <p className="mt-1 font-semibold text-primary-900">
                          {record.isHealthy ? 'Looks healthy' : diseaseInfo?.severity ? `${diseaseInfo.severity} risk` : 'Field check'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-field-cream/60 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-field-soil">Crop</p>
                        <p className="mt-1 font-semibold capitalize text-primary-900">{record.crop}</p>
                      </div>
                    </div>

                    {diseaseInfo?.symptoms && diseaseInfo.symptoms.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-bold text-primary-900">Symptoms to compare</p>
                        <ul className="space-y-2">
                          {diseaseInfo.symptoms.slice(0, 3).map((symptom, index) => (
                            <li key={index} className="flex items-start gap-3 text-sm text-field-soil">
                              <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-700" />
                              <span className="min-w-0 leading-6">{symptom}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {otherPredictions && otherPredictions.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-bold text-primary-900">Other model matches</p>
                        <div className="space-y-2">
                          {otherPredictions.slice(0, 3).map((pred, index) => (
                            <div key={`${pred.disease}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-field-cream/60 px-3 py-2 text-sm">
                              <span className="min-w-0 truncate text-field-soil">{pred.disease}</span>
                              <span className="shrink-0 font-semibold text-primary-800">
                                {(pred.confidence > 0 && pred.confidence <= 1 ? pred.confidence * 100 : pred.confidence).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
        })}
      </div>
    </div>
  )
}

export function savePredictionToHistory(
  crop: string,
  disease: string,
  confidence: number,
  imageUrl: string,
  farm?: {
    name: string
    stateCode: string
  } | null,
  prediction?: {
    is_healthy?: boolean
    all_predictions?: Array<{
      disease: string
      confidence: number
    }>
  }
) {
  // Only run in browser
  if (typeof window === 'undefined') return

  try {
    const record: PredictionRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      crop,
      farmName: farm?.name,
      farmState: farm?.stateCode,
      disease,
      confidence,
      imageUrl,
      isHealthy: prediction?.is_healthy,
      allPredictions: prediction?.all_predictions,
    }

    const saved = localStorage.getItem('cropintel_history')
    let history: PredictionRecord[] = []
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Validate it's an array
        if (Array.isArray(parsed)) {
          history = parsed
        } else {
          // If corrupted, start fresh
          history = []
        }
      } catch (e) {
        console.error('Failed to parse history:', e)
        // Clear corrupted data and start fresh
        localStorage.removeItem('cropintel_history')
        history = []
      }
    }

    // Add new record at the beginning
    history.unshift(record)
    
    // Keep only last 50 records
    if (history.length > 50) {
      history = history.slice(0, 50)
    }

    localStorage.setItem('cropintel_history', JSON.stringify(history))
  } catch (e) {
    console.error('Failed to save prediction to history:', e)
  }
}
