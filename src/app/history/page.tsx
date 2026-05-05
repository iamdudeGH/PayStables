'use client'

import { useState, useEffect } from 'react'
import { getPaymentRequestsForUser, getProfilesByAddresses, getBillSplitsForUser } from '@/lib/supabase'
import { CheckCircle2, XCircle, Clock, Receipt, ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { SkeletonCard } from '@/components/skeleton'
import type { PaymentRequest, BillSplit, ProfileCache } from '@/lib/types'

const EXPLORER = 'https://testnet.arcscan.app'

type Tab = 'requests' | 'splits'

export default function HistoryPage() {
  const { address, isConnected } = useActiveAddress()

  const [tab, setTab] = useState<Tab>('requests')
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [splits, setSplits] = useState<BillSplit[]>([])
  const [profileCache, setProfileCache] = useState<ProfileCache>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    setLoading(true)

    Promise.all([
      getPaymentRequestsForUser(address),
      getBillSplitsForUser(address),
    ]).then(async ([reqs, splts]) => {
      setRequests(reqs)
      setSplits(splts)

      // Batch-fetch all profiles in one query
      const addrs = new Set<string>()
      reqs.forEach((r) => { addrs.add(r.from_address); addrs.add(r.to_address) })
      if (addrs.size > 0) {
        const profiles = await getProfilesByAddresses([...addrs])
        const cache: ProfileCache = {}
        profiles.forEach((p) => { cache[p.wallet_address] = p })
        setProfileCache(cache)
      }
      setLoading(false)
    })
  }, [address])

  const getDisplayName = (addr: string) => {
    const p = profileCache[addr?.toLowerCase()]
    return p ? `${p.avatar_emoji} @${p.username}` : `${addr?.slice(0, 6)}…${addr?.slice(-4)}`
  }

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-text-secondary">Connect your wallet to view history.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="hero-gradient px-5 pt-14 pb-5">
        <h1 className="font-display font-bold text-2xl text-white mb-4">Activity</h1>
        <div className="flex bg-white/15 rounded-2xl p-1 gap-1">
          {(['requests', 'splits'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === t ? 'bg-white text-primary shadow-sm' : 'text-indigo-200'
              }`}
            >
              {t === 'requests' ? 'Requests' : 'Bill Splits'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-bg-body px-5 pt-5 pb-8">

        {tab === 'requests' && (
          loading ? <SkeletonCard rows={5} /> : (
            <div className="card overflow-hidden">
              {requests.length > 0 ? (
                requests.map((req, i) => {
                  const isSent = req.from_address === address?.toLowerCase()
                  const other = isSent ? req.to_address : req.from_address
                  const statusColor =
                    req.status === 'paid' ? 'text-success bg-success-light' :
                    req.status === 'declined' ? 'text-danger bg-danger-light' :
                    req.status === 'expired' ? 'text-text-tertiary bg-bg-subtle border border-border' :
                    'text-warning bg-warning-light'
                  return (
                    <div
                      key={req.id}
                      className={`flex items-center gap-3 px-4 py-4 ${i < requests.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor}`}>
                        {req.status === 'paid' ? <CheckCircle2 className="w-5 h-5" /> :
                         req.status === 'declined' ? <XCircle className="w-5 h-5" /> :
                         req.status === 'expired' ? <XCircle className="w-5 h-5 opacity-50" /> :
                         <Clock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-text-primary truncate">
                          {isSent ? (
                            <span className="inline-flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3 text-text-tertiary inline" />
                              Requested from {getDisplayName(other)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3 text-text-tertiary inline" />
                              Request from {getDisplayName(other)}
                            </span>
                          )}
                        </p>
                        {req.note && <p className="text-xs text-text-tertiary truncate">"{req.note}"</p>}
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-text-tertiary capitalize">{req.status}</p>
                          {req.status === 'paid' && req.tx_hash && (
                            <a
                              href={`${EXPLORER}/tx/${req.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary flex items-center gap-0.5 font-medium"
                            >
                              View tx <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="font-bold text-sm text-text-primary flex-shrink-0">
                        ${Number(req.amount).toFixed(2)}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-14 text-text-tertiary">
                  <Clock className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No requests yet</p>
                </div>
              )}
            </div>
          )
        )}

        {tab === 'splits' && (
          loading ? <SkeletonCard rows={3} /> : (
            <div className="card overflow-hidden">
              {splits.length > 0 ? (
                splits.map((split, i) => {
                  const paidCount = split.bill_split_participants?.filter((p) => p.status === 'paid').length ?? 0
                  const total = split.bill_split_participants?.length ?? 0
                  const pct = total > 0 ? (paidCount / total) * 100 : 0
                  return (
                    <div
                      key={split.id}
                      className={`px-4 py-4 ${i < splits.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-warning-light rounded-full flex items-center justify-center flex-shrink-0">
                          <Receipt className="w-5 h-5 text-warning" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-text-primary truncate">{split.title}</p>
                          <p className="text-xs text-text-tertiary">{paidCount}/{total} paid</p>
                        </div>
                        <p className="font-bold text-sm text-text-primary flex-shrink-0">
                          ${Number(split.total_amount).toFixed(2)}
                        </p>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5">
                        <div
                          className="bg-success h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-14 text-text-tertiary">
                  <Receipt className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-semibold">No bill splits yet</p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
