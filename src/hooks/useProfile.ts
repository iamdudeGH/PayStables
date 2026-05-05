'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProfileByAddress } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

/**
 * Fetches the profile for the given wallet address.
 * Redirects to /setup if no profile exists yet.
 */
export function useProfile(address: `0x${string}` | undefined) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    getProfileByAddress(address).then((p) => {
      setProfile(p)
      setLoading(false)
      if (!p) router.push('/setup')
    })
  }, [address, router])

  return { profile, loading }
}
