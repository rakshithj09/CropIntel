import { getDiseaseInfo } from '@/lib/diseaseInfo'

export type HealthTrend = 'improving' | 'worsening' | 'no_change'

/** Minimal shape we need from a prediction to estimate health. */
export interface HealthInput {
  disease: string
  is_healthy: boolean
  confidence?: number
  all_predictions?: Array<{ disease: string; confidence: number }>
}

/** Result of comparing two checks — scores exposed so the UI can show numbers. */
export interface HealthComparison {
  trend: HealthTrend
  pastScore: number
  currentScore: number
  /** currentScore - pastScore. Positive = healthier, negative = worse. */
  delta: number
}

/**
 * Per-class health anchor (higher = healthier tissue). Driven by each disease's
 * severity so a high-severity disease pulls the score down hard.
 */
function classHealth(disease: string, crop: string): number {
  if (!disease || disease.toLowerCase() === 'healthy') return 100
  const sev = getDiseaseInfo(disease, crop)?.severity
  if (sev === 'high') return 12
  if (sev === 'medium') return 45
  if (sev === 'low') return 72
  return 50 // unknown disease: neutral-low
}

/**
 * Continuous 0–100 health estimate.
 *
 * The previous version mapped a prediction to one of four fixed severity
 * buckets, so two checks of the SAME disease always scored identically and the
 * comparison reported "no change" almost every time. Instead we take the
 * EXPECTED health across the model's full probability distribution: as the model
 * grows more certain of a disease (or probability mass shifts away from
 * "Healthy"), the score moves even when the top label is unchanged. This is the
 * reliable signal the model actually provides.
 */
export function healthScore(pred: HealthInput, crop: string): number {
  const dist = (pred.all_predictions ?? []).filter(
    (p) => p && typeof p.confidence === 'number' && !Number.isNaN(p.confidence),
  )
  if (dist.length > 0) {
    // Scale-agnostic: normalize by the total so 0–1 and 0–100 inputs both work,
    // and a partial (top-N) distribution still yields a weighted average.
    const total = dist.reduce((s, p) => s + Math.max(0, p.confidence), 0) || 1
    const expected = dist.reduce(
      (s, p) => s + (Math.max(0, p.confidence) / total) * classHealth(p.disease, crop),
      0,
    )
    return Math.round(Math.min(100, Math.max(0, expected)))
  }
  // Fallback when no distribution is available: blend the top label's anchor
  // toward neutral by how confident the model is.
  const base = pred.is_healthy ? 100 : classHealth(pred.disease, crop)
  const conf = typeof pred.confidence === 'number'
    ? pred.confidence > 1 ? pred.confidence / 100 : pred.confidence
    : 1
  const neutral = 55
  return Math.round(neutral + (base - neutral) * Math.min(1, Math.max(0, conf)))
}

/** Below this absolute change we call it "no change" (was effectively ~bucket). */
const CHANGE_THRESHOLD = 7

export function compareHealth(
  past: HealthInput,
  current: HealthInput,
  crop: string,
): HealthComparison {
  const pastScore = healthScore(past, crop)
  const currentScore = healthScore(current, crop)
  const delta = currentScore - pastScore
  let trend: HealthTrend = 'no_change'
  if (delta >= CHANGE_THRESHOLD) trend = 'improving'
  else if (delta <= -CHANGE_THRESHOLD) trend = 'worsening'
  return { trend, pastScore, currentScore, delta }
}

export function trendLabel(t: HealthTrend): string {
  switch (t) {
    case 'improving':
      return 'Improving'
    case 'worsening':
      return 'Worsening'
    case 'no_change':
      return 'About the same'
  }
}

/** One-line, farmer-facing explanation of the comparison. */
export function trendDetail(c: HealthComparison): string {
  const mag = Math.abs(c.delta)
  if (c.trend === 'no_change') {
    return 'The two checks look about the same. Keep scouting and recheck in a few days.'
  }
  const strength = mag >= 25 ? 'clearly' : mag >= 14 ? 'noticeably' : 'slightly'
  if (c.trend === 'improving') {
    return `Today's check looks ${strength} healthier than the earlier photo. Keep monitoring before changing anything.`
  }
  return `Today's check looks ${strength} worse than the earlier photo. Scout the field and confirm before treating.`
}
