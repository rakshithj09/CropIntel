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
  // Names must match the soybean model's class_names exactly (Bacterial Pustule,
  // Frogeye Leaf Spot, Rust, Sudden Death Syndrome, Target Leaf Spot, Yellow
  // Mosaic, Healthy). This list is used by applyRegionalPrior as a *soft* regional
  // prior (common vs. uncommon): if a name doesn't match what the model emits,
  // it won't receive the 'common' boost for that region. Soybean rust is a
  // southern-belt disease, so it's only listed for southern states.
  soybean: {
    IA: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Healthy'],
    IL: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Healthy'],
    MN: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Healthy'],
    IN: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Healthy'],
    OH: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Healthy'],
    NE: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Healthy'],
    MO: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Rust', 'Healthy'],
    AR: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Rust', 'Healthy'],
    MS: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Rust', 'Healthy'],
    LA: ['Frogeye Leaf Spot', 'Sudden Death Syndrome', 'Bacterial Pustule', 'Target Leaf Spot', 'Yellow Mosaic', 'Rust', 'Healthy'],
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
  /** True when the model can't confidently match any disease in our catalog. */
  not_in_catalog?: boolean
  /** Farmer-facing explanation shown when not_in_catalog is true. */
  catalog_message?: string
  /** True when applyRegionalPrior actually adjusted the result for the region. */
  region_adjusted?: boolean
  /** The model's own top label + confidence, before any regional adjustment. */
  model_disease?: string
  model_confidence?: number
}

function toConfidencePercent(value: number): number {
  if (value > 0 && value <= 1) return value * 100
  return value
}

export function normalizePredictionPayload<T extends PredictionPayload>(raw: T): T {
  const predictionsAsPercent = raw.all_predictions.map((pred) => ({
    disease: pred.disease,
    confidence: Math.max(0, toConfidencePercent(pred.confidence)),
  }))
  const predictionTotal = predictionsAsPercent.reduce((sum, pred) => sum + pred.confidence, 0)
  const all_predictions = predictionsAsPercent
    .map((pred) => ({
      disease: pred.disease,
      confidence: predictionTotal > 0 ? (pred.confidence / predictionTotal) * 100 : pred.confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence)

  if (all_predictions.length === 0) {
    const confidence = toConfidencePercent(raw.confidence)
    return {
      ...raw,
      confidence,
      meets_threshold: confidence >= CONFIDENCE_PCT_THRESHOLD,
    }
  }

  const top = all_predictions[0]
  const topConfidence = Math.min(100, Math.max(0, top.confidence))
  const meetsThreshold = topConfidence >= CONFIDENCE_PCT_THRESHOLD

  return {
    ...raw,
    disease: top.disease,
    confidence: topConfidence,
    is_healthy: norm(top.disease) === 'healthy',
    meets_threshold: meetsThreshold,
    not_in_catalog: meetsThreshold ? false : raw.not_in_catalog,
    catalog_message: meetsThreshold ? '' : raw.catalog_message,
    all_predictions,
  }
}

/**
 * Regional-prior tunables — deliberately gentle. The prior only NUDGES the
 * model's output toward what's regionally common; it can never override a
 * confident image.
 *
 *  - PRIOR_STRENGTH (α): exponent on each disease's regional weight, used as
 *    `score = model_score × weight^α`. 0 → prior ignored; 1 → full weight.
 *  - WEIGHT_COMMON / WEIGHT_UNCOMMON: relative weight for a disease that is vs.
 *    isn't regionally common. UNCOMMON is non-zero so nothing is ever ruled out.
 *  - MAX_TOP_SHIFT_PP: hard cap. After adjusting, the distribution is blended
 *    back toward the original so NO class moves more than this many percentage
 *    points. This is the "don't shift it a ton" guarantee.
 *
 * The prior is binary today (common vs. not, derived from CROP_STATE_DISEASES).
 * To make it finer, swap that table for explicit per-disease weights and read
 * them here instead of WEIGHT_COMMON/WEIGHT_UNCOMMON.
 */
const PRIOR_STRENGTH = 0.3
const WEIGHT_COMMON = 1.0
const WEIGHT_UNCOMMON = 0.45
const MAX_TOP_SHIFT_PP = 10

/**
 * Soft regional prior (replaces the old hard filter). Rather than deleting
 * diseases not listed for a crop+state, it down-weights them and renormalizes,
 * giving a gentle, capped re-ranking. Returns `raw` untouched when there's no
 * regional data for this crop+state (e.g. tomato, or an uncovered state).
 */
export function applyRegionalPrior(
  raw: PredictionPayload,
  crop: string,
  stateCode: string
): PredictionPayload {
  raw = normalizePredictionPayload(raw)
  const allowed = getRelevantDiseasesForCropState(crop, stateCode)
  const preds = raw.all_predictions
  if (!allowed || !preds || preds.length === 0) return raw

  const allowedSet = new Set(allowed.map(norm))

  // Original distribution, normalized to percentages for a fair comparison.
  const origSum = preds.reduce((s, p) => s + p.confidence, 0) || 1
  const orig = preds.map((p) => ({ disease: p.disease, pct: (p.confidence / origSum) * 100 }))

  // Posterior ∝ model_score × weight^α, renormalized.
  const weighted = orig.map((p) => {
    const w = allowedSet.has(norm(p.disease)) ? WEIGHT_COMMON : WEIGHT_UNCOMMON
    return p.pct * Math.pow(w, PRIOR_STRENGTH)
  })
  const wSum = weighted.reduce((s, x) => s + x, 0) || 1
  const adjusted = weighted.map((x) => (x / wSum) * 100)

  // Cap: blend the adjusted distribution back toward the original so the largest
  // single-class change is ≤ MAX_TOP_SHIFT_PP. Both sum to 100, so the blend
  // stays normalized.
  const maxDelta = adjusted.reduce((m, pct, i) => Math.max(m, Math.abs(pct - orig[i].pct)), 0)
  const t = maxDelta > MAX_TOP_SHIFT_PP ? MAX_TOP_SHIFT_PP / maxDelta : 1

  const finalPreds = orig
    .map((p, i) => ({ disease: p.disease, confidence: p.pct + t * (adjusted[i] - p.pct) }))
    .sort((a, b) => b.confidence - a.confidence)

  const top = finalPreds[0]
  const origTop = [...orig].sort((a, b) => b.pct - a.pct)[0]

  return normalizePredictionPayload({
    ...raw,
    disease: top.disease,
    confidence: top.confidence,
    is_healthy: top.disease.toLowerCase() === 'healthy',
    meets_threshold: top.confidence >= CONFIDENCE_PCT_THRESHOLD,
    all_predictions: finalPreds,
    region_adjusted: true,
    model_disease: origTop.disease,
    model_confidence: origTop.pct,
  })
}
