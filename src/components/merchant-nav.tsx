'use client'

import { Home, Clock, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { name: 'Dashboard', href: '/merchant',          icon: Home     },
  { name: 'History',   href: '/merchant/history',   icon: Clock    },
  { name: 'Settings',  href: '/merchant/settings',  icon: Settings },
]

export function MerchantNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 bg-bg-card border-t border-border">
      <div className="flex items-stretch h-[84px] pb-safe px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative group"
            >
              {isActive && (
                <span className="absolute top-3 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
              )}
              <Icon
                className={`w-[22px] h-[22px] transition-colors duration-150 ${
                  isActive
                    ? 'text-emerald-500'
                    : 'text-text-tertiary group-hover:text-text-secondary'
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={`text-[11px] font-semibold transition-colors duration-150 ${
                  isActive ? 'text-emerald-500' : 'text-text-tertiary'
                }`}
              >
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
