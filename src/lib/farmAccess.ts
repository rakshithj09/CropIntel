import type { FarmAccessRequest, FarmAccessRequestStatus, FarmMember } from './types'

type TimestampLike = Date | { toMillis: () => number }

export function buildFarmMemberId(farmId: string, userId: string) {
  return `${farmId}_${userId}`
}

export function buildFarmAccessRequestId(farmId: string, userId: string) {
  return `${farmId}_${userId}`
}

export function timestampToMillis(value: TimestampLike) {
  return value instanceof Date ? value.getTime() : value.toMillis()
}

export function deriveAccessRequestStatus(
  status: FarmAccessRequestStatus,
  requestExpiresAt: TimestampLike,
  nowMs = Date.now()
): FarmAccessRequestStatus {
  if (status !== 'pending') return status
  return timestampToMillis(requestExpiresAt) < nowMs ? 'expired' : 'pending'
}

export function withDisplayAccessRequestStatus(request: FarmAccessRequest, nowMs = Date.now()): FarmAccessRequest {
  return {
    ...request,
    status: deriveAccessRequestStatus(request.status, request.requestExpiresAt as TimestampLike, nowMs),
  }
}

export function canLeaveFarm(userId: string, membership: Pick<FarmMember, 'userId' | 'role'>) {
  return membership.userId === userId && membership.role !== 'owner'
}

export function canResolveAccessRequest(ownerId: string, request: Pick<FarmAccessRequest, 'ownerId' | 'status'>) {
  return request.ownerId === ownerId && request.status === 'pending'
}

export function hasDuplicatePendingRequest(
  requests: Array<Pick<FarmAccessRequest, 'farmId' | 'requesterId' | 'status'>>,
  farmId: string,
  requesterId: string
) {
  return requests.some((request) =>
    request.farmId === farmId &&
    request.requesterId === requesterId &&
    request.status === 'pending'
  )
}
