'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  description?: string
}

interface ToastContextType {
  toasts: Toast[]
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
  info: (message: string, description?: string) => void
  warning: (message: string, description?: string) => void
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string
      error: string
    }
  ) => Promise<T>
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string, description?: string) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, type, message, description }])

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)

    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((message: string, description?: string) => {
    return addToast('success', message, description)
  }, [addToast])

  const error = useCallback((message: string, description?: string) => {
    return addToast('error', message, description)
  }, [addToast])

  const info = useCallback((message: string, description?: string) => {
    return addToast('info', message, description)
  }, [addToast])

  const warning = useCallback((message: string, description?: string) => {
    return addToast('warning', message, description)
  }, [addToast])

  const promiseToast = useCallback(async <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string
      error: string
    }
  ): Promise<T> => {
    const loadingId = addToast('info', messages.loading)

    try {
      const result = await promise
      dismiss(loadingId)
      addToast('success', messages.success)
      return result
    } catch (err) {
      dismiss(loadingId)
      addToast('error', messages.error)
      throw err
    }
  }, [addToast, dismiss])

  return (
    <ToastContext.Provider
      value={{
        toasts,
        success,
        error,
        info,
        warning,
        promise: promiseToast,
        dismiss
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

// Toast Container Component
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            animate-slide-in-right
            rounded-lg shadow-lg p-4 border-l-4
            ${toast.type === 'success' ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500' : ''}
            ${toast.type === 'error' ? 'bg-red-50 border-red-500 dark:bg-red-900/20 dark:border-red-500' : ''}
            ${toast.type === 'warning' ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-900/20 dark:border-yellow-500' : ''}
            ${toast.type === 'info' ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500' : ''}
          `}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className={`font-semibold ${
                toast.type === 'success' ? 'text-green-900 dark:text-green-100' :
                toast.type === 'error' ? 'text-red-900 dark:text-red-100' :
                toast.type === 'warning' ? 'text-yellow-900 dark:text-yellow-100' :
                'text-blue-900 dark:text-blue-100'
              }`}>
                {toast.message}
              </div>
              {toast.description && (
                <div className={`text-sm mt-1 ${
                  toast.type === 'success' ? 'text-green-700 dark:text-green-200' :
                  toast.type === 'error' ? 'text-red-700 dark:text-red-200' :
                  toast.type === 'warning' ? 'text-yellow-700 dark:text-yellow-200' :
                  'text-blue-700 dark:text-blue-200'
                }`}>
                  {toast.description}
                </div>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className={`text-sm font-bold hover:opacity-70 ${
                toast.type === 'success' ? 'text-green-900 dark:text-green-100' :
                toast.type === 'error' ? 'text-red-900 dark:text-red-100' :
                toast.type === 'warning' ? 'text-yellow-900 dark:text-yellow-100' :
                'text-blue-900 dark:text-blue-100'
              }`}
            >
              
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
