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
export const VALID_CROPS = ['corn', 'rice', 'soybean', 'wheat', 'tomato'] as const
export const VALID_US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const

/**
 * Crop type schema
 * Validates crop parameter with strict whitelist
 */
export const cropSchema = z.enum(VALID_CROPS, {
  message: 'Invalid crop type. Must be one of: corn, rice, soybean, wheat, tomato',
})

export const usStateCodeSchema = z.enum(VALID_US_STATE_CODES, {
  message: 'Invalid state code.',
})

const trimmedString = (min: number, max: number, label: string) =>
  z.string()
    .transform((value) => value.trim())
    .pipe(z.string().min(min, `${label} is required`).max(max, `${label} is too long`))

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
      (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      { message: 'File must be a JPEG, PNG, or WebP image' }
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

export const displayNameSchema = trimmedString(1, 100, 'Name')

export const createFarmSchema = z.object({
  name: trimmedString(1, 120, 'Farm name'),
  address: trimmedString(1, 240, 'Address'),
  stateCode: usStateCodeSchema,
  crops: z.array(cropSchema).min(1, 'Select at least one crop').max(5, 'Too many crops selected'),
  acreage: z.number().min(0).max(1_000_000).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
}).strict()

export const joinCodeSchema = z.string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z2-9]{6}$/, 'Enter the six-character farm join code.'))

export const farmSearchSchema = z.object({
  search: trimmedString(2, 80, 'Farm name or location'),
  stateCode: usStateCodeSchema,
}).strict()

export const farmIdSchema = trimmedString(8, 128, 'Farm ID')

export const accessRequestStatusSchema = z.enum(['pending', 'approved', 'denied', 'expired'])

export function validateImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }

  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
  }

  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    )
  }

  return false
}
