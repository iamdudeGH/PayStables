'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, ArrowDownToLine, Wallet } from 'lucide-react'
import { useActiveAddress } from '@/lib/useActiveAddress'

interface BridgeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function BridgeModal({ isOpen, onClose }: BridgeModalProps) {
  const { address, wagmiConnected, privyWallet } = useActiveAddress()
  
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div 
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[400px] bg-white rounded-3xl p-6 shadow-elevated z-10 overflow-hidden"
        >
          <div className="absolute top-4 right-4">
            <button 
              onClick={onClose}
              className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="w-12 h-12 bg-primary-light rounded-2xl flex items-center justify-center text-primary mb-5">
            <ArrowDownToLine className="w-6 h-6" />
          </div>

          <h2 className="font-display font-bold text-2xl text-text-primary mb-2">
            Add USDC
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            PayStables runs on the fast, gasless Arc Testnet. Choose how you want to add testnet USDC.
          </p>

          <div className="space-y-3">
            {wagmiConnected ? (
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full card flex items-center gap-4 p-4 hover:border-primary transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 bg-[#2775CA]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">💧</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">
                    Circle Faucet
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Get free testnet USDC directly on Arc
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-text-tertiary group-hover:text-primary transition-colors" />
              </a>
            ) : (
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full card flex items-center gap-4 p-4 hover:border-primary transition-colors group cursor-pointer"
              >
                <div className="w-10 h-10 bg-[#2775CA]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">💧</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm text-text-primary group-hover:text-primary transition-colors">
                    Circle Faucet
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Get free testnet USDC directly on Arc
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-text-tertiary group-hover:text-primary transition-colors" />
              </a>
            )}

            <div className="relative py-3 flex items-center">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink-0 mx-4 text-text-tertiary text-xs font-semibold uppercase">Or</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <div className="w-full card flex flex-col gap-2 p-4 opacity-70">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm text-text-primary">
                    Bridge from Sepolia
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Move existing USDC to Arc
                  </p>
                </div>
              </div>
              <p className="text-xs text-text-tertiary bg-bg-subtle p-2 rounded-xl mt-2 text-center font-medium">
                Full in-app bridging coming in Phase 2
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
