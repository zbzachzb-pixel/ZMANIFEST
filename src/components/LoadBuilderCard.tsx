// src/components/LoadBuilderCard.tsx
// Complete version with timer fix and working delete button

'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useUpdateLoad, useDeleteLoad } from '@/hooks/useDatabase'
import { useLoadCountdown, getInstructorNextAvailableLoad } from '@/hooks/useLoadCountdown'
import { db } from '@/services'
import type { Load, Instructor, LoadSchedulingSettings, CreateQueueStudent } from '@/types'

interface LoadBuilderCardProps {
  load: Load
  allLoads: Load[]
  instructors: Instructor[]
  instructorBalances: Map<string, number>
  onDrop: (loadId: string) => void
  onDragStart: (type: 'student' | 'assignment', id: string, sourceLoadId?: string) => void
  onDragEnd: () => void
  dropTarget: string | null
  setDropTarget: (target: string | null) => void
  loadSchedulingSettings: LoadSchedulingSettings
  onDelay: (loadId: string, minutes: number) => void
}

export function LoadBuilderCard({
  load,
  allLoads,
  instructors,
  instructorBalances,
  onDrop,
  onDragStart,
  onDragEnd,
  dropTarget,
  setDropTarget,
  loadSchedulingSettings,
  onDelay
}: LoadBuilderCardProps) {
  const { update, loading } = useUpdateLoad()
  const { deleteLoad } = useDeleteLoad()
  const [dragOver, setDragOver] = useState(false)
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<Load['status'] | null>(null)
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [delayMinutes, setDelayMinutes] = useState(20)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, {instructorId: string, videoInstructorId?: string}>>({})
  const [assignLoading, setAssignLoading] = useState(false)
  
  // Get countdown info
  const { countdown, formattedTime, isReadyToDepart } = useLoadCountdown(load, loadSchedulingSettings, allLoads)
  
  const loadAssignments = load.assignments || []
  
  // Calculate total people INCLUDING instructors
  const totalPeople = loadAssignments.reduce((sum, assignment) => {
    let count = 2 // Student + 1 instructor (tandem/AFF)
    if (assignment.hasOutsideVideo || assignment.videoInstructorId) {
      count += 1 // Add video instructor
    }
    return sum + count
  }, 0)
  
  const unassignedCount = loadAssignments.filter(a => !a.instructorId).length
  const percentFull = Math.round((totalPeople / load.capacity) * 100)
  const isOverCapacity = totalPeople > load.capacity
  const availableSlots = load.capacity - totalPeople
  const isCompleted = load.status === 'completed'

  // Status config
  const statusConfig = {
    building: {
      label: 'Building',
      icon: '🔨',
      bgClass: 'bg-blue-500/10',
      textClass: 'text-blue-400',
      borderClass: 'border-blue-500/50'
    },
    ready: {
      label: 'Ready',
      icon: '✅',
      bgClass: 'bg-green-500/10',
      textClass: 'text-green-400',
      borderClass: 'border-green-500/50'
    },
    departed: {
      label: 'Departed',
      icon: '✈️',
      bgClass: 'bg-yellow-500/10',
      textClass: 'text-yellow-400',
      borderClass: 'border-yellow-500/50'
    },
    completed: {
      label: 'Completed',
      icon: '🎉',
      bgClass: 'bg-purple-500/10',
      textClass: 'text-purple-400',
      borderClass: 'border-purple-500/50'
    }
  }

  const currentStatus = statusConfig[load.status]

  const handleDragOver = (e: React.DragEvent) => {
    if (isCompleted) return
    if (load.status !== 'building') return
    
    e.preventDefault()
    setDragOver(true)
    setDropTarget(load.id)
  }

  const handleDragLeave = () => {
    setDragOver(false)
    setDropTarget(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    onDrop(load.id)
  }

  const handleStatusChangeRequest = (newStatus: Load['status']) => {
    // Validation checks
    if (newStatus === 'ready' && isOverCapacity) {
      alert('❌ Cannot mark as ready: Load is over capacity!')
      return
    }
    
    if (newStatus === 'departed' && load.status === 'building') {
      alert('❌ Load must be "Ready" before departing')
      return
    }
    
    if (newStatus === 'completed' && load.status !== 'departed') {
      alert('❌ Load must be "Departed" before marking complete')
      return
    }
    
    // Show confirmation modal
    setStatusChangeConfirm(newStatus)
  }
  
  const confirmStatusChange = async () => {
    if (!statusChangeConfirm) return
    
    try {
      const updates: Partial<Load> = { status: statusChangeConfirm }
      
      // ⏱️ TIMER LOGIC: Only start countdown if previous load has departed
      if (statusChangeConfirm === 'ready' && !load.countdownStartTime) {
        const previousLoad = allLoads.find(l => l.position === (load.position || 0) - 1)
        
        if (!previousLoad || previousLoad.status === 'departed' || previousLoad.status === 'completed') {
          updates.countdownStartTime = new Date().toISOString()
        }
      }
      
      if (statusChangeConfirm === 'building' && load.countdownStartTime) {
        updates.countdownStartTime = null
      }
      
      await update(load.id, updates)
      setStatusChangeConfirm(null)
      
      // ⚡ CASCADE LOGIC: When this load departs, start next load's countdown
      if (statusChangeConfirm === 'departed') {
        const nextLoad = allLoads.find(l => l.position === (load.position || 0) + 1)
        
        if (nextLoad && nextLoad.status === 'ready' && !nextLoad.countdownStartTime) {
          await update(nextLoad.id, {
            countdownStartTime: new Date().toISOString()
          })
        }
      }
      
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update status')
    }
  }
  
  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }
  
  const confirmDelete = async () => {
  setShowDeleteConfirm(false)
  
  try {
    // Move all assignments back to queue with PRIORITY before deleting
    for (const assignment of loadAssignments) {
      const queueStudent: CreateQueueStudent = {
        name: assignment.studentName,
        weight: assignment.studentWeight,
        jumpType: assignment.jumpType,
        isRequest: false,
        tandemWeightTax: assignment.tandemWeightTax || 0,
        tandemHandcam: assignment.tandemHandcam || false,
        outsideVideo: assignment.hasOutsideVideo,
        affLevel: assignment.affLevel
      }
      
      // ⭐ KEY CHANGE: Use priority timestamp to put at TOP of queue
      const priorityTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      await db.addToQueue(queueStudent, priorityTimestamp)
    }
    
    // Now delete the load
    await deleteLoad(load.id)
  } catch (error) {
    console.error('Failed to delete load:', error)
    alert('Failed to delete load: ' + (error as Error).message)
  }
}
  
const handleRemoveAssignment = async (assignmentId: string) => {
  try {
    const assignment = loadAssignments.find(a => a.id === assignmentId)
    if (!assignment) return
    
    // Remove assignment from load
    const updatedAssignments = loadAssignments.filter(a => a.id !== assignmentId)
    await update(load.id, { assignments: updatedAssignments })
    
    // Add student back to queue with PRIORITY (older timestamp puts them at top)
    const queueStudent: CreateQueueStudent = {
      name: assignment.studentName,
      weight: assignment.studentWeight,
      jumpType: assignment.jumpType,
      isRequest: false,
      tandemWeightTax: assignment.tandemWeightTax || 0,
      tandemHandcam: assignment.tandemHandcam || false,
      outsideVideo: assignment.hasOutsideVideo,
      affLevel: assignment.affLevel
    }
    
    // ⭐ KEY CHANGE: Use a timestamp from 1 day ago to put student at TOP of queue
    const priorityTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await db.addToQueue(queueStudent, priorityTimestamp)
    
  } catch (error) {
    console.error('Failed to remove assignment:', error)
    alert('Failed to remove assignment')
  }
}
  
  const handleDelay = () => {
    setShowDelayModal(true)
  }
  
  const confirmDelay = () => {
    onDelay(load.id, delayMinutes)
    setShowDelayModal(false)
    setDelayMinutes(20)
  }
  
  const handleAssignInstructors = async () => {
    setAssignLoading(true)
    try {
      const updatedAssignments = loadAssignments.map(assignment => {
        if (!assignment.instructorId && assignmentSelections[assignment.id]) {
          const selection = assignmentSelections[assignment.id]
          const instructor = instructors.find(i => i.id === selection.instructorId)
          const videoInstructor = selection.videoInstructorId 
            ? instructors.find(i => i.id === selection.videoInstructorId)
            : null
          
          return {
            ...assignment,
            instructorId: selection.instructorId,
            instructorName: instructor?.name || '',
            ...(selection.videoInstructorId && {
              videoInstructorId: selection.videoInstructorId,
              videoInstructorName: videoInstructor?.name || ''
            })
          }
        }
        return assignment
      })
      
      await update(load.id, { assignments: updatedAssignments })
      setShowAssignModal(false)
    } catch (error) {
      console.error('Failed to assign instructors:', error)
      alert('Failed to assign instructors: ' + (error as Error).message)
    } finally {
      setAssignLoading(false)
    }
  }
  
  const getQualifiedInstructors = (assignment: typeof loadAssignments[0]) => {
    const clockedIn = instructors.filter(i => i.clockedIn)
    
    console.log('🔍 Filtering instructors for:', assignment.studentName, {
      jumpType: assignment.jumpType,
      weight: assignment.studentWeight,
      totalClockedIn: clockedIn.length,
      allInstructors: instructors.length
    })
    
    const qualified = clockedIn.filter(instructor => {
      // Access properties - handle both old and new naming conventions
      const canTandem = (instructor as any).canTandem ?? (instructor as any).tandem
      const canAFF = (instructor as any).canAFF ?? (instructor as any).aff
      const canVideo = (instructor as any).canVideo ?? (instructor as any).video
      
      console.log(`  Checking ${instructor.name}:`, {
        canTandem,
        canAFF,
        canVideo,
        tandemWeightLimit: instructor.tandemWeightLimit,
        affWeightLimit: instructor.affWeightLimit
      })
      
      if (assignment.jumpType === 'tandem' && !canTandem) {
        console.log(`    ❌ ${instructor.name} - not qualified for tandem`)
        return false
      }
      if (assignment.jumpType === 'aff' && !canAFF) {
        console.log(`    ❌ ${instructor.name} - not qualified for AFF`)
        return false
      }
      
      // Check weight limits
      if (assignment.jumpType === 'tandem' && instructor.tandemWeightLimit) {
        const totalWeight = assignment.studentWeight + (assignment.tandemWeightTax || 0)
        if (totalWeight > instructor.tandemWeightLimit) {
          console.log(`    ❌ ${instructor.name} - weight limit exceeded (${totalWeight} > ${instructor.tandemWeightLimit})`)
          return false
        }
      }
      
      if (assignment.jumpType === 'aff' && instructor.affWeightLimit) {
        if (assignment.studentWeight > instructor.affWeightLimit) {
          console.log(`    ❌ ${instructor.name} - AFF weight limit exceeded`)
          return false
        }
      }
      
      console.log(`    ✅ ${instructor.name} - qualified!`)
      return true
    })
    
    console.log('✅ Total qualified instructors:', qualified.length)
    
    return qualified.sort((a, b) => {
      const balanceA = instructorBalances.get(a.id) || 0
      const balanceB = instructorBalances.get(b.id) || 0
      return balanceA - balanceB
    })
  }
  
  const getVideoInstructors = () => {
    return instructors.filter(i => {
      const canVideo = (i as any).canVideo ?? (i as any).video
      return i.clockedIn && canVideo
    }).sort((a, b) => {
      const balanceA = instructorBalances.get(a.id) || 0
      const balanceB = instructorBalances.get(b.id) || 0
      return balanceA - balanceB
    })
  }
  
  // Auto-select best instructors when modal opens
  const autoSelectInstructors = useMemo(() => {
    if (!showAssignModal) return {}
    
    const selections: Record<string, {instructorId: string, videoInstructorId?: string}> = {}
    
    loadAssignments.filter(a => !a.instructorId).forEach(assignment => {
      const qualifiedInstructors = getQualifiedInstructors(assignment)
      const videoInstructors = getVideoInstructors()
      
      if (qualifiedInstructors.length > 0) {
        selections[assignment.id] = {
          instructorId: qualifiedInstructors[0].id
        }
        
        // Auto-select video instructor if needed
        if (assignment.hasOutsideVideo && videoInstructors.length > 0) {
          selections[assignment.id].videoInstructorId = videoInstructors[0].id
        }
      }
    })
    
    return selections
  }, [showAssignModal, loadAssignments])
  
  // Update assignmentSelections when auto-select changes
// Effect 1: Set selections when modal opens
useEffect(() => {
  if (showAssignModal && Object.keys(autoSelectInstructors).length > 0) {
    setAssignmentSelections(autoSelectInstructors)
  }
}, [showAssignModal, autoSelectInstructors])

// Effect 2: Clear selections when modal closes
useEffect(() => {
  if (!showAssignModal) {
    setAssignmentSelections({})
  }
}, [showAssignModal])
  
  const getAvailableTransitions = () => {
    switch (load.status) {
      case 'building':
        return ['ready']
      case 'ready':
        return ['building', 'departed']
      case 'departed':
        return ['ready', 'completed']
      case 'completed':
        return ['departed']
      default:
        return []
    }
  }
  
  const availableTransitions = getAvailableTransitions()
  
  const instructorAvailability = useMemo(() => {
    const clockedInInstructors = instructors.filter(i => i.clockedIn)
    return clockedInInstructors.map(instructor => {
      const nextAvailable = getInstructorNextAvailableLoad(
        instructor.id, 
        allLoads,
        loadSchedulingSettings.instructorCycleTime,
        loadSchedulingSettings.minutesBetweenLoads
      )
      return {
        instructor,
        nextAvailable,
        isAvailable: nextAvailable === null || (load.position || 0) >= nextAvailable
      }
    })
  }, [instructors, allLoads, load.position, loadSchedulingSettings])
  
  return (
    <>
      <div
        className={`rounded-xl shadow-xl p-6 border-2 transition-all backdrop-blur-lg ${
          isCompleted
            ? 'bg-purple-900/30 border-purple-500/50 opacity-90'
            : dragOver && load.status === 'building'
              ? 'bg-white/20 border-blue-400 scale-105'
              : `bg-white/10 ${currentStatus.borderClass}`
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-white">{load.name}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${currentStatus.bgClass} ${currentStatus.textClass}`}>
                {currentStatus.icon} {currentStatus.label}
              </span>
              {isCompleted && (
                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded font-bold">
                  🔒 LOCKED
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className={`font-semibold ${isOverCapacity ? 'text-red-400' : 'text-slate-400'}`}>
                {totalPeople}/{load.capacity} people ({percentFull}%)
              </div>
              
              <div className="w-full bg-white/10 rounded-full h-2 max-w-[200px]">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isOverCapacity ? 'bg-red-500' : percentFull > 80 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(percentFull, 100)}%` }}
                />
              </div>
            </div>
          </div>
          
          <button
            onClick={handleDelete}
            disabled={isCompleted}
            className={`ml-4 p-2 rounded-lg transition-colors ${
              isCompleted
                ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
            }`}
            title={isCompleted ? 'Cannot delete completed loads' : 'Delete Load'}
          >
            🗑️
          </button>
        </div>

        {/* ⏱️ COUNTDOWN TIMER DISPLAY */}
        {load.status === 'ready' && formattedTime && (
          <div className={`mb-4 p-4 rounded-lg border-2 transition-all ${
            isReadyToDepart 
              ? 'bg-green-500/20 border-green-500 animate-pulse' 
              : countdown && countdown < 60
                ? 'bg-yellow-500/20 border-yellow-500'
                : 'bg-blue-500/20 border-blue-500'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">
                  {isReadyToDepart ? '✅' : countdown && countdown < 60 ? '⚠️' : '⏱️'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-300">
                    {isReadyToDepart ? 'Clear to Depart!' : 'Countdown Timer'}
                  </div>
                  <div className={`text-2xl font-bold ${
                    isReadyToDepart 
                      ? 'text-green-300' 
                      : countdown && countdown < 60
                        ? 'text-yellow-300'
                        : 'text-blue-300'
                  }`}>
                    {formattedTime}
                  </div>
                </div>
              </div>
              
              {isReadyToDepart && (
                <button
                  onClick={() => handleStatusChangeRequest('departed')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  🛫 Mark Departed
                </button>
              )}
            </div>
            
            {!isReadyToDepart && countdown !== null && (
              <div className="mt-3">
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      countdown < 60 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ 
                      width: `${Math.max(0, 100 - (countdown / (loadSchedulingSettings.minutesBetweenLoads * 60)) * 100)}%` 
                    }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1 text-center">
                  {Math.ceil(countdown / 60)} minutes remaining
                </div>
              </div>
            )}
          </div>
        )}

        {load.status === 'ready' && !formattedTime && !countdown && (
          <div className="mb-4 p-4 rounded-lg border-2 bg-slate-700/20 border-slate-600">
            <div className="flex items-center gap-3">
              <div className="text-2xl">⏸️</div>
              <div>
                <div className="text-sm font-semibold text-slate-300">Waiting...</div>
                <div className="text-lg text-slate-400">
                  Previous load must depart first
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assignments Section - Simplified for brevity */}
        <div className="space-y-2 mb-4">
          {loadAssignments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-600 rounded-lg">
              {isCompleted ? 'No assignments on this load' : 'Drop students here'}
            </div>
          ) : (
            loadAssignments.map((assignment) => (
              <div
                key={assignment.id}
                draggable={!isCompleted && load.status === 'building'}
                onDragStart={() => !isCompleted && load.status === 'building' && onDragStart('assignment', assignment.id, load.id)}
                onDragEnd={onDragEnd}
                className={`p-3 rounded-lg border transition-all ${
                  assignment.instructorId
                    ? 'bg-slate-700 border-slate-600'
                    : 'bg-yellow-900/30 border-yellow-600'
                } ${!isCompleted && load.status === 'building' ? 'cursor-move hover:bg-slate-600' : 'cursor-default'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">{assignment.studentName}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        assignment.jumpType === 'tandem' ? 'bg-green-500/20 text-green-300' :
                        assignment.jumpType === 'aff' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {assignment.jumpType.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div className={assignment.instructorId ? 'text-green-400' : 'text-yellow-400'}>
                        👤 TI: {assignment.instructorName || '⚠️ Not assigned'}
                      </div>
                      {assignment.hasOutsideVideo && assignment.videoInstructorName && (
                        <div className="text-purple-400">📹 VI: {assignment.videoInstructorName}</div>
                      )}
                      <div>⚖️ {assignment.studentWeight} lbs</div>
                    </div>
                  </div>
                  
                  {!isCompleted && load.status === 'building' && (
                    <button
                      onClick={() => handleRemoveAssignment(assignment.id)}
                      className="ml-2 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                      title="Remove & Return to Queue"
                    >
                      ↩️
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {loadAssignments.length > 0 && (
          <div className="mb-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-slate-400 mb-1">Students</div>
              <div className="text-lg font-bold text-white">{loadAssignments.length}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Assigned</div>
              <div className="text-lg font-bold text-green-400">
                {loadAssignments.filter(a => a.instructorId).length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Slots Left</div>
              <div className={`text-lg font-bold ${availableSlots < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {Math.max(0, availableSlots)}
              </div>
            </div>
          </div>
        )}

        {/* Status Change Buttons */}
        {!isCompleted && (
          <div className="space-y-2">
            {load.status === 'building' && unassignedCount > 0 && (
              <button
                onClick={() => {
                  console.log('🎯 Assign Instructors button clicked!', { loadId: load.id, unassignedCount })
                  setShowAssignModal(true)
                }}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
              >
                👤 Assign Instructors ({unassignedCount} unassigned)
              </button>
            )}
            
            {availableTransitions.map(transition => {
              const transitionConfig = statusConfig[transition as Load['status']]
              return (
                <button
                  key={transition}
                  onClick={() => handleStatusChangeRequest(transition as Load['status'])}
                  disabled={loading}
                  className={`w-full font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    transition === 'ready' ? 'bg-green-500 hover:bg-green-600 text-white' :
                    transition === 'departed' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                    transition === 'completed' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                    'bg-slate-500 hover:bg-slate-600 text-white'
                  }`}
                >
                  {transitionConfig.icon} {transition === 'building' ? 'Mark Building' : 
                   transition === 'ready' ? 'Mark Ready' :
                   transition === 'departed' ? 'Mark Departed' :
                   'Mark Completed'}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Assign Instructors Modal */}
      {showAssignModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowAssignModal(false)}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border-2 border-purple-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">👤 Assign Instructors - {load.name}</h2>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <p className="text-yellow-300 text-sm">
                  ⚠️ Instructor assignment functionality will be connected to your AssignStudentModal component.
                  This requires accessing clocked-in instructors and their qualifications.
                </p>
              </div>
              
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-white">Unassigned Students:</h3>
                {loadAssignments.filter(a => !a.instructorId).map(assignment => (
                  <div key={assignment.id} className="bg-slate-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-semibold">{assignment.studentName}</div>
                        <div className="text-sm text-slate-400">
                          {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                        </div>
                      </div>
                      <button
                        onClick={() => alert(`This will open instructor picker for ${assignment.studentName}`)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Select Instructor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {statusChangeConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setStatusChangeConfirm(null)}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-blue-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Confirm Status Change</h2>
              
              {/* Warning for reopening completed loads */}
              {load.status === 'completed' && statusChangeConfirm === 'departed' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-300 text-sm mb-2">
                    ⚠️ <strong>WARNING:</strong> This will reopen a completed load!
                  </p>
                  <p className="text-red-300 text-sm">
                    This should only be done if the load was marked completed by mistake.
                  </p>
                </div>
              )}
              
              {/* Warning for unassigned students */}
              {statusChangeConfirm === 'ready' && unassignedCount > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ {unassignedCount} student(s) not assigned to instructors.
                  </p>
                </div>
              )}
              
              <p className="text-slate-300 mb-6">
                Change {load.name} status to <strong className="text-white">{statusChangeConfirm}</strong>?
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStatusChangeConfirm(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delay Modal */}
      {showDelayModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowDelayModal(false)}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-yellow-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">⏱️ Delay Load</h2>
              <p className="text-slate-300 mb-4">
                How many minutes should we delay {load.name}?
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-300 mb-2">Minutes</label>
                <input
                  type="number"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                  min="1"
                  max="120"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDelayModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelay}
                  className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors"
                >
                  Delay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-red-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">🗑️ Delete Load</h2>
              
              {isCompleted && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-300 text-sm">
                    ⚠️ This load is <strong>completed</strong>. Deleting it may affect your records.
                  </p>
                </div>
              )}
              
              <p className="text-slate-300 mb-2">
                Are you sure you want to delete <strong className="text-white">{load.name}</strong>?
              </p>
              
              {loadAssignments.length > 0 && (
                <p className="text-slate-400 text-sm mb-4">
                  {loadAssignments.length} assignment(s) will be moved back to the queue.
                </p>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Instructors Modal */}
      {showAssignModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70]"
          onClick={() => setShowAssignModal(false)}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto border-2 border-purple-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">👤 Assign Instructors - {load.name}</h2>
              
              <div className="space-y-6 mb-6">
                {loadAssignments.filter(a => !a.instructorId).map(assignment => {
                  const qualifiedInstructors = getQualifiedInstructors(assignment)
                  const videoInstructors = getVideoInstructors()
                  const selectedInstructor = assignmentSelections[assignment.id]?.instructorId
                  const selectedVideo = assignmentSelections[assignment.id]?.videoInstructorId
                  
                  return (
                    <div key={assignment.id} className="bg-slate-700 p-4 rounded-lg">
                      <div className="mb-4">
                        <div className="text-white font-semibold text-lg">{assignment.studentName}</div>
                        <div className="text-sm text-slate-400">
                          {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                          {assignment.tandemWeightTax > 0 && ` +${assignment.tandemWeightTax} tax`}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Main Instructor */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Main Instructor *
                            {qualifiedInstructors[0] && (
                              <span className="text-xs font-normal text-green-400 ml-2">
                                ✓ Best: {qualifiedInstructors[0].name} (${instructorBalances.get(qualifiedInstructors[0].id) || 0})
                              </span>
                            )}
                          </label>
                          <select
                            value={selectedInstructor || ''}
                            onChange={(e) => setAssignmentSelections(prev => ({
                              ...prev,
                              [assignment.id]: {
                                ...prev[assignment.id],
                                instructorId: e.target.value
                              }
                            }))}
                            className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="">Select instructor...</option>
                            {qualifiedInstructors.map(instructor => (
                              <option key={instructor.id} value={instructor.id}>
                                {instructor.name} - Balance: ${instructorBalances.get(instructor.id) || 0}
                              </option>
                            ))}
                          </select>
                          {qualifiedInstructors.length === 0 && (
                            <p className="text-xs text-red-400 mt-1">
                              ⚠️ No qualified instructors available
                            </p>
                          )}
                        </div>
                        
                        {/* Video Instructor */}
                        {assignment.hasOutsideVideo && (
                          <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">
                              Video Instructor
                              {videoInstructors[0] && (
                                <span className="text-xs font-normal text-green-400 ml-2">
                                  ✓ Best: {videoInstructors[0].name} (${instructorBalances.get(videoInstructors[0].id) || 0})
                                </span>
                              )}
                            </label>
                            <select
                              value={selectedVideo || ''}
                              onChange={(e) => setAssignmentSelections(prev => ({
                                ...prev,
                                [assignment.id]: {
                                  ...prev[assignment.id],
                                  videoInstructorId: e.target.value
                                }
                              }))}
                              className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            >
                              <option value="">Select video instructor...</option>
                              {videoInstructors.map(instructor => (
                                <option key={instructor.id} value={instructor.id}>
                                  {instructor.name} - Balance: ${instructorBalances.get(instructor.id) || 0}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  disabled={assignLoading}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignInstructors}
                  disabled={assignLoading || Object.keys(assignmentSelections).length === 0}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assignLoading ? 'Assigning...' : 
                   Object.keys(assignmentSelections).length > 0 ? 
                     `✓ Assign ${Object.keys(assignmentSelections).length} Instructor(s)` :
                     'Select Instructors'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}