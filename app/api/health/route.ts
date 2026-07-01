/**
 * Health API Route
 *
 * Single URL for the compose healthcheck, uptime monitors, and humans.
 * Reports web-tier liveness plus the inference service's readiness
 * (per-crop model load status from /readyz).
 */

import { createSecureResponse } from '@/lib/security/headers'

const INFERENCE_URL = process.env.INFERENCE_URL || 'http://127.0.0.1:8000'

type InferenceReadiness =
  | { ready: boolean; error?: string }
  | Record<string, unknown>

export async function GET() {
  let inference: InferenceReadiness | null = null
  let healthy = false

  try {
    const upstream = await fetch(`${INFERENCE_URL}/readyz`, {
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    })
    inference = await upstream.json()
    healthy = upstream.ok
  } catch {
    inference = { ready: false, error: 'inference service unreachable' }
  }

  return createSecureResponse(
    { web: 'ok', inference },
    healthy ? 200 : 503
  )
}
