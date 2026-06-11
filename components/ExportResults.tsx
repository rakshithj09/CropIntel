'use client'

import { Download, FileJson, Share2, Table } from 'lucide-react'

interface ExportResultsProps {
  prediction: any
  crop: string
  imageUrl: string | null
}

function confidencePercent(value: number) {
  if (value > 0 && value <= 1) return value * 100
  return value
}

export default function ExportResults({ prediction, crop, imageUrl }: ExportResultsProps) {
  const exportToJSON = () => {
    const data = {
      crop,
      disease: prediction.disease,
      confidence: confidencePercent(prediction.confidence),
      isHealthy: prediction.is_healthy,
      timestamp: new Date().toISOString(),
      allPredictions: prediction.all_predictions,
      imageIncluded: Boolean(imageUrl),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cropintel_${crop}_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportToCSV = () => {
    const headers = ['Disease', 'Confidence (%)', 'Is Healthy']
    const rows = prediction.all_predictions.map((p: any) => [
      p.disease,
      confidencePercent(p.confidence).toFixed(1),
      prediction.is_healthy ? 'Yes' : 'No',
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row: any[]) => row.join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cropintel_${crop}_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const shareResults = async () => {
    const text = `CropIntel result\nCrop: ${crop}\nLikely issue: ${prediction.disease}\nConfidence: ${confidencePercent(prediction.confidence).toFixed(0)}%`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CropIntel result',
          text,
        })
      } catch (err) {
        console.error('Error sharing:', err)
      }
    } else {
      await navigator.clipboard.writeText(text)
      alert('Result copied to clipboard.')
    }
  }

  return (
    <details className="rounded-2xl border border-[#E2E4DD] bg-white p-4 shadow-sm sm:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#1F2A1F]">
        <span className="flex items-center gap-2">
          <Download className="h-4 w-4 text-[#2F6B3F]" />
          Export result
        </span>
        <span className="text-xs font-medium text-[#6B7168]">JSON, CSV, share</span>
      </summary>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={exportToJSON}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] px-4 py-2.5 text-sm font-semibold text-[#1F2A1F] transition-colors hover:bg-white"
        >
          <FileJson className="h-4 w-4" />
          JSON
        </button>
        <button
          type="button"
          onClick={exportToCSV}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] px-4 py-2.5 text-sm font-semibold text-[#1F2A1F] transition-colors hover:bg-white"
        >
          <Table className="h-4 w-4" />
          CSV
        </button>
        <button
          type="button"
          onClick={shareResults}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2F6B3F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#285A35]"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </details>
  )
}
