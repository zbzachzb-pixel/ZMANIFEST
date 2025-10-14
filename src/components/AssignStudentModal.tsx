'use client'

import React, { useState, useMemo } from 'react'
import { useInstructors, useAssignments, useCreateAssignment } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type { QueueStudent, Instructor, Assignment, Period } from '@/types'

interface AssignStudentModalProps {
  students: QueueStudent[]
  onClose: () => void
  onSuccess: () => void
}

import { calculateInstructorBalance } from '@/lib/utils'

export function AssignStudentModal({ students, onClose, onSuccess }: AssignStudentModalProps) {
  const { data: allInstructors } = useInstructors()
  const { data: assignments } = useAssignments()
  const { create, loading } = useCreateAssignment()
  
  const [selectedMainId, setSelectedMainId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  
  const period = getCurrentPeriod()
  const clockedInInstructors = allInstructors.filter(i => !i.archived && i.clockedIn)
  
  const { data: instructors } = useInstructors()
  const student = students[0]
  const needsTandem = student.jumpType === 'tandem'
  const needsAFF = student.jumpType === 'aff'
  const needsVideo = needsTandem && student.outsideVideo
  const maxWeight = student.weight + (student.tandemWeightTax || 0)
  
  const suggestedMain = useMemo(() => {
  const qualified = clockedInInstructors.filter(instructor => {
    // ✅ FIXED: Use correct property names
    if (needsTandem && !instructor.canTandem) return false
    if (needsAFF && !instructor.canAFF) return false
    
    if (needsTandem && instructor.tandemWeightLimit && maxWeight > instructor.tandemWeightLimit) {
      return false
    }
    
    if (needsAFF && instructor.affWeightLimit && student.weight > instructor.affWeightLimit) {
      return false
    }
    
    if (needsAFF && instructor.affLocked) {
      const hasThisStudent = instructor.affStudents?.some(s => s.studentId === student.id)
      if (!hasThisStudent) return false
    }
    
    return true
  })
  
  qualified.sort((a, b) => {
    const balanceA = calculateBalance(a, assignments, period)
    const balanceB = calculateBalance(b, assignments, period)
    return balanceA - balanceB
  })
  
  return qualified[0] || null
}, [clockedInInstructors, assignments, needsTandem, needsAFF, maxWeight, period, student])

// Also find the video instructor section around line 60:
const suggestedVideo = useMemo(() => {
  if (!needsVideo) return null
  
  const qualified = clockedInInstructors.filter(instructor => {
    // ✅ FIXED: Use correct property name
    if (!instructor.canVideo) return false
    if (selectedMainId && instructor.id === selectedMainId) return false
    
    if (instructor.videoRestricted && selectedMainId) {
      const mainInstructor = allInstructors.find(i => i.id === selectedMainId)
      if (mainInstructor) {
        const combinedWeight = mainInstructor.bodyWeight + student.weight
        
        if (instructor.videoMinWeight && combinedWeight < instructor.videoMinWeight) return false
        if (instructor.videoMaxWeight && combinedWeight > instructor.videoMaxWeight) return false
      }
    }
    
    return true
  })
  
  qualified.sort((a, b) => {
    const balanceA = calculateBalance(a, assignments, period)
    const balanceB = calculateBalance(b, assignments, period)
    return balanceA - balanceB
  })
  
  return qualified[0] || null
}, [needsVideo, clockedInInstructors, selectedMainId, allInstructors, student, assignments, period])
  
  React.useEffect(() => {
    if (suggestedMain && !selectedMainId) {
      setSelectedMainId(suggestedMain.id)
    }
  }, [suggestedMain, selectedMainId])
  
  React.useEffect(() => {
    if (suggestedVideo && !selectedVideoId) {
      setSelectedVideoId(suggestedVideo.id)
    }
  }, [suggestedVideo, selectedVideoId])
  
  const handleSubmit = async () => {
    if (!selectedMainId) {
      alert('Please select a main instructor')
      return
    }
    
    if (needsVideo && !selectedVideoId) {
      alert('Please select a video instructor')
      return
    }
    
    try {
      for (const student of students) {
        const assignmentData: any = {
          instructorId: selectedMainId,
          name: student.name,
          weight: student.weight,
          jumpType: student.jumpType,
          isRequest: student.isRequest || false,
        }
        
        if (student.jumpType === 'tandem') {
          assignmentData.tandemWeightTax = student.tandemWeightTax || 0
          assignmentData.tandemHandcam = student.tandemHandcam || false
          
          if (student.outsideVideo && selectedVideoId) {
            assignmentData.hasOutsideVideo = true
            assignmentData.videoInstructorId = selectedVideoId
          }
        } else if (student.jumpType === 'aff') {
          assignmentData.affLevel = student.affLevel || 'lower'
          
          const instructor = allInstructors.find(i => i.id === selectedMainId)
          if (instructor) {
            const updatedAffStudents = [
              ...(instructor.affStudents || []),
              {
                name: student.name,
                startTime: new Date().toISOString(),
                studentId: student.id
              }
            ]
            
            await db.updateInstructor(selectedMainId, {
              affLocked: true,
              affStudents: updatedAffStudents
            })
          }
        }
        
        await create(assignmentData)
        await db.removeFromQueue(student.id)
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to assign students:', error)
      alert('Failed to assign students. Please try again.')
    }
  }
  
  const selectedMain = allInstructors.find(i => i.id === selectedMainId)
  const mainBalance = selectedMain ? calculateBalance(selectedMain, assignments, period) : 0
  
  const selectedVideo = allInstructors.find(i => i.id === selectedVideoId)
  const videoBalance = selectedVideo ? calculateBalance(selectedVideo, assignments, period) : 0
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              Assign Student{students.length > 1 ? 's' : ''}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-6 bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">Students to Assign:</h3>
            <ul className="space-y-1">
              {students.map(s => (
                <li key={s.id} className="text-slate-300 text-sm">
                  • {s.name} ({s.weight} lbs, {s.jumpType.toUpperCase()})
                  {s.outsideVideo && ' + Video'}
                  {s.isRequest && ' - REQUEST'}
                </li>
              ))}
            </ul>
          </div>
          
          {suggestedMain && (
            <div className="mb-6 bg-green-500/20 border border-green-500/30 rounded-lg p-4">
              <p className="text-slate-300 text-sm">
                ✅ Suggested: <strong className="text-white">{suggestedMain.name}</strong> (Balance: ${calculateBalance(suggestedMain, assignments, period)})
              </p>
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Main Instructor
            </label>
            <select
              value={selectedMainId}
              onChange={(e) => setSelectedMainId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option key="placeholder-main" value="">Select instructor...</option>
              {clockedInInstructors.map((instructor, index) => {
                const balance = calculateInstructorBalance(instructor.id, assignments, instructors, period)
                const isSuggested = suggestedMain?.id === instructor.id
                return (
                  <option key={`main-${instructor.id || index}`} value={instructor.id}>
                    {instructor.name} - Balance: ${balance}{isSuggested ? ' ⭐ SUGGESTED' : ''}
                  </option>
                )
              })}
            </select>
            {selectedMain && (
              <p className="text-xs text-slate-400 mt-1">
                Current Balance: ${mainBalance}
              </p>
            )}
          </div>
          
          {needsVideo && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Video Instructor (Required)
              </label>
              {suggestedVideo && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-3 text-sm">
                  <p className="text-slate-300">
                    ✅ Suggested: <strong className="text-white">{suggestedVideo.name}</strong> (Balance: ${calculateBalance(suggestedVideo, assignments, period)})
                  </p>
                </div>
              )}
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option key="placeholder-video" value="">Select video instructor...</option>
                {clockedInInstructors
                  .filter(i => i.video && i.id !== selectedMainId)
                  .map((instructor, index) => {
                    const balance = calculateInstructorBalance(instructor.id, assignments, instructors, period)
                    const isSuggested = suggestedVideo?.id === instructor.id
                    return (
                      <option key={`video-${instructor.id || index}`} value={instructor.id}>
                        {instructor.name} - Balance: ${balance}{isSuggested ? ' ⭐ SUGGESTED' : ''}
                      </option>
                    )
                  })}
              </select>
              {selectedVideo && (
                <p className="text-xs text-slate-400 mt-1">
                  Current Balance: ${videoBalance}
                </p>
              )}
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedMainId || (needsVideo && !selectedVideoId)}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Assigning...' : `Assign ${students.length} Student${students.length > 1 ? 's' : ''}`}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}