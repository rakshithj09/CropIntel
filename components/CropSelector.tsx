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
        className="mb-2 flex items-center gap-2 text-sm font-bold text-primary-900"
      >
        <Leaf className="w-4 h-4 text-primary-700" />
        Crop in the photo
      </label>
      <select
        id="crop-select"
        value={selectedCrop}
        onChange={(e) => onCropChange(e.target.value)}
        className="field-input cursor-pointer"
      >
        {crops.map((crop) => (
          <option key={crop} value={crop}>
            {crop.charAt(0).toUpperCase() + crop.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}
