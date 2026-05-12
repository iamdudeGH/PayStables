'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { createProfile, checkUsernameAvailable } from '@/lib/supabase'
import { CheckCircle2, AlertCircle, Loader2, User, Store } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useWallets } from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'

const EMOJIS = ['😎', '🚀', '💰', '🔥', '💎', '⚡', '🌟', '🎯', '🦊', '🐳', '👾', '🎨']

export default function SetupPage() {
  const { address: wagmiAddress } = useAccount()
  const { wallets } = useWallets()
  const privyWallet = wallets.find((w) => w.walletClientType === 'privy')
  const externalWallet = wallets.find((w) => w.walletClientType !== 'privy')
  const address = wagmiAddress || privyWallet?.address || externalWallet?.address

  const router = useRouter()

  // Step: 'choose' → 'form'
  const [step, setStep] = useState<'choose' | 'form'>('choose')
  const [accountType, setAccountType] = useState<'user' | 'merchant'>('user')

  const [emoji, setEmoji] = useState('😎')
  const [displayName, setDisplayName] = useState('')
  const [businessName, setBusinessName] = useState('')
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

  const handleChoose = (type: 'user' | 'merchant') => {
    setAccountType(type)
    setStep('form')
  }

  const handleSubmit = async () => {
    if (!address || !username || !isAvailable) return
    if (accountType === 'user' && !displayName) return
    if (accountType === 'merchant' && !businessName) return

    setSubmitting(true)
    setError('')
    try {
      await createProfile(
        address,
        username,
        accountType === 'merchant' ? businessName : displayName,
        accountType === 'merchant' ? '🏪' : emoji,
        accountType,
        accountType === 'merchant' ? businessName : undefined
      )
      router.push(accountType === 'merchant' ? '/merchant' : '/')
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
          {step === 'choose' ? '💸' : accountType === 'merchant' ? '🏪' : emoji}
        </motion.div>
        <h1 className="font-display font-bold text-2xl text-white mb-2">
          {step === 'choose' ? 'Welcome to PayStables' : accountType === 'merchant' ? 'Set up your business' : 'Create your profile'}
        </h1>
        <p className="text-indigo-200 text-sm">
          {step === 'choose'
            ? 'How would you like to use PayStables?'
            : accountType === 'merchant'
            ? 'Set up your store to start accepting USDC payments.'
            : 'Choose an avatar and set your username so friends can find you.'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8 flex flex-col">
        <AnimatePresence mode="wait">
          {/* ── Step 1: Choose Account Type ──────────────────────────────── */}
          {step === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-4 flex-1"
            >
              <button
                onClick={() => handleChoose('user')}
                className="card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform border-2 border-transparent hover:border-primary/30"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-text-primary text-lg">Personal</p>
                  <p className="text-sm text-text-secondary mt-0.5">Send &amp; receive payments, split bills, use AI Vaults</p>
                </div>
              </button>

              <button
                onClick={() => handleChoose('merchant')}
                className="card p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform border-2 border-transparent hover:border-emerald-400/30"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Store className="w-7 h-7 text-emerald-500" />
                </div>
                <div>
                  <p className="font-bold text-text-primary text-lg">Business</p>
                  <p className="text-sm text-text-secondary mt-0.5">Accept USDC payments with a QR code at your store</p>
                </div>
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Profile Form ────────────────────────────────────── */}
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col flex-1"
            >
              {/* Back button */}
              <button
                onClick={() => setStep('choose')}
                className="text-primary text-sm font-bold mb-4 self-start"
              >
                ← Back
              </button>

              {accountType === 'user' ? (
                <>
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
                </>
              ) : (
                <>
                  {/* Business name */}
                  <div className="mb-4">
                    <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2 pl-1">Business Name</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Chai Corner, Pizza Palace"
                      className="input-field"
                    />
                  </div>
                </>
              )}

              {/* Username */}
              <div className="mb-6">
                <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2 pl-1">
                  {accountType === 'merchant' ? 'Store Handle' : 'Username'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-bold text-sm">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleUsername(e.target.value)}
                    placeholder={accountType === 'merchant' ? 'your_store' : 'your_handle'}
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
                {accountType === 'merchant' && isAvailable === true && (
                  <p className="text-xs text-text-tertiary mt-1 pl-1">
                    Your payment link: paystables.app/pay/@{username}
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-danger-light border border-red-200 rounded-2xl p-4 mb-4 text-sm text-danger font-medium">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={
                  !username ||
                  !isAvailable ||
                  (accountType === 'user' && !displayName) ||
                  (accountType === 'merchant' && !businessName) ||
                  submitting
                }
                className="btn-primary mt-auto"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : accountType === 'merchant' ? (
                  'Create Business Profile →'
                ) : (
                  'Create Profile →'
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
