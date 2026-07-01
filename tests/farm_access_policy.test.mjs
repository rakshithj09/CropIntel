import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

function memberId(farmId, userId) {
  return `${farmId}_${userId}`
}

function requestId(farmId, userId) {
  return `${farmId}_${userId}`
}

function canJoinByCode({ userId, farmId, codeFarmId, existingMembers }) {
  return codeFarmId === farmId && !existingMembers.has(memberId(farmId, userId))
}

function regenerateCode({ ownerId, actorId, oldCode, newCode, codeMap }) {
  if (ownerId !== actorId) return { ok: false, codeMap }
  const next = new Map(codeMap)
  next.delete(oldCode)
  next.set(newCode, { farmId: codeMap.get(oldCode).farmId, createdBy: actorId })
  return { ok: true, codeMap: next }
}

function requestAccess({ requesterId, ownerId, farmId, existingMembers, existingRequests }) {
  if (requesterId === ownerId) return { ok: false, reason: 'owner-self-request' }
  if (existingMembers.has(memberId(farmId, requesterId))) return { ok: false, reason: 'duplicate-membership' }
  if (existingRequests.some((request) => request.farmId === farmId && request.requesterId === requesterId && request.status === 'pending')) {
    return { ok: false, reason: 'duplicate-pending' }
  }
  return { ok: true, request: { id: requestId(farmId, requesterId), farmId, requesterId, ownerId, status: 'pending' } }
}

function resolveAccess({ actorId, request, decision, members }) {
  if (actorId !== request.ownerId || request.status !== 'pending') return { ok: false, members }
  const nextRequest = { ...request, status: decision, resolvedBy: actorId }
  const nextMembers = new Set(members)
  if (decision === 'approved') nextMembers.add(memberId(request.farmId, request.requesterId))
  return { ok: true, request: nextRequest, members: nextMembers }
}

function leaveFarm({ actorId, membership, members }) {
  if (membership.userId !== actorId || membership.role === 'owner') return { ok: false, members }
  const nextMembers = new Set(members)
  nextMembers.delete(memberId(membership.farmId, membership.userId))
  return { ok: true, members: nextMembers }
}

test('joining by code creates one membership and blocks duplicate membership', () => {
  const members = new Set()
  assert.equal(canJoinByCode({ userId: 'user-a', farmId: 'farm-a', codeFarmId: 'farm-a', existingMembers: members }), true)
  members.add(memberId('farm-a', 'user-a'))
  assert.equal(canJoinByCode({ userId: 'user-a', farmId: 'farm-a', codeFarmId: 'farm-a', existingMembers: members }), false)
})

test('code regeneration makes the old join code stop working immediately', () => {
  const codeMap = new Map([['ABC234', { farmId: 'farm-a', createdBy: 'owner-a' }]])
  const result = regenerateCode({ ownerId: 'owner-a', actorId: 'owner-a', oldCode: 'ABC234', newCode: 'XYZ789', codeMap })
  assert.equal(result.ok, true)
  assert.equal(result.codeMap.has('ABC234'), false)
  assert.equal(result.codeMap.get('XYZ789').farmId, 'farm-a')
})

test('non-owner cannot regenerate a join code', () => {
  const codeMap = new Map([['ABC234', { farmId: 'farm-a', createdBy: 'owner-a' }]])
  const result = regenerateCode({ ownerId: 'owner-a', actorId: 'user-b', oldCode: 'ABC234', newCode: 'XYZ789', codeMap })
  assert.equal(result.ok, false)
  assert.equal(result.codeMap.has('ABC234'), true)
})

test('requesting access creates pending request and blocks duplicate pending request', () => {
  const first = requestAccess({
    requesterId: 'user-a',
    ownerId: 'owner-a',
    farmId: 'farm-a',
    existingMembers: new Set(),
    existingRequests: [],
  })
  assert.equal(first.ok, true)
  assert.equal(first.request.status, 'pending')

  const second = requestAccess({
    requesterId: 'user-a',
    ownerId: 'owner-a',
    farmId: 'farm-a',
    existingMembers: new Set(),
    existingRequests: [first.request],
  })
  assert.equal(second.ok, false)
  assert.equal(second.reason, 'duplicate-pending')
})

