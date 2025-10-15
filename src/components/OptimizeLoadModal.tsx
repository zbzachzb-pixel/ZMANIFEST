// src/components/OptimizeLoadModal.tsx - COMPLETE FIXED VERSION
'use client'

import React, { useState, useMemo } from 'react'
import { useQueue, useActiveInstructors, useAssignments, useUpdateLoad, useLoads } from '@/hooks/useDatabase'
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
  const { data: allLoads } = useLoads()
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
  
  // Get instructors already on ANY load (not just this one)
  const instructorsOnAnyLoad = useMemo(() => {
    const usedMain = new Set<string>()
    const usedVideo = new Set<string>()
    
    allLoads.forEach(otherLoad => {
      if (otherLoad.status === 'completed') return
      
      const assignments = otherLoad.assignments || []
      assignments.forEach(a => {
        if (a.instructorId) {
          usedMain.add(a.instructorId)
        }
        if (a.videoInstructorId) {
          usedVideo.add(a.videoInstructorId)
          usedMain.add(a.videoInstructorId)
        }
      })
    })
    
    return { usedMain, usedVideo }
  }, [allLoads])
  
  // Generate optimization plan
  const optimizationPlan = useMemo((): OptimizationPlan[] => {
    const plan: OptimizationPlan[] = []
    
    const usedInstructors = new Set(instructorsOnAnyLoad.usedMain)
    const usedVideoInstructors = new Set(instructorsOnAnyLoad.usedVideo)
    
    const instructorBalances = new Map<string, number>()
    
    clockedInInstructors.forEach(instructor => {
      instructorBalances.set(instructor.id, calculateBalance(instructor, assignments, period))
    })
    
    console.log('🎯 Starting optimization for', load.name)
    console.log('Instructors already on ANY load:', Array.from(usedInstructors))
    
    const eligibleStudents = queue.filter(student => {
      if (skipRequests && student.isRequest) return false
      return true
    })
    
    for (let i = 0; i < Math.min(maxStudents, eligibleStudents.length); i++) {
      const student = eligibleStudents[i]
      
      console.log(`\n--- Processing student ${i + 1}: ${student.name} ---`)
      
      // Find qualified instructors
      const qualifiedInstructors = clockedInInstructors
        .filter(instructor => {
          if (usedInstructors.has(instructor.id)) {
            console.log(`⏭️  ${instructor.name}: already on another load`)
            return false
          }
          
          // 🔧 CRITICAL FIX: Check BOTH old and new property names
          const canTandem = (instructor as any).canTandem ?? (instructor as any).tandem
          const canAFF = (instructor as any).canAFF ?? (instructor as any).aff
          const canVideo = (instructor as any).canVideo ?? (instructor as any).video
          
          if (student.jumpType === 'tandem' && !canTandem) {
            console.log(`❌ ${instructor.name}: can't do tandem`)
            return false
          }
          if (student.jumpType === 'aff' && !canAFF) {
            console.log(`❌ ${instructor.name}: can't do AFF`)
            return false
          }
          if (student.jumpType === 'video' && !canVideo) {
            console.log(`❌ ${instructor.name}: can't do video`)
            return false
          }
          
          const totalWeight = student.weight + (student.tandemWeightTax || 0)
          if (student.jumpType === 'tandem' && instructor.tandemWeightLimit) {
            if (totalWeight > instructor.tandemWeightLimit) {
              console.log(`❌ ${instructor.name}: weight limit exceeded`)
              return false
            }
          }
          if (student.jumpType === 'aff' && instructor.affWeightLimit) {
            if (student.weight > instructor.affWeightLimit) {
              console.log(`❌ ${instructor.name}: AFF weight limit exceeded`)
              return false
            }
          }
          
          if (student.jumpType === 'aff' && instructor.affLocked) {
            const isTheirStudent = instructor.affStudents?.some(s => s.name === student.name)
            if (!isTheirStudent) {
              console.log(`❌ ${instructor.name}: AFF locked`)
              return false
            }
          }
          
          console.log(`✅ ${instructor.name}: QUALIFIED!`)
          return true
        })
        .sort((a, b) => {
          const balanceA = instructorBalances.get(a.id) || 0
          const balanceB = instructorBalances.get(b.id) || 0
          return balanceA - balanceB
        })
      
      if (qualifiedInstructors.length === 0) {
        console.log(`⚠️  No qualified instructors for ${student.name}`)
        continue
      }
      
      const bestInstructor = qualifiedInstructors[0]
      console.log(`✅ Selected ${bestInstructor.name}`)
      
      usedInstructors.add(bestInstructor.id)
      
      // Find video instructor if needed
      let videoInstructor: Instructor | undefined
      if (student.outsideVideo && student.jumpType === 'tandem') {
        const videoInstructors = clockedInInstructors.filter(i => {
          // 🔧 CRITICAL FIX: Check BOTH old and new property names
          const canVideo = (i as any).canVideo ?? (i as any).video
          
          if (!canVideo) return false
          if (i.id === bestInstructor.id) return false
          if (usedVideoInstructors.has(i.id)) return false
          if (usedInstructors.has(i.id)) return false
          
          if ((i as any).videoRestricted) {
            const combinedWeight = bestInstructor.bodyWeight + student.weight
            if ((i as any).videoMinWeight && combinedWeight < (i as any).videoMinWeight) return false
            if ((i as any).videoMaxWeight && combinedWeight > (i as any).videoMaxWeight) return false
          }
          
          return true
        }).sort((a, b) => {
          const balanceA = instructorBalances.get(a.id) || 0
          const balanceB = instructorBalances.get(b.id) || 0
          return balanceA - balanceB
        })
        
        if (videoInstructors.length > 0) {
          videoInstructor = videoInstructors[0]
          usedVideoInstructors.add(videoInstructor.id)
          usedInstructors.add(videoInstructor.id)
        }
      }
      
      plan.push({ student, instructor: bestInstructor, videoInstructor })
    }
    
    console.log(`\n✅ Optimization complete: ${plan.length} assignments`)
    return plan
  }, [queue, clockedInInstructors, assignments, period, skipRequests, maxStudents, instructorsOnAnyLoad, load.name])
  
  const handleOptimize = async () => {
    try {
      const currentAssignments = load.assignments || []
      const newAssignments = optimizationPlan.map(plan => ({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        studentId: plan.student.id,
        instructorId: plan.instructor.id,
        instructorName: plan.instructor.name,
        studentName: plan.student.name,
        studentWeight: plan.student.weight,
        jumpType: plan.student.jumpType,
        isRequest: plan.student.isRequest,
        tandemWeightTax: plan.student.tandemWeightTax,
        tandemHandcam: plan.student.tandemHandcam,
        hasOutsideVideo: !!plan.videoInstructor,
        videoInstructorId: plan.videoInstructor?.id || null,
        videoInstructorName: plan.videoInstructor?.name,
        affLevel: plan.student.affLevel
      }))
      
      await update(load.id, {
        assignments: [...currentAssignments, ...newAssignments]
      })
      
      for (const plan of optimizationPlan) {
        await db.removeFromQueue(plan.student.id)
      }
      
      onClose()
    } catch (error) {
      console.error('Optimization failed:', error)
      alert('Failed to optimize load. Please try again.')
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border-2 border-purple-500" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">🎯 Optimize Load - {load.name}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Available seats: {availableSeats} • Max students: {maxStudents}
          </p>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipRequests}
                onChange={(e) => setSkipRequests(e.target.checked)}
                className="w-5 h-5 rounded bg-slate-600 border-slate-500 text-purple-500"
              />
              <span className="text-white font-medium">Skip requested jumps</span>
            </label>
            <p className="text-xs text-slate-400 mt-1 ml-7">
              Don't auto-assign students who specifically requested an instructor
            </p>
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
                Assignment Plan ({optimizationPlan.length} students):
              </h3>
              {optimizationPlan.map((plan, index) => (
                <div key={index} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                  <p className="text-white text-sm font-semibold">
                    #{index + 1}: {plan.instructor.name} + {plan.student.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {plan.student.jumpType.toUpperCase()} • {plan.student.weight} lbs
                    {plan.student.isRequest && ' • ⭐ [REQUEST]'}
                    {plan.videoInstructor && ` • 📹 Video: ${plan.videoInstructor.name}`}
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
            {loading ? '⏳ Optimizing...' : `🎯 Optimize (${optimizationPlan.length} students)`}
          </button>
        </div>
      </div>
    </div>
  )
}