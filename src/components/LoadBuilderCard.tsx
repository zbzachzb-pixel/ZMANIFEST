// src/components/LoadBuilderCard.tsx
// ✅ COMPLETELY CLEANED VERSION - All backwards compatibility removed
// ✅ 40-minute instructor cycle time enforcement
// ✅ Instructors can only be on loads with proper spacing
// ✅ Cascading timer system
// ✅ Bidirectional transitions at all stages

'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useUpdateLoad, useDeleteLoad, useGroups } from '@/hooks/useDatabase'
import { useLoadCountdown, isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import { db } from '@/services'
import type { Load, Instructor, LoadSchedulingSettings } from '@/types'

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
  const [lastMilestone, setLastMilestone] = useState<number | null>(null)
  const [showBreathing, setShowBreathing] = useState(false)
  
  const { countdown } = useLoadCountdown(load, loadSchedulingSettings)
  
  const loadAssignments = load.assignments || []
  const isCompleted = load.status === 'completed'
  
  const statusConfig = {
    building: { label: 'Building', emoji: '🔧', color: 'bg-slate-700', borderClass: 'border-slate-500/50' },
    ready: { label: 'Ready', emoji: '✅', color: 'bg-blue-600', borderClass: 'border-blue-500/50' },
    departed: { label: 'Departed', emoji: '✈️', color: 'bg-green-600', borderClass: 'border-green-500/50' },
    completed: { label: 'Completed', emoji: '🎉', color: 'bg-purple-600', borderClass: 'border-purple-500/50' }
  }
  
  const currentStatus = statusConfig[load.status]
  
  const availableTransitions = useMemo(() => {
    const transitions: Load['status'][] = []
    
    if (load.status === 'building') transitions.push('ready')
    if (load.status === 'ready') transitions.push('building', 'departed')
    if (load.status === 'departed') transitions.push('ready', 'completed')
    if (load.status === 'completed') transitions.push('departed')
    
    return transitions
  }, [load.status])
  
  const totalPeople = loadAssignments.reduce((sum, a) => {
    let count = 2
    if (a.hasOutsideVideo) count += 1
    return sum + count
  }, 0)
  
  const availableSlots = (load.capacity || 18) - totalPeople
  const isOverCapacity = totalPeople > (load.capacity || 18)
  
  const unassignedCount = loadAssignments.filter(a => !a.instructorId).length
  
  // ✅ CLEAN: Auto-select instructors with availability checking
  const autoSelectInstructors = useMemo(() => {
    if (!showAssignModal) return {}
    
    const selections: Record<string, {instructorId: string, videoInstructorId?: string}> = {}
    const usedMainInstructors = new Set<string>()
    const usedVideoInstructors = new Set<string>()
    
    // Only track instructors already assigned on THIS load
    const assignments = loadAssignments || []
    assignments.forEach(a => {
      if (a.instructorId) {
        usedMainInstructors.add(a.instructorId)
      }
      if (a.videoInstructorId) {
        usedVideoInstructors.add(a.videoInstructorId)
        usedMainInstructors.add(a.videoInstructorId)
      }
    })
    
    const unassignedAssignments = loadAssignments.filter(a => !a.instructorId)
    
    unassignedAssignments.forEach((assignment) => {
      const clockedIn = instructors.filter(i => i.clockedIn)
      
      const qualified = clockedIn.filter(instructor => {
        // Only exclude if already used on THIS load
        if (usedMainInstructors.has(instructor.id)) return false
        
        // Check if instructor is available for this load based on 40-minute cycle
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
            // ✅ CLEAN: Use correct property name directly
            if (!i.clockedIn || !i.canVideo) return false
            if (i.id === selectedInstructor.id) return false
            if (usedVideoInstructors.has(i.id)) return false
            if (usedMainInstructors.has(i.id)) return false
            
            // Check if video instructor is available for this load
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
    
    if (minutes === 19 && lastMilestone !== 20) {
      setLastMilestone(20)
      setShowBreathing(true)
      setTimeout(() => setShowBreathing(false), 1000)
    }
    
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
      return {
        bg: 'bg-white/10',
        border: 'border-blue-500/50',
        glow: showBreathing ? 'shadow-[0_0_30px_rgba(59,130,246,0.6)]' : ''
      }
    } else if (minutes >= 10) {
      return {
        bg: 'bg-orange-900/20',
        border: 'border-orange-500/60',
        glow: showBreathing ? 'shadow-[0_0_30px_rgba(251,146,60,0.6)]' : ''
      }
    } else {
      return {
        bg: 'bg-red-900/20',
        border: 'border-red-500/60',
        glow: showBreathing ? 'shadow-[0_0_30px_rgba(239,68,68,0.6)]' : ''
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
      const updatedAssignments = loadAssignments.filter(a => a.id !== assignmentId)
      await update(load.id, { assignments: updatedAssignments })
    } catch (error) {
      console.error('Failed to remove from load:', error)
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
          (updates as any).countdownStartTime = null
        } else {
          const allReadyLoads = allLoads
            .filter(l => l.status === 'ready' || l.id === load.id)
            .sort((a, b) => (a.position || 0) - (b.position || 0))
          
          const firstReadyLoad = allReadyLoads[0]
          const isFirstReadyLoad = firstReadyLoad && firstReadyLoad.id === load.id
          
          if (isFirstReadyLoad) {
            (updates as any).countdownStartTime = new Date().toISOString()
          } else {
            (updates as any).countdownStartTime = null
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
          studentAccountId: studentAccountId,
          name: assignment.studentName,
          weight: assignment.studentWeight,
          jumpType: assignment.jumpType,
          addedAt: new Date().toISOString(),
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
    } catch (error) {
      console.error('Failed to delete load:', error)
      alert('Failed to delete load')
    }
  }
  
  const handleBulkAssign = async () => {
    if (Object.keys(assignmentSelections).length === 0) {
      alert('No instructor selections made')
      return
    }
    
    setAssignLoading(true)
    try {
      const updatedAssignments = loadAssignments.map(assignment => {
        const selection = assignmentSelections[assignment.id]
        if (selection) {
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
  
  // ✅ CLEAN: Check instructor availability based on load position and 40-minute cycle
  const getQualifiedInstructors = (assignment: typeof loadAssignments[0]) => {
    const clockedIn = instructors.filter(i => i.clockedIn)
    const qualified = clockedIn.filter(instructor => {
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
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">{currentStatus.emoji}</span>
              {load.name}
            </h3>
            <p className="text-sm text-slate-400">
              Capacity: {totalPeople}/{load.capacity || 18} • Slots: {availableSlots}
            </p>
          </div>
          
          {/* Timer Display */}
          {load.status === 'ready' && countdown && (
            <div className="text-right">
              <div className={`text-3xl font-bold ${
                Math.floor(countdown / 60) >= 20 ? 'text-blue-400' :
                Math.floor(countdown / 60) >= 10 ? 'text-orange-400' :
                'text-red-400'
              }`}>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </div>
              <div className="text-xs text-slate-400">until departure</div>
            </div>
          )}
        </div>
        
        {/* Status Badge */}
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${currentStatus.color} text-white`}>
            {currentStatus.label}
          </span>
        </div>
        
        {/* Assignments List */}
        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
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
                    </div>
                  ))}
                </>
              )
            })()
          )}
        </div>

        {/* Unassigned Warning */}
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
              ⏰ Delay Load
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
      
      {/* Delay Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Delay Load</h3>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Delay by (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white mb-4"
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
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Confirm Delete</h3>
              <p className="text-slate-300 mb-6">
                {isCompleted 
                  ? '⚠️ This is a COMPLETED load. Are you absolutely sure you want to delete it?'
                  : 'Are you sure you want to delete this load? Students will be returned to the queue.'}
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
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
            <div className="border-b border-slate-700 p-6">
              <h3 className="text-2xl font-bold text-white">Assign Instructors</h3>
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
                        {assignment.hasOutsideVideo && ' • 🎥 Video'}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">Main Instructor</label>
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
                        {qualifiedInstructors.length === 0 && (
                          <p className="text-xs text-red-400 mt-1">⚠️ No qualified instructors available for this load position</p>
                        )}
                      </div>
                      
                      {assignment.hasOutsideVideo && assignment.jumpType === 'tandem' && (
                        <div>
                          <label className="block text-sm font-semibold text-white mb-2">Video Instructor</label>
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