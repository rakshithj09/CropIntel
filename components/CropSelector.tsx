'use client'

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
      <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="crop-select">
        Crop in the photo
      </label>
      <select
        id="crop-select"
        value={crops.includes(selectedCrop) ? selectedCrop : ''}
        onChange={(e) => onCropChange(e.target.value)}
        disabled={crops.length === 0}
        className="field-input cursor-pointer"
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
