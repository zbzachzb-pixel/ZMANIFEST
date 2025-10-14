// Save as: src/components/AutoAssignSystem.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useQueue, useLoads, useActiveInstructors, useAssignments, useUpdateLoad } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type { QueueStudent, Load, Instructor, Assignment } from '@/types'

interface AutoAssignSettings {
  delay: number
  skipRequests: boolean
  batchMode: boolean
  batchSize: number
}

const DEFAULT_SETTINGS: AutoAssignSettings = {
  delay: 5,
  skipRequests: true,
  batchMode: false,
  batchSize: 3
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

export function AutoAssignSystem() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AutoAssignSettings>(DEFAULT_SETTINGS)
  const [countdown, setCountdown] = useState(0)
  const [currentStudent, setCurrentStudent] = useState<QueueStudent | null>(null)
  
  const { data: queue } = useQueue()
  const { data: loads } = useLoads()
  const { data: instructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { update } = useUpdateLoad()
  
  const period = getCurrentPeriod()
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoAssignTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Clean up timers
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      if (autoAssignTimeoutRef.current) clearTimeout(autoAssignTimeoutRef.current)
    }
  }, [])
  
  // Auto-assign logic
  useEffect(() => {
    if (!isEnabled || currentStudent) return
    
    const eligibleStudents = queue.filter(s => !settings.skipRequests || !s.isRequest)
    
    if (settings.batchMode) {
      if (eligibleStudents.length >= settings.batchSize) {
        startCountdown(eligibleStudents[0])
      }
    } else {
      if (eligibleStudents.length > 0) {
        startCountdown(eligibleStudents[0])
      }
    }
  }, [isEnabled, queue, currentStudent, settings])
  
  const startCountdown = (student: QueueStudent) => {
    setCurrentStudent(student)
    setCountdown(settings.delay)
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    autoAssignTimeoutRef.current = setTimeout(() => {
      performAutoAssignment(student)
    }, settings.delay * 1000)
  }
  
  const performAutoAssignment = async (student: QueueStudent) => {
    try {
      const clockedIn = instructors.filter(i => i.clockedIn)
      
      const buildingLoads = loads.filter(l => l.status === 'building')
      let targetLoad: Load | null = null
      
      for (const load of buildingLoads) {
        const totalPeople = (load.assignments || []).reduce((sum, a) => {
          let count = 2
          if (a.hasOutsideVideo) count += 1
          return sum + count
        }, 0)
        if (totalPeople + 2 <= load.capacity) {
          targetLoad = load
          break
        }
      }
      
      if (!targetLoad) {
        console.log('No available load, skipping auto-assign')
        cancelCountdown()
        return
      }
      
      const instructorsOnLoad = new Set(
        (targetLoad.assignments || []).flatMap(a => {
          const ids = [a.instructorId]
          if (a.videoInstructorId) ids.push(a.videoInstructorId)
          return ids
        })
      )
      
      const qualifiedInstructors = clockedIn
        .filter(instructor => {
          if (instructorsOnLoad.has(instructor.id)) return false
          if (student.jumpType === 'tandem' && !instructor.tandem) return false
          if (student.jumpType === 'aff' && !instructor.aff) return false
          if (student.jumpType === 'video' && !instructor.video) return false
          if (student.jumpType === 'tandem' && instructor.tandemWeightLimit && student.weight > instructor.tandemWeightLimit) return false
          if (student.jumpType === 'aff' && instructor.affWeightLimit && student.weight > instructor.affWeightLimit) return false
          if (student.jumpType === 'aff' && instructor.affLocked) return false
          return true
        })
        .map(instructor => ({
          instructor,
          balance: calculateBalance(instructor, assignments, period)
        }))
        .sort((a, b) => a.balance - b.balance)
      
      if (qualifiedInstructors.length === 0) {
        console.log('No qualified instructor, skipping')
        cancelCountdown()
        return
      }
      
      const bestInstructor = qualifiedInstructors[0].instructor
      
      let videoInstructor: Instructor | undefined
      if (student.outsideVideo && student.jumpType === 'tandem') {
        const videoInstructors = clockedIn.filter(i => 
          i.video && 
          i.id !== bestInstructor.id &&
          !instructorsOnLoad.has(i.id) &&
          (!i.videoRestricted || 
            (student.weight >= (i.videoMinWeight || 0) && 
             student.weight <= (i.videoMaxWeight || 999)))
        )
        if (videoInstructors.length > 0) {
          videoInstructor = videoInstructors[0]
        }
      }
      
      const newAssignment = {
        id: Date.now().toString(),
        instructorId: bestInstructor.id,
        instructorName: bestInstructor.name,
        studentName: student.name,
        studentWeight: student.weight,
        jumpType: student.jumpType,
        isRequest: student.isRequest,
        ...(student.jumpType === 'tandem' && {
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
        }),
        ...(student.jumpType === 'aff' && {
          affLevel: student.affLevel,
        }),
        ...(videoInstructor && {
          hasOutsideVideo: true,
          videoInstructorId: videoInstructor.id,
          videoInstructorName: videoInstructor.name,
        }),
      }
      
      const updatedAssignments = [...(targetLoad.assignments || []), newAssignment]
      await update(targetLoad.id, { assignments: updatedAssignments })
      await db.removeFromQueue(student.id)
      
      console.log('Auto-assigned:', student.name, 'to', bestInstructor.name)
    } catch (error) {
      console.error('Auto-assignment failed:', error)
    } finally {
      cancelCountdown()
    }
  }
  
  const cancelCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    if (autoAssignTimeoutRef.current) clearTimeout(autoAssignTimeoutRef.current)
    setCurrentStudent(null)
    setCountdown(0)
  }
  
  const handleAssignNow = () => {
    if (currentStudent) {
      if (autoAssignTimeoutRef.current) clearTimeout(autoAssignTimeoutRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      performAutoAssignment(currentStudent)
    }
  }
  
  return (
    <>
      <button
        onClick={() => setIsEnabled(!isEnabled)}
        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
          isEnabled
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        Auto: {isEnabled ? 'ON' : 'OFF'}
      </button>
      
      <button
        onClick={() => setShowSettings(true)}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
      >
        ⚙️
      </button>
      
      {currentStudent && countdown > 0 && (
        <div className="fixed bottom-8 right-8 bg-slate-800 border-2 border-blue-500 rounded-xl shadow-2xl p-6 z-50 w-96">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white mb-2">
              Auto-Assigning Student
            </h3>
            <p className="text-sm text-slate-300">
              <strong>{currentStudent.name}</strong> - {currentStudent.weight}lbs
            </p>
            <p className="text-xs text-slate-400">
              {currentStudent.jumpType.toUpperCase()}
              {currentStudent.isRequest && ' [REQUEST]'}
            </p>
          </div>
          
          <div className="mb-4">
            <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-1000"
                style={{ width: `${(countdown / settings.delay) * 100}%` }}
              />
            </div>
            <p className="text-center text-white font-bold text-2xl mt-2">
              {countdown}s
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={cancelCountdown}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignNow}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Assign Now
            </button>
          </div>
        </div>
      )}
      
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
            <div className="border-b border-slate-700 p-6">
              <h2 className="text-2xl font-bold text-white">Auto-Assignment Settings</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Delay before assignment (seconds)
                </label>
                <input
                  type="number"
                  min="3"
                  max="30"
                  value={settings.delay}
                  onChange={(e) => setSettings({ ...settings, delay: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="skipRequests"
                  checked={settings.skipRequests}
                  onChange={(e) => setSettings({ ...settings, skipRequests: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="skipRequests" className="text-sm font-semibold text-slate-300">
                  Skip requested jumps
                </label>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="batchMode"
                  checked={settings.batchMode}
                  onChange={(e) => setSettings({ ...settings, batchMode: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="batchMode" className="text-sm font-semibold text-slate-300">
                  Wait for multiple students (batch mode)
                </label>
              </div>
              
              {settings.batchMode && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Batch size
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={settings.batchSize}
                    onChange={(e) => setSettings({ ...settings, batchSize: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>
            
            <div className="border-t border-slate-700 p-6 flex gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}