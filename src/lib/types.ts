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
}

export type FarmMember = {
  id: string
  farmId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinCodeUsed?: string
  joinedAt: Timestamp | Date
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
