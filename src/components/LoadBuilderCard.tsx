// src/components/LoadBuilderCard.tsx
// ✅ BUGS 1-6 FIXED VERSION + CASCADING TIMER FIX + BIDIRECTIONAL CALL CHANGES
// ✅ Bug #1: Assign/Edit buttons for ready state
// ✅ Bug #2: Can swap instructors in edit mode
// ✅ Bug #3: Save changes actually update
// ✅ Bug #4: Videographers checked for back-to-back loads
// ✅ Bug #5: Slots counting total people, not just students
// ✅ Bug #6: Video instructor dropdown excludes primary instructor
// ✅ FIXED: Cascading timer system for ready loads
// ✅ FIXED: Change Call allows adding or removing time with cascading

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
  const [showEditModal, setShowEditModal] = useState(false)
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, {
    instructorId: string
    videoInstructorId?: string
    isRequest: boolean
  }>>({})
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
  
  const totalPeople = loadAssignments.reduce((sum, assignment) => {
    let count = 2 // Student + Instructor
    if (assignment.hasOutsideVideo) count += 1 // + Video Instructor
    return sum + count
  }, 0)
  const availableSlots = loadCapacity - totalPeople
  const isOverCapacity = totalPeople > loadCapacity
  
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
      .filter(i => {
        if (!i.clockedIn || !i.canVideo) return false
        
        const isAvailable = isInstructorAvailableForLoad(
          i.id,
          load.position || 0,
          allLoads,
          loadSchedulingSettings.instructorCycleTime,
          loadSchedulingSettings.minutesBetweenLoads
        )
        
        return isAvailable
      })
      .sort((a, b) => 
        (instructorBalances.get(a.id) || 0) - (instructorBalances.get(b.id) || 0)
      )
  }, [instructors, load.position, allLoads, loadSchedulingSettings, instructorBalances])
  
  // ==================== EFFECTS ====================
  
  // Breathing animation for countdown milestones
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
  
  // Get dynamic load colors based on status and countdown
  const getLoadColors = useCallback(() => {
    if (load.status === 'building') {
      return {
        bg: 'bg-slate-700',
        border: 'border-slate-500/50',
        glow: ''
      }
    }
    
    if (load.status === 'completed') {
      return {
        bg: 'bg-purple-600',
        border: 'border-purple-500/50',
        glow: ''
      }
    }
    
    if (load.status === 'departed') {
      return {
        bg: 'bg-green-900/30',
        border: 'border-green-500/60',
        glow: ''
      }
    }
    
    if (!isActive || countdown === null) {
      return {
        bg: 'bg-blue-600',
        border: 'border-blue-500/50',
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
  }, [load.status, isActive, countdown, showBreathing])

  const colors = getLoadColors()
  
  useEffect(() => {
  if (!showAssignModal) {
    setAssignmentSelections({})
    hasAutoSelected.current = false
    return
  }
  
  if (hasAutoSelected.current) return
  hasAutoSelected.current = true
  
  console.log('🎯 AUTO-SELECTION STARTING', {
    totalAssignments: (load.assignments || []).length,
    showEditModal
  })
  
  const selections: Record<string, {instructorId: string, videoInstructorId?: string, isRequest: boolean}> = {}
  const usedInstructors = new Set<string>()
  const usedVideoInstructors = new Set<string>()
  
  const shouldTrackAsUsed = !showEditModal
  
  const currentAssignments = load.assignments || []
  
  // ✅ STEP 1: Validate and keep existing PRIMARY instructors if available
  currentAssignments.forEach(assignment => {
    if (assignment.instructorId) {
      const isInstructorAvailable = isInstructorAvailableForLoad(
        assignment.instructorId,
        load.position || 0,
        allLoads,
        loadSchedulingSettings.instructorCycleTime,
        loadSchedulingSettings.minutesBetweenLoads
      )
      
      console.log(`📋 Step 1 - ${assignment.studentName}: existing instructor ${assignment.instructorId}`, {
        isAvailable: isInstructorAvailable
      })
      
      if (isInstructorAvailable) {
        selections[assignment.id] = {
          instructorId: assignment.instructorId,
          isRequest: assignment.isRequest
        }
        
        if (shouldTrackAsUsed) {
          usedInstructors.add(assignment.instructorId)
        }
      }
    }
  })
  
  // ✅ STEP 2: Auto-select PRIMARY instructors for assignments without valid ones
  currentAssignments.forEach(assignment => {
    if (selections[assignment.id]?.instructorId) {
      console.log(`⭐️ Step 2 - ${assignment.studentName}: already has instructor, skipping`)
      return
    }
    
    const qualified = getQualifiedInstructors(assignment).filter(i => 
      shouldTrackAsUsed ? !usedInstructors.has(i.id) : true
    )
    
    console.log(`🔍 Step 2 - ${assignment.studentName}: qualified instructors`, {
      total: getQualifiedInstructors(assignment).length,
      afterFiltering: qualified.length,
      usedInstructors: Array.from(usedInstructors),
      selectedInstructor: qualified.length > 0 ? qualified[0].name : 'NONE'
    })
    
    if (qualified.length > 0) {
      selections[assignment.id] = {
        instructorId: qualified[0].id,
        isRequest: assignment.isRequest
      }
      if (shouldTrackAsUsed) usedInstructors.add(qualified[0].id)
    }
  })
  
  // ✅ STEP 3: Validate and keep existing VIDEO instructors (if assignment needs video)
  currentAssignments.forEach(assignment => {
    if (!assignment.hasOutsideVideo) return
    if (!selections[assignment.id]) return
    
    if (assignment.videoInstructorId) {
      const isVideoAvailable = isInstructorAvailableForLoad(
        assignment.videoInstructorId,
        load.position || 0,
        allLoads,
        loadSchedulingSettings.instructorCycleTime,
        loadSchedulingSettings.minutesBetweenLoads
      )
      
      const isDifferentFromPrimary = assignment.videoInstructorId !== selections[assignment.id].instructorId
      
      if (isVideoAvailable && isDifferentFromPrimary) {
        selections[assignment.id].videoInstructorId = assignment.videoInstructorId
        if (shouldTrackAsUsed) {
          usedVideoInstructors.add(assignment.videoInstructorId)
        }
      }
    }
  })
  
  // ✅ STEP 4: Auto-select VIDEO instructors for assignments that need them but don't have valid ones
  currentAssignments.forEach(assignment => {
    if (!assignment.hasOutsideVideo) return
    if (!selections[assignment.id]) return
    if (selections[assignment.id].videoInstructorId) return
    
    const videoInstructors = getVideoInstructors().filter(i => 
      i.id !== selections[assignment.id].instructorId && 
      (shouldTrackAsUsed ? !usedVideoInstructors.has(i.id) && !usedInstructors.has(i.id) : true)
    )
    
    if (videoInstructors.length > 0) {
      selections[assignment.id].videoInstructorId = videoInstructors[0].id
      if (shouldTrackAsUsed) usedVideoInstructors.add(videoInstructors[0].id)
    }
  })
  
  console.log('✅ AUTO-SELECTION COMPLETE', {
  totalSelections: Object.keys(selections).length,
  assignmentIds: currentAssignments.map(a => ({ id: a.id, name: a.studentName })),
  selections: Object.entries(selections).map(([id, sel]) => ({
    assignmentId: id,
    instructorId: sel.instructorId,
    hasMatch: currentAssignments.some(a => a.id === id)
  }))
})
  
  setAssignmentSelections(selections)
}, [showAssignModal, showEditModal, load.assignments, getQualifiedInstructors, getVideoInstructors])
  
  // ==================== DRAG & DROP ====================
  const handleDragOver = (e: React.DragEvent) => {
    if (isCompleted) return
    e.preventDefault()
    setDragOver(true)
    setDropTarget(load.id)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (dropTarget === load.id) {
      setDropTarget(null)
    }
  }
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    setDropTarget(null)
    
    if (isCompleted) return
    
    onDrop(load.id)
  }
  
  // ==================== REMOVE FUNCTIONS ====================
  const removeFromLoad = async (assignment: LoadAssignment) => {
    if (isCompleted) return
    
    try {
      const updatedAssignments = loadAssignments.filter(a => a.id !== assignment.id)
      await update(load.id, { assignments: updatedAssignments })
      
      const currentQueue = await db.getQueue()
      const existingInQueue = currentQueue.find(
        s => s.studentAccountId === assignment.studentId
      )
      
      if (existingInQueue) {
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
  
  const removeGroupFromLoad = async (groupAssignments: LoadAssignment[]) => {
    if (isCompleted) return
    
    try {
      const currentQueue = await db.getQueue()
      
      const assignmentIds = groupAssignments.map(a => a.id)
      const updatedAssignments = loadAssignments.filter(
        a => !assignmentIds.includes(a.id)
      )
      
      await update(load.id, { assignments: updatedAssignments })
      
      for (const assignment of groupAssignments) {
        const existingInQueue = currentQueue.find(
          s => s.studentAccountId === assignment.studentId
        )
        
        if (existingInQueue) {
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
      }
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
      const updates: any = { status: statusChangeConfirm }
      
      // ==================== TRANSITIONING TO READY ====================
      if (statusChangeConfirm === 'ready' && load.status === 'building') {
        // Find the first non-completed load by position
        const firstNonCompletedLoad = allLoads
          .filter(l => l.status !== 'completed')
          .sort((a, b) => (a.position || 0) - (b.position || 0))[0]
        
        // Is THIS load the first non-completed load?
        const isFirstNonCompleted = firstNonCompletedLoad?.id === load.id
        
        if (isFirstNonCompleted) {
          // This is the first non-completed load becoming ready
          // Start its countdown NOW
          const now = new Date().toISOString()
          updates.countdownStartTime = now
          
          // Cascade countdowns to all OTHER ready loads with higher positions
          const otherReadyLoads = allLoads
            .filter(l => 
              l.id !== load.id && 
              l.status === 'ready' && 
              (l.position || 0) > (load.position || 0)
            )
            .sort((a, b) => (a.position || 0) - (b.position || 0))
          
          // Update each subsequent ready load's countdown
          for (const readyLoad of otherReadyLoads) {
            const positionDiff = (readyLoad.position || 0) - (load.position || 0)
            const offsetMs = positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000
            const cascadeTime = new Date(Date.now() + offsetMs).toISOString()
            
            await update(readyLoad.id, {
              countdownStartTime: cascadeTime
            } as any)
          }
        } else {
          // This is NOT the first non-completed load
          // Check if the first non-completed load is already ready
          if (firstNonCompletedLoad && firstNonCompletedLoad.status === 'ready' && (firstNonCompletedLoad as any).countdownStartTime) {
            // Calculate this load's countdown based on the first load's time
            const firstLoadStartTime = new Date((firstNonCompletedLoad as any).countdownStartTime).getTime()
            const positionDiff = (load.position || 0) - (firstNonCompletedLoad.position || 0)
            const offsetMs = positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000
            updates.countdownStartTime = new Date(firstLoadStartTime + offsetMs).toISOString()
          }
          // If first load is NOT ready yet, don't give this load a countdown
          // (it will get one when the first load becomes ready)
        }
      }
      
      // ==================== TRANSITIONING FROM READY TO BUILDING ====================
      else if (statusChangeConfirm === 'building' && load.status === 'ready') {
        // Clear this load's countdown
        updates.countdownStartTime = null
        
        // If this was the first non-completed load, we need to check if there's a new "first"
        const firstNonCompletedLoad = allLoads
          .filter(l => l.status !== 'completed')
          .sort((a, b) => (a.position || 0) - (b.position || 0))[0]
        
        if (firstNonCompletedLoad?.id === load.id) {
          // This WAS the first load - clear all subsequent ready loads' countdowns
          const subsequentReadyLoads = allLoads
            .filter(l => 
              l.id !== load.id && 
              l.status === 'ready' && 
              (l.position || 0) > (load.position || 0)
            )
          
          for (const readyLoad of subsequentReadyLoads) {
            await update(readyLoad.id, {
              countdownStartTime: null
            } as any)
          }
        }
      }
      
      // ==================== TRANSITIONING TO DEPARTED ====================
      else if (statusChangeConfirm === 'departed') {
        // Keep the countdown (for history/tracking purposes)
        // No cascade needed - subsequent loads already have their offsets
      }
      
      // ==================== TRANSITIONING TO COMPLETED ====================
      else if (statusChangeConfirm === 'completed') {
        // Keep the countdown (for history/tracking purposes)
        // No cascade needed
      }
      
      await update(load.id, updates)
      setStatusChangeConfirm(null)
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update load status')
    }
  }
  
  // ==================== CHANGE CALL TIME ====================
  const handleChangeCall = async () => {
    if (delayMinutes === 0) {
      alert('Please enter a time change (positive to delay, negative to move up)')
      return
    }
    
    // Check if removing time would make the countdown negative
    if (load.countdownStartTime && delayMinutes < 0) {
      const countdownStartTime = new Date(load.countdownStartTime).getTime()
      const departureTime = countdownStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
      const now = Date.now()
      const remainingMs = departureTime - now
      const changeMs = Math.abs(delayMinutes) * 60 * 1000
      
      if (changeMs > remainingMs) {
        const remainingMinutes = Math.floor(remainingMs / 60000)
        alert(`⚠️ Cannot move the call that far forward - only ${remainingMinutes} minutes remaining. The plane can't depart in the past!`)
        return
      }
    }
    
    try {
      if (load.countdownStartTime) {
        const changeMs = delayMinutes * 60 * 1000
        const currentStartTime = new Date(load.countdownStartTime).getTime()
        const newStartTime = new Date(currentStartTime + changeMs).toISOString()
        
        await update(load.id, {
          countdownStartTime: newStartTime
        } as any)
        
        // Cascade the change to all subsequent loads with countdowns
        const subsequentLoads = allLoads.filter(l => 
          l.status !== 'completed' && 
          (l.position || 0) > (load.position || 0) &&
          l.countdownStartTime
        )
        
        for (const subsequentLoad of subsequentLoads) {
          if (subsequentLoad.countdownStartTime) {
            const subCurrentStartTime = new Date(subsequentLoad.countdownStartTime).getTime()
            const subNewStartTime = new Date(subCurrentStartTime + changeMs).toISOString()
            
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
      setDelayMinutes(0)
    } catch (error) {
      console.error('Failed to change call time:', error)
      alert('Failed to change call time')
    }
  }
  
  // ==================== DELETE ====================
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
      
      const currentQueue = await db.getQueue()
      
      for (const assignment of loadAssignments) {
        const existingInQueue = currentQueue.find(
          s => s.studentAccountId === assignment.studentId
        )
        
        if (existingInQueue) {
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
        if (selection && (showEditModal || !assignment.instructorId)) {
          return {
            ...assignment,
            instructorId: selection.instructorId,
            videoInstructorId: selection.videoInstructorId || assignment.videoInstructorId,
            isRequest: selection.isRequest
          }
        }
        return assignment
      })
      
      await update(load.id, { assignments: updatedAssignments })
      setShowAssignModal(false)
      setShowEditModal(false)
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
              <h3 className="text-xl font-bold text-white">Load #{load.position || '?'}</h3>
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

        {/* Students List */}
        <div className="p-4 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
          {loadAssignments.length === 0 ? (
            <div className="text-center text-white/60 py-8">
              Drop students here to build the load
            </div>
          ) : (
            loadAssignments.map((assignment) => {
              const groupAssignments = assignment.groupId 
                ? loadAssignments.filter(a => a.groupId === assignment.groupId)
                : [assignment]
              const isFirstInGroup = groupAssignments[0].id === assignment.id
              
              if (assignment.groupId && !isFirstInGroup) return null
              
              const group = assignment.groupId ? groups?.find(g => g.id === assignment.groupId) : null
              const instructor = assignment.instructorId ? instructors.find(i => i.id === assignment.instructorId) : null
              const videoInstructor = assignment.videoInstructorId ? instructors.find(i => i.id === assignment.videoInstructorId) : null
              
              return (
                <div
                  key={assignment.id}
                  draggable={!isCompleted}
                  onDragStart={(e) => {
                    if (isCompleted) {
                      e.preventDefault()
                      return
                    }
                    if (assignment.groupId) {
                      onDragStart('group', assignment.groupId, load.id)
                    } else {
                      onDragStart('assignment', assignment.id, load.id)
                    }
                  }}
                  onDragEnd={onDragEnd}
                  className="bg-white/10 rounded-lg p-3 cursor-move hover:bg-white/15 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {group && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">👥</span>
                          <span className="text-sm font-semibold text-blue-300">
                            {group.name} ({groupAssignments.length} students)
                          </span>
                        </div>
                      )}
                      
                      {groupAssignments.map((ga, idx) => {
                        const gaInstructor = ga.instructorId ? instructors.find(i => i.id === ga.instructorId) : null
                        const gaVideoInstructor = ga.videoInstructorId ? instructors.find(i => i.id === ga.videoInstructorId) : null
                        
                        return (
                          <div key={ga.id} className={idx > 0 ? 'mt-2 pt-2 border-t border-white/10' : ''}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">
                                {ga.studentName}
                              </span>
                              <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white">
                                {ga.jumpType.toUpperCase()}
                              </span>
                              {ga.isRequest && (
                                <span className="text-xs bg-yellow-500/30 px-2 py-0.5 rounded text-yellow-200">
                                  REQUEST
                                </span>
                              )}
                            </div>
                            
                            {gaInstructor && (
                              <div className="text-sm text-white/80 mt-1">
                                👤 {gaInstructor.name}
                                {gaVideoInstructor && (
                                  <span className="ml-2">
                                    📹 {gaVideoInstructor.name}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {!gaInstructor && (
                              <div className="text-sm text-yellow-300 mt-1">
                                ⚠️ No instructor assigned
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    
                    {!isCompleted && (
                      <button
                        onClick={() => {
                          if (assignment.groupId) {
                            removeGroupFromLoad(groupAssignments)
                          } else {
                            removeFromLoad(assignment)
                          }
                        }}
                        className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Stats */}
        {totalStudents > 0 && (
          <div className="grid grid-cols-3 gap-2 p-4 border-t border-white/10 bg-black/20">
            <div className="text-center">
              <div className="text-xs text-white/60">Students</div>
              <div className="font-bold text-lg text-white">{totalStudents}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/60">Total Pay</div>
              <div className="font-bold text-lg text-green-400">${totalPay}</div>
            </div>
            <div className="text-center">
              <div className={`text-xs ${isOverCapacity ? 'text-red-400' : 'text-blue-400'}`}>
                {totalPeople}/{loadCapacity} people
              </div>
              <div className={`font-bold text-lg ${isOverCapacity ? 'text-red-400' : 'text-blue-400'}`}>
                {Math.max(0, availableSlots)} slots
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 p-4 border-t border-white/10">
          {(load.status === 'building' || load.status === 'ready') && unassignedCount > 0 && (
            <button
              onClick={() => {
                setShowEditModal(false)
                setShowAssignModal(true)
              }}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              👤 Assign Instructors ({unassignedCount} unassigned)
            </button>
          )}
          
          {(load.status === 'building' || load.status === 'ready') && loadAssignments.some(a => a.instructorId) && (
            <button
              onClick={() => {
                setShowEditModal(true)
                setShowAssignModal(true)
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              ✏️ Edit Instructors
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
                {transitionConfig.emoji} {transition === 'building' ? 
                  'Back to Building' : 
                  transition === 'departed' ?
                  'Mark Departed' :
                  `Mark as ${transitionConfig.label}`}
              </button>
            )
          })}
          
          {load.status === 'ready' && (
            <button
              onClick={() => setShowDelayModal(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              ⏱️ Change Call
            </button>
          )}
          
          {!isCompleted && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              🗑️ Delete Load
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {statusChangeConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Status Change</h3>
            <p className="text-slate-300 mb-6">
              Change load status to <strong>{statusConfig[statusChangeConfirm].label}</strong>?
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
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">⏱️ Change Call Time</h3>
            <p className="text-slate-300 mb-2">Adjust the departure call for this load and all subsequent loads.</p>
            <p className="text-sm text-slate-400 mb-4">
              • <span className="text-green-400">Positive</span> values delay departure (add time)<br/>
              • <span className="text-orange-400">Negative</span> values move it up (remove time)
            </p>
            
            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <button
                onClick={() => setDelayMinutes(-5)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
              >
                -5 min
              </button>
              <button
                onClick={() => setDelayMinutes(-2)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
              >
                -2 min
              </button>
              <button
                onClick={() => setDelayMinutes(2)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
              >
                +2 min
              </button>
              <button
                onClick={() => setDelayMinutes(5)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
              >
                +5 min
              </button>
            </div>
            
            <input
              type="number"
              value={delayMinutes || ''}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white mb-6"
              placeholder="e.g., 5 or -5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDelayModal(false)
                  setDelayMinutes(0)
                }}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeCall}
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Apply Change
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Delete Load</h3>
            <p className="text-slate-300 mb-6">
              {isCompleted ? 
                '⚠️ This is a COMPLETED load. Are you absolutely sure you want to delete it?'
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
              <h3 className="text-xl font-bold text-white">
                {showEditModal ? 'Edit Instructors' : 'Assign Instructors'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {showEditModal 
                  ? 'Change instructor assignments for all students on this load.'
                  : 'Auto-selected lowest balance instructors. Adjust as needed.'}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {(showEditModal 
                ? loadAssignments
                : loadAssignments.filter(a => !a.instructorId)
              ).map(assignment => {
                const qualified = getQualifiedInstructors(assignment)
                const videoInstructors = getVideoInstructors()
                const selection = assignmentSelections[assignment.id]
  
                console.log(`🎨 RENDER ${assignment.studentName}:`, {
                  assignmentId: assignment.id,
                  hasSelection: !!selection,
                  instructorId: selection?.instructorId,
                  totalSelectionsInState: Object.keys(assignmentSelections).length
                })
                
                // ✅ BUG #6 FIX: Collect all instructors already used across the load
                const usedInstructorIds = new Set<string>()
                const usedVideoInstructorIds = new Set<string>()
                
                Object.entries(assignmentSelections).forEach(([assignId, sel]) => {
                  // Don't count this assignment's own selections as "used"
                  if (assignId !== assignment.id) {
                    if (sel.instructorId) {
                      usedInstructorIds.add(sel.instructorId)
                      // Instructors doing primary can't also do video for someone else
                      usedVideoInstructorIds.add(sel.instructorId)
                    }
                    if (sel.videoInstructorId) {
                      usedVideoInstructorIds.add(sel.videoInstructorId)
                      // Video instructors can't also do primary for someone else
                      usedInstructorIds.add(sel.videoInstructorId)
                    }
                  }
                })
                
                // Filter qualified instructors to exclude those already used
                const availableQualified = qualified.filter(
                  instructor => 
                    !usedInstructorIds.has(instructor.id) || 
                    instructor.id === selection?.instructorId
                )
                
                // Filter video instructors to exclude:
                // 1. This student's primary instructor
                // 2. Anyone already used on this load
                const availableVideo = videoInstructors.filter(
                  instructor => 
                    instructor.id !== selection?.instructorId && 
                    (!usedVideoInstructorIds.has(instructor.id) || 
                    instructor.id === selection?.videoInstructorId)
                )
                
                return (
                  <div key={assignment.id} className="bg-slate-700 rounded-lg p-4">
                    <div className="font-semibold text-white mb-2">
                      {assignment.studentName} • {assignment.jumpType.toUpperCase()}
                      {assignment.instructorId && showEditModal && (
                        <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                          Currently: {instructors.find(i => i.id === assignment.instructorId)?.name}
                        </span>
                      )}
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
                                instructorId: e.target.value,
                                isRequest: assignment.isRequest
                              }
                            }))
                          }}
                          className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white"
                        >
                          <option value="">Select instructor...</option>
                          {availableQualified.map(instructor => (
                            <option key={instructor.id} value={instructor.id}>
                              {instructor.name} (${instructorBalances.get(instructor.id) || 0})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {assignment.hasOutsideVideo && (
                        <div>
                          <label className="text-sm text-slate-300 block mb-1">
                            Video Instructor
                            {assignment.videoInstructorId && showEditModal && (
                              <span className="ml-2 text-xs text-green-400">
                                (Currently: {instructors.find(i => i.id === assignment.videoInstructorId)?.name})
                              </span>
                            )}
                          </label>
                          <select
                            value={selection?.videoInstructorId || ''}
                            onChange={(e) => {
                              setAssignmentSelections(prev => ({
                                ...prev,
                                [assignment.id]: {
                                  ...prev[assignment.id],
                                  videoInstructorId: e.target.value,
                                  isRequest: assignment.isRequest
                                }
                              }))
                            }}
                            className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white"
                          >
                            <option value="">Select video instructor...</option>
                            {availableVideo.map(instructor => (
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
              
              {!showEditModal && loadAssignments.filter(a => !a.instructorId).length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  ✅ All students already have instructors assigned!
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setShowEditModal(false)
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
                {assignLoading ? 'Saving...' : (showEditModal ? 'Save Changes' : 'Assign Selected')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}