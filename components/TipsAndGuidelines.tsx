'use client'

import { useState } from 'react'
import { Camera, ChevronDown, CheckCircle2, TriangleAlert } from 'lucide-react'

export default function TipsAndGuidelines() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="surface rounded-xl p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full items-center justify-between gap-4 text-left"
      >
        <h3 className="flex items-center gap-2 text-base font-semibold text-[#263326]">
          <span className="rounded-lg border border-primary-900/10 bg-primary-50 p-2">
            <Camera className="h-4 w-4 text-primary-700" />
          </span>
          <span>Better photo</span>
        </h3>
        <ChevronDown
          className={`h-5 w-5 text-primary-900/65 transition-transform duration-200 group-hover:text-primary-700 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3 text-[#263326]">
          <div className="rounded-xl border border-primary-900/10 bg-[#f8f6ee] p-4">
            <h4 className="mb-3 flex items-center gap-2 font-semibold text-[#263326]">
              <Camera className="h-4 w-4 text-primary-700" />
              Quick checklist
            </h4>
            <ul className="space-y-2">
              {['Use daylight if possible', 'Keep the leaf in focus', 'Fill the photo with the leaf'].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-700" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Reminder:</span> Confirm before treatment.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
