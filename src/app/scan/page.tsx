'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ArrowRight, Loader2, Search, Camera, X, ChevronRight } from 'lucide-react'
import { arcTestnet } from '@/lib/wagmi'
import { getProfileByAddress, searchProfiles, getRecentContacts, upsertRecentContact } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { useERC20Transfer } from '@/lib/useERC20Transfer'
import { toast } from '@/components/toast'
import type { Profile } from '@/lib/types'

const EXPLORER = 'https://testnet.arcscan.app'

type Mode = 'scan' | 'search'
type Step = 'pick' | 'amount' | 'success'

export default function ScanAndPay() {
  const { address, isConnected, wagmiConnected, privyWallet } = useActiveAddress()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<Mode>('search')
  const [step, setStep] = useState<Step>('pick')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [recipient, setRecipient] = useState<Profile | null>(null)
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [recentContacts, setRecentContacts] = useState<{ contact: any, profile: Profile | null }[]>([])

  const { sendWithWagmi, sendWithPrivy, txHash, isPending, isConfirmed, error, reset } = useERC20Transfer()

  // ── Deep Linking: Read URL Params ──────────────────────────────
  useEffect(() => {
    const toParam = searchParams.get('to')
    const amountParam = searchParams.get('amount')

    if (toParam && !recipient) {
      const fetchDeepLinkUser = async () => {
        // Strip '@' if present
        const username = toParam.startsWith('@') ? toParam.substring(1) : toParam
        const profiles = await searchProfiles(username)
        // Find exact match
        const exactMatch = profiles.find(p => p.username.toLowerCase() === username.toLowerCase())
        
        if (exactMatch && exactMatch.wallet_address !== address?.toLowerCase()) {
          setRecipient(exactMatch)
          setRecipientAddress(exactMatch.wallet_address)
          if (amountParam) setAmount(amountParam)
          setStep('amount')
        } else {
          toast.error(`User @${username} not found`)
        }
      }
      fetchDeepLinkUser()
    }
  }, [searchParams, address, recipient])

  useEffect(() => {
    if (isConfirmed) {
      setStep('success')
      if (address && recipientAddress) {
        upsertRecentContact(address, recipientAddress)
      }
    }
  }, [isConfirmed, address, recipientAddress])

  useEffect(() => {
    if (error) toast.error(error.slice(0, 120))
  }, [error])

  // Search debounce
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
    if (address && mode === 'search') {
      getRecentContacts(address).then(setRecentContacts)
    }
  }, [address, mode])

  // QR Scanner — dynamic import to avoid SSR issues
  useEffect(() => {
    if (mode !== 'scan' || step !== 'pick' || recipientAddress) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: any = null
    const init = async () => {
      const { Html5QrcodeScanner } = await import('html5-qrcode')
      if (!document.getElementById('reader')) return
      scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 }, false)
      scanner.render(async (decoded: string) => {
        let addr = ''
        if (decoded.includes('paystables://transfer?address=')) addr = decoded.split('address=')[1]
        else if (decoded.startsWith('0x') && decoded.length === 42) addr = decoded
        if (addr) {
          setRecipientAddress(addr)
          const p = await getProfileByAddress(addr)
          if (p) setRecipient(p)
          scanner?.clear()
          setStep('amount')
        }
      }, () => {})
    }
    init()
    return () => { if (scanner) scanner.clear().catch(() => {}) }
  }, [mode, step, recipientAddress])

  const selectUser = (user: Profile) => {
    setRecipientAddress(user.wallet_address)
    setRecipient(user)
    setSearchQuery('')
    setSearchResults([])
    setStep('amount')
  }

  const handleSend = async () => {
    if (!recipientAddress || !amount) return
    reset()
    const to = recipientAddress as `0x${string}`

    if (wagmiConnected) {
      sendWithWagmi(to, amount, 'USDC')
      return
    }
    if (privyWallet) {
      try {
        await sendWithPrivy(privyWallet, to, amount, 'USDC')
      } catch {
        // error already shown via toast in useEffect above
      }
    }
  }

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-text-secondary">Connect your wallet to send payments.</p>
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
          <h1 className="font-display font-bold text-3xl text-text-primary mb-2">Sent!</h1>
          <p className="text-text-secondary mb-1">
            ${amount} USDC sent to{' '}
            <span className="font-bold text-text-primary">
              {recipient ? `@${recipient.username}` : recipientAddress?.slice(0, 10) + '…'}
            </span>
          </p>
          <p className="text-xs text-text-tertiary mb-4">Confirmed in under 1 second ⚡</p>
          {txHash && (
            <a
              href={`${EXPLORER}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-sm font-semibold underline mb-8"
            >
              View on ArcScan →
            </a>
          )}
          <button onClick={() => router.push('/')} className="btn-primary max-w-xs mt-2">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // ── Amount step ────────────────────────────────────────────────
  if (step === 'amount') {
    return (
      <div className="flex-1 flex flex-col">
        <div className="hero-gradient px-5 pt-14 pb-8">
          <h1 className="font-display font-bold text-2xl text-white mb-1">Send Payment</h1>
          <p className="text-indigo-200 text-sm">Enter the amount to send</p>
        </div>
        <div className="flex-1 bg-bg-body px-5 pt-6 pb-8 flex flex-col">
          {/* Recipient chip */}
          <div className="card flex items-center gap-3 px-4 py-3.5 mb-8">
            <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
              <img 
                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${recipient?.username || recipientAddress}&backgroundColor=0a0a0a`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-text-primary">
                {recipient?.display_name ?? recipientAddress?.slice(0, 12) + '…'}
              </p>
              {recipient && <p className="text-xs text-text-tertiary">@{recipient.username}</p>}
            </div>
            <button
              onClick={() => { setStep('pick'); setRecipient(null); setRecipientAddress(null); setAmount('') }}
              className="w-7 h-7 bg-bg-subtle rounded-full flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5 text-text-tertiary" />
            </button>
          </div>

          {/* Amount input */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-text-tertiary text-xs font-bold uppercase tracking-widest mb-6">Amount (USDC)</p>
            <div className="flex items-baseline justify-center gap-2 mb-10 w-full">
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

            <button
              onClick={handleSend}
              disabled={isPending || !amount || parseFloat(amount) <= 0}
              className="btn-primary"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <><span>Send ${amount || '0'}</span><ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Pick recipient step ────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="hero-gradient px-5 pt-14 pb-5">
        <h1 className="font-display font-bold text-2xl text-white mb-4">Pay Someone</h1>
        {/* Mode switcher */}
        <div className="flex bg-white/15 rounded-2xl p-1 gap-1">
          {(['search', 'scan'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mode === m ? 'bg-white text-primary shadow-sm' : 'text-indigo-200'
              }`}
            >
              {m === 'scan' ? <Camera className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              {m === 'scan' ? 'Scan QR' : 'Search'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-bg-body px-5 pt-5 pb-8">
        {mode === 'search' ? (
          <>
            <div className="relative mb-5">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by @username..."
                className="input-field pl-11"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                  className="card flex items-center gap-3 px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
                >
                  <div className="w-11 h-11 bg-primary-light rounded-full flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
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
                          if (profile) selectUser(profile)
                          else {
                            setRecipientAddress(contact.contact_address)
                            setStep('amount')
                          }
                        }}
                        className="card flex items-center gap-3 px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
                      >
                        <div className="w-11 h-11 bg-primary-light rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-white">
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
          </>
        ) : (
          <div className="card overflow-hidden">
            <div id="reader" className="w-full [&>div]:border-none" />
            <p className="text-center text-sm text-text-tertiary py-4 font-medium">
              Point your camera at a PayStables QR code
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
