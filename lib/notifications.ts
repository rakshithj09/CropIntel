/**
 * Notification system for alerting farmers about nearby outbreaks
 */

export interface OutbreakLocation {
  id: string
  lat: number
  lng: number
  crop: string
  disease: string
  severity: 'low' | 'medium' | 'high'
  date: string
  description: string
}

export interface FarmerLocation {
  id: string
  name: string
  email?: string
  lat: number
  lng: number
  crops: string[] // Crops they're interested in
  radius: number // Alert radius in miles (default 250)
}

export interface Notification {
  id: string
  farmerId: string
  outbreakId: string
  distance: number // Distance in miles
  message: string
  severity: 'low' | 'medium' | 'high'
  read: boolean
  createdAt: string
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Check if a farmer should be notified about an outbreak
 */
export function shouldNotifyFarmer(
  farmer: FarmerLocation,
  outbreak: OutbreakLocation
): boolean {
  // Check if farmer is interested in this crop
  if (!farmer.crops.includes(outbreak.crop.toLowerCase())) {
    return false
  }

  // Calculate distance
  const distance = calculateDistance(
    farmer.lat,
    farmer.lng,
    outbreak.lat,
    outbreak.lng
  )

  // Check if within alert radius
  return distance <= farmer.radius
}

/**
 * Generate notification message for an outbreak
 */
export function generateNotificationMessage(
  outbreak: OutbreakLocation,
  distance: number
): string {
  const severityEmoji =
    outbreak.severity === 'high' ? '🔴' : outbreak.severity === 'medium' ? '🟠' : '🟡'
  
  return `${severityEmoji} ${outbreak.severity.toUpperCase()} ALERT: ${outbreak.disease} detected in ${outbreak.crop} ${distance.toFixed(1)} miles away`
}

/**
 * Find all farmers who should be notified about an outbreak
 */
export function findAffectedFarmers(
  outbreak: OutbreakLocation,
  farmers: FarmerLocation[]
): Array<{ farmer: FarmerLocation; distance: number }> {
  const affected: Array<{ farmer: FarmerLocation; distance: number }> = []

  for (const farmer of farmers) {
    if (shouldNotifyFarmer(farmer, outbreak)) {
      const distance = calculateDistance(
        farmer.lat,
        farmer.lng,
        outbreak.lat,
        outbreak.lng
      )
      affected.push({ farmer, distance })
    }
  }

  // Sort by distance (closest first)
  return affected.sort((a, b) => a.distance - b.distance)
}

/**
 * Create notifications for affected farmers
 */
export function createNotifications(
  outbreak: OutbreakLocation,
  affectedFarmers: Array<{ farmer: FarmerLocation; distance: number }>
): Notification[] {
  return affectedFarmers.map(({ farmer, distance }) => ({
    id: `${outbreak.id}-${farmer.id}-${Date.now()}`,
    farmerId: farmer.id,
    outbreakId: outbreak.id,
    distance,
    message: generateNotificationMessage(outbreak, distance),
    severity: outbreak.severity,
    read: false,
    createdAt: new Date().toISOString(),
  }))
}
