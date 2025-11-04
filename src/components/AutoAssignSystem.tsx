// src/components/AutoAssignSystem.tsx
// ✅ CLEANED VERSION - No backwards compatibility code
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useQueue, useLoads, useActiveInstructors, useAssignments, useUpdateLoad, useSettings } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod, calculateInstructorBalance } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import type { QueueStudent, LoadAssignment } from '@/types'


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

export function AutoAssignSystem() {
  const toast = useToast()
  const [isEnabled, setIsEnabled] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AutoAssignSettings>(DEFAULT_SETTINGS)
  const [countdown, setCountdown] = useState(0)
  const [currentStudent, setCurrentStudent] = useState<QueueStudent | null>(null)

  const { data: queue } = useQueue()
  const { data: loads } = useLoads()
  const { data: instructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { data: appSettings } = useSettings()
  const { update } = useUpdateLoad()

  const period = getCurrentPeriod()
  const teamRotation = appSettings?.teamRotation || 'blue'
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
      const firstStudent = eligibleStudents[0]
      if (eligibleStudents.length >= settings.batchSize && firstStudent) {
        startCountdown(firstStudent)
      }
    } else {
      const firstStudent = eligibleStudents[0]
      if (firstStudent) {
        startCountdown(firstStudent)
      }
    }
  }, [queue, isEnabled, currentStudent, settings])
  
  const startCountdown = (student: QueueStudent) => {
    setCurrentStudent(student)
    setCountdown(settings.delay)
    
    // Countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    // Actual assignment after delay
    autoAssignTimeoutRef.current = setTimeout(() => {
      performAutoAssignment(student)
    }, settings.delay * 1000)
  }
  
  const cancelAssignment = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    if (autoAssignTimeoutRef.current) clearTimeout(autoAssignTimeoutRef.current)
    setCountdown(0)
    setCurrentStudent(null)
  }
  
  const performAutoAssignment = async (student: QueueStudent) => {
  try {
    // Find best instructor using centralized balance calculation
    const qualified = instructors.filter(inst => {
      if (!inst.clockedIn) return false
      
      if (student.jumpType === 'tandem' && !inst.canTandem) return false
      if (student.jumpType === 'aff' && !inst.canAFF) return false
      
      return true
    })
    
    if (qualified.length === 0) {
      console.log('No qualified instructors available')
      setCurrentStudent(null)
      return
    }
    
    // Sort by balance using centralized function
    qualified.sort((a, b) => {
      const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period, loads, teamRotation)
      const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period, loads, teamRotation)
      return balanceA - balanceB
    })

    const bestInstructor = qualified[0]
    if (!bestInstructor) {
      console.log('No best instructor found')
      setCurrentStudent(null)
      return
    }

    // Find available load
    const availableLoad = loads.find(load => {
      const usedSeats = (load.assignments || []).reduce((sum, a) => {
        if (a.jumpType === 'tandem') return sum + 2
        if (a.jumpType === 'aff') return sum + 2
        return sum + 1
      }, 0)
      return usedSeats < (load.capacity || 18)
    })
    
    if (!availableLoad) {
      console.log('No available loads')
      setCurrentStudent(null)
      return
    }
    
    // Create assignment - USE bestInstructor directly
    const newAssignment: LoadAssignment = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      studentId: student.id,
      instructorId: bestInstructor.id,
      instructorName: bestInstructor.name,
      studentName: student.name,
      studentWeight: student.weight,
      jumpType: student.jumpType,
      isRequest: student.isRequest,
      tandemWeightTax: student.tandemWeightTax,
      tandemHandcam: student.tandemHandcam,
      affLevel: student.affLevel,
      hasOutsideVideo: false,
      videoInstructorId: null,
    }
    
    // Update load
    await update(availableLoad.id, {
      assignments: [...(availableLoad.assignments || []), newAssignment]
    })
    
    // Remove from queue
    await db.removeFromQueue(student.id)
    
    console.log(`✅ Auto-assigned ${student.name} to ${bestInstructor.name}`)
    setCurrentStudent(null)
  } catch (error) {
    console.error('Auto-assignment failed:', error)
    toast.error('Auto-assignment failed', 'Could not find available instructor.')
    setCurrentStudent(null)
  }
}
  
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="bg-slate-800/95 backdrop-blur-lg border border-slate-700 rounded-xl shadow-2xl p-4 min-w-[280px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white">Auto-Assign</h3>
          <button
            onClick={() => setShowSettings(true)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ⚙️
          </button>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`w-full font-bold py-2 px-4 rounded-lg transition-colors ${
              isEnabled
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isEnabled ? '🛑 Stop Auto-Assign' : '▶️ Start Auto-Assign'}
          </button>
          
          {currentStudent && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-white font-semibold mb-1">{currentStudent.name}</div>
              <div className="text-sm text-slate-300">
                Assigning in {countdown}s...
              </div>
              <button
                onClick={cancelAssignment}
                className="mt-2 w-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-400 space-y-1">
          <div>Delay: {settings.delay}s</div>
          <div>Skip Requests: {settings.skipRequests ? 'Yes' : 'No'}</div>
          {settings.batchMode && <div>Batch: {settings.batchSize}</div>}
        </div>
      </div>
      
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
                  Batch mode (wait for multiple students)
                </label>
              </div>
              
              {settings.batchMode && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Batch Size
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
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}