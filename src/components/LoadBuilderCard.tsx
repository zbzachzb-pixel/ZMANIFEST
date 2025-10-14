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
  
  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  
  const handleDragLeave = () => {
    setDragOver(false)
  }
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    try {
      const studentData = e.dataTransfer.getData('application/json')
      const student: QueueStudent = JSON.parse(studentData)
      
      console.log('🎯 Student dropped on load:', student.name)
      
      // Find best instructor for this student
      const assignment = await assignInstructor(student)
      
      if (assignment) {
        // Add to load
        const updatedAssignments = [...loadAssignments, assignment]
        await update(load.id, { assignments: updatedAssignments })
        
        // TODO: Remove student from queue after successful assignment
        console.log('✅ Assignment added to load')
      } else {
        alert('No qualified instructors available for this student!')
      }
    } catch (error) {
      console.error('Failed to assign student:', error)
      alert('Failed to assign student. Please try again.')
    }
  }
  
  // Smart instructor assignment algorithm
  const assignInstructor = async (student: QueueStudent): Promise<any | null> => {
    const clockedIn = instructors.filter(i => i.clockedIn)
    
    // Filter qualified instructors based on jump type
    let qualified = clockedIn.filter(i => {
      if (student.jumpType === 'tandem') {
        return i.tandem && (!i.tandemWeightLimit || student.weight <= i.tandemWeightLimit)
      } else if (student.jumpType === 'aff') {
        return i.aff && (!i.affWeightLimit || student.weight <= i.affWeightLimit)
      }
      return false
    })
    
    if (qualified.length === 0) {
      return null
    }
    
    // Sort by balance (lowest first for fair rotation)
    qualified.sort((a, b) => {
      const balanceA = calculateInstructorEarnings(a.id, assignments, instructors, period)
      const balanceB = calculateInstructorEarnings(b.id, assignments, instructors, period)
      return balanceA - balanceB
    })
    
    const selectedInstructor = qualified[0]
    
    // Check if video is needed
    let videoInstructor = null
    if (student.outsideVideo) {
      const videoQualified = clockedIn.filter(i => {
        if (!i.video || i.id === selectedInstructor.id) return false
        
        // Check video weight restrictions if applicable
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
    
    // Create assignment
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
    if (confirm(`Delete ${load.name}?`)) {
      try {
        await deleteLoad(load.id)
      } catch (error) {
        console.error('Failed to delete:', error)
      }
    }
  }
  
  const handleStatusChange = async (newStatus: Load['status']) => {
    try {
      await update(load.id, { status: newStatus })
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }
  
  return (
    <div
      className={`rounded-xl shadow-xl p-6 border-2 transition-all ${
        dragOver
          ? 'border-blue-500 bg-blue-500/20 scale-105'
          : 'border-blue-500/30 bg-white/5'
      } backdrop-blur-lg`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{load.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-medium ${isOverCapacity ? 'text-red-400' : 'text-slate-400'}`}>
              {totalPeople}/{load.capacity} people
            </span>
            {availableSlots > 0 && (
              <span className="text-xs text-green-400">
                ({availableSlots} slots free)
              </span>
            )}
            {isOverCapacity && (
              <span className="text-xs text-red-400 font-bold">
                ⚠️ OVER!
              </span>
            )}
          </div>
        </div>
        
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-red-400 hover:text-red-300 text-sm"
        >
          🗑️
        </button>
      </div>
      
      {/* Assignments List */}
      <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
        {loadAssignments.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-600 rounded-lg">
            <div className="text-4xl mb-2">👇</div>
            <p className="text-sm">Drag students here</p>
          </div>
        ) : (
          loadAssignments.map((assignment, idx) => (
            <div key={assignment.id} className="bg-white/10 rounded-lg p-3 border border-white/20">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold text-sm">
                      #{idx + 1}
                    </span>
                    <span className="text-white font-medium">
                      {assignment.studentName}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                      {assignment.jumpType.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <div>👤 TI: {assignment.instructorName}</div>
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
      
      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => handleStatusChange('ready')}
          disabled={loading || loadAssignments.length === 0}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          ✓ Mark Ready
        </button>
      </div>
    </div>
  )
}