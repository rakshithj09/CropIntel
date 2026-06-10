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
 * - Path traversal prevention
 * - Security headers
 * - Secure error handling
 * 
 * OWASP Compliance:
 * - A01:2021 (Broken Access Control) - Rate limiting
 * - A03:2021 (Injection) - Input validation
 * - A05:2021 (Security Misconfiguration) - Security headers
 * - A07:2021 (Identification and Authentication Failures) - Input validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { rateLimit, getRateLimitHeaders } from '@/lib/security/rateLimiter'
import { validatePredictionRequest, sanitizeFilename } from '@/lib/security/validation'
import { createSecureResponse, addSecurityHeaders } from '@/lib/security/headers'
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

    // ========== SECURE FILE HANDLING ==========
    // Sanitize filename to prevent path traversal attacks
    // OWASP: Prevents A01:2021 (Broken Access Control)
    const sanitizedFilename = sanitizeFilename(image.name)
    
    // Save uploaded file temporarily in system temp directory
    // Use timestamp and sanitized filename to prevent collisions
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const tempPath = join(tmpdir(), `cropintel-${Date.now()}-${sanitizedFilename}`)
    
    // Write file to temporary location
    await writeFile(tempPath, buffer)

    try {
      // ========== SECURE PROCESS EXECUTION ==========
      // Call Python prediction script with validated inputs
      // Process runs in isolated child process (inherent security)
      const result = await runPrediction(tempPath, crop)
      
      // ========== SUCCESS RESPONSE ==========
      // Return result with security headers and rate limit info
      const response = createSecureResponse(result, 200)
      
      // Add rate limit headers to successful response
      const rateLimitHeaders = getRateLimitHeaders(request, '/api/predict')
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      return response
    } finally {
      // ========== CLEANUP ==========
      // Always clean up temporary files, even on error
      // OWASP: Fail securely by ensuring cleanup
      await unlink(tempPath).catch((err) => {
        // Log cleanup errors but don't fail the request
        console.error('Failed to cleanup temp file:', err)
      })
    }
  } catch (error: any) {
    // ========== ERROR HANDLING ==========
    // Log detailed error server-side but return generic message to client
    // OWASP: Prevent information disclosure
    console.error('Prediction error:', error)
    
    // Surface safe, user-actionable errors from inference.
    const errorMessage = error instanceof Error ? error.message : 'Prediction failed'
    const msg = errorMessage.toLowerCase()
    if (
      msg.includes('retake the image') ||
      msg.includes('clear plant leaf') ||
      msg.includes('appears blurry')
    ) {
      return createSecureResponse({ error: errorMessage }, 400)
    }

    // Surface model-not-ready errors so operators know to train/fetch models.
    if (msg.includes('no trained models found') || msg.includes('model not found')) {
      return createSecureResponse(
        { error: 'Model not ready. Please train or install a model for this crop before running analysis.' },
        503
      )
    }

    console.error('Unhandled prediction error:', errorMessage)
    return createSecureResponse(
      { error: 'Prediction failed. Please try again later.' },
      500
    )
  }
}

function runPrediction(imagePath: string, crop: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(process.cwd(), 'scripts', 'predict.py')
    // Use the interpreter that has TensorFlow installed. The default `python3`
    // on this machine is a venv without TF; set CROPINTEL_PYTHON to the conda
    // env (e.g. .conda-py311/bin/python) so inference works.
    const pythonBin = process.env.CROPINTEL_PYTHON || 'python3'
    const pythonProcess = spawn(pythonBin, [scriptPath, imagePath, crop])

    let stdout = ''
    let stderr = ''

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        // TF may write warnings to stderr before our JSON error line.
        // Find the last line that looks like JSON rather than parsing the whole blob.
        const stderrLines = stderr.split('\n').map((l) => l.trim()).filter(Boolean)
        const jsonLine = stderrLines.slice().reverse().find((l) => l.startsWith('{')) ?? ''
        try {
          const errorData = JSON.parse(jsonLine)
          reject(new Error(errorData.error || stderrLines.at(-1) || `Process exited with code ${code}`))
        } catch {
          reject(new Error(stderrLines.at(-1) || `Process exited with code ${code}`))
        }
        return
      }

      try {
        const result = JSON.parse(stdout)
        // Check if result has error field
        if (result.error) {
          reject(new Error(result.error))
          return
        }
        resolve(result)
      } catch (error) {
        reject(new Error(`Failed to parse prediction result. stdout: ${stdout.substring(0, 200)}`))
      }
    })
  })
}
