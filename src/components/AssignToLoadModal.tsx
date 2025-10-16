// src/components/AssignToLoadModal.tsx
// ✅ CLEANED VERSION - No backwards compatibility code
'use client'

import React, { useState, useMemo } from 'react'
import { useQueue, useActiveInstructors, useAssignments, useUpdateLoad } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod, calculateInstructorBalance } from '@/lib/utils'
import type { Load, QueueStudent, Instructor, Assignment } from '@/types'

interface AssignToLoadModalProps {
  load: Load
  onClose: () => void
}

export function AssignToLoadModal({ load, onClose }: AssignToLoadModalProps) {
  const { data: queue } = useQueue()
  const { data: allInstructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { update, loading } = useUpdateLoad()
  
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
  const availableSeats = load.capacity - totalPeople
  
  // Get qualified instructors for selected student
  const qualifiedInstructors = useMemo(() => {
    if (!selectedStudent) return []
    
    return clockedInInstructors
      .filter(instructor => {
        // ✅ CLEAN: Check department qualification using correct property names
        if (selectedStudent.jumpType === 'tandem' && !instructor.canTandem) return false
        if (selectedStudent.jumpType === 'aff' && !instructor.canAFF) return false
        if (selectedStudent.jumpType === 'video' && !instructor.canVideo) return false
        
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
        balance: calculateInstructorBalance(instructor.id, assignments, allInstructors, period)
      }))
      .sort((a, b) => a.balance - b.balance)
  }, [selectedStudent, clockedInInstructors, assignments, period, load, allInstructors])
  
  // Get video instructors
  const videoInstructors = useMemo(() => {
    if (!selectedStudent) return []
    
    return clockedInInstructors
      // ✅ CLEAN: Use correct property name
      .filter(i => 
        i.canVideo && 
        i.id !== selectedInstructorId &&
        (!i.videoRestricted || 
          (selectedStudent.weight >= (i.videoMinWeight || 0) && 
           selectedStudent.weight <= (i.videoMaxWeight || 999)))
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
    if (selectedStudent && qualifiedInstructors.length > 0 && !selectedInstructorId) {
      setSelectedInstructorId(qualifiedInstructors[0].instructor.id)
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
      alert('Please select a student and instructor')
      return
    }
    
    if (hasOutsideVideo && !videoInstructorId) {
      alert('Please select a video instructor')
      return
    }
    
    if (availableSeats < 2) {
      alert('Not enough seats on this load')
      return
    }
    
    const instructor = allInstructors.find(i => i.id === selectedInstructorId)
    const videoInstructor = hasOutsideVideo ? allInstructors.find(i => i.id === videoInstructorId) : null
    
    if (!instructor) return
    
    try {
      // Create assignment for load
      const newAssignment = {
        id: Date.now().toString(),
        instructorId: instructor.id,
        instructorName: instructor.name,
        studentName: selectedStudent.name,
        studentWeight: selectedStudent.weight,
        jumpType: selectedStudent.jumpType,
        isRequest: selectedStudent.isRequest,
        ...(selectedStudent.jumpType === 'tandem' && {
          tandemWeightTax: selectedStudent.tandemWeightTax,
          tandemHandcam: selectedStudent.tandemHandcam,
        }),
        ...(selectedStudent.jumpType === 'aff' && {
          affLevel: selectedStudent.affLevel,
        }),
        ...(hasOutsideVideo && videoInstructor && {
          hasOutsideVideo: true,
          videoInstructorId: videoInstructor.id,
          videoInstructorName: videoInstructor.name,
        }),
      }
      
      // Update load with new assignment
      const updatedAssignments = [...(load.assignments || []), newAssignment]
      await update(load.id, { assignments: updatedAssignments })
      
      // Remove student from queue
      await db.removeFromQueue(selectedStudent.id)
      
      // Reset form
      setSelectedStudentId('')
      setSelectedInstructorId('')
      setHasOutsideVideo(false)
      setVideoInstructorId('')
      
      // Close modal if no more seats
      if (availableSeats <= 2) {
        onClose()
      }
    } catch (error) {
      console.error('Failed to assign:', error)
      alert('Failed to assign student. Please try again.')
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full border border-slate-700">
        <div className="border-b border-slate-700 p-6">
          <h2 className="text-2xl font-bold text-white">Assign Student to {load.name}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Available seats: {availableSeats}
          </p>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Student Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Select Student
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Choose a student</option>
              {queue.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} - {student.jumpType.toUpperCase()} ({student.weight} lbs)
                </option>
              ))}
            </select>
          </div>
          
          {/* Instructor Selection */}
          {selectedStudent && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Select Instructor
                </label>
                <select
                  value={selectedInstructorId}
                  onChange={(e) => setSelectedInstructorId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Choose an instructor</option>
                  {qualifiedInstructors.map(({ instructor, balance }) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.name} (${balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Video Checkbox */}
              {selectedStudent.jumpType === 'tandem' && (
                <>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="hasVideo"
                      checked={hasOutsideVideo}
                      onChange={(e) => setHasOutsideVideo(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-700"
                    />
                    <label htmlFor="hasVideo" className="text-sm font-semibold text-slate-300">
                      Has outside video
                    </label>
                  </div>
                  
                  {hasOutsideVideo && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Video Instructor
                      </label>
                      <select
                        value={videoInstructorId}
                        onChange={(e) => setVideoInstructorId(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Choose video instructor</option>
                        {videoInstructors.map(instructor => (
                          <option key={instructor.id} value={instructor.id}>
                            {instructor.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              
              {/* Assignment Preview */}
              {selectedInstructorId && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-300 mb-2">Assignment Preview:</p>
                  <p className="text-white">
                    👤 {allInstructors.find(i => i.id === selectedInstructorId)?.name} + {selectedStudent.name}
                  </p>
                  <p className="text-xs text-slate-300">
                    {selectedStudent.jumpType.toUpperCase()} • {selectedStudent.weight} lbs
                    {hasOutsideVideo && videoInstructorId && ` • 📹 ${allInstructors.find(i => i.id === videoInstructorId)?.name}`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="border-t border-slate-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleAssign}
            disabled={loading || !selectedStudentId || !selectedInstructorId || (hasOutsideVideo && !videoInstructorId)}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Assigning...' : '✓ Assign to Load'}
          </button>
        </div>
      </div>
    </div>
  )
}