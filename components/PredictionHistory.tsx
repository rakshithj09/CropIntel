'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react'
import { Clock3, Trash2 } from 'lucide-react'

interface PredictionRecord {
  id: string
  timestamp: string
  crop: string
  disease: string
  confidence: number
  imageUrl: string
}

interface PredictionHistoryProps {
  onSelectHistory: (record: PredictionRecord) => void
}

export default function PredictionHistory({ onSelectHistory }: PredictionHistoryProps) {
  const [history, setHistory] = useState<PredictionRecord[]>([])
  const [isOpen, setIsOpen] = useState(false)

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
    if (confirm('Are you sure you want to clear all prediction history?')) {
      localStorage.removeItem('cropintel_history')
      setHistory([])
    }
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-field-soil/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-primary-900">
            <Clock3 className="h-5 w-5 text-primary-700" />
            Saved field checks
          </h3>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary-800 transition-colors hover:bg-primary-50"
          >
            {isOpen ? 'Hide' : 'Show'}
          </button>
        </div>
        {isOpen && (
          <p className="rounded-xl border border-dashed border-field-soil/20 bg-field-cream px-4 py-8 text-center text-sm text-field-soil">
            No saved checks yet. Run a crop health check and the result will appear here.
          </p>
        )}
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
            onClick={() => setIsOpen(!isOpen)}
            className="btn-secondary min-h-[40px] px-4 py-2 text-sm"
          >
            {isOpen ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            onClick={clearHistory}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {history.map((record) => (
            <div
              key={record.id}
              onClick={() => onSelectHistory(record)}
              className="cursor-pointer rounded-xl border border-field-soil/10 bg-white p-4 shadow-sm transition-all duration-200 hover:border-primary-300 hover:bg-primary-50/50"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={record.imageUrl}
                    alt="History"
                    className="h-20 w-20 rounded-xl border border-field-soil/15 object-cover shadow-sm"
                    style={{ display: 'block' }}
                    onError={(e) => {
                      console.error('Image failed to load:', record.imageUrl)
                    }}
                  />
                  <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary-700">
                    <span className="text-white text-xs font-bold">{Math.round(record.confidence)}</span>
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
                    <span className="rounded-lg bg-field-cream px-3 py-1 text-sm font-semibold capitalize text-field-soil">
                      {record.crop}
                    </span>
                    <span className="text-sm font-bold text-primary-700">
                      {record.confidence.toFixed(1)}% match
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function savePredictionToHistory(
  crop: string,
  disease: string,
  confidence: number,
  imageUrl: string
) {
  // Only run in browser
  if (typeof window === 'undefined') return

  try {
    const record: PredictionRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      crop,
      disease,
      confidence,
      imageUrl
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
