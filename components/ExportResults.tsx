'use client'

import { Download, FileJson, Share2, Table } from 'lucide-react'

interface ExportResultsProps {
  prediction: any
  crop: string
  imageUrl: string | null
}

export default function ExportResults({ prediction, crop, imageUrl }: ExportResultsProps) {
  const exportToJSON = () => {
    const data = {
      crop,
      disease: prediction.disease,
      confidence: prediction.confidence,
      isHealthy: prediction.is_healthy,
      timestamp: new Date().toISOString(),
      allPredictions: prediction.all_predictions
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
    const headers = ['Likely issue', 'Match strength (%)', 'Looks healthy']
    const rows = prediction.all_predictions.map((p: any) => [
      p.disease,
      p.confidence.toFixed(2),
      prediction.is_healthy ? 'Yes' : 'No'
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row: any[]) => row.join(','))
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
    const text = `CropIntel field check:\nCrop: ${crop}\nLikely issue: ${prediction.disease}\nMatch strength: ${prediction.confidence.toFixed(1)}%\n\nUse this for scouting and confirm before treatment.`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'CropIntel field check',
          text: text,
        })
      } catch (err) {
        console.error('Error sharing:', err)
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text)
      alert('Field check copied to clipboard.')
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-field-soil/10 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-5 flex items-center gap-3 text-lg font-bold text-primary-900">
        <Download className="h-5 w-5 text-primary-700" />
        Save this field check
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={exportToJSON}
          className="btn-secondary"
        >
          <FileJson className="h-4 w-4" />
          Save JSON
        </button>
        <button
          type="button"
          onClick={exportToCSV}
          className="btn-secondary"
        >
          <Table className="h-4 w-4" />
          Save CSV
        </button>
        <button
          type="button"
          onClick={shareResults}
          className="btn-primary"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </div>
  )
}
