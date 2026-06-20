/**
 * Input Validation Schemas
 * 
 * Implements strict input validation and sanitization following OWASP best practices.
 * Uses Zod for schema-based validation with strong type checking.
 * 
 * Security Controls:
 * - Schema-based validation (rejects unexpected fields)
 * - Strong type checking
 * - Maximum and minimum length limits
 * - Sanitization to prevent injection attacks
 * - Path traversal prevention
 * 
 * OWASP Compliance:
 * - Prevents injection attacks (A03:2021)
 * - Implements "Secure Defaults" with strict validation
 * - Follows "Fail Securely" by rejecting invalid input
 */

import { z } from 'zod'

/**
 * Valid crop types (whitelist approach)
 * Prevents injection attacks by only allowing known values
 */
const VALID_CROPS = ['corn', 'rice', 'soybean', 'wheat', 'tomato'] as const

/**
 * Crop type schema
 * Validates crop parameter with strict whitelist
 */
export const cropSchema = z.enum(VALID_CROPS, {
  message: 'Invalid crop type. Must be one of: corn, rice, soybean, wheat, tomato',
})

/**
 * File upload validation schema
 * Validates image file uploads with security constraints
 * 
 * Security Measures:
 * - Maximum file size: 10MB (prevents DoS attacks)
 * - MIME type validation: images only
 * - Filename sanitization: prevents path traversal
 */
export const imageUploadSchema = z.object({
  /**
   * Image file validation
   * - Must be a File object
   * - Must be an image type
   * - Maximum size: 10MB (10 * 1024 * 1024 bytes)
   */
  image: z
    .instanceof(File, { message: 'Image file is required' })
    .refine((file) => file.size > 0, { message: 'Image file cannot be empty' })
    .refine(
      (file) => file.size <= 10 * 1024 * 1024,
      { message: 'Image file size must be less than 10MB' }
    )
    .refine(
      (file) => file.type.startsWith('image/'),
      { message: 'File must be an image (JPEG, PNG, etc.)' }
    ),
  
  /**
   * Crop type validation
   * Uses whitelist to prevent injection attacks
   */
  crop: cropSchema,
})

/**
 * Prediction request schema
 * Validates the entire prediction API request
 * 
 * Security: Rejects any extra fields (strict mode)
 */
export const predictionRequestSchema = imageUploadSchema.strict()

/**
 * Sanitize filename to prevent path traversal attacks
 * 
 * Security Measures:
 * - Removes directory separators (/, \)
 * - Removes null bytes
 * - Limits filename length
 * - Removes dangerous characters
 * 
 * @param filename - Original filename
 * @returns Sanitized filename safe for file system operations
 * 
 * OWASP: Prevents A01:2021 (Broken Access Control) via path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove directory separators and null bytes (path traversal prevention)
  let sanitized = filename
    .replace(/[\/\\]/g, '') // Remove / and \
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\.\./g, '') // Remove .. (double dot)
    .trim()

  // Limit filename length (prevent buffer overflow)
  const MAX_FILENAME_LENGTH = 255
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'))
    sanitized = sanitized.substring(0, MAX_FILENAME_LENGTH - ext.length) + ext
  }

  // Remove any remaining dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '')

  // Ensure filename is not empty
  if (!sanitized || sanitized === '.') {
    sanitized = `file-${Date.now()}`
  }

  return sanitized
}

/**
 * Validate and sanitize crop parameter
 * 
 * @param crop - Crop type string from user input
 * @returns Validated and sanitized crop type
 * @throws ZodError if validation fails
 */
export function validateCrop(crop: unknown): z.infer<typeof cropSchema> {
  return cropSchema.parse(crop)
}

/**
 * Validate prediction request
 * 
 * @param formData - FormData from request
 * @returns Validated and sanitized request data
 * @throws ZodError if validation fails
 */
export async function validatePredictionRequest(
  formData: FormData
): Promise<{ image: File; crop: z.infer<typeof cropSchema> }> {
  const image = formData.get('image')
  const crop = formData.get('crop')

  // Validate using schema (will throw if invalid)
  const validated = predictionRequestSchema.parse({
    image,
    crop,
  })

  // Additional security: Sanitize filename
  const sanitizedFilename = sanitizeFilename(validated.image.name)
  
  // Create new File object with sanitized name
  // (File objects are immutable, so we create a new one)
  const sanitizedFile = new File(
    [validated.image],
    sanitizedFilename,
    { type: validated.image.type }
  )

  return {
    image: sanitizedFile,
    crop: validated.crop,
  }
}

/**
 * Location validation schema
 * Validates geographic coordinates for outbreak reporting
 * 
 * Security: Prevents injection via coordinate values
 */
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90), // Valid latitude range
  lng: z.number().min(-180).max(180), // Valid longitude range
})

/**
 * Outbreak report validation schema
 * Validates outbreak report data
 */
export const outbreakReportSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  crop: cropSchema,
  disease: z.string().min(1).max(200), // Reasonable length limits
  severity: z.enum(['low', 'medium', 'high']),
  description: z.string().max(1000).optional(), // Optional description with length limit
}).strict()

/**
 * Farmer registration validation schema
 * Validates farmer registration data
 */
export const farmerRegistrationSchema = z.object({
  name: z.string().min(1).max(200), // Name length limits
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  crops: z.array(cropSchema).min(1).max(10), // At least 1 crop, max 10
}).strict()
