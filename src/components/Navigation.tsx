'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { UndoRedoControls } from './UndoRedoControls'
import { useOptionalAuth } from '@/contexts/AuthContext'

export function Navigation() {
  const pathname = usePathname()
  const auth = useOptionalAuth()

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

  // Add Requests link for manifest/admin only
  if (auth?.userProfile && ['admin', 'manifest'].includes(auth.userProfile.role)) {
    links.splice(6, 0, { href: '/requests', label: 'Requests', icon: '🪂' })
  }

  return (
    <nav className="bg-slate-800/50 backdrop-blur-lg border-b border-white/10 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🪂</span>
            <span className="text-white font-bold text-lg">Rotation System</span>
          </Link>

          {/* Navigation Links */}
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

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Undo/Redo Controls */}
            <UndoRedoControls />

            {/* User Menu */}
            {auth?.user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{auth.userProfile?.displayName}</p>
                  <p className="text-xs text-slate-400 capitalize">{auth.userProfile?.role?.replace('_', ' ')}</p>
                </div>
                <button
                  onClick={() => auth.signOut()}
                  className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}