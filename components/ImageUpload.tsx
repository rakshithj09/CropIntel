'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useRef } from 'react'
import { Image as ImageIcon, Upload, X } from 'lucide-react'

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
  title = 'Add a crop photo',
  hint = 'Use a close, well-lit photo of the leaf or damaged area.',
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
          className={`rounded-2xl border border-dashed p-6 text-center transition-all duration-200 sm:p-10 ${
            dragActive
              ? 'border-primary-500 bg-white shadow-md'
              : 'border-field-soil/25 bg-field-cream/70 hover:border-primary-300 hover:bg-white'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary-100 bg-white shadow-sm">
            <ImageIcon className="w-6 h-6 text-primary-700" />
          </div>
          <p className="mb-1 text-base font-bold text-primary-900">{title}</p>
          <p className="mb-5 text-sm text-field-soil">{hint}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center items-stretch sm:items-center max-w-md mx-auto w-full">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary min-h-[44px] px-5 py-2.5"
            >
              <Upload className="w-4 h-4 shrink-0" />
              Choose photo
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="btn-secondary px-5"
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              Use camera
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
        <div className="group relative rounded-2xl border border-field-soil/10 bg-white p-3 shadow-sm sm:p-4">
          <div className="relative flex h-auto max-h-[520px] w-full items-center justify-center overflow-hidden rounded-xl border border-field-soil/10 bg-field-cream">
            <img
              src={imageUrl}
              alt="Crop image preview"
              className="w-full h-auto max-h-[500px] object-contain rounded-lg"
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              onError={(e) => {
                console.error('Image failed to load:', imageUrl)
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <button
            type="button"
            onClick={onClear}
            className="absolute right-5 top-5 flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center gap-2 rounded-xl border border-field-soil/15 bg-white/95 px-3 py-2 text-sm font-semibold text-primary-900 shadow-sm transition-colors hover:bg-field-cream"
          >
            <X className="w-4 h-4" />
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
