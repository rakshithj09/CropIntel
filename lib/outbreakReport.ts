export type ReportSeverity = 'low' | 'medium' | 'high'
export type ReportStatus = 'new' | 'confirmed' | 'resolved'

export interface CropTroubleReport {
  id: string
  userId: string
  farmId: string | null
  lat: number
  lng: number
  crop: string
  issueType: string
  disease: string
  severity: ReportSeverity
  date: string
  createdAt: string
  description: string
  location: {
    lat: number | null
    lng: number | null
    stateCode: string
    generalArea: string
    precision: 'approximate' | 'county_state' | 'state'
  }
  photoUrl: string | null
  photoPath: string | null
  photoShared: boolean
  status: ReportStatus
  seeingTooCount: number
  moderationCount: number
}

export type OutbreakReport = CropTroubleReport
