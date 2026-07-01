'use client'

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { z } from 'zod'
import {
  cropSchema,
  usStateCodeSchema,
  validateImageSignature,
} from '@/lib/security/validation'
import { getFirebaseDb, getFirebaseStorage } from './firebase'
import type { CropTroubleReport, ReportStatus } from '@/lib/outbreakReport'

const REPORT_COOLDOWN_MS = 10 * 60 * 1000
const MAX_SHARED_PHOTO_SIZE = 5 * 1024 * 1024
const SHARED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const CROP_TROUBLE_REPORT_REASONS = [
  'false_or_misleading',
  'unsafe_advice',
  'spam_or_duplicate',
  'private_information',
  'harassment_or_abuse',
  'other',
] as const
export type CropTroubleReportReason = (typeof CROP_TROUBLE_REPORT_REASONS)[number]

const createReportSchema = z.object({
  userId: z.string().min(1),
  farmId: z.string().min(1).nullable(),
  crop: cropSchema,
  issueType: z.string().trim().min(1).max(120),
  severity: z.enum(['low', 'medium', 'high']),
  description: z.string().trim().max(700),
  location: z.object({
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    stateCode: usStateCodeSchema,
    generalArea: z.string().trim().min(2).max(120),
    precision: z.enum(['approximate', 'county_state', 'state']),
  }),
  photoShared: z.boolean(),
}).strict()

export type CreateCropTroubleReportInput = z.input<typeof createReportSchema> & {
  photoFile?: File | null
}

function toIsoDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return new Date().toISOString()
}

function mapReport(id: string, data: Record<string, unknown>): CropTroubleReport {
  const rawLocation =
    data.location && typeof data.location === 'object'
      ? (data.location as CropTroubleReport['location'])
      : null
  const location: CropTroubleReport['location'] = {
    lat: typeof rawLocation?.lat === 'number' ? rawLocation.lat : null,
    lng: typeof rawLocation?.lng === 'number' ? rawLocation.lng : null,
    stateCode: typeof rawLocation?.stateCode === 'string' ? rawLocation.stateCode : '',
    generalArea: typeof rawLocation?.generalArea === 'string' ? rawLocation.generalArea : 'Nearby',
    precision:
      rawLocation?.precision === 'approximate' ||
      rawLocation?.precision === 'county_state' ||
      rawLocation?.precision === 'state'
        ? rawLocation.precision
        : 'state',
  }
  const issueType = String(data.issueType ?? data.disease ?? 'Crop trouble')
  const createdAt = toIsoDate(data.createdAt)

  return {
    id,
    userId: String(data.userId ?? ''),
    farmId: typeof data.farmId === 'string' ? data.farmId : null,
    crop: String(data.crop ?? ''),
    issueType,
    disease: issueType,
    severity: data.severity === 'high' || data.severity === 'low' ? data.severity : 'medium',
    description: typeof data.description === 'string' ? data.description : '',
    location,
    lat: typeof location?.lat === 'number' ? location.lat : 39.8283,
    lng: typeof location?.lng === 'number' ? location.lng : -98.5795,
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : null,
    photoPath: typeof data.photoPath === 'string' ? data.photoPath : null,
    photoShared: data.photoShared === true,
    createdAt,
    date: createdAt,
    status: ['new', 'confirmed', 'resolved'].includes(String(data.status))
      ? (data.status as ReportStatus)
      : 'new',
    seeingTooCount: typeof data.seeingTooCount === 'number' ? data.seeingTooCount : 0,
    moderationCount: typeof data.moderationCount === 'number' ? data.moderationCount : 0,
  }
}

async function assertValidSharedPhoto(file: File) {
  if (!SHARED_PHOTO_TYPES.includes(file.type as (typeof SHARED_PHOTO_TYPES)[number])) {
    throw new Error('Use a JPEG, PNG, or WebP photo.')
  }
  if (file.size <= 0 || file.size > MAX_SHARED_PHOTO_SIZE) {
    throw new Error('Use a photo smaller than 5 MB.')
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!validateImageSignature(bytes, file.type)) {
    throw new Error('That photo type is not supported.')
  }
}

