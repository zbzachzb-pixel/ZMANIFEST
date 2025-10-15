// src/components/GroupCard.tsx - FIXED VERSION

'use client'

import React, { useState } from 'react'
import { useUpdateGroup, useDeleteGroup } from '@/hooks/useDatabase'
import type { Group, QueueStudent } from '@/types'

interface GroupCardProps {
  group: Group & { students?: QueueStudent[] }  // 🔥 Accept students directly
  onAssignGroup: (groupId: string) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, groupId: string) => void
}

export function GroupCard({ 
  group, 
  onAssignGroup, 
  draggable = false,
  onDragStart 
}: GroupCardProps) {
  const { update } = useUpdateGroup()
  const { deleteGroup, loading } = useDeleteGroup()
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(group.name)

  // 🔥 FIXED: Use students passed directly from parent instead of fetching
  const students = group.students || []
  const totalCapacity = students.length * 2 + students.filter(s => s.outsideVideo).length
  const overCapacity = totalCapacity > 18

  const handleSaveName = async () => {
    if (!editName.trim()) return
    try {
      await update(group.id, { name: editName })
      setShowEdit(false)
    } catch (error) {
      console.error('Failed to update group:', error)
      alert('Failed to update group')
    }
  }

  const handleDelete = async () => {
    const studentCount = students.length
    const message = `Delete group "${group.name}"?\n\n${studentCount} student${studentCount > 1 ? 's' : ''} will remain in the queue individually.`
    
    if (!confirm(message)) return
    
    try {
      await deleteGroup(group.id)
    } catch (error) {
      console.error('Failed to delete group:', error)
      alert('Failed to delete group')
    }
  }

  const handleRemoveStudent = async (studentId: string) => {
    const updatedStudentIds = group.studentIds.filter(id => id !== studentId)
    
    // If removing this student leaves only 1 or 0, offer to dissolve group
    if (updatedStudentIds.length <= 1) {
      const remainingCount = updatedStudentIds.length
      const studentName = students.find(s => s.id === studentId)?.name || 'this student'
      const message = remainingCount === 1 
        ? `Removing ${studentName} will leave only 1 student. Groups need at least 2 students.\n\nDo you want to delete the entire group?`
        : `Removing ${studentName} will empty the group.\n\nDo you want to delete the entire group?`
      
      if (confirm(message)) {
        await handleDelete()
      }
      return
    }
    
    try {
      await update(group.id, { studentIds: updatedStudentIds })
    } catch (error) {
      console.error('Failed to remove student from group:', error)
      alert('Failed to remove student from group')
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, group.id)
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  return (
    <div 
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500/50 rounded-lg p-4 ${
        draggable ? 'cursor-move hover:scale-105 hover:shadow-xl' : ''
      } transition-all`}
    >
      {/* Group Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          {showEdit ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') {
                    setEditName(group.name)
                    setShowEdit(false)
                  }
                }}
              />
              <button
                onClick={handleSaveName}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setEditName(group.name)
                  setShowEdit(false)
                }}
                className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-purple-300 text-lg">👥 {group.name}</span>
              <button
                onClick={() => setShowEdit(true)}
                className="text-slate-400 hover:text-slate-300 text-sm"
                title="Edit group name"
              >
                ✏️
              </button>
            </div>
          )}
          <div className="text-xs text-slate-400 mt-1">
            {students.length} students • Capacity: {' '}
            <span className={overCapacity ? 'text-red-400 font-bold' : 'text-green-400'}>
              {totalCapacity} slots
            </span>
            {overCapacity && <span className="text-red-400 ml-2">⚠️ Over capacity!</span>}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 px-3 py-2 rounded transition-all ml-2"
          title="Delete entire group"
        >
          🗑️
        </button>
      </div>

      {/* Students */}
      <div className="space-y-2 mb-3">
        {students.map(student => (
          <div key={student.id} className="bg-slate-800/50 rounded-lg p-2 flex items-center justify-between hover:bg-slate-800/70 transition-colors group">
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{student.name}</div>
              <div className="text-xs text-slate-400">
                {student.jumpType.toUpperCase()} • {student.weight} lbs
                {student.outsideVideo && <span className="text-purple-400 ml-2">📹</span>}
                {student.affLevel && <span className="text-blue-400 ml-2">({student.affLevel})</span>}
              </div>
            </div>
            <button
              onClick={() => handleRemoveStudent(student.id)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/20 text-sm px-2 py-1 rounded transition-all opacity-70 group-hover:opacity-100"
              title="Remove from group"
            >
              ✕ Remove
            </button>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <button
        onClick={() => onAssignGroup(group.id)}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        ✈️ Assign Entire Group to Load
      </button>
    </div>
  )
}