/**
 * Simple crop + US state → disease labels that are common in that region.
 * Keys must match model / UI disease names where possible. If no entry for
 * a crop+state pair, callers should fall back to unfiltered predictions.
 */

export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'IA', name: 'Iowa' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'KS', name: 'Kansas' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TX', name: 'Texas' },
  { code: 'WA', name: 'Washington' },
  { code: 'WI', name: 'Wisconsin' },
]

/** crop (lowercase) → state code → allowed disease labels (including Healthy) */
export const CROP_STATE_DISEASES: Record<string, Record<string, string[]>> = {
  corn: {
    IA: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    IL: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    NE: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    IN: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    OH: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    MN: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    MO: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    AR: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    TX: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    KS: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    SD: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
    ND: ['Common Rust', 'Gray Leaf Spot', 'Blight', 'Healthy'],
  },
  soybean: {
    IA: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    IL: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    MN: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    MO: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    AR: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    MS: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    LA: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    IN: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    OH: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
    NE: ['powdery_mildew', 'Sudden Death Syndrone', 'Yellow Mosaic', 'Healthy'],
  },
  wheat: {
    KS: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    OK: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    TX: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    NE: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    SD: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    ND: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    MN: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    MT: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    CA: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
    WA: ['Stripe (Yellow) Rust', 'Leaf Rust', 'Powdery Mildew', 'Healthy'],
  },
  // Model collapses Rice Blast + Brown Spot into one 'Blast or Brown Spot'
  // class (their lesions are visually inseparable), so labels match it here.
  rice: {
    AR: ['Blast or Brown Spot', 'Bacterial Leaf Blight', 'Healthy'],
    LA: ['Blast or Brown Spot', 'Bacterial Leaf Blight', 'Healthy'],
    MS: ['Blast or Brown Spot', 'Bacterial Leaf Blight', 'Healthy'],
    MO: ['Blast or Brown Spot', 'Bacterial Leaf Blight', 'Healthy'],
    CA: ['Blast or Brown Spot', 'Healthy'],
    TX: ['Blast or Brown Spot', 'Bacterial Leaf Blight', 'Healthy'],
    FL: ['Blast or Brown Spot', 'Healthy'],
  },
}

function norm(s: string) {
  return s.toLowerCase().trim()
}

export function getRelevantDiseasesForCropState(
  crop: string,
  stateCode: string
): string[] | null {
  const c = crop.toLowerCase()
  const st = stateCode.toUpperCase()
  const byState = CROP_STATE_DISEASES[c]
  if (!byState) return null
  const list = byState[st]
  if (!list || list.length === 0) return null
  return list
}

const CONFIDENCE_PCT_THRESHOLD = 70

export type PredictionPayload = {
  disease: string
  confidence: number
  is_healthy: boolean
  meets_threshold: boolean
  all_predictions: Array<{ disease: string; confidence: number }>
}

export function applyStateDiseaseFilter(
  raw: PredictionPayload,
  crop: string,
  stateCode: string
): PredictionPayload {
  const allowed = getRelevantDiseasesForCropState(crop, stateCode)
  if (!allowed) return raw

  const allowedSet = new Set(allowed.map(norm))
  const filtered = raw.all_predictions.filter((p) => allowedSet.has(norm(p.disease)))
  if (filtered.length === 0) return raw

  const sum = filtered.reduce((s, p) => s + p.confidence, 0) || 1
  const renorm = filtered.map((p) => ({
    disease: p.disease,
    confidence: (p.confidence / sum) * 100,
  }))
  renorm.sort((a, b) => b.confidence - a.confidence)
  const top = renorm[0]
  const isHealthy = top.disease.toLowerCase() === 'healthy'

  return {
    ...raw,
    disease: top.disease,
    confidence: top.confidence,
    is_healthy: isHealthy,
    meets_threshold: top.confidence >= CONFIDENCE_PCT_THRESHOLD,
    all_predictions: renorm,
  }
}
