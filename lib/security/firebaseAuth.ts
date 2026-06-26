import { NextRequest } from 'next/server'

type VerifiedFirebaseUser = {
  uid: string
  email?: string
  emailVerified?: boolean
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export async function verifyFirebaseBearerToken(request: NextRequest): Promise<VerifiedFirebaseUser | null> {
  const token = getBearerToken(request)
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!token || !apiKey) return null

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  })

  if (!response.ok) return null

  const payload = await response.json() as {
    users?: Array<{
      localId?: string
      email?: string
      emailVerified?: boolean
    }>
  }
  const user = payload.users?.[0]
  if (!user?.localId) return null

  return {
    uid: user.localId,
    email: user.email,
    emailVerified: user.emailVerified,
  }
}
