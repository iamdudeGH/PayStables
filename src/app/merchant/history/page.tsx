'use client'

import { useState, useEffect } from 'react'
import { Clock, Loader2, ExternalLink, DollarSign, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { useProfile } from '@/hooks/useProfile'
import { getMerchantPayments } from '@/lib/supabase'
import type { MerchantPayment } from '@/lib/types'

const EXPLORER = 'https://testnet.arcscan.app'

type FilterPeriod = 'today' | 'week' | 'month' | 'all'

export default function MerchantHistoryPage() {
  const { address, isConnected } = useActiveAddress()
  const { ready } = usePrivy()
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile(address)

  const [payments, setPayments] = useState<MerchantPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterPeriod>('all')

  useEffect(() => {
    if (ready && !isConnected) router.push('/login')
  }, [ready, isConnected, router])

  useEffect(() => {
    if (profile && profile.account_type !== 'merchant') router.push('/')
  }, [profile, router])

  useEffect(() => {
    if (!address) return
    setLoading(true)
    getMerchantPayments(address, 200).then((data) => {
      setPayments(data as MerchantPayment[])
      setLoading(false)
    })
  }, [address])

  const filteredPayments = payments.filter((p) => {
    if (filter === 'all') return true
    const created = new Date(p.created_at).getTime()
    const now = Date.now()
    if (filter === 'today') return now - created < 24 * 60 * 60 * 1000
    if (filter === 'week') return now - created < 7 * 24 * 60 * 60 * 1000
    if (filter === 'month') return now - created < 30 * 24 * 60 * 60 * 1000
    return true
  })

  const totalFiltered = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (!ready || profileLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col pb-20">
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 pt-14 pb-8">
        <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-emerald-200" /> Transaction History
        </h1>
        <p className="text-emerald-200 text-sm mt-1">All incoming payments to your store.</p>
      </div>

      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8">
        {/* Filter Pills */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {(['today', 'week', 'month', 'all'] as FilterPeriod[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-emerald-500 text-white'
                  : 'bg-bg-subtle text-text-secondary border border-border'
              }`}
            >
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="card p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Total</p>
            <p className="font-display font-bold text-xl text-text-primary">${totalFiltered.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Transactions</p>
            <p className="font-display font-bold text-xl text-text-primary">{filteredPayments.length}</p>
          </div>
        </div>

        {/* Payment List */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="card p-8 flex flex-col items-center text-center">
            <Calendar className="w-12 h-12 text-text-tertiary/30 mb-3" />
            <p className="font-bold text-text-primary mb-1">No payments in this period</p>
            <p className="text-sm text-text-tertiary">Payments will appear here when customers pay via your QR code.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {filteredPayments.map((payment, i) => (
              <div
                key={payment.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${i < filteredPayments.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-text-primary truncate">
                    {payment.payer_username ? `@${payment.payer_username}` : payment.payer_address ? `${payment.payer_address.slice(0, 6)}…${payment.payer_address.slice(-4)}` : 'Anonymous'}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-text-tertiary">{formatDate(payment.created_at)}</p>
                    <a
                      href={`${EXPLORER}/tx/${payment.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-0.5 font-medium"
                    >
                      Tx <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
                <p className="font-bold text-sm text-emerald-600 flex-shrink-0">
                  +${Number(payment.amount).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
