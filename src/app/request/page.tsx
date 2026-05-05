'use client'

import { useState, useEffect } from 'react'
import { searchProfiles, createPaymentRequest, getRecentContacts, upsertRecentContact } from '@/lib/supabase'
import { Search, ArrowRight, CheckCircle2, Loader2, ChevronRight, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { toast } from '@/components/toast'
import type { Profile } from '@/lib/types'

type Step = 'search' | 'amount' | 'success'

export default function RequestPage() {
  const { address, isConnected } = useActiveAddress()
  const router = useRouter()

  const [step, setStep] = useState<Step>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [recentContacts, setRecentContacts] = useState<{ contact: any, profile: Profile | null }[]>([])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const results = await searchProfiles(searchQuery)
      setSearchResults(results.filter((r) => r.wallet_address !== address?.toLowerCase()))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, address])

  // Fetch recent contacts
  useEffect(() => {
    if (address && step === 'search') {
      getRecentContacts(address).then(setRecentContacts)
    }
  }, [address, step])

  const handleSend = async () => {
    if (!address || !selectedUser || !amount) return
    setSending(true)
    try {
      await createPaymentRequest(address, selectedUser.wallet_address, parseFloat(amount), note)
      await upsertRecentContact(address, selectedUser.wallet_address)
      setStep('success')
    } catch (e) {
      console.error(e)
      toast.error('Failed to send payment request. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-text-secondary">Connect your wallet first.</p>
      </div>
    )
  }

  if (step === 'success' && selectedUser) {
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
          <h1 className="font-display font-bold text-3xl text-text-primary mb-2">Request Sent!</h1>
          <p className="text-text-secondary mb-1">
            ${amount} USDC requested from{' '}
            <span className="font-bold text-text-primary">
               @{selectedUser.username}
            </span>
          </p>
          {note && <p className="text-xs text-text-tertiary mb-6">"{note}"</p>}
          <button onClick={() => router.push('/')} className="btn-primary max-w-xs mt-4">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (step === 'amount' && selectedUser) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="hero-gradient px-5 pt-14 pb-8">
          <h1 className="font-display font-bold text-2xl text-white mb-1">Request Payment</h1>
          <p className="text-indigo-200 text-sm">How much do you need?</p>
        </div>
        <div className="flex-1 bg-bg-body px-5 pt-6 pb-8 flex flex-col">
          <div className="card flex items-center gap-3 px-4 py-3.5 mb-8">
            <div className="w-10 h-10 bg-warning-light rounded-full flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
              <img 
                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${selectedUser.username}&backgroundColor=0a0a0a`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-text-primary">{selectedUser.display_name}</p>
              <p className="text-xs text-text-tertiary">@{selectedUser.username}</p>
            </div>
            <button
              onClick={() => { setStep('search'); setSelectedUser(null); setAmount('') }}
              className="w-7 h-7 bg-bg-subtle rounded-full flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5 text-text-tertiary" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-text-tertiary text-xs font-bold uppercase tracking-widest mb-6">Amount (USDC)</p>
            <div className="flex items-baseline justify-center gap-2 mb-6 w-full">
              <span className="font-display font-bold text-5xl text-text-tertiary">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className="font-display font-bold text-6xl text-text-primary bg-transparent outline-none w-[60%] text-center appearance-none placeholder:text-slate-200"
              />
            </div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's this for? (optional)"
              className="input-field mb-8"
            />
            <button
              onClick={handleSend}
              disabled={!amount || parseFloat(amount) <= 0 || sending}
              className="btn-primary"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <><span>Request ${amount || '0'}</span><ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="hero-gradient px-5 pt-14 pb-5">
        <h1 className="font-display font-bold text-2xl text-white mb-4">Request Payment</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by @username..."
            className="w-full bg-white/15 border border-white/20 rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder:text-indigo-300 outline-none focus:bg-white/25 transition-colors text-sm font-medium"
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 bg-bg-body px-5 pt-5 pb-8">
        <div className="flex flex-col gap-2">
          {searchResults.map((user) => (
            <button
              key={user.id}
              onClick={() => { setSelectedUser(user); setStep('amount') }}
              className="card flex items-center gap-3 px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-11 h-11 bg-warning-light rounded-full flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
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
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-center text-text-tertiary text-sm py-10">No users found for "{searchQuery}"</p>
          )}
          {searchQuery.length === 0 && recentContacts.length > 0 && (
            <div className="mt-2">
              <p className="text-text-tertiary text-xs font-bold uppercase tracking-widest pl-1 mb-3">Recent</p>
              <div className="flex flex-col gap-2">
                {recentContacts.map(({ contact, profile }) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      if (profile) {
                        setSelectedUser(profile)
                        setStep('amount')
                      }
                    }}
                    className="card flex items-center gap-3 px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="w-11 h-11 bg-warning-light rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-white">
                      <img 
                        src={`https://api.dicebear.com/9.x/shapes/svg?seed=${profile?.username || contact.contact_address}&backgroundColor=0a0a0a`} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-text-primary">
                        {profile?.display_name || contact.contact_address.slice(0, 10) + '…'}
                      </p>
                      {profile && <p className="text-xs text-text-tertiary">@{profile.username}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
