'use client'

import { useState, useEffect, useCallback } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { Store, Copy, Check, Loader2, ExternalLink, DollarSign, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { useProfile } from '@/hooks/useProfile'
import { getMerchantPayments, getMerchantEarningsToday } from '@/lib/supabase'
import { TOKENS, ERC20_ABI } from '@/lib/tokens'
import { toast } from '@/components/toast'
import type { MerchantPayment } from '@/lib/types'

const EXPLORER = 'https://testnet.arcscan.app'

export default function MerchantDashboard() {
  const { address, isConnected } = useActiveAddress()
  const { ready } = usePrivy()
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile(address)

  const [payments, setPayments] = useState<MerchantPayment[]>([])
  const [earnings, setEarnings] = useState({ total: 0, count: 0 })
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [copied, setCopied] = useState(false)

  // USDC Balance
  const { data: usdcRaw } = useReadContract({
    address: TOKENS.USDC.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { refetchInterval: 10_000 },
  })
  const usdcBalance = usdcRaw ? Number(formatUnits(usdcRaw as bigint, TOKENS.USDC.decimals)).toFixed(2) : '0.00'

  // Redirect non-merchants
  useEffect(() => {
    if (ready && !isConnected) router.push('/login')
  }, [ready, isConnected, router])

  useEffect(() => {
    if (profile && profile.account_type !== 'merchant') {
      router.push('/')
    }
  }, [profile, router])

  // Load payments
  const loadData = useCallback(async () => {
    if (!address) return
    try {
      const [paymentsData, earningsData] = await Promise.all([
        getMerchantPayments(address, 20),
        getMerchantEarningsToday(address),
      ])
      setPayments(paymentsData as MerchantPayment[])
      setEarnings(earningsData)
    } catch (err) {
      console.error('Failed to load merchant data:', err)
    } finally {
      setLoadingPayments(false)
    }
  }, [address])

  useEffect(() => {
    loadData()
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadData, 10_000)
    return () => clearInterval(interval)
  }, [loadData])

  const paymentLink = typeof window !== 'undefined'
    ? `${window.location.origin}/pay/${profile?.username}`
    : `paystables.app/pay/${profile?.username}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink)
    setCopied(true)
    toast.success('Payment link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
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
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 pt-14 pb-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-8 -left-12 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl border border-white/30">
            🏪
          </div>
          <div>
            <p className="text-emerald-100 text-xs font-semibold">PayStables Business</p>
            <p className="text-white font-bold text-lg">{profile?.business_name || profile?.display_name}</p>
          </div>
        </div>

        {/* Balance */}
        <div className="relative z-10">
          <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-1">USDC Balance</p>
          <span className="font-display font-bold text-4xl text-white tracking-tight">${usdcBalance}</span>
        </div>
      </div>

      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8">
        {/* ── QR Code Section ───────────────────────────────────────── */}
        <div className="card p-6 flex flex-col items-center mb-6">
          <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-4">Scan to Pay</p>

          {/* QR Code using a public API */}
          <div className="w-48 h-48 bg-white rounded-2xl p-2 shadow-sm border border-border mb-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentLink)}&margin=8`}
              alt="Payment QR Code"
              className="w-full h-full rounded-xl"
            />
          </div>

          <p className="text-sm text-text-secondary font-medium mb-3 text-center break-all">
            {paymentLink}
          </p>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Payment Link'}
          </button>
        </div>

        {/* ── Today's Stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Today</p>
            </div>
            <p className="font-display font-bold text-2xl text-text-primary">${earnings.total.toFixed(2)}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Txns</p>
            </div>
            <p className="font-display font-bold text-2xl text-text-primary">{earnings.count}</p>
          </div>
        </div>

        {/* ── Recent Payments Feed ─────────────────────────────────── */}
        <div>
          <h2 className="text-text-tertiary text-xs font-bold uppercase tracking-widest mb-3 pl-1">
            Recent Payments
          </h2>

          {loadingPayments ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="card p-8 flex flex-col items-center text-center">
              <Store className="w-12 h-12 text-text-tertiary/30 mb-3" />
              <p className="font-bold text-text-primary mb-1">No payments yet</p>
              <p className="text-sm text-text-tertiary">Share your QR code or payment link to start receiving USDC.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {payments.map((payment, i) => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-3 px-4 py-3.5 ${i < payments.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-text-primary truncate">
                      {payment.payer_username ? `@${payment.payer_username}` : payment.payer_address ? `${payment.payer_address.slice(0, 6)}…${payment.payer_address.slice(-4)}` : 'Anonymous'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-text-tertiary">{timeAgo(payment.created_at)}</p>
                      <a
                        href={`${EXPLORER}/tx/${payment.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-0.5 font-medium"
                      >
                        View <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                  <p className="font-bold text-sm text-emerald-600 flex-shrink-0">
                    +${Number(payment.amount).toFixed(2)}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
