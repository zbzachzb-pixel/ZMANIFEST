// src/app/page.tsx - Home page with role-based redirects
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { RequireAuth } from '@/components/auth'

function HomePageContent() {
  const router = useRouter()
  const { userProfile, loading } = useAuth()

  useEffect(() => {
    // Wait for auth to load
    if (loading || !userProfile) return

    // Role-based redirects
    switch (userProfile.role) {
      case 'admin':
        router.replace('/dashboard') // Instructor rotation dashboard
        break
      case 'manifest':
        router.replace('/loads') // Load builder workspace
        break
      case 'instructor':
        router.replace('/loads') // Load builder workspace
        break
      case 'fun_jumper':
        router.replace('/submit-request') // Submit jump request
        break
      default:
        router.replace('/dashboard') // Fallback
    }
  }, [router, userProfile, loading])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
        <p className="text-white text-lg font-semibold">Loading...</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <RequireAuth>
      <HomePageContent />
    </RequireAuth>
  )
}