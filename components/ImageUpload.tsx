'use client'

import { useState, useRef } from 'react'
import { Camera, Upload } from 'lucide-react'

interface ImageUploadProps {
  selectedImage: File | null
  onImageSelect: (file: File | null) => void
  onClear: () => void
  /** Override default upload prompt (e.g. "Past photo") */
  title?: string
  hint?: string
}

export default function ImageUpload({
  selectedImage,
  onImageSelect,
  onClear,
  title = 'Take a clear photo of one leaf.',
  hint = '',
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      onImageSelect(file)
    }
  }

  const imageUrl = selectedImage ? URL.createObjectURL(selectedImage) : null

  return (
    <div>
      {!imageUrl ? (
        <div
          className={`rounded-xl border border-dashed p-6 text-center transition-all duration-200 sm:p-8 ${
            dragActive
              ? 'border-[#2F6B3F] bg-[#F6F7F5]'
              : 'border-[#E2E4DD] bg-[#F6F7F5] hover:border-[#2F6B3F]'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E2E4DD] bg-white">
            <Camera className="h-6 w-6 text-[#2F6B3F]" />
          </div>
          <p className="mb-5 text-base font-medium text-[#1F2A1F]">{title}</p>
          {hint && <p className="mb-5 text-sm text-[#6B7168]">{hint}</p>}
          <div className="mx-auto flex w-full max-w-sm flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex min-h-[48px] touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#2F6B3F] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#285A35]"
            >
              <Camera className="h-4 w-4 shrink-0" />
              Take photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[48px] touch-manipulation items-center justify-center gap-2 rounded-xl border border-[#E2E4DD] bg-white px-5 py-2.5 text-[15px] font-semibold text-[#1F2A1F] transition-colors hover:bg-[#F6F7F5]"
            >
              <Upload className="h-4 w-4 shrink-0" />
              Upload photo
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] p-3">
          <div className="relative flex h-auto max-h-[420px] w-full items-center justify-center overflow-hidden rounded-lg border border-[#E2E4DD] bg-white">
            <img
              src={imageUrl}
              alt="Crop image preview"
              className="h-auto max-h-[400px] w-full rounded-lg object-contain"
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              onError={(e) => {
                console.error('Image failed to load:', imageUrl)
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[44px] rounded-xl bg-[#2F6B3F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#285A35]"
            >
              Retake photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] rounded-xl border border-[#E2E4DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#1F2A1F] transition-colors hover:bg-[#F6F7F5]"
            >
              Change photo
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}
    </div>
  )
}
