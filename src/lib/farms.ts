'use client'

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { createFarmSchema, farmSearchSchema, joinCodeSchema } from '@/lib/security/validation'
import { getFirebaseDb } from './firebase'
import {
  buildFarmAccessRequestId,
  buildFarmMemberId,
  canLeaveFarm,
  canResolveAccessRequest,
  withDisplayAccessRequestStatus,
} from './farmAccess'
import type { Diagnosis, Farm, FarmAccessRequest, FarmMember, FarmSearchResult } from './types'

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ACCESS_REQUEST_DAYS = 30

export type CreateFarmInput = {
  name: string
  address: string
  stateCode: string
  crops: string[]
  acreage?: number | null
  lat?: number | null
  lng?: number | null
}

function makeJoinCode() {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let index = 0; index < bytes.length; index += 1) {
    code += JOIN_CODE_CHARS[bytes[index] % JOIN_CODE_CHARS.length]
  }
  return code
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildSearchTokens(farm: Pick<Farm, 'name' | 'address' | 'stateCode'>) {
  const source = normalizeSearchText(`${farm.name} ${farm.address} ${farm.stateCode}`)
  const tokens = new Set<string>()
  for (const word of source.split(' ')) {
    if (word.length >= 2) tokens.add(word.slice(0, 24))
  }
  return Array.from(tokens).slice(0, 40)
}

function requestExpiresAt() {
  return Timestamp.fromDate(new Date(Date.now() + ACCESS_REQUEST_DAYS * 24 * 60 * 60 * 1000))
}

async function createUniqueJoinCode(
  batch: ReturnType<typeof writeBatch>,
  farmId: string,
  userId: string,
  attempts = 8
) {
  const db = getFirebaseDb()
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const joinCode = makeJoinCode()
    const joinCodeRef = doc(db, 'farmJoinCodes', joinCode)
    const existingCode = await getDoc(joinCodeRef)
    if (existingCode.exists()) continue

    batch.set(joinCodeRef, {
      farmId,
      createdBy: userId,
      createdAt: serverTimestamp(),
    })
    return joinCode
  }

  throw new Error('Could not generate a unique farm join code. Please try again.')
}

