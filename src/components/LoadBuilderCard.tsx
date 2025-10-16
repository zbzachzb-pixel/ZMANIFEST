// src/components/LoadBuilderCard.tsx
// ✅ FIXED VERSION - Timer cascade properly handled when changing from ready to building
// ✅ 40-minute instructor cycle time enforcement
// ✅ Instructors can only be on loads with proper spacing
// ✅ Cascading timer system
// ✅ Bidirectional transitions at all stages

'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useUpdateLoad, useDeleteLoad, useGroups } from '@/hooks/useDatabase'
import { useLoadCountdown, isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
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
  const [delayMinutes, setDelayMinutes] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, {instructorId: string, videoInstructorId?: string}>>({})
  const [assignLoading, setAssignLoading] = useState(false)
  const [lastMilestone, setLastMilestone] = useState<number | null>(null)
  const [showBreathing, setShowBreathing] = useState(false)
  
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
  
  // Calculate metrics
  const totalStudents = loadAssignments.length
  const unassignedCount = loadAssignments.filter(a => !a.instructorId).length
  const loadCapacity = load.capacity || 18  // Default to 18 if undefined
  const availableSlots = loadCapacity - totalStudents
  const isOverCapacity = totalStudents > loadCapacity
  
  // Calculate total pay for the load
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
  
  // Get available transitions based on current status
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
  
  // Auto-select instructors for unassigned students
  const autoSelectInstructors = useMemo(() => {
    if (!showAssignModal) return {}
    
    const selections: Record<string, {instructorId: string, videoInstructorId?: string}> = {}
    const usedMainInstructors = new Set<string>()
    const usedVideoInstructors = new Set<string>()
    
    // First pass: assign main instructors
    loadAssignments.forEach(assignment => {
      if (!assignment.instructorId) {
        const qualifiedInstructors = getQualifiedInstructors(assignment)
        const availableForMain = qualifiedInstructors.filter(i => !usedMainInstructors.has(i.id))
        
        if (availableForMain.length > 0) {
          const selected = availableForMain[0]
          selections[assignment.id] = { instructorId: selected.id }
          usedMainInstructors.add(selected.id)
        }
      } else {
        usedMainInstructors.add(assignment.instructorId)
        if (assignment.videoInstructorId) {
          usedVideoInstructors.add(assignment.videoInstructorId)
        }
      }
    })
    
    // Second pass: assign video instructors
    loadAssignments.forEach(assignment => {
      if (assignment.hasOutsideVideo && !assignment.videoInstructorId) {
        const selection = selections[assignment.id]
        if (selection) {
          const videoInstructors = getVideoInstructors()
          const availableForVideo = videoInstructors.filter(i => 
            !usedVideoInstructors.has(i.id) && 
            i.id !== selection.instructorId &&
            !usedMainInstructors.has(i.id)
          )
          
          if (availableForVideo.length > 0) {
            const selectedVideo = availableForVideo[0]
            selection.videoInstructorId = selectedVideo.id
            usedVideoInstructors.add(selectedVideo.id)
            usedMainInstructors.add(selectedVideo.id)
          }
        }
      }
    })
    
    return selections
  }, [showAssignModal, loadAssignments, instructors, instructorBalances, allLoads, load.position, loadSchedulingSettings])
  
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

  // Milestone breathing effects
  useEffect(() => {
    if (load.status !== 'ready' || !countdown) {
      setLastMilestone(null)
      return
    }

    const minutes = Math.floor(countdown / 60)
    
    // More frequent milestones for better visual feedback
    if (minutes === 19 && lastMilestone !== 20) {
      setLastMilestone(20)
      setShowBreathing(true)
      setTimeout(() => setShowBreathing(false), 2000)
    }
    
    if (minutes === 14 && lastMilestone !== 15) {
      setLastMilestone(15)
      setShowBreathing(true)
      setTimeout(() => setShowBreathing(false), 2000)
    }
    
    if (minutes === 9 && lastMilestone !== 10) {
      setLastMilestone(10)
      setShowBreathing(true)
      setTimeout(() => setShowBreathing(false), 2000)
    }
    
    if (minutes === 4 && lastMilestone !== 5) {
      setLastMilestone(5)
      setShowBreathing(true)
      setTimeout(() => setShowBreathing(false), 2000)
    }
    
    if (minutes === 0 && countdown > 0 && countdown <= 60 && lastMilestone !== 1) {
      setLastMilestone(1)
      setShowBreathing(true)
      setTimeout(() => setShowBreathing(false), 2000)
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
    
    if (isReadyToDepart) {
      return {
        bg: 'bg-green-900/40',
        border: 'border-green-400',
        glow: 'shadow-[0_0_40px_rgba(34,197,94,0.7)] animate-pulse'
      }
    } else if (minutes >= 15) {
      return {
        bg: 'bg-white/10',
        border: 'border-blue-500/50',
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
  }

  const colors = getLoadColors()
  
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
  
  const removeFromLoad = async (assignmentId: string) => {
    if (isCompleted) return
    try {
      const assignment = loadAssignments.find(a => a.id === assignmentId)
      if (!assignment) return
      
      // Remove from load
      const updatedAssignments = loadAssignments.filter(a => a.id !== assignmentId)
      await update(load.id, { assignments: updatedAssignments })
      
      // Use original timestamp if available, otherwise use priority timestamp
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
      
      await db.addToQueue(queueStudent, timestamp)  // ✅ Use preserved timestamp
    } catch (error) {
      console.error('Failed to remove from load:', error)
      alert('Failed to remove student from load')
    }
  }
  
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
      const updates: Partial<Load> = { status: statusChangeConfirm }
      
      // Handle countdown timer logic
      if (statusChangeConfirm === 'ready') {
        const loadsBeforeThis = allLoads
          .filter(l => (l.position || 0) < (load.position || 0))
          .filter(l => l.status !== 'departed' && l.status !== 'completed')
        
        const hasUnreadyLoadsBefore = loadsBeforeThis.some(l => l.status === 'building')
        
        if (hasUnreadyLoadsBefore) {
          // There are building loads before this one - no timer
          (updates as any).countdownStartTime = null
        } else {
          // No building loads before this one
          const currentReadyLoads = allLoads
            .filter(l => l.status === 'ready')
            .sort((a, b) => (a.position || 0) - (b.position || 0))
          
          // Check if this will be the first ready load
          if (currentReadyLoads.length === 0 || (currentReadyLoads[0].position || 0) > (load.position || 0)) {
            // This will be the first ready load - give it a timer
            (updates as any).countdownStartTime = new Date().toISOString()
          } else {
            // Not the first ready load - calculate offset from first ready load
            const firstReadyLoad = currentReadyLoads[0]
            if ((firstReadyLoad as any).countdownStartTime) {
              // Calculate position difference for timer offset
              const positionDiff = (load.position || 0) - (firstReadyLoad.position || 0)
              const offsetMs = positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000
              
              // Calculate when this load's timer should start
              const firstLoadStartTime = new Date((firstReadyLoad as any).countdownStartTime).getTime()
              const thisLoadStartTime = firstLoadStartTime + offsetMs
              
              ;(updates as any).countdownStartTime = new Date(thisLoadStartTime).toISOString()
            } else {
              // First ready load doesn't have a timer yet - this shouldn't happen but handle it
              ;(updates as any).countdownStartTime = null
            }
          }
        }
      }
      
      // ============== CRITICAL FIX: Handle timer cascade when changing to building ==============
      if (statusChangeConfirm === 'building') {
        // 1. Clear timer from the current load being changed to building
        if ((load as any).countdownStartTime) {
          (updates as any).countdownStartTime = null
        }
        
        // 2. CRITICAL: Remove timers from ALL subsequent ready loads
        // These loads depend on this load being ready for their timers to be valid
        const subsequentReadyLoads = allLoads
          .filter(l => l.status === 'ready' && (l.position || 0) > (load.position || 0))
          .sort((a, b) => (a.position || 0) - (b.position || 0))
        
        // Clear all their timers since they now have a building load before them
        for (const subsequentLoad of subsequentReadyLoads) {
          await update(subsequentLoad.id, {
            countdownStartTime: null
          } as any)
        }
        
        // 3. Check if there's a new "first ready load" that needs a timer
        // This would be a ready load BEFORE the current load (if any)
        const readyLoadsBeforeThis = allLoads
          .filter(l => 
            l.status === 'ready' && 
            (l.position || 0) < (load.position || 0)
          )
          .sort((a, b) => (a.position || 0) - (b.position || 0))
        
        // Check if there are any building loads before the first ready load
        if (readyLoadsBeforeThis.length > 0) {
          const firstReadyLoad = readyLoadsBeforeThis[0]
          const loadsBeforeFirst = allLoads
            .filter(l => 
              (l.position || 0) < (firstReadyLoad.position || 0) &&
              l.status !== 'departed' && 
              l.status !== 'completed'
            )
          
          const hasUnreadyBeforeFirst = loadsBeforeFirst.some(l => l.status === 'building')
          
          // If the first ready load has no building loads before it, 
          // it should have a timer (if it doesn't already)
          if (!hasUnreadyBeforeFirst && !(firstReadyLoad as any).countdownStartTime) {
            await update(firstReadyLoad.id, {
              countdownStartTime: new Date().toISOString()
            } as any)
            
            // Cascade timers to subsequent ready loads that come before the current load
            const subsequentToFirst = readyLoadsBeforeThis.slice(1)
            for (const subsequentLoad of subsequentToFirst) {
              const positionDiff = subsequentLoad.position - firstReadyLoad.position
              const targetRemainingMs = loadSchedulingSettings.minutesBetweenLoads * 60 * 1000 * positionDiff
              const newStartTime = Date.now() + targetRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              
              await update(subsequentLoad.id, {
                countdownStartTime: new Date(newStartTime).toISOString()
              } as any)
            }
          }
        }
      }
      // ============== END OF FIX ==============
      
      if (statusChangeConfirm === 'departed') {
        updates.departedAt = new Date().toISOString()
      }
      
      if (statusChangeConfirm === 'completed') {
        updates.completedAt = new Date().toISOString()
      }
      
      await update(load.id, updates)
      setStatusChangeConfirm(null)
      
      // Update subsequent ready loads when marking ready
      if (statusChangeConfirm === 'ready') {
        const startedTimer = (updates as any).countdownStartTime
        
        if (startedTimer) {
          const subsequentReadyLoads = allLoads
            .filter(l => l.status === 'ready' && l.position > (load.position || 0))
            .sort((a, b) => (a.position || 0) - (b.position || 0))
          
          if (subsequentReadyLoads.length > 0) {
            const thisLoadStartTime = new Date(startedTimer).getTime()
            const thisLoadTargetTime = thisLoadStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
            const thisLoadRemainingMs = loadSchedulingSettings.minutesBetweenLoads * 60 * 1000
            
            for (const subsequentLoad of subsequentReadyLoads) {
              const positionDiff = subsequentLoad.position - (load.position || 0)
              const targetRemainingMs = thisLoadRemainingMs + (positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              const newStartTime = Date.now() + targetRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
              
              await update(subsequentLoad.id, {
                countdownStartTime: new Date(newStartTime).toISOString()
              } as any)
            }
          }
        }
      }
      
      // Handle departed status - reset subsequent ready loads
      if (statusChangeConfirm === 'departed') {
        const currentReadyLoads = allLoads
          .filter(l => l.status === 'ready')
          .sort((a, b) => (a.position || 0) - (b.position || 0))
        
        if (currentReadyLoads.length > 0) {
          const firstReadyLoad = currentReadyLoads[0]
          
          await update(firstReadyLoad.id, {
            countdownStartTime: new Date().toISOString()
          } as any)
          
          const nowStartTime = Date.now()
          const nowTargetTime = nowStartTime + (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
          const nowRemainingMs = loadSchedulingSettings.minutesBetweenLoads * 60 * 1000
          
          for (const subsequentLoad of currentReadyLoads.slice(1)) {
            const positionDiff = subsequentLoad.position - firstReadyLoad.position
            const targetRemainingMs = nowRemainingMs + (positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
            const newStartTime = Date.now() + targetRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
            
            await update(subsequentLoad.id, {
              countdownStartTime: new Date(newStartTime).toISOString()
            } as any)
          }
        }
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update status')
    }
  }
  
  const handleDelay = async () => {
    try {
      // If this load has a timer, adjust it by the delay amount
      if ((load as any).countdownStartTime) {
        const currentStartTime = new Date((load as any).countdownStartTime).getTime()
        const delayMs = delayMinutes * 60 * 1000
        const newStartTime = new Date(currentStartTime + delayMs).toISOString()
        
        // Update this load's timer
        await update(load.id, {
          countdownStartTime: newStartTime,
          delayMinutes: (load.delayMinutes || 0) + delayMinutes
        } as any)
        
        // Update all subsequent ready loads' timers as well
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
        // If no timer yet, just track the delay amount
        await update(load.id, {
          delayMinutes: (load.delayMinutes || 0) + delayMinutes
        } as any)
      }
      
      // Call the parent's onDelay handler if needed for additional processing
      await onDelay(load.id, delayMinutes)
      setShowDelayModal(false)
    } catch (error) {
      console.error('Failed to delay load:', error)
      alert('Failed to delay load')
    }
  }
  
  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }
    
    try {
      if (isCompleted) {
        if (!confirm('⚠️ This load is COMPLETED. Are you absolutely sure you want to delete it?')) {
          setShowDeleteConfirm(false)
          return
        }
      }
      
      for (const assignment of loadAssignments) {
        await db.addToQueue({
          studentAccountId: assignment.studentId,
          name: assignment.studentName,
          weight: assignment.studentWeight,
          jumpType: assignment.jumpType,
          isRequest: assignment.isRequest,
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
      
      await deleteLoad(load.id)
      
      // Handle timer cascading after deletion
      if (load.status === 'ready' && (load as any).countdownStartTime) {
        const allRemainingReadyLoads = allLoads
          .filter(l => l.id !== load.id && l.status === 'ready')
          .sort((a, b) => (a.position || 0) - (b.position || 0))
        
        if (allRemainingReadyLoads.length > 0) {
          const newFirstReadyLoad = allRemainingReadyLoads[0]
          
          if ((newFirstReadyLoad as any).countdownStartTime) {
            const remainingTime = Math.max(0, 
              new Date((newFirstReadyLoad as any).countdownStartTime).getTime() + 
              (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000) - 
              Date.now()
            )
            
            if (remainingTime > 0) {
              const targetRemainingMs = loadSchedulingSettings.minutesBetweenLoads * 60 * 1000
              
              for (const subsequentLoad of allRemainingReadyLoads) {
                const positionDiff = subsequentLoad.position - newFirstReadyLoad.position
                const targetRemainingMs = loadSchedulingSettings.minutesBetweenLoads * 60 * 1000 + (positionDiff * loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
                const newStartTime = Date.now() + targetRemainingMs - (loadSchedulingSettings.minutesBetweenLoads * 60 * 1000)
                
                await update(subsequentLoad.id, {
                  countdownStartTime: new Date(newStartTime).toISOString()
                } as any)
              }
            } else if (newFirstReadyLoad.id === allRemainingReadyLoads[0]?.id) {
              await update(newFirstReadyLoad.id, {
                countdownStartTime: new Date().toISOString()
              } as any)
              
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
      
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Failed to delete load:', error)
      alert('Failed to delete load')
    }
  }
  
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
  
  const getQualifiedInstructors = (assignment: any) => {
    const qualified = instructors.filter(instructor => {
      if (!instructor.clockedIn) return false
      
      // Check availability based on load position and cycle time
      const isAvailable = isInstructorAvailableForLoad(
        instructor.id,
        load.position || 0,
        allLoads,
        loadSchedulingSettings.instructorCycleTime,
        loadSchedulingSettings.minutesBetweenLoads
      )
      
      if (!isAvailable) return false
      
      // ✅ CLEAN: Use correct property names directly
      if (assignment.jumpType === 'tandem' && !instructor.canTandem) return false
      if (assignment.jumpType === 'aff' && !instructor.canAFF) return false
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
  
  // ✅ CLEAN: Check video instructor availability
  const getVideoInstructors = () => {
    return instructors.filter(i => {
      // ✅ CLEAN: Use correct property name directly
      if (!i.clockedIn || !i.canVideo) return false
      
      // Check availability based on load position
      const isAvailable = isInstructorAvailableForLoad(
        i.id,
        load.position || 0,
        allLoads,
        loadSchedulingSettings.instructorCycleTime,
        loadSchedulingSettings.minutesBetweenLoads
      )
      
      return isAvailable
    }).sort((a, b) => {
      const balanceA = instructorBalances.get(a.id) || 0
      const balanceB = instructorBalances.get(b.id) || 0
      return balanceA - balanceB
    })
  }
  
  return (
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`${colors.bg} ${colors.glow} border-2 ${colors.border} rounded-xl p-4 transition-all duration-300 ${
          dragOver && dropTarget === load.id ? 'ring-4 ring-blue-400 scale-105' : ''
        } ${isCompleted ? 'opacity-75' : ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <h3 className="text-lg font-bold text-white">
              {load.name}
            </h3>
          </div>
          <div className={`px-3 py-1 rounded-full ${currentStatus.color} text-white text-sm font-bold`}>
            {currentStatus.emoji} {currentStatus.label}
          </div>
        </div>
        
        {/* Timer Display - Prominent and Eye-catching */}
        {load.status === 'ready' && isActive && (
          <div className={`mb-4 rounded-lg overflow-hidden ${
            isReadyToDepart ? 'bg-green-500/30 border-2 border-green-400 animate-pulse' :
            countdown && countdown > 0 ? (
              Math.floor(countdown / 60) >= 15 ? 'bg-blue-500/20 border-2 border-blue-400' :
              Math.floor(countdown / 60) >= 5 ? 'bg-orange-500/20 border-2 border-orange-400' :
              'bg-red-500/30 border-2 border-red-400 animate-pulse'
            ) : 'bg-slate-700/50 border-2 border-slate-600'
          }`}>
            <div className={`text-center py-3 px-4 ${
              isReadyToDepart ? 'bg-green-500/50' :
              countdown && countdown > 0 ? (
                Math.floor(countdown / 60) >= 15 ? 'bg-blue-500/30' :
                Math.floor(countdown / 60) >= 5 ? 'bg-orange-500/30' :
                'bg-red-500/50'
              ) : 'bg-slate-700/30'
            }`}>
              <div className="text-sm font-semibold uppercase tracking-wider mb-1 text-white/90">
                {isReadyToDepart ? '🚀 CLEARED FOR DEPARTURE' : 
                 countdown && countdown > 0 ? '⏱️ TIME TO DEPARTURE' : '⏸️ TIMER PAUSED'}
              </div>
              <div className={`text-4xl font-bold ${
                isReadyToDepart ? 'text-green-100' :
                countdown && countdown > 0 ? (
                  Math.floor(countdown / 60) >= 15 ? 'text-white' :
                  Math.floor(countdown / 60) >= 5 ? 'text-yellow-100' :
                  'text-white'
                ) : 'text-slate-400'
              }`}>
                {countdown && countdown > 0 ? 
                  `${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}` : 
                  isReadyToDepart ? 'GO!' : 'WAITING'}
              </div>
              {countdown && countdown > 0 && !isReadyToDepart && (
                <div className="mt-2">
                  <div className="w-full bg-black/30 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        Math.floor(countdown / 60) >= 15 ? 'bg-blue-400' :
                        Math.floor(countdown / 60) >= 5 ? 'bg-orange-400' :
                        'bg-red-400'
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
          </div>
        )}
        
        {/* Students */}
        <div className="space-y-2 mb-3 max-h-96 overflow-y-auto">
          {loadAssignments.length === 0 ? (
            <div className="text-center text-slate-400 py-4">
              Drop students here
            </div>
          ) : (
            (() => {
              const groupedData: { [key: string]: typeof loadAssignments } = {}
              
              loadAssignments.forEach(assignment => {
                const groupKey = (assignment as any).originalGroupId || assignment.id
                if (!groupedData[groupKey]) {
                  groupedData[groupKey] = []
                }
                groupedData[groupKey].push(assignment)
              })
              
              return (
                <>
                  {Object.entries(groupedData).map(([groupKey, assignments]) => (
                    <div key={groupKey}>
                      {assignments.length > 1 && (
                        <div className="bg-purple-500/20 border border-purple-500/40 rounded-lg p-2 mb-1">
                          <div className="text-xs font-bold text-purple-300">
                            👥 GROUP ({assignments.length} students)
                          </div>
                        </div>
                      )}
                      
                      {assignments.map(assignment => (
                        <div
                          key={assignment.id}
                          draggable={!isCompleted && load.status === 'building'}
                          onDragStart={() => onDragStart('assignment', assignment.id, load.id)}
                          onDragEnd={onDragEnd}
                          className={`bg-white/5 border border-white/10 rounded-lg p-3 ${
                            !isCompleted && load.status === 'building' ? 'cursor-move hover:bg-white/10' : 'cursor-default'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-white">{assignment.studentName}</div>
                              <div className="text-sm text-slate-400">
                                {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                                {assignment.tandemWeightTax && ` • Tax: ${assignment.tandemWeightTax}`}
                                {assignment.hasOutsideVideo && ' • 🎥 Video'}
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
                            {!isCompleted && load.status === 'building' && (
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
                  ))}
                </>
              )
            })()
          )}
        </div>
        
        {/* Metrics */}
        {totalStudents > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3 pt-3 border-t border-white/10">
            <div className="text-center">
              <div className="text-xs text-slate-400">Total Pay</div>
              <div className="font-bold text-lg text-green-400">${totalPay}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400">Students</div>
              <div className="font-bold text-lg text-white">
                {totalStudents}/{loadCapacity}
                {isOverCapacity && <span className="text-red-400 ml-1">⚠️</span>}
              </div>
            </div>
            <div className="text-center">
              <div className={`text-xs ${isOverCapacity ? 'bg-red-500/20 text-red-400' : 'text-blue-400'}`}>Slots Left</div>
              <div className={`font-bold text-lg ${isOverCapacity ? 'text-red-400' : 'text-blue-400'}`}>
                {Math.max(0, availableSlots)}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
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
                  transition === 'ready' ?
                    'bg-blue-500 hover:bg-blue-600 text-white' :
                  transition === 'departed' ?
                    'bg-green-500 hover:bg-green-600 text-white' :
                  transition === 'completed' ?
                    'bg-purple-500 hover:bg-purple-600 text-white' :
                    'bg-slate-600 hover:bg-slate-700 text-white'
                }`}
              >
                {transitionConfig.emoji} Mark as {transitionConfig.label}
              </button>
            )
          })}
          
          {load.status === 'ready' && isActive && (
            <button
              onClick={() => setShowDelayModal(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              ⏰ Adjust Timer
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
      
      {/* Confirmation Modal */}
      {statusChangeConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
            <div className="p-6">
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
        </div>
      )}
      
      {/* Timer Adjustment Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Adjust Timer</h3>
              <div className="mb-4">
                <div className="text-sm text-slate-400 mb-2">
                  Current time remaining: {countdown ? `${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}` : 'N/A'}
                </div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Adjustment (use negative to shorten)
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setDelayMinutes(-10)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold"
                  >
                    -10
                  </button>
                  <button
                    onClick={() => setDelayMinutes(-5)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => setDelayMinutes(0)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-bold"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setDelayMinutes(5)}
                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold"
                  >
                    +5
                  </button>
                  <button
                    onClick={() => setDelayMinutes(10)}
                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold"
                  >
                    +10
                  </button>
                </div>
                <input
                  type="number"
                  min="-60"
                  max="60"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
                <div className="text-xs text-slate-400 mt-1">
                  {delayMinutes > 0 ? `Timer will be delayed by ${delayMinutes} minutes` : 
                   delayMinutes < 0 ? `Timer will be shortened by ${Math.abs(delayMinutes)} minutes` :
                   'No change'}
                </div>
                {countdown && delayMinutes !== 0 && (
                  <div className="text-sm text-blue-400 mt-2">
                    New time: {Math.max(0, Math.floor((countdown + delayMinutes * 60) / 60))}:{((countdown + delayMinutes * 60) % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDelayModal(false)
                    setDelayMinutes(20)
                  }}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelay}
                  disabled={delayMinutes === 0}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {delayMinutes > 0 ? 'Add Time' : delayMinutes < 0 ? 'Remove Time' : 'No Change'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Confirm Delete</h3>
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
        </div>
      )}
      
      {/* Assign Instructors Modal */}
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
              {loadAssignments.filter(a => !a.instructorId).map(assignment => {
                const selection = assignmentSelections[assignment.id]
                const qualifiedInstructors = getQualifiedInstructors(assignment)
                const videoInstructors = getVideoInstructors()
                
                return (
                  <div key={assignment.id} className="border border-slate-600 rounded-lg p-4">
                    <div className="mb-3">
                      <div className="font-semibold text-white">{assignment.studentName}</div>
                      <div className="text-sm text-slate-400">
                        {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                        {assignment.tandemWeightTax && ` • Tax: ${assignment.tandemWeightTax}`}
                        {assignment.hasOutsideVideo && ' • 🎥 Needs Video'}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Main Instructor</label>
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
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="">Select instructor...</option>
                          {qualifiedInstructors.map(instructor => (
                            <option key={instructor.id} value={instructor.id}>
                              {instructor.name} (Balance: ${instructorBalances.get(instructor.id) || 0})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {assignment.hasOutsideVideo && (
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Video Instructor</label>
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
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
            
            <div className="border-t border-slate-700 p-6 flex gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={assignLoading || Object.keys(assignmentSelections).length === 0}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignLoading ? '⏳ Assigning...' : '✓ Assign All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}