'use client'

import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import {
  ArrowUpRight, ArrowDownLeft, Receipt, Clock as ClockIcon,
  CheckCircle2, XCircle, Loader2, ExternalLink, Plus, User
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { updatePaymentRequestStatus } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TOKENS, ERC20_ABI } from '@/lib/tokens'
import { usePrivy } from '@privy-io/react-auth'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { useProfile } from '@/hooks/useProfile'
import { usePaymentRequests } from '@/hooks/usePaymentRequests'
import { useERC20Transfer } from '@/lib/useERC20Transfer'
import { toast } from '@/components/toast'
import { SkeletonBalance, SkeletonCard, SkeletonPendingRequest } from '@/components/skeleton'
import type { PaymentRequest } from '@/lib/types'

import { BridgeModal } from '@/components/bridge-modal'

const EXPLORER = 'https://testnet.arcscan.app'

export default function Dashboard() {
  const { address, isConnected, wagmiConnected, privyWallet, signMessage } = useActiveAddress()
  const { logout, ready } = usePrivy()
  const router = useRouter()

  const { profile, loading: profileLoading } = useProfile(address)
  const { requests, profileCache, loading: requestsLoading, refetch } = usePaymentRequests(address)

  const [payingRequestId, setPayingRequestId] = useState<string | null>(null)
  const [approvedSignature, setApprovedSignature] = useState<string | null>(null)
  const [isBridgeOpen, setIsBridgeOpen] = useState(false)

  // ── ERC-20 transfer (fixes the critical payment bug) ───────────────────────
  const { sendWithWagmi, sendWithPrivy, txHash, isPending, isConfirmed, error: txError, reset: resetTx } = useERC20Transfer()

  // ── Balance reads with auto-refresh every 15 s ────────────────────────────
  const { data: usdcRaw, refetch: refetchUsdc } = useReadContract({
    address: TOKENS.USDC.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { refetchInterval: 15_000 },
  })
  const { data: eurcRaw, refetch: refetchEurc } = useReadContract({
    address: TOKENS.EURC.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { refetchInterval: 15_000 },
  })

  const usdcBalance = usdcRaw ? Number(formatUnits(usdcRaw as bigint, TOKENS.USDC.decimals)).toFixed(2) : '0.00'
  const eurcBalance = eurcRaw ? Number(formatUnits(eurcRaw as bigint, TOKENS.EURC.decimals)).toFixed(2) : '0.00'
  const totalValue = (parseFloat(usdcBalance) + parseFloat(eurcBalance)).toFixed(2)

  // ── Redirect unauthenticated users ────────────────────────────────────────
  useEffect(() => {
    if (ready && !isConnected) router.push('/login')
  }, [ready, isConnected, router])

  // ── Handle tx confirmation ────────────────────────────────────────────────
  useEffect(() => {
    if (isConfirmed && payingRequestId && txHash && address && approvedSignature) {
      updatePaymentRequestStatus(payingRequestId, 'paid', address, approvedSignature, txHash)
        .then(() => {
          toast.success('Payment confirmed! ⚡')
          setPayingRequestId(null)
          setApprovedSignature(null)
          resetTx()
          refetch()
          refetchUsdc()
          refetchEurc()
        })
        .catch(() => toast.error('Payment confirmed but status update failed'))
    }
  }, [isConfirmed, payingRequestId, txHash, refetch, refetchUsdc, refetchEurc, resetTx, address, approvedSignature])

  // ── Show tx errors as toasts ──────────────────────────────────────────────
  useEffect(() => {
    if (txError) {
      toast.error(txError.slice(0, 120))
      setPayingRequestId(null)
    }
  }, [txError])

  const getDisplayName = (addr: string) => {
    const p = profileCache[addr?.toLowerCase()]
    return p ? `@${p.username}` : `${addr?.slice(0, 6)}…${addr?.slice(-4)}`
  }


  const handlePayRequest = async (request: PaymentRequest) => {
    try {
      const message = `Authorize ArcPay to mark Payment Request ${request.id} as paid`
      const signature = await signMessage(message)
      setApprovedSignature(signature)
    } catch {
      toast.error('Signature rejected')
      return
    }

    setPayingRequestId(request.id)
    const to = request.from_address as `0x${string}`
    const amount = request.amount.toString()

    if (wagmiConnected) {
      sendWithWagmi(to, amount, 'USDC')
      return
    }
    if (privyWallet) {
      try {
        await sendWithPrivy(privyWallet, to, amount, 'USDC')
      } catch {
        setPayingRequestId(null)
      }
    }
  }
  const handleDecline = async (requestId: string) => {
    try {
      const message = `Authorize ArcPay to mark Payment Request ${requestId} as declined`
      let signature
      try {
        signature = await signMessage(message)
      } catch (e) {
        toast.error('Signature rejected')
        return
      }

      await updatePaymentRequestStatus(requestId, 'declined', address as string, signature)
      toast.success('Request declined')
      refetch()
    } catch {
      toast.error('Failed to decline request')
    }
  }

  // handleLogout moved to /profile

  const pendingIncoming = requests.filter(
    (r) => r.to_address === address?.toLowerCase() && r.status === 'pending'
  )

  // Only show activity that isn't already in pending (deduplicate)
  const pendingIds = new Set(pendingIncoming.map((r) => r.id))
  const recentActivity = requests
    .filter((r) => !pendingIds.has(r.id))
    .slice(0, 6)

  // ── Loading states ────────────────────────────────────────────────────────
  if (!ready || (ready && !isConnected)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (profileLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <SkeletonBalance />
        <div className="px-5 pt-5 pb-2">
          <div className="grid grid-cols-4 gap-3">
            {[0,1,2,3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 animate-pulse" />
                <div className="w-10 h-2.5 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 pt-6">
          <SkeletonCard rows={2} />
        </div>
        <div className="px-5 pt-6">
          <SkeletonCard rows={3} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <BridgeModal isOpen={isBridgeOpen} onClose={() => setIsBridgeOpen(false)} />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="hero-gradient px-5 pt-14 pb-8 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-8 -left-12 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

        {/* Top bar */}
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0">
              <img 
                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${profile?.username || address}&backgroundColor=0a0a0a`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-indigo-200 text-xs font-semibold">Welcome back</p>
              <p className="text-white font-bold text-sm">@{profile?.username ?? '…'}</p>
            </div>
          </div>
          <Link
            href="/profile"
            className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          >
            <span className="text-white text-sm font-semibold">☰</span>
          </Link>
        </div>

        {/* Balance */}
        <div className="relative z-10">
          <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-1">Total Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-5xl text-white tracking-tight">${totalValue}</span>
            <span className="text-indigo-300 font-bold text-base">USD</span>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-white text-xs font-semibold">Arc Testnet</span>
            </div>
            
            {/* Add Money Hook */}
            <button 
              onClick={() => setIsBridgeOpen(true)}
              className="inline-flex items-center gap-1 bg-white text-primary px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-transform shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Money
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <div className="bg-bg-card px-5 pt-5 pb-2">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Pay',     href: '/scan',    icon: <ArrowUpRight className="w-5 h-5" />,  color: 'text-primary bg-primary-light' },
            { label: 'Receive', href: '/receive', icon: <ArrowDownLeft className="w-5 h-5" />, color: 'text-success bg-success-light' },
            { label: 'Request', href: '/request', icon: <ClockIcon className="w-5 h-5" />,     color: 'text-warning bg-warning-light' },
            { label: 'Split',   href: '/split',   icon: <Receipt className="w-5 h-5" />,       color: 'text-danger bg-danger-light' },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform active:scale-95 ${action.color}`}>
                {action.icon}
              </div>
              <span className="text-[12px] font-semibold text-text-secondary group-active:text-text-primary transition-colors">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
        
        {/* Smart Vaults Banner */}
        <Link href="/vaults" className="mt-4 flex items-center justify-between bg-primary/5 border border-primary/10 rounded-2xl p-4 active:scale-95 transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-5.224 4.668ab3 3 0 1 0 6.706 5.42 21.31 21.31 0 0 1 2.53.504 21.31 21.31 0 0 1 2.53-.504 3 3 0 1 0 6.706-5.42 4 4 0 0 0-5.224-4.668A3 3 0 1 0 12 5Z"/></svg>
            </div>
            <div>
              <p className="font-bold text-sm text-text-primary">Smart Vaults</p>
              <p className="text-xs text-text-tertiary">Create AI-powered escrows</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4 text-white" />
          </div>
        </Link>
      </div>

      {/* ── Balances ─────────────────────────────────────────────── */}
      <div className="px-5 pt-6">
        <p className="text-text-tertiary text-xs font-bold uppercase tracking-widest mb-3 pl-1">Your Tokens</p>
        <div className="card overflow-hidden">
          {/* USDC */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">💵</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-text-primary">USDC</p>
              <p className="text-xs text-text-tertiary">USD Coin</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-text-primary">${usdcBalance}</p>
              <p className="text-xs text-text-tertiary">{usdcBalance} USDC</p>
            </div>
          </div>
          {/* EURC */}
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-xl flex-shrink-0">💶</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-text-primary">EURC</p>
              <p className="text-xs text-text-tertiary">Euro Coin</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm text-text-primary">€{eurcBalance}</p>
              <p className="text-xs text-text-tertiary">{eurcBalance} EURC</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pending Requests ─────────────────────────────────────── */}
      {requestsLoading ? (
        <div className="px-5 pt-6">
          <div className="w-24 h-3 bg-slate-200 rounded-full mb-3 animate-pulse" />
          <SkeletonPendingRequest />
        </div>
      ) : pendingIncoming.length > 0 && (
        <div className="px-5 pt-6">
          <div className="flex items-center justify-between mb-3 pl-1">
            <p className="text-text-tertiary text-xs font-bold uppercase tracking-widest">Pending</p>
            <span className="bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pendingIncoming.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {pendingIncoming.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card px-4 py-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-sm text-text-primary">
                      {getDisplayName(req.from_address)}
                    </p>
                    {req.note && (
                      <p className="text-xs text-text-tertiary mt-0.5">"{req.note}"</p>
                    )}
                  </div>
                  <p className="font-display font-bold text-xl text-text-primary">
                    ${Number(req.amount).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePayRequest(req)}
                    disabled={isPending && payingRequestId === req.id}
                    className="flex-1 bg-primary text-white rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {isPending && payingRequestId === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Pay</>
                    )}
                  </button>
                  <button
                    onClick={() => handleDecline(req.id)}
                    className="flex-1 bg-bg-subtle border border-border text-text-secondary rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <XCircle className="w-4 h-4" /> Decline
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Activity ───────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-3 pl-1">
          <p className="text-text-tertiary text-xs font-bold uppercase tracking-widest">Activity</p>
          {recentActivity.length > 0 && (
            <Link href="/history" className="text-primary text-xs font-bold">
              View all
            </Link>
          )}
        </div>

        {requestsLoading ? (
          <SkeletonCard rows={3} />
        ) : (
          <div className="card overflow-hidden">
            {recentActivity.length > 0 ? (
              recentActivity.map((req, i) => {
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
                    className={`flex items-center gap-3 px-4 py-3.5 ${i < recentActivity.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor}`}>
                      {req.status === 'paid' ? <CheckCircle2 className="w-5 h-5" /> :
                       req.status === 'declined' ? <XCircle className="w-5 h-5" /> :
                       req.status === 'expired' ? <XCircle className="w-5 h-5 opacity-50" /> :
                       <ClockIcon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-text-primary truncate">
                        {isSent ? 'Requested from' : 'Request from'} {getDisplayName(other)}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-text-tertiary capitalize">{req.status}</p>
                        {req.status === 'paid' && req.tx_hash && (
                          <a
                            href={`${EXPLORER}/tx/${req.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-0.5 font-medium"
                          >
                            View <ExternalLink className="w-2.5 h-2.5" />
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
              <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                <ClockIcon className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-semibold">No recent activity</p>
                <p className="text-xs mt-1 text-center mb-6">Send money or request payments to get started</p>
                <Link
                  href="/scan"
                  className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-2xl active:scale-95 transition-transform"
                >
                  Send your first payment →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