export async function createFarmForUser(userId: string, input: CreateFarmInput) {
  const db = getFirebaseDb()
  const validated = createFarmSchema.parse({
    ...input,
    stateCode: input.stateCode.trim().toUpperCase(),
  })
  const farmRef = doc(collection(db, 'farms'))
  const memberRef = doc(db, 'farmMembers', buildFarmMemberId(farmRef.id, userId))
  const searchRef = doc(db, 'farmSearchIndex', farmRef.id)
  const batch = writeBatch(db)
  const joinCode = await createUniqueJoinCode(batch, farmRef.id, userId)
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
  batch.set(searchRef, {
    farmId: farmRef.id,
    ownerId: userId,
    name: validated.name,
    address: validated.address,
    stateCode: validated.stateCode,
    crops: validated.crops,
    searchTokens: buildSearchTokens({ name: validated.name, address: validated.address, stateCode: validated.stateCode }),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()

  return { id: farmRef.id, ...farmPayload } as Farm
}

export async function joinFarmByCode(userId: string, code: string) {
  const db = getFirebaseDb()
  const normalized = joinCodeSchema.parse(code)
  const farmId = await runTransaction(db, async (transaction) => {
    const joinCodeRef = doc(db, 'farmJoinCodes', normalized)
    const joinCodeSnapshot = await transaction.get(joinCodeRef)
    if (!joinCodeSnapshot.exists()) {
      throw new Error('That join code is invalid or expired. Check the code and try again.')
    }

    const joinData = joinCodeSnapshot.data() as { farmId?: string }
    if (!joinData.farmId) {
      throw new Error('That join code is invalid or expired. Check the code and try again.')
    }

    const memberRef = doc(db, 'farmMembers', buildFarmMemberId(joinData.farmId, userId))
    const memberSnapshot = await transaction.get(memberRef)
    if (memberSnapshot.exists()) {
      throw new Error('You already belong to this farm.')
    }

    transaction.set(memberRef, {
      farmId: joinData.farmId,
      userId,
      role: 'member',
      joinCodeUsed: normalized,
      joinedAt: serverTimestamp(),
    })

    return joinData.farmId
  })

  const farmDoc = await getDoc(doc(db, 'farms', farmId))
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

export async function getUserFarmSummaries(userId: string) {
  const memberships = await getUserFarmMemberships(userId)
  const farms = await getUserFarms(userId)
  const membershipByFarm = new Map(memberships.map((membership) => [membership.farmId, membership]))
  return farms.map((farm) => ({
    farm,
    membership: membershipByFarm.get(farm.id) ?? null,
  }))
}

export async function refreshFarmSearchIndex(userId: string, farm: Farm) {
  if (farm.ownerId !== userId) {
    throw new Error('Only the farm owner can update farm search settings.')
  }

  const db = getFirebaseDb()
  await setDoc(doc(db, 'farmSearchIndex', farm.id), {
    farmId: farm.id,
    ownerId: farm.ownerId,
    name: farm.name,
    address: farm.address,
    stateCode: farm.stateCode,
    crops: farm.crops,
    searchTokens: buildSearchTokens(farm),
    updatedAt: serverTimestamp(),
  })
}

export async function searchFarmsForAccess(search: string, stateCode: string) {
  const db = getFirebaseDb()
  const validated = farmSearchSchema.parse({ search, stateCode: stateCode.trim().toUpperCase() })
  const token = normalizeSearchText(validated.search).split(' ').find((word) => word.length >= 2)
  if (!token) return []

  const searchSnapshot = await getDocs(query(
    collection(db, 'farmSearchIndex'),
    where('stateCode', '==', validated.stateCode),
    where('searchTokens', 'array-contains', token.slice(0, 24)),
    limit(12)
  ))

  return searchSnapshot.docs.map((searchDoc) => ({
    id: searchDoc.id,
    ...searchDoc.data(),
  } as FarmSearchResult)).sort((a, b) => a.name.localeCompare(b.name))
}

export async function requestFarmAccess(userId: string, farm: FarmSearchResult) {
  const db = getFirebaseDb()
  const requestRef = doc(db, 'farmAccessRequests', buildFarmAccessRequestId(farm.farmId, userId))
  const memberRef = doc(db, 'farmMembers', buildFarmMemberId(farm.farmId, userId))
  const userRef = doc(db, 'users', userId)

  await runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userRef)
    if (!userSnapshot.exists()) {
      throw new Error('Finish setting up your profile before requesting farm access.')
    }
    const requesterName = userSnapshot.data().name
    const requesterEmail = userSnapshot.data().email
    if (typeof requesterName !== 'string' || requesterName.trim().length === 0) {
      throw new Error('Add your name to your profile before requesting farm access.')
    }
    if (typeof requesterEmail !== 'string' || requesterEmail.trim().length === 0) {
      throw new Error('Add your email to your profile before requesting farm access.')
    }

    const memberSnapshot = await transaction.get(memberRef)
    if (memberSnapshot.exists()) {
      throw new Error('You already belong to this farm.')
    }

    const existingRequest = await transaction.get(requestRef)
    if (existingRequest.exists()) {
      const request = existingRequest.data() as FarmAccessRequest
      if (request.status === 'pending') {
        throw new Error('You already have a pending request for this farm.')
      }
      throw new Error(`Your request for this farm is already ${request.status}.`)
    }

    transaction.set(requestRef, {
      farmId: farm.farmId,
      requesterId: userId,
      requesterName: requesterName.trim(),
      requesterEmail: requesterEmail.trim().toLowerCase(),
      ownerId: farm.ownerId,
      status: 'pending',
      farmName: farm.name,
      farmStateCode: farm.stateCode,
      farmAddress: farm.address,
      requestedAt: serverTimestamp(),
      requestExpiresAt: requestExpiresAt(),
    })
  })
}

