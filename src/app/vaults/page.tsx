'use client'

import { useState, useEffect } from 'react'
import { Brain, Lock, Unlock, Loader2, ArrowRight, X, ShieldCheck, Globe, Link as LinkIcon, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useActiveAddress } from '@/lib/useActiveAddress'
import { getSmartVaultsForUser, createSmartVault, updateSmartVaultStatus, searchProfiles } from '@/lib/supabase'
import { useERC20Transfer } from '@/lib/useERC20Transfer'
import { toast } from '@/components/toast'
import type { SmartVault, Profile } from '@/lib/types'

const EXPLORER = 'https://testnet.arcscan.app'


export default function SmartVaultsPage() {
  const { address, isConnected, wagmiConnected, privyWallet, signMessage } = useActiveAddress()
  const router = useRouter()

  const [vaults, setVaults] = useState<SmartVault[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null)
  const [releasingVault, setReleasingVault] = useState<SmartVault | null>(null)
  const [lastFailure, setLastFailure] = useState<{
    vaultId: string
    raw: string
    url: string
    condition: string
  } | null>(null)

  // Form State
  const [recipientSearch, setRecipientSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<Profile | null>(null)
  const [amount, setAmount] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [condition, setCondition] = useState('')

  const { sendWithWagmi, sendWithPrivy, txHash, isPending, isConfirmed, reset } = useERC20Transfer()

  useEffect(() => {
    if (!address) return
    loadVaults()
  }, [address])

  const loadVaults = async () => {
    if (!address) return
    try {
      setLoading(true)
      const data = await getSmartVaultsForUser(address)
      setVaults(data as SmartVault[])
    } catch (err) {
      console.error('Failed to load vaults:', err)
      toast.error('Failed to load vaults')
    } finally {
      setLoading(false)
    }
  }

  // Handle Search
  useEffect(() => {
    if (recipientSearch.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const results = await searchProfiles(recipientSearch)
      setSearchResults(results.filter((r) => r.wallet_address !== address?.toLowerCase()))
    }, 300)
    return () => clearTimeout(t)
  }, [recipientSearch, address])

  // Handle Release Tx Confirmation
  useEffect(() => {
    if (isConfirmed && releasingVault && txHash) {
      updateSmartVaultStatus(releasingVault.id, 'released', txHash)
        .then(() => {
          toast.success('Funds successfully released to recipient! 💸')
        })
        .catch((err) => {
          console.error('Failed to update DB:', err)
          toast.error('Funds released, but failed to update database status.')
        })
        .finally(() => {
          setEvaluatingId(null)
          setReleasingVault(null)
          reset()
          loadVaults()
        })
    }
  }, [isConfirmed, releasingVault, txHash, reset])

  const resetForm = () => {
    setSelectedRecipient(null)
    setRecipientSearch('')
    setAmount('')
    setTargetUrl('')
    setCondition('')
    reset()
  }

  const handleLockFunds = async () => {
    if (!selectedRecipient || !amount || !targetUrl || !condition) return
    
    try {
      await createSmartVault(
        address as string,
        selectedRecipient.wallet_address,
        parseFloat(amount),
        targetUrl,
        condition
      )
      toast.success('Smart Vault locked! 🔒')
      setIsCreating(false)
      resetForm()
      loadVaults()
    } catch {
      toast.error('Failed to save vault')
    }
  }

  const handleSimulateAI = async (vault: SmartVault) => {
    if (vault.creator_address !== address?.toLowerCase()) {
      toast.error('Only the funder can trigger evaluation in this demo.')
      return
    }

    setEvaluatingId(vault.id)
    
    try {
      // 1. Prompt for cryptographic signature
      const message = `Authorize ArcPay to evaluate Smart Vault: ${vault.id}`
      let signature
      try {
        signature = await signMessage(message)
      } catch (e) {
        toast.error('Signature rejected')
        setEvaluatingId(null)
        return
      }

      toast.success('Querying GenLayer AI Nodes — this may take ~30s...')
      
      // Call our backend API route which signs and submits the GenLayer transaction
      const response = await fetch('/api/evaluate-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultId: vault.id,
          callerAddress: address,
          signature,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'API error')
      }

      const isSuccess = data.result === 'TRUE'
      
      if (isSuccess) {
        toast.success('Arc Consensus met! Releasing funds...')
        setLastFailure(null)
        setReleasingVault(vault)
        
        const to = vault.recipient_address as `0x${string}`
        const amt = vault.amount.toString()
        
        reset()
        if (wagmiConnected) {
          sendWithWagmi(to, amt, 'USDC')
        } else if (privyWallet) {
          try {
            await sendWithPrivy(privyWallet, to, amt, 'USDC')
          } catch {
            setEvaluatingId(null)
            setReleasingVault(null)
            toast.error('Transaction failed or rejected')
          }
        }
      } else {
        toast.error('Condition not met')
        setLastFailure({
          vaultId: vault.id,
          raw: data.raw || 'No response from AI',
          url: vault.target_url,
          condition: vault.condition_prompt,
        })
        setEvaluatingId(null)
        loadVaults()
      }
    } catch (error) {
      console.error('GenLayer execution error:', error)
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      setLastFailure({
        vaultId: vault.id,
        raw: `Network error: ${errMsg}`,
        url: vault.target_url,
        condition: vault.condition_prompt,
      })
      toast.error('Failed to execute AI contract')
      setEvaluatingId(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-text-secondary">Connect your wallet to access Smart Vaults.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col relative pb-20">
      <div className="hero-gradient px-5 pt-14 pb-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        <h1 className="font-display font-bold text-3xl text-white mb-2 flex items-center gap-2">
          <Brain className="w-8 h-8 text-indigo-300" /> Smart Vaults
        </h1>
        <p className="text-indigo-200 text-sm">Programmable escrows powered by AI consensus.</p>
      </div>

      <div className="flex-1 bg-bg-body px-5 pt-6 pb-8">
        
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full bg-primary text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-bold mb-6 active:scale-95 transition-transform shadow-md shadow-primary/20"
          >
            <Plus className="w-5 h-5" /> Create Smart Vault
          </button>
        )}

        {/* ── CREATE VAULT FORM ────────────────────────────────────────────── */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card overflow-hidden mb-8"
            >
              <div className="p-4 border-b border-border flex justify-between items-center bg-bg-subtle">
                <h2 className="font-bold text-text-primary flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" /> New AI Escrow
                </h2>
                <button onClick={() => setIsCreating(false)} className="text-text-tertiary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Recipient */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2 block">1. Recipient</label>
                  {!selectedRecipient ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        placeholder="Search @username..."
                        className="input-field"
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                          {searchResults.map(user => (
                            <button
                              key={user.id}
                              onClick={() => { setSelectedRecipient(user); setSearchResults([]); setRecipientSearch('') }}
                              className="w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-bg-subtle font-bold text-sm"
                            >
                              {user.display_name} <span className="text-text-tertiary font-normal">@{user.username}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-bg-subtle px-4 py-3 rounded-xl border border-border">
                      <p className="font-bold text-sm">{selectedRecipient.display_name}</p>
                      <button onClick={() => setSelectedRecipient(null)} className="text-danger text-xs font-bold">Remove</button>
                    </div>
                  )}
                </div>

                {/* Target URL */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2 block">2. Data Source URL</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <input
                      type="url"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://espn.com"
                      className="input-field pl-9"
                    />
                  </div>
                </div>

                {/* AI Condition Prompt */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2 block">3. AI Condition</label>
                  <textarea
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="e.g. Check the website. If the Knicks won the game, return TRUE."
                    className="input-field resize-none h-24"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2 block">4. Lock Amount (USDC)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="input-field text-2xl font-bold"
                  />
                </div>

                <button
                  onClick={handleLockFunds}
                  disabled={!selectedRecipient || !targetUrl || !condition || !amount}
                  className="btn-primary mt-2"
                >
                  <Lock className="w-4 h-4" /> Lock ${amount} in Vault
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ACTIVE VAULTS ────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-text-tertiary text-xs font-bold uppercase tracking-widest mb-3 pl-1">Your Vaults</h2>
          
          {loading ? (
            <div className="flex flex-col items-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
          ) : vaults.length === 0 ? (
            <div className="card p-8 flex flex-col items-center text-center">
              <ShieldCheck className="w-12 h-12 text-text-tertiary/30 mb-3" />
              <p className="font-bold text-text-primary mb-1">No Active Vaults</p>
              <p className="text-sm text-text-tertiary">Create a vault to lock funds using an AI condition.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {vaults.map((vault) => {
                const isCreator = vault.creator_address === address?.toLowerCase()
                return (
                  <div key={vault.id} className="card overflow-hidden">
                    <div className="p-4 border-b border-border bg-bg-subtle flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {vault.status === 'locked' ? (
                          <Lock className="w-4 h-4 text-warning" />
                        ) : vault.status === 'evaluating' ? (
                          <Brain className="w-4 h-4 text-primary animate-pulse" />
                        ) : vault.status === 'failed' ? (
                          <X className="w-4 h-4 text-danger" />
                        ) : (
                          <Unlock className="w-4 h-4 text-success" />
                        )}
                        <p className="font-bold text-sm uppercase tracking-wider text-text-secondary">
                          {vault.status}
                        </p>
                      </div>
                      <p className="font-display font-bold text-xl">${vault.amount}</p>
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-tertiary">Role</span>
                        <span className="font-bold text-text-primary">{isCreator ? 'Creator (Funder)' : 'Recipient'}</span>
                      </div>
                      
                      <div className="p-3 bg-bg-body rounded-xl border border-border">
                        <div className="flex items-start gap-2 mb-2">
                          <LinkIcon className="w-4 h-4 text-text-tertiary mt-0.5 shrink-0" />
                          <a href={vault.target_url} target="_blank" className="text-primary text-xs truncate underline">{vault.target_url}</a>
                        </div>
                        <div className="flex items-start gap-2">
                          <Brain className="w-4 h-4 text-text-tertiary mt-0.5 shrink-0" />
                          <p className="text-xs text-text-secondary leading-relaxed">"{vault.condition_prompt}"</p>
                        </div>
                      </div>

                      {vault.status === 'locked' && (
                        <button
                          onClick={() => { setLastFailure(null); handleSimulateAI(vault) }}
                          disabled={evaluatingId === vault.id}
                          className="mt-2 w-full py-2.5 rounded-xl border border-primary text-primary font-bold text-sm flex items-center justify-center gap-2 active:bg-primary/5 transition-colors"
                        >
                          {evaluatingId === vault.id ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Evaluator running...</>
                          ) : (
                            <><Brain className="w-4 h-4" /> Trigger AI Evaluation</>
                          )}
                        </button>
                      )}

                      {/* ── Failure Detail Card ──────────────────────── */}
                      {lastFailure?.vaultId === vault.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 p-4 bg-danger/5 border border-danger/20 rounded-xl"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-danger">AI Evaluation Failed</p>
                            <button onClick={() => setLastFailure(null)} className="text-text-tertiary">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex flex-col gap-2 text-xs text-text-secondary">
                            <div>
                              <span className="font-bold text-text-primary">AI Response: </span>
                              <span className="font-mono bg-bg-subtle px-1.5 py-0.5 rounded text-danger">{lastFailure.raw}</span>
                            </div>
                            <div>
                              <span className="font-bold text-text-primary">URL checked: </span>
                              <a href={lastFailure.url} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{lastFailure.url}</a>
                            </div>
                            <div>
                              <span className="font-bold text-text-primary">Condition: </span>
                              <span className="italic">"{lastFailure.condition}"</span>
                            </div>
                            <p className="text-text-tertiary mt-1">💡 Try a more specific condition, or verify the URL shows the expected data.</p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
