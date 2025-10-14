// src/components/LoadBuilderCard.tsx
// THIS VERSION HAS DEBUG LOGGING TO FIND THE ISSUE

'use client'

import React, { useState, useMemo } from 'react'
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
  
  // Get countdown info with debug logging
  const { countdown, formattedTime, isReadyToDepart } = useLoadCountdown(load, loadSchedulingSettings, allLoads)
  
  // 🐛 DEBUG: Log everything about the timer
  console.log('🐛 TIMER DEBUG for', load.name, {
    status: load.status,
    position: load.position,
    countdownStartTime: load.countdownStartTime,
    countdown: countdown,
    formattedTime: formattedTime,
    isReadyToDepart: isReadyToDepart,
    loadSchedulingSettings: loadSchedulingSettings,
    allLoadsCount: allLoads.length,
    
    // Check display conditions
    displayConditions: {
      isReady: load.status === 'ready',
      hasFormattedTime: !!formattedTime,
      formattedTimeValue: formattedTime,
      shouldShow: load.status === 'ready' && !!formattedTime
    }
  })
  
  const loadAssignments = load.assignments || []
  const totalPeople = loadAssignments.length
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
    if (load.status === 'completed' && newStatus === 'departed') {
      const firstConfirm = confirm(
        `⚠️ WARNING: Reopen Completed Load?\n\n` +
        `This will move "${load.name}" from COMPLETED back to DEPARTED status.\n\n` +
        `This action should only be done if the load was marked completed by mistake.\n\n` +
        `Do you want to continue?`
      )
      
      if (!firstConfirm) return
      
      const secondConfirm = confirm(
        `🔴 SECOND CONFIRMATION REQUIRED 🔴\n\n` +
        `Are you absolutely sure you want to reopen this completed load?\n\n` +
        `Load: ${load.name}\n` +
        `Action: COMPLETED → DEPARTED\n\n` +
        `Click OK to proceed or Cancel to abort.`
      )
      
      if (!secondConfirm) return
    }
    
    if (newStatus === 'ready' && unassignedCount > 0) {
      if (!confirm(`⚠️ ${unassignedCount} student(s) not assigned to instructors.\n\nMark as ready anyway?`)) {
        return
      }
    }
    
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
    
    setStatusChangeConfirm(newStatus)
  }
  
  const confirmStatusChange = async () => {
    if (!statusChangeConfirm) return
    
    try {
      const updates: Partial<Load> = { status: statusChangeConfirm }
      
      if (statusChangeConfirm === 'ready' && !load.countdownStartTime) {
        updates.countdownStartTime = new Date().toISOString()
        console.log('🐛 Setting countdownStartTime:', updates.countdownStartTime)
      }
      
      if (statusChangeConfirm === 'building' && load.countdownStartTime) {
        updates.countdownStartTime = null
      }
      
      console.log('🐛 About to update load with:', updates)
      await update(load.id, updates)
      console.log('🐛 Update complete')
      setStatusChangeConfirm(null)
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update status')
    }
  }
  
  const handleDelete = async () => {
    if (isCompleted && !confirm('⚠️ This load is completed. Are you sure you want to delete it?')) return
    if (!confirm(`Delete ${load.name}? This cannot be undone.`)) return
    
    try {
      await deleteLoad(load.id)
    } catch (error) {
      console.error('Failed to delete load:', error)
      alert('Failed to delete load')
    }
  }
  
  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const assignment = loadAssignments.find(a => a.id === assignmentId)
      if (!assignment) return
      
      const queueStudent: CreateQueueStudent = {
        name: assignment.studentName,
        weight: assignment.studentWeight,
        jumpType: assignment.jumpType,
        isRequest: false,
        tandemWeightTax: assignment.tandemWeightTax,
        tandemHandcam: assignment.tandemHandcam,
        outsideVideo: assignment.hasOutsideVideo,
        affLevel: assignment.affLevel
      }
      
      await db.addToQueue(queueStudent)
      await update(load.id, {
        assignments: loadAssignments.filter(a => a.id !== assignmentId)
      })
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
        isAvailable: nextAvailable === null || load.position >= nextAvailable
      }
    })
  }, [instructors, allLoads, load.position, loadSchedulingSettings])
  
  // 🐛 DEBUG: Log if timer should be showing
  const shouldShowTimer = load.status === 'ready' && formattedTime
  if (load.status === 'ready') {
    console.log('🐛 Timer should show?', shouldShowTimer, 'formattedTime:', formattedTime)
  }
  
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

        {/* 🐛 DEBUG SECTION - Shows what the timer sees */}
        {load.status === 'ready' && (
          <div className="mb-4 p-3 bg-purple-900/30 border border-purple-500 rounded text-xs text-purple-300 font-mono">
            <div>🐛 DEBUG INFO:</div>
            <div>Status: {load.status}</div>
            <div>Position: {load.position}</div>
            <div>countdownStartTime: {load.countdownStartTime || 'NOT SET'}</div>
            <div>formattedTime: "{formattedTime}" (length: {formattedTime?.length || 0})</div>
            <div>countdown: {countdown}</div>
            <div>Should show timer: {shouldShowTimer ? 'YES' : 'NO'}</div>
          </div>
        )}

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

        {/* Assignments */}
        <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
          {loadAssignments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-600 rounded-lg">
              {isCompleted ? 'No assignments' : 'Drop students here from queue'}
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

        {!isCompleted && (
          <div className="space-y-2">
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
                <p className="text-xs text-slate-400 mt-2">
                  This will push back loads {load.position}+ by {delayMinutes} minutes
                </p>
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
    </>
  )
}