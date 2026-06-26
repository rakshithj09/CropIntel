'use client'

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { createFarmSchema, joinCodeSchema } from '@/lib/security/validation'
import { getFirebaseDb } from './firebase'
import type { Diagnosis, Farm, FarmMember } from './types'

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type CreateFarmInput = {
  name: string
  address: string
  stateCode: string
  crops: string[]
  acreage?: number | null
  lat?: number | null
  lng?: number | null
}

function buildMemberId(farmId: string, userId: string) {
  return `${farmId}_${userId}`
}

function makeJoinCode() {
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)]
  }
  return code
}

export async function createFarmForUser(userId: string, input: CreateFarmInput) {
  const db = getFirebaseDb()
  const validated = createFarmSchema.parse({
    ...input,
    stateCode: input.stateCode.trim().toUpperCase(),
  })
  const joinCode = makeJoinCode()
  const farmRef = doc(collection(db, 'farms'))
  const memberRef = doc(db, 'farmMembers', buildMemberId(farmRef.id, userId))
  const joinCodeRef = doc(db, 'farmJoinCodes', joinCode)
  const batch = writeBatch(db)
  const farmPayload = {
    name: validated.name,
    ownerId: userId,
    joinCode,
    address: validated.address,
    lat: validated.lat ?? null,
    lng: validated.lng ?? null,
    stateCode: validated.stateCode,
    crops: validated.crops,
    acreage: validated.acreage ?? null,
    verificationStatus: 'unverified',
    createdAt: serverTimestamp(),
  }

  batch.set(farmRef, farmPayload)
  batch.set(memberRef, {
    farmId: farmRef.id,
    userId,
    role: 'owner',
    joinedAt: serverTimestamp(),
  })
  batch.set(joinCodeRef, {
    farmId: farmRef.id,
    createdBy: userId,
    createdAt: serverTimestamp(),
  })
  await batch.commit()

  return { id: farmRef.id, ...farmPayload } as Farm
}

export async function joinFarmByCode(userId: string, code: string) {
  const db = getFirebaseDb()
  const normalized = joinCodeSchema.parse(code)
  const joinCodeSnapshot = await getDoc(doc(db, 'farmJoinCodes', normalized))
  if (!joinCodeSnapshot.exists()) {
    throw new Error('That join code is invalid or expired. Check the code and try again.')
  }

  const joinData = joinCodeSnapshot.data() as { farmId?: string }
  if (!joinData.farmId) {
    throw new Error('That join code is invalid or expired. Check the code and try again.')
  }

  await setDoc(
    doc(db, 'farmMembers', buildMemberId(joinData.farmId, userId)),
    {
      farmId: joinData.farmId,
      userId,
      role: 'member',
      joinCodeUsed: normalized,
      joinedAt: serverTimestamp(),
    },
    { merge: true }
  )

  const farmDoc = await getDoc(doc(db, 'farms', joinData.farmId))
  if (!farmDoc.exists()) {
    throw new Error('That farm is no longer available.')
  }

  return { id: farmDoc.id, ...farmDoc.data() } as Farm
}

export async function getUserFarmMemberships(userId: string) {
  const db = getFirebaseDb()
  const membershipSnapshot = await getDocs(query(collection(db, 'farmMembers'), where('userId', '==', userId)))
  return membershipSnapshot.docs.map((memberDoc) => ({
    id: memberDoc.id,
    ...memberDoc.data(),
  })) as FarmMember[]
}

export async function getUserFarms(userId: string) {
  const db = getFirebaseDb()
  const memberships = await getUserFarmMemberships(userId)
  if (memberships.length === 0) return []

  const farms = await Promise.all(
    memberships.map(async (membership) => {
      const farmDoc = await getDoc(doc(db, 'farms', membership.farmId))
      if (!farmDoc.exists()) return null
      return { id: farmDoc.id, ...farmDoc.data() } as Farm
    })
  )

  return farms.filter((farm): farm is Farm => farm !== null)
}

export async function saveDiagnosis(input: Omit<Diagnosis, 'id' | 'detectedAt'>) {
  const db = getFirebaseDb()
  await addDoc(collection(db, 'diagnoses'), {
    userId: input.userId,
    farmId: input.farmId,
    crop: input.crop,
    disease: input.disease,
    confidence: input.confidence,
    detectedAt: serverTimestamp(),
  })
}
