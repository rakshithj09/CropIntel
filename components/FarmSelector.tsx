'use client'

import type { Farm } from '@/src/lib/types'

type FarmSelectorProps = {
  farms: Farm[]
  selectedFarmId: string
  onFarmChange: (farmId: string) => void
  loading?: boolean
}

export default function FarmSelector({ farms, selectedFarmId, onFarmChange, loading }: FarmSelectorProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="farm-selector">
        Farm
      </label>
      <select
        id="farm-selector"
        value={selectedFarmId}
        onChange={(event) => onFarmChange(event.target.value)}
        disabled={loading}
        className="field-input"
      >
        <option value="">{loading ? 'Loading farms...' : 'Select a farm'}</option>
        {farms.map((farm) => (
          <option key={farm.id} value={farm.id}>
            {farm.name} ({farm.stateCode})
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs leading-5 text-field-soil">
        CropIntel uses the farm state for regional disease context.
      </p>
    </div>
  )
}
