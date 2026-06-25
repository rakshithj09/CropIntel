'use client'

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
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
  const joinCode = makeJoinCode()
  const farmRef = doc(collection(db, 'farms'))
  const memberRef = doc(db, 'farmMembers', buildMemberId(farmRef.id, userId))
  const batch = writeBatch(db)
  const farmPayload = {
    name: input.name.trim(),
    ownerId: userId,
    joinCode,
    address: input.address.trim(),
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    stateCode: input.stateCode.trim().toUpperCase(),
    crops: input.crops,
    acreage: input.acreage ?? null,
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
  await batch.commit()

  return { id: farmRef.id, ...farmPayload } as Farm
}

export async function joinFarmByCode(userId: string, code: string) {
  const db = getFirebaseDb()
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    throw new Error('Enter the six-character farm join code.')
  }

  const farmQuery = query(collection(db, 'farms'), where('joinCode', '==', normalized), limit(1))
  const farmMatches = await getDocs(farmQuery)
  if (farmMatches.empty) {
    throw new Error('That join code is invalid or expired. Check the code and try again.')
  }

  const farmDoc = farmMatches.docs[0]
  await setDoc(
    doc(db, 'farmMembers', buildMemberId(farmDoc.id, userId)),
    {
      farmId: farmDoc.id,
      userId,
      role: 'member',
      joinedAt: serverTimestamp(),
    },
    { merge: true }
  )

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
