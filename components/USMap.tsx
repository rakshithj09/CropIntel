'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin } from 'lucide-react'

interface USMapProps {
  onLocationClick: (lat: number, lng: number) => void
  markers?: Array<{ lat: number; lng: number; label?: string }>
}

export default function USMap({ onLocationClick, markers = [] }: USMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return

    const rect = mapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // US map bounds (approximate)
    // Latitude: 24.396308 to 49.384358
    // Longitude: -125.0 to -66.93457
    const mapWidth = rect.width
    const mapHeight = rect.height

    // Convert pixel coordinates to lat/lng for US
    const lng = -125 + (x / mapWidth) * 58 // -125 to -67
    const lat = 49.38 - (y / mapHeight) * 25 // 49.38 to 24.39

    // Clamp to US bounds
    const clampedLat = Math.max(24.39, Math.min(49.38, lat))
    const clampedLng = Math.max(-125, Math.min(-66.93, lng))

    onLocationClick(clampedLat, clampedLng)
  }

  const projectPoint = (lat: number, lng: number, width: number, height: number) => {
    const x = ((lng + 125) / 58) * width
    const y = ((49.38 - lat) / 25) * height
    return { x, y }
  }

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border-2 border-slate-300 overflow-hidden">
      {/* US Map SVG */}
      <div
        ref={mapRef}
        onClick={handleMapClick}
        className="w-full h-full cursor-crosshair relative"
        style={{ minHeight: '500px' }}
      >
        <svg
          viewBox="0 0 1000 600"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Simplified US Map Outline */}
          <path
            d="M 100 200 L 150 180 L 200 190 L 250 200 L 300 210 L 350 220 L 400 230 L 450 240 L 500 250 L 550 260 L 600 270 L 650 280 L 700 290 L 750 300 L 800 310 L 850 320 L 900 330 L 950 340 L 900 380 L 850 400 L 800 420 L 750 440 L 700 460 L 650 480 L 600 500 L 550 520 L 500 540 L 450 550 L 400 560 L 350 570 L 300 580 L 250 580 L 200 570 L 150 550 L 100 520 L 80 480 L 70 440 L 65 400 L 70 360 L 80 320 L 90 280 L 95 240 Z"
            fill="#e0f2fe"
            stroke="#0284c7"
            strokeWidth="2"
          />
          
          {/* State boundaries (simplified) */}
          <path
            d="M 200 200 L 250 210 L 300 220 L 350 230 L 400 240 L 450 250 L 500 260 L 550 270 L 600 280 L 650 290 L 700 300 L 750 310 L 800 320 L 850 330 L 900 340 L 850 380 L 800 400 L 750 420 L 700 440 L 650 460 L 600 480 L 550 500 L 500 520 L 450 530 L 400 540 L 350 550 L 300 560 L 250 560 L 200 550 L 150 530 L 100 500 L 80 460 L 70 420 L 65 380 L 70 340 L 80 300 L 90 260 L 100 230 Z"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            opacity="0.3"
          />

          {/* Markers */}
          {isClient &&
            markers.map((marker, i) => {
              const { x, y } = projectPoint(
                marker.lat,
                marker.lng,
                1000,
                600
              )
              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill="#ef4444"
                    opacity="0.5"
                  >
                    <animate
                      attributeName="r"
                      from="6"
                      to="16"
                      dur="2s"
                      begin="0s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.5"
                      to="0"
                      dur="2s"
                      begin="0s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              )
            })}
        </svg>

        {/* Click instruction overlay */}
        <div className="absolute bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-10">
          <p className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Click on map to report outbreak
          </p>
        </div>
      </div>
    </div>
  )
}
