// PASTE INTO: src/components/CreateGroupModal.tsx
// Replace the entire file with this:

'use client'

import React, { useState } from 'react'
import { useCreateGroup } from '@/hooks/useDatabase'
import { useToast } from '@/contexts/ToastContext'
import type { QueueStudent } from '@/types'

interface CreateGroupModalProps {
  selectedStudents: QueueStudent[]
  onClose: () => void
  onSuccess: () => void
}

export function CreateGroupModal({ selectedStudents, onClose, onSuccess }: CreateGroupModalProps) {
  const toast = useToast()
  const [groupName, setGroupName] = useState('')
  const { create, loading } = useCreateGroup()

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name')
      return
    }

    try {
      // ✅ FIX: Use studentAccountId (permanent) instead of queue ID (temporary)
      const studentAccountIds = selectedStudents.map(s => s.studentAccountId)
      
      console.log('Creating group with studentAccountIds:', studentAccountIds)
      await create(groupName, studentAccountIds)
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to create group:', error)
      toast.error('Failed to create group')
    }
  }

  const totalCapacity = selectedStudents.length * 2 + selectedStudents.filter(s => s.outsideVideo).length

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-blue-500"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-modal-title"
      >
        <div className="p-6">
          <h2 id="create-group-modal-title" className="text-2xl font-bold text-white mb-4">👥 Create Group</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Smith Family, Bachelor Party..."
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate()
                }
              }}
            />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
            <div className="text-sm text-blue-300 font-semibold mb-2">
              {selectedStudents.length} Students Selected
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {selectedStudents.map(student => (
                <div key={student.id} className="text-sm text-slate-300">
                  • {student.name} ({student.jumpType.toUpperCase()}, {student.weight} lbs)
                  {student.outsideVideo && <span className="text-purple-400 ml-2">📹</span>}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-blue-500/30">
              <div className="text-sm text-slate-400">
                Total Capacity: <span className={`font-bold ${totalCapacity > 18 ? 'text-red-400' : 'text-green-400'}`}>
                  {totalCapacity} / 18
                </span>
                {totalCapacity > 18 && <span className="text-red-400 ml-2">⚠️ Over capacity!</span>}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !groupName.trim()}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}