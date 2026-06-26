'use client'

import { AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react'

interface CropMismatchBlockProps {
  /** Crop the user selected (lowercase, e.g. "corn"). */
  selectedCrop: string
  /** Crop the image actually looks like (lowercase), or null if unknown. */
  suggestedCrop: string | null
  /** Suggested crop's match strength, 0–100. */
  suggestedConfidence: number | null
  /** Re-run the diagnosis under the suggested crop (only when one is known). */
  onUseSuggested?: () => void
  /** Escape hatch: re-run for the originally selected crop, skipping the gate. */
  onOverride?: () => void
  /** Clear the photo so the farmer can take another. */
  onRetake: () => void
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export default function CropMismatchBlock({
  selectedCrop,
  suggestedCrop,
  suggestedConfidence,
  onUseSuggested,
  onOverride,
  onRetake,
}: CropMismatchBlockProps) {
  return (
    <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-amber-900">
            This doesn&apos;t look like a {cap(selectedCrop)} leaf
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/90">
            {suggestedCrop ? (
              <>
                The photo looks more like a{' '}
                <span className="font-bold">{cap(suggestedCrop)}</span> leaf
                {typeof suggestedConfidence === 'number'
                  ? ` (${suggestedConfidence.toFixed(0)}% match)`
                  : ''}
                . To avoid a wrong diagnosis, we didn&apos;t run the{' '}
                {cap(selectedCrop)} check. Switch to {cap(suggestedCrop)}, or
                take another clear photo of a single {cap(selectedCrop)} leaf.
              </>
            ) : (
              <>
                We couldn&apos;t confidently match this to a {cap(selectedCrop)}{' '}
                leaf, so we didn&apos;t run the check. Make sure you picked the
                right crop, then take another clear, close-up photo of one leaf.
              </>
            )}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {suggestedCrop && onUseSuggested && (
              <button
                onClick={onUseSuggested}
                className="inline-flex items-center gap-2 rounded-full bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2"
              >
                Check as {cap(suggestedCrop)}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onRetake}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
            >
              <RotateCcw className="h-4 w-4" />
              Take another photo
            </button>
          </div>

          {/* Escape hatch for the occasional wrong block (e.g. wheat). Low-key
              on purpose: most users should heed the suggestion. */}
          {onOverride && (
            <button
              onClick={onOverride}
              className="mt-3 text-xs font-medium text-amber-800/80 underline underline-offset-2 hover:text-amber-900"
            >
              It really is {cap(selectedCrop)} — check anyway
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
