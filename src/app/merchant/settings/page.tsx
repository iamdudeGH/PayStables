'use client'

import { useState, useEffect } from 'react'
import { Settings, LogOut, Loader2, Copy, Check, ExternalLink, Store } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { useProfile } from '@/hooks/useProfile'
import { toast } from '@/components/toast'

const EXPLORER = 'https://testnet.arcscan.app'

export default function MerchantSettingsPage() {
  const { address, isConnected } = useActiveAddress()
  const { ready, logout } = usePrivy()
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile(address)

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (ready && !isConnected) router.push('/login')
  }, [ready, isConnected, router])

  useEffect(() => {
    if (profile && profile.account_type !== 'merchant') router.push('/')
  }, [profile, router])

  const handleCopyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    toast.success('Wallet address copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
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
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 pt-14 pb-8">
        <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-200" /> Settings
        </h1>
        <p className="text-emerald-200 text-sm mt-1">Manage your business profile.</p>
      </div>

      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8">
        {/* Business Info */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-3xl">
              🏪
            </div>
            <div>
              <p className="font-bold text-lg text-text-primary">{profile?.business_name || profile?.display_name}</p>
              <p className="text-sm text-text-tertiary">@{profile?.username}</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">Account Type</span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600">
                <Store className="w-4 h-4" /> Business
              </span>
            </div>
          </div>
        </div>

        {/* Wallet Info */}
        <div className="card p-5 mb-4">
          <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-3">Wallet</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-primary font-mono">
              {address ? `${address.slice(0, 10)}…${address.slice(-8)}` : '—'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAddress}
                className="text-primary text-xs font-bold flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              {address && (
                <a
                  href={`${EXPLORER}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-xs font-bold flex items-center gap-1"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full card p-4 flex items-center justify-center gap-2 text-danger font-bold text-sm active:scale-95 transition-transform"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  )
}
