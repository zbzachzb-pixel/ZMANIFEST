'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function Navigation() {
  const pathname = usePathname()
  
  const links = [
    { href: '/', label: 'Dashboard', icon: '🏠' },
    { href: '/loads', label: 'Load Builder', icon: '✈️' },
    { href: '/queue', label: 'Queue', icon: '👥' },
    { href: '/instructors', label: 'Instructors', icon: '👨‍✈️' },
    { href: '/assignments', label: 'History', icon: '📋' },
    { href: '/analytics', label: 'Analytics', icon: '📊' },
    { href: '/notes', label: 'Notes', icon: '📝' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ]
  
  return (
    <nav className="bg-slate-800/50 backdrop-blur-lg border-b border-white/10 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🪂</span>
            <span className="text-white font-bold text-lg">Rotation System</span>
          </Link>
          
          <div className="flex gap-1">
            {links.map(link => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="mr-2">{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}