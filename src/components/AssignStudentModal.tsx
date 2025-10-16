// src/components/AssignStudentModal.tsx
// ✅ FIXED: Removed videoRestricted property access
'use client'

import React, { useState, useMemo } from 'react'
import { useInstructors, useAssignments, useCreateAssignment } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod, calculateInstructorBalance } from '@/lib/utils'
import type { QueueStudent, Instructor, Assignment } from '@/types'

interface AssignStudentModalProps {
  students: QueueStudent[]
  onClose: () => void
  onSuccess: () => void
}

export function AssignStudentModal({ students, onClose, onSuccess }: AssignStudentModalProps) {
  const { data: allInstructors } = useInstructors()
  const { data: assignments } = useAssignments()
  const { create, loading } = useCreateAssignment()
  
  const [selectedMainId, setSelectedMainId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  
  const period = getCurrentPeriod()
  const clockedInInstructors = allInstructors.filter(i => !i.archived && i.clockedIn)
  
  const student = students[0]
  const needsTandem = student.jumpType === 'tandem'
  const needsAFF = student.jumpType === 'aff'
  const needsVideo = needsTandem && student.outsideVideo
  const maxWeight = student.weight + (student.tandemWeightTax || 0)
  
  const suggestedMain = useMemo(() => {
    const qualified = clockedInInstructors.filter(instructor => {
      if (needsTandem && !instructor.canTandem) return false
      if (needsAFF && !instructor.canAFF) return false
      
      if (needsTandem && instructor.tandemWeightLimit && maxWeight > instructor.tandemWeightLimit) {
        return false
      }
      
      if (needsAFF && instructor.affWeightLimit && student.weight > instructor.affWeightLimit) {
        return false
      }
      
      if (needsAFF && instructor.affLocked) {
        const hasThisStudent = instructor.affStudents?.some(s => s.name === student.name)
        if (!hasThisStudent) return false
      }
      
      return true
    })
    
    if (qualified.length === 0) return null
    
    qualified.sort((a, b) => {
      const balanceA = calculateInstructorBalance(a.id, assignments, allInstructors, period)
      const balanceB = calculateInstructorBalance(b.id, assignments, allInstructors, period)
      return balanceA - balanceB
    })
    
    return qualified[0]
  }, [clockedInInstructors, needsTandem, needsAFF, maxWeight, student, assignments, allInstructors, period])
  
  const suggestedVideo = useMemo(() => {
    if (!needsVideo) return null
    
    const qualified = clockedInInstructors.filter(instructor => {
      if (!instructor.canVideo) return false
      if (instructor.id === selectedMainId) return false
      
      // ✅ FIXED: Check if video restrictions exist by looking at min/max weight properties
      if (instructor.videoMinWeight != null || instructor.videoMaxWeight != null) {
        const mainInstructor = allInstructors.find(i => i.id === selectedMainId)
        if (mainInstructor) {
          const combinedWeight = mainInstructor.bodyWeight + student.weight
          if (instructor.videoMinWeight && combinedWeight < instructor.videoMinWeight) return false
          if (instructor.videoMaxWeight && combinedWeight > instructor.videoMaxWeight) return false
        }
      }
      
      return true
    })
    
    if (qualified.length === 0) return null
    
    qualified.sort((a, b) => {
      const balanceA = calculateInstructorBalance(a.id, assignments, allInstructors, period)
      const balanceB = calculateInstructorBalance(b.id, assignments, allInstructors, period)
      return balanceA - balanceB
    })
    
    return qualified[0]
  }, [needsVideo, clockedInInstructors, selectedMainId, student, assignments, allInstructors, period])
  
  React.useEffect(() => {
    if (suggestedMain && !selectedMainId) {
      setSelectedMainId(suggestedMain.id)
    }
  }, [suggestedMain, selectedMainId])
  
  React.useEffect(() => {
    if (suggestedVideo && !selectedVideoId && needsVideo) {
      setSelectedVideoId(suggestedVideo.id)
    }
  }, [suggestedVideo, selectedVideoId, needsVideo])
  
  const handleAssign = async () => {
    if (!selectedMainId) {
      alert('Please select a main instructor')
      return
    }
    
    if (needsVideo && !selectedVideoId) {
      alert('Please select a video instructor')
      return
    }
    
    try {
      const mainInstructor = allInstructors.find(i => i.id === selectedMainId)
      const videoInstructor = needsVideo ? allInstructors.find(i => i.id === selectedVideoId) : null
      
      if (!mainInstructor) {
        alert('Invalid instructor selection')
        return
      }
      
      for (const student of students) {
        await create({
          instructorId: mainInstructor.id,
          instructorName: mainInstructor.name,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          isRequest: student.isRequest || false,
          isMissedJump: false,
          ...(student.jumpType === 'tandem' && {
            tandemWeightTax: student.tandemWeightTax,
            tandemHandcam: student.tandemHandcam,
          }),
          ...(student.jumpType === 'aff' && {
            affLevel: student.affLevel,
          }),
          ...(needsVideo && videoInstructor && {
            hasOutsideVideo: true,
            videoInstructorId: videoInstructor.id,
            videoInstructorName: videoInstructor.name,
          }),
        })
        
        await db.removeFromQueue(student.id)
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to assign:', error)
      alert('Failed to assign students. Please try again.')
    }
  }
  
  const mainOptions = clockedInInstructors.filter(instructor => {
    if (needsTandem && !instructor.canTandem) return false
    if (needsAFF && !instructor.canAFF) return false
    return true
  })
  
  const videoOptions = clockedInInstructors.filter(instructor => {
    if (!instructor.canVideo) return false
    if (instructor.id === selectedMainId) return false
    return true
  })
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
        <div className="border-b border-slate-700 p-6">
          <h2 className="text-2xl font-bold text-white">
            Assign {students.length} Student{students.length > 1 ? 's' : ''}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {student.name} ({student.weight} lbs) - {student.jumpType.toUpperCase()}
            {students.length > 1 && ` +${students.length - 1} more`}
          </p>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Main Instructor */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Main Instructor *
            </label>
            <select
              value={selectedMainId}
              onChange={(e) => {
                setSelectedMainId(e.target.value)
                if (needsVideo) setSelectedVideoId('')
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Select instructor...</option>
              {mainOptions.map(instructor => {
                const balance = calculateInstructorBalance(instructor.id, assignments, allInstructors, period)
                return (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.name} (Balance: ${balance})
                    {suggestedMain?.id === instructor.id && ' ⭐ Suggested'}
                  </option>
                )
              })}
            </select>
          </div>
          
          {/* Video Instructor */}
          {needsVideo && (
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Video Instructor * (+$45)
              </label>
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              >
                <option value="">Select video instructor...</option>
                {videoOptions.map(instructor => {
                  const balance = calculateInstructorBalance(instructor.id, assignments, allInstructors, period)
                  return (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.name} (Balance: ${balance})
                      {suggestedVideo?.id === instructor.id && ' ⭐ Suggested'}
                    </option>
                  )
                })}
              </select>
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
              type="button"
              onClick={handleAssign}
              disabled={loading || !selectedMainId || (needsVideo && !selectedVideoId)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}