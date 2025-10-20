'use client'

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { UndoRedoControls } from './UndoRedoControls'
import { useOptionalAuth } from '@/contexts/AuthContext'

interface NavLink {
  href: string
  label: string
  icon: string
  roles?: string[]
}

interface NavGroup {
  label: string
  icon: string
  links: NavLink[]
}

export function Navigation() {
  const pathname = usePathname()
  const auth = useOptionalAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // Organized navigation structure
  const navGroups: NavGroup[] = [
    {
      label: 'Operations',
      icon: '✈️',
      links: [
        { href: '/loads', label: 'Load Builder', icon: '✈️' },
        { href: '/queue', label: 'Queue', icon: '👥' },
        { href: '/requests', label: 'Fun Jumper Requests', icon: '🪂', roles: ['admin', 'manifest'] },
      ]
    },
    {
      label: 'Management',
      icon: '👨‍✈️',
      links: [
        { href: '/instructors', label: 'Instructors', icon: '👨‍✈️' },
        { href: '/assignments', label: 'History', icon: '📋' },
        { href: '/analytics', label: 'Analytics', icon: '📊' },
      ]
    },
    {
      label: 'System',
      icon: '⚙️',
      links: [
        { href: '/users', label: 'Users', icon: '👥', roles: ['admin'] },
        { href: '/notes', label: 'Notes', icon: '📝' },
        { href: '/settings', label: 'Settings', icon: '⚙️' },
      ]
    }
  ]

  // Filter links based on user role
  const filteredGroups = navGroups.map(group => ({
    ...group,
    links: group.links.filter(link => {
      if (!link.roles) return true
      return auth?.userProfile && link.roles.includes(auth.userProfile.role)
    })
  })).filter(group => group.links.length > 0)

  const toggleDropdown = (label: string) => {
    setActiveDropdown(activeDropdown === label ? null : label)
  }

  const closeDropdowns = () => {
    setActiveDropdown(null)
  }

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/10 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-90 transition-opacity group"
            onClick={closeDropdowns}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <span className="relative text-2xl">🪂</span>
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">ZMANIFEST</span>
              <p className="text-xs text-slate-400 font-medium">Instructor Rotation</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {/* Dashboard Link (always visible) */}
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
                pathname === '/'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={closeDropdowns}
            >
              <span className="mr-1.5">🏠</span>
              Dashboard
            </Link>

            {/* Grouped Dropdowns */}
            {filteredGroups.map(group => {
              const isOpen = activeDropdown === group.label
              const hasActiveLink = group.links.some(link => pathname === link.href)

              return (
                <div key={group.label} className="relative">
                  <button
                    onClick={() => toggleDropdown(group.label)}
                    className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 ${
                      hasActiveLink
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{group.icon}</span>
                    <span>{group.label}</span>
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {isOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={closeDropdowns}
                      />

                      {/* Dropdown Content */}
                      <div className="absolute top-full left-0 mt-1.5 w-52 bg-slate-800 border border-white/10 rounded-lg shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                        {group.links.map(link => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={closeDropdowns}
                            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                              pathname === link.href
                                ? 'bg-blue-500 text-white'
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="text-base">{link.icon}</span>
                            <span className="font-medium">{link.label}</span>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right Side: Undo/Redo & User Menu */}
          <div className="flex items-center gap-4">
            {/* Undo/Redo Controls (Desktop only) */}
            <div className="hidden lg:block">
              <UndoRedoControls />
            </div>

            {/* User Menu */}
            {auth?.user ? (
              <div className="flex items-center gap-2.5 pl-3 border-l border-white/20">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-semibold text-white">{auth.userProfile?.displayName}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{auth.userProfile?.role?.replace('_', ' ')}</p>
                </div>
                <button
                  onClick={() => auth.signOut()}
                  className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all font-medium border border-red-500/30 hover:border-red-500/50"
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/30"
              >
                Sign In
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-t border-white/10 animate-in slide-in-from-top duration-200">
          <div className="px-4 py-4 space-y-2">
            {/* Dashboard */}
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all ${
                pathname === '/'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>🏠</span>
              <span>Dashboard</span>
            </Link>

            {/* All Links (flat for mobile) */}
            {filteredGroups.map(group => (
              <div key={group.label} className="space-y-1">
                <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {group.label}
                </div>
                {group.links.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                      pathname === link.href
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xl">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            ))}

            {/* Undo/Redo on Mobile */}
            <div className="pt-4 border-t border-white/10">
              <UndoRedoControls />
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
