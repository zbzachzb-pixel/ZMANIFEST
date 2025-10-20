// src/components/LoadModals.tsx
// Extracted from LoadBuilderCard.tsx - Modal components for load operations

'use client'

import React from 'react'
import type { Load } from '@/types'

// Status Change Confirmation Modal
interface StatusChangeConfirmModalProps {
  show: boolean
  newStatus: Load['status'] | null
  statusLabel: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function StatusChangeConfirmModal({
  show,
  newStatus,
  statusLabel,
  loading,
  onConfirm,
  onCancel
}: StatusChangeConfirmModalProps) {
  if (!show || !newStatus) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-change-title"
    >
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700">
        <h3 id="status-change-title" className="text-xl font-bold text-white mb-4">Confirm Status Change</h3>
        <p className="text-slate-300 mb-6">
          Change load status to <strong>{statusLabel}</strong>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            aria-label="Cancel status change"
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            aria-label={`Confirm status change to ${statusLabel}`}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// Delay/Change Call Modal
interface DelayModalProps {
  show: boolean
  delayMinutes: number
  loading: boolean
  onDelayChange: (minutes: number) => void
  onApply: () => void
  onCancel: () => void
}

export function DelayModal({
  show,
  delayMinutes,
  loading,
  onDelayChange,
  onApply,
  onCancel
}: DelayModalProps) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delay-modal-title"
    >
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700">
        <h3 id="delay-modal-title" className="text-xl font-bold text-white mb-4">⏱️ Change Call Time</h3>
        <p className="text-slate-300 mb-2">Adjust the departure call for this load and all subsequent loads.</p>
        <p className="text-sm text-slate-400 mb-4">
          • <span className="text-green-400">Positive</span> values delay departure (add time)<br />
          • <span className="text-orange-400">Negative</span> values move it up (remove time)
        </p>

        {/* Quick Preset Buttons */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => onDelayChange(-5)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
          >
            -5 min
          </button>
          <button
            onClick={() => onDelayChange(-2)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
          >
            -2 min
          </button>
          <button
            onClick={() => onDelayChange(2)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
          >
            +2 min
          </button>
          <button
            onClick={() => onDelayChange(5)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
          >
            +5 min
          </button>
        </div>

        <input
          type="number"
          value={delayMinutes || ''}
          onChange={(e) => onDelayChange(parseInt(e.target.value) || 0)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white mb-6"
          placeholder="e.g., 5 or -5"
          aria-label="Delay minutes (positive to delay, negative to move up)"
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            aria-label="Cancel time change"
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={loading}
            aria-label="Apply time change"
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            Apply Change
          </button>
        </div>
      </div>
    </div>
  )
}

// Delete Confirmation Modal
interface DeleteConfirmModalProps {
  show: boolean
  isCompleted: boolean
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({
  show,
  isCompleted,
  loading,
  onConfirm,
  onCancel
}: DeleteConfirmModalProps) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700">
        <h3 id="delete-modal-title" className="text-xl font-bold text-red-400 mb-4">⚠️ Delete Load</h3>
        <p className="text-slate-300 mb-6">
          {isCompleted
            ? '⚠️ This is a COMPLETED load. Are you absolutely sure you want to delete it?'
            : 'Are you sure you want to delete this load? All students will be returned to the queue.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            aria-label="Cancel delete load"
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            aria-label={isCompleted ? "Delete completed load (warning: affects stats)" : "Delete load and return students to queue"}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            Delete Load
          </button>
        </div>
      </div>
    </div>
  )
}
