// src/app/page.tsx - Home page redirects to dashboard
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/components/auth'

function HomePageContent() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
        <p className="text-white text-lg font-semibold">Redirecting to dashboard...</p>
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