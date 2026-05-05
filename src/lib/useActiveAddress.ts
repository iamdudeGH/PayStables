'use client'

import { useAccount, useSignMessage } from 'wagmi'
import { useWallets, usePrivy } from '@privy-io/react-auth'

/**
 * Returns the active wallet address, connection state, and a unified
 * signMessage function resolving across wagmi and Privy embedded wallets.
 */
export function useActiveAddress() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { wallets } = useWallets()
  const { authenticated } = usePrivy()

  const privyWallet = wallets.find((w) => w.walletClientType === 'privy')
  const externalWallet = wallets.find((w) => w.walletClientType !== 'privy')

  const address = (wagmiAddress ||
    privyWallet?.address ||
    externalWallet?.address) as `0x${string}` | undefined

  const isConnected = wagmiConnected || authenticated

  const signMessageUnified = async (message: string): Promise<string> => {
    if (wagmiConnected) {
      return await signMessageAsync({ message })
    } else if (privyWallet) {
      return await privyWallet.sign(message)
    }
    throw new Error('No wallet available to sign message')
  }

  return { address, isConnected, privyWallet, wagmiConnected, signMessage: signMessageUnified }
}
