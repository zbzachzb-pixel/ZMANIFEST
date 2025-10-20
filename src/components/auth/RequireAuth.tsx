// src/components/auth/RequireAuth.tsx
// Wrapper component that requires any authenticated user
'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { LoadingAuth } from './LoadingAuth'

interface RequireAuthProps {
  children: React.ReactNode
  redirectTo?: string
}

export function RequireAuth({ children, redirectTo = '/login' }: RequireAuthProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (!loading && !user && !hasRedirected.current) {
      hasRedirected.current = true
      toast.error('Authentication Required', 'Please sign in to continue')
      router.push(redirectTo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, redirectTo])

  // Show loading state while checking auth
  if (loading) {
    return <LoadingAuth />
  }

  // If not authenticated, don't render children (redirect will happen)
  if (!user) {
    return null
  }

  // User is authenticated, render children
  return <>{children}</>
}
