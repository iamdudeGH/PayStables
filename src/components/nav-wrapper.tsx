'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/bottom-nav'
import { MerchantNav } from '@/components/merchant-nav'

const AUTH_ROUTES = ['/login', '/setup']
const MERCHANT_ROUTES = ['/merchant']
const PUBLIC_ROUTES = ['/pay']

/**
 * Wraps BottomNav / MerchantNav in a Client Component so we can read usePathname()
 * and show the right nav or hide it on auth/public routes.
 */
export function NavWrapper() {
  const pathname = usePathname()

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
  const isMerchantRoute = MERCHANT_ROUTES.some((r) => pathname.startsWith(r))

  // Hide nav on auth and public payment pages
  if (isAuthRoute || isPublicRoute) return null

  // Show merchant nav for merchant routes
  if (isMerchantRoute) return <MerchantNav />

  // Default: user nav
  return <BottomNav />
}
