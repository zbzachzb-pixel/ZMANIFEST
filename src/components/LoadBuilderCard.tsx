// src/components/LoadBuilderCard.tsx - COMPLETE FILE WITH ALL FEATURES
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
    // ✅ Keep drag/drop disabled for completed loads (safety)
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

  // ✅ CONFIRMATION FOR COMPLETED LOADS
  const handleStatusChangeRequest = (newStatus: Load['status']) => {
    // Validation checks for forward movements
    if (newStatus === 'ready' && isOverCapacity) {
      alert('❌ Cannot mark as ready: Load is over capacity!')
      return
    }
    if (newStatus === 'ready' && unassignedCount > 0) {
      alert('❌ Cannot mark as ready: All students must have instructors assigned!')
      return
    }
    
    // ✅ Special confirmation for moving backwards from completed
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
        if (!load.countdownStartTime) {
          const previousLoad = allLoads.find(l => l.position === (load.position || 0) - 1)
          if (!previousLoad || previousLoad.status === 'departed' || previousLoad.status === 'completed') {
            updates.countdownStartTime = new Date().toISOString()
          }
        }
      }
      
      if (statusChangeConfirm === 'building') {
        if (load.countdownStartTime) {
          updates.countdownStartTime = null
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
      
      // Trigger next load countdown if this load just departed
      if (statusChangeConfirm === 'departed') {
        const nextLoad = allLoads.find(l => l.position === (load.position || 0) + 1)
        if (nextLoad && nextLoad.status === 'ready' && !nextLoad.countdownStartTime) {
          await update(nextLoad.id, { countdownStartTime: new Date().toISOString() })
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
  
  // ✅ ALLOW DELETION WITH EXTRA CONFIRMATION FOR COMPLETED
  const confirmDelete = async () => {
    setShowDeleteConfirm(false)
    
    // ✅ Extra warning for completed loads
    if (load.status === 'completed') {
      if (!confirm('⚠️ This load is COMPLETED. Are you sure you want to DELETE it? This cannot be undone!')) {
        return
      }
    }
    
    try {
      if (loadAssignments.length > 0) {
        for (const assignment of loadAssignments) {
          if (assignment.groupId) {
            const group = groups.find(g => g.id === assignment.groupId)
            if (group) {
              await db.updateGroup(assignment.groupId, {
                studentIds: [...group.studentIds, assignment.studentId]
              })
            }
          }
          
          const queueStudent: CreateQueueStudent = {
            name: assignment.studentName,
            weight: assignment.studentWeight,
            jumpType: assignment.jumpType,
            isRequest: false,
            tandemWeightTax: assignment.tandemWeightTax || 0,
            tandemHandcam: assignment.tandemHandcam || false,
            outsideVideo: assignment.hasOutsideVideo,
            affLevel: assignment.affLevel,
            groupId: assignment.groupId
          }
          
          const priorityTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          await db.addToQueue(queueStudent, priorityTimestamp)
        }
      }
      
      await deleteLoad(load.id)
    } catch (error) {
      console.error('Failed to delete load:', error)
      alert('Failed to delete load')
    }
  }

  const removeFromLoad = async (assignmentId: string) => {
    if (isCompleted) {
      alert('Cannot modify completed loads')
      return
    }
    
    try {
      const assignment = loadAssignments.find(a => a.id === assignmentId)
      if (!assignment) return
      
      if (assignment.groupId) {
        const group = groups.find(g => g.id === assignment.groupId)
        if (group) {
          await db.updateGroup(assignment.groupId, {
            studentIds: [...group.studentIds, assignment.studentId]
          })
        }
      }
      
      const updatedAssignments = loadAssignments.filter(a => a.id !== assignmentId)
      await update(load.id, { assignments: updatedAssignments })
      
      const queueStudent: CreateQueueStudent = {
        name: assignment.studentName,
        weight: assignment.studentWeight,
        jumpType: assignment.jumpType,
        isRequest: false,
        tandemWeightTax: assignment.tandemWeightTax || 0,
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
  
  // ✅ FIXED PROPERTY NAMES FOR BACKWARDS COMPATIBILITY
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

  return (
    <>
      <div
        className={`rounded-xl shadow-2xl p-6 border-2 backdrop-blur-lg transition-all ${
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
          <div className={`mb-4 p-4 rounded-lg border-2 transition-all ${
            isReadyToDepart ? 'bg-green-500/20 border-green-500 animate-pulse' : 
            countdown && countdown < 60 ? 'bg-yellow-500/20 border-yellow-500' : 'bg-blue-500/20 border-blue-500'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{isReadyToDepart ? '✅' : countdown && countdown < 60 ? '⏰' : '⏱️'}</div>
                <div>
                  <div className="text-sm text-slate-300">{isReadyToDepart ? 'READY TO DEPART!' : 'Departs in'}</div>
                  <div className="text-2xl font-bold text-white">{formattedTime}</div>
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
                          !isCompleted && load.status === 'building' ? 'cursor-move hover:border-purple-400 hover:shadow-lg' : 'cursor-default'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-purple-400 font-bold">👥 {group.name}</span>
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                              {groupAssignments.length} students
                            </span>
                          </div>
                        </div>
                        {groupAssignments.map(assignment => (
                          <div key={assignment.id} className="bg-white/5 rounded-lg p-2 border border-white/10">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white text-sm">{assignment.studentName}</span>
                                  {assignment.isRequest && <span className="text-xs text-yellow-400">⭐</span>}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                                  {assignment.tandemWeightTax && ` • Tax: ${assignment.tandemWeightTax}`}
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

        {totalPeople > 0 && (
          <div className="bg-white/5 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-slate-400">Students</div>
                <div className="text-white font-bold text-lg">{loadAssignments.length}</div>
              </div>
              <div>
                <div className="text-slate-400">Assigned</div>
                <div className="text-white font-bold text-lg">{loadAssignments.length - unassignedCount}</div>
              </div>
              <div>
                <div className={`${isOverCapacity ? 'text-red-400' : 'text-blue-400'}`}>Slots Left</div>
                <div className={`font-bold text-lg ${isOverCapacity ? 'text-red-400' : 'text-blue-400'}`}>
                  {Math.max(0, availableSlots)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ REMOVED !isCompleted WRAPPER - BUTTONS NOW ALWAYS VISIBLE */}
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
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Main Instructor</label>
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
                          <p className="text-red-400 text-xs mt-1">No qualified instructors available</p>
                        )}
                      </div>
                      
                      {assignment.hasOutsideVideo && assignment.jumpType === 'tandem' && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-300 mb-2">Video Instructor</label>
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