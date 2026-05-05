'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/bottom-nav'

const AUTH_ROUTES = ['/login', '/setup']

/**
 * Wraps BottomNav in a Client Component so we can read usePathname()
 * and hide the nav on auth/onboarding routes.
 * The root layout.tsx is a Server Component and cannot use hooks directly.
 */
export function NavWrapper() {
  const pathname = usePathname()
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  if (isAuthRoute) return null

  return <BottomNav />
}
