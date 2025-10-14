// src/components/EditClockEventModal.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useUpdateClockEvent } from '@/hooks/useDatabase'
import type { ClockEvent } from '@/types'

interface EditClockEventModalProps {
  event: ClockEvent
  onClose: () => void
}

export function EditClockEventModal({ event, onClose }: EditClockEventModalProps) {
  const { updateClockEvent, loading } = useUpdateClockEvent()
  
  // Parse the ISO timestamp to get date and time separately
  const eventDate = new Date(event.timestamp)
  
  const [date, setDate] = useState(eventDate.toISOString().split('T')[0]) // YYYY-MM-DD
  const [time, setTime] = useState(
    eventDate.toTimeString().slice(0, 5) // HH:MM
  )
  const [notes, setNotes] = useState(event.notes || '')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Combine date and time into ISO timestamp
      const newTimestamp = new Date(`${date}T${time}`).toISOString()
      
      await updateClockEvent(event.id, {
        timestamp: newTimestamp,
        notes: notes.trim() || undefined
      })
      
      onClose()
    } catch (error) {
      console.error('Failed to update clock event:', error)
      alert('Failed to update clock event. Please try again.')
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-white/20">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">
            ✏️ Edit Clock Event
          </h2>
          <p className="text-slate-400 mt-1">
            {event.instructorName} - {event.type === 'in' ? 'Clock In' : 'Clock Out'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          
          {/* Time */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Time *
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
              rows={3}
              placeholder="Add any notes about this clock event..."
            />
          </div>
          
          {/* Original Timestamp Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-300">
              <strong>Original:</strong> {eventDate.toLocaleString()}
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Saving...' : '✓ Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}