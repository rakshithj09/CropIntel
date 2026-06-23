'use client'

import { useState } from 'react'
import { Camera, ChevronDown, CheckCircle2, TriangleAlert } from 'lucide-react'

export default function TipsAndGuidelines() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="surface rounded-2xl p-4 sm:p-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left group gap-4"
      >
        <h3 className="flex items-center gap-2 text-base font-bold text-primary-900">
          <span className="rounded-xl border border-primary-100 bg-primary-50 p-2">
            <Camera className="w-4 h-4 text-primary-700" />
          </span>
          <span>Better photo, better check</span>
        </h3>
        <ChevronDown
          className={`w-5 h-5 text-slate-600 transition-transform duration-200 group-hover:text-primary-700 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="mt-5 space-y-4 text-field-soil">
          <div className="rounded-xl border border-field-soil/10 bg-field-cream p-4">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary-700" />
              Good field photo
            </h4>
            <ul className="space-y-2">
              {['Use daylight when possible', 'Keep the damaged area in focus', 'Fill most of the frame with the leaf', 'Avoid shadows, mud, or fingers covering symptoms'].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary-700 mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-field-soil/10 bg-field-cream p-4">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                2
              </span>
              What to include
            </h4>
            <ul className="space-y-2">
              {['Capture the spots, rust, yellowing, or lesions clearly', 'Include one wider photo if the whole plant is affected', 'Photograph both sides of the leaf if symptoms show there', 'Take a second photo from another row if damage varies'].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary-700 mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-field-soil/10 bg-field-cream p-4">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                3
              </span>
              Before acting
            </h4>
            <ul className="space-y-2">
              {['Scout more than one plant', 'Compare with healthy leaves nearby', 'Note the crop stage and recent weather', 'Treat only after the result matches what you see'].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary-700 mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <TriangleAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Reminder:</span> CropIntel helps with scouting. Confirm treatment choices with a local agronomist or extension service.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
