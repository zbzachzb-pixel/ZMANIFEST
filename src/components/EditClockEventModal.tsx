// src/components/EditClockEventModal.tsx - NEW FILE
// ✅ Issue #16 Fixed: Created missing component

'use client'

import React, { useState } from 'react'
import { db } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type { ClockEvent } from '@/types'

interface EditClockEventModalProps {
  event: ClockEvent
  onClose: () => void
  onSuccess: () => void
}

export function EditClockEventModal({ event, onClose, onSuccess }: EditClockEventModalProps) {
  const toast = useToast()
  const [timestamp, setTimestamp] = useState(() => {
    const date = new Date(event.timestamp)
    return date.toISOString().slice(0, 16)
  })
  const [notes, setNotes] = useState(event.notes || '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await db.updateClockEvent(event.id, {
        timestamp: new Date(timestamp).toISOString(),
        notes: notes.trim()
      })
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to update clock event:', error)
      toast.error('Failed to update', 'Please try again.')
    } finally{
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" 
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-blue-500" 
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">
          Edit Clock {event.type === 'in' ? 'In' : 'Out'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Timestamp
            </label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this clock event..."
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}