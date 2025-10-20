// src/components/AddJumpModal.tsx
// ✅ FIXED: Added onSuccess prop to interface
'use client'

import React, { useState } from 'react'
import { useCreateAssignment, useActiveInstructors } from '@/hooks/useDatabase'
import { useToast } from '@/contexts/ToastContext'
import type { Instructor, JumpType, AFFLevel } from '@/types'

interface AddJumpModalProps {
  instructor: Instructor
  onClose: () => void
  onSuccess?: () => void  // ✅ ADDED: Optional success callback
}

export function AddJumpModal({ instructor, onClose, onSuccess }: AddJumpModalProps) {
  const { create, loading } = useCreateAssignment()
  const { data: instructors } = useActiveInstructors()
  const toast = useToast()

  const [studentName, setStudentName] = useState('')
  const [studentWeight, setStudentWeight] = useState(180)
  const [jumpType, setJumpType] = useState<JumpType>('tandem')
  const [isRequest, setIsRequest] = useState(false)
  const [isMissedJump, setIsMissedJump] = useState(false)
  
  // Covering for functionality
  const [coveringForId, setCoveringForId] = useState('')
  const [showCoveringOptions, setShowCoveringOptions] = useState(!instructor.clockedIn)
  
  // Tandem specific
  const [tandemWeightTax, setTandemWeightTax] = useState(0)
  const [tandemHandcam, setTandemHandcam] = useState(false)
  const [hasOutsideVideo, setHasOutsideVideo] = useState(false)
  const [videoInstructorId, setVideoInstructorId] = useState('')
  
  // AFF specific
  const [affLevel, setAffLevel] = useState<AFFLevel>('lower')
  
  // ✅ FIXED: Check if video restrictions exist by looking at min/max weight properties
  const videoInstructors = instructors.filter(i => 
    i.canVideo && 
    i.clockedIn && 
    i.id !== instructor.id &&
    (
      // If no restrictions are set (both null/undefined), instructor can take any video
      (i.videoMinWeight == null && i.videoMaxWeight == null) ||
      // If restrictions exist, check if student weight is within range
      (studentWeight >= (i.videoMinWeight || 0) && studentWeight <= (i.videoMaxWeight || 999))
    )
  )
  
  // ✅ CLEAN: Get instructors who can cover
  const potentialCoverInstructors = instructors.filter(i => {
    if (i.id === instructor.id) return false
    if (!i.clockedIn) return false
    
    // Check qualification based on jump type
    if (jumpType === 'tandem') return i.canTandem
    if (jumpType === 'aff') return i.canAFF
    if (jumpType === 'video') return i.canVideo
    
    return false
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!studentName.trim()) {
      toast.error('Please enter student name')
      return
    }
    
    if (hasOutsideVideo && !videoInstructorId) {
      toast.error('Please select a video instructor')
      return
    }
    
    // Check if covering is needed
    if (!instructor.clockedIn && !coveringForId && !isMissedJump) {
      toast.warning('Instructor is clocked out', 'Please select someone to cover or mark as missed jump.')
      return
    }
    
    const assignmentData = {
      instructorId: coveringForId || instructor.id,
      instructorName: coveringForId 
        ? instructors.find(i => i.id === coveringForId)?.name || ''
        : instructor.name,
      studentName: studentName.trim(),
      studentWeight: studentWeight,
      jumpType,
      isRequest,
      isMissedJump,
      timestamp: new Date().toISOString(),
      ...(coveringForId && {
        coveringFor: instructor.id
      }),
      ...(jumpType === 'tandem' && {
        tandemWeightTax,
        tandemHandcam,
      }),
      ...(jumpType === 'aff' && {
        affLevel,
      }),
      ...(hasOutsideVideo && videoInstructorId && {
        hasOutsideVideo: true,
        videoInstructorId,
        videoInstructorName: instructors.find(i => i.id === videoInstructorId)?.name || '',
      }),
    }
    
    try {
      await create(assignmentData)
      onSuccess?.()  // ✅ ADDED: Call onSuccess callback if provided
      onClose()
    } catch (error) {
      console.error('Failed to add jump:', error)
      toast.error('Failed to add jump', 'Please try again.')
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="border-b border-slate-700 p-6">
          <h2 className="text-2xl font-bold text-white">
            Add Jump for {instructor.name}
          </h2>
          {!instructor.clockedIn && (
            <p className="text-sm text-yellow-400 mt-1">
              ⚠️ This instructor is clocked out
            </p>
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
              Student Weight (lbs) *
            </label>
            <input
              type="number"
              value={studentWeight}
              onChange={(e) => setStudentWeight(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              min="100"
              max="400"
              required
            />
          </div>

          {/* Jump Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Jump Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setJumpType('tandem')}
                className={`py-3 rounded-lg font-medium transition-all ${
                  jumpType === 'tandem'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                Tandem
              </button>
              <button
                type="button"
                onClick={() => setJumpType('aff')}
                className={`py-3 rounded-lg font-medium transition-all ${
                  jumpType === 'aff'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                AFF
              </button>
            </div>
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
                  <option value={0}>None (0 lbs)</option>
                  <option value={20}>+20 lbs</option>
                  <option value={40}>+40 lbs</option>
                  <option value={60}>+60 lbs</option>
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
                    required={hasOutsideVideo}
                  >
                    <option value="">Select video instructor...</option>
                    {videoInstructors.map(vi => (
                      <option key={vi.id} value={vi.id}>{vi.name}</option>
                    ))}
                  </select>
                  {videoInstructors.length === 0 && (
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
          
          {/* Covering For Section */}
          {!instructor.clockedIn && (
            <div className="border-t border-slate-700 pt-4">
              <button
                type="button"
                onClick={() => setShowCoveringOptions(!showCoveringOptions)}
                className="text-sm text-blue-400 hover:text-blue-300 mb-2"
              >
                {showCoveringOptions ? '▼' : '▶'} Covering Options
              </button>
              
              {showCoveringOptions && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Who is covering? (Required if not missed jump)
                  </label>
                  <select
                    value={coveringForId}
                    onChange={(e) => setCoveringForId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    disabled={isMissedJump}
                  >
                    <option value="">Select instructor...</option>
                    {potentialCoverInstructors.map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Adding...' : 'Add Jump'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}