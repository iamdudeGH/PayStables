'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, ExternalLink, Store } from 'lucide-react'
import { motion } from 'framer-motion'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { getProfileByUsername, recordMerchantPayment, getProfileByAddress } from '@/lib/supabase'
import { useERC20Transfer } from '@/lib/useERC20Transfer'
import { toast } from '@/components/toast'
import type { Profile } from '@/lib/types'

const EXPLORER = 'https://testnet.arcscan.app'

export default function PublicPayPage() {
  const params = useParams()
  const username = (params.username as string)?.replace('@', '')

  const { ready, authenticated, login } = usePrivy()
  const { address, isConnected, wagmiConnected, privyWallet } = useActiveAddress()
  const { sendWithWagmi, sendWithPrivy, txHash, isPending, isConfirmed, reset } = useERC20Transfer()

  const [merchant, setMerchant] = useState<Profile | null>(null)
  const [loadingMerchant, setLoadingMerchant] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [amount, setAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)

  // Load merchant profile
  useEffect(() => {
    if (!username) return
    setLoadingMerchant(true)
    getProfileByUsername(username).then((profile) => {
      if (profile) {
        setMerchant(profile)
      } else {
        setNotFound(true)
      }
      setLoadingMerchant(false)
    })
  }, [username])

  // Handle tx confirmation
  useEffect(() => {
    if (isConfirmed && txHash && merchant && paying) {
      // Record the payment for the merchant's dashboard
      const recordPayment = async () => {
        let payerUsername: string | null = null
        if (address) {
          const payerProfile = await getProfileByAddress(address)
          if (payerProfile) payerUsername = payerProfile.username
        }

        await recordMerchantPayment(
          merchant.wallet_address,
          address || null,
          payerUsername,
          parseFloat(amount),
          txHash
        )
      }

      recordPayment().catch(console.error)
      setPaymentComplete(true)
      setPaying(false)
      toast.success('Payment sent! 🎉')
    }
  }, [isConfirmed, txHash, merchant, paying, amount, address])

  const handlePay = async () => {
    if (!merchant || !amount || parseFloat(amount) <= 0) return

    if (!authenticated) {
      login()
      return
    }

    setPaying(true)
    const to = merchant.wallet_address as `0x${string}`

    try {
      reset()
      if (wagmiConnected) {
        sendWithWagmi(to, amount, 'USDC')
      } else if (privyWallet) {
        await sendWithPrivy(privyWallet, to, amount, 'USDC')
      } else {
        toast.error('No wallet available. Please connect a wallet.')
        setPaying(false)
      }
    } catch {
      toast.error('Payment failed or rejected')
      setPaying(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingMerchant) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg-body">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-bg-body p-6 text-center">
        <Store className="w-16 h-16 text-text-tertiary/30 mb-4" />
        <h1 className="font-display font-bold text-2xl text-text-primary mb-2">Store not found</h1>
        <p className="text-text-secondary text-sm">@{username} doesn&apos;t exist on PayStables.</p>
      </div>
    )
  }

  // ── Payment complete ───────────────────────────────────────────────────────
  if (paymentComplete && txHash) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-bg-body p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <CheckCircle className="w-20 h-20 text-emerald-500 mb-6" />
        </motion.div>
        <h1 className="font-display font-bold text-2xl text-text-primary mb-2">Payment Sent!</h1>
        <p className="text-text-secondary text-sm mb-1">
          <span className="font-bold text-emerald-600">${parseFloat(amount).toFixed(2)} USDC</span> sent to {merchant?.business_name || merchant?.display_name}
        </p>
        <a
          href={`${EXPLORER}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-sm font-bold flex items-center gap-1 mt-4"
        >
          View transaction <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button
          onClick={() => {
            setPaymentComplete(false)
            setAmount('')
            reset()
          }}
          className="mt-6 text-text-tertiary text-sm font-bold underline"
        >
          Make another payment
        </button>
      </div>
    )
  }

  // ── Payment form ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg-body">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-6 pt-16 pb-10 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-white/20 rounded-[22px] flex items-center justify-center text-4xl mx-auto mb-4 border border-white/30"
        >
          🏪
        </motion.div>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <h1 className="font-display font-bold text-2xl text-white mb-1">
            {merchant?.business_name || merchant?.display_name}
          </h1>
          <p className="text-emerald-200 text-sm">@{merchant?.username}</p>
        </motion.div>
      </div>

      {/* Payment Form */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-1 px-6 pt-8 pb-10 flex flex-col"
      >
        <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-3">
          Amount (USDC)
        </label>
        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-bold text-2xl">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
            className="input-field text-3xl font-bold pl-10 py-5"
            autoFocus
          />
        </div>

        {authenticated ? (
          <button
            onClick={handlePay}
            disabled={!amount || parseFloat(amount) <= 0 || isPending || paying}
            className="w-full bg-emerald-500 text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            {isPending || paying ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
            ) : (
              <>Pay ${amount || '0.00'} USDC</>
            )}
          </button>
        ) : (
          <button
            onClick={login}
            className="w-full bg-emerald-500 text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-emerald-500/20"
          >
            Connect Wallet to Pay
          </button>
        )}

        <p className="text-center text-text-tertiary text-xs mt-6">
          Powered by <span className="font-bold">PayStables</span> · 0% fees · Instant settlement
        </p>
      </motion.div>
    </div>
  )
}