export async function getUserFarmAccessRequests(userId: string) {
  const db = getFirebaseDb()
  const requestSnapshot = await getDocs(query(collection(db, 'farmAccessRequests'), where('requesterId', '==', userId)))
  return requestSnapshot.docs.map((requestDoc) => withDisplayAccessRequestStatus({
    id: requestDoc.id,
    ...requestDoc.data(),
  } as FarmAccessRequest))
}

export async function getPendingFarmAccessRequestsForOwner(ownerId: string) {
  const db = getFirebaseDb()
  const requestSnapshot = await getDocs(query(
    collection(db, 'farmAccessRequests'),
    where('ownerId', '==', ownerId),
    where('status', '==', 'pending')
  ))
  return requestSnapshot.docs
    .map((requestDoc) => withDisplayAccessRequestStatus({
      id: requestDoc.id,
      ...requestDoc.data(),
    } as FarmAccessRequest))
    .filter((request) => request.status === 'pending')
}

export async function approveFarmAccessRequest(ownerId: string, request: FarmAccessRequest) {
  const db = getFirebaseDb()
  if (!canResolveAccessRequest(ownerId, request)) {
    throw new Error('Only the farm owner can approve this request.')
  }

  const memberRef = doc(db, 'farmMembers', buildFarmMemberId(request.farmId, request.requesterId))
  const requestRef = doc(db, 'farmAccessRequests', request.id)

  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef)
    if (!requestSnapshot.exists()) throw new Error('This request is no longer available.')
    const currentRequest = requestSnapshot.data() as FarmAccessRequest
    if (currentRequest.status !== 'pending') throw new Error('This request has already been resolved.')

    const memberSnapshot = await transaction.get(memberRef)
    if (memberSnapshot.exists()) {
      transaction.update(requestRef, {
        status: 'approved',
        resolvedBy: ownerId,
        resolvedAt: serverTimestamp(),
      })
      return
    }

    transaction.update(requestRef, {
      status: 'approved',
      resolvedBy: ownerId,
      resolvedAt: serverTimestamp(),
    })
    transaction.set(memberRef, {
      farmId: request.farmId,
      userId: request.requesterId,
      role: 'member',
      approvedRequestId: request.id,
      joinedAt: serverTimestamp(),
    })
  })
}

export async function denyFarmAccessRequest(ownerId: string, request: FarmAccessRequest) {
  if (!canResolveAccessRequest(ownerId, request)) {
    throw new Error('Only the farm owner can deny this request.')
  }

  const db = getFirebaseDb()
  await updateDoc(doc(db, 'farmAccessRequests', request.id), {
    status: 'denied',
    resolvedBy: ownerId,
    resolvedAt: serverTimestamp(),
  })
}

export async function leaveFarm(userId: string, membership: FarmMember) {
  if (!canLeaveFarm(userId, membership)) {
    throw new Error('You can only leave farms connected to your account.')
  }

  const db = getFirebaseDb()
  await deleteDoc(doc(db, 'farmMembers', membership.id))
}

export async function regenerateFarmJoinCode(userId: string, farm: Farm) {
  if (farm.ownerId !== userId) {
    throw new Error('Only the farm owner can regenerate this join code.')
  }

  const db = getFirebaseDb()
  const batch = writeBatch(db)
  const joinCode = await createUniqueJoinCode(batch, farm.id, userId)
  batch.update(doc(db, 'farms', farm.id), {
    joinCode,
    joinCodeUpdatedAt: serverTimestamp(),
  })
  if (farm.joinCode) {
    batch.delete(doc(db, 'farmJoinCodes', farm.joinCode))
  }
  await batch.commit()
  return joinCode
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
