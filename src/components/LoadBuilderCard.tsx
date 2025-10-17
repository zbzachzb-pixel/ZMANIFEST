// src/components/LoadBuilderCard.tsx
// ✅ COMPLETE FIXED VERSION with proper group removal
// ✅ Fixed race condition in group removal
// ✅ Atomic operations for load updates
// ✅ Proper duplicate checking

'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useUpdateLoad, useDeleteLoad, useGroups } from '@/hooks/useDatabase'
import { useLoadCountdown, isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import { db } from '@/services'
import type { Load, Instructor, LoadSchedulingSettings, CreateQueueStudent, LoadAssignment } from '@/types'

interface LoadBuilderCardProps {
  load: Load
  allLoads: Load[]
  instructors: Instructor[]
  instructorBalances: Map<string, number>
  onDrop: (loadId: string) => void
  onDragStart: (type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string) => void
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
  // ==================== HOOKS ====================
  const { update, loading } = useUpdateLoad()
  const { deleteLoad } = useDeleteLoad()
  const { data: groups } = useGroups()
  
  // ==================== STATE ====================
  const [dragOver, setDragOver] = useState(false)
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<Load['status'] | null>(null)
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [delayMinutes, setDelayMinutes] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, {instructorId: string, videoInstructorId?: string}>>({})
  const [assignLoading, setAssignLoading] = useState(false)
  const [lastMilestone, setLastMilestone] = useState<number | null>(null)
  const [showBreathing, setShowBreathing] = useState(false)
  const hasAutoSelected = useRef(false)
  
  // ==================== VALIDATION ====================
  const validateInstructorForLoad = (instructorId: string): boolean => {
    const availability = isInstructorAvailableForLoad(
      instructorId,
      load.position || 0,
      allLoads,
      loadSchedulingSettings.instructorCycleTime,
      loadSchedulingSettings.minutesBetweenLoads
    )
    
    if (!availability) {
      const instructorLoads = allLoads.filter(l => 
        l.status !== 'completed' && 
        l.assignments?.some(a => 
          a.instructorId === instructorId || 
          a.videoInstructorId === instructorId
        )
      )
      
      if (instructorLoads.length > 0) {
        const highestPosition = Math.max(...instructorLoads.map(l => l.position || 0))
        const loadsToSkip = Math.ceil(loadSchedulingSettings.instructorCycleTime / loadSchedulingSettings.minutesBetweenLoads)
        const nextAvailable = highestPosition + loadsToSkip
        const instructor = instructors.find(i => i.id === instructorId)
        
        alert(`❌ ${instructor?.name || 'Instructor'} not available until Load #${nextAvailable} (needs ${loadSchedulingSettings.instructorCycleTime}min recovery time)`)
      }
      return false
    }
    
    return true
  }
  
  // ==================== COUNTDOWN & METRICS ====================
  const { countdown, isReadyToDepart } = useLoadCountdown(load, loadSchedulingSettings)
  const isActive = countdown !== null
  
  const loadAssignments = load.assignments || []
  const isCompleted = load.status === 'completed'
  
  const statusConfig = {
    building: { label: 'Building', emoji: '🔧', color: 'bg-slate-700', borderClass: 'border-slate-500/50' },
    ready: { label: 'Ready', emoji: '✅', color: 'bg-blue-600', borderClass: 'border-blue-500/50' },
    departed: { label: 'Departed', emoji: '✈️', color: 'bg-green-600', borderClass: 'border-green-500/50' },
    completed: { label: 'Completed', emoji: '🎉', color: 'bg-purple-600', borderClass: 'border-purple-500/50' }
  }
  
  const currentStatus = statusConfig[load.status]
  
  const totalStudents = loadAssignments.length
  const unassignedCount = loadAssignments.filter(a => !a.instructorId).length
  const loadCapacity = load.capacity || 18
  const availableSlots = loadCapacity - totalStudents
  const isOverCapacity = totalStudents > loadCapacity
  
  // Calculate total pay
  const totalPay = useMemo(() => {
    return loadAssignments.reduce((sum, assignment) => {
      let pay = 0
      if (assignment.jumpType === 'tandem') {
        pay = 40 + (assignment.tandemWeightTax || 0) * 20
        if (assignment.tandemHandcam) pay += 30
      } else if (assignment.jumpType === 'aff') {
        pay = assignment.affLevel === 'lower' ? 55 : 45
      }
      if (assignment.hasOutsideVideo) pay += 45
      return sum + pay
    }, 0)
  }, [loadAssignments])
  
  // Available transitions
  const availableTransitions = useMemo(() => {
    const transitions: Load['status'][] = []
    
    switch (load.status) {
      case 'building':
        transitions.push('ready')
        break
      case 'ready':
        transitions.push('building', 'departed')
        break
      case 'departed':
        transitions.push('ready', 'completed')
        break
      case 'completed':
        transitions.push('departed')
        break
    }
    
    return transitions
  }, [load.status])
  
  // ==================== HELPER FUNCTIONS ====================
  
  const getQualifiedInstructors = useCallback((assignment: any) => {
    const qualified = instructors.filter(instructor => {
      if (!instructor.clockedIn) return false
      
      const isAvailable = isInstructorAvailableForLoad(
        instructor.id,
        load.position || 0,
        allLoads,
        loadSchedulingSettings.instructorCycleTime,
        loadSchedulingSettings.minutesBetweenLoads
      )
      
      if (!isAvailable) return false
      
      if (assignment.jumpType === 'tandem' && !instructor.canTandem) return false
      if (assignment.jumpType === 'aff' && !instructor.canAFF) return false
      
      return true
    })
    
    return qualified.sort((a, b) => 
      (instructorBalances.get(a.id) || 0) - (instructorBalances.get(b.id) || 0)
    )
  }, [instructors, load.position, allLoads, loadSchedulingSettings, instructorBalances])
  
  const getVideoInstructors = useCallback(() => {
    return instructors
      .filter(i => i.clockedIn && i.canVideo)
      .sort((a, b) => 
        (instructorBalances.get(a.id) || 0) - (instructorBalances.get(b.id) || 0)
      )
  }, [instructors, instructorBalances])
  
  // ==================== EFFECTS ====================
  useEffect(() => {
    if (!showAssignModal) {
      setAssignmentSelections({})
      hasAutoSelected.current = false
      return
    }
    
    if (hasAutoSelected.current) return
    hasAutoSelected.current = true
    
    const selections: Record<string, {instructorId: string, videoInstructorId?: string}> = {}
    const usedInstructors = new Set<string>()
    const usedVideoInstructors = new Set<string>()
    
    const currentAssignments = load.assignments || []
    
    currentAssignments.forEach(assignment => {
      if (assignment.instructorId) {
        const selection: {instructorId: string, videoInstructorId?: string} = {
          instructorId: assignment.instructorId
        }
        
        // Track already assigned instructors
        usedInstructors.add(assignment.instructorId)
        
        // Only add videoInstructorId if it's a truthy string
        if (assignment.videoInstructorId) {
          selection.videoInstructorId = assignment.videoInstructorId
          usedVideoInstructors.add(assignment.videoInstructorId)
        }
        
        selections[assignment.id] = selection
      } else {
        const qualified = getQualifiedInstructors(assignment)
        
        // Find the first qualified instructor NOT already used in this load
        const availableInstructor = qualified.find(i => !usedInstructors.has(i.id))
        
        if (availableInstructor) {
          const selection: {instructorId: string, videoInstructorId?: string} = {
            instructorId: availableInstructor.id
          }
          
          // Mark this instructor as used
          usedInstructors.add(availableInstructor.id)
          
          if (assignment.hasOutsideVideo) {
            const videoInstructors = getVideoInstructors()
            
            // Find first video instructor NOT already used
            const availableVideoInstructor = videoInstructors.find(
              i => !usedVideoInstructors.has(i.id) && i.id !== availableInstructor.id
            )
            
            if (availableVideoInstructor) {
              selection.videoInstructorId = availableVideoInstructor.id
              usedVideoInstructors.add(availableVideoInstructor.id)
            }
          }
          
          selections[assignment.id] = selection
        } else if (qualified.length > 0) {
          // Fallback: if all qualified instructors are used, still assign one
          // This handles cases where there aren't enough instructors
          const selection: {instructorId: string, videoInstructorId?: string} = {
            instructorId: qualified[0].id
          }
          
          if (assignment.hasOutsideVideo) {
            const videoInstructors = getVideoInstructors()
            if (videoInstructors.length > 0) {
              selection.videoInstructorId = videoInstructors[0].id
            }
          }
          
          selections[assignment.id] = selection
        }
      }
    })
    
    setAssignmentSelections(selections)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAssignModal])
  
  useEffect(() => {
    if (!isActive || countdown === null) {
      setLastMilestone(null)
      setShowBreathing(false)
      return
    }
    
    const minutes = Math.floor(countdown / 60)
    
    if (minutes < 5 && lastMilestone !== 5) {
      setLastMilestone(5)
      setShowBreathing(true)
    } else if (minutes < 10 && minutes >= 5 && lastMilestone !== 10) {
      setLastMilestone(10)
      setShowBreathing(false)
    } else if (minutes >= 10 && lastMilestone !== 15) {
      setLastMilestone(15)
      setShowBreathing(false)
    }
  }, [countdown, isActive, lastMilestone])
  
  const getLoadColors = useCallback(() => {
    if (!isActive || countdown === null) {
      return {
        bg: currentStatus.color,
        border: currentStatus.borderClass,
        glow: ''
      }
    }
    
    const minutes = Math.floor(countdown / 60)
    
    if (minutes >= 10) {
      return {
        bg: 'bg-blue-900/30',
        border: 'border-blue-500',
        glow: showBreathing ? 'shadow-[0_0_30px_rgba(59,130,246,0.6)]' : ''
      }
    } else if (minutes >= 5) {
      return {
        bg: 'bg-orange-900/20',
        border: 'border-orange-500/60',
        glow: showBreathing ? 'shadow-[0_0_30px_rgba(251,146,60,0.6)]' : 'shadow-[0_0_20px_rgba(251,146,60,0.4)]'
      }
    } else {
      return {
        bg: 'bg-red-900/30',
        border: 'border-red-500',
        glow: 'shadow-[0_0_35px_rgba(239,68,68,0.6)] animate-pulse'
      }
    }
  }, [isActive, countdown, currentStatus, showBreathing])

  const colors = getLoadColors()
  
  // ==================== DRAG & DROP ====================
  const handleDragOver = (e: React.DragEvent) => {
    if (isCompleted) return
    e.preventDefault()
    setDragOver(true)
    setDropTarget(load.id)
  }
  
  const handleDragLeave = () => {
    setDragOver(false)
    setDropTarget(null)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    if (isCompleted) return
    e.preventDefault()
    setDragOver(false)
    setDropTarget(null)
    onDrop(load.id)
  }
  
  // ==================== REMOVE FROM LOAD (SINGLE STUDENT) ====================
  const removeFromLoad = async (assignmentId: string) => {
    if (isCompleted) return
    try {
      const assignment = loadAssignments.find(a => a.id === assignmentId)
      if (!assignment) return
      
      // Get current queue to check for duplicates
      const currentQueue = await db.getQueue()
      const existingInQueue = currentQueue.find(
        s => s.studentAccountId === assignment.studentId
      )
      
      // Remove from load first
      const updatedAssignments = loadAssignments.filter(a => a.id !== assignmentId)
      await update(load.id, { assignments: updatedAssignments })
      
      // Add back to queue if not already there
      if (existingInQueue) {
        console.log('⚠️ Student already in queue, updating groupId only')
        if (assignment.groupId && existingInQueue.groupId !== assignment.groupId) {
          await db.updateQueueStudent(existingInQueue.id, {
            groupId: assignment.groupId
          })
        }
      } else {
        const timestamp = assignment.originalQueueTimestamp || 
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        
        const queueStudent: CreateQueueStudent = {
          studentAccountId: assignment.studentId,
          name: assignment.studentName,
          weight: assignment.studentWeight,
          jumpType: assignment.jumpType,
          isRequest: assignment.isRequest,
          tandemWeightTax: assignment.tandemWeightTax,
          tandemHandcam: assignment.tandemHandcam,
          outsideVideo: assignment.hasOutsideVideo,
          affLevel: assignment.affLevel,
          groupId: assignment.groupId
        }
        
        await db.addToQueue(queueStudent, timestamp)
      }
    } catch (error) {
      console.error('Failed to remove from load:', error)
      alert('Failed to remove student from load')
    }
  }
  
  // ==================== REMOVE GROUP FROM LOAD (ATOMIC) ====================
  const removeGroupFromLoad = async (groupAssignments: LoadAssignment[]) => {
    if (isCompleted) return
    
    try {
      console.log('🗑️ Removing group from load:', {
        groupSize: groupAssignments.length,
        students: groupAssignments.map(a => a.studentName)
      })
      
      // Get current queue to check for duplicates
      const currentQueue = await db.getQueue()
      
      // Remove all group assignments from load in ONE atomic operation
      const assignmentIds = groupAssignments.map(a => a.id)
      const updatedAssignments = loadAssignments.filter(
        a => !assignmentIds.includes(a.id)
      )
      
      await update(load.id, { assignments: updatedAssignments })
      console.log('✅ Load updated, all group members removed')
      
      // Now add each student back to queue (checking for duplicates)
      for (const assignment of groupAssignments) {
        const existingInQueue = currentQueue.find(
          s => s.studentAccountId === assignment.studentId
        )
        
        if (existingInQueue) {
          console.log(`⚠️ ${assignment.studentName} already in queue, updating groupId only`)
          if (assignment.groupId && existingInQueue.groupId !== assignment.groupId) {
            await db.updateQueueStudent(existingInQueue.id, {
              groupId: assignment.groupId
            })
          }
        } else {
          const timestamp = assignment.originalQueueTimestamp || 
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          
          const queueStudent: CreateQueueStudent = {
            studentAccountId: assignment.studentId,
            name: assignment.studentName,
            weight: assignment.studentWeight,
            jumpType: assignment.jumpType,
            isRequest: assignment.isRequest,
            tandemWeightTax: assignment.tandemWeightTax,
            tandemHandcam: assignment.tandemHandcam,
            outsideVideo: assignment.hasOutsideVideo,
            affLevel: assignment.affLevel,
            groupId: assignment.groupId
          }
          
          await db.addToQueue(queueStudent, timestamp)
          console.log(`✅ ${assignment.studentName} added back to queue`)
        }
      }
      
      console.log('✅ Group removal complete')
    } catch (error) {
      console.error('Failed to remove group from load:', error)
      alert('Failed to remove group from load')
    }
  }
  
  // ==================== STATUS CHANGES ====================
  const handleStatusChangeRequest = (newStatus: Load['status']) => {
    if (newStatus === 'departed' && load.status === 'ready' && unassignedCount > 0) {
      alert('❌ Cannot mark as departed: All students must have instructors assigned!')
      return
    }
    if (newStatus === 'ready' && unassignedCount > 0) {
      alert('❌ Cannot mark as ready: All students must have instructors assigned!')
      return
    }
    
    if (load.status === 'completed' && newStatus !== 'completed') {
      if (!confirm('⚠️ This load is COMPLETED. Are you sure you want to move it back to "' + newStatus + '"? This should only be done to fix errors.')) {
        return
      }
    }
    
    setStatusChangeConfirm(newStatus)
  }
  
  const confirmStatusChange = async () => {
    if (!statusChangeConfirm) return
    
    try {
      await update(load.id, { status: statusChangeConfirm })
      
      if (statusChangeConfirm === 'ready' && load.status === 'building') {
        const readyLoads = allLoads
          .filter(l => l.status === 'ready')
          .sort((a, b) => (a.position || 0) - (b.position || 0))
        
        if (readyLoads.length === 0) {
          await update(load.id, {
            countdownStartTime: new Date().toISOString()
          } as any)
        }
      } else if (statusChangeConfirm === 'building' && load.status === 'ready') {
        await update(load.id, {
          countdownStartTime: null
        } as any)
      }
      
      setStatusChangeConfirm(null)
    } catch (error) {
      console.error('Failed to change status:', error)
      alert('Failed to change load status')
    }
  }
  
  // ==================== DELAY ====================
  const handleDelay = async () => {
    if (!delayMinutes || delayMinutes < 1) {
      alert('Please enter a valid delay time')
      return
    }
    
    try {
      const delayMs = delayMinutes * 60 * 1000
      
      if ((load as any).countdownStartTime) {
        const currentStartTime = new Date((load as any).countdownStartTime).getTime()
        const newStartTime = new Date(currentStartTime + delayMs).toISOString()
        
        await update(load.id, {
          countdownStartTime: newStartTime,
          delayMinutes: (load.delayMinutes || 0) + delayMinutes
        } as any)
        
        const subsequentReadyLoads = allLoads
          .filter(l => l.status === 'ready' && (l.position || 0) > (load.position || 0))
          .sort((a, b) => (a.position || 0) - (b.position || 0))
        
        for (const subsequentLoad of subsequentReadyLoads) {
          if ((subsequentLoad as any).countdownStartTime) {
            const subCurrentStartTime = new Date((subsequentLoad as any).countdownStartTime).getTime()
            const subNewStartTime = new Date(subCurrentStartTime + delayMs).toISOString()
            
            await update(subsequentLoad.id, {
              countdownStartTime: subNewStartTime
            } as any)
          }
        }
      } else {
        await update(load.id, {
          delayMinutes: (load.delayMinutes || 0) + delayMinutes
        } as any)
      }
      
      await onDelay(load.id, delayMinutes)
      setShowDelayModal(false)
    } catch (error) {
      console.error('Failed to delay load:', error)
      alert('Failed to delay load')
    }
  }
  
  // ==================== DELETE (WITH DUPLICATE FIX) ====================
  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }
    
    try {
      if (isCompleted) {
        if (!confirm('⚠️ WARNING: This load is COMPLETED.\n\nDeleting it will:\n• Remove all completion records\n• Affect instructor stats and earnings\n• Cannot be undone\n\nAre you absolutely sure you want to delete it?')) {
          setShowDeleteConfirm(false)
          return
        }
      }
      
      // Get current queue to check for duplicates
      const currentQueue = await db.getQueue()
      
      for (const assignment of loadAssignments) {
        const existingInQueue = currentQueue.find(
          s => s.studentAccountId === assignment.studentId
        )
        
        if (existingInQueue) {
          console.log('⚠️ Student already in queue during delete, updating groupId only')
          if (assignment.groupId && existingInQueue.groupId !== assignment.groupId) {
            await db.updateQueueStudent(existingInQueue.id, {
              groupId: assignment.groupId
            })
          }
        } else {
          await db.addToQueue({
            studentAccountId: assignment.studentId,
            name: assignment.studentName,
            weight: assignment.studentWeight,
            jumpType: assignment.jumpType,
            isRequest: assignment.isRequest,
            groupId: assignment.groupId,
            ...(assignment.jumpType === 'tandem' && {
              tandemWeightTax: assignment.tandemWeightTax,
              tandemHandcam: assignment.tandemHandcam,
              outsideVideo: assignment.hasOutsideVideo,
            }),
            ...(assignment.jumpType === 'aff' && {
              affLevel: assignment.affLevel,
            }),
          })
        }
      }
      
      await deleteLoad(load.id)
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Failed to delete load:', error)
      alert('Failed to delete load')
    }
  }
  
  // ==================== BULK ASSIGN ====================
  const handleBulkAssign = async () => {
    if (Object.keys(assignmentSelections).length === 0) {
      alert('No instructors selected to assign')
      return
    }
    
    setAssignLoading(true)
    
    try {
      const updatedAssignments = loadAssignments.map(assignment => {
        const selection = assignmentSelections[assignment.id]
        if (selection && !assignment.instructorId) {
          return {
            ...assignment,
            instructorId: selection.instructorId,
            videoInstructorId: selection.videoInstructorId || assignment.videoInstructorId
          }
        }
        return assignment
      })
      
      await update(load.id, { assignments: updatedAssignments })
      setShowAssignModal(false)
      setAssignmentSelections({})
    } catch (error) {
      console.error('Failed to assign instructors:', error)
      alert('Failed to assign instructors')
    } finally {
      setAssignLoading(false)
    }
  }
  
  // ==================== RENDER ====================
  return (
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl shadow-lg transition-all ${
          dragOver && dropTarget === load.id
            ? 'scale-105 ring-4 ring-green-500'
            : ''
        } ${colors.bg} ${colors.glow} border-2 ${colors.border}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white">{load.name}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentStatus.color} text-white`}>
                {currentStatus.emoji} {currentStatus.label}
              </span>
            </div>
          </div>
          
          {/* Countdown Timer */}
          {isActive && countdown !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">⏱️ Departure In:</span>
                <span className={`text-2xl font-bold ${
                  Math.floor(countdown / 60) < 5 ? 'text-red-400' :
                  Math.floor(countdown / 60) < 10 ? 'text-orange-400' :
                  'text-blue-400'
                }`}>
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    Math.floor(countdown / 60) < 5 ? 'bg-red-400' :
                    Math.floor(countdown / 60) < 10 ? 'bg-orange-400' :
                    'bg-blue-400'
                  }`}
                  style={{ 
                    width: `${Math.max(0, Math.min(100, (countdown / (loadSchedulingSettings.minutesBetweenLoads * 60)) * 100))}%` 
                  }}
                />
              </div>
              <div className="text-sm text-white/70 mt-1 font-medium">
                {Math.floor(countdown / 60) < 5 ? '⚠️ PREPARE FOR DEPARTURE' :
                 Math.floor(countdown / 60) < 10 ? '📋 FINAL CHECKS' :
                 '✅ ON SCHEDULE'}
              </div>
            </div>
          )}
        </div>
        
        {/* Students */}
        <div className="space-y-2 mb-3 max-h-96 overflow-y-auto p-4">
          {loadAssignments.length === 0 ? (
            <div className="text-center text-slate-400 py-4">
              Drop students here
            </div>
          ) : (
            (() => {
              // Group by groupId
              const groupedData: { [key: string]: typeof loadAssignments } = {}
              
              loadAssignments.forEach(assignment => {
                const groupKey = assignment.groupId || `individual-${assignment.id}`
                if (!groupedData[groupKey]) {
                  groupedData[groupKey] = []
                }
                groupedData[groupKey].push(assignment)
              })
              
              return (
                <>
                  {Object.entries(groupedData).map(([groupKey, assignments]) => {
                    const isGroup = assignments.length > 1 && assignments[0].groupId
                    const groupName = isGroup ? groups.find(g => g.id === assignments[0].groupId)?.name : null
                    
                    return (
                      <div key={groupKey} className="space-y-1">
                        {/* Group Header */}
                        {isGroup && (
                          <div className="bg-gradient-to-r from-purple-500/30 to-blue-500/30 border-2 border-purple-500/50 rounded-lg p-2">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-bold text-purple-300">
                                👥 {groupName || 'Group'} ({assignments.length} students)
                              </div>
                              {!isCompleted && load.status === 'building' && (
                                <button
                                  onClick={() => removeGroupFromLoad(assignments)}
                                  className="text-red-400 hover:text-red-300 transition-colors text-xs px-2 py-1 bg-red-500/20 rounded"
                                >
                                  ✕ Remove Group
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Students in Group */}
                        {assignments.map(assignment => (
                          <div
                            key={assignment.id}
                            draggable={!isCompleted && load.status === 'building'}
                            onDragStart={() => onDragStart('assignment', assignment.id, load.id)}
                            onDragEnd={onDragEnd}
                            className={`${
                              isGroup 
                                ? 'bg-purple-500/10 border-l-4 border-purple-500/50 ml-2' 
                                : 'bg-white/5 border border-white/10'
                            } rounded-lg p-3 ${
                              !isCompleted && load.status === 'building' ? 'cursor-move hover:bg-white/10' : ''
                            } transition-colors`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-semibold">{assignment.studentName}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    assignment.jumpType === 'tandem' ? 'bg-blue-500/30 text-blue-300' : 'bg-green-500/30 text-green-300'
                                  }`}>
                                    {assignment.jumpType.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-sm text-slate-400">
                                  {assignment.studentWeight} lbs
                                  {assignment.tandemWeightTax ? ` • Tax: ${assignment.tandemWeightTax}` : ''}
                                  {assignment.tandemHandcam ? ' • 📹 Handcam' : ''}
                                  {assignment.hasOutsideVideo ? ' • 🎥 Outside' : ''}
                                  {assignment.affLevel ? ` • ${assignment.affLevel}` : ''}
                                </div>
                                
                                {assignment.instructorId ? (
                                  <div className="text-xs text-green-400 mt-1">
                                    ✓ {instructors.find(i => i.id === assignment.instructorId)?.name || 'Unknown'}
                                    {assignment.videoInstructorId && (
                                      <span className="ml-2">
                                        🎥 {instructors.find(i => i.id === assignment.videoInstructorId)?.name || 'Unknown'}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-xs text-orange-400 mt-1">⚠️ No instructor</div>
                                )}
                              </div>
                              
                              {!isCompleted && load.status === 'building' && !isGroup && (
                                <button
                                  onClick={() => removeFromLoad(assignment.id)}
                                  className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </>
              )
            })()
          )}
        </div>
        
        {/* Metrics */}
        {totalStudents > 0 && (
          <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-center border-t border-white/10 pt-3">
            <div>
              <div className="text-xs text-slate-400">Students</div>
              <div className="font-bold text-white">{totalStudents}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Total Pay</div>
              <div className="font-bold text-green-400">${totalPay}</div>
            </div>
            <div>
              <div className={`text-xs ${isOverCapacity ? 'text-red-400' : 'text-blue-400'}`}>Slots Left</div>
              <div className={`font-bold text-lg ${isOverCapacity ? 'text-red-400' : 'text-blue-400'}`}>
                {Math.max(0, availableSlots)}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 p-4 border-t border-white/10">
          {load.status === 'building' && unassignedCount > 0 && (
            <button
              onClick={() => setShowAssignModal(true)}
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
                  transition === 'ready' ?
                    'bg-blue-500 hover:bg-blue-600 text-white' :
                  transition === 'departed' ?
                    'bg-green-500 hover:bg-green-600 text-white' :
                  transition === 'completed' ?
                    'bg-purple-500 hover:bg-purple-600 text-white' :
                    'bg-slate-600 hover:bg-slate-700 text-white'
                }`}
              >
                {transitionConfig.emoji} {transition === 'building' ? 'Back to Building' : `Mark ${transitionConfig.label}`}
              </button>
            )
          })}
          
          {load.status === 'ready' && (
            <button
              onClick={() => setShowDelayModal(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              ⏰ Delay Departure
            </button>
          )}
          
          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            🗑️ Delete Load
          </button>
        </div>
      </div>

      {/* Modals */}
      {statusChangeConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Status Change</h3>
            <p className="text-slate-300 mb-6">
              Change load status to <span className="font-bold text-blue-400">{statusConfig[statusChangeConfirm].label}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStatusChangeConfirm(null)}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={loading}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Delay Departure</h3>
            <p className="text-slate-300 mb-4">How many minutes should this load be delayed?</p>
            <input
              type="number"
              min="1"
              value={delayMinutes || ''}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white mb-6"
              placeholder="Enter minutes"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelayModal(false)}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelay}
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Delay
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700 p-6">
            <h3 className="text-xl font-bold text-white mb-4">⚠️ Confirm Delete</h3>
            <p className="text-slate-300 mb-6">
              {isCompleted 
                ? '⚠️ This is a COMPLETED load. Are you absolutely sure you want to delete it?'
                : 'Are you sure you want to delete this load? All students will be returned to the queue.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Delete Load
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] border border-slate-700 flex flex-col">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white">Assign Instructors</h3>
              <p className="text-sm text-slate-400 mt-1">
                Auto-selected lowest balance instructors. Adjust as needed.
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadAssignments.map(assignment => {
                const qualified = getQualifiedInstructors(assignment)
                const videoInstructors = getVideoInstructors()
                const selection = assignmentSelections[assignment.id]
                
                return (
                  <div key={assignment.id} className="bg-slate-700 rounded-lg p-4">
                    <div className="font-semibold text-white mb-2">
                      {assignment.studentName} • {assignment.jumpType.toUpperCase()}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-slate-300 block mb-1">Primary Instructor</label>
                        <select
                          value={selection?.instructorId || ''}
                          onChange={(e) => {
                            setAssignmentSelections(prev => ({
                              ...prev,
                              [assignment.id]: {
                                ...prev[assignment.id],
                                instructorId: e.target.value
                              }
                            }))
                          }}
                          className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white"
                        >
                          <option value="">Select instructor...</option>
                          {qualified.map(instructor => (
                            <option key={instructor.id} value={instructor.id}>
                              {instructor.name} (${instructorBalances.get(instructor.id) || 0})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {assignment.hasOutsideVideo && (
                        <div>
                          <label className="text-sm text-slate-300 block mb-1">Video Instructor</label>
                          <select
                            value={selection?.videoInstructorId || ''}
                            onChange={(e) => {
                              setAssignmentSelections(prev => ({
                                ...prev,
                                [assignment.id]: {
                                  ...prev[assignment.id],
                                  videoInstructorId: e.target.value
                                }
                              }))
                            }}
                            className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white"
                          >
                            <option value="">Select video instructor...</option>
                            {videoInstructors.map(instructor => (
                              <option key={instructor.id} value={instructor.id}>
                                {instructor.name} (${instructorBalances.get(instructor.id) || 0})
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
            
            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setAssignmentSelections({})
                }}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={assignLoading}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {assignLoading ? 'Assigning...' : 'Assign Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}