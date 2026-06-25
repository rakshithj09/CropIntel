'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { subscribeToAuth } from '@/src/lib/auth'
import { createFarmForUser, joinFarmByCode } from '@/src/lib/farms'
import { CROPS } from '@/lib/crops'
import { US_STATES } from '@/lib/stateDiseaseMap'
import type { User } from 'firebase/auth'

type Mode = 'create' | 'join'

export default function OnboardingPage() {
  const router = useRouter()
  const cropOptions = useMemo(() => Object.keys(CROPS), [])
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [mode, setMode] = useState<Mode>('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [stateCode, setStateCode] = useState('IA')
  const [selectedCrops, setSelectedCrops] = useState<string[]>([])
  const [acreage, setAcreage] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    return subscribeToAuth(
      (currentUser) => {
        if (!currentUser) {
          router.replace('/login')
          return
        }

        setUser(currentUser)
        setCheckingAuth(false)
      },
      (err) => {
        setError(err.message)
        setCheckingAuth(false)
      }
    )
  }, [router])

  const toggleCrop = (crop: string) => {
    setSelectedCrops((current) =>
      current.includes(crop) ? current.filter((item) => item !== crop) : [...current, crop]
    )
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser. You can enter latitude and longitude manually.')
      return
    }
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6))
        setLng(position.coords.longitude.toFixed(6))
      },
      () => setError('Could not read your location. You can continue with address and state, or enter coordinates manually.')
    )
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return
    if (selectedCrops.length === 0) {
      setError('Select at least one crop grown on this farm.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await createFarmForUser(user.uid, {
        name,
        address,
        stateCode,
        crops: selectedCrops,
        acreage: acreage.trim() ? Number(acreage) : null,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
      })
      router.replace('/')
    } catch (err: any) {
      setError(err.message || 'Could not create this farm.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return

    setLoading(true)
    setError(null)
    try {
      await joinFarmByCode(user.uid, joinCode)
      router.replace('/')
    } catch (err: any) {
      setError(err.message || 'That join code is invalid or expired.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-700" aria-label="Loading" />
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="surface rounded-2xl p-5 sm:p-8">
          <div className="mb-6">
            <p className="eyebrow">Farm setup</p>
            <h1 className="mt-4 text-3xl font-extrabold text-primary-900 sm:text-4xl">Connect your first farm</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-field-soil">
              Create a farm for your operation or join an existing farm with its six-character code.
            </p>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {(['create', 'join'] as Mode[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option)
                  setError(null)
                }}
                className={`min-h-[52px] rounded-full border px-4 py-3 text-sm font-bold transition ${
                  mode === option
                    ? 'border-ink bg-ink text-white'
                    : 'border-ink/10 bg-white/70 text-primary-900 hover:border-leaf/30'
                }`}
              >
                {option === 'create' ? 'Create Farm' : 'Join Farm'}
              </button>
            ))}
          </div>

          {mode === 'create' ? (
            <form className="space-y-5" onSubmit={handleCreate}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="farm-name">
                    Farm name
                  </label>
                  <input id="farm-name" required value={name} onChange={(e) => setName(e.target.value)} className="field-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="state-code">
                    State
                  </label>
                  <select id="state-code" value={stateCode} onChange={(e) => setStateCode(e.target.value)} className="field-input">
                    {US_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name} ({state.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="address">
                  Address
                </label>
                <input id="address" required value={address} onChange={(e) => setAddress(e.target.value)} className="field-input" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="acreage">
                    Acreage optional
                  </label>
                  <input id="acreage" type="number" min="0" step="0.01" value={acreage} onChange={(e) => setAcreage(e.target.value)} className="field-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="lat">
                    Latitude optional
                  </label>
                  <input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} className="field-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="lng">
                    Longitude optional
                  </label>
                  <input id="lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} className="field-input" />
                </div>
              </div>

              <button type="button" onClick={useCurrentLocation} className="btn-secondary w-full sm:w-auto">
                <MapPin className="h-4 w-4" />
                Use current location
              </button>

              <div>
                <label className="mb-3 block text-sm font-bold text-primary-900">Crops grown</label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {cropOptions.map((crop) => (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => toggleCrop(crop)}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold capitalize transition ${
                        selectedCrops.includes(crop)
                          ? 'border-primary-700 bg-primary-700 text-white'
                          : 'border-field-soil/15 bg-white text-primary-900 hover:border-primary-400'
                      }`}
                    >
                      {crop}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full sm:max-w-sm">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create farm
              </button>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleJoin}>
              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="join-code">
                  Farm join code
                </label>
                <input
                  id="join-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                  className="field-input font-mono uppercase tracking-[0.3em]"
                  placeholder="ABC123"
                />
              </div>

              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full sm:max-w-sm">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Join farm
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
