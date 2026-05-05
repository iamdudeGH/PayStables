'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const { ready, authenticated, login } = usePrivy()
  const router = useRouter()

  useEffect(() => {
    if (ready && authenticated) {
      router.push('/')
    }
  }, [ready, authenticated, router])

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg-body">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg-body">
      {/* Hero */}
      <div className="hero-gradient flex-1 flex flex-col items-center justify-center px-8 pt-20 pb-12 text-center">
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-[28px] flex items-center justify-center mb-8 border border-white/30"
        >
          <span className="text-4xl">💸</span>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="font-display font-bold text-4xl text-white mb-3 tracking-tight">
            PayStables
          </h1>
          <p className="text-indigo-200 text-base leading-relaxed max-w-[280px]">
            Send & receive USDC instantly. No crypto knowledge needed.
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 mt-10"
        >
          {['⚡ Instant', '🔒 Secure', '🌍 Global', '0 Fees'].map((f) => (
            <span
              key={f}
              className="bg-white/15 text-white text-sm font-semibold px-4 py-1.5 rounded-full border border-white/20"
            >
              {f}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-bg-card rounded-t-[32px] px-6 pt-8 pb-10 shadow-elevated"
      >
        <h2 className="font-display font-bold text-2xl text-text-primary mb-2">
          Get started
        </h2>
        <p className="text-text-secondary text-sm mb-8">
          Sign in with your email — your wallet is created automatically.
        </p>

        <button
          onClick={login}
          className="btn-primary text-base"
          style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
        >
          <span>Continue with Email</span>
          <span className="ml-1">→</span>
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-tertiary text-xs font-medium">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button onClick={login} className="btn-secondary text-sm">
          Connect MetaMask / Wallet
        </button>

        <p className="text-center text-text-tertiary text-xs mt-6 leading-relaxed">
          By continuing, you agree to our Terms of Service and Privacy Policy. Your wallet is non-custodial and secured by Privy.
        </p>
      </motion.div>
    </div>
  )
}
