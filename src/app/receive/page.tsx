'use client'

import { useAccount } from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, CheckCircle2, Share2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getProfileByAddress } from '@/lib/supabase'
import { useWallets, usePrivy } from '@privy-io/react-auth'
import { motion } from 'framer-motion'

export default function Receive() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { wallets } = useWallets()
  const { authenticated } = usePrivy()
  const privyWallet = wallets.find((w) => w.walletClientType === 'privy')
  const externalWallet = wallets.find((w) => w.walletClientType !== 'privy')
  const address = wagmiAddress || privyWallet?.address || externalWallet?.address
  const isConnected = wagmiConnected || authenticated

  const [copied, setCopied] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    if (address) getProfileByAddress(address).then(setProfile)
  }, [address])

  const handleCopy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (!address || !navigator.share) return
    const recipientParam = profile?.username ? `@${profile.username}` : address
    await navigator.share({
      title: 'Pay me on PayStables',
      text: `Send me USDC! My handle: @${profile?.username || address}`,
      url: `https://paystables.app/scan?to=${recipientParam}`,
    })
  }

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-text-secondary">Connect your wallet to show your QR code.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="hero-gradient px-5 pt-14 pb-8 text-center">
        <h1 className="font-display font-bold text-2xl text-white mb-1">Receive</h1>
        <p className="text-indigo-200 text-sm">Show this QR to receive USDC instantly</p>
      </div>

      {/* QR Card */}
      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="card w-full p-6 flex flex-col items-center mb-4"
        >
          {/* Profile badge */}
          {profile && (
            <div className="flex items-center gap-2 bg-primary-light text-primary pr-4 pl-1.5 py-1.5 rounded-full mb-6 text-sm font-bold">
              <img 
                src={`https://api.dicebear.com/9.x/shapes/svg?seed=${profile?.username || address}&backgroundColor=0a0a0a`} 
                alt="Avatar" 
                className="w-6 h-6 rounded-full"
              />
              <span>@{profile.username}</span>
            </div>
          )}

          {/* QR Code */}
          <div className="bg-white p-4 rounded-[20px] border border-border shadow-sm mb-6">
            <QRCodeSVG
              value={`paystables://transfer?address=${address}`}
              size={200}
              level="H"
              includeMargin={false}
              fgColor="#0F172A"
            />
          </div>

          {/* Address row */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 bg-bg-subtle border border-border rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-transform"
          >
            <span className="font-mono text-xs text-text-secondary truncate flex-1 text-left">
              {address}
            </span>
            {copied
              ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
              : <Copy className="w-4 h-4 text-text-tertiary flex-shrink-0" />
            }
          </button>
        </motion.div>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="btn-primary"
        >
          <Share2 className="w-5 h-5" />
          Share Payment Link
        </button>
      </div>
    </div>
  )
}
