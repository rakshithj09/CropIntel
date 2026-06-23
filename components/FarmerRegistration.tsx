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
    if (!formData.name.trim()) missing.push('Farm name (green section at top of form)')
    const latOk = formData.lat.trim() !== '' && !Number.isNaN(parseFloat(formData.lat))
    const lngOk = formData.lng.trim() !== '' && !Number.isNaN(parseFloat(formData.lng))
    if (!latOk) missing.push('Latitude')
    if (!lngOk) missing.push('Longitude')
    if (formData.selectedCrops.length === 0) missing.push('At least one crop')

    if (missing.length > 0) {
      alert(`Please complete the following:\n\n• ${missing.join('\n• ')}`)
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
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-primary min-h-[42px] px-4 py-2"
      >
        <MapPin className="w-4 h-4" />
        Watch My Farm
      </button>

      {mounted &&
        isOpen &&
        createPortal(
              <div
                key="farm-registration-fullpage"
                className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-field-cream"
                role="dialog"
                aria-modal="true"
                aria-labelledby="farm-registration-title"
              >
            <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-field-soil/10 bg-white px-5 py-4 sm:px-10 sm:py-6 lg:px-16">
              <h2
                id="farm-registration-title"
                className="flex min-w-0 items-center gap-3 text-xl font-bold text-primary-900 sm:text-2xl"
              >
                <MapPin className="h-7 w-7 shrink-0 text-primary-700" />
                <span>Save my farm area</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="shrink-0 rounded-xl border border-field-soil/15 p-3 text-field-soil transition-colors hover:bg-field-cream hover:text-primary-900"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-shrink-0 border-b border-primary-100 bg-primary-50/90 px-5 py-5 sm:px-10 sm:py-6 lg:px-16">
              <label className="mb-2 block text-base font-bold text-primary-900" htmlFor="farm-registration-name">
                  Farm or field name <span className="text-red-600">*</span>
              </label>
              <input
                id="farm-registration-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="North 80, Smith Family Farm"
                autoComplete="organization"
                className="field-input max-w-3xl py-4 text-lg"
              />
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-6 sm:space-y-8 sm:px-10 sm:py-8 lg:px-16">
              <div>
                <label className="mb-2 block text-base font-bold text-primary-900">
                  Email for alerts (optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="field-input max-w-3xl py-4 text-lg"
                />
              </div>

              <div>
                <label className="mb-2 block text-base font-bold text-primary-900">
                  USDA farm or tract code (optional)
                </label>
                <input
                  type="text"
                  value={formData.usdaFarmCode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, usdaFarmCode: e.target.value }))}
                  placeholder="12345-67890"
                  className="field-input max-w-3xl py-4 font-mono text-lg"
                />
                <p className="mt-2 max-w-3xl text-sm leading-6 text-field-soil">
                  If the format looks valid, this browser marks the profile as a <strong>Verified farmer</strong>{' '}
                  for demo purposes.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-base font-bold text-primary-900">
                  Farm location <span className="text-red-500">*</span>
                </label>
                <div className="mb-3 flex max-w-3xl flex-col gap-3 sm:flex-row">
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lat: e.target.value }))}
                    placeholder="Latitude"
                    className="field-input min-w-0 flex-1 py-4 text-lg"
                  />
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lng: e.target.value }))}
                    placeholder="Longitude"
                    className="field-input min-w-0 flex-1 py-4 text-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="btn-secondary w-full max-w-3xl py-4 text-lg"
                >
                  <MapPin className="w-5 h-5" />
                  Use my current location
                </button>
              </div>

              <div>
                <label className="mb-3 block text-base font-bold text-primary-900">
                  Crops in this area <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl">
                  {crops.map((crop) => (
                    <button
                      type="button"
                      key={crop}
                      onClick={() => handleCropToggle(crop)}
                      className={`rounded-xl border px-4 py-5 text-lg font-bold transition-all sm:py-6 ${
                        formData.selectedCrops.includes(crop)
                          ? 'border-primary-700 bg-primary-700 text-white shadow-md'
                          : 'border-field-soil/15 bg-white text-primary-900 hover:border-primary-400 hover:bg-primary-50'
                      }`}
                    >
                      {crop.charAt(0).toUpperCase() + crop.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-w-3xl rounded-xl border border-field-straw/40 bg-field-wheat/30 p-4 sm:p-5">
                <p className="text-sm leading-6 text-primary-900 sm:text-base">
                  <strong>Alert range:</strong> CropIntel watches for reported crop issues within 250 miles for the crops you select.
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-field-soil/10 bg-white px-5 py-5 sm:px-10 sm:py-6 lg:px-16">
              <button
                type="button"
                onClick={handleSubmit}
                className="btn-primary mx-auto w-full max-w-3xl py-4 text-lg sm:py-5"
              >
                <Save className="w-6 h-6" />
                Save farm area
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