export async function createCropTroubleReport(input: CreateCropTroubleReportInput) {
  const db = getFirebaseDb()
  const storage = getFirebaseStorage()
  const { photoFile, ...reportInput } = input
  const validated = createReportSchema.parse(reportInput)
  const rateLimitRef = doc(db, 'reportRateLimits', validated.userId)
  const rateSnapshot = await getDoc(rateLimitRef)
  const lastReportAt = rateSnapshot.exists() ? rateSnapshot.data().lastReportAt : null

  if (lastReportAt instanceof Timestamp && Date.now() - lastReportAt.toMillis() < REPORT_COOLDOWN_MS) {
    throw new Error('Please wait a few minutes before sending another report.')
  }

  const reportRef = doc(collection(db, 'cropTroubleReports'))
  let photoUrl: string | null = null
  let photoPath: string | null = null

  try {
    if (validated.photoShared && photoFile) {
      await assertValidSharedPhoto(photoFile)
      photoPath = `cropTroubleReports/${reportRef.id}/shared-photo`
      const photoRef = ref(storage, photoPath)
      await uploadBytes(photoRef, photoFile, {
        contentType: photoFile.type,
        customMetadata: {
          ownerId: validated.userId,
          reportId: reportRef.id,
        },
      })
      photoUrl = await getDownloadURL(photoRef)
    }

    await runTransaction(db, async (transaction) => {
      const latestRateSnapshot = await transaction.get(rateLimitRef)
      const latestLastReportAt = latestRateSnapshot.exists()
        ? latestRateSnapshot.data().lastReportAt
        : null

      if (latestLastReportAt instanceof Timestamp && Date.now() - latestLastReportAt.toMillis() < REPORT_COOLDOWN_MS) {
        throw new Error('Please wait a few minutes before sending another report.')
      }

      transaction.set(reportRef, {
        userId: validated.userId,
        farmId: validated.farmId,
        crop: validated.crop,
        issueType: validated.issueType,
        disease: validated.issueType,
        severity: validated.severity,
        description: validated.description,
        location: validated.location,
        photoUrl,
        photoPath,
        photoShared: validated.photoShared && Boolean(photoUrl),
        createdAt: serverTimestamp(),
        status: 'new',
        seeingTooCount: 0,
        moderationCount: 0,
      })
      transaction.set(rateLimitRef, {
        userId: validated.userId,
        lastReportAt: serverTimestamp(),
      })
    })
  } catch (error) {
    if (photoPath) {
      await deleteObject(ref(storage, photoPath)).catch(() => undefined)
    }
    throw error
  }

  return reportRef.id
}

export async function getNearbyCropTroubleReports(stateCode: string) {
  const db = getFirebaseDb()
  const normalizedState = usStateCodeSchema.parse(stateCode.trim().toUpperCase())
  const snapshot = await getDocs(
    query(collection(db, 'cropTroubleReports'), where('location.stateCode', '==', normalizedState), limit(50))
  )
  return snapshot.docs
    .map((reportDoc) => mapReport(reportDoc.id, reportDoc.data()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 25)
}

export async function markSeeingToo(reportId: string, userId: string) {
  const db = getFirebaseDb()
  const reportRef = doc(db, 'cropTroubleReports', reportId)
  const seeingRef = doc(db, 'cropTroubleReports', reportId, 'seeingToo', userId)

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(seeingRef)
    if (existing.exists()) return false

    const reportSnapshot = await transaction.get(reportRef)
    if (!reportSnapshot.exists()) throw new Error('That report is no longer available.')
    if (reportSnapshot.data().userId === userId) {
      throw new Error('You cannot count your own alert.')
    }

    const currentCount = reportSnapshot.data().seeingTooCount
    transaction.set(seeingRef, { userId, createdAt: serverTimestamp() })
    transaction.update(reportRef, {
      seeingTooCount: (typeof currentCount === 'number' ? currentCount : 0) + 1,
    })
    return true
  })
}

export async function flagCropTroubleReport(
  reportId: string,
  userId: string,
  reason: CropTroubleReportReason,
  summary: string
) {
  const db = getFirebaseDb()
  const reportRef = doc(db, 'cropTroubleReports', reportId)
  const moderationRef = doc(db, 'cropTroubleReports', reportId, 'moderationReports', userId)
  const normalizedSummary = summary.trim().slice(0, 280)

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(moderationRef)
    if (existing.exists()) return false

    const reportSnapshot = await transaction.get(reportRef)
    if (!reportSnapshot.exists()) throw new Error('That report is no longer available.')
    if (reportSnapshot.data().userId === userId) {
      throw new Error('You cannot report your own alert.')
    }

    const currentCount = reportSnapshot.data().moderationCount
    transaction.set(moderationRef, { userId, reason, summary: normalizedSummary, createdAt: serverTimestamp() })
    transaction.update(reportRef, {
      moderationCount: (typeof currentCount === 'number' ? currentCount : 0) + 1,
    })
    return true
  })
}

async function deleteSubcollectionDocs(reportRef: ReturnType<typeof doc>, subcollection: 'seeingToo' | 'moderationReports') {
  const db = getFirebaseDb()
  const snapshot = await getDocs(collection(reportRef, subcollection))
  if (snapshot.empty) return

  let batch = writeBatch(db)
  let ops = 0

  for (const childDoc of snapshot.docs) {
    batch.delete(childDoc.ref)
    ops += 1

    if (ops === 450) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }

  if (ops > 0) {
    await batch.commit()
  }
}

export async function deleteCropTroubleReport(reportId: string, userId: string) {
  const db = getFirebaseDb()
  const storage = getFirebaseStorage()
  const reportRef = doc(db, 'cropTroubleReports', reportId)
  const reportSnapshot = await getDoc(reportRef)

  if (!reportSnapshot.exists()) throw new Error('That report is no longer available.')

  const report = reportSnapshot.data()
  if (report.userId !== userId) {
    throw new Error('Only the person who made this alert can delete it.')
  }

  await deleteSubcollectionDocs(reportRef, 'seeingToo')
  await deleteSubcollectionDocs(reportRef, 'moderationReports')
  await deleteDoc(reportRef)

  if (typeof report.photoPath === 'string' && report.photoPath) {
    await deleteObject(ref(storage, report.photoPath)).catch(() => undefined)
  }
}
