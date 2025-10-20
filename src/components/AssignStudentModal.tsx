// src/components/AssignStudentModal.tsx
// ✅ FIXED: Removed videoRestricted property access
'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useInstructors, useAssignments, useCreateAssignment, useLoads } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod, calculateInstructorBalance } from '@/lib/utils'
import { getBestInstructor } from '@/lib/instructorUtils'
import { useToast } from '@/contexts/ToastContext'
import type { QueueStudent } from '@/types'

interface AssignStudentModalProps {
  students: QueueStudent[]
  onClose: () => void
  onSuccess: () => void
}

export function AssignStudentModal({ students, onClose, onSuccess }: AssignStudentModalProps) {
  const { data: allInstructors } = useInstructors()
  const { data: assignments } = useAssignments()
  const { data: loads } = useLoads()
  const { create, loading } = useCreateAssignment()
  const toast = useToast()

  const [selectedMainId, setSelectedMainId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  
  const period = getCurrentPeriod()
  const clockedInInstructors = allInstructors.filter(i => !i.archived && i.clockedIn)

  const student = students[0]!  // Safe assertion - modal shouldn't be shown without students
  const needsTandem = student.jumpType === 'tandem'
  const needsAFF = student.jumpType === 'aff'
  const needsVideo = needsTandem && student.outsideVideo

  const suggestedMain = useMemo(() => {
    // ✅ REFACTORED: Use shared utility function instead of duplicate logic
    return getBestInstructor(
      student,
      clockedInInstructors,
      {}, // No special filter options needed
      {
        sortByBalance: true,
        assignments,
        allInstructors,
        period,
        allLoads: loads
      }
    )
  }, [student, clockedInInstructors, assignments, allInstructors, period, loads])
  
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
      const balanceA = calculateInstructorBalance(a.id, assignments, allInstructors, period, loads)
      const balanceB = calculateInstructorBalance(b.id, assignments, allInstructors, period, loads)
      return balanceA - balanceB
    })

    return qualified[0]
  }, [needsVideo, clockedInInstructors, selectedMainId, student, assignments, allInstructors, period, loads])
  
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

  const handleAssign = async () => {
    if (!selectedMainId) {
      toast.error('Please select a main instructor')
      return
    }
    
    if (needsVideo && !selectedVideoId) {
      toast.error('Please select a video instructor')
      return
    }
    
    try {
      const mainInstructor = allInstructors.find(i => i.id === selectedMainId)
      const videoInstructor = needsVideo ? allInstructors.find(i => i.id === selectedVideoId) : null
      
      if (!mainInstructor) {
        toast.error('Invalid instructor selection')
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
      toast.error('Failed to assign students', 'Please try again.')
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
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-student-modal-title"
      >
        <div className="border-b border-slate-700 p-6">
          <h2 id="assign-student-modal-title" className="text-2xl font-bold text-white">
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
                const balance = calculateInstructorBalance(instructor.id, assignments, allInstructors, period, loads)
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
                  const balance = calculateInstructorBalance(instructor.id, assignments, allInstructors, period, loads)
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