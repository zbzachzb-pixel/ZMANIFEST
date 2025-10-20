// src/components/auth/LoadingAuth.tsx
// Loading component shown during authentication checks
'use client'

import React from 'react'

export function LoadingAuth() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-solid border-blue-500 border-t-transparent mb-4"></div>
        <p className="text-white text-lg font-semibold">Checking authorization...</p>
        <p className="text-white/60 text-sm mt-2">Please wait</p>
      </div>
    </div>
  )
}
