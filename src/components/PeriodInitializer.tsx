'use client'

import React, { useEffect, useState } from 'react'
import { useActivePeriod, useCreatePeriod } from '@/hooks/useDatabase'

export function PeriodInitializer({ children }: { children: React.ReactNode }) {
  const { data: activePeriod, loading } = useActivePeriod()
  const { create, loading: creating } = useCreatePeriod()
  const [initialized, setInitialized] = useState(false)
  
  useEffect(() => {
    const initializePeriod = async () => {
      if (loading || initialized) return
      
      if (!activePeriod) {
        console.log('No active period found, creating initial period...')
        try {
          const now = new Date()
          const twoWeeksLater = new Date(now)
          twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)
          
          await create({
            name: `Period 1 - ${now.toLocaleDateString()}`,
            start: now,
            end: twoWeeksLater
          })
          
          console.log('Initial period created successfully')
        } catch (error) {
          console.error('Failed to create initial period:', error)
        }
      }
      setInitialized(true)
    }
    
    initializePeriod()
  }, [activePeriod, loading, initialized, create])
  
  if (loading || creating || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">
            {creating ? 'Initializing period system...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }
  
  return <>{children}</>
}