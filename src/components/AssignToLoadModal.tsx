// src/components/AssignToLoadModal.tsx
// ✅ FIXED: Removed videoRestricted property access
'use client'

import React, { useState, useMemo } from 'react'
import { useQueue, useActiveInstructors, useAssignments, useUpdateLoad, useLoads } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod, calculateInstructorBalance } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import type { Load } from '@/types'

interface AssignToLoadModalProps {
  load: Load
  onClose: () => void
}

export function AssignToLoadModal({ load, onClose }: AssignToLoadModalProps) {
  const { data: queue } = useQueue()
  const { data: allInstructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { data: loads } = useLoads()
  const { update, loading } = useUpdateLoad()
  const toast = useToast()

  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedInstructorId, setSelectedInstructorId] = useState('')
  const [hasOutsideVideo, setHasOutsideVideo] = useState(false)
  const [videoInstructorId, setVideoInstructorId] = useState('')
  
  const period = getCurrentPeriod()
  const clockedInInstructors = allInstructors.filter(i => i.clockedIn)
  
  const selectedStudent = queue.find(s => s.id === selectedStudentId)
  
  // Calculate available seats
  const totalPeople = (load.assignments || []).reduce((sum, a) => {
    let count = 2
    if (a.hasOutsideVideo) count += 1
    return sum + count
  }, 0)
  const availableSeats = (load.capacity || 18) - totalPeople
  
  // Get qualified instructors for selected student
  const qualifiedInstructors = useMemo(() => {
    if (!selectedStudent) return []
    
    return clockedInInstructors
      .filter(instructor => {
        if (selectedStudent.jumpType === 'tandem' && !instructor.canTandem) return false
        if (selectedStudent.jumpType === 'aff' && !instructor.canAFF) return false
        // Check weight limits
        if (selectedStudent.jumpType === 'tandem' && instructor.tandemWeightLimit) {
          if (selectedStudent.weight > instructor.tandemWeightLimit) return false
        }
        if (selectedStudent.jumpType === 'aff' && instructor.affWeightLimit) {
          if (selectedStudent.weight > instructor.affWeightLimit) return false
        }
        
        // Check AFF locked status
        if (selectedStudent.jumpType === 'aff' && instructor.affLocked) return false
        
        // Check if already on this load
        const alreadyOnLoad = (load.assignments || []).some(a => a.instructorId === instructor.id)
        if (alreadyOnLoad) return false
        
        return true
      })
      .map(instructor => ({
        instructor,
        balance: calculateInstructorBalance(instructor.id, assignments, allInstructors, period, loads)
      }))
      .sort((a, b) => a.balance - b.balance)
  }, [selectedStudent, clockedInInstructors, assignments, period, load, allInstructors, loads])
  
  // Get video instructors
  const videoInstructors = useMemo(() => {
    if (!selectedStudent) return []
    
    return clockedInInstructors
      .filter(i => 
        i.canVideo && 
        i.id !== selectedInstructorId &&
        (
          // ✅ FIXED: If no restrictions, allow all
          (i.videoMinWeight == null && i.videoMaxWeight == null) ||
          // If restrictions exist, check weight
          (selectedStudent.weight >= (i.videoMinWeight || 0) && 
           selectedStudent.weight <= (i.videoMaxWeight || 999))
        )
      )
      .filter(i => {
        // Not already on load
        return !(load.assignments || []).some(a => 
          a.instructorId === i.id || a.videoInstructorId === i.id
        )
      })
  }, [selectedStudent, clockedInInstructors, selectedInstructorId, load])
  
  // Auto-select best instructor when student is selected
  React.useEffect(() => {
    const firstQualified = qualifiedInstructors[0]
    if (selectedStudent && firstQualified && !selectedInstructorId) {
      setSelectedInstructorId(firstQualified.instructor.id)
    }
  }, [selectedStudent, qualifiedInstructors, selectedInstructorId])
  
  // Check if student has outside video in queue
  React.useEffect(() => {
    if (selectedStudent?.outsideVideo) {
      setHasOutsideVideo(true)
    }
  }, [selectedStudent])
  
  const handleAssign = async () => {
    if (!selectedStudent || !selectedInstructorId) {
      toast.error('Please select a student and instructor')
      return
    }
    
    if (hasOutsideVideo && !videoInstructorId) {
      toast.error('Please select a video instructor')
      return
    }
    
    if (availableSeats < 2) {
      toast.error('Not enough seats on this load')
      return
    }
    
    const instructor = allInstructors.find(i => i.id === selectedInstructorId)
    const videoInstructor = hasOutsideVideo ? allInstructors.find(i => i.id === videoInstructorId) : null
    
    if (!instructor) {
      toast.error('Invalid instructor selection')
      return
    }
    
    try {
      const newAssignment = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        studentId: selectedStudent.id,
        instructorId: instructor.id,
        instructorName: instructor.name,
        studentName: selectedStudent.name,
        studentWeight: selectedStudent.weight,
        jumpType: selectedStudent.jumpType,
        isRequest: selectedStudent.isRequest || false,
        tandemWeightTax: selectedStudent.tandemWeightTax || 0,
        tandemHandcam: selectedStudent.tandemHandcam || false,
        affLevel: selectedStudent.affLevel,
        hasOutsideVideo: hasOutsideVideo,
        videoInstructorId: videoInstructor?.id || null,
        videoInstructorName: videoInstructor?.name,
        groupId: selectedStudent.groupId
      }
      
      const currentAssignments = load.assignments || []
      await update(load.id, {
        assignments: [...currentAssignments, newAssignment]
      })
      
      await db.removeFromQueue(selectedStudent.id)
      
      // Reset selections
      setSelectedStudentId('')
      setSelectedInstructorId('')
      setHasOutsideVideo(false)
      setVideoInstructorId('')
    } catch (error) {
      console.error('Failed to assign to load:', error)
      toast.error('Failed to assign', 'Please try again.')
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="border-b border-slate-700 p-6">
          <h2 className="text-2xl font-bold text-white">
            Assign to Load #{load.position || 'Next'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Available Seats: {availableSeats}/{load.capacity || 18}
          </p>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Student Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Select Student *
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value)
                setSelectedInstructorId('')
                setVideoInstructorId('')
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Choose from queue...</option>
              {queue.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.weight} lbs) - {student.jumpType.toUpperCase()}
                  {student.isRequest && ' [REQUEST]'}
                </option>
              ))}
            </select>
          </div>
          
          {selectedStudent && (
            <>
              {/* Main Instructor */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Main Instructor *
                </label>
                <select
                  value={selectedInstructorId}
                  onChange={(e) => setSelectedInstructorId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select instructor...</option>
                  {qualifiedInstructors.map(({ instructor, balance }) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.name} (Balance: ${balance})
                    </option>
                  ))}
                </select>
                {qualifiedInstructors.length === 0 && (
                  <p className="text-xs text-red-400 mt-1">No qualified instructors available</p>
                )}
              </div>
              
              {/* Outside Video */}
              {selectedStudent.jumpType === 'tandem' && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
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
                      >
                        <option value="">Select video instructor...</option>
                        {videoInstructors.map(instructor => (
                          <option key={instructor.id} value={instructor.id}>
                            {instructor.name}
                          </option>
                        ))}
                      </select>
                      {videoInstructors.length === 0 && (
                        <p className="text-xs text-red-400 mt-1">No video instructors available</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={loading || !selectedStudentId || !selectedInstructorId || (hasOutsideVideo && !videoInstructorId)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Assigning...' : 'Assign to Load'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}