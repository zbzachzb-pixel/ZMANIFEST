// src/components/auth/RequireRole.tsx
// Wrapper component that requires specific role(s)
'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { LoadingAuth } from './LoadingAuth'
import type { UserRole } from '@/types'

interface RequireRoleProps {
  children: React.ReactNode
  roles: UserRole | UserRole[]
  redirectTo?: string
  fallback?: React.ReactNode
}

export function RequireRole({
  children,
  roles,
  redirectTo = '/',
  fallback
}: RequireRoleProps) {
  const { user, userProfile, loading, hasRole } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const hasRedirected = useRef(false)

  const allowedRoles = useMemo(() =>
    Array.isArray(roles) ? roles : [roles],
    [roles]
  )
  const isAuthorized = hasRole(roles)

  useEffect(() => {
    // Wait for auth to load
    if (loading) return

    // Prevent multiple redirects
    if (hasRedirected.current) return

    // Check if user is logged in
    if (!user) {
      hasRedirected.current = true
      toast.error('Authentication Required', 'Please sign in to continue')
      router.push('/login')
      return
    }

    // Check if user has required role
    if (userProfile && !isAuthorized) {
      hasRedirected.current = true
      toast.error(
        'Unauthorized',
        `This page requires ${allowedRoles.join(' or ')} role`
      )
      router.push(redirectTo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile, loading, isAuthorized, redirectTo, allowedRoles])

  // Show loading state while checking auth
  if (loading) {
    return <LoadingAuth />
  }

  // If not authenticated, don't render children (redirect will happen)
  if (!user || !userProfile) {
    return null
  }

  // If not authorized, show fallback or redirect
  if (!isAuthorized) {
    return fallback ? <>{fallback}</> : null
  }

  // User is authorized, render children
  return <>{children}</>
}
