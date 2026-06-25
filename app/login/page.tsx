'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import AuthShell from '@/components/auth/AuthShell'
import { resetPassword, signInWithEmail, subscribeToAuth } from '@/src/lib/auth'
import { getUserFarms } from '@/src/lib/farms'

function getAuthErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setMessage(null)

    try {
      const trimmedEmail = email.trim()
      const user = await signInWithEmail(trimmedEmail, password)
      const farms = await getUserFarms(user.uid)
      router.replace(farms.length > 0 ? '/' : '/onboarding')
    } catch (err: any) {
      const code = getAuthErrorCode(err)
      if (code === 'auth/user-not-found') {
        router.replace(`/signup?email=${encodeURIComponent(email.trim())}`)
        return
      }

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('That password is incorrect. Enter a different password or reset it below.')
        return
      }

      setError(err.message || 'Could not sign in. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email address first, then use forgot password.')
      return
    }

    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const trimmedEmail = email.trim()
      await resetPassword(trimmedEmail)
      setMessage(`Password reset email sent to ${trimmedEmail}.`)
    } catch (err: any) {
      if (getAuthErrorCode(err) === 'auth/user-not-found') {
        router.replace(`/signup?email=${encodeURIComponent(email.trim())}`)
        return
      }

      setError(err.message || 'Could not send password reset email.')
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
      title="Sign in"
      subtitle="Use your CropIntel account to access farm-specific disease detection."
      footer={
        <>
          New to CropIntel?{' '}
          <Link className="font-bold text-primary-800 hover:text-primary-900" href="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
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
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="field-input"
          />
        </div>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}
        {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full border border-ink/20">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </button>
        <div className="pt-2">
          <p className="mb-3 text-center text-sm text-field-soil">
            Need a new password? Send a reset link to your email.
          </p>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            className="btn-secondary w-full border-ink/20 bg-white"
          >
            Reset password
          </button>
        </div>
      </form>
    </AuthShell>
  )
}
