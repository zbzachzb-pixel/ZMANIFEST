'use client'

import React, { useState } from 'react'
import type { QueueStudent, Instructor } from '@/types'
import { useRemoveFromQueue } from '@/hooks/useDatabase'
import { useToast } from '@/contexts/ToastContext'
import { filterQualifiedInstructors } from '@/lib/instructorUtils'

interface QueuePanelProps {
  queue: QueueStudent[]
  instructors: Instructor[]
  onAddStudent: () => void
}

export function QueuePanel({ queue, instructors, onAddStudent }: QueuePanelProps) {
  const { remove, loading: removeLoading } = useRemoveFromQueue()
  const toast = useToast()
  const [filter, setFilter] = useState<'all' | 'tandem' | 'aff'>('all')
  
  const filteredQueue = queue.filter(student => {
    if (filter === 'all') return true
    return student.jumpType === filter
  })
  
  const tandemCount = queue.filter(s => s.jumpType === 'tandem').length
  const affCount = queue.filter(s => s.jumpType === 'aff').length
  
  const handleDragStart = (e: React.DragEvent, student: QueueStudent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(student))
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleRemove = async (studentId: string) => {
    if (confirm('Remove this student from queue?')) {
      try {
        await remove(studentId)
      } catch (error) {
        console.error('Failed to remove:', error)
        toast.error('Failed to remove student')
      }
    }
  }
  
  // ✅ REFACTORED: Use shared utility function instead of duplicate logic
  const getQualifiedInstructors = (student: QueueStudent): Instructor[] => {
    return filterQualifiedInstructors(student, instructors)
  }
  
  return (
    <div className="w-96 bg-slate-900/95 backdrop-blur-lg border-l border-white/20 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-lg border-b border-white/20 p-6 z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Queue</h2>
          <button
            onClick={onAddStudent}
            className="bg-green-500 hover:bg-green-600 text-white font-bold p-2 rounded-lg transition-colors"
            title="Add Student"
            aria-label="Add Student"
          >
            <span className="text-xl">+</span>
          </button>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            All ({queue.length})
          </button>
          <button
            onClick={() => setFilter('tandem')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
              filter === 'tandem'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            Tandem ({tandemCount})
          </button>
          <button
            onClick={() => setFilter('aff')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
              filter === 'aff'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            AFF ({affCount})
          </button>
        </div>
      </div>
      
      {/* Queue List */}
      <div className="p-4 space-y-3">
        {filteredQueue.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm">No students in queue</p>
            <button
              onClick={onAddStudent}
              className="mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Add Student
            </button>
          </div>
        ) : (
          filteredQueue.map(student => {
            const qualified = getQualifiedInstructors(student)
            const hasQualified = qualified.length > 0
            
            return (
              <div
                key={student.id}
                draggable
                onDragStart={(e) => handleDragStart(e, student)}
                className="bg-white/10 rounded-lg p-4 border border-white/20 cursor-move hover:bg-white/20 hover:border-blue-500 transition-all group"
              >
                {/* Student Info */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-white mb-1">
                      {student.name}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        student.jumpType === 'tandem'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {student.jumpType.toUpperCase()}
                      </span>
                      
                      <span className="text-xs text-slate-400">
                        {student.weight} lbs
                      </span>
                      
                      {/* Fix: Check if tandemWeightTax exists and is > 0 */}
                      {student.jumpType === 'tandem' && student.tandemWeightTax && student.tandemWeightTax > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded">
                          {student.tandemWeightTax}x Tax
                        </span>
                      )}
                      
                      {student.tandemHandcam && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded">
                          Handcam
                        </span>
                      )}
                      
                      {student.outsideVideo && (
                        <span className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded">
                          📹 Video
                        </span>
                      )}
                      
                      {student.isRequest && (
                        <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded">
                          Request
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleRemove(student.id)}
                    disabled={removeLoading}
                    className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from queue"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Qualified Instructors Info */}
                <div className="mt-2 pt-2 border-t border-white/10">
                  {hasQualified ? (
                    <div className="text-xs text-green-400">
                      ✓ {qualified.length} qualified instructor{qualified.length !== 1 ? 's' : ''} available
                    </div>
                  ) : (
                    <div className="text-xs text-red-400">
                      ⚠️ No qualified instructors clocked in
                    </div>
                  )}
                </div>
                
                {/* Drag Hint */}
                <div className="mt-2 text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  👆 Drag to a load
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}