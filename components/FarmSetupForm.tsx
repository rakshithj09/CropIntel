'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MapPin, Search, Send } from 'lucide-react'
import { CROPS } from '@/lib/crops'
import { US_STATES } from '@/lib/stateDiseaseMap'
import { createFarmForUser, joinFarmByCode, requestFarmAccess, searchFarmsForAccess } from '@/src/lib/farms'
import type { FarmSearchResult } from '@/src/lib/types'

type Mode = 'create' | 'join' | 'request'

type FarmSetupFormProps = {
  userId: string
  redirectTo?: string
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function FarmSetupForm({ userId, redirectTo = '/' }: FarmSetupFormProps) {
  const router = useRouter()
  const cropOptions = useMemo(() => Object.keys(CROPS), [])
  const [mode, setMode] = useState<Mode>('create')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [stateCode, setStateCode] = useState('IA')
  const [selectedCrops, setSelectedCrops] = useState<string[]>([])
  const [acreage, setAcreage] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [farmSearch, setFarmSearch] = useState('')
  const [farmSearchState, setFarmSearchState] = useState('IA')
  const [searchResults, setSearchResults] = useState<FarmSearchResult[]>([])
  const [requestingFarmId, setRequestingFarmId] = useState<string | null>(null)

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
    if (selectedCrops.length === 0) {
      setError('Select at least one crop grown on this farm.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await createFarmForUser(userId, {
        name,
        address,
        stateCode,
        crops: selectedCrops,
        acreage: acreage.trim() ? Number(acreage) : null,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
      })
      setSuccess('Farm created.')
      router.replace(redirectTo)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not create this farm.'))
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault()

    setLoading(true)
    setError(null)
    try {
      await joinFarmByCode(userId, joinCode)
      setSuccess('Farm joined.')
      router.replace(redirectTo)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'That join code is invalid or expired.'))
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    setSearching(true)
    setError(null)
    setSuccess(null)
    try {
      const results = await searchFarmsForAccess(farmSearch, farmSearchState)
      setSearchResults(results)
      if (results.length === 0) {
        setSuccess('No matching farms found. Check the name and state, then try again.')
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not search farms.'))
    } finally {
      setSearching(false)
    }
  }

  const handleRequestAccess = async (farm: FarmSearchResult) => {
    setRequestingFarmId(farm.farmId)
    setError(null)
    setSuccess(null)
    try {
      await requestFarmAccess(userId, farm)
      setSuccess(`Access request sent to ${farm.name}.`)
      setSearchResults((current) => current.filter((item) => item.farmId !== farm.farmId))
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not request access to this farm.'))
    } finally {
      setRequestingFarmId(null)
    }
  }

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(['create', 'join', 'request'] as Mode[]).map((option) => (
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
            {option === 'create' ? 'Create Farm' : option === 'join' ? 'Join With Code' : 'Request Access'}
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
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold capitalize shadow-[0_10px_24px_-18px_rgba(18,38,28,0.45)] ring-1 transition ${
                    selectedCrops.includes(crop)
                      ? 'border-primary-700 bg-primary-700 text-white ring-primary-700/30'
                      : 'border-primary-200 bg-white text-primary-900 ring-primary-100/70 hover:border-primary-400 hover:ring-primary-200/80'
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
      ) : mode === 'join' ? (
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
          {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{success}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full sm:max-w-sm">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Join farm
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <form className="space-y-4" onSubmit={handleSearch}>
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="farm-search">
                  Farm name or location
                </label>
                <input
                  id="farm-search"
                  value={farmSearch}
                  onChange={(event) => setFarmSearch(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  className="field-input"
                  placeholder="Smith Family Farm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="farm-search-state">
                  State
                </label>
                <select
                  id="farm-search-state"
                  value={farmSearchState}
                  onChange={(event) => setFarmSearchState(event.target.value)}
                  className="field-input"
                >
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name} ({state.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}
            {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{success}</p>}

            <button type="submit" disabled={searching} className="btn-primary w-full sm:max-w-sm">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search farms
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((farm) => (
                <article key={farm.farmId} className="rounded-2xl border border-primary-100 bg-white/75 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-extrabold text-primary-900">{farm.name}</h3>
                      <p className="mt-1 text-sm text-field-soil">{farm.address}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-field-soil">{farm.stateCode}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRequestAccess(farm)}
                      disabled={requestingFarmId === farm.farmId}
                      className="btn-secondary w-full justify-center sm:w-auto"
                    >
                      {requestingFarmId === farm.farmId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Request
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
