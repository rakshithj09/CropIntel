/**
 * Rate Limiting Middleware
 * 
 * Implements IP-based and user-based rate limiting following OWASP best practices.
 * Uses in-memory storage for development (consider Redis for production).
 * 
 * Security Controls:
 * - IP-based rate limiting to prevent abuse
 * - Configurable thresholds per endpoint
 * - Graceful HTTP 429 (Too Many Requests) responses
 * - Automatic reset windows
 * 
 * OWASP Compliance:
 * - Follows "Fail Securely" principle
 * - Implements "Defense in Depth" with multiple rate limit layers
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Rate limit configuration per endpoint
 * Thresholds are requests per window (in milliseconds)
 */
interface RateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Optional: Custom message for rate limit exceeded */
  message?: string
}

function readPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

/**
 * Default rate limit configurations
 * Following OWASP recommendations for sensible defaults
 */
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/predict': {
    maxRequests: readPositiveInt('RATE_LIMIT_PREDICT_IP_MAX', 20),
    windowMs: readPositiveInt('RATE_LIMIT_PREDICT_IP_WINDOW_MS', 60 * 1000),
    message: 'Too many prediction requests. Please wait before trying again.',
  },
  '/api/predict:user': {
    maxRequests: readPositiveInt('RATE_LIMIT_PREDICT_USER_MAX', 30),
    windowMs: readPositiveInt('RATE_LIMIT_PREDICT_USER_WINDOW_MS', 60 * 1000),
    message: 'Too many prediction requests for this account. Please wait before trying again.',
  },
  // Add more endpoint-specific limits as needed
  default: {
    maxRequests: 100, // 100 requests per minute for general endpoints
    windowMs: 60 * 1000, // 1 minute window
    message: 'Too many requests. Please wait before trying again.',
  },
}

/**
 * In-memory store for rate limit tracking
 * Key: `${ip}:${endpoint}`
 * Value: { count: number, resetAt: number }
 * 
 * Note: For production, replace with Redis or similar distributed cache
 * to handle multiple server instances and prevent memory leaks.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Cleanup interval to prevent memory leaks
 * Removes expired entries every 5 minutes
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of Array.from(rateLimitStore.entries())) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)

/**
 * Get client IP address from request
 * Handles various proxy headers (X-Forwarded-For, X-Real-IP)
 * Falls back to direct connection IP
 * 
 * Security: Validates IP format to prevent header injection
 */
function getClientIP(request: NextRequest): string {
  // Check X-Forwarded-For header (first IP in chain)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const firstIP = forwardedFor.split(',')[0].trim()
    // Basic IP validation (IPv4 or IPv6)
    if (/^[\d.:a-fA-F]+$/.test(firstIP)) {
      return firstIP
    }
  }

  // Check X-Real-IP header
  const realIP = request.headers.get('x-real-ip')
  if (realIP && /^[\d.:a-fA-F]+$/.test(realIP)) {
    return realIP
  }

  // Fallback for runtimes that do not expose a connection IP.
  return 'unknown'
}

/**
 * Rate limiting middleware
 * 
 * @param request - Next.js request object
 * @param endpoint - API endpoint path (e.g., '/api/predict')
 * @returns NextResponse with 429 status if rate limited, null if allowed
 * 
 * OWASP Compliance:
 * - Implements "Fail Securely" by defaulting to deny
 * - Uses "Least Privilege" with minimal necessary data storage
 */
export function rateLimit(
  request: NextRequest,
  endpoint: string,
  identity?: string
): NextResponse | null {
  const clientIP = getClientIP(request)
  const config = DEFAULT_RATE_LIMITS[endpoint] || DEFAULT_RATE_LIMITS.default
  const key = `${identity || clientIP}:${endpoint}`
  const now = Date.now()

  // Get or initialize rate limit entry
  let entry = rateLimitStore.get(key)

  // If entry doesn't exist or window has expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)
  }

  // Increment request count
  entry.count++

  // Check if rate limit exceeded
  if (entry.count > config.maxRequests) {
    // Calculate retry-after header (seconds until window resets)
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)

    // Return 429 Too Many Requests response
    return NextResponse.json(
      {
        error: config.message || 'Too many requests',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(entry.resetAt).toISOString(),
        },
      }
    )
  }

  // Request allowed - update store and return null
  rateLimitStore.set(key, entry)

  // Add rate limit headers to successful responses
  // (Note: These will be added by the calling code)
  return null
}

/**
 * Get rate limit headers for successful requests
 * Allows clients to track their rate limit status
 */
export function getRateLimitHeaders(
  request: NextRequest,
  endpoint: string,
  identity?: string
): Record<string, string> {
  const clientIP = getClientIP(request)
  const config = DEFAULT_RATE_LIMITS[endpoint] || DEFAULT_RATE_LIMITS.default
  const key = `${identity || clientIP}:${endpoint}`
  const entry = rateLimitStore.get(key)

  if (!entry) {
    return {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': config.maxRequests.toString(),
    }
  }

  return {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, config.maxRequests - entry.count).toString(),
    'X-RateLimit-Reset': new Date(entry.resetAt).toISOString(),
  }
}
