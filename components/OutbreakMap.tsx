'use client'

import { useState, useEffect } from 'react'
import { WorldMap } from '@/components/ui/world-map'
import { MapPin, AlertTriangle, X, Save } from 'lucide-react'
import { motion } from 'framer-motion'

interface OutbreakReport {
  id: string
  lat: number
  lng: number
  crop: string
  disease: string
  severity: 'low' | 'medium' | 'high'
  date: string
  description: string
}

export default function OutbreakMap() {
  const [reports, setReports] = useState<OutbreakReport[]>([])
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showReportForm, setShowReportForm] = useState(false)
  const [formData, setFormData] = useState({
    crop: '',
    disease: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    description: '',
  })

  // Convert reports to map dots format
  const mapDots = reports.map((report) => ({
    start: { lat: report.lat, lng: report.lng, label: report.disease },
    end: { lat: report.lat, lng: report.lng, label: report.disease },
  }))

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Find the map container
    const mapContainer = e.currentTarget.querySelector('[class*="aspect-[2/1]"]')
    if (!mapContainer) return

    const rect = mapContainer.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Convert pixel coordinates to lat/lng (map is 800x400 viewBox)
    const lng = (x / rect.width) * 360 - 180
    const lat = 90 - (y / rect.height) * 180
    
    // Clamp values to valid ranges
    const clampedLat = Math.max(-90, Math.min(90, lat))
    const clampedLng = Math.max(-180, Math.min(180, lng))
    
    setSelectedLocation({ lat: clampedLat, lng: clampedLng })
    setShowReportForm(true)
  }

  const handleSubmitReport = () => {
    if (!selectedLocation || !formData.crop || !formData.disease) {
      alert('Please add the crop and what the issue looks like.')
      return
    }

    const newReport: OutbreakReport = {
      id: Date.now().toString(),
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      crop: formData.crop,
      disease: formData.disease,
      severity: formData.severity,
      date: new Date().toISOString(),
      description: formData.description,
    }

    setReports([...reports, newReport])
    setShowReportForm(false)
    setSelectedLocation(null)
    setFormData({
      crop: '',
      disease: '',
      severity: 'medium',
      description: '',
    })
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'low':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-field-cream px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:py-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
            Local crop issue map
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Tap the map where you are seeing crop trouble so nearby farms can watch their fields.
          </p>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-slate-200">
          <div className="relative">
            <WorldMap dots={mapDots} lineColor="#ef4444" />
            {/* Clickable overlay for map interaction */}
            <div
              onClick={handleMapClick}
              className="absolute inset-0 cursor-crosshair z-10"
              style={{ pointerEvents: 'auto' }}
            />
            {selectedLocation && (
              <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 border border-slate-200 z-20">
                <p className="text-sm font-semibold text-slate-900 mb-1">Selected Location</p>
                <p className="text-xs text-slate-600">
                  Lat: {selectedLocation.lat.toFixed(4)}, Lng: {selectedLocation.lng.toFixed(4)}
                </p>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-20">
              <p className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Tap map to report crop trouble
              </p>
            </div>
          </div>
        </div>

        {/* Report Form Modal — avoid motion opacity on full-screen layer (invisible overlays still capture clicks). */}
        {showReportForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              role="presentation"
              className="absolute inset-0"
              onClick={() => {
                setShowReportForm(false)
                setSelectedLocation(null)
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-orange-500" />
                    Report crop trouble
                  </h2>
                  <button
                    onClick={() => {
                      setShowReportForm(false)
                      setSelectedLocation(null)
                    }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Crop affected *
                    </label>
                    <input
                      type="text"
                      value={formData.crop}
                      onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                      placeholder="Corn, wheat, rice"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      What it looks like *
                    </label>
                    <input
                      type="text"
                      value={formData.disease}
                      onChange={(e) => setFormData({ ...formData, disease: e.target.value })}
                      placeholder="Rust, blight, yellowing"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      How bad is it? *
                    </label>
                    <select
                      value={formData.severity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          severity: e.target.value as 'low' | 'medium' | 'high',
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Field notes
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="How much of the field is affected? When did you notice it?"
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={handleSubmitReport}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Save className="w-5 h-5" />
                    Share report
                  </button>
                </div>
            </div>
          </div>
        )}

        {/* Reports List */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-600" />
            Shared crop reports ({reports.length})
          </h2>

          {reports.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No crop issues reported yet. Tap the map to share what you are seeing.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {report.crop} - {report.disease}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(
                            report.severity
                          )}`}
                        >
                          {report.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">
                        Location: {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
                      </p>
                      {report.description && (
                        <p className="text-sm text-slate-700">{report.description}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        Reported: {new Date(report.date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
