'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { createProfile, checkUsernameAvailable } from '@/lib/supabase'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useWallets } from '@privy-io/react-auth'
import { motion } from 'framer-motion'

const EMOJIS = ['😎', '🚀', '💰', '🔥', '💎', '⚡', '🌟', '🎯', '🦊', '🐳', '👾', '🎨']

export default function SetupPage() {
  const { address: wagmiAddress } = useAccount()
  const { wallets } = useWallets()
  const privyWallet = wallets.find((w) => w.walletClientType === 'privy')
  const externalWallet = wallets.find((w) => w.walletClientType !== 'privy')
  const address = wagmiAddress || privyWallet?.address || externalWallet?.address

  const router = useRouter()
  const [emoji, setEmoji] = useState('😎')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleUsername = async (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(clean)
    setIsAvailable(null)
    if (clean.length < 3) return
    setChecking(true)
    const available = await checkUsernameAvailable(clean)
    setIsAvailable(available)
    setChecking(false)
  }

  const handleSubmit = async () => {
    if (!address || !username || !displayName || !isAvailable) return
    setSubmitting(true)
    setError('')
    try {
      await createProfile(address, username, displayName, emoji)
      router.push('/')
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="hero-gradient px-5 pt-14 pb-10 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-16 h-16 bg-white/20 rounded-[22px] flex items-center justify-center text-4xl mx-auto mb-5 border border-white/30"
        >
          {emoji}
        </motion.div>
        <h1 className="font-display font-bold text-2xl text-white mb-2">Create your profile</h1>
        <p className="text-indigo-200 text-sm">Choose an avatar and set your username so friends can find you.</p>
      </div>

      {/* Form */}
      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8 flex flex-col">
        {/* Emoji picker */}
        <div className="card p-4 mb-4">
          <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-3">Choose Avatar</p>
          <div className="grid grid-cols-6 gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`h-11 w-full rounded-[14px] flex items-center justify-center text-2xl transition-all active:scale-90 ${
                  emoji === e
                    ? 'bg-primary/10 border-2 border-primary scale-105'
                    : 'bg-bg-subtle border border-border hover:bg-border'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Display name */}
        <div className="mb-4">
          <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2 pl-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            className="input-field"
          />
        </div>

        {/* Username */}
        <div className="mb-6">
          <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2 pl-1">Username</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-bold text-sm">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsername(e.target.value)}
              placeholder="your_handle"
              className="input-field pl-8 pr-12"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {checking && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              {!checking && isAvailable === true && <CheckCircle2 className="w-4 h-4 text-success" />}
              {!checking && isAvailable === false && <AlertCircle className="w-4 h-4 text-danger" />}
            </div>
          </div>
          {username.length > 0 && username.length < 3 && (
            <p className="text-xs text-text-tertiary mt-1.5 pl-1">Min 3 characters</p>
          )}
          {isAvailable === false && (
            <p className="text-xs text-danger mt-1.5 pl-1">Username taken</p>
          )}
          {isAvailable === true && (
            <p className="text-xs text-success mt-1.5 pl-1">@{username} is available ✓</p>
          )}
        </div>

        {error && (
          <div className="bg-danger-light border border-red-200 rounded-2xl p-4 mb-4 text-sm text-danger font-medium">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!username || !displayName || !isAvailable || submitting}
          className="btn-primary mt-auto"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Profile →'}
        </button>
      </div>
    </div>
  )
}
