'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '@/lib/wagmi'
import { useState, useEffect } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'
import { arcTestnet } from '@/lib/wagmi'

import { ErrorBoundary } from '@/components/error-boundary'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Suppress known Privy/styled-components v6 bug where `isActive` is forwarded
    // to the DOM. Tracked upstream in @privy-io/react-auth. Safe to remove once
    // Privy releases a fix (peer-dep conflict prevents upgrading to 3.23.1 now).
    if (process.env.NODE_ENV === 'development') {
      const originalError = console.error.bind(console)
      console.error = (...args: unknown[]) => {
        const msg = typeof args[0] === 'string' ? args[0] : ''
        if (msg.includes('isActive') && msg.includes('DOM element')) return
        originalError(...args)
      }
      return () => { console.error = originalError }
    }
  }, [])

  return (
    <ErrorBoundary>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={{
          appearance: {
            theme: 'light',
            accentColor: '#2563EB',
            logo: undefined,
          },
          embeddedWallets: {
            showWalletUIs: false,
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
            priceDisplay: {
              primary: 'native-token',
              secondary: null,
            }
          },
          defaultChain: arcTestnet,
          supportedChains: [arcTestnet],
          loginMethods: ['email', 'wallet'],
        }}
      >
        <SmartWalletsProvider>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              {mounted && children}
            </QueryClientProvider>
          </WagmiProvider>
        </SmartWalletsProvider>
      </PrivyProvider>
    </ErrorBoundary>
  )
}
