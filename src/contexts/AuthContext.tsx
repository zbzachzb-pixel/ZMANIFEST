// src/contexts/AuthContext.tsx
// Authentication context for Firebase Auth with role-based access
'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { ref, get, set, update } from 'firebase/database'
import { auth, database } from '@/lib/firebase'
import { useToast } from './ToastContext'
import type { UserProfile, UserRole } from '@/types'

// ==================== CONTEXT TYPE ====================

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string, role?: UserRole, uspaNumber?: string, nickname?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>
  hasRole: (roles: UserRole | UserRole[]) => boolean
  isAdmin: boolean
  isManifest: boolean
  isInstructor: boolean
  isFunJumper: boolean
}

// ==================== CONTEXT ====================

const AuthContext = createContext<AuthContextType | null>(null)

// ==================== PROVIDER ====================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  /**
   * Fetch user profile from database
   */
  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    try {
      const userRef = ref(database, `users/${uid}`)
      const snapshot = await get(userRef)

      if (snapshot.exists()) {
        return snapshot.val() as UserProfile
      }
      return null
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      return null
    }
  }, [])

  /**
   * Create user profile in database
   */
  const createUserProfile = useCallback(async (
    uid: string,
    email: string,
    displayName: string,
    role: UserRole = 'fun_jumper',
    uspaNumber?: string,
    nickname?: string
  ): Promise<void> => {
    try {
      const userRef = ref(database, `users/${uid}`)
      const newProfile: UserProfile = {
        uid,
        email,
        displayName,
        nickname,
        role,
        uspaNumber,
        notificationsEnabled: true,
        smsNotificationsEnabled: false,
        emailNotificationsEnabled: true,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        isActive: true
      }

      await set(userRef, newProfile)
    } catch (error) {
      console.error('Failed to create user profile:', error)
      throw error
    }
  }, [])

  /**
   * Update last login timestamp
   */
  const updateLastLogin = useCallback(async (uid: string): Promise<void> => {
    try {
      const userRef = ref(database, `users/${uid}`)
      await update(userRef, { lastLogin: Date.now() })
    } catch (error) {
      console.error('Failed to update last login:', error)
    }
  }, [])

  /**
   * Sign up new user
   */
  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    role: UserRole = 'fun_jumper',
    uspaNumber?: string,
    nickname?: string
  ): Promise<void> => {
    try {
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)

      // Update display name
      await updateProfile(userCredential.user, { displayName })

      // Create user profile in database
      await createUserProfile(userCredential.user.uid, email, displayName, role, uspaNumber, nickname)

      toast.success('Account created', 'Welcome!')
    } catch (error: any) {
      console.error('Sign up error:', error)

      // User-friendly error messages
      let message = 'Failed to create account'
      if (error.code === 'auth/email-already-in-use') {
        message = 'Email already in use'
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters'
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address'
      }

      toast.error('Sign Up Failed', message)
      throw error
    }
  }, [createUserProfile, toast])

  /**
   * Sign in existing user
   */
  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast.success('Signed in', 'Welcome back!')
    } catch (error: any) {
      console.error('Sign in error:', error)

      let message = 'Failed to sign in'
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Invalid email or password'
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address'
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Try again later.'
      }

      toast.error('Sign In Failed', message)
      throw error
    }
  }, [toast])

  /**
   * Sign out current user
   */
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await firebaseSignOut(auth)
      setUser(null)
      setUserProfile(null)
      toast.success('Signed out', 'See you next time!')
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Sign Out Failed', 'Please try again')
      throw error
    }
  }, [toast])

  /**
   * Send password reset email
   */
  const resetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email)
      toast.success('Email sent', 'Check your inbox for reset instructions')
    } catch (error: any) {
      console.error('Reset password error:', error)

      let message = 'Failed to send reset email'
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email'
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address'
      }

      toast.error('Reset Failed', message)
      throw error
    }
  }, [toast])

  /**
   * Update user profile in database
   */
  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>): Promise<void> => {
    if (!user) {
      throw new Error('No user logged in')
    }

    try {
      const userRef = ref(database, `users/${user.uid}`)
      await update(userRef, updates)

      // Update local state
      setUserProfile(prev => prev ? { ...prev, ...updates } : null)

      toast.success('Profile updated', 'Your changes have been saved')
    } catch (error) {
      console.error('Update profile error:', error)
      toast.error('Update Failed', 'Failed to update profile')
      throw error
    }
  }, [user, toast])

  /**
   * Check if user has specific role(s)
   */
  const hasRole = useCallback((roles: UserRole | UserRole[]): boolean => {
    if (!userProfile) return false

    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(userProfile.role)
  }, [userProfile])

  // Computed role checks
  const isAdmin = hasRole('admin')
  const isManifest = hasRole(['admin', 'manifest'])
  const isInstructor = hasRole(['admin', 'manifest', 'instructor'])
  const isFunJumper = hasRole('fun_jumper')

  /**
   * Listen to auth state changes
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)

      if (firebaseUser) {
        setUser(firebaseUser)

        // Fetch user profile
        const profile = await fetchUserProfile(firebaseUser.uid)

        if (profile) {
          setUserProfile(profile)
          // Update last login
          await updateLastLogin(firebaseUser.uid)
        } else {
          // Profile doesn't exist - this shouldn't happen in normal flow
          // but handle it gracefully
          console.warn('User authenticated but no profile found:', firebaseUser.uid)
          setUserProfile(null)
        }
      } else {
        setUser(null)
        setUserProfile(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [fetchUserProfile, updateLastLogin])

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateUserProfile,
    hasRole,
    isAdmin,
    isManifest,
    isInstructor,
    isFunJumper
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ==================== HOOK ====================

/**
 * Use authentication context
 *
 * @example
 * const { user, signIn, signOut, hasRole } = useAuth()
 *
 * if (hasRole('admin')) {
 *   // Admin-only functionality
 * }
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

/**
 * Optional hook that returns null if outside provider
 * Useful for components that may or may not have auth
 */
export function useOptionalAuth(): AuthContextType | null {
  return useContext(AuthContext)
}
