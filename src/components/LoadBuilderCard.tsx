'use client'

import React, { useState, useMemo } from 'react'
import { useUpdateLoad, useDeleteLoad } from '@/hooks/useDatabase'
import { useLoadCountdown, getInstructorNextAvailableLoad } from '@/hooks/useLoadCountdown'
import type { Load, Instructor, LoadSchedulingSettings } from '@/types'

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
  
  // Get countdown info
  const { countdown, formattedTime, isReadyToDepart } = useLoadCountdown(load, loadSchedulingSettings)
  
  const loadAssignments = load.assignments || []
  const totalPeople = loadAssignments.length
  const unassignedCount = loadAssignments.filter(a => !a.instructorId).length
  const percentFull = Math.round((totalPeople / load.capacity) * 100)
  const isOverCapacity = totalPeople > load.capacity
  const availableSlots = load.capacity - totalPeople

  // Status config
  const statusConfig = {
    building: {
      label: 'Building',
      icon: '🔨',
      bgClass: 'bg-blue-500/10',
      textClass: 'text-blue-400'
    },
    ready: {
      label: 'Ready',
      icon: '✅',
      bgClass: 'bg-green-500/10',
      textClass: 'text-green-400'
    },
    departed: {
      label: 'Departed',
      icon: '✈️',
      bgClass: 'bg-yellow-500/10',
      textClass: 'text-yellow-400'
    },
    completed: {
      label: 'Completed',
      icon: '🎉',
      bgClass: 'bg-purple-500/10',
      textClass: 'text-purple-400'
    }
  }

  const currentStatus = statusConfig[load.status]

  const handleDragOver = (e: React.DragEvent) => {
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
    // Validation
    if (newStatus === 'ready' && unassignedCount > 0) {
      if (!confirm(`⚠️ ${unassignedCount} student(s) not assigned to instructors.\n\nMark as ready anyway?`)) {
        return
      }
    }
    
    if (newStatus === 'ready' && isOverCapacity) {
      alert('❌ Cannot mark as ready: Load is over capacity!')
      return
    }
    
    if (newStatus === 'departed' && load.status !== 'ready') {
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
      
      // If marking as ready, start countdown
      if (statusChangeConfirm === 'ready' && !load.countdownStartTime) {
        updates.countdownStartTime = new Date().toISOString()
      }
      
      await update(load.id, updates)
      setStatusChangeConfirm(null)
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update status')
    }
  }
  
  const handleDelete = async () => {
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
  
  // Get available status transitions
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
  
  // Get instructor availability info
  const instructorAvailability = useMemo(() => {
    const clockedInInstructors = instructors.filter(i => i.clockedIn)
    return clockedInInstructors.map(instructor => {
      const nextAvailable = getInstructorNextAvailableLoad(instructor.id, allLoads)
      return {
        instructor,
        nextAvailable,
        isAvailable: nextAvailable === null || load.position >= nextAvailable
      }
    })
  }, [instructors, allLoads, load.position])
  
  return (
    <>
      <div
        className={`rounded-xl shadow-xl p-6 border-2 transition-all backdrop-blur-lg ${
          dragOver && load.status === 'building'
            ? 'border-green-500 bg-green-500/20 scale-105'
            : currentStatus.bgClass.replace('/10', '/5') + ' border-2 ' + currentStatus.bgClass.split(' ')[1]
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-white">
                {load.name}
                <span className="text-slate-400 text-sm ml-2">(#{load.position})</span>
              </h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 ${currentStatus.bgClass} ${currentStatus.textClass} border-2 ${currentStatus.bgClass.split(' ')[1]}`}>
                <span>{currentStatus.icon}</span>
                {currentStatus.label}
              </span>
            </div>
            
            {/* Countdown Display */}
            {countdown && (
              <div className={`mt-2 p-3 rounded-lg ${
                isReadyToDepart 
                  ? 'bg-green-500/20 border border-green-500' 
                  : 'bg-yellow-500/20 border border-yellow-500'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-lg">
                    {isReadyToDepart ? '🚀 Ready to Depart!' : `⏱️ ${formattedTime}`}
                  </span>
                  {load.status === 'ready' && !isReadyToDepart && (
                    <button
                      onClick={handleDelay}
                      className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold rounded transition-colors"
                    >
                      ⏸️ Delay
                    </button>
                  )}
                </div>
                {load.delayMinutes && load.delayMinutes > 0 && (
                  <div className="text-xs text-yellow-300 mt-1">
                    Delayed by {load.delayMinutes} minutes
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2 mt-3">
              <div className={`text-sm font-medium ${isOverCapacity ? 'text-red-400' : 'text-slate-400'}`}>
                {totalPeople}/{load.capacity} people ({percentFull}%)
              </div>
              
              <div className="w-full bg-white/10 rounded-full h-2">
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
            className="ml-4 p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            title="Delete Load"
          >
            🗑️
          </button>
        </div>

        {/* Assignments */}
        <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
          {loadAssignments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-600 rounded-lg">
              Drop students here from queue
            </div>
          ) : (
            loadAssignments.map((assignment, index) => (
              <div
                key={assignment.id}
                draggable={load.status === 'building'}
                onDragStart={() => load.status === 'building' && onDragStart('assignment', assignment.id, load.id)}
                onDragEnd={onDragEnd}
                className={`p-3 rounded-lg border transition-all ${
                  assignment.instructorId
                    ? 'bg-slate-700 border-slate-600'
                    : 'bg-yellow-900/30 border-yellow-600'
                } ${load.status === 'building' ? 'cursor-move hover:bg-slate-600' : ''}`}
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
                  
                  {load.status === 'building' && (
                    <button
                      onClick={() => handleRemoveAssignment(assignment.id)}
                      className="ml-2 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Stats */}
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

        {/* Instructor Availability */}
        {load.status === 'building' && instructorAvailability.length > 0 && (
          <div className="mb-4 pt-4 border-t border-white/20">
            <div className="text-sm font-semibold text-slate-300 mb-2">Instructor Availability:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {instructorAvailability.map(({ instructor, isAvailable, nextAvailable }) => (
                <div
                  key={instructor.id}
                  className={`text-xs p-2 rounded ${
                    isAvailable ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{instructor.name}</span>
                    {isAvailable ? (
                      <span className="text-green-400">🟢 Available</span>
                    ) : (
                      <span className="text-red-400">🔴 Available Load #{nextAvailable}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Action Buttons */}
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
                  transition === 'completed' ? 'bg-purple-500 hover:bg-purple-600 text-white' :
                  'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {transitionConfig.icon} Mark as {transitionConfig.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Status Change Confirmation Modal */}
      {statusChangeConfirm && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setStatusChangeConfirm(null)}
        >
          <div
            className={`bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 ${
              statusConfig[statusChangeConfirm].bgClass.split(' ')[1]
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                {statusConfig[statusChangeConfirm].icon} Change Load Status?
              </h2>
              <p className="text-slate-300 mb-4">
                Mark <strong className="text-white">{load.name}</strong> as{' '}
                <strong className={statusConfig[statusChangeConfirm].textClass}>
                  {statusConfig[statusChangeConfirm].label}
                </strong>
                ?
              </p>
              
              <div className="bg-white/5 rounded-lg p-3 mb-6 text-sm">
                {statusChangeConfirm === 'ready' && (
                  <>
                    <div className="text-slate-300 mb-2">Ready to depart:</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Students:</span>
                        <span className="text-white font-semibold">{loadAssignments.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Capacity:</span>
                        <span className={`font-semibold ${isOverCapacity ? 'text-red-400' : 'text-green-400'}`}>
                          {totalPeople}/{load.capacity}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">All assigned:</span>
                        <span className={`font-semibold ${unassignedCount === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {unassignedCount === 0 ? 'Yes ✓' : `No (${unassignedCount} unassigned)`}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStatusChangeConfirm(null)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors"
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
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowDelayModal(false)}
        >
          <div
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-yellow-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">⏸️ Delay Load</h2>
              <p className="text-slate-300 mb-4">
                Delay <strong className="text-white">{load.name}</strong> and all subsequent loads by:
              </p>
              
              <div className="mb-6">
                <label className="block text-white font-semibold mb-2">Minutes</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  step="5"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 20)}
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