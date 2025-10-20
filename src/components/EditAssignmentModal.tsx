// src/components/EditAssignmentModal.tsx
// ✅ COMPLETELY CLEANED VERSION
'use client'

import React, { useState, useEffect } from 'react'
import { useActiveInstructors } from '@/hooks/useDatabase'
import { calculateAssignmentPay } from '@/lib/utils'
import { db } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type { Assignment, JumpType, AFFLevel } from '@/types'

interface EditAssignmentModalProps {
  assignment: Assignment
  onClose: () => void
  onSuccess: () => void
}

export function EditAssignmentModal({ assignment, onClose, onSuccess }: EditAssignmentModalProps) {
  const { data: instructors } = useActiveInstructors()
  const toast = useToast()

  // Form state
  const [studentName, setStudentName] = useState(assignment.studentName)
  const [studentWeight, setStudentWeight] = useState(assignment.studentWeight)
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
    const oldPay = calculateAssignmentPay(assignment as any)
    const newPay = calculateAssignmentPay({
      jumpType,
      isMissedJump,
      tandemWeightTax,
      tandemHandcam,
      affLevel
    } as any)
    
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
  
  // ✅ CLEAN: Get qualified instructors for main
  const qualifiedMainInstructors = instructors.filter(instructor => {
    if (jumpType === 'tandem' && !instructor.canTandem) return false
    if (jumpType === 'aff' && !instructor.canAFF) return false
    if (jumpType === 'video' && !instructor.canVideo) return false
    
    if (jumpType === 'tandem' && instructor.tandemWeightLimit && studentWeight > instructor.tandemWeightLimit) {
      return false
    }
    if (jumpType === 'aff' && instructor.affWeightLimit && studentWeight > instructor.affWeightLimit) {
      return false
    }
    
    return true
  })
  
  // ✅ CLEAN: Get qualified video instructors
  const qualifiedVideoInstructors = instructors.filter(instructor => {
    if (!instructor.canVideo) return false
    if (instructor.id === instructorId) return false
    
    if (instructor.videoMinWeight != null || instructor.videoMaxWeight != null) {
      const mainInstructor = instructors.find(i => i.id === instructorId)
      if (mainInstructor) {
        const combinedWeight = mainInstructor.bodyWeight + studentWeight
        if (instructor.videoMinWeight && combinedWeight < instructor.videoMinWeight) return false
        if (instructor.videoMaxWeight && combinedWeight > instructor.videoMaxWeight) return false
      }
    }
    
    return true
  })
  
  // ✅ CLEAN: Get instructors who can be covered for
  const coverableInstructors = instructors.filter(i => {
    if (jumpType === 'tandem' && !i.canTandem) return false
    if (jumpType === 'aff' && !i.canAFF) return false
    if (jumpType === 'video' && !i.canVideo) return false
    return true
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!studentName.trim()) {
      toast.error('Please enter student name')
      return
    }
    
    if (!instructorId) {
      toast.error('Please select an instructor')
      return
    }
    
    if (hasOutsideVideo && !videoInstructorId) {
      toast.error('Please select a video instructor')
      return
    }
    
    // Validate timestamp
    const newTimestamp = new Date(timestamp)
    if (isNaN(newTimestamp.getTime())) {
      toast.error('Invalid date/time')
      return
    }
    
    const now = new Date()
    if (newTimestamp > now) {
      toast.error('Cannot set assignment time in the future')
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
        studentName: studentName.trim(),
        studentWeight: studentWeight,
        jumpType,
        instructorId,
        instructorName: instructors.find(i => i.id === instructorId)?.name || '',
        isRequest,
        isMissedJump,
        timestamp: newTimestamp.toISOString(),
        ...(coveringFor && { coveringFor }),
        ...(jumpType === 'tandem' && {
          tandemWeightTax,
          tandemHandcam,
          hasOutsideVideo,
          ...(hasOutsideVideo && videoInstructorId && { 
            videoInstructorId,
            videoInstructorName: instructors.find(i => i.id === videoInstructorId)?.name || ''
          })
        }),
        ...(jumpType === 'aff' && {
          affLevel
        }),
        // Fix: Use undefined instead of null
        ...(!hasOutsideVideo && { 
          videoInstructorId: undefined,  // Changed from null
          videoInstructorName: undefined,  // Changed from undefined
          hasOutsideVideo: false 
        })
      }
      
      await db.updateAssignment(assignment.id, updates)
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to update assignment:', error)
      toast.error('Failed to update assignment', 'Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-assignment-modal-title"
      >
        <div className="border-b border-slate-700 p-6">
          <h2 id="edit-assignment-modal-title" className="text-2xl font-bold text-white">Edit Assignment</h2>
          {balanceWarning && (
            <p className="text-sm text-yellow-400 mt-1">⚠️ {balanceWarning}</p>
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
              required
            />
          </div>
          
          {/* Student Weight */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Student Weight (lbs) *
            </label>
            <input
              type="number"
              min="100"
              max="350"
              value={studentWeight}
              onChange={(e) => setStudentWeight(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
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
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Covering For (optional)
            </label>
            <select
              value={coveringFor}
              onChange={(e) => setCoveringFor(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">None - Regular jump</option>
              {coverableInstructors.map(instructor => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
          </div>
          
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
          </div>
          
          {/* Tandem Options */}
          {jumpType === 'tandem' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Weight Tax
                </label>
                <select
                  value={tandemWeightTax}
                  onChange={(e) => setTandemWeightTax(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={0}>No Tax ($0)</option>
                  <option value={1}>1x Tax (+$20)</option>
                  <option value={2}>2x Tax (+$40)</option>
                  <option value={3}>3x Tax (+$60)</option>
                  <option value={4}>4x Tax (+$80)</option>
                  <option value={5}>5x Tax (+$100)</option>
                </select>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="handcam"
                  checked={tandemHandcam}
                  onChange={(e) => setTandemHandcam(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700"
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
                  onChange={(e) => setHasOutsideVideo(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700"
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
                    <p className="text-xs text-red-400 mt-1">No video instructors available</p>
                  )}
                </div>
              )}
            </>
          )}
          
          {/* AFF Options */}
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
          
          {/* Additional Options */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="request"
                checked={isRequest}
                onChange={(e) => setIsRequest(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700"
              />
              <label htmlFor="request" className="text-sm font-semibold text-slate-300">
                Requested Jump
              </label>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="missed"
                checked={isMissedJump}
                onChange={(e) => setIsMissedJump(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700"
              />
              <label htmlFor="missed" className="text-sm font-semibold text-slate-300">
                Missed Jump (No Pay)
              </label>
            </div>
          </div>
          
          {/* Submit */}
          <div className="border-t border-slate-700 pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !instructorId || (hasOutsideVideo && !videoInstructorId)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}