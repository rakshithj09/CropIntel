'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import FarmSetupForm from '@/components/FarmSetupForm'
import { subscribeToAuth } from '@/src/lib/auth'
import type { User } from 'firebase/auth'

export default function OnboardingPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

          {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}
          {user && <FarmSetupForm userId={user.uid} redirectTo="/" />}
        </section>
      </div>
    </main>
  )
}
