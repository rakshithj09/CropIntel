/**
 * Next.js Configuration
 *
 * Security enhancements:
 * - React Strict Mode enabled (development warnings)
 * - Security headers configured via middleware
 *
 * LAN / phone dev: If you set NEXT_DEV_ALLOWED_ORIGINS in .env.local, Next.js will
 * enforce that list for /_next/* (strict). If you leave it unset, Next only warns in
 * the terminal (nothing is blocked) — best default when your Wi‑Fi IP changes often.
 */

/** @type {import('next').NextConfig} */
const devOriginsFromEnv = (process.env.NEXT_DEV_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const nextConfig = {
  reactStrictMode: true,

  // Only set when you opt in — avoids blocking when your LAN IP ≠ a hardcoded value.
  ...(devOriginsFromEnv.length > 0
    ? {
        allowedDevOrigins: [...new Set([...devOriginsFromEnv, '127.0.0.1', 'localhost'])],
      }
    : {}),
  // Security: Disable X-Powered-By header
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
}

module.exports = nextConfig
