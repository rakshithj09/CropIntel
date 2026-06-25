'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'
import { signUpWithEmail, subscribeToAuth } from '@/src/lib/auth'
import { getUserFarms } from '@/src/lib/farms'

export default function SignupPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const emailParam = new URLSearchParams(window.location.search).get('email')
    if (emailParam) setEmail(emailParam)
  }, [])

  useEffect(() => {
    return subscribeToAuth(
      async (user) => {
        if (!user) {
          setCheckingAuth(false)
          return
        }

        try {
          const farms = await getUserFarms(user.uid)
          router.replace(farms.length > 0 ? '/' : '/onboarding')
        } catch (err: any) {
          setError(err.message || 'Could not load your farm data.')
          setCheckingAuth(false)
        }
      },
      (err) => {
        setError(err.message)
        setCheckingAuth(false)
      }
    )
  }, [router])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await signUpWithEmail(`${firstName.trim()} ${lastName.trim()}`.trim(), email.trim(), password)
      router.replace('/onboarding')
    } catch (err: any) {
      setError(err.message || 'Could not create your account.')
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
    <AuthShell
      title="Create your account"
      subtitle="Sign up with email and password. CropIntel will send a verification email after your account is created."
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-bold text-primary-800 hover:text-primary-900" href="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="first-name">
              First name
            </label>
            <input
              id="first-name"
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              required
              className="field-input"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="last-name">
              Last name
            </label>
            <input
              id="last-name"
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              required
              className="field-input"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="field-input"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-primary-900" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="field-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-field-soil transition hover:bg-primary-50 hover:text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full border border-ink/20">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>
    </AuthShell>
  )
}
