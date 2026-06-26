/**
 * Next.js Middleware
 * 
 * Applies security headers to all routes.
 * Runs on every request before the page/API route is executed.
 * 
 * Security Features:
 * - Security headers for all responses
 * - CORS configuration (if needed)
 * 
 * OWASP Compliance:
 * - A05:2021 (Security Misconfiguration) - Security headers
 */

import { NextResponse } from 'next/server'
import { addSecurityHeaders } from './lib/security/headers'

export function proxy() {
  // Create response
  const response = NextResponse.next()

  // Add security headers to all responses
  return addSecurityHeaders(response)
}

// Apply middleware to all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    // Exclude static assets (include css/js so CSP middleware never touches them on odd paths)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
}
