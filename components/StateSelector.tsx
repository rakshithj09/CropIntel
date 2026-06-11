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
        className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1F2A1F]"
      >
        <MapPinned className="h-4 w-4 text-[#2F6B3F]" />
        Location
      </label>
      <select
        id="state-select"
        value={selectedState}
        onChange={(e) => onStateChange(e.target.value)}
        className="soft-input min-h-[48px] w-full cursor-pointer rounded-xl px-4 py-3 text-base font-medium transition-colors hover:bg-[#F6F7F5]"
      >
        {US_STATES.map(({ code, name }) => (
          <option key={code} value={code}>
            {name} ({code})
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-[#6B7168]">
        Used to check common diseases near you.
      </p>
    </div>
  )
}
