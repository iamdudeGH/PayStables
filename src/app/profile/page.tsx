'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { useProfile } from '@/hooks/useProfile'
import { updateProfile } from '@/lib/supabase'
import { toast } from '@/components/toast'
import { LogOut, Copy, CheckCircle2, ChevronLeft, Loader2, ExternalLink, User } from 'lucide-react'
import Link from 'next/link'

const EXPLORER = 'https://testnet.arcscan.app'

export default function ProfilePage() {
  const router = useRouter()
  const { address, isConnected } = useActiveAddress()
  const { logout } = usePrivy()
  const { profile, loading } = useProfile(address)

  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedUsername, setCopiedUsername] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name)
    }
  }, [profile])

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-text-secondary">Connect your wallet to view profile.</p>
      </div>
    )
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const handleCopyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
    toast.success('Address copied!')
  }

  const handleCopyUsername = () => {
    if (!profile) return
    navigator.clipboard.writeText(profile.username)
    setCopiedUsername(true)
    setTimeout(() => setCopiedUsername(false), 2000)
    toast.success('Username copied!')
  }

  const handleSave = async () => {
    if (!address) return
    setSaving(true)
    try {
      // Keep the existing emoji in DB, just update name
      await updateProfile(address, displayName, profile?.avatar_emoji || '')
      toast.success('Profile updated!')
      setIsEditing(false)
    } catch (e) {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="hero-gradient px-5 pt-14 pb-16 relative">
        <Link href="/" className="absolute top-14 left-5 text-white/80 hover:text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="font-display font-bold text-2xl text-white text-center">Your Profile</h1>
      </div>

      <div className="flex-1 bg-bg-body px-5 pb-8 relative">
        {/* Profile Card Overlay */}
        <div className="card px-5 py-6 -mt-10 relative z-10 flex flex-col items-center">
          {isEditing ? (
            <div className="flex flex-col items-center w-full gap-4">
              <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mb-4 shadow-sm border border-white overflow-hidden">
                <img 
                  src={`https://api.dicebear.com/9.x/shapes/svg?seed=${profile?.username || address}&backgroundColor=0a0a0a`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field text-center font-bold"
                placeholder="Display Name"
              />
              <div className="flex gap-2 w-full mt-2">
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setDisplayName(profile?.display_name || '')
                  }}
                  className="flex-1 py-3 font-bold text-text-secondary bg-bg-subtle rounded-2xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !displayName}
                  className="flex-1 py-3 font-bold text-white bg-primary rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mb-4 shadow-sm border border-white overflow-hidden">
                <img 
                  src={`https://api.dicebear.com/9.x/shapes/svg?seed=${profile?.username || address}&backgroundColor=0a0a0a`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="font-display font-bold text-xl text-text-primary mb-1">
                {profile?.display_name}
              </h2>
              <button 
                onClick={handleCopyUsername}
                className="flex items-center gap-1.5 text-text-tertiary bg-bg-subtle px-3 py-1.5 rounded-full text-sm font-medium hover:text-text-primary transition-colors active:scale-95"
              >
                @{profile?.username}
                {copiedUsername ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              
              <button 
                onClick={() => setIsEditing(true)}
                className="mt-6 w-full py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:bg-bg-subtle transition-colors"
              >
                Edit Profile
              </button>
            </>
          )}
        </div>

        <div className="mt-8 space-y-3">
          <p className="text-text-tertiary text-xs font-bold uppercase tracking-widest pl-1 mb-2">Account Details</p>
          
          <button 
            onClick={handleCopyAddress}
            className="w-full card flex items-center justify-between px-4 py-4 active:scale-[0.98] transition-transform"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-text-primary mb-0.5">Wallet Address</p>
              <p className="text-xs text-text-tertiary font-mono">
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </p>
            </div>
            {copiedAddress ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : (
              <Copy className="w-5 h-5 text-text-tertiary" />
            )}
          </button>

          <a 
            href={`${EXPLORER}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="card flex items-center justify-between px-4 py-4 active:scale-[0.98] transition-transform"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-text-primary">View on ArcScan</p>
            </div>
            <ExternalLink className="w-5 h-5 text-text-tertiary" />
          </a>

          <button 
            onClick={handleLogout}
            className="w-full card flex items-center justify-between px-4 py-4 active:scale-[0.98] transition-transform text-danger"
          >
            <div className="text-left">
              <p className="text-sm font-semibold mb-0.5">Log Out</p>
              <p className="text-xs opacity-70">Disconnect your wallet</p>
            </div>
            <LogOut className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  )
}
