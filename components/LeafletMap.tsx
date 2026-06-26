'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

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

interface LeafletMapProps {
  reports?: OutbreakReport[]
  onMapClick?: (lat: number, lng: number) => void
}

// Component to handle map clicks
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onClick) {
        onClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

export default function LeafletMap({ reports = [], onMapClick }: LeafletMapProps) {
  useEffect(() => {
    // Ensure we're in the browser
    if (typeof window === 'undefined') return
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#ef4444'
      case 'medium':
        return '#f97316'
      case 'low':
        return '#eab308'
      default:
        return '#64748b'
    }
  }

  const createMarkerIcon = (severity: string) => {
    const color = getSeverityColor(severity)
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: 20px;
        height: 20px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
  }

  return (
    <MapContainer
      center={[39.8283, -98.5795]} // Center of US
      zoom={4}
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      maxBounds={[
        [24.39, -125], // Southwest corner
        [49.38, -66.93], // Northeast corner
      ]}
      minZoom={4}
      maxZoom={10}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapClickHandler onClick={onMapClick || (() => {})} />

      {/* Markers for existing reports */}
      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={createMarkerIcon(report.severity)}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-lg mb-1">
                {report.crop} - {report.disease}
              </h3>
              <p className="text-sm text-gray-600 mb-1">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    report.severity === 'high'
                      ? 'bg-red-100 text-red-800'
                      : report.severity === 'medium'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {report.severity.toUpperCase()}
                </span>
              </p>
              {report.description && (
                <p className="text-sm text-gray-700 mt-2">{report.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {new Date(report.date).toLocaleString()}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
