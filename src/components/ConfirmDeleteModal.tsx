// src/components/ConfirmDeleteModal.tsx
import React from 'react'

interface ConfirmDeleteModalProps {
  count: number
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteModal({ count, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-red-500/30 max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">🗑️</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Remove Students from Queue?</h3>
            <p className="text-slate-300">
              Are you sure you want to remove <span className="font-bold text-red-400">{count}</span> student{count !== 1 ? 's' : ''} from the queue? 
              This action cannot be undone.
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
          >
            Yes, Remove
          </button>
        </div>
      </div>
    </div>
  )
}