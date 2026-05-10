'use client'

import { useState, useEffect } from 'react'
import { searchProfiles, createBillSplit, createPaymentRequest } from '@/lib/supabase'
import { Search, Plus, Trash2, CheckCircle2, Loader2, Receipt } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { motion } from 'framer-motion'
import type { Profile } from '@/lib/types'

type Step = 'details' | 'people' | 'confirm' | 'success'

export default function SplitPage() {
  const { address, isConnected } = useActiveAddress()
  const router = useRouter()

  const [step, setStep] = useState<Step>('details')
  const [title, setTitle] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [participants, setParticipants] = useState<Profile[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const results = await searchProfiles(searchQuery)
      const existing = participants.map((p) => p.wallet_address)
      setSearchResults(results.filter((r) => r.wallet_address !== address?.toLowerCase() && !existing.includes(r.wallet_address)))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, address, participants])

  const addParticipant = (user: Profile) => {
    setParticipants([...participants, user])
    setSearchQuery('')
    setSearchResults([])
  }

  const removeParticipant = (i: number) => setParticipants(participants.filter((_, idx) => idx !== i))

  const getShare = () => {
    if (!totalAmount || participants.length === 0) return '0.00'
    return (parseFloat(totalAmount) / (participants.length + 1)).toFixed(2)
  }

  const handleSubmit = async () => {
    if (!address || !title || !totalAmount || participants.length === 0) return
    setSubmitting(true)
    try {
      const share = parseFloat(totalAmount) / (participants.length + 1)
      const participantData = participants.map((p) => ({ address: p.wallet_address, amount: share }))
      await createBillSplit(address, title, parseFloat(totalAmount), participantData)
      for (const p of participantData) {
        await createPaymentRequest(address, p.address, p.amount, `Bill split: ${title}`)
      }
      setStep('success')
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const stepIndex = { details: 0, people: 1, confirm: 2, success: 3 }[step]
  const steps = ['Details', 'People', 'Confirm']

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-text-secondary">Connect your wallet first.</p>
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex-1 flex flex-col">
        <div className="hero-gradient px-5 pt-14 pb-8" />
        <div className="flex-1 bg-bg-body px-5 pt-8 pb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircle2 className="w-10 h-10 text-success" />
          </motion.div>
          <h1 className="font-display font-bold text-3xl text-text-primary mb-2">Requests Sent!</h1>
          <p className="text-text-secondary mb-10">
            ${getShare()} USDC requested from each of {participants.length} people for "{title}"
          </p>
          <button onClick={() => router.push('/')} className="btn-primary max-w-xs">Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="hero-gradient px-5 pt-14 pb-6">
        <h1 className="font-display font-bold text-2xl text-white mb-5">Split a Bill</h1>
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${i < stepIndex ? 'text-white' : i === stepIndex ? 'text-white' : 'text-indigo-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < stepIndex ? 'bg-success text-white' : i === stepIndex ? 'bg-white text-primary' : 'bg-white/20 text-indigo-300'
                }`}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:block">{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-success' : 'bg-white/20'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8 flex flex-col">

        {/* ── Step: Details ──────────────────────────────────────── */}
        {step === 'details' && (
          <motion.div className="flex flex-col flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-4">
              <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2 pl-1">What's this for?</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Dinner at Taj"
                className="input-field"
                autoFocus
              />
            </div>
            <div className="mb-8">
              <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest block mb-2 pl-1">Total Amount (USDC)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-bold">$</span>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-field pl-8 font-display font-bold text-2xl"
                />
              </div>
            </div>
            <button
              onClick={() => setStep('people')}
              disabled={!title || !totalAmount || parseFloat(totalAmount) <= 0}
              className="btn-primary mt-auto"
            >
              Next: Add People →
            </button>
          </motion.div>
        )}

        {/* ── Step: People ───────────────────────────────────────── */}
        {step === 'people' && (
          <motion.div className="flex flex-col flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by @username..."
                className="input-field pl-11"
              />
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => addParticipant(user)}
                    className="card flex items-center gap-3 px-4 py-3 active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center text-xl">{user.avatar_emoji}</div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-text-primary">{user.display_name}</p>
                      <p className="text-xs text-text-tertiary">@{user.username}</p>
                    </div>
                    <Plus className="w-5 h-5 text-primary" />
                  </button>
                ))}
              </div>
            )}

            {/* Participants list */}
            {participants.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-3 pl-1">
                  Splitting with ({participants.length} people + you)
                </p>
                {/* You */}
                <div className="flex items-center gap-3 bg-success-light border border-green-200 rounded-2xl px-4 py-3 mb-2">
                  <span className="text-xl">🫵</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-success">You (already paid)</p>
                  </div>
                  <p className="font-bold text-sm text-success">${getShare()}</p>
                </div>
                {participants.map((p, i) => (
                  <div key={p.id} className="card flex items-center gap-3 px-4 py-3 mb-2">
                    <span className="text-xl">{p.avatar_emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-text-primary">{p.display_name}</p>
                      <p className="text-xs text-text-tertiary">@{p.username} · will pay you</p>
                    </div>
                    <p className="font-bold text-sm text-warning mr-2">${getShare()}</p>
                    <button onClick={() => removeParticipant(i)} className="w-7 h-7 bg-danger-light rounded-full flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5 text-danger" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-auto">
              <button onClick={() => setStep('details')} className="btn-secondary flex-1">← Back</button>
              <button
                onClick={() => setStep('confirm')}
                disabled={participants.length === 0}
                className="flex-1 bg-primary text-white font-bold rounded-2xl py-4 text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                Review →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step: Confirm ──────────────────────────────────────── */}
        {step === 'confirm' && (
          <motion.div className="flex flex-col flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="card p-5 mb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-warning-light rounded-2xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-text-primary">{title}</h2>
                  <p className="text-xs text-text-tertiary">Split among {participants.length + 1} people</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Total bill</span>
                  <span className="font-bold text-text-primary">${parseFloat(totalAmount).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Your share (paid)</span>
                  <span className="font-bold text-success">${getShare()} ✓</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-text-primary">You collect</span>
                  <span className="font-display font-bold text-2xl text-warning">
                    ${(parseFloat(getShare()) * participants.length).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-auto">
              <button onClick={() => setStep('people')} className="btn-secondary flex-1">← Back</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-primary text-white font-bold rounded-2xl py-4 text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Requests ✓'}
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}
