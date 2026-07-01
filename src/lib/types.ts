import type { Timestamp } from 'firebase/firestore'

export type UserProfile = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: Timestamp | Date
}

export type Farm = {
  id: string
  name: string
  ownerId: string
  joinCode: string
  address: string
  lat: number | null
  lng: number | null
  stateCode: string
  crops: string[]
  acreage?: number | null
  verificationStatus: 'unverified'
  createdAt: Timestamp | Date
  joinCodeUpdatedAt?: Timestamp | Date
}

export type FarmMember = {
  id: string
  farmId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinCodeUsed?: string
  approvedRequestId?: string
  joinedAt: Timestamp | Date
}

export type FarmAccessRequestStatus = 'pending' | 'approved' | 'denied' | 'expired'

export type FarmAccessRequest = {
  id: string
  farmId: string
  requesterId: string
  requesterName?: string
  requesterEmail?: string
  ownerId: string
  status: FarmAccessRequestStatus
  farmName: string
  farmStateCode: string
  farmAddress: string
  requestedAt: Timestamp | Date
  requestExpiresAt: Timestamp | Date
  resolvedAt?: Timestamp | Date
  resolvedBy?: string
}

export type FarmSearchResult = {
  id: string
  farmId: string
  ownerId: string
  name: string
  address: string
  stateCode: string
  crops: string[]
}

export type Diagnosis = {
  id: string
  userId: string
  farmId: string
  crop: string
  disease: string
  confidence: number
  detectedAt: Timestamp | Date
}
