'use client'

import React, { useState, useEffect } from 'react'
import { useActiveInstructors } from '@/hooks/useDatabase'
import { db } from '@/services'
import type { Assignment, Instructor, JumpType, AFFLevel } from '@/types'

interface EditAssignmentModalProps {
  assignment: Assignment
  onClose: () => void
  onSuccess: () => void
}

export function EditAssignmentModal({ assignment, onClose, onSuccess }: EditAssignmentModalProps) {
  const { data: instructors } = useActiveInstructors()
  
  // Form state
  const [studentName, setStudentName] = useState(assignment.name)
  const [studentWeight, setStudentWeight] = useState(assignment.weight)
  const [jumpType, setJumpType] = useState<JumpType>(assignment.jumpType)
  const [instructorId, setInstructorId] = useState(assignment.instructorId)
  const [videoInstructorId, setVideoInstructorId] = useState(assignment.videoInstructorId || '')
  const [hasOutsideVideo, setHasOutsideVideo] = useState(assignment.hasOutsideVideo || false)
  const [isRequest, setIsRequest] = useState(assignment.isRequest)
  const [isMissedJump, setIsMissedJump] = useState(assignment.isMissedJump || false)
  const [coveringFor, setCoveringFor] = useState(assignment.coveringFor || '')
  
  // Tandem specific
  const [tandemWeightTax, setTandemWeightTax] = useState(assignment.tandemWeightTax || 0)
  const [tandemHandcam, setTandemHandcam] = useState(assignment.tandemHandcam || false)
  
  // AFF specific
  const [affLevel, setAffLevel] = useState<AFFLevel>(assignment.affLevel || 'lower')
  
  // Timestamp editing
  const [timestamp, setTimestamp] = useState(() => {
    const date = new Date(assignment.timestamp)
    return date.toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:MM
  })
  
  const [loading, setLoading] = useState(false)
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null)
  
  // Calculate pay changes
  useEffect(() => {
    const calculatePay = (a: Partial<Assignment>) => {
      if (a.isMissedJump) return 0
      
      let pay = 0
      if (a.jumpType === 'tandem') {
        pay = 40 + (a.tandemWeightTax || 0) * 20
        if (a.tandemHandcam) pay += 30
      } else if (a.jumpType === 'aff') {
        pay = a.affLevel === 'lower' ? 55 : 45
      } else if (a.jumpType === 'video') {
        pay = 45
      }
      return pay
    }
    
    const oldPay = calculatePay(assignment)
    const newPay = calculatePay({
      jumpType,
      isMissedJump,
      tandemWeightTax,
      tandemHandcam,
      affLevel
    })
    
    const videoPay = hasOutsideVideo ? 45 : 0
    const oldVideoPay = assignment.hasOutsideVideo ? 45 : 0
    
    const oldTotal = oldPay + oldVideoPay
    const newTotal = newPay + videoPay
    
    if (oldTotal !== newTotal || instructorId !== assignment.instructorId || videoInstructorId !== (assignment.videoInstructorId || '')) {
      const diff = newTotal - oldTotal
      if (diff !== 0 || instructorId !== assignment.instructorId) {
        setBalanceWarning(`Balance change: ${diff > 0 ? '+' : ''}$${diff}`)
      } else {
        setBalanceWarning(null)
      }
    } else {
      setBalanceWarning(null)
    }
  }, [jumpType, isMissedJump, tandemWeightTax, tandemHandcam, affLevel, hasOutsideVideo, instructorId, videoInstructorId, assignment])
  
  // Get qualified instructors for main
  const qualifiedMainInstructors = instructors.filter(instructor => {
    if (jumpType === 'tandem' && !instructor.tandem) return false
    if (jumpType === 'aff' && !instructor.aff) return false
    if (jumpType === 'video' && !instructor.video) return false
    
    if (jumpType === 'tandem' && instructor.tandemWeightLimit && studentWeight > instructor.tandemWeightLimit) {
      return false
    }
    if (jumpType === 'aff' && instructor.affWeightLimit && studentWeight > instructor.affWeightLimit) {
      return false
    }
    
    return true
  })
  
  // Get qualified video instructors
  const qualifiedVideoInstructors = instructors.filter(instructor => {
    if (!instructor.video) return false
    if (instructor.id === instructorId) return false
    
    if (instructor.videoRestricted) {
      const mainInstructor = instructors.find(i => i.id === instructorId)
      if (mainInstructor) {
        const combinedWeight = mainInstructor.bodyWeight + studentWeight
        if (instructor.videoMinWeight && combinedWeight < instructor.videoMinWeight) return false
        if (instructor.videoMaxWeight && combinedWeight > instructor.videoMaxWeight) return false
      }
    }
    
    return true
  })
  
  // Get instructors who can be covered for
  const coverableInstructors = instructors.filter(i => {
    if (jumpType === 'tandem' && !i.tandem) return false
    if (jumpType === 'aff' && !i.aff) return false
    if (jumpType === 'video' && !i.video) return false
    return true
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!studentName.trim()) {
      alert('Please enter student name')
      return
    }
    
    if (!instructorId) {
      alert('Please select an instructor')
      return
    }
    
    if (hasOutsideVideo && !videoInstructorId) {
      alert('Please select a video instructor')
      return
    }
    
    // Validate timestamp
    const newTimestamp = new Date(timestamp)
    if (isNaN(newTimestamp.getTime())) {
      alert('Invalid date/time')
      return
    }
    
    const now = new Date()
    if (newTimestamp > now) {
      alert('Cannot set assignment time in the future')
      return
    }
    
    // Confirm if balance changes
    if (balanceWarning && !isRequest) {
      if (!confirm(`⚠️ ${balanceWarning}\n\nThis will affect instructor balances. Continue?`)) {
        return
      }
    }
    
    setLoading(true)
    
    try {
      const updates: Partial<Assignment> = {
        name: studentName.trim(),
        weight: studentWeight,
        jumpType,
        instructorId,
        isRequest,
        isMissedJump,
        timestamp: newTimestamp.toISOString(),
        ...(coveringFor && { coveringFor }),
        ...(jumpType === 'tandem' && {
          tandemWeightTax,
          tandemHandcam,
          hasOutsideVideo,
          ...(hasOutsideVideo && { videoInstructorId })
        }),
        ...(jumpType === 'aff' && {
          affLevel
        }),
        // Clear video if not tandem or not needed
        ...(!hasOutsideVideo && { 
          videoInstructorId: undefined,
          hasOutsideVideo: false 
        })
      }
      
      await db.updateAssignment(assignment.id, updates)
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to update assignment:', error)
      alert('Failed to update assignment. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <h2 className="text-2xl font-bold text-white">✏️ Edit Assignment</h2>
          {balanceWarning && !isRequest && (
            <div className="mt-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-2">
              <p className="text-sm text-yellow-300 font-semibold">⚠️ {balanceWarning}</p>
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Student Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Student Name *
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter student name"
              required
            />
          </div>
          
          {/* Student Weight */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Student Weight (lbs)
            </label>
            <input
              type="number"
              value={studentWeight}
              onChange={(e) => setStudentWeight(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              min="100"
              max="400"
            />
          </div>
          
          {/* Jump Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Jump Type
            </label>
            <select
              value={jumpType}
              onChange={(e) => {
                setJumpType(e.target.value as JumpType)
                setHasOutsideVideo(false)
                setVideoInstructorId('')
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="tandem">Tandem</option>
              <option value="aff">AFF</option>
              <option value="video">Video Only</option>
            </select>
          </div>
          
          {/* Main Instructor */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Main Instructor *
            </label>
            <select
              value={instructorId}
              onChange={(e) => {
                setInstructorId(e.target.value)
                if (hasOutsideVideo) {
                  // Reset video instructor if main instructor changes
                  setVideoInstructorId('')
                }
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Select instructor...</option>
              {qualifiedMainInstructors.map(instructor => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
            {qualifiedMainInstructors.length === 0 && (
              <p className="text-xs text-red-400 mt-1">No qualified instructors available</p>
            )}
          </div>
          
          {/* Covering For */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Covering For (Optional)
            </label>
            <select
              value={coveringFor}
              onChange={(e) => setCoveringFor(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">None (regular jump)</option>
              {coverableInstructors.map(instructor => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-2">
              If this jump was covered by someone else, select who it was for
            </p>
          </div>
          
          {/* Tandem Specific */}
          {jumpType === 'tandem' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Weight Tax Multiplier
                </label>
                <input
                  type="number"
                  value={tandemWeightTax}
                  onChange={(e) => setTandemWeightTax(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  min="0"
                  max="5"
                />
                <p className="text-xs text-slate-400 mt-1">
                  +$20 per multiplier (e.g., 2x = +$40)
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="handcam"
                  checked={tandemHandcam}
                  onChange={(e) => setTandemHandcam(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="handcam" className="text-sm font-semibold text-slate-300">
                  Handcam (+$30)
                </label>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="outsideVideo"
                  checked={hasOutsideVideo}
                  onChange={(e) => {
                    setHasOutsideVideo(e.target.checked)
                    if (!e.target.checked) setVideoInstructorId('')
                  }}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="outsideVideo" className="text-sm font-semibold text-slate-300">
                  Outside Video (+$45)
                </label>
              </div>
              
              {hasOutsideVideo && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Video Instructor *
                  </label>
                  <select
                    value={videoInstructorId}
                    onChange={(e) => setVideoInstructorId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select video instructor...</option>
                    {qualifiedVideoInstructors.map(instructor => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </option>
                    ))}
                  </select>
                  {qualifiedVideoInstructors.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">No qualified video instructors available</p>
                  )}
                </div>
              )}
            </>
          )}
          
          {/* AFF Specific */}
          {jumpType === 'aff' && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                AFF Level
              </label>
              <select
                value={affLevel}
                onChange={(e) => setAffLevel(e.target.value as AFFLevel)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="lower">Lower (Levels 1-4) - $55</option>
                <option value="upper">Upper (Levels 5-7) - $45</option>
              </select>
            </div>
          )}
          
          {/* Timestamp */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              max={new Date().toISOString().slice(0, 16)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Cannot be set in the future
            </p>
          </div>
          
          {/* Flags */}
          <div className="border-t border-slate-700 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isRequest"
                checked={isRequest}
                onChange={(e) => setIsRequest(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
              />
              <label htmlFor="isRequest" className="text-sm font-semibold text-slate-300">
                This is a requested jump (doesn't count toward balance)
              </label>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isMissedJump"
                checked={isMissedJump}
                onChange={(e) => setIsMissedJump(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
              />
              <label htmlFor="isMissedJump" className="text-sm font-semibold text-slate-300">
                This is a missed jump (clocked out early)
              </label>
            </div>
          </div>
          
          {/* Edit History Info */}
          <div className="bg-slate-700/50 rounded-lg p-3 text-xs text-slate-400">
            <div>Original: {new Date(assignment.timestamp).toLocaleString()}</div>
            <div className="mt-1">
              Changes will be recorded in the database
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
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