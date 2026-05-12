'use client'

import { useState, useEffect, useCallback } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { Store, Copy, Check, Loader2, ExternalLink, DollarSign, TrendingUp, ArrowUpRight, X, Search, ChevronRight, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { useProfile } from '@/hooks/useProfile'
import { getMerchantPayments, getMerchantEarningsToday, searchProfiles } from '@/lib/supabase'
import { useERC20Transfer } from '@/lib/useERC20Transfer'
import { TOKENS, ERC20_ABI } from '@/lib/tokens'
import { toast } from '@/components/toast'
import type { MerchantPayment, Profile } from '@/lib/types'

const EXPLORER = 'https://testnet.arcscan.app'

export default function MerchantDashboard() {
  const { address, isConnected, wagmiConnected, privyWallet } = useActiveAddress()
  const { ready } = usePrivy()
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile(address)

  const [payments, setPayments] = useState<MerchantPayment[]>([])
  const [earnings, setEarnings] = useState({ total: 0, count: 0 })
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [copied, setCopied] = useState(false)

  // ── Withdraw state ────────────────────────────────────────────────────────
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<'pick' | 'amount' | 'success'>('pick')
  const [withdrawRecipient, setWithdrawRecipient] = useState<Profile | null>(null)
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawSearch, setWithdrawSearch] = useState('')
  const [withdrawResults, setWithdrawResults] = useState<Profile[]>([])

  const { sendWithWagmi, sendWithPrivy, txHash, isPending, isConfirmed, error: txError, reset: resetTx } = useERC20Transfer()

  // USDC Balance
  const { data: usdcRaw, refetch: refetchBalance } = useReadContract({
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
    const interval = setInterval(loadData, 10_000)
    return () => clearInterval(interval)
  }, [loadData])

  // ── Withdraw: search debounce ─────────────────────────────────────────────
  useEffect(() => {
    if (withdrawSearch.length < 2) { setWithdrawResults([]); return }
    const t = setTimeout(async () => {
      const results = await searchProfiles(withdrawSearch)
      setWithdrawResults(results.filter((r) => r.wallet_address !== address?.toLowerCase()))
    }, 300)
    return () => clearTimeout(t)
  }, [withdrawSearch, address])

  // ── Withdraw: tx confirmation ─────────────────────────────────────────────
  useEffect(() => {
    if (isConfirmed && txHash && showWithdraw) {
      setWithdrawStep('success')
      refetchBalance()
    }
  }, [isConfirmed, txHash, showWithdraw, refetchBalance])

  useEffect(() => {
    if (txError) toast.error(txError.slice(0, 120))
  }, [txError])

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

  // ── Withdraw handlers ─────────────────────────────────────────────────────
  const openWithdraw = () => {
    setShowWithdraw(true)
    setWithdrawStep('pick')
    setWithdrawRecipient(null)
    setWithdrawAddress('')
    setWithdrawAmount('')
    setWithdrawSearch('')
    resetTx()
  }

  const closeWithdraw = () => {
    setShowWithdraw(false)
    resetTx()
  }

  const selectWithdrawUser = (user: Profile) => {
    setWithdrawRecipient(user)
    setWithdrawAddress(user.wallet_address)
    setWithdrawSearch('')
    setWithdrawResults([])
    setWithdrawStep('amount')
  }

  const selectWithdrawRawAddress = () => {
    if (!withdrawAddress || !withdrawAddress.startsWith('0x') || withdrawAddress.length !== 42) {
      toast.error('Enter a valid 0x wallet address')
      return
    }
    setWithdrawStep('amount')
  }

  const handleWithdrawSend = async () => {
    if (!withdrawAddress || !withdrawAmount || parseFloat(withdrawAmount) <= 0) return
    resetTx()
    const to = withdrawAddress as `0x${string}`

    if (wagmiConnected) {
      sendWithWagmi(to, withdrawAmount, 'USDC')
      return
    }
    if (privyWallet) {
      try {
        await sendWithPrivy(privyWallet, to, withdrawAmount, 'USDC')
      } catch {
        // error shown via useEffect
      }
      return
    }
    toast.error('No wallet connected.')
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
          <div className="flex-1">
            <p className="text-emerald-100 text-xs font-semibold">PayStables Business</p>
            <p className="text-white font-bold text-lg">{profile?.business_name || profile?.display_name}</p>
          </div>
        </div>

        {/* Balance + Withdraw button */}
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-1">USDC Balance</p>
            <span className="font-display font-bold text-4xl text-white tracking-tight">${usdcBalance}</span>
          </div>
          <button
            onClick={openWithdraw}
            className="flex items-center gap-1.5 bg-white text-emerald-600 px-4 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </button>
        </div>
      </div>

      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8">
        {/* ── QR Code Section ───────────────────────────────────────── */}
        <div className="card p-6 flex flex-col items-center mb-6">
          <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-4">Scan to Pay</p>

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

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Withdraw Overlay ───────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showWithdraw && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) closeWithdraw() }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-[430px] bg-bg-card rounded-t-[28px] shadow-elevated max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
                <h2 className="font-display font-bold text-lg text-text-primary">
                  {withdrawStep === 'success' ? 'Sent!' : withdrawStep === 'amount' ? 'Send USDC' : 'Withdraw'}
                </h2>
                <button onClick={closeWithdraw} className="w-8 h-8 bg-bg-subtle rounded-full flex items-center justify-center">
                  <X className="w-4 h-4 text-text-tertiary" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
                {/* ── Step 1: Pick recipient ──────────────────────────── */}
                {withdrawStep === 'pick' && (
                  <div className="flex flex-col gap-4">
                    {/* Search by username */}
                    <div>
                      <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2">Send to @username</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <input
                          type="text"
                          value={withdrawSearch}
                          onChange={(e) => setWithdrawSearch(e.target.value)}
                          placeholder="Search by @username..."
                          className="input-field pl-11"
                          autoFocus
                        />
                      </div>
                      {withdrawResults.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-2">
                          {withdrawResults.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => selectWithdrawUser(user)}
                              className="card flex items-center gap-3 px-4 py-3 active:scale-[0.98] transition-transform text-left"
                            >
                              <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                                <img
                                  src={`https://api.dicebear.com/9.x/shapes/svg?seed=${user.username}&backgroundColor=0a0a0a`}
                                  alt="Avatar"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-text-primary">{user.display_name}</p>
                                <p className="text-xs text-text-tertiary">@{user.username}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-text-tertiary text-xs font-medium">or</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Raw address */}
                    <div>
                      <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2">Send to wallet address</label>
                      <input
                        type="text"
                        value={withdrawAddress}
                        onChange={(e) => setWithdrawAddress(e.target.value)}
                        placeholder="0x..."
                        className="input-field font-mono text-sm"
                      />
                      <button
                        onClick={selectWithdrawRawAddress}
                        disabled={!withdrawAddress || withdrawAddress.length !== 42}
                        className="btn-primary mt-3"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Amount ──────────────────────────────────── */}
                {withdrawStep === 'amount' && (
                  <div className="flex flex-col">
                    {/* Recipient chip */}
                    <div className="card flex items-center gap-3 px-4 py-3.5 mb-6">
                      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 flex-shrink-0 overflow-hidden">
                        {withdrawRecipient ? (
                          <img
                            src={`https://api.dicebear.com/9.x/shapes/svg?seed=${withdrawRecipient.username}&backgroundColor=0a0a0a`}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-text-primary">
                          {withdrawRecipient?.display_name || `${withdrawAddress.slice(0, 10)}…${withdrawAddress.slice(-6)}`}
                        </p>
                        {withdrawRecipient && <p className="text-xs text-text-tertiary">@{withdrawRecipient.username}</p>}
                      </div>
                      <button
                        onClick={() => { setWithdrawStep('pick'); setWithdrawRecipient(null); setWithdrawAddress(''); setWithdrawAmount('') }}
                        className="text-xs text-primary font-bold"
                      >
                        Change
                      </button>
                    </div>

                    {/* Amount input */}
                    <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2">Amount (USDC)</label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="any"
                      className="input-field text-3xl font-bold py-4 mb-3"
                      autoFocus
                    />

                    {/* Quick amounts */}
                    <div className="flex gap-2 mb-6">
                      {['10', '50', '100', usdcBalance].map((amt, i) => (
                        <button
                          key={amt}
                          onClick={() => setWithdrawAmount(amt)}
                          className="flex-1 py-2 rounded-xl border border-border text-sm font-bold text-text-secondary active:scale-95 transition-transform hover:bg-bg-subtle"
                        >
                          {i === 3 ? 'All' : `$${amt}`}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleWithdrawSend}
                      disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isPending}
                      className="w-full bg-emerald-500 text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {isPending ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
                      ) : (
                        <><ArrowUpRight className="w-5 h-5" /> Send ${withdrawAmount || '0'} USDC</>
                      )}
                    </button>
                  </div>
                )}

                {/* ── Step 3: Success ─────────────────────────────────── */}
                {withdrawStep === 'success' && (
                  <div className="flex flex-col items-center text-center pt-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
                    </motion.div>
                    <h3 className="font-display font-bold text-xl text-text-primary mb-1">Sent!</h3>
                    <p className="text-text-secondary text-sm mb-1">
                      <span className="font-bold text-emerald-600">${parseFloat(withdrawAmount).toFixed(2)} USDC</span> sent to{' '}
                      {withdrawRecipient ? `@${withdrawRecipient.username}` : `${withdrawAddress.slice(0, 10)}…`}
                    </p>
                    {txHash && (
                      <a
                        href={`${EXPLORER}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-sm font-bold flex items-center gap-1 mt-3"
                      >
                        View transaction <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={closeWithdraw}
                      className="mt-6 btn-primary"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
