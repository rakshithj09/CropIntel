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
        className="mb-2 flex items-center gap-2 text-sm font-medium text-[#1F2A1F]"
      >
        <Leaf className="h-4 w-4 text-[#2F6B3F]" />
        Crop
      </label>
      <select
        id="crop-select"
        value={selectedCrop}
        onChange={(e) => onCropChange(e.target.value)}
        className="soft-input min-h-[48px] w-full cursor-pointer rounded-xl px-4 py-3 text-base font-medium transition-colors hover:bg-[#F6F7F5]"
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
