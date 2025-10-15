// src/components/GroupCard.tsx
'use client'

import React, { useState } from 'react'
import { useUpdateGroup, useDeleteGroup } from '@/hooks/useDatabase'
import type { Group, QueueStudent } from '@/types'

interface GroupCardProps {
  group: Group
  students?: QueueStudent[]
  onAssignGroup: (groupId: string) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, groupId: string) => void
  onStudentDrop?: (groupId: string, studentId: string) => Promise<void>
  onStudentDragStart?: (e: React.DragEvent, studentId: string) => void  // ← ADD THIS
}

export function GroupCard({ 
  group, 
  students = [],
  onAssignGroup, 
  draggable = false,
  onDragStart,
  onStudentDrop,
  onStudentDragStart  // ← ADD THIS
}: GroupCardProps) {

  const { update } = useUpdateGroup()
  const { deleteGroup, loading } = useDeleteGroup()
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [isDragOver, setIsDragOver] = useState(false)

  // Calculate load capacity
  // Each student needs 2 slots, plus 1 extra if they have outside video
  const totalCapacity = students.length * 2 + students.filter(s => s.outsideVideo).length
  const isOverCapacity = totalCapacity > 18

  const handleSaveName = async () => {
    if (!editName.trim()) return
    try {
      await update(group.id, { name: editName })
      setShowEdit(false)
    } catch (error) {
      console.error('Failed to update group:', error)
      alert('Failed to update group name')
    }
  }

  const handleDelete = async () => {
    const studentCount = students.length
    const message = `Delete group "${group.name}"?\n\n${studentCount} student${studentCount !== 1 ? 's' : ''} will remain in the queue individually.`
    
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
      e.dataTransfer.effectAllowed = 'move'
      onDragStart(e, group.id)
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }
  const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragOver(true)
}

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragOver(false)
}

const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragOver(false)
  
  const studentId = e.dataTransfer.getData('studentId')
  
  if (studentId && onStudentDrop) {
    try {
      await onStudentDrop(group.id, studentId)
    } catch (error) {
      console.error('Failed to add student to group:', error)
      alert('Failed to add student to group')
    }
  }
}

  return (
  <div 
    draggable={draggable}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
    className={`bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl p-4 transition-all ${
      isDragOver 
        ? 'border-4 border-green-400 scale-105 shadow-2xl bg-green-500/30' 
        : 'border-2 border-purple-500/50'
    } ${
      draggable ? 'cursor-move hover:scale-105 hover:shadow-xl' : ''
    }`}
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
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm flex-1 focus:outline-none focus:border-purple-500"
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
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-bold transition-colors"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setEditName(group.name)
                  setShowEdit(false)
                }}
                className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-purple-300 text-lg">👥 {group.name}</span>
              <button
                onClick={() => setShowEdit(true)}
                className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
                title="Edit group name"
              >
                ✏️
              </button>
            </div>
          )}
          <div className="text-xs text-slate-400 mt-1">
            {students.length} student{students.length !== 1 ? 's' : ''} • Capacity: {' '}
            <span className={isOverCapacity ? 'text-red-400 font-bold' : 'text-green-400'}>
              {totalCapacity} slots
            </span>
            {isOverCapacity && <span className="text-red-400 ml-2">⚠️ Over 18!</span>}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 px-3 py-2 rounded transition-all disabled:opacity-50"
          title="Delete entire group"
        >
          🗑️
        </button>
      </div>

      {/* Students List */}
      {students.length > 0 ? (
  <div className="space-y-2">
    {students.map(student => (
      <div
        key={student.id}
        draggable={!!onStudentDragStart}  // Only draggable if handler provided
        onDragStart={(e) => {
          if (onStudentDragStart) {
            e.stopPropagation()  // Don't trigger group drag
            onStudentDragStart(e, student.id)
          }
        }}
        className={`bg-slate-800/50 rounded-lg p-3 flex items-center justify-between ${
          onStudentDragStart ? 'cursor-move hover:bg-slate-700/50' : ''
        } transition-colors`}
      >
        <div className="flex-1">
          <div className="text-white font-medium">{student.name}</div>
          <div className="text-xs text-slate-400">
            {student.weight} lbs • {student.jumpType.toUpperCase()}
            {student.jumpType === 'aff' && student.affLevel && ` (${student.affLevel})`}
            {student.outsideVideo && ' 📹'}
          </div>
        </div>
        <button
          onClick={() => handleRemoveStudent(student.id)}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-2 rounded transition-colors"
          title="Remove from group"
        >
          ✕
        </button>
      </div>
    ))}
  </div>
) : (
  <div className="text-center py-4 text-slate-400 text-sm">
    No students in this group
  </div>
)}

      {/* Action Button */}
      {students.length > 0 && (
        <button
          onClick={() => onAssignGroup(group.id)}
          disabled={isOverCapacity}
          className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${
            isOverCapacity 
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isOverCapacity ? '⚠️ Over Capacity' : '✈️ Assign Entire Group to Load'}
        </button>
      )}
    </div>
  )
}