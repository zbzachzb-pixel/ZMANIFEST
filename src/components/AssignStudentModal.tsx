'use client'

import React, { useState, useMemo } from 'react'
import { useActiveInstructors, useAssignments, useCreateAssignment } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type { QueueStudent, Instructor, Assignment } from '@/types'

interface AssignStudentModalProps {
  students: QueueStudent[]
  onClose: () => void
  onSuccess: () => void
}

function calculateBalance(instructor: Instructor, assignments: Assignment[], period: any) {
  let balance = 0
  
  for (const assignment of assignments) {
    const assignmentDate = new Date(assignment.timestamp)
    if (assignmentDate < period.start || assignmentDate > period.end) continue
    if (assignment.isRequest) continue
    
    let pay = 0
    if (!assignment.isMissedJump) {
      if (assignment.jumpType === 'tandem') {
        pay = 40 + (assignment.tandemWeightTax || 0) * 20
        if (assignment.tandemHandcam) pay += 30
      } else if (assignment.jumpType === 'aff') {
        pay = assignment.affLevel === 'lower' ? 55 : 45
      } else if (assignment.jumpType === 'video') {
        pay = 45
      }
    }
    
    if (assignment.instructorId === instructor.id) {
      balance += pay
    }
    if (assignment.videoInstructorId === instructor.id && !assignment.isMissedJump) {
      balance += 45
    }
  }
  
  return balance
}

export function AssignStudentModal({ students, onClose, onSuccess }: AssignStudentModalProps) {
  const { data: allInstructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { create, loading } = useCreateAssignment()
  
  const [selectedMainId, setSelectedMainId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  
  const period = getCurrentPeriod()
  const clockedInInstructors = allInstructors.filter(i => i.clockedIn)
  
  const needsVideo = students.some(s => s.outsideVideo)
  const maxWeight = Math.max(...students.map(s => s.weight))
  const needsTandem = students.some(s => s.jumpType === 'tandem')
  const needsAFF = students.some(s => s.jumpType === 'aff')
  
  const suggestedMain = useMemo(() => {
    const qualified = clockedInInstructors.filter(instructor => {
      if (needsTandem && !instructor.tandem) return false
      if (needsAFF && !instructor.aff) return false
      
      if (needsTandem && instructor.tandemWeightLimit && maxWeight > instructor.tandemWeightLimit) return false
      if (needsAFF && instructor.affWeightLimit && maxWeight > instructor.affWeightLimit) return false
      
      if (needsAFF && instructor.affLocked) return false
      
      return true
    })
    
    qualified.sort((a, b) => {
      const balanceA = calculateBalance(a, assignments, period)
      const balanceB = calculateBalance(b, assignments, period)
      return balanceA - balanceB
    })
    
    return qualified[0] || null
  }, [clockedInInstructors, assignments, needsTandem, needsAFF, maxWeight, period])
  
  const suggestedVideo = useMemo(() => {
    if (!needsVideo) return null
    
    const qualified = clockedInInstructors.filter(instructor => {
      if (!instructor.video) return false
      if (selectedMainId && instructor.id === selectedMainId) return false
      
      if (instructor.videoRestricted && selectedMainId) {
        const mainInstructor = allInstructors.find(i => i.id === selectedMainId)
        if (mainInstructor) {
          const student = students[0]
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
  }, [needsVideo, clockedInInstructors, selectedMainId, allInstructors, students, assignments, period])
  
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full border border-white/20 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Assign Students to Instructor</h2>
          
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-2">Selected {students.length} student(s):</h3>
            <div className="space-y-1">
              {students.map(student => (
                <div key={student.id} className="text-sm text-slate-300">
                  • {student.name} ({student.jumpType.toUpperCase()}
                  {student.jumpType === 'aff' && ` - ${student.affLevel}`}
                  {student.outsideVideo && ' + Video'}
                  , {student.weight} lbs)
                </div>
              ))}
            </div>
          </div>
          
          {suggestedMain ? (
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-6">
              <h3 className="text-white font-semibold mb-2">✅ Suggested Main Instructor:</h3>
              <p className="text-slate-300">
                <strong>{suggestedMain.name}</strong>
                <br />
                <span className="text-sm">Balance: ${calculateBalance(suggestedMain, assignments, period)} (Lowest available)</span>
              </p>
            </div>
          ) : (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <h3 className="text-white font-semibold mb-2">⚠️ No Qualified Instructor Available</h3>
              <p className="text-sm text-slate-300">
                No clocked-in instructor meets the requirements for this assignment.
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
              <option value="">Select instructor...</option>
              {clockedInInstructors.map(instructor => {
                const balance = calculateBalance(instructor, assignments, period)
                const isSuggested = suggestedMain?.id === instructor.id
                return (
                  <option key={instructor.id} value={instructor.id}>
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
                <option value="">Select video instructor...</option>
                {clockedInInstructors
                  .filter(i => i.video && i.id !== selectedMainId)
                  .map(instructor => {
                    const balance = calculateBalance(instructor, assignments, period)
                    const isSuggested = suggestedVideo?.id === instructor.id
                    return (
                      <option key={instructor.id} value={instructor.id}>
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