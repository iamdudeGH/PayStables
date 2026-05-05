'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { arcTestnet } from '@/lib/wagmi'
import { TOKENS, ERC20_ABI } from '@/lib/tokens'

type TokenKey = keyof typeof TOKENS

import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'

/**
 * Hook for sending ERC-20 token transfers (USDC or EURC) on Arc Testnet.
 *
 * This replaces the incorrect pattern of sendTransaction({ value: parseEther(amount) })
 * which was sending native gas (USDC) instead of the ERC-20 token balance.
 *
 * ERC-20 transfers must call the `transfer(address to, uint256 amount)` function
 * on the token contract — NOT send a native value transaction.
 */
export function useERC20Transfer() {
  const [privyPending, setPrivyPending] = useState(false)
  const [privyTxHash, setPrivyTxHash] = useState<`0x${string}` | undefined>()
  const [privyError, setPrivyError] = useState<string | null>(null)

  const { client: smartWalletClient } = useSmartWallets()

  const {
    writeContract,
    data: wagmiHash,
    isPending: wagmiPending,
    error: wagmiError,
  } = useWriteContract()

  const { isLoading: wagmiConfirming, isSuccess: wagmiConfirmed } =
    useWaitForTransactionReceipt({ hash: wagmiHash })

  const { isLoading: privyConfirming, isSuccess: privyConfirmed } =
    useWaitForTransactionReceipt({ hash: privyTxHash })

  const txHash = wagmiHash || privyTxHash
  const isPending = wagmiPending || wagmiConfirming || privyPending || privyConfirming
  const isConfirmed = wagmiConfirmed || privyConfirmed
  const error = wagmiError?.message || privyError || null

  /**
   * Send ERC-20 tokens using wagmi (external wallet).
   */
  const sendWithWagmi = (
    to: `0x${string}`,
    amount: string,
    token: TokenKey = 'USDC'
  ) => {
    const tokenConfig = TOKENS[token]
    writeContract({
      address: tokenConfig.address,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, parseUnits(amount, tokenConfig.decimals)],
    })
  }

  /**
   * Send ERC-20 tokens using Privy embedded Smart Wallet provider (Gasless).
   */
  const sendWithPrivy = async (
    privyWallet: { address: string; getEthereumProvider: () => Promise<unknown> },
    to: `0x${string}`,
    amount: string,
    token: TokenKey = 'USDC'
  ) => {
    setPrivyPending(true)
    setPrivyError(null)
    try {
      const tokenConfig = TOKENS[token]
      const { encodeFunctionData } = await import('viem')

      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [to, parseUnits(amount, tokenConfig.decimals)],
      })

      let hash: `0x${string}`

      if (smartWalletClient) {
        // Send sponsored transaction via Smart Wallet & Paymaster
        hash = await smartWalletClient.sendTransaction({
          account: smartWalletClient.account,
          chain: arcTestnet as any,
          to: tokenConfig.address,
          data,
          value: BigInt(0),
        }, {
          uiOptions: {
            showWalletUIs: false
          }
        })
      } else {
        // Fallback to standard EOA if Smart Wallets aren't ready/enabled
        const provider = await privyWallet.getEthereumProvider()
        const { createWalletClient, custom } = await import('viem')
        const walletClient = createWalletClient({
          account: privyWallet.address as `0x${string}`,
          chain: arcTestnet,
          transport: custom(provider as Parameters<typeof custom>[0]),
        })
        hash = await walletClient.sendTransaction({
          to: tokenConfig.address,
          data,
          chain: arcTestnet,
        })
      }

      setPrivyTxHash(hash)
      return hash
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? (err as Error & { shortMessage?: string }).shortMessage || err.message
          : 'Transaction failed'
      setPrivyError(msg)
      throw err
    } finally {
      setPrivyPending(false)
    }
  }

  const reset = () => {
    setPrivyTxHash(undefined)
    setPrivyError(null)
  }

  return {
    sendWithWagmi,
    sendWithPrivy,
    txHash,
    isPending,
    isConfirmed,
    error,
    reset,
  }
}
