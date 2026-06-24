'use client'

import { MapPinned } from 'lucide-react'
import { US_STATES } from '@/lib/stateDiseaseMap'

interface StateSelectorProps {
  selectedState: string
  onStateChange: (code: string) => void
}

export default function StateSelector({ selectedState, onStateChange }: StateSelectorProps) {
  return (
    <div>
      <label
        htmlFor="state-select"
        className="mb-2 flex items-center gap-2 text-sm font-extrabold text-primary-950"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-100 bg-white shadow-sm">
          <MapPinned className="h-4 w-4 text-primary-700" />
        </span>
        Farm state
      </label>
      <select
        id="state-select"
        value={selectedState}
        onChange={(e) => onStateChange(e.target.value)}
        className="field-input cursor-pointer border-primary-200 bg-white text-primary-950 shadow-[0_10px_24px_-18px_rgba(18,38,28,0.45)] ring-1 ring-primary-100/70 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-200/60"
      >
        {US_STATES.map(({ code, name }) => (
          <option key={code} value={code}>
            {name} ({code})
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs leading-5 text-field-soil">
        Helps CropIntel compare against crop issues common in your area.
      </p>
    </div>
  )
}
