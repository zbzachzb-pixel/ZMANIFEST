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
import { useToast } from '@/contexts/ToastContext'
import { calculateAssignmentPay } from '@/lib/utils'
import { PAY_RATES } from '@/lib/constants'
import { db } from '@/services'
import { AssignInstructorsModal } from './AssignInstructorsModal'
import { LoadStudentsList } from './LoadStudentsList'
import { StatusChangeConfirmModal, DelayModal, DeleteConfirmModal } from './LoadModals'
import { LoadStats } from './LoadStats'
import { LoadFunJumpers } from './LoadFunJumpers'
import { ConflictWarnings } from './ConflictWarnings'
import { detectLoadConflicts } from '@/lib/conflictDetection'
import type { Load, Instructor, LoadSchedulingSettings, CreateQueueStudent, LoadAssignment, UpdateLoad } from '@/types'
import type { CreateAssignment } from '@/types'

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
  const toast = useToast()

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
  // ==================== COUNTDOWN & METRICS ====================
  const { countdown } = useLoadCountdown(load, loadSchedulingSettings)
  const isActive = countdown !== null

  const loadAssignments = load.assignments || []
  const isCompleted = load.status === 'completed'

  // ==================== CONFLICT DETECTION ====================
  const conflicts = useMemo(() => {
    return detectLoadConflicts(load, allLoads, instructors, loadSchedulingSettings)
  }, [load, allLoads, instructors, loadSchedulingSettings])

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
  }, 0) + (load.funJumpers || []).length  // + Fun Jumpers (1 slot each)
  const availableSlots = loadCapacity - totalPeople
  const isOverCapacity = totalPeople > loadCapacity
  
  // Calculate total pay
  const totalPay = useMemo(() => {
    return loadAssignments.reduce((sum, assignment) => {
      let pay = calculateAssignmentPay(assignment as any)
      if (assignment.hasOutsideVideo) pay += PAY_RATES.VIDEO_INSTRUCTOR
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
  
  const getQualifiedInstructors = useCallback((assignment: LoadAssignment) => {
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

      // Check jump type certification
      if (assignment.jumpType === 'tandem' && !instructor.canTandem) return false
      if (assignment.jumpType === 'aff' && !instructor.canAFF) return false

      // Check weight limits for tandem jumps
      if (assignment.jumpType === 'tandem') {
        const totalWeight = assignment.studentWeight + (assignment.tandemWeightTax || 0)
        const limit = instructor.tandemWeightLimit
        if (limit && totalWeight > limit) return false
      }

      // Check weight limits for AFF jumps
      if (assignment.jumpType === 'aff') {
        const weight = assignment.studentWeight
        const limit = instructor.affWeightLimit
        if (limit && weight > limit) return false
      }

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

  // Compute qualified instructors map for modal
  const qualifiedInstructorsMap = useMemo(() => {
    const map = new Map<string, Instructor[]>()
    loadAssignments.forEach(assignment => {
      map.set(assignment.id, getQualifiedInstructors(assignment))
    })
    return map
  }, [loadAssignments, getQualifiedInstructors])

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
  // Building status - subtle gray
  if (load.status === 'building') {
    return {
      bg: 'bg-slate-900/30',
      border: 'border-slate-500/50',
      glow: ''
    }
  }
  
  // Completed status - subtle purple with transparency (matching other statuses)
  if (load.status === 'completed') {
    return {
      bg: 'bg-purple-900/20',  // Changed from bg-purple-600 to match pattern
      border: 'border-purple-500/40',  // Reduced opacity for softer look
      glow: ''
    }
  }
  
  // Departed status - subtle green (already good)
  if (load.status === 'departed') {
    return {
      bg: 'bg-green-900/20',  // Reduced opacity from /30 to /20 for consistency
      border: 'border-green-500/40',  // Reduced opacity from /60 to /40
      glow: ''
    }
  }
  
  // Ready status without countdown
  if (!isActive || countdown === null) {
    return {
      bg: 'bg-blue-900/30',  // Changed from bg-blue-600 for consistency
      border: 'border-blue-500/50',
      glow: ''
    }
  }
  
  // Ready status with countdown - dynamic colors based on time remaining
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
      glow: showBreathing ? 'shadow-[0_0_30px_rgba(251,146,60,0.6)]' : ''
    }
  } else {
    return {
      bg: 'bg-red-900/20',
      border: 'border-red-500',
      glow: 'shadow-[0_0_40px_rgba(239,68,68,0.7)]'
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
      return
    }

    const qualified = getQualifiedInstructors(assignment).filter(i =>
      shouldTrackAsUsed ? !usedInstructors.has(i.id) : true
    )

    const firstQualified = qualified[0]
    if (firstQualified) {
      selections[assignment.id] = {
        instructorId: firstQualified.id,
        isRequest: assignment.isRequest
      }
      if (shouldTrackAsUsed) usedInstructors.add(firstQualified.id)
    }
  })
  
  // ✅ STEP 3: Validate and keep existing VIDEO instructors (if assignment needs video)
  currentAssignments.forEach(assignment => {
    if (!assignment.hasOutsideVideo) return
    const selection = selections[assignment.id]
    if (!selection) return

    if (assignment.videoInstructorId) {
      const isVideoAvailable = isInstructorAvailableForLoad(
        assignment.videoInstructorId,
        load.position || 0,
        allLoads,
        loadSchedulingSettings.instructorCycleTime,
        loadSchedulingSettings.minutesBetweenLoads
      )

      const isDifferentFromPrimary = assignment.videoInstructorId !== selection.instructorId

      if (isVideoAvailable && isDifferentFromPrimary) {
        selection.videoInstructorId = assignment.videoInstructorId
        if (shouldTrackAsUsed) {
          usedVideoInstructors.add(assignment.videoInstructorId)
        }
      }
    }
  })
  
  // ✅ STEP 4: Auto-select VIDEO instructors for assignments that need them but don't have valid ones
  currentAssignments.forEach(assignment => {
    if (!assignment.hasOutsideVideo) return
    const selection = selections[assignment.id]
    if (!selection) return
    if (selection.videoInstructorId) return

    const videoInstructors = getVideoInstructors().filter(i =>
      i.id !== selection.instructorId &&
      (shouldTrackAsUsed ? !usedVideoInstructors.has(i.id) && !usedInstructors.has(i.id) : true)
    )

    const firstVideo = videoInstructors[0]
    if (firstVideo) {
      selection.videoInstructorId = firstVideo.id
      if (shouldTrackAsUsed) usedVideoInstructors.add(firstVideo.id)
    }
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
      toast.error('Failed to remove student from load')
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
      toast.error('Failed to remove group from load')
    }
  }

  const removeFunJumperFromLoad = async (funJumper: any) => {
    if (isCompleted) return

    try {
      // Remove fun jumper from load's funJumpers array
      const updatedFunJumpers = (load.funJumpers || []).filter(
        fj => !(fj.userId === funJumper.userId && fj.addedAt === funJumper.addedAt)
      )

      await update(load.id, { funJumpers: updatedFunJumpers })

      // TODO: Send notification to fun jumper when SMS/push is implemented
      // For now, we'll just log it
      console.log(`Fun jumper ${funJumper.userName} removed from load #${load.position}. Notification would be sent here.`)

      // Show success toast
      toast.success(`Removed ${funJumper.userName} from load`, 'Fun jumper will be notified')

      // TODO: Optionally update fun jumper request status back to pending
      // if (funJumper.requestId) {
      //   await FunJumperRequestService.updateStatus(funJumper.requestId, 'pending', ...)
      // }

    } catch (error) {
      console.error('Failed to remove fun jumper from load:', error)
      toast.error('Failed to remove fun jumper from load')
    }
  }
  
  // ==================== STATUS CHANGES ====================
  const handleStatusChangeRequest = (newStatus: Load['status']) => {
    if (newStatus === 'departed' && load.status === 'ready' && unassignedCount > 0) {
      toast.warning('Cannot mark as departed', 'All students must have instructors assigned!')
      return
    }
    if (newStatus === 'ready' && unassignedCount > 0) {
      toast.warning('Cannot mark as ready', 'All students must have instructors assigned!')
      return
    }
    
    if (load.status === 'completed' && newStatus !== 'completed') {
      if (!confirm('⚠️ This load is COMPLETED. Are you sure you want to move it back to "' + newStatus + '"? This should only be done to fix errors.')) {
        return
      }
    }
    
    setStatusChangeConfirm(newStatus)
  }
  
  // Add this import at the top of your LoadBuilderCard.tsx file (if not already present):
// import type { CreateAssignment } from '@/types'

// Then replace the existing confirmStatusChange function with this updated version:

 const confirmStatusChange = async () => {
  if (!statusChangeConfirm) return
  
  try {
    const updates: UpdateLoad = { status: statusChangeConfirm }
    
    // ==================== TRANSITIONING TO READY ====================
    if (statusChangeConfirm === 'ready' && load.status === 'building') {
      // Find the first non-completed load by position
      const firstNonCompletedLoad = allLoads
        .filter(l => l.status !== 'completed')
        .sort((a, b) => (a.position || 0) - (b.position || 0))[0]
      
      // Is THIS load the first non-completed load?
      if (firstNonCompletedLoad?.id === load.id) {
        // This is the first ready load - start its timer immediately
        updates.countdownStartTime = new Date().toISOString()
      } else {
        // Not the first ready load - cascade timer
        const readyLoads = allLoads.filter(l => l.status === 'ready' && l.countdownStartTime)

        const lastReadyLoad = readyLoads.sort((a, b) => (b.position || 0) - (a.position || 0))[0]
        if (lastReadyLoad?.countdownStartTime) {
          const lastStartTime = new Date(lastReadyLoad.countdownStartTime).getTime()
          const cascadedStartTime = new Date(lastStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000))
          updates.countdownStartTime = cascadedStartTime.toISOString()
        } else {
          updates.countdownStartTime = new Date().toISOString()
        }
      }
    }
    
    // ==================== TRANSITIONING FROM READY TO BUILDING ====================
    else if (statusChangeConfirm === 'building' && load.status === 'ready') {
      // Clear the countdown
      updates.countdownStartTime = undefined
      
      // Cascade subsequent loads
      const subsequentLoads = allLoads
        .filter(l => 
          l.status === 'ready' && 
          (l.position || 0) > (load.position || 0) &&
          l.countdownStartTime
        )
        .sort((a, b) => (a.position || 0) - (b.position || 0))
      
      for (let i = 0; i < subsequentLoads.length; i++) {
        const subsequentLoad = subsequentLoads[i]
        if (!subsequentLoad) continue

        if (subsequentLoad.countdownStartTime) {
          const currentStartTime = new Date(subsequentLoad.countdownStartTime).getTime()
          const adjustedStartTime = new Date(currentStartTime - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000))

          await update(subsequentLoad.id, {
            countdownStartTime: adjustedStartTime.toISOString()
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
    else if (statusChangeConfirm === 'completed' && load.status === 'departed') {
      // Create assignment records for each student on the load
      for (const loadAssignment of loadAssignments) {
        try {
          // Skip if no instructor assigned (shouldn't happen for departed loads, but check anyway)
          if (!loadAssignment.instructorId) {
            continue
          }
          
          const assignmentRecord: CreateAssignment = {
            instructorId: loadAssignment.instructorId,
            instructorName: loadAssignment.instructorName || 'Unknown',
            studentName: loadAssignment.studentName,
            studentWeight: loadAssignment.studentWeight,
            jumpType: loadAssignment.jumpType,
            isRequest: loadAssignment.isRequest || false,
            isMissedJump: false,
            // Only include optional fields if they have values
            ...(loadAssignment.tandemWeightTax && { tandemWeightTax: loadAssignment.tandemWeightTax }),
            ...(loadAssignment.tandemHandcam && { tandemHandcam: loadAssignment.tandemHandcam }),
            ...(loadAssignment.hasOutsideVideo && { hasOutsideVideo: loadAssignment.hasOutsideVideo }),
            ...(loadAssignment.videoInstructorId && { videoInstructorId: loadAssignment.videoInstructorId }),
            ...(loadAssignment.videoInstructorName && { videoInstructorName: loadAssignment.videoInstructorName }),
            ...(loadAssignment.affLevel && { affLevel: loadAssignment.affLevel }),
          }

          await db.createAssignment(assignmentRecord)

          // Update student account jump count if they have an account
          if (loadAssignment.studentId) {
            try {
              await db.incrementStudentJumpCount(loadAssignment.studentId, loadAssignment.jumpType)
            } catch (err) {
              console.error(`Failed to update jump count for ${loadAssignment.studentId}:`, err)
            }
          }

        } catch (error) {
          console.error(`Failed to create assignment for ${loadAssignment.studentName}:`, error)
        }
      }
    }
    
    // Apply the status update
    await update(load.id, updates)
    setStatusChangeConfirm(null)
    
  } catch (error) {
    console.error('Failed to update status:', error)
    toast.error('Failed to update load status')
  }
}
// Add this function to your LoadBuilderCard component (before the return statement)
// This handles the "Change Call" functionality for adjusting load departure times

const handleChangeCall = async () => {
  if (delayMinutes === 0) {
    toast.warning('Please enter a time change', 'Positive to delay, negative to move up')
    return
  }
  
  try {
    // Check if removing time would make the countdown negative
    if (load.countdownStartTime && delayMinutes < 0) {
      const countdownStartTime = new Date(load.countdownStartTime).getTime()
      const departureTime = countdownStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
      const now = Date.now()
      const remainingMs = departureTime - now
      const changeMs = Math.abs(delayMinutes) * 60 * 1000
      
      if (changeMs > remainingMs) {
        const remainingMinutes = Math.floor(remainingMs / 60000)
        toast.warning('Cannot move call that far forward', `Only ${remainingMinutes} minutes remaining`)
        return
      }
    }
    
    if (load.countdownStartTime) {
      const changeMs = delayMinutes * 60 * 1000
      const currentStartTime = new Date(load.countdownStartTime).getTime()
      const newStartTime = new Date(currentStartTime + changeMs).toISOString()
      
      // Update this load's countdown
      await update(load.id, {
        countdownStartTime: newStartTime
      } as any)
      
      // If delaying (positive minutes), cascade to subsequent loads
      if (delayMinutes > 0) {
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
      }
      // If moving up (negative minutes), don't cascade - let subsequent loads keep their timing
    } else {
      // If no countdown started yet, store the delay amount
      await update(load.id, {
        delayMinutes: (load.delayMinutes || 0) + delayMinutes
      } as any)
    }
    
    // Call the onDelay prop if provided
    if (onDelay) {
      await onDelay(load.id, delayMinutes)
    }
    
    setShowDelayModal(false)
    setDelayMinutes(0) // Reset the input
    
    // Show success message
    const action = delayMinutes > 0 ? 'delayed' : 'moved up'
    const absMinutes = Math.abs(delayMinutes)
    toast.success(`Load ${action} by ${absMinutes} minute${absMinutes !== 1 ? 's' : ''}`)

  } catch (error) {
    console.error('Failed to change call time:', error)
    toast.error('Failed to change load call time')
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
      toast.error('Failed to delete load')
    }
  }
  
  // ==================== ASSIGNMENT SELECTION HANDLERS ====================
  const handleAssignmentSelectionChange = useCallback((
    assignmentId: string,
    updates: { instructorId?: string; videoInstructorId?: string }
  ) => {
    setAssignmentSelections(prev => {
      const current = prev[assignmentId]
      const assignment = loadAssignments.find(a => a.id === assignmentId)

      return {
        ...prev,
        [assignmentId]: {
          instructorId: updates.instructorId !== undefined ? updates.instructorId : (current?.instructorId || ''),
          videoInstructorId: updates.videoInstructorId !== undefined ? updates.videoInstructorId : current?.videoInstructorId,
          isRequest: assignment?.isRequest || false
        }
      }
    })
  }, [loadAssignments])

  const handleCloseAssignModal = useCallback(() => {
    setShowAssignModal(false)
    setShowEditModal(false)
    setAssignmentSelections({})
  }, [])

  // ==================== BULK ASSIGN ====================
  const handleBulkAssign = async () => {
    if (Object.keys(assignmentSelections).length === 0) {
      toast.warning('No instructors selected to assign')
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
            isRequest: selection.isRequest,
            // ✅ FIXED: Explicitly preserve groupId to prevent it from being lost
            groupId: assignment.groupId
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
      toast.error('Failed to assign instructors')
    } finally {
      setAssignLoading(false)
    }
  }
  
  // ==================== RENDER ====================

  // Calculate health indicator
  const conflictSummary = useMemo(() => {
    const errors = conflicts.filter(c => c.severity === 'error').length
    const warnings = conflicts.filter(c => c.severity === 'warning').length

    if (errors > 0) return { color: 'bg-red-500', icon: '🔴', label: `${errors} error${errors !== 1 ? 's' : ''}` }
    if (warnings > 0) return { color: 'bg-yellow-500', icon: '🟡', label: `${warnings} warning${warnings !== 1 ? 's' : ''}` }
    if (unassignedCount > 0) return { color: 'bg-orange-500', icon: '🟠', label: 'Needs assignments' }
    return { color: 'bg-green-500', icon: '🟢', label: 'Ready' }
  }, [conflicts, unassignedCount])

  return (
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl shadow-lg transition-all hover:shadow-xl ${
          dragOver && dropTarget === load.id
            ? 'scale-105 ring-4 ring-green-500'
            : ''
        } ${colors.bg} ${colors.glow} border-2 ${colors.border}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Load number and status */}
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-2xl font-bold text-white shrink-0 tracking-tight">#{load.position || '?'}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentStatus.color} text-white whitespace-nowrap shadow-lg`}>
                {currentStatus.emoji} {currentStatus.label}
              </span>
            </div>

            {/* Right: Health indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/10 shrink-0 shadow-md">
              <div className={`w-2 h-2 rounded-full ${conflictSummary.color} animate-pulse shadow-sm`} />
              <span className="text-xs text-white/90 font-semibold">{conflictSummary.label}</span>
            </div>
          </div>

          {/* Countdown Timer */}
          {isActive && countdown !== null && (
            <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">⏱️</span>
                  <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Departure In</span>
                </div>
                <div className={`px-3 py-1.5 rounded-lg font-mono text-2xl font-extrabold shadow-md ${
                  Math.floor(countdown / 60) < 5 ? 'text-red-300 bg-red-500/20 border border-red-500/30' :
                  Math.floor(countdown / 60) < 10 ? 'text-orange-300 bg-orange-500/20 border border-orange-500/30' :
                  'text-blue-300 bg-blue-500/20 border border-blue-500/30'
                }`}>
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </div>
              </div>

              {/* Enhanced progress bar */}
              <div className="relative w-full h-3 bg-slate-700/50 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`absolute inset-0 transition-all duration-1000 ${
                    Math.floor(countdown / 60) < 5 ? 'bg-gradient-to-r from-red-600 via-red-500 to-red-400' :
                    Math.floor(countdown / 60) < 10 ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400' :
                    'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400'
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, (countdown / (loadSchedulingSettings.minutesBetweenLoads * 60)) * 100))}%`
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
                </div>
              </div>

              {/* Status message */}
              <div className={`mt-2 text-center text-xs font-bold uppercase tracking-wide ${
                Math.floor(countdown / 60) < 5 ? 'text-red-300 drop-shadow-lg' :
                Math.floor(countdown / 60) < 10 ? 'text-orange-300 drop-shadow-lg' :
                'text-blue-300'
              }`}>
                {Math.floor(countdown / 60) < 5 ? '⚠️ PREPARE FOR DEPARTURE' :
                 Math.floor(countdown / 60) < 10 ? '📋 FINAL CHECKS' :
                 '✅ ON SCHEDULE'}
              </div>
            </div>
          )}
        </div>

        {/* Students List */}
        <LoadStudentsList
          assignments={loadAssignments}
          groups={groups}
          instructors={instructors}
          isCompleted={isCompleted}
          loadId={load.id}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onRemoveAssignment={removeFromLoad}
          onRemoveGroup={removeGroupFromLoad}
        />

        {/* Fun Jumpers (Collapsible) */}
        <LoadFunJumpers
          funJumpers={load.funJumpers || []}
          isCompleted={isCompleted}
          onRemove={removeFunJumperFromLoad}
        />

        {/* Stats */}
        <LoadStats
          totalStudents={totalStudents}
          totalPay={totalPay}
          totalPeople={totalPeople}
          loadCapacity={loadCapacity}
          availableSlots={availableSlots}
          isOverCapacity={isOverCapacity}
        />

        {/* Conflict Warnings */}
        {conflicts.length > 0 && (
          <div className="p-4 border-t border-white/10">
            <ConflictWarnings conflicts={conflicts} />
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-3 border-t border-white/10 space-y-2">
          {/* Instructor Actions */}
          {(load.status === 'building' || load.status === 'ready') && (
            <div className="flex gap-2">
              {unassignedCount > 0 && (
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setShowAssignModal(true)
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white font-semibold py-2 px-3 rounded-lg transition-all hover:scale-105 hover:shadow-xl text-xs shadow-lg"
                >
                  <span className="block text-sm">👤 Assign</span>
                  <span className="text-[10px] opacity-90 font-medium">({unassignedCount} unassigned)</span>
                </button>
              )}

              {loadAssignments.some(a => a.instructorId) && (
                <button
                  onClick={() => {
                    setShowEditModal(true)
                    setShowAssignModal(true)
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-2 px-3 rounded-lg transition-all hover:scale-105 hover:shadow-xl text-sm shadow-lg"
                >
                  ✏️ Edit
                </button>
              )}
            </div>
          )}

          {/* Status Transitions */}
          {availableTransitions.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {availableTransitions.map(transition => {
                const transitionConfig = statusConfig[transition as Load['status']]
                // Full width for primary actions or when only one button
                const isFullWidth = availableTransitions.length === 1 ||
                  transition === 'ready' ||
                  transition === 'completed'

                return (
                  <button
                    key={transition}
                    onClick={() => handleStatusChangeRequest(transition as Load['status'])}
                    disabled={loading}
                    className={`font-semibold py-2 px-3 rounded-lg transition-all hover:scale-105 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl ${
                      transition === 'ready' ?
                        'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white' :
                      transition === 'departed' ?
                        'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white' :
                      transition === 'completed' ?
                        'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white' :
                        'bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-800 hover:to-slate-700 text-white'
                    } ${isFullWidth ? 'col-span-2' : ''}`}
                  >
                    <span className="text-base">{transitionConfig.emoji}</span> {transition === 'building' ?
                      'Back to Building' :
                      transition === 'departed' ?
                      'Mark Departed' :
                      `Mark as ${transitionConfig.label}`}
                  </button>
                )
              })}
            </div>
          )}

          {/* Utility Actions */}
          <div className="flex gap-2">
            {load.status === 'ready' && (
              <button
                onClick={() => setShowDelayModal(true)}
                className="flex-1 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-semibold py-2 px-3 rounded-lg transition-all hover:scale-105 hover:shadow-xl text-sm shadow-lg"
              >
                <span className="text-base">⏱️</span> Change Call
              </button>
            )}

            {!isCompleted && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="bg-red-500/20 hover:bg-red-500/40 border-2 border-red-500/50 hover:border-red-400 text-red-300 hover:text-red-200 font-semibold py-2 px-3 rounded-lg transition-all hover:scale-105 text-sm disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                <span className="text-base">🗑️</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <StatusChangeConfirmModal
        show={!!statusChangeConfirm}
        newStatus={statusChangeConfirm}
        statusLabel={statusChangeConfirm ? statusConfig[statusChangeConfirm].label : ''}
        loading={loading}
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusChangeConfirm(null)}
      />

      <DelayModal
        show={showDelayModal}
        delayMinutes={delayMinutes}
        loading={loading}
        onDelayChange={setDelayMinutes}
        onApply={handleChangeCall}
        onCancel={() => {
          setShowDelayModal(false)
          setDelayMinutes(0)
        }}
      />

      <DeleteConfirmModal
        show={showDeleteConfirm}
        isCompleted={isCompleted}
        loading={loading}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <AssignInstructorsModal
        show={showAssignModal}
        isEditMode={showEditModal}
        assignments={loadAssignments}
        assignmentSelections={assignmentSelections}
        qualifiedInstructorsMap={qualifiedInstructorsMap}
        videoInstructors={getVideoInstructors()}
        instructorBalances={instructorBalances}
        instructors={instructors}
        loading={assignLoading}
        onClose={handleCloseAssignModal}
        onAssign={handleBulkAssign}
        onSelectionChange={handleAssignmentSelectionChange}
      />
    </>
  )
}