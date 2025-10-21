// src/contexts/LoadBuilderContext.tsx
// ✅ PERFORMANCE: Context to reduce prop drilling in LoadBuilderCard
// Consolidates 11 props into a single context provider

'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import type { Load, Instructor, LoadSchedulingSettings } from '@/types'

interface LoadBuilderContextType {
  // Shared data
  allLoads: Load[]
  instructors: Instructor[]
  instructorBalances: Map<string, number>
  loadSchedulingSettings: LoadSchedulingSettings

  // Drag and drop state
  dropTarget: string | null
  setDropTarget: (target: string | null) => void

  // Event handlers
  onDrop: (loadId: string) => void
  onDragStart: (type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string) => void
  onDragEnd: () => void
  onDelay: (loadId: string, minutes: number) => void
}

const LoadBuilderContext = createContext<LoadBuilderContextType | null>(null)

interface LoadBuilderProviderProps {
  children: ReactNode
  value: LoadBuilderContextType
}

export function LoadBuilderProvider({ children, value }: LoadBuilderProviderProps) {
  return (
    <LoadBuilderContext.Provider value={value}>
      {children}
    </LoadBuilderContext.Provider>
  )
}

export function useLoadBuilder() {
  const context = useContext(LoadBuilderContext)
  if (!context) {
    throw new Error('useLoadBuilder must be used within LoadBuilderProvider')
  }
  return context
}
