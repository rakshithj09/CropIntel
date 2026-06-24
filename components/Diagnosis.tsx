'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Lightbulb, Shield, Droplet } from 'lucide-react'
import { getDiseaseInfo } from '@/lib/diseaseInfo'

interface DiagnosisProps {
  disease: string
  crop: string
  isHealthy: boolean
}

export default function Diagnosis({ disease, crop, isHealthy }: DiagnosisProps) {
  const [activeTab, setActiveTab] = useState<'assessment' | 'treatment' | 'prevention'>('assessment')
  
  const diseaseInfo = getDiseaseInfo(disease, crop)

  if (isHealthy) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200/70 bg-white/85 p-5 shadow-[0_18px_52px_-34px_rgba(18,38,28,0.34)] ring-1 ring-ink/5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-white/70 p-3">
            <CheckCircle className="h-7 w-7 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="mb-3 text-2xl font-bold text-emerald-950">No strong disease signs</h3>
            <p className="mb-4 text-emerald-800">
              Your {crop} photo does not show clear disease signs from this field check.
            </p>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/45 p-5">
              <h4 className="mb-3 flex items-center gap-2 font-bold text-emerald-950">
                <Shield className="w-5 h-5" />
                Keep doing this
              </h4>
              <ul className="space-y-2 text-emerald-800">
                {diseaseInfo?.prevention.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-[0.2em] shrink-0 text-emerald-600">✓</span>
                    <span className="min-w-0 leading-6">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const getSeverityLevel = () => {
    if (diseaseInfo?.severity === 'high') return 'Critical'
    if (diseaseInfo?.severity === 'medium') return 'Moderate'
    return 'Mild'
  }

  const getSeverityColor = () => {
    if (diseaseInfo?.severity === 'high') return 'text-red-700 bg-red-50 border-red-200'
    if (diseaseInfo?.severity === 'medium') return 'text-orange-700 bg-orange-50 border-orange-200'
    return 'text-yellow-700 bg-yellow-50 border-yellow-200'
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_18px_52px_-34px_rgba(18,38,28,0.34)] ring-1 ring-ink/5 backdrop-blur sm:p-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="flex items-center gap-2 text-2xl font-bold text-primary-900 sm:gap-3 sm:text-3xl">
          <AlertCircle className="h-7 w-7 shrink-0 text-primary-700 sm:h-8 sm:w-8" />
          <span className="min-w-0 leading-tight">Field guidance</span>
        </h3>
        <div
          className={`w-fit shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm ${getSeverityColor()}`}
        >
          {getSeverityLevel()} risk
        </div>
      </div>

      {/* Tabs — grid keeps all three inside the card on narrow screens */}
      <div className="mb-6 rounded-2xl border border-field-soil/10 bg-white/55 p-1">
        <div className="grid w-full grid-cols-3 gap-1">
          {[
            { id: 'assessment', label: 'What to look for', icon: AlertCircle },
            { id: 'treatment', label: 'What to do', icon: Droplet },
            { id: 'prevention', label: 'Prevent spread', icon: Shield },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as 'assessment' | 'treatment' | 'prevention')}
              className={`flex min-h-[3.25rem] min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 text-center text-[11px] font-semibold leading-tight transition-all duration-300 sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-sm ${
                activeTab === id
                  ? 'bg-white text-primary-900 shadow-sm ring-1 ring-field-soil/10'
                  : 'text-field-soil hover:bg-white/60 hover:text-primary-700'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
              <span className="break-words">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'assessment' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-field-soil/10 bg-white/65 p-5 sm:p-6">
              <h4 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-950">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                Check these symptoms in the field
              </h4>
              <p className="mb-4 leading-relaxed text-slate-700">
                {diseaseInfo?.description || `This ${crop} photo shows signs that may match ${disease}.`}
              </p>
              
              {diseaseInfo?.symptoms && diseaseInfo.symptoms.length > 0 && (
                <div className="mt-5">
                  <h5 className="mb-3 font-bold text-slate-950">Look for:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {diseaseInfo.symptoms.map((symptom, index) => (
                      <div key={index} className="flex items-start gap-3 rounded-xl border border-field-soil/10 bg-white/75 p-3">
                        <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                        <span className="min-w-0 text-sm leading-6 text-slate-700">{symptom}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-field-straw/40 bg-field-wheat/25 p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-field-soil" />
                  <div>
                    <p className="mb-1 text-sm font-semibold text-primary-900">Before you treat</p>
                    <p className="text-sm text-field-soil">
                      Check several plants and rows, especially field edges and low spots. If symptoms match closely,
                      confirm with an agronomist or extension service before applying treatment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'treatment' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-field-soil/10 bg-white/65 p-5 sm:p-6">
              <h4 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-950">
                <Droplet className="h-6 w-6 text-primary-700" />
                Action plan
              </h4>
              
              {diseaseInfo?.treatment && diseaseInfo.treatment.length > 0 ? (
                <div className="space-y-4">
                  <p className="mb-4 font-semibold text-slate-700">
                    Practical next steps for {disease}:
                  </p>
                  <div className="space-y-3">
                    {diseaseInfo.treatment.map((step, index) => (
                      <div key={index} className="rounded-2xl border border-field-soil/10 bg-white/80 p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-900 text-sm font-bold text-white">
                            {index + 1}
                          </div>
                          <p className="min-w-0 flex-1 leading-6 text-slate-700">{step}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-700">
                  Recommendations are being prepared. Please consult with an agricultural expert 
                  for specific treatment options for {disease} in {crop}.
                </p>
              )}

              <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50/80 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-yellow-900 mb-1">Important</p>
                    <p className="text-sm text-yellow-800">
                      Always follow label instructions when applying any treatments. Consider environmental 
                      impact and use Integrated Pest Management (IPM) practices. For severe cases, 
                      consult with certified agricultural professionals.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prevention' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-field-soil/10 bg-white/65 p-5 sm:p-6">
              <h4 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-950">
                <Shield className="w-6 h-6 text-green-600" />
                Ways to reduce spread
              </h4>
              
              {diseaseInfo?.prevention && diseaseInfo.prevention.length > 0 ? (
                <div className="space-y-4">
                  <p className="mb-4 font-semibold text-slate-700">
                    Practices that help protect your {crop} crop:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {diseaseInfo.prevention.map((prevention, index) => (
                      <div key={index} className="flex items-start gap-3 rounded-2xl border border-field-soil/10 bg-white/80 p-4">
                        <CheckCircle className="mt-[0.15em] h-5 w-5 flex-shrink-0 text-emerald-600" />
                        <p className="min-w-0 text-sm leading-6 text-slate-700">{prevention}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-700">
                  Prevention strategies are being developed. General best practices include crop rotation, 
                  proper spacing, and regular monitoring.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
