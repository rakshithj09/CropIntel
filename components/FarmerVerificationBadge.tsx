'use client'

import { BadgeCheck, User } from 'lucide-react'

type Props = {
  verified: boolean
  compact?: boolean
}

export default function FarmerVerificationBadge({ verified, compact }: Props) {
  if (verified) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border font-semibold bg-emerald-50 text-emerald-900 border-emerald-200 ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        }`}
      >
        <BadgeCheck className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        Verified farmer
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold bg-slate-100 text-slate-700 border-slate-200 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      <User className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      Unverified
    </span>
  )
}
