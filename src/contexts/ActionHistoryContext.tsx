// src/contexts/ActionHistoryContext.tsx
// Action history system for undo/redo functionality
'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useToast } from './ToastContext'

export interface Action {
  id: string
  type: string
  description: string
  timestamp: Date
  undo: () => Promise<void>
  redo: () => Promise<void>
  data?: any // Store action-specific data for UI display
}

interface ActionHistoryContextType {
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<void>
  redo: () => Promise<void>
  addAction: (action: Omit<Action, 'id' | 'timestamp'>) => void
  clearHistory: () => void
  history: Action[]
  currentIndex: number
}

const ActionHistoryContext = createContext<ActionHistoryContextType | null>(null)

export function ActionHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<Action[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isProcessing, setIsProcessing] = useState(false)
  const toast = useToast()
  const currentIndexRef = useRef(currentIndex)

  // Keep ref in sync with state
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  const canUndo = currentIndex >= 0
  const canRedo = currentIndex < history.length - 1

  const addAction = useCallback((action: Omit<Action, 'id' | 'timestamp'>) => {
    const newAction: Action = {
      ...action,
      id: `action_${Date.now()}_${Math.random()}`,
      timestamp: new Date()
    }

    // Use ref to avoid recreating callback
    const current = currentIndexRef.current

    setHistory(prev => {
      // Remove any actions after current index (we're creating a new branch)
      const newHistory = prev.slice(0, current + 1)

      // Keep only last 50 actions to prevent memory issues
      return [...newHistory, newAction].slice(-50)
    })

    setCurrentIndex(Math.min(current + 1, 49))
  }, [])

  const undo = useCallback(async () => {
    if (!canUndo || isProcessing) return

    setIsProcessing(true)
    try {
      const action = history[currentIndex]
      if (!action) {
        throw new Error('Action not found')
      }
      await action.undo()
      setCurrentIndex(prev => prev - 1)
      toast.success('Undone', action.description)
    } catch (error) {
      console.error('Failed to undo action:', error)
      toast.error('Undo failed', String(error))
    } finally {
      setIsProcessing(false)
    }
  }, [canUndo, isProcessing, history, currentIndex, toast])

  const redo = useCallback(async () => {
    if (!canRedo || isProcessing) return

    setIsProcessing(true)
    try {
      const action = history[currentIndex + 1]
      if (!action) {
        throw new Error('Action not found')
      }
      await action.redo()
      setCurrentIndex(prev => prev + 1)
      toast.success('Redone', action.description)
    } catch (error) {
      console.error('Failed to redo action:', error)
      toast.error('Redo failed', String(error))
    } finally {
      setIsProcessing(false)
    }
  }, [canRedo, isProcessing, history, currentIndex, toast])

  const clearHistory = useCallback(() => {
    setHistory([])
    setCurrentIndex(-1)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? e.metaKey : e.ctrlKey

      // Ctrl+Z or Cmd+Z = Undo
      if (modifier && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Ctrl+Shift+Z or Cmd+Shift+Z = Redo
      // Also support Ctrl+Y on Windows
      if ((modifier && e.shiftKey && e.key === 'Z') || (modifier && e.key === 'y' && !isMac)) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return (
    <ActionHistoryContext.Provider
      value={{
        canUndo,
        canRedo,
        undo,
        redo,
        addAction,
        clearHistory,
        history,
        currentIndex
      }}
    >
      {children}
    </ActionHistoryContext.Provider>
  )
}

export function useActionHistory() {
  const context = useContext(ActionHistoryContext)
  if (!context) {
    // Return default values when used outside provider (e.g., during SSR/build)
    // This prevents build errors while maintaining type safety
    return {
      canUndo: false,
      canRedo: false,
      undo: async () => {},
      redo: async () => {},
      addAction: () => {},
      clearHistory: () => {},
      history: [],
      currentIndex: -1
    }
  }
  return context
}
