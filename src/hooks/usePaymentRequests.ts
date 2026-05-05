'use client'

import { useEffect, useState, useCallback } from 'react'
import { getPaymentRequestsForUser, getProfilesByAddresses } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import type { PaymentRequest, ProfileCache } from '@/lib/types'

/**
 * Fetches payment requests for the given address, batches profile lookups,
 * and subscribes to Supabase Realtime for live updates.
 */
export function usePaymentRequests(address: `0x${string}` | undefined) {
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [profileCache, setProfileCache] = useState<ProfileCache>({})
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    if (!address) return
    const reqs = await getPaymentRequestsForUser(address)
    setRequests(reqs as PaymentRequest[])

    // Batch-fetch all referenced profiles in a single query
    const addresses = new Set<string>()
    reqs.forEach((r) => {
      addresses.add(r.from_address)
      addresses.add(r.to_address)
    })
    if (addresses.size > 0) {
      const profiles = await getProfilesByAddresses([...addresses])
      const cache: ProfileCache = {}
      profiles.forEach((p) => { cache[p.wallet_address] = p })
      setProfileCache(cache)
    }
    setLoading(false)
  }, [address])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // ── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    if (!address) return

    const addr = address.toLowerCase()
    const channel = supabase
      .channel(`payment_requests:${addr}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_requests',
        },
        (payload) => {
          // Only refetch when the change involves this user
          const row = payload.new as Record<string, string> | undefined
          const oldRow = payload.old as Record<string, string> | undefined
          const relevant =
            row?.from_address === addr ||
            row?.to_address === addr ||
            oldRow?.from_address === addr ||
            oldRow?.to_address === addr

          if (relevant) fetchRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [address, fetchRequests])

  return { requests, profileCache, loading, refetch: fetchRequests }
}
