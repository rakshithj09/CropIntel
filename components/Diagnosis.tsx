'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle, ChevronDown, Shield, Sprout } from 'lucide-react'
import { getDiseaseInfo } from '@/lib/diseaseInfo'

interface DiagnosisProps {
  disease: string
  crop: string
  confidence: number
  isHealthy: boolean
}

function severityTone(severity?: string) {
  if (severity === 'high') return 'border-rose-200 bg-rose-50 text-rose-900'
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-primary-200 bg-primary-50 text-primary-900'
}

function actionLine(severity?: string) {
  if (severity === 'high') return 'Check nearby plants and act soon if symptoms are spreading.'
  if (severity === 'medium') return 'Monitor closely and compare symptoms before treating.'
  return 'Keep watching the crop and focus on prevention.'
}

function shortTermAction(severity?: string) {
  if (severity === 'high') return 'Recheck the field within 24-48 hours and consider treatment if symptoms are spreading.'
  if (severity === 'medium') return 'Scout again over the next few days and compare symptoms before treating.'
  return 'Keep normal scouting habits and document any changes.'
}

function treatmentReminder(severity?: string) {
  if (severity === 'high') return 'Because this can move quickly, confirm the symptoms and act promptly when the field pattern matches.'
  if (severity === 'medium') return 'Treatment may be useful if disease pressure increases or weather favors spread.'
  return 'Treatment is usually not urgent unless symptoms worsen.'
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <details className="rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#2F6B3F]">
        {title}
        <ChevronDown className="h-4 w-4" />
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-[#1F2A1F]">{children}</div>
    </details>
  )
}

function InfoBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#E2E4DD] bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7168]">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export default function Diagnosis({ disease, crop, confidence, isHealthy }: DiagnosisProps) {
  const diseaseInfo = getDiseaseInfo(disease, crop)
  const prevention = diseaseInfo?.prevention ?? ['Scout fields regularly', 'Remove badly affected plants when appropriate']
  const treatment = diseaseInfo?.treatment ?? ['Confirm symptoms with a local agronomist before treatment']
  const symptoms = diseaseInfo?.symptoms ?? []

  if (isHealthy) {
    return (
      <div className="rounded-2xl border border-[#E2E4DD] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-emerald-100 p-2 text-emerald-800">
            <CheckCircle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[#1F2A1F]">What to do next</h3>
            <p className="mt-1 text-sm text-[#6B7168]">
              Keep scouting and compare new leaves over time.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {prevention.map((tip) => (
            <div key={tip} className="rounded-lg border border-[#E2E4DD] bg-[#F6F7F5] p-3 text-sm text-[#1F2A1F]">
              {tip}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[#E2E4DD] bg-[#F6F7F5] p-4 text-sm text-[#1F2A1F]">
          <p className="font-semibold">Scout routine</p>
          <p className="mt-1 text-[#6B7168]">
            Keep checking leaves weekly, especially after rain, heavy dew, or weather changes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#E2E4DD] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-[#F6F7F5] p-2 text-[#2F6B3F]">
            <Sprout className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[#1F2A1F]">What to do next</h3>
            <p className="mt-1 text-sm text-[#6B7168]">{actionLine(diseaseInfo?.severity)}</p>
          </div>
        </div>
        <div className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${severityTone(diseaseInfo?.severity)}`}>
          {diseaseInfo?.severity ? `${diseaseInfo.severity} concern` : `${confidence.toFixed(0)}% confidence`}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <DetailSection title="What this means">
          <div className="space-y-4">
            <InfoBlock title="Likely issue">
              <p>{diseaseInfo?.description || `This photo looks closest to ${disease} on ${crop}.`}</p>
            </InfoBlock>

            <InfoBlock title="Expected symptoms">
              {symptoms.length > 0 ? (
                <ul className="space-y-2">
                  {symptoms.map((symptom) => (
                    <li key={symptom} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <span>{symptom}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No obvious disease symptoms were listed for this result.</p>
              )}
            </InfoBlock>

            <InfoBlock title="How to use this result">
              <p>
                Model confidence is about {confidence.toFixed(0)}%. Compare this result with what you see in the field
                before making a treatment decision.
              </p>
              <p className="text-[#6B7168]">
                Check several nearby plants, look at both healthy and affected leaves, and note whether symptoms are
                spreading across the field or isolated to a small area.
              </p>
            </InfoBlock>
          </div>
        </DetailSection>

        <DetailSection title="Treatment options">
          <div className="space-y-4">
            <InfoBlock title="Recommended actions">
              <ul className="space-y-2">
                {treatment.map((step) => (
                  <li key={step} className="flex gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6B3F]" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </InfoBlock>

            <InfoBlock title="Treatment timing">
              <p>{treatmentReminder(diseaseInfo?.severity)}</p>
              <p className="text-[#6B7168]">
                The best timing depends on crop stage, weather, disease pressure, and how much of the field is affected.
              </p>
            </InfoBlock>

            <InfoBlock title="Before applying anything">
              <p>
                Read and follow product labels, local rules, and pre-harvest intervals. For severe or uncertain cases,
                confirm with a local agronomist or extension service.
              </p>
            </InfoBlock>
          </div>
        </DetailSection>

        <DetailSection title="Prevention">
          <div className="space-y-4">
            <InfoBlock title="Field practices">
              <ul className="space-y-2">
                {prevention.map((step) => (
                  <li key={step} className="flex gap-2">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6B3F]" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </InfoBlock>

            <InfoBlock title="Monitoring schedule">
              <p>{shortTermAction(diseaseInfo?.severity)}</p>
              <p className="text-[#6B7168]">
                Take new photos from the same part of the field when possible. This makes it easier to compare whether
                symptoms are improving, stable, or spreading.
              </p>
            </InfoBlock>

            <InfoBlock title="Next season notes">
              <p>
                Keep a record of the field, crop, disease, weather conditions, and treatment decisions. That record can
                help with variety selection, residue management, rotation planning, and future scouting.
              </p>
            </InfoBlock>
          </div>
        </DetailSection>
      </div>
    </div>
  )
}
