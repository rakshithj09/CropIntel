'use client'

import { Leaf } from 'lucide-react'

interface CropSelectorProps {
  crops: string[]
  selectedCrop: string
  onCropChange: (crop: string) => void
}

export default function CropSelector({
  crops,
  selectedCrop,
  onCropChange,
}: CropSelectorProps) {
  return (
    <div>
      <label
        htmlFor="crop-select"
        className="mb-2 flex items-center gap-2 text-sm font-extrabold text-primary-950"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-100 bg-white shadow-sm">
          <Leaf className="h-4 w-4 text-primary-700" />
        </span>
        Crop in the photo
      </label>
      <select
        id="crop-select"
        value={crops.includes(selectedCrop) ? selectedCrop : ''}
        onChange={(e) => onCropChange(e.target.value)}
        disabled={crops.length === 0}
        className="field-input cursor-pointer border-primary-200 bg-white text-primary-950 shadow-[0_10px_24px_-18px_rgba(18,38,28,0.45)] ring-1 ring-primary-100/70 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-200/60"
      >
        {crops.length === 0 && <option value="">No crops on this farm</option>}
        {crops.map((crop) => (
          <option key={crop} value={crop}>
            {crop.charAt(0).toUpperCase() + crop.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}
