'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Save, X } from 'lucide-react'
import { mockValidateUsdaFarmCode } from '@/lib/farmerProfile'

interface FarmerRegistrationProps {
  onRegister: (location: {
    lat: number
    lng: number
    crops: string[]
    name: string
    email?: string
    usdaFarmCode?: string
    verifiedFarmer: boolean
  }) => void
  crops: string[]
}

export default function FarmerRegistration({ onRegister, crops }: FarmerRegistrationProps) {
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    lat: '',
    lng: '',
    usdaFarmCode: '',
    selectedCrops: [] as string[],
  })

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            lat: position.coords.latitude.toFixed(6),
            lng: position.coords.longitude.toFixed(6),
          }))
        },
        (error) => {
          alert('Unable to get your location. Please enter it manually.')
          console.error('Geolocation error:', error)
        }
      )
    } else {
      alert('Geolocation is not supported by your browser.')
    }
  }

  const handleCropToggle = (crop: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCrops: prev.selectedCrops.includes(crop)
        ? prev.selectedCrops.filter((c) => c !== crop)
        : [...prev.selectedCrops, crop],
    }))
  }

  const handleSubmit = () => {
    const missing: string[] = []
    if (!formData.name.trim()) missing.push('Farm name')
    const latOk = formData.lat.trim() !== '' && !Number.isNaN(parseFloat(formData.lat))
    const lngOk = formData.lng.trim() !== '' && !Number.isNaN(parseFloat(formData.lng))
    if (!latOk) missing.push('Latitude')
    if (!lngOk) missing.push('Longitude')
    if (formData.selectedCrops.length === 0) missing.push('At least one crop')

    if (missing.length > 0) {
      alert(`Please complete the following:\n\n- ${missing.join('\n- ')}`)
      return
    }

    const code = formData.usdaFarmCode.trim()
    const verifiedFarmer = code.length > 0 ? mockValidateUsdaFarmCode(code) : false

    onRegister({
      lat: parseFloat(formData.lat),
      lng: parseFloat(formData.lng),
      crops: formData.selectedCrops,
      name: formData.name,
      email: formData.email.trim() || undefined,
      usdaFarmCode: code || undefined,
      verifiedFarmer,
    })

    setIsOpen(false)
    setFormData({
      name: '',
      email: '',
      lat: '',
      lng: '',
      usdaFarmCode: '',
      selectedCrops: [],
    })
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#285A35]"
      >
        <MapPin className="w-4 h-4" />
        Register farm
      </button>

      {mounted &&
        isOpen &&
        createPortal(
          <div
            key="farm-registration-modal"
            className="fixed inset-0 z-[9999] overflow-y-auto bg-[#1F2A1F]/25 px-4 py-5 backdrop-blur-sm sm:px-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="farm-registration-title"
            onMouseDown={() => setIsOpen(false)}
          >
            <div className="flex min-h-full items-center justify-center">
              <div
                className="relative w-full max-w-[680px] overflow-hidden rounded-2xl border border-[#E2E4DD] bg-white shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="absolute right-4 top-4 z-10 rounded-xl border border-[#E2E4DD] bg-white p-2.5 text-[#6B7168] transition-colors hover:bg-[#F6F7F5] hover:text-[#1F2A1F]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="border-b border-[#E2E4DD] bg-[#F6F7F5] px-6 pb-6 pt-8 text-center sm:px-8">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2F6B3F] text-white">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <h2
                    id="farm-registration-title"
                    className="text-2xl font-bold tracking-tight text-[#1F2A1F]"
                  >
                    Register your farm
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B7168]">
                    Add your farm location and crops to receive nearby disease alerts.
                  </p>
                </div>

                <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto px-5 py-6 sm:px-8">
                  <div className="mx-auto max-w-xl space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#1F2A1F]" htmlFor="farm-registration-name">
                        Farm name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="farm-registration-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Smith Family Farm"
                        autoComplete="organization"
                        className="soft-input min-h-[50px] w-full rounded-xl px-4 py-3 text-base"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#1F2A1F]">
                        Email (optional)
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="farmer@example.com"
                        autoComplete="email"
                        className="soft-input min-h-[50px] w-full rounded-xl px-4 py-3 text-base"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#1F2A1F]">
                        USDA farm / tract code (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.usdaFarmCode}
                        onChange={(e) => setFormData((prev) => ({ ...prev, usdaFarmCode: e.target.value }))}
                        placeholder="e.g., 12345-67890"
                        className="soft-input min-h-[50px] w-full rounded-xl px-4 py-3 font-mono text-base"
                      />
                      <p className="mt-2 text-sm leading-5 text-[#6B7168]">
                        Used for demo verification when the code format looks valid.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#1F2A1F]">
                        Location <span className="text-red-600">*</span>
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="number"
                          step="any"
                          value={formData.lat}
                          onChange={(e) => setFormData((prev) => ({ ...prev, lat: e.target.value }))}
                          placeholder="Latitude"
                          className="soft-input min-h-[50px] w-full rounded-xl px-4 py-3 text-base"
                        />
                        <input
                          type="number"
                          step="any"
                          value={formData.lng}
                          onChange={(e) => setFormData((prev) => ({ ...prev, lng: e.target.value }))}
                          placeholder="Longitude"
                          className="soft-input min-h-[50px] w-full rounded-xl px-4 py-3 text-base"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#CFE0C9] bg-[#E7F0E3] px-4 py-3 text-sm font-semibold text-[#2F6B3F] transition-colors hover:bg-[#DCEAD7]"
                      >
                        <MapPin className="h-4 w-4" />
                        Use current location
                      </button>
                    </div>

                    <div>
                      <label className="mb-3 block text-sm font-medium text-[#1F2A1F]">
                        Crops you grow <span className="text-red-600">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {crops.map((crop) => (
                          <button
                            type="button"
                            key={crop}
                            onClick={() => handleCropToggle(crop)}
                            className={`min-h-[52px] rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                              formData.selectedCrops.includes(crop)
                                ? 'border-[#2F6B3F] bg-[#2F6B3F] text-white'
                                : 'border-[#E2E4DD] bg-[#F6F7F5] text-[#1F2A1F] hover:border-[#CFE0C9] hover:bg-[#E7F0E3]'
                            }`}
                          >
                            {crop.charAt(0).toUpperCase() + crop.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] p-4 text-center">
                      <p className="text-sm leading-6 text-[#6B7168]">
                        Alerts are checked within 250 miles of this location for the crops you select.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#E2E4DD] bg-white px-5 py-5 sm:px-8">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="mx-auto flex min-h-[52px] w-full max-w-xl items-center justify-center gap-2 rounded-xl bg-[#2F6B3F] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#285A35]"
                  >
                    <Save className="h-5 w-5" />
                    Register farm
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
