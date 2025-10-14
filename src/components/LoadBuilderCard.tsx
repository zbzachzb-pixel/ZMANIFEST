'use client'

import React, { useState } from 'react'
import type { Load, Instructor, Assignment, Period, QueueStudent } from '@/types'
import { useUpdateLoad, useDeleteLoad } from '@/hooks/useDatabase'
import { calculateInstructorEarnings } from '@/lib/utils'

interface LoadBuilderCardProps {
  load: Load
  instructors: Instructor[]
  assignments: Assignment[]
  period: Period
}

export function LoadBuilderCard({ load, instructors, assignments, period }: LoadBuilderCardProps) {
  const { update, loading: updateLoading } = useUpdateLoad()
  const { deleteLoad, loading: deleteLoading } = useDeleteLoad()
  const [dragOver, setDragOver] = useState(false)
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<Load['status'] | null>(null)
  
  const loading = updateLoading || deleteLoading
  const loadAssignments = load.assignments || []
  
  // Calculate people count (instructor + student + video if needed)
  const totalPeople = loadAssignments.reduce((sum, a) => {
    let count = 2 // Instructor + Student
    if (a.hasOutsideVideo) count += 1 // Video instructor
    return sum + count
  }, 0)
  
  const isOverCapacity = totalPeople > load.capacity
  const availableSlots = load.capacity - totalPeople
  const unassignedCount = loadAssignments.filter(a => !a.instructorId).length
  const percentFull = Math.round((totalPeople / load.capacity) * 100)
  
  // Status display configuration
  const statusConfig = {
    building: {
      color: 'blue',
      icon: '🔨',
      label: 'Building',
      bgClass: 'bg-blue-500/10 border-blue-500/30',
      textClass: 'text-blue-400'
    },
    ready: {
      color: 'green',
      icon: '✓',
      label: 'Ready',
      bgClass: 'bg-green-500/10 border-green-500/30',
      textClass: 'text-green-400'
    },
    departed: {
      color: 'yellow',
      icon: '✈️',
      label: 'Departed',
      bgClass: 'bg-yellow-500/10 border-yellow-500/30',
      textClass: 'text-yellow-400'
    },
    completed: {
      color: 'purple',
      icon: '🎉',
      label: 'Completed',
      bgClass: 'bg-purple-500/10 border-purple-500/30',
      textClass: 'text-purple-400'
    }
  }
  
  const currentStatus = statusConfig[load.status]
  
  // Handle drag and drop (only for building status)
  const handleDragOver = (e: React.DragEvent) => {
    if (load.status !== 'building') return
    e.preventDefault()
    setDragOver(true)
  }
  
  const handleDragLeave = () => {
    setDragOver(false)
  }
  
  const handleDrop = async (e: React.DragEvent) => {
    if (load.status !== 'building') return
    e.preventDefault()
    setDragOver(false)
    
    try {
      const studentData = e.dataTransfer.getData('application/json')
      const student: QueueStudent = JSON.parse(studentData)
      
      // Find best instructor for this student
      const assignment = await assignInstructor(student)
      
      if (assignment) {
        const updatedAssignments = [...loadAssignments, assignment]
        await update(load.id, { assignments: updatedAssignments })
      } else {
        alert('No qualified instructors available for this student!')
      }
    } catch (error) {
      console.error('Failed to assign student:', error)
      alert('Failed to assign student. Please try again.')
    }
  }
  
  // Smart instructor assignment
  const assignInstructor = async (student: QueueStudent): Promise<any | null> => {
    const clockedIn = instructors.filter(i => i.clockedIn)
    
    let qualified = clockedIn.filter(i => {
      if (student.jumpType === 'tandem') {
        return i.tandem && (!i.tandemWeightLimit || student.weight <= i.tandemWeightLimit)
      } else if (student.jumpType === 'aff') {
        return i.aff && (!i.affWeightLimit || student.weight <= i.affWeightLimit)
      }
      return false
    })
    
    if (qualified.length === 0) return null
    
    qualified.sort((a, b) => {
      const balanceA = calculateInstructorEarnings(a.id, assignments, instructors, period)
      const balanceB = calculateInstructorEarnings(b.id, assignments, instructors, period)
      return balanceA - balanceB
    })
    
    const selectedInstructor = qualified[0]
    
    let videoInstructor = null
    if (student.outsideVideo) {
      const videoQualified = clockedIn.filter(i => {
        if (!i.video || i.id === selectedInstructor.id) return false
        if (i.videoRestricted) {
          const combinedWeight = selectedInstructor.bodyWeight + student.weight
          if (i.videoMinWeight && combinedWeight < i.videoMinWeight) return false
          if (i.videoMaxWeight && combinedWeight > i.videoMaxWeight) return false
        }
        return true
      })
      
      if (videoQualified.length > 0) {
        videoQualified.sort((a, b) => {
          const balanceA = calculateInstructorEarnings(a.id, assignments, instructors, period)
          const balanceB = calculateInstructorEarnings(b.id, assignments, instructors, period)
          return balanceA - balanceB
        })
        videoInstructor = videoQualified[0]
      }
    }
    
    return {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      instructorId: selectedInstructor.id,
      instructorName: selectedInstructor.name,
      videoInstructorId: videoInstructor?.id,
      videoInstructorName: videoInstructor?.name,
      studentName: student.name,
      studentWeight: student.weight,
      jumpType: student.jumpType,
      isRequest: student.isRequest,
      tandemWeightTax: student.tandemWeightTax,
      tandemHandcam: student.tandemHandcam,
      hasOutsideVideo: student.outsideVideo,
      affLevel: student.affLevel
    }
  }
  
  const handleDelete = async () => {
    if (!confirm(`Delete ${load.name}?`)) return
    
    try {
      await deleteLoad(load.id)
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete load')
    }
  }
  
  const handleStatusChangeRequest = (newStatus: Load['status']) => {
    // Validation checks
    if (newStatus === 'ready' && unassignedCount > 0) {
      if (!confirm(`⚠️ Warning: ${unassignedCount} student(s) still need instructors. Mark as ready anyway?`)) {
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
      await update(load.id, { status: statusChangeConfirm })
      setStatusChangeConfirm(null)
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update status')
    }
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
        return ['departed'] // Allow reverting if needed
      default:
        return []
    }
  }
  
  const availableTransitions = getAvailableTransitions()
  
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
              <h3 className="text-xl font-bold text-white">{load.name}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 ${currentStatus.bgClass} ${currentStatus.textClass} border-2 ${currentStatus.bgClass.split(' ')[1]}`}>
                <span>{currentStatus.icon}</span>
                {currentStatus.label}
              </span>
            </div>
            
            <div className="space-y-2">
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
              
              {unassignedCount > 0 && load.status === 'building' && (
                <div className="text-xs text-yellow-400 font-semibold">
                  ⚠️ {unassignedCount} student{unassignedCount !== 1 ? 's' : ''} need instructor
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={handleDelete}
            disabled={loading || load.status === 'departed'}
            className="text-red-400 hover:text-red-300 text-sm ml-4 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={load.status === 'departed' ? 'Cannot delete departed load' : 'Delete load'}
          >
            🗑️
          </button>
        </div>

        {/* Assignments List */}
        <div className={`space-y-2 mb-4 max-h-96 overflow-y-auto rounded-lg p-3 transition-colors ${
          dragOver && load.status === 'building' ? 'bg-green-500/20' : 'bg-black/20'
        }`}>
          {loadAssignments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-600 rounded-lg">
              <div className="text-4xl mb-2">
                {load.status === 'building' ? '👇' : '✈️'}
              </div>
              <p className="text-sm">
                {load.status === 'building' ? 'Drag students here' : 'No assignments'}
              </p>
            </div>
          ) : (
            loadAssignments.map((assignment, idx) => (
              <div key={assignment.id} className="bg-white/10 rounded-lg p-3 border border-white/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold text-sm">
                        #{idx + 1} {assignment.studentName}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        assignment.jumpType === 'tandem' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {assignment.jumpType.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div>👤 TI: {assignment.instructorName || '⚠️ Not assigned'}</div>
                      {assignment.hasOutsideVideo && assignment.videoInstructorName && (
                        <div>📹 VI: {assignment.videoInstructorName}</div>
                      )}
                      <div>⚖️ {assignment.studentWeight} lbs</div>
                    </div>
                  </div>
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
              
              {/* Show relevant info based on status */}
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
                          {unassignedCount === 0 ? '✓ Yes' : `⚠️ ${unassignedCount} pending`}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                
                {statusChangeConfirm === 'departed' && (
                  <div className="text-center text-yellow-300">
                    ✈️ Load is taking off
                  </div>
                )}
                
                {statusChangeConfirm === 'completed' && (
                  <div className="text-center text-purple-300">
                    🎉 All jumpers safely on the ground
                  </div>
                )}
                
                {statusChangeConfirm === 'building' && (
                  <div className="text-center text-blue-300">
                    🔨 Return to building mode
                  </div>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStatusChangeConfirm(null)}
                  disabled={loading}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={loading}
                  className={`flex-1 font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    statusChangeConfirm === 'ready' ? 'bg-green-500 hover:bg-green-600' :
                    statusChangeConfirm === 'departed' ? 'bg-yellow-500 hover:bg-yellow-600' :
                    statusChangeConfirm === 'completed' ? 'bg-purple-500 hover:bg-purple-600' :
                    'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                >
                  {loading ? '⏳ Updating...' : '✓ Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}