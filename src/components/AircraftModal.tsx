// src/components/AircraftModal.tsx
// Modal for creating and editing aircraft

'use client'

import React, { useState, useEffect } from 'react'
import type { Aircraft, CreateAircraft } from '@/types'

interface AircraftModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (aircraft: CreateAircraft | Aircraft) => Promise<void>
  aircraft?: Aircraft | null  // If editing, pass existing aircraft
  existingAircraft: Aircraft[] // For validation
}

export function AircraftModal({ isOpen, onClose, onSave, aircraft, existingAircraft }: AircraftModalProps) {
  const [name, setName] = useState('')
  const [tailNumber, setTailNumber] = useState('')
  const [capacity, setCapacity] = useState(18)
  const [order, setOrder] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!aircraft

  useEffect(() => {
    if (aircraft) {
      setName(aircraft.name)
      setTailNumber(aircraft.tailNumber)
      setCapacity(aircraft.capacity)
      setOrder(aircraft.order)
    } else {
      // When creating new, set order to be last
      const maxOrder = Math.max(...existingAircraft.map(a => a.order), -1)
      setOrder(maxOrder + 1)
    }
  }, [aircraft, existingAircraft])

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setError('Aircraft name is required')
      return false
    }

    if (!tailNumber.trim()) {
      setError('Tail number is required')
      return false
    }

    if (capacity < 1 || capacity > 50) {
      setError('Capacity must be between 1 and 50')
      return false
    }

    // Check for duplicate tail number
    const duplicate = existingAircraft.find(
      a => a.tailNumber.toUpperCase() === tailNumber.toUpperCase() &&
           (!aircraft || a.id !== aircraft.id) &&
           a.isActive
    )

    if (duplicate) {
      setError(`Aircraft with tail number ${tailNumber} already exists`)
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      if (isEditing) {
        // Update existing
        await onSave({
          ...aircraft,
          name: name.trim(),
          tailNumber: tailNumber.trim().toUpperCase(),
          capacity,
          order
        })
      } else {
        // Create new
        await onSave({
          name: name.trim(),
          tailNumber: tailNumber.trim().toUpperCase(),
          capacity,
          isActive: true,
          order
        })
      }
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save aircraft')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setTailNumber('')
    setCapacity(18)
    setOrder(0)
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl max-w-lg w-full border border-white/20">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-4">
            {isEditing ? '✈️ Edit Aircraft' : '➕ Add New Aircraft'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Aircraft Name */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Aircraft Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Caravan, King Air, Twin Otter"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                disabled={loading}
                autoFocus
              />
            </div>

            {/* Tail Number */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Tail Number *
              </label>
              <input
                type="text"
                value={tailNumber}
                onChange={(e) => setTailNumber(e.target.value.toUpperCase())}
                placeholder="e.g., N123AB"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 uppercase"
                disabled={loading}
              />
              <p className="text-xs text-slate-400 mt-1">
                Aircraft registration number
              </p>
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Passenger Capacity *
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                min="1"
                max="50"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
              />
              <p className="text-xs text-slate-400 mt-1">
                Default number of passengers (can be overridden per load)
              </p>
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Display Order
              </label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                min="0"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
              />
              <p className="text-xs text-slate-400 mt-1">
                Lower numbers appear first in lists
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-300 text-sm">⚠️ {error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Aircraft'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
