// src/components/LoadBuilderCard.tsx - COMPLETE FILE WITH NEW TIMER LOGIC
// ✅ NEW: Cascading timer system - loads marked ready get staggered timers
// ✅ NEW: When first load departs, all subsequent loads reset to base intervals
// ✅ Bidirectional transitions at all stages
// ✅ Confirmation for moving from completed
// ✅ Allow deletion of completed loads with extra confirmation
// ✅ Fixed property names for backwards compatibility
// ✅ Drag/drop disabled for completed loads (safety)

'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useUpdateLoad, useDeleteLoad, useGroups } from '@/hooks/useDatabase'
import { useLoadCountdown } from '@/hooks/useLoadCountdown'
import { db } from '@/services'
import type { Load, Instructor, LoadSchedulingSettings, CreateQueueStudent } from '@/types'

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
  const { update, loading } = useUpdateLoad()
  const { deleteLoad } = useDeleteLoad()
  const { data: groups } = useGroups()
  
  const [dragOver, setDragOver] = useState(false)
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<Load['status'] | null>(null)
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [delayMinutes, setDelayMinutes] = useState(20)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, {instructorId: string, videoInstructorId?: string}>>({})
  const [assignLoading, setAssignLoading] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const [lastMilestone, setLastMilestone] = useState<number | null>(null)
  
  const { countdown, formattedTime, isReadyToDepart } = useLoadCountdown(load, loadSchedulingSettings, allLoads)
  
  const loadAssignments = load.assignments || []
  
  const totalPeople = loadAssignments.reduce((sum, assignment) => {
    let count = 2
    if (assignment.hasOutsideVideo || assignment.videoInstructorId) {
      count += 1
    }
    return sum + count
  }, 0)
  
  const unassignedCount = loadAssignments.filter(a => !a.instructorId).length
  const percentFull = Math.round((totalPeople / load.capacity) * 100)
  const isOverCapacity = totalPeople > load.capacity
  const availableSlots = load.capacity - totalPeople
  const isCompleted = load.status === 'completed'

  const statusConfig = {
    building: { label: 'Building', icon: '🔨', bgClass: 'bg-blue-500/10', textClass: 'text-blue-400', borderClass: 'border-blue-500/50' },
    ready: { label: 'Ready', icon: '✅', bgClass: 'bg-green-500/10', textClass: 'text-green-400', borderClass: 'border-green-500/50' },
    departed: { label: 'Departed', icon: '✈️', bgClass: 'bg-yellow-500/10', textClass: 'text-yellow-400', borderClass: 'border-yellow-500/50' },
    completed: { label: 'Completed', icon: '🎉', bgClass: 'bg-purple-500/10', textClass: 'text-purple-400', borderClass: 'border-purple-500/50' }
  }

  const currentStatus = statusConfig[load.status]

  // ✅ BIDIRECTIONAL TRANSITIONS
  const availableTransitions = useMemo(() => {
    const transitions: Load['status'][] = []
    
    if (load.status === 'building') {
      transitions.push('ready')
    }
    
    if (load.status === 'ready') {
      transitions.push('building', 'departed')
    }
    
    if (load.status === 'departed') {
      transitions.push('ready', 'completed')
    }
    
    if (load.status === 'completed') {
      transitions.push('departed')
    }
    
    return transitions
  }, [load.status])

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
    if (newStatus === 'ready' && isOverCapacity) {
      alert('❌ Cannot mark as ready: Load is over capacity!')
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
  
  // ==================== NEW TIMER LOGIC ====================
  const confirmStatusChange = async () => {
    if (!statusChangeConfirm) return
    
    try {
      const updates: Partial<Load> = { status: statusChangeConfirm }
      
      // ==================== HANDLE COUNTDOWN TIMER LOGIC ====================
      
      if (statusChangeConfirm === 'ready') {
        // Check if there are any loads with LOWER position that are not departed/completed
        const loadsBeforeThis = allLoads
          .filter(l => (l.position || 0) < (load.position || 0))
          .filter(l => l.status !== 'departed' && l.status !== 'completed')
        
        // Check if any loads before this one are still building
        const hasUnreadyLoadsBefore = loadsBeforeThis.some(l => l.status === 'building')
        
        if (hasUnreadyLoadsBefore) {
          // There are loads before this one that aren't ready yet - don't start timer
          (updates as any).countdownStartTime = null
        } else {
          // No unready loads before this one - check if we should start/cascade timer
          
          // Find the FIRST ready load (lowest position)
          const allReadyLoads = allLoads
            .filter(l => l.status === 'ready' || l.id === load.id) // Include this load since we're marking it ready
            .sort((a, b) => (a.position || 0) - (b.position || 0))
          
          const firstReadyLoad = allReadyLoads[0]
          
          // Check if THIS load is the first ready load
          const isFirstReadyLoad = firstReadyLoad && firstReadyLoad.id === load.id
          
          if (isFirstReadyLoad) {
            // This is the first ready load - start its timer
            (updates as any).countdownStartTime = new Date().toISOString()
          } else {
            // This is NOT the first ready load - check if first ready load has active timer
            const firstLoadHasTimer = firstReadyLoad && (firstReadyLoad as any).countdownStartTime
            
            if (firstLoadHasTimer) {
              // First load has timer - calculate cascading timer for this load
              const firstLoadStartTime = new Date((firstReadyLoad as any).countdownStartTime).getTime()
              const firstLoadTargetTime = firstLoadStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              const firstLoadRemainingMs = Math.max(0, firstLoadTargetTime - Date.now())
              
              // Calculate position difference
              const positionDiff = (load.position || 0) - (firstReadyLoad.position || 0)
              
              // This load's total remaining time = first load remaining + (20 min × position difference)
              const thisLoadRemainingMs = firstLoadRemainingMs + (positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              
              // Calculate startTime such that remaining time equals thisLoadRemainingMs
              const thisLoadStartTime = Date.now() + thisLoadRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000);
              (updates as any).countdownStartTime = new Date(thisLoadStartTime).toISOString()
            } else {
              // First ready load has no timer - don't set timer for this load
              (updates as any).countdownStartTime = null
            }
          }
        }
      }
      
      if (statusChangeConfirm === 'building') {
        if ((load as any).countdownStartTime) {
          (updates as any).countdownStartTime = null
        }
      }
      
      if (statusChangeConfirm === 'departed') {
        updates.departedAt = new Date().toISOString()
      }
      
      if (statusChangeConfirm === 'completed') {
        updates.completedAt = new Date().toISOString()
      }
      
      // Update this load's status
      await update(load.id, updates)
      setStatusChangeConfirm(null)
      
      // ==================== UPDATE SUBSEQUENT READY LOADS WHEN MARKING READY ====================
      
      if (statusChangeConfirm === 'ready') {
        // Check if we started a timer for this load
        const startedTimer = (updates as any).countdownStartTime
        
        if (startedTimer) {
          // This load got a timer - cascade to all ready loads that come after this one
          
          // Find all subsequent ready loads (including those that were waiting)
          const subsequentReadyLoads = allLoads
            .filter(l => l.status === 'ready' && l.position > (load.position || 0))
            .sort((a, b) => (a.position || 0) - (b.position || 0))
          
          if (subsequentReadyLoads.length > 0) {
            // Calculate remaining time for THIS load (the one we just marked ready)
            const thisLoadStartTime = new Date(startedTimer).getTime()
            const thisLoadTargetTime = thisLoadStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
            const thisLoadRemainingMs = Math.max(0, thisLoadTargetTime - Date.now())
            
            // Update each subsequent ready load
            for (const subsequentLoad of subsequentReadyLoads) {
              const positionDiff = subsequentLoad.position - (load.position || 0)
              
              // Calculate target remaining time based on position difference from THIS load
              const targetRemainingMs = thisLoadRemainingMs + (positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              
              // Calculate startTime for this remaining time
              const newStartTime = Date.now() + targetRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              
              await update(subsequentLoad.id, {
                countdownStartTime: new Date(newStartTime).toISOString()
              } as any)
            }
          }
        }
      }
      
      // ==================== RESET TIMERS WHEN LOAD DEPARTS ====================
      
      if (statusChangeConfirm === 'departed') {
        // Find all subsequent ready loads and reset their timers to staggered intervals
        const subsequentReadyLoads = allLoads
          .filter(l => l.status === 'ready' && l.position > (load.position || 0))
          .sort((a, b) => (a.position || 0) - (b.position || 0))
        
        // Reset each subsequent load's timer
        for (let i = 0; i < subsequentReadyLoads.length; i++) {
          const subsequentLoad = subsequentReadyLoads[i]
          const positionDiff = i + 1 // 1st load after = 1, 2nd load after = 2, etc.
          
          // Calculate target remaining time: 20min, 40min, 60min, etc.
          const targetRemainingMs = positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000
          
          // Calculate startTime for this remaining time
          // Formula: startTime = now + remaining - duration
          const newStartTime = Date.now() + targetRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
          
          await update(subsequentLoad.id, {
            countdownStartTime: new Date(newStartTime).toISOString()
          } as any)
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
    
    if (load.status === 'completed') {
      if (!confirm('⚠️ This load is COMPLETED. Are you sure you want to DELETE it? This cannot be undone!')) {
        return
      }
    }
    
    try {
      await deleteLoad(load.id)
      
      // ==================== RECALCULATE TIMERS FOR SUBSEQUENT LOADS ====================
      
      // If the deleted load was ready with an active timer, recalculate subsequent loads
      if (load.status === 'ready' && (load as any).countdownStartTime) {
        // Find all ready loads that came after this one
        const subsequentReadyLoads = allLoads
          .filter(l => l.status === 'ready' && l.position > (load.position || 0))
          .sort((a, b) => (a.position || 0) - (b.position || 0))
        
        if (subsequentReadyLoads.length > 0) {
          // Find the NEW first ready load after deletion
          const allRemainingReadyLoads = allLoads
            .filter(l => l.id !== load.id && l.status === 'ready')
            .sort((a, b) => (a.position || 0) - (b.position || 0))
          
          const newFirstReadyLoad = allRemainingReadyLoads[0]
          
          if (newFirstReadyLoad) {
            // Check if the new first ready load has an active timer
            const firstHasTimer = (newFirstReadyLoad as any).countdownStartTime
            
            if (firstHasTimer) {
              // Recalculate all subsequent loads based on the new first ready load
              const firstLoadStartTime = new Date((newFirstReadyLoad as any).countdownStartTime).getTime()
              const firstLoadTargetTime = firstLoadStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              const firstLoadRemainingMs = Math.max(0, firstLoadTargetTime - Date.now())
              
              for (const subsequentLoad of allRemainingReadyLoads.slice(1)) {
                const positionDiff = subsequentLoad.position - newFirstReadyLoad.position
                
                // Calculate target remaining time
                const targetRemainingMs = firstLoadRemainingMs + (positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
                
                // Calculate new startTime
                const newStartTime = Date.now() + targetRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
                
                await update(subsequentLoad.id, {
                  countdownStartTime: new Date(newStartTime).toISOString()
                } as any)
              }
            } else if (newFirstReadyLoad.id === subsequentReadyLoads[0]?.id) {
              // The deleted load was the first ready load, and the next one doesn't have a timer
              // Start a timer for the new first ready load
              await update(newFirstReadyLoad.id, {
                countdownStartTime: new Date().toISOString()
              } as any)
              
              // Then cascade to subsequent loads
              const nowStartTime = Date.now()
              const nowTargetTime = nowStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              const nowRemainingMs = loadSchedulingSettings.minutesBetweenLoads * 60 * 1000
              
              for (const subsequentLoad of allRemainingReadyLoads.slice(1)) {
                const positionDiff = subsequentLoad.position - newFirstReadyLoad.position
                const targetRemainingMs = nowRemainingMs + (positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
                const newStartTime = Date.now() + targetRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
                
                await update(subsequentLoad.id, {
                  countdownStartTime: new Date(newStartTime).toISOString()
                } as any)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete load:', error)
      alert('Failed to delete load')
    }
  }

  const removeFromLoad = async (assignmentId: string) => {
    try {
      const assignment = loadAssignments.find(a => a.id === assignmentId)
      if (!assignment) return
      
      const updatedAssignments = loadAssignments.filter(a => a.id !== assignmentId)
      await update(load.id, { assignments: updatedAssignments })
      
      const queueStudent: CreateQueueStudent = {
        studentAccountId: assignment.studentId,
        name: assignment.studentName,
        weight: assignment.studentWeight,
        jumpType: assignment.jumpType,
        isRequest: assignment.isRequest,
        tandemWeightTax: assignment.tandemWeightTax,
        tandemHandcam: assignment.tandemHandcam || false,
        outsideVideo: assignment.hasOutsideVideo,
        affLevel: assignment.affLevel,
        groupId: assignment.groupId
      }
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
    const qualified = clockedIn.filter(instructor => {
      const canTandem = (instructor as any).canTandem ?? (instructor as any).tandem
      const canAFF = (instructor as any).canAFF ?? (instructor as any).aff
      if (assignment.jumpType === 'tandem' && !canTandem) return false
      if (assignment.jumpType === 'aff' && !canAFF) return false
      if (assignment.jumpType === 'tandem' && instructor.tandemWeightLimit) {
        const totalWeight = assignment.studentWeight + (assignment.tandemWeightTax || 0)
        if (totalWeight > instructor.tandemWeightLimit) return false
      }
      if (assignment.jumpType === 'aff' && instructor.affWeightLimit) {
        if (assignment.studentWeight > instructor.affWeightLimit) return false
      }
      return true
    })
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
  
  const autoSelectInstructors = useMemo(() => {
    if (!showAssignModal) return {}
    
    const selections: Record<string, {instructorId: string, videoInstructorId?: string}> = {}
    const usedMainInstructors = new Set<string>()
    const usedVideoInstructors = new Set<string>()
    
    allLoads.forEach(otherLoad => {
      if (otherLoad.status === 'completed') return
      
      const assignments = otherLoad.assignments || []
      assignments.forEach(a => {
        if (a.instructorId) {
          usedMainInstructors.add(a.instructorId)
        }
        if (a.videoInstructorId) {
          usedVideoInstructors.add(a.videoInstructorId)
          usedMainInstructors.add(a.videoInstructorId)
        }
      })
    })
    
    const unassignedAssignments = loadAssignments.filter(a => !a.instructorId)
    
    unassignedAssignments.forEach((assignment) => {
      const clockedIn = instructors.filter(i => i.clockedIn)
      
      const qualified = clockedIn.filter(instructor => {
        if (usedMainInstructors.has(instructor.id)) return false
        
        const canTandem = (instructor as any).canTandem ?? (instructor as any).tandem
        const canAFF = (instructor as any).canAFF ?? (instructor as any).aff
        
        if (assignment.jumpType === 'tandem' && !canTandem) return false
        if (assignment.jumpType === 'aff' && !canAFF) return false
        
        if (assignment.jumpType === 'tandem' && instructor.tandemWeightLimit) {
          const totalWeight = assignment.studentWeight + (assignment.tandemWeightTax || 0)
          if (totalWeight > instructor.tandemWeightLimit) return false
        }
        if (assignment.jumpType === 'aff' && instructor.affWeightLimit) {
          if (assignment.studentWeight > instructor.affWeightLimit) return false
        }
        
        return true
      }).sort((a, b) => {
        const balanceA = instructorBalances.get(a.id) || 0
        const balanceB = instructorBalances.get(b.id) || 0
        return balanceA - balanceB
      })
      
      if (qualified.length > 0) {
        const selectedInstructor = qualified[0]
        selections[assignment.id] = { instructorId: selectedInstructor.id }
        usedMainInstructors.add(selectedInstructor.id)
        
        if (assignment.hasOutsideVideo && assignment.jumpType === 'tandem') {
          const videoQualified = clockedIn.filter(i => {
            const canVideo = (i as any).canVideo ?? (i as any).video
            if (!i.clockedIn || !canVideo) return false
            if (i.id === selectedInstructor.id) return false
            if (usedVideoInstructors.has(i.id)) return false
            if (usedMainInstructors.has(i.id)) return false
            return true
          }).sort((a, b) => {
            const balanceA = instructorBalances.get(a.id) || 0
            const balanceB = instructorBalances.get(b.id) || 0
            return balanceA - balanceB
          })
          
          if (videoQualified.length > 0) {
            const selectedVideo = videoQualified[0]
            selections[assignment.id].videoInstructorId = selectedVideo.id
            usedVideoInstructors.add(selectedVideo.id)
            usedMainInstructors.add(selectedVideo.id)
          }
        }
      }
    })
    
    return selections
  }, [showAssignModal, loadAssignments, instructors, instructorBalances, allLoads])
  
  useEffect(() => {
    if (showAssignModal && Object.keys(autoSelectInstructors).length > 0) {
      setAssignmentSelections(autoSelectInstructors)
    }
  }, [showAssignModal, autoSelectInstructors])

  useEffect(() => {
    if (!showAssignModal) {
      setAssignmentSelections({})
    }
  }, [showAssignModal])

  // ==================== MILESTONE BREATHING EFFECTS ====================
  useEffect(() => {
    if (load.status !== 'ready' || !countdown) {
      setLastMilestone(null)
      return
    }

    const minutes = Math.floor(countdown / 60)
    
    // Check for 20-minute milestone
    if (minutes === 19 && lastMilestone !== 20) {
      setLastMilestone(20)
      setShowBreathing(true)
      setTimeout(() => setShowBreathing(false), 1000)
    }
    
    // Check for 10-minute milestone
    if (minutes === 9 && lastMilestone !== 10) {
      setLastMilestone(10)
      setShowBreathing(true)
      setTimeout(() => setShowBreathing(false), 1000)
    }
  }, [countdown, load.status, lastMilestone])

  // Determine load card colors based on timer
  const getLoadColors = () => {
    if (isCompleted) {
      return {
        bg: 'bg-purple-900/30',
        border: 'border-purple-500/50',
        glow: ''
      }
    }
    
    if (load.status !== 'ready' || !countdown) {
      return {
        bg: 'bg-white/10',
        border: currentStatus.borderClass,
        glow: ''
      }
    }

    const minutes = Math.floor(countdown / 60)
    
    if (minutes >= 20) {
      // > 20 minutes: Blue/Default
      return {
        bg: 'bg-white/10',
        border: 'border-blue-500/50',
        glow: showBreathing ? 'shadow-[0_0_30px_rgba(59,130,246,0.6)]' : ''
      }
    } else if (minutes >= 10) {
      // 10-20 minutes: Orange
      return {
        bg: 'bg-orange-900/20',
        border: 'border-orange-500/60',
        glow: showBreathing ? 'shadow-[0_0_30px_rgba(249,115,22,0.6)]' : ''
      }
    } else {
      // < 10 minutes: Red
      return {
        bg: 'bg-red-900/20',
        border: 'border-red-500/60',
        glow: showBreathing ? 'shadow-[0_0_30px_rgba(239,68,68,0.6)]' : ''
      }
    }
  }

  const loadColors = getLoadColors()

  return (
    <>
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .breathing {
          animation: breathe 1s ease-in-out;
        }
      `}</style>
      
      <div
        className={`rounded-xl shadow-2xl p-6 border-2 backdrop-blur-lg transition-all duration-300 ${
          loadColors.bg
        } ${
          loadColors.border
        } ${
          loadColors.glow
        } ${
          showBreathing ? 'breathing' : ''
        } ${
          dragOver && load.status === 'building' ? 'scale-105' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-white">{load.name}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${currentStatus.bgClass} ${currentStatus.textClass}`}>
                {currentStatus.icon} {currentStatus.label}
              </span>
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
            className="ml-4 p-2 rounded-lg transition-colors bg-red-500/20 hover:bg-red-500/30 text-red-400"
            title="Delete Load"
          >
            🗑️
          </button>
        </div>

        {load.status === 'ready' && formattedTime && (
          <div className={`mb-4 p-4 rounded-lg border-2 transition-all duration-300 ${
            isReadyToDepart ? 'bg-green-500/20 border-green-500 animate-pulse' : 
            countdown && countdown < 600 ? 'bg-red-500/20 border-red-500' : 
            countdown && countdown < 1200 ? 'bg-orange-500/20 border-orange-500' : 
            'bg-blue-500/20 border-blue-500'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">
                  {isReadyToDepart ? '✅' : 
                   countdown && countdown < 600 ? '🚨' : 
                   countdown && countdown < 1200 ? '⏰' : 
                   '⏱️'}
                </div>
                <div>
                  <div className="text-sm text-slate-300">
                    {isReadyToDepart ? 'READY TO DEPART!' : 
                     countdown && countdown < 600 ? 'URGENT - Departs Soon!' :
                     countdown && countdown < 1200 ? 'Warning - Departs in' :
                     'Departs in'}
                  </div>
                  <div className={`text-2xl font-bold ${
                    countdown && countdown < 600 ? 'text-red-300' :
                    countdown && countdown < 1200 ? 'text-orange-300' :
                    'text-white'
                  }`}>{formattedTime}</div>
                </div>
              </div>
              {!isReadyToDepart && (
                <button
                  onClick={handleDelay}
                  className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  ⏰ Delay
                </button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto">
          {loadAssignments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-600 rounded-lg">
              {isCompleted ? 'No assignments on this load' : 'Drop students here'}
            </div>
          ) : (
            (() => {
              const grouped: Record<string, typeof loadAssignments> = {}
              const individual: typeof loadAssignments = []
              loadAssignments.forEach(assignment => {
                if (assignment.groupId) {
                  if (!grouped[assignment.groupId]) grouped[assignment.groupId] = []
                  grouped[assignment.groupId].push(assignment)
                } else {
                  individual.push(assignment)
                }
              })
              return (
                <>
                  {Object.entries(grouped).map(([groupId, groupAssignments]) => {
                    const group = groups.find(g => g.id === groupId)
                    if (!group) return null
                    return (
                      <div 
                        key={groupId}
                        draggable={!isCompleted && load.status === 'building'}
                        onDragStart={() => !isCompleted && load.status === 'building' && onDragStart('group', groupId, load.id)}
                        onDragEnd={onDragEnd}
                        className={`bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-500/40 rounded-xl p-3 space-y-2 transition-all ${
                          !isCompleted && load.status === 'building' ? 'cursor-move hover:bg-purple-500/20 hover:border-purple-500/60' : 'cursor-default'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-purple-300 font-bold text-sm">👥 {group.name}</div>
                        </div>
                        {groupAssignments.map(assignment => (
                          <div key={assignment.id} className="bg-white/5 rounded-lg p-2 border border-white/10">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white text-sm">{assignment.studentName}</span>
                                  {assignment.isRequest && <span className="text-yellow-400 text-xs">⭐</span>}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                                  {assignment.tandemWeightTax && ` • Tax: ${assignment.tandemWeightTax}`}
                                  {assignment.tandemHandcam && ' • 📹 Handcam'}
                                  {assignment.hasOutsideVideo && ' • 🎥 Video'}
                                  {assignment.affLevel && ` • ${assignment.affLevel}`}
                                </div>
                                {assignment.instructorId ? (
                                  <div className="text-xs text-green-400 mt-1">
                                    TI: {assignment.instructorName}
                                    {assignment.videoInstructorId && ` • 📹 ${assignment.videoInstructorName}`}
                                  </div>
                                ) : (
                                  <div className="text-xs text-red-400 mt-1">TI: 🔴 Not assigned</div>
                                )}
                              </div>
                              {!isCompleted && load.status === 'building' && (
                                <button
                                  onClick={() => removeFromLoad(assignment.id)}
                                  className="ml-2 p-1 text-red-400 hover:text-red-300 transition-colors"
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
                  
                  {individual.map(assignment => (
                    <div
                      key={assignment.id}
                      draggable={!isCompleted && load.status === 'building'}
                      onDragStart={() => !isCompleted && load.status === 'building' && onDragStart('assignment', assignment.id, load.id)}
                      onDragEnd={onDragEnd}
                      className={`bg-white/5 rounded-lg p-3 border border-white/10 transition-all ${
                        !isCompleted && load.status === 'building' ? 'cursor-move hover:bg-white/10 hover:border-white/20' : 'cursor-default'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{assignment.studentName}</span>
                            {assignment.isRequest && <span className="text-yellow-400 text-sm">⭐</span>}
                          </div>
                          <div className="text-sm text-slate-400 mt-1">
                            {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                            {assignment.tandemWeightTax && ` • Tax: ${assignment.tandemWeightTax}`}
                            {assignment.tandemHandcam && ' • 📹 Handcam'}
                            {assignment.hasOutsideVideo && ' • 🎥 Video'}
                            {assignment.affLevel && ` • ${assignment.affLevel}`}
                          </div>
                          {assignment.instructorId ? (
                            <div className="text-sm text-green-400 mt-1">
                              TI: {assignment.instructorName}
                              {assignment.videoInstructorId && ` • 📹 ${assignment.videoInstructorName}`}
                            </div>
                          ) : (
                            <div className="text-sm text-red-400 mt-1">TI: 🔴 Not assigned</div>
                          )}
                        </div>
                        {!isCompleted && load.status === 'building' && (
                          <button
                            onClick={() => removeFromLoad(assignment.id)}
                            className="ml-2 p-1 text-red-400 hover:text-red-300 transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )
            })()
          )}
        </div>

        {unassignedCount > 0 && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-400">
                <span className="text-2xl">⚠️</span>
                <span className="font-semibold">{unassignedCount} student(s) need instructor assignment</span>
              </div>
              <div className="flex gap-2 text-sm">
                <div className={`px-3 py-1 rounded-lg ${isOverCapacity ? 'bg-red-500/20 text-red-400' : 'text-blue-400'}`}>Slots Left</div>
                <div className={`font-bold text-lg ${isOverCapacity ? 'text-red-400' : 'text-blue-400'}`}>
                  {Math.max(0, availableSlots)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
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
                  transition === 'ready' ? 'bg-green-500 hover:bg-green-600 text-white' :
                  transition === 'departed' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                  transition === 'completed' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                  'bg-slate-500 hover:bg-slate-600 text-white'
                }`}
              >
                {transitionConfig.icon} {transition === 'building' ? 'Mark Building' : 
                 transition === 'ready' ? 'Mark Ready' :
                 transition === 'departed' ? 'Mark Departed' : 'Mark Completed'}
              </button>
            )
          })}
        </div>
      </div>

      {/* MODALS */}
      {statusChangeConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setStatusChangeConfirm(null)}>
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-blue-500" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Confirm Status Change</h2>
              <p className="text-slate-300 mb-6">Change load status from <strong>{load.status}</strong> to <strong>{statusChangeConfirm}</strong>?</p>
              <div className="flex gap-3">
                <button onClick={() => setStatusChangeConfirm(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">Cancel</button>
                <button onClick={confirmStatusChange} disabled={loading} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-red-500" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">🗑️ Delete Load</h2>
              <p className="text-slate-300 mb-2">Are you sure you want to delete <strong className="text-white">{load.name}</strong>?</p>
              {loadAssignments.length > 0 && <p className="text-slate-400 text-sm mb-4">{loadAssignments.length} assignment(s) will be moved back to the queue.</p>}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDelayModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setShowDelayModal(false)}>
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-orange-500" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">⏰ Delay Load</h2>
              <p className="text-slate-300 mb-4">How many minutes would you like to delay <strong>{load.name}</strong>?</p>
              <input
                type="number" min="1" max="120" value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 20)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white mb-6 focus:outline-none focus:border-orange-500"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowDelayModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">Cancel</button>
                <button onClick={confirmDelay} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">Delay {delayMinutes} min</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setShowAssignModal(false)}>
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-purple-500" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
              <h2 className="text-2xl font-bold text-white">👤 Assign Instructors - {load.name}</h2>
              <p className="text-sm text-slate-400 mt-1">{unassignedCount} student(s) need instructor assignment</p>
            </div>
            
            <div className="p-6 space-y-4">
              {loadAssignments.filter(a => !a.instructorId).map(assignment => {
                const qualifiedInstructors = getQualifiedInstructors(assignment)
                const videoInstructors = getVideoInstructors()
                const selection = assignmentSelections[assignment.id]
                
                return (
                  <div key={assignment.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="mb-3">
                      <div className="font-bold text-white">{assignment.studentName}</div>
                      <div className="text-sm text-slate-400">
                        {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                        {assignment.tandemWeightTax && ` • Tax: ${assignment.tandemWeightTax}`}
                        {assignment.hasOutsideVideo && ' • 🎥 Outside Video'}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Tandem Instructor *</label>
                        <select
                          value={selection?.instructorId || ''}
                          onChange={(e) => setAssignmentSelections(prev => ({
                            ...prev,
                            [assignment.id]: {
                              ...prev[assignment.id],
                              instructorId: e.target.value
                            }
                          }))}
                          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="">Select instructor...</option>
                          {qualifiedInstructors.map(instructor => (
                            <option key={instructor.id} value={instructor.id}>
                              {instructor.name} (Balance: ${instructorBalances.get(instructor.id) || 0})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {assignment.hasOutsideVideo && assignment.jumpType === 'tandem' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Video Instructor (Optional)</label>
                          <select
                            value={selection?.videoInstructorId || ''}
                            onChange={(e) => setAssignmentSelections(prev => ({
                              ...prev,
                              [assignment.id]: {
                                ...prev[assignment.id],
                                videoInstructorId: e.target.value
                              }
                            }))}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="">Select video instructor...</option>
                            {videoInstructors.map(instructor => (
                              <option key={instructor.id} value={instructor.id}>
                                {instructor.name} (Balance: ${instructorBalances.get(instructor.id) || 0})
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
            
            <div className="border-t border-slate-700 p-6 sticky bottom-0 bg-slate-800 flex gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignInstructors}
                disabled={assignLoading || Object.keys(assignmentSelections).length === 0}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignLoading ? '⏳ Assigning...' : '✓ Assign Instructors'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}