// src/components/AddInstructorModal.tsx - COMPLETE FIXED VERSION

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useCreateInstructor, useAircraft } from '@/hooks/useDatabase'
import { useToast } from '@/contexts/ToastContext'
import { validateName, validateWeightLimit } from '@/lib/validation'
import { db } from '@/services'
import type { Instructor, Team } from '@/types'

interface AddInstructorModalProps {
  instructor?: Instructor | null
  onClose: () => void
}

export function AddInstructorModal({ instructor, onClose }: AddInstructorModalProps) {
  const { create, loading: createLoading } = useCreateInstructor()
  const { data: aircraft } = useAircraft()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const isEdit = !!instructor

  // ✅ FIX #1: Allow null for team state
  const [name, setName] = useState(instructor?.name || '')
  const [bodyWeight, setBodyWeight] = useState(instructor?.bodyWeight || 180)
  const [team, setTeam] = useState<Team | null>(instructor?.team || null)

  // Aircraft qualifications (empty = qualified for all aircraft)
  const [selectedAircraftIds, setSelectedAircraftIds] = useState<string[]>(instructor?.aircraftIds || [])
  
  // ✅ FIX #2: Use correct property names (canTandem, canAFF, canVideo)
  const [canTandem, setCanTandem] = useState(instructor?.canTandem || false)
  const [canAFF, setCanAFF] = useState(instructor?.canAFF || false)
  const [canVideo, setCanVideo] = useState(instructor?.canVideo || false)
  
  const [tandemWeightLimit, setTandemWeightLimit] = useState(instructor?.tandemWeightLimit || 240)
  const [affWeightLimit, setAffWeightLimit] = useState(instructor?.affWeightLimit || 220)
  
  // Video restrictions
  const [videoRestricted, setVideoRestricted] = useState(
    (instructor?.videoMinWeight !== null && instructor?.videoMinWeight !== undefined) || 
    (instructor?.videoMaxWeight !== null && instructor?.videoMaxWeight !== undefined)
  )
  const [videoMinWeight, setVideoMinWeight] = useState(instructor?.videoMinWeight || 300)
  const [videoMaxWeight, setVideoMaxWeight] = useState(instructor?.videoMaxWeight || 450)

  // Focus management
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus trap: keep focus within modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return

        const focusableElements = modalRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )

        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate name
    const nameValidation = validateName(name, 'Instructor name')
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error!)
      return
    }

    // Validate team is selected
    if (!team) {
      toast.error('Please select a team')
      return
    }

    // Validate at least one department
    if (!canTandem && !canAFF && !canVideo) {
      toast.error('Please select at least one department')
      return
    }

    // Validate tandem weight limit
    if (canTandem) {
      const tandemValidation = validateWeightLimit(tandemWeightLimit, 'tandem')
      if (!tandemValidation.isValid) {
        toast.error(tandemValidation.error!)
        return
      }
    }

    // Validate AFF weight limit
    if (canAFF) {
      const affValidation = validateWeightLimit(affWeightLimit, 'aff')
      if (!affValidation.isValid) {
        toast.error(affValidation.error!)
        return
      }
    }
    
    // ✅ FIX #4: Use correct property names in the data object
    const instructorData = {
      name: name.trim(),
      bodyWeight,
      team, // Now guaranteed to be non-null
      canTandem,
      canAFF,
      canVideo,
      tandemWeightLimit: canTandem ? tandemWeightLimit : 0,
      affWeightLimit: canAFF ? affWeightLimit : 0,
      videoMinWeight: videoRestricted && videoMinWeight ? videoMinWeight : null,
      videoMaxWeight: videoRestricted && videoMaxWeight ? videoMaxWeight : null,
      aircraftIds: selectedAircraftIds.length > 0 ? selectedAircraftIds : undefined, // undefined = all aircraft
    }
    
    try {
      setLoading(true)
      
      if (isEdit && instructor) {
        await db.updateInstructor(instructor.id, instructorData)
      } else {
        await create(instructorData)
      }
      
      onClose()
    } catch (error) {
      console.error('Failed to save instructor:', error)
      toast.error('Failed to save instructor', 'Please try again')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-instructor-modal-title"
      >
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <h2 id="add-instructor-modal-title" className="text-2xl font-bold text-white">
            {isEdit ? '✏️ Edit Instructor' : '➕ Add New Instructor'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="John Doe"
              required
            />
          </div>
          
          {/* Body Weight */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Body Weight (lbs) *
            </label>
            <input
              type="number"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              min="100"
              max="300"
              required
            />
          </div>
          
          {/* Team Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Team *
            </label>
            <select
              value={team || ''}
              onChange={(e) => setTeam(e.target.value as Team)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Select a team...</option>
              <option value="red">🔴 Red Team</option>
              <option value="blue">🔵 Blue Team</option>
              <option value="gold">🟡 Gold Team</option>
            </select>
          </div>
          
          {/* Departments */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Departments *
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canTandem}
                  onChange={(e) => setCanTandem(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                />
                <span className="text-slate-300 font-medium">Tandem</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canAFF}
                  onChange={(e) => setCanAFF(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                />
                <span className="text-slate-300 font-medium">AFF</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canVideo}
                  onChange={(e) => setCanVideo(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                />
                <span className="text-slate-300 font-medium">Video</span>
              </label>
            </div>
          </div>
          
          {/* Tandem Weight Limit */}
          {canTandem && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Tandem Weight Limit (student max, lbs) *
              </label>
              <input
                type="number"
                value={tandemWeightLimit}
                onChange={(e) => setTandemWeightLimit(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="240"
                required
              />
            </div>
          )}
          
          {/* AFF Weight Limit */}
          {canAFF && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                AFF Weight Limit (student max, lbs) *
              </label>
              <input
                type="number"
                value={affWeightLimit}
                onChange={(e) => setAffWeightLimit(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="220"
                required
              />
            </div>
          )}
          
          {/* Video Restrictions */}
          {canVideo && (
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={videoRestricted}
                  onChange={(e) => setVideoRestricted(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                />
                <span className="text-slate-300 font-medium">Set video weight restrictions</span>
              </label>
              
              {videoRestricted && (
                <div className="grid grid-cols-2 gap-4 pl-8">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Min Weight (lbs)
                    </label>
                    <input
                      type="number"
                      value={videoMinWeight}
                      onChange={(e) => setVideoMinWeight(parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Max Weight (lbs)
                    </label>
                    <input
                      type="number"
                      value={videoMaxWeight}
                      onChange={(e) => setVideoMaxWeight(parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      placeholder="450"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aircraft Qualifications */}
          {aircraft.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Aircraft Qualifications
              </label>
              <p className="text-xs text-slate-400 mb-3">
                Select which aircraft this instructor is qualified to fly on. Leave all unchecked to qualify for all aircraft.
              </p>
              <div className="space-y-2">
                {aircraft
                  .filter(a => a.isActive)
                  .sort((a, b) => a.order - b.order)
                  .map(aircraftItem => (
                    <label
                      key={aircraftItem.id}
                      className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAircraftIds.includes(aircraftItem.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAircraftIds([...selectedAircraftIds, aircraftItem.id])
                          } else {
                            setSelectedAircraftIds(selectedAircraftIds.filter(id => id !== aircraftItem.id))
                          }
                        }}
                        className="w-5 h-5 rounded bg-slate-600 border-slate-500 text-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-white">{aircraftItem.tailNumber}</div>
                        <div className="text-xs text-slate-400">{aircraftItem.name} • {aircraftItem.capacity} pax</div>
                      </div>
                    </label>
                  ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || createLoading}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || createLoading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || createLoading ? '⏳ Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}