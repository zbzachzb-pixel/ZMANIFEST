// src/components/OptimizeLoadModal.tsx
'use client'

import React, { useState, useMemo } from 'react'
import { useQueue, useActiveInstructors, useAssignments, useUpdateLoad } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type { Load, QueueStudent, Instructor, Assignment } from '@/types'

interface OptimizeLoadModalProps {
  load: Load
  onClose: () => void
}

interface OptimizationPlan {
  student: QueueStudent
  instructor: Instructor
  videoInstructor?: Instructor
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

export function OptimizeLoadModal({ load, onClose }: OptimizeLoadModalProps) {
  const { data: queue } = useQueue()
  const { data: allInstructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { update, loading } = useUpdateLoad()
  const [skipRequests, setSkipRequests] = useState(true)
  
  const period = getCurrentPeriod()
  const clockedInInstructors = allInstructors.filter(i => i.clockedIn)
  
  // Calculate available seats
  const totalPeople = (load.assignments || []).reduce((sum, a) => {
    let count = 2
    if (a.hasOutsideVideo) count += 1
    return sum + count
  }, 0)
  const availableSeats = load.capacity - totalPeople
  const maxStudents = Math.floor(availableSeats / 2)
  
  // Get instructors already on this load
  const instructorsOnLoad = new Set(
    (load.assignments || []).flatMap(a => {
      const ids = [a.instructorId]
      if (a.videoInstructorId) ids.push(a.videoInstructorId)
      return ids
    })
  )
  
  // Generate optimization plan
  const optimizationPlan = useMemo((): OptimizationPlan[] => {
    const plan: OptimizationPlan[] = []
    const usedInstructors = new Set(instructorsOnLoad)
    const instructorBalances = new Map<string, number>()
    
    // Calculate initial balances
    clockedInInstructors.forEach(instructor => {
      instructorBalances.set(instructor.id, calculateBalance(instructor, assignments, period))
    })
    
    // Filter queue
    const eligibleStudents = queue.filter(student => {
      if (skipRequests && student.isRequest) return false
      return true
    })
    
    for (let i = 0; i < Math.min(maxStudents, eligibleStudents.length); i++) {
      const student = eligibleStudents[i]
      
      // Find qualified instructors
      const qualifiedInstructors = clockedInInstructors
        .filter(instructor => {
          // Check if already used
          if (usedInstructors.has(instructor.id)) return false
          
          // ✅ FIXED: Check department using correct property names
          if (student.jumpType === 'tandem' && !instructor.canTandem) return false
          if (student.jumpType === 'aff' && !instructor.canAFF) return false
          if (student.jumpType === 'video' && !instructor.canVideo) return false
          
          // Check weight limits
          if (student.jumpType === 'tandem' && instructor.tandemWeightLimit) {
            if (student.weight > instructor.tandemWeightLimit) return false
          }
          if (student.jumpType === 'aff' && instructor.affWeightLimit) {
            if (student.weight > instructor.affWeightLimit) return false
          }
          
          // Check AFF locked
          if (student.jumpType === 'aff' && instructor.affLocked) return false
          
          return true
        })
        .sort((a, b) => {
          const balanceA = instructorBalances.get(a.id) || 0
          const balanceB = instructorBalances.get(b.id) || 0
          return balanceA - balanceB
        })
      
      if (qualifiedInstructors.length === 0) continue
      
      const bestInstructor = qualifiedInstructors[0]
      usedInstructors.add(bestInstructor.id)
      
      // Find video instructor if needed
      let videoInstructor: Instructor | undefined
      if (student.outsideVideo && student.jumpType === 'tandem') {
        // ✅ FIXED: Use correct property name
        const videoInstructors = clockedInInstructors.filter(i => 
          i.canVideo && 
          i.id !== bestInstructor.id &&
          !usedInstructors.has(i.id) &&
          (!i.videoRestricted || 
            (student.weight >= (i.videoMinWeight || 0) && 
             student.weight <= (i.videoMaxWeight || 999)))
        )
        
        if (videoInstructors.length > 0) {
          videoInstructor = videoInstructors[0]
          usedInstructors.add(videoInstructor.id)
        }
      }
      
      plan.push({ student, instructor: bestInstructor, videoInstructor })
    }
    
    return plan
  }, [queue, clockedInInstructors, assignments, period, maxStudents, skipRequests, instructorsOnLoad])
  
  const handleOptimize = async () => {
    if (optimizationPlan.length === 0) {
      alert('No students can be assigned')
      return
    }
    
    if (!confirm(`Assign ${optimizationPlan.length} student(s) to this load?`)) {
      return
    }
    
    try {
      const newAssignments = optimizationPlan.map((plan, index) => ({
        id: `${Date.now()}_${index}`,
        studentId: plan.student.id,
        instructorId: plan.instructor.id,
        instructorName: plan.instructor.name,
        studentName: plan.student.name,
        studentWeight: plan.student.weight,
        jumpType: plan.student.jumpType,
        isRequest: plan.student.isRequest,
        ...(plan.student.jumpType === 'tandem' && {
          tandemWeightTax: plan.student.tandemWeightTax,
          tandemHandcam: plan.student.tandemHandcam,
        }),
        ...(plan.student.jumpType === 'aff' && {
          affLevel: plan.student.affLevel,
        }),
        ...(plan.videoInstructor && {
          hasOutsideVideo: true,
          videoInstructorId: plan.videoInstructor.id,
          videoInstructorName: plan.videoInstructor.name,
        }),
      }))
      
      // Update load
      const updatedAssignments = [...(load.assignments || []), ...newAssignments]
      await update(load.id, { assignments: updatedAssignments })
      
      // Remove students from queue
      await Promise.all(
        optimizationPlan.map(plan => db.removeFromQueue(plan.student.id))
      )
      
      onClose()
    } catch (error) {
      console.error('Failed to optimize load:', error)
      alert('Failed to optimize load. Please try again.')
    }
  }
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">
                🎯 Optimize {load.name}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Automatically assign students using best available instructors
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-slate-300">
              <strong className="text-white">Available:</strong> {availableSeats} seats ({maxStudents} students max)
            </p>
            <p className="text-sm text-slate-300">
              <strong className="text-white">In Queue:</strong> {queue.length} students
            </p>
            <p className="text-sm text-slate-300">
              <strong className="text-white">Can Assign:</strong> {optimizationPlan.length} students
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="skipRequests"
              checked={skipRequests}
              onChange={(e) => setSkipRequests(e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="skipRequests" className="text-sm font-semibold text-slate-300">
              Skip requested jumps (assign only regular students)
            </label>
          </div>
          
          {optimizationPlan.length === 0 ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
              <p className="text-red-400 font-semibold">No students can be assigned</p>
              <p className="text-sm text-slate-400 mt-1">
                Check if there are students in queue and qualified instructors available
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Assignment Plan:
              </h3>
              {optimizationPlan.map((plan, index) => (
                <div key={index} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                  <p className="text-white text-sm font-semibold">
                    #{index + 1}: {plan.instructor.name} + {plan.student.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {plan.student.jumpType.toUpperCase()} • {plan.student.weight} lbs
                    {plan.student.isRequest && ' • [REQUEST]'}
                    {plan.videoInstructor && ` • 📹 ${plan.videoInstructor.name}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="border-t border-slate-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleOptimize}
            disabled={loading || optimizationPlan.length === 0}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Optimizing...' : `🎯 Optimize (${optimizationPlan.length} students)`}
          </button>
        </div>
      </div>
    </div>
  )
}