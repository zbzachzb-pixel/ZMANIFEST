// src/components/CreateUserModal.tsx
// Modal for admins to create new user accounts

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { UserRole } from '@/types/funJumpers'

interface CreateUserModalProps {
  onClose: () => void
  onSuccess: () => void
}

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'fun_jumper', label: 'Fun Jumper', description: 'Can submit jump requests' },
  { value: 'instructor', label: 'Instructor', description: 'Can view loads and assignments' },
  { value: 'manifest', label: 'Manifest', description: 'Can manage loads and approve requests' },
  { value: 'admin', label: 'Admin', description: 'Full system access' }
]

export function CreateUserModal({ onClose, onSuccess }: CreateUserModalProps) {
  const { signUp } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('fun_jumper')
  const [jumprunId, setJumprunId] = useState('')

  const modalRef = useRef<HTMLDivElement>(null)

  // Focus trap and ESC handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return

        const focusableElements = modalRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )

        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!email || !email.includes('@')) {
      toast.error('Invalid email', 'Please enter a valid email address')
      return
    }

    if (!displayName || displayName.trim().length < 2) {
      toast.error('Invalid name', 'Display name must be at least 2 characters')
      return
    }

    if (!password || password.length < 6) {
      toast.error('Invalid password', 'Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Password mismatch', 'Passwords do not match')
      return
    }

    if (!role) {
      toast.error('Role required', 'Please select a user role')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password, displayName, role)

      // If jumprunId was provided, update the profile
      if (jumprunId.trim()) {
        // Note: The signUp method doesn't return the user, so we'd need to
        // either modify the AuthContext or add the jumprunId in a follow-up call
        // For now, we'll skip jumprunId during creation
        // TODO: Add jumprunId support in signUp method
      }

      toast.success('User created', `${displayName} has been added to the system`)
      onSuccess()
    } catch (error) {
      console.error('Failed to create user:', error)
      // The signUp method already shows error toasts, so we don't need to show another one
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl border border-white/20 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-white/10 p-6 rounded-t-xl">
          <h2 className="text-2xl font-bold text-white">Create New User</h2>
          <p className="text-slate-400 text-sm mt-1">Add a new user account to the system</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
              required
              autoFocus
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Re-enter password"
              required
              minLength={6}
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              User Role *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ROLES.map(({ value, label, description }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    role === value
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-white/10 bg-slate-700 hover:border-blue-500/50'
                  }`}
                >
                  <div className="font-semibold text-white">{label}</div>
                  <div className="text-xs text-slate-400 mt-1">{description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Jumprun ID (optional) */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Jumprun ID <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={jumprunId}
              onChange={(e) => setJumprunId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="JR12345"
            />
            <p className="text-xs text-slate-400 mt-1">For fun jumpers who want to submit requests</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <span>➕</span>
                  <span>Create User</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
