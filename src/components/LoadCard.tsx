'use client'

import React from 'react'
import type { Load } from '@/types'
import { useUpdateLoad, useDeleteLoad } from '@/hooks/useDatabase'

interface LoadCardProps {
  load: Load
}

export function LoadCard({ load }: LoadCardProps) {
  const { update, loading: updateLoading } = useUpdateLoad()
  const { deleteLoad, loading: deleteLoading } = useDeleteLoad()
  
  const assignments = load.assignments || []
  const totalPeople = assignments.reduce((sum, a) => {
    let count = 2 // Instructor + Student
    if (a.hasOutsideVideo) count += 1 // Video instructor
    return sum + count
  }, 0)
  
  const isOverCapacity = totalPeople > load.capacity
  const loading = updateLoading || deleteLoading
  
  const handleStatusChange = async (newStatus: Load['status']) => {
    try {
      await update(load.id, { status: newStatus })
    } catch (error) {
      console.error('Failed to update load:', error)
      alert('Failed to update load status. Please try again.')
    }
  }
  
  const handleDelete = async () => {
    const confirmMessage = assignments.length > 0
      ? `This load has ${assignments.length} assignment(s). Delete anyway?`
      : 'Delete this load?'
    
    if (confirm(confirmMessage)) {
      try {
        await deleteLoad(load.id)
      } catch (error) {
        console.error('Failed to delete load:', error)
        alert('Failed to delete load. Please try again.')
      }
    }
  }
  
  const statusColors = {
    building: 'border-blue-500 bg-blue-500/10',
    ready: 'border-green-500 bg-green-500/10',
    departed: 'border-yellow-500 bg-yellow-500/10',
    completed: 'border-gray-500 bg-gray-500/10'
  }
  
  const statusBadgeColors = {
    building: 'bg-blue-500/20 text-blue-300',
    ready: 'bg-green-500/20 text-green-300',
    departed: 'bg-yellow-500/20 text-yellow-300',
    completed: 'bg-gray-500/20 text-gray-300'
  }
  
  return (
    <div className={`rounded-xl shadow-lg p-6 border-2 ${statusColors[load.status]} backdrop-blur-lg`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">
            {load.name}
          </h3>
          <p className={`text-sm font-medium ${isOverCapacity ? 'text-red-400' : 'text-slate-400'}`}>
            {totalPeople}/{load.capacity} people
            {isOverCapacity && ' ⚠️ OVER CAPACITY'}
          </p>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusBadgeColors[load.status]}`}>
          {load.status}
        </span>
      </div>
      
      {/* Assignments List */}
      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
        {assignments.length === 0 ? (
          <p className="text-slate-400 text-center py-4 text-sm">
            No assignments yet
          </p>
        ) : (
          assignments.map((assignment) => (
            <div key={assignment.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-white text-sm">
                    👤 {assignment.instructorName} + {assignment.studentName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                    {assignment.hasOutsideVideo && ` • 📹 ${assignment.videoInstructorName}`}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {load.status === 'building' && (
          <button
            onClick={() => handleStatusChange('ready')}
            disabled={loading}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ✓ Mark Ready
          </button>
        )}
        
        {load.status === 'ready' && (
          <>
            <button
              onClick={() => handleStatusChange('building')}
              disabled={loading}
              className="flex-1 bg-slate-500 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              ← Building
            </button>
            <button
              onClick={() => handleStatusChange('departed')}
              disabled={loading}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              🚀 Departed
            </button>
          </>
        )}
        
        {load.status === 'departed' && (
          <button
            onClick={() => handleStatusChange('completed')}
            disabled={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ✓ Completed
          </button>
        )}
        
        {/* Delete Button - Always visible */}
        <button
          onClick={handleDelete}
          disabled={loading}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  )
}