// src/components/EditUserModal.tsx
// Modal for admins to edit existing user profiles

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { db } from '@/services'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { UserProfile, UserRole } from '@/types/funJumpers'

interface EditUserModalProps {
  user: UserProfile
  onClose: () => void
  onSuccess: () => void
}

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'fun_jumper', label: 'Fun Jumper', description: 'Can submit jump requests' },
  { value: 'instructor', label: 'Instructor', description: 'Can view loads and assignments' },
  { value: 'manifest', label: 'Manifest', description: 'Can manage loads and approve requests' },
  { value: 'admin', label: 'Admin', description: 'Full system access' }
]

export function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const [displayName, setDisplayName] = useState(user.displayName)
  const [uspaNumber, setUspaNumber] = useState(user.uspaNumber || '')
  const [role, setRole] = useState<UserRole>(user.role)
  const [jumprunId, setJumprunId] = useState(user.jumprunId || '')
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '')
  const [isActive, setIsActive] = useState(user.isActive)

  const modalRef = useRef<HTMLDivElement>(null)

  const isEditingSelf = currentUser?.uid === user.uid

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
    if (!displayName || displayName.trim().length < 2) {
      toast.error('Invalid name', 'Display name must be at least 2 characters')
      return
    }

    if (!role) {
      toast.error('Role required', 'Please select a user role')
      return
    }

    // Prevent editing own role
    if (isEditingSelf && role !== user.role) {
      toast.error('Cannot change own role', 'You cannot change your own role')
      return
    }

    setLoading(true)

    try {
      const updates: Partial<UserProfile> = {
        displayName: displayName.trim(),
        role,
        isActive
      }

      // Add optional fields if provided
      if (uspaNumber.trim()) {
        updates.uspaNumber = uspaNumber.trim()
      }
      if (jumprunId.trim()) {
        updates.jumprunId = jumprunId.trim()
      }
      if (phoneNumber.trim()) {
        updates.phoneNumber = phoneNumber.trim()
      }

      await db.updateUserProfile(user.uid, updates)

      toast.success('User updated', `${displayName}'s profile has been updated`)
      onSuccess()
    } catch (error) {
      console.error('Failed to update user:', error)
      toast.error('Update failed', error instanceof Error ? error.message : 'Failed to update user')
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
          <h2 className="text-2xl font-bold text-white">Edit User Profile</h2>
          <p className="text-slate-400 text-sm mt-1">Update user information and permissions</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
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
              autoFocus
            />
          </div>

          {/* USPA Number */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              USPA Number <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={uspaNumber}
              onChange={(e) => setUspaNumber(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="A-12345"
            />
            <p className="text-xs text-slate-400 mt-1">United States Parachute Association member number</p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              User Role *
            </label>
            {isEditingSelf && (
              <p className="text-xs text-yellow-400 mb-2">⚠️ You cannot change your own role</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ROLES.map(({ value, label, description }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => !isEditingSelf && setRole(value)}
                  disabled={isEditingSelf}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    role === value
                      ? 'border-blue-500 bg-blue-500/20'
                      : isEditingSelf
                      ? 'border-white/5 bg-slate-800 cursor-not-allowed opacity-50'
                      : 'border-white/10 bg-slate-700 hover:border-blue-500/50'
                  }`}
                >
                  <div className="font-semibold text-white">{label}</div>
                  <div className="text-xs text-slate-400 mt-1">{description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Jumprun ID */}
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
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
            <div>
              <div className="font-semibold text-white">Account Status</div>
              <div className="text-xs text-slate-400 mt-1">
                Inactive users cannot sign in
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              disabled={isEditingSelf}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isEditingSelf
                  ? 'bg-slate-600 cursor-not-allowed opacity-50'
                  : isActive
                  ? 'bg-green-500'
                  : 'bg-red-500'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {isEditingSelf && (
            <p className="text-xs text-yellow-400 -mt-4">⚠️ You cannot deactivate your own account</p>
          )}

          {/* User Info */}
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">User ID:</span>
              <span className="text-slate-300 font-mono">{user.uid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Created:</span>
              <span className="text-slate-300">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
            {user.lastLogin && (
              <div className="flex justify-between">
                <span className="text-slate-400">Last Login:</span>
                <span className="text-slate-300">
                  {new Date(user.lastLogin).toLocaleString()}
                </span>
              </div>
            )}
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
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
