'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Lightbulb, Shield, Calendar, Droplet } from 'lucide-react'
import { getDiseaseInfo } from '@/lib/diseaseInfo'

interface DiagnosisProps {
  disease: string
  crop: string
  confidence: number
  isHealthy: boolean
}

export default function Diagnosis({ disease, crop, confidence, isHealthy }: DiagnosisProps) {
  const [activeTab, setActiveTab] = useState<'assessment' | 'treatment' | 'prevention'>('assessment')
  
  const diseaseInfo = getDiseaseInfo(disease, crop)

  if (isHealthy) {
    return (
      <div className="mt-6 rounded-2xl border border-primary-200 bg-primary-50 p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-100 rounded-xl">
            <CheckCircle className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="mb-3 text-2xl font-bold text-primary-900">No strong disease signs</h3>
            <p className="text-primary-800 mb-4">
              Your {crop} photo does not show clear disease signs from this field check.
            </p>
            <div className="bg-white/60 rounded-xl p-5 border border-primary-200">
              <h4 className="font-bold text-primary-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Keep doing this
              </h4>
              <ul className="space-y-2 text-primary-800">
                {diseaseInfo?.prevention.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary-600 mt-1">✓</span>
                    <span>{tip}</span>
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
    if (diseaseInfo?.severity === 'high') return 'text-red-600 bg-red-100 border-red-300'
    if (diseaseInfo?.severity === 'medium') return 'text-orange-600 bg-orange-100 border-orange-300'
    return 'text-yellow-600 bg-yellow-100 border-yellow-300'
  }

  const getConfidenceLevel = () => {
    if (confidence >= 90) return { level: 'Very High', color: 'text-primary-600' }
    if (confidence >= 75) return { level: 'High', color: 'text-primary-600' }
    if (confidence >= 60) return { level: 'Moderate', color: 'text-yellow-600' }
    return { level: 'Low', color: 'text-orange-600' }
  }

  const confidenceInfo = getConfidenceLevel()

  return (
    <div className="mt-6 rounded-2xl border border-field-soil/10 bg-white p-4 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="flex items-center gap-2 text-2xl font-bold text-primary-900 sm:gap-3 sm:text-3xl">
          <AlertCircle className="h-7 w-7 shrink-0 text-primary-600 sm:h-8 sm:w-8" />
          <span className="min-w-0 leading-tight">Field guidance</span>
        </h3>
        <div
          className={`w-fit shrink-0 rounded-xl border-2 px-3 py-1.5 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm ${getSeverityColor()}`}
        >
          {getSeverityLevel()} risk
        </div>
      </div>

      {/* Confidence & Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-field-soil/10 bg-field-cream p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold uppercase text-field-soil">Match strength</span>
            <span className={`text-lg font-bold ${confidenceInfo.color}`}>
              {confidenceInfo.level}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                confidence >= 90 ? 'bg-primary-500' :
                confidence >= 75 ? 'bg-primary-500' :
                confidence >= 60 ? 'bg-yellow-500' : 'bg-orange-500'
              }`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Photo match: {confidence.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-xl border border-field-soil/10 bg-field-cream p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            <span className="text-sm font-bold uppercase text-field-soil">Field action</span>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {diseaseInfo?.severity === 'high' ? 'Scout and act quickly' :
             diseaseInfo?.severity === 'medium' ? 'Monitor and prepare' :
             'Watch and prevent spread'}
          </p>
        </div>
      </div>

      {/* Tabs — grid keeps all three inside the card on narrow screens */}
      <div className="-mx-1 mb-6 border-b border-field-soil/10 px-1 sm:mx-0 sm:px-0">
        <div className="grid w-full grid-cols-3 gap-1 sm:gap-2">
          {[
            { id: 'assessment', label: 'What to look for', icon: AlertCircle },
            { id: 'treatment', label: 'What to do', icon: Droplet },
            { id: 'prevention', label: 'Prevent spread', icon: Shield },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as 'assessment' | 'treatment' | 'prevention')}
              className={`flex min-h-[3.25rem] min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-t-lg px-1.5 py-2 text-center text-[11px] font-semibold leading-tight transition-all duration-300 sm:flex-row sm:gap-2 sm:rounded-t-xl sm:px-4 sm:py-3 sm:text-sm ${
                activeTab === id
                  ? 'bg-primary-700 text-white shadow-sm'
                  : 'text-field-soil hover:bg-primary-50 hover:text-primary-700'
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
            <div className="rounded-xl border border-field-soil/10 bg-white p-5 sm:p-6">
              <h4 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                Check these symptoms in the field
              </h4>
              <p className="text-slate-700 mb-4 leading-relaxed">
                {diseaseInfo?.description || `This ${crop} photo shows signs that may match ${disease}.`}
              </p>
              
              {diseaseInfo?.symptoms && diseaseInfo.symptoms.length > 0 && (
                <div className="mt-5">
                  <h5 className="font-bold text-slate-900 mb-3">Look for:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {diseaseInfo.symptoms.map((symptom, index) => (
                      <div key={index} className="flex items-start gap-2 bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <span className="text-orange-600 mt-1">•</span>
                        <span className="text-sm text-slate-700">{symptom}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-lg border border-field-straw/40 bg-field-wheat/25 p-4">
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
            <div className="rounded-xl border border-field-soil/10 bg-field-cream p-5 sm:p-6">
              <h4 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Droplet className="h-6 w-6 text-primary-700" />
                Action plan
              </h4>
              
              {diseaseInfo?.treatment && diseaseInfo.treatment.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-slate-700 font-semibold mb-4">
                    Practical next steps for {disease}:
                  </p>
                  <div className="space-y-3">
                    {diseaseInfo.treatment.map((step, index) => (
                      <div key={index} className="rounded-lg border border-field-soil/10 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-700 font-bold text-white">
                            {index + 1}
                          </div>
                          <p className="text-slate-800 flex-1">{step}</p>
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

              <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-300">
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
            <div className="rounded-xl border border-primary-100 bg-primary-50 p-5 sm:p-6">
              <h4 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary-600" />
                Ways to reduce spread
              </h4>
              
              {diseaseInfo?.prevention && diseaseInfo.prevention.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-slate-700 font-semibold mb-4">
                    Practices that help protect your {crop} crop:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {diseaseInfo.prevention.map((prevention, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border border-primary-200 shadow-sm flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                        <p className="text-slate-800 text-sm">{prevention}</p>
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

              <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-primary-900 mb-1">Monitoring Schedule</p>
                    <p className="text-sm text-primary-800">
                      Regular monitoring is key to early detection. Check your {crop} fields weekly, 
                      especially during critical growth stages. Early intervention is more effective 
                      and cost-efficient than treating advanced disease.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Summary */}
      <div className="mt-6 rounded-xl border border-primary-100 bg-primary-50 p-5">
        <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary-600" />
          Quick action summary
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-semibold text-slate-700 mb-1">1. Immediate</p>
            <p className="text-slate-600">
              {diseaseInfo?.severity === 'high' 
                ? 'Apply treatment within 24-48 hours'
                : diseaseInfo?.severity === 'medium'
                ? 'Monitor closely and prepare treatment'
                : 'Implement preventive measures'}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 mb-1">2. Short-term</p>
            <p className="text-slate-600">
              Follow treatment plan and monitor progress over next 7-14 days
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 mb-1">3. Long-term</p>
            <p className="text-slate-600">
              Implement prevention strategies to avoid future occurrences
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
