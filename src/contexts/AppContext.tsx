// src/contexts/AppContext.tsx
// Provides global access to instructors, settings, and periods
// This eliminates prop drilling throughout the component tree
'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { 
  useActiveInstructors, 
  useSettings, 
  useActivePeriod 
} from '@/hooks/useDatabase'
import type { Instructor, AppSettings, Period } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

interface AppContextType {
  // Instructors
  instructors: Instructor[]
  instructorsLoading: boolean
  refreshInstructors: () => void
  
  // Settings
  settings: AppSettings
  settingsLoading: boolean
  refreshSettings: () => void
  
  // Period
  period: Period | null
  periodLoading: boolean
  refreshPeriod: () => void
  
  // Combined loading state
  isLoading: boolean
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const { 
    data: instructors, 
    loading: instructorsLoading, 
    refresh: refreshInstructors 
  } = useActiveInstructors()
  
  const { 
    data: settings, 
    loading: settingsLoading, 
    refresh: refreshSettings 
  } = useSettings()
  
  const { 
    data: period, 
    loading: periodLoading, 
    refresh: refreshPeriod 
  } = useActivePeriod()
  
  const isLoading = instructorsLoading || settingsLoading || periodLoading
  
  return (
    <AppContext.Provider
      value={{
        instructors,
        instructorsLoading,
        refreshInstructors,
        settings: settings || DEFAULT_SETTINGS,
        settingsLoading,
        refreshSettings,
        period,
        periodLoading,
        refreshPeriod,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

// Convenience hooks for specific parts of the context
export function useAppInstructors() {
  const { instructors, instructorsLoading, refreshInstructors } = useApp()
  return { instructors, loading: instructorsLoading, refresh: refreshInstructors }
}

export function useAppSettings() {
  const { settings, settingsLoading, refreshSettings } = useApp()
  return { settings, loading: settingsLoading, refresh: refreshSettings }
}

export function useAppPeriod() {
  const { period, periodLoading, refreshPeriod } = useApp()
  return { period, loading: periodLoading, refresh: refreshPeriod }
}