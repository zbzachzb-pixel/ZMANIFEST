// src/components/ConfirmDeleteModal.tsx
// Add isOpen to the interface

'use client'

import React from 'react'

interface ConfirmDeleteModalProps {
  isOpen: boolean  // ✅ Add this
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDeleteModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  loading = false
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onCancel}>
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-red-500" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
          <p className="text-slate-300 mb-6">{message}</p>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Removing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}