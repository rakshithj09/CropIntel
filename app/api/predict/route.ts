/**
 * Prediction API Route
 *
 * Secure API endpoint for crop disease prediction.
 * Implements comprehensive security measures following OWASP best practices.
 *
 * Security Features:
 * - Rate limiting (IP-based)
 * - Input validation and sanitization
 * - File upload security (size limits, type validation)
 * - Security headers
 * - Secure error handling
 *
 * OWASP Compliance:
 * - A01:2021 (Broken Access Control) - Rate limiting
 * - A03:2021 (Injection) - Input validation
 * - A05:2021 (Security Misconfiguration) - Security headers
 * - A07:2021 (Identification and Authentication Failures) - Input validation
 *
 * Inference is served by the persistent Python service (ml/serve/inference_app.py)
 * over localhost HTTP — models stay loaded in memory between requests.
 */

import { NextRequest } from 'next/server'
import { rateLimit, getRateLimitHeaders } from '@/lib/security/rateLimiter'
import { validatePredictionRequest } from '@/lib/security/validation'
import { createSecureResponse, addSecurityHeaders } from '@/lib/security/headers'
import { getInferenceUrl } from '@/lib/server/inferenceUrl'
import { ZodError } from 'zod'

/**
 * Maximum file size: 10MB
 * Prevents DoS attacks via large file uploads
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Allowed image MIME types (whitelist approach)
 * Prevents malicious file uploads
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]

/** Upstream timeout — model inference is fast; this guards a hung service. */
const INFERENCE_TIMEOUT_MS = 30_000

/**
 * Validate file content by checking MIME type
 * Additional security layer beyond client-side validation
 *
 * @param file - File object to validate
 * @returns true if file is valid image, false otherwise
 */
function validateFileContent(file: File): boolean {
  // Check MIME type against whitelist
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return false
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return false
  }

  // Check file is not empty
  if (file.size === 0) {
    return false
  }

  return true
}

export async function POST(request: NextRequest) {
  // ========== RATE LIMITING ==========
  // Apply rate limiting before processing request
  // OWASP: Fail securely by blocking excessive requests
  const rateLimitResponse = rateLimit(request, '/api/predict')
  if (rateLimitResponse) {
    return addSecurityHeaders(rateLimitResponse)
  }

  try {
    let inferenceUrl: string
    try {
      inferenceUrl = getInferenceUrl()
    } catch (error: any) {
      console.error('Inference service misconfigured:', error)
      return createSecureResponse(
        { error: 'Prediction service is not configured. Please set INFERENCE_URL.' },
        503
      )
    }

    // ========== INPUT VALIDATION ==========
    // Parse and validate form data using schema-based validation
    // OWASP: Prevents injection attacks via strict validation
    const formData = await request.formData()

    let validatedData
    try {
      validatedData = await validatePredictionRequest(formData)
    } catch (error) {
      // Handle validation errors gracefully
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((e) => e.message).join(', ')
        return createSecureResponse(
          { error: `Validation failed: ${errorMessages}` },
          400
        )
      }
      throw error // Re-throw unexpected errors
    }

    const { image, crop } = validatedData

    // ========== FILE CONTENT VALIDATION ==========
    // Additional server-side validation beyond schema validation
    // OWASP: Defense in depth - multiple validation layers
    if (!validateFileContent(image)) {
      return createSecureResponse(
        {
          error: 'Invalid file. Must be a valid image (JPEG, PNG, WebP, GIF) under 10MB.',
        },
        400
      )
    }

    // ========== INFERENCE SERVICE CALL ==========
    // Forward the validated upload to the persistent inference service.
    const upstreamForm = new FormData()
    upstreamForm.append('image', image)
    upstreamForm.append('crop', crop)
    // Optional: user insisted the crop is correct after a wrong-crop block.
    const skipCropCheck = formData.get('skip_crop_check')
    if (typeof skipCropCheck === 'string' && skipCropCheck) {
      upstreamForm.append('skip_crop_check', skipCropCheck)
    }

    let upstream: Response
    try {
      upstream = await fetch(`${inferenceUrl}/predict`, {
        method: 'POST',
        body: upstreamForm,
        signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS),
      })
    } catch (error) {
      // Service down or timed out — operators should check the inference process.
      console.error('Inference service unreachable:', error)
      return createSecureResponse(
        { error: 'Prediction service unavailable. Please try again shortly.' },
        503
      )
    }

    let result: any
    try {
      result = await upstream.json()
    } catch {
      console.error('Inference service returned non-JSON, status:', upstream.status)
      return createSecureResponse(
        { error: 'Prediction failed. Please try again later.' },
        500
      )
    }

    if (!upstream.ok) {
      const errorMessage: string = result?.error || 'Prediction failed'
      const msg = errorMessage.toLowerCase()

      // User-actionable image problems (quality checks) — pass through as-is.
      if (
        msg.includes('retake the image') ||
        msg.includes('clear plant leaf') ||
        msg.includes('appears blurry')
      ) {
        return createSecureResponse({ error: errorMessage }, 400)
      }

      // Model-not-ready — tell operators to train/fetch models.
      if (msg.includes('no trained models found') || msg.includes('model not found')) {
        return createSecureResponse(
          { error: 'Model not ready. Please train or install a model for this crop before running analysis.' },
          503
        )
      }

      console.error('Unhandled inference error:', upstream.status, errorMessage)
      return createSecureResponse(
        { error: 'Prediction failed. Please try again later.' },
        upstream.status >= 500 ? 500 : 400
      )
    }

    // ========== SUCCESS RESPONSE ==========
    // Return result with security headers and rate limit info
    const response = createSecureResponse(result, 200)

    // Add rate limit headers to successful response
    const rateLimitHeaders = getRateLimitHeaders(request, '/api/predict')
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error: any) {
    // ========== ERROR HANDLING ==========
    // Log detailed error server-side but return generic message to client
    // OWASP: Prevent information disclosure
    console.error('Prediction error:', error)
    return createSecureResponse(
      { error: 'Prediction failed. Please try again later.' },
      500
    )
  }
}
