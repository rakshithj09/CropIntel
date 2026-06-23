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
        className="mb-2 flex items-center gap-2 text-sm font-bold text-primary-900"
      >
        <MapPinned className="w-4 h-4 text-primary-700" />
        Farm state
      </label>
      <select
        id="state-select"
        value={selectedState}
        onChange={(e) => onStateChange(e.target.value)}
        className="field-input cursor-pointer"
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