test('owner approval creates membership and denial does not', () => {
  const request = { id: 'farm-a_user-a', farmId: 'farm-a', requesterId: 'user-a', ownerId: 'owner-a', status: 'pending' }
  const approved = resolveAccess({ actorId: 'owner-a', request, decision: 'approved', members: new Set() })
  assert.equal(approved.ok, true)
  assert.equal(approved.members.has(memberId('farm-a', 'user-a')), true)

  const denied = resolveAccess({ actorId: 'owner-a', request, decision: 'denied', members: new Set() })
  assert.equal(denied.ok, true)
  assert.equal(denied.members.has(memberId('farm-a', 'user-a')), false)
})

test('leaving a farm removes non-owner membership and blocks owner leave', () => {
  const members = new Set([memberId('farm-a', 'user-a'), memberId('farm-a', 'owner-a')])
  const memberLeave = leaveFarm({ actorId: 'user-a', membership: { farmId: 'farm-a', userId: 'user-a', role: 'member' }, members })
  assert.equal(memberLeave.ok, true)
  assert.equal(memberLeave.members.has(memberId('farm-a', 'user-a')), false)

  const ownerLeave = leaveFarm({ actorId: 'owner-a', membership: { farmId: 'farm-a', userId: 'owner-a', role: 'owner' }, members })
  assert.equal(ownerLeave.ok, false)
  assert.equal(ownerLeave.members.has(memberId('farm-a', 'owner-a')), true)
})

test('unauthorized access decisions are blocked', () => {
  const request = { id: 'farm-a_user-a', farmId: 'farm-a', requesterId: 'user-a', ownerId: 'owner-a', status: 'pending' }
  assert.equal(resolveAccess({ actorId: 'user-b', request, decision: 'approved', members: new Set() }).ok, false)
  assert.equal(leaveFarm({
    actorId: 'user-b',
    membership: { farmId: 'farm-a', userId: 'user-a', role: 'member' },
    members: new Set([memberId('farm-a', 'user-a')]),
  }).ok, false)
})

test('firestore rules enforce the farm access controls', () => {
  assert.match(rules, /memberDocId == memberId\(request\.resource\.data\.farmId, request\.resource\.data\.userId\)/)
  assert.match(rules, /!exists\(\/databases\/\$\(database\)\/documents\/farmMembers\/\$\(memberId\(farmId, requesterId\)\)\)/)
  assert.match(rules, /request\.resource\.data\.keys\(\)\.hasOnly\(\[[\s\S]*'requesterName'[\s\S]*'requesterEmail'[\s\S]*\]\)/)
  assert.match(rules, /get\(\/databases\/\$\(database\)\/documents\/users\/\$\(requesterId\)\)\.data\.name == request\.resource\.data\.requesterName/)
  assert.match(rules, /get\(\/databases\/\$\(database\)\/documents\/users\/\$\(requesterId\)\)\.data\.email == request\.resource\.data\.requesterEmail/)
  assert.match(rules, /existsAfter\(\/databases\/\$\(database\)\/documents\/farmJoinCodes\/\$\(request\.resource\.data\.joinCode\)\)/)
  assert.match(rules, /allow delete: if signedIn\(\) &&\s*resource\.data\.farmId is string &&\s*get\(\/databases\/\$\(database\)\/documents\/farms\/\$\(resource\.data\.farmId\)\)\.data\.ownerId == request\.auth\.uid;/)
  assert.match(rules, /request\.resource\.data\.status in \['approved', 'denied'\]/)
  assert.match(rules, /resource\.data\.role != 'owner'/)
  assert.match(rules, /allow delete: if signedIn\(\) && resource\.data\.userId == request\.auth\.uid;/)
  assert.match(rules, /validModerationReason\(request\.resource\.data\.reason\)/)
  assert.match(rules, /request\.resource\.data\.keys\(\)\.hasOnly\(\['userId', 'reason', 'summary', 'createdAt'\]\)/)
  assert.match(rules, /resource\.data\.userId != request\.auth\.uid/)
  assert.match(rules, /allow delete: if signedIn\(\) &&\s*get\(\/databases\/\$\(database\)\/documents\/cropTroubleReports\/\$\(reportId\)\)\.data\.userId == request\.auth\.uid;/)
  assert.doesNotMatch(rules, /request\.resource\.data\.status in \['confirmed', 'resolved'\]/)
})
