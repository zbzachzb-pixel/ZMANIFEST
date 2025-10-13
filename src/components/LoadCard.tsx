'use client'

import React from 'react'
import type { Load } from '@/types'
import { useUpdateLoad } from '@/hooks/useDatabase'

interface LoadCardProps {
  load: Load
}

export function LoadCard({ load }: LoadCardProps) {
  const { update, loading } = useUpdateLoad()
  
  const assignments = load.assignments || []
  const totalPeople = assignments.reduce((sum, a) => {
    let count = 2
    if (a.hasOutsideVideo) count += 1
    return sum + count
  }, 0)
  
  const isOverCapacity = totalPeople > load.capacity
  
  const handleStatusChange = async (newStatus: Load['status']) => {
    try {
      await update(load.id, { status: newStatus })
    } catch (error) {
      console.error('Failed to update load:', error)
    }
  }
  
  const statusColors = {
    building: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
    ready: 'border-green-500 bg-green-50 dark:bg-green-950',
    departed: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
    completed: 'border-gray-500 bg-gray-50 dark:bg-gray-950'
  }
  
  const statusBadgeColors = {
    building: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    ready: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    departed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    completed: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
  }
  
  return (
    <div className={`rounded-xl shadow-lg p-6 border-2 ${statusColors[load.status]}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {load.name}
          </h3>
          <p className={`text-sm font-medium ${isOverCapacity ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {totalPeople}/{load.capacity} people
            {isOverCapacity && ' ⚠️ OVER CAPACITY'}
          </p>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusBadgeColors[load.status]}`}>
          {load.status}
        </span>
      </div>
      
      <div className="space-y-2 mb-4">
        {assignments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">
            No assignments yet
          </p>
        ) : (
          assignments.map((assignment) => (
            <div key={assignment.id} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    👤 {assignment.instructorName} + {assignment.studentName}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {assignment.jumpType.toUpperCase()} • {assignment.studentWeight} lbs
                    {assignment.hasOutsideVideo && ` • 📹 ${assignment.videoInstructorName}`}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="flex gap-2">
        {load.status === 'building' && (
          <button
            onClick={() => handleStatusChange('ready')}
            disabled={loading}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            ✓ Mark Ready
          </button>
        )}
        
        {load.status === 'ready' && (
          <button
            onClick={() => handleStatusChange('departed')}
            disabled={loading}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            🚀 Departed
          </button>
        )}
        
        {load.status === 'departed' && (
          <button
            onClick={() => handleStatusChange('completed')}
            disabled={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            ✓ Completed
          </button>
        )}
      </div>
    </div>
  )
}