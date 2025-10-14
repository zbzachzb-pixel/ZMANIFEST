// Replace src/components/AddJumpModal.tsx with this updated version
'use client'

import React, { useState } from 'react'
import { useCreateAssignment, useActiveInstructors } from '@/hooks/useDatabase'
import type { Instructor, JumpType, AFFLevel } from '@/types'

interface AddJumpModalProps {
  instructor: Instructor
  onClose: () => void
}

export function AddJumpModal({ instructor, onClose }: AddJumpModalProps) {
  const { create, loading } = useCreateAssignment()
  const { data: instructors } = useActiveInstructors()
  
  const [studentName, setStudentName] = useState('')
  const [studentWeight, setStudentWeight] = useState(180)
  const [jumpType, setJumpType] = useState<JumpType>('tandem')
  const [isRequest, setIsRequest] = useState(false)
  const [isMissedJump, setIsMissedJump] = useState(false)
  
  // ⭐ NEW: Covering for functionality
  const [coveringForId, setCoveringForId] = useState('')
  const [showCoveringOptions, setShowCoveringOptions] = useState(!instructor.clockedIn)
  
  // Tandem specific
  const [tandemWeightTax, setTandemWeightTax] = useState(0)
  const [tandemHandcam, setTandemHandcam] = useState(false)
  const [hasOutsideVideo, setHasOutsideVideo] = useState(false)
  const [videoInstructorId, setVideoInstructorId] = useState('')
  
  // AFF specific
  const [affLevel, setAffLevel] = useState<AFFLevel>('lower')
  
  const videoInstructors = instructors.filter(i => 
    i.video && 
    i.clockedIn && 
    i.id !== instructor.id &&
    (!i.videoRestricted || 
      (studentWeight >= (i.videoMinWeight || 0) && studentWeight <= (i.videoMaxWeight || 999)))
  )
  
  // ⭐ Get instructors who can cover
  const potentialCoverInstructors = instructors.filter(i =>
    i.id !== instructor.id &&
    i.clockedIn &&
    (jumpType === 'tandem' ? i.tandem : jumpType === 'aff' ? i.aff : i.video)
  )
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!studentName.trim()) {
      alert('Please enter student name')
      return
    }
    
    if (hasOutsideVideo && !videoInstructorId) {
      alert('Please select a video instructor')
      return
    }
    
    // ⭐ Check if covering is needed
    if (!instructor.clockedIn && !coveringForId && !isMissedJump) {
      alert('This instructor is clocked out. Please select someone to cover or mark as missed jump.')
      return
    }
    
    const assignmentData = {
      instructorId: coveringForId || instructor.id, // Use covering instructor if set
      name: studentName.trim(),
      weight: studentWeight,
      jumpType,
      isRequest,
      isMissedJump,
      ...(coveringForId && {
        coveringFor: instructor.id // Track who this jump is for
      }),
      ...(jumpType === 'tandem' && {
        tandemWeightTax,
        tandemHandcam,
      }),
      ...(jumpType === 'aff' && {
        affLevel,
      }),
      ...(hasOutsideVideo && {
        hasOutsideVideo: true,
        videoInstructorId,
      }),
    }
    
    try {
      await create(assignmentData)
      onClose()
    } catch (error) {
      console.error('Failed to add jump:', error)
      alert('Failed to add jump. Please try again.')
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <h2 className="text-2xl font-bold text-white">Add Jump for {instructor.name}</h2>
          {!instructor.clockedIn && (
            <div className="mt-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-sm text-yellow-300 font-semibold">
                ⚠️ {instructor.name} is clocked out
              </p>
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
          
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Jump Type
            </label>
            <select
              value={jumpType}
              onChange={(e) => setJumpType(e.target.value as JumpType)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              {instructor.tandem && <option value="tandem">Tandem</option>}
              {instructor.aff && <option value="aff">AFF</option>}
              {instructor.video && <option value="video">Video Only</option>}
            </select>
          </div>
          
          {/* ⭐ Covering For Section */}
          {!instructor.clockedIn && !isMissedJump && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Who is covering this jump? *
              </label>
              <select
                value={coveringForId}
                onChange={(e) => setCoveringForId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              >
                <option value="">Select covering instructor...</option>
                {potentialCoverInstructors.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-2">
                💡 This jump will count toward {instructor.name}'s balance but {coveringForId && instructors.find(i => i.id === coveringForId)?.name} will do the jump.
              </p>
            </div>
          )}
          
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
                  onChange={(e) => setHasOutsideVideo(e.target.checked)}
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
                    {videoInstructors.map(vi => (
                      <option key={vi.id} value={vi.id}>{vi.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          
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
          
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center gap-3 mb-3">
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
                onChange={(e) => {
                  setIsMissedJump(e.target.checked)
                  if (e.target.checked) {
                    setCoveringForId('') // Clear covering if marking as missed
                  }
                }}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
              />
              <label htmlFor="isMissedJump" className="text-sm font-semibold text-slate-300">
                This is a missed jump (clocked out early)
              </label>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Jump'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}