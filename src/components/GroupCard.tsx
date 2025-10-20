// src/components/GroupCard.tsx - FIXED to use studentAccountIds

'use client'

import React, { useState } from 'react'
import { useUpdateGroup, useDeleteGroup, useRemoveStudentFromGroup } from '@/hooks/useDatabase'
import { useToast } from '@/contexts/ToastContext'
import type { Group, QueueStudent } from '@/types'

interface GroupCardProps {
  group: Group
  students?: QueueStudent[]
  onAssignGroup: (groupId: string) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, groupId: string) => void
  onStudentDrop?: (groupId: string, studentId: string) => Promise<void>
  onStudentDragStart?: (e: React.DragEvent, studentId: string) => void
  onStudentDragEnd?: () => void
}

export function GroupCard({ 
  group, 
  students = [],
  onAssignGroup, 
  draggable = false,
  onDragStart,
  onStudentDrop,
  onStudentDragStart,
  onStudentDragEnd
}: GroupCardProps) {

  const { update } = useUpdateGroup()
  const { deleteGroup, loading } = useDeleteGroup()
  const { removeStudent } = useRemoveStudentFromGroup()
  const toast = useToast()
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [isDragOver, setIsDragOver] = useState(false)

  const totalCapacity = students.length * 2 + students.filter(s => s.outsideVideo).length
  const isOverCapacity = totalCapacity > 18

  const handleSaveName = async () => {
    if (!editName.trim()) return
    try {
      await update(group.id, { name: editName })
      setShowEdit(false)
    } catch (error) {
      console.error('Failed to update group:', error)
      toast.error('Failed to update group name')
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
      toast.error('Failed to delete group')
    }
  }

  // ✅ FIXED: Use studentAccountId instead of student.id
  const handleRemoveStudent = async (student: QueueStudent) => {
    // ✅ Check remaining count in studentAccountIds array
    const remainingCount = group.studentAccountIds.length - 1
    
    if (remainingCount <= 1) {
      const studentName = student.name
      const message = remainingCount === 1 
        ? `Removing ${studentName} will leave only 1 student. Groups need at least 2 students.\n\nDo you want to delete the entire group?`
        : `Removing ${studentName} will empty the group.\n\nDo you want to delete the entire group?`
      
      if (confirm(message)) {
        await handleDelete()
      }
      return
    }

    try {
      // ✅ FIX: Pass studentAccountId (permanent) instead of queue ID (temporary)
      await removeStudent(group.id, student.studentAccountId)
    } catch (error) {
      console.error('Failed to remove student from group:', error)
      toast.error('Failed to remove student from group')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (onStudentDrop) {
      e.preventDefault()
      setIsDragOver(true)
    }
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (onStudentDrop) {
      const studentId = e.dataTransfer.getData('studentId')
      if (studentId) {
        await onStudentDrop(group.id, studentId)
      }
    }
  }

  const handleStudentDragEnd = () => {
    if (onStudentDragEnd) {
      onStudentDragEnd()
    }
  }

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (onDragStart && draggable) {
          onDragStart(e, group.id)
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg p-4 transition-all ${
        isDragOver 
          ? 'border-4 border-green-400 scale-105 shadow-2xl bg-green-500/30' 
          : 'border-2 border-purple-500/50'
      } ${
        draggable ? 'cursor-move hover:scale-105 hover:shadow-xl' : ''
      }`}
    >
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
                aria-label="Save group name"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setEditName(group.name)
                  setShowEdit(false)
                }}
                className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm font-bold transition-colors"
                aria-label="Cancel editing"
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
                aria-label="Edit group name"
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
          aria-label="Delete entire group"
        >
          🗑️
        </button>
      </div>

      {students.length > 0 ? (
        <div className="space-y-2">
          {students.map(student => (
            <div
              key={student.id}
              draggable={!!onStudentDragStart}
              onDragStart={(e) => {
                if (onStudentDragStart) {
                  e.stopPropagation()
                  onStudentDragStart(e, student.id)
                }
              }}
              onDragEnd={handleStudentDragEnd}
              className={`bg-slate-800/50 rounded-lg p-3 flex items-center justify-between ${
                onStudentDragStart ? 'cursor-move hover:bg-slate-700/50' : ''
              } transition-all`}
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
                onClick={() => handleRemoveStudent(student)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-2 rounded transition-colors"
                title="Remove from group"
                aria-label="Remove from group"
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

      {students.length > 0 && (
        <button
          onClick={() => onAssignGroup(group.id)}
          disabled={isOverCapacity}
          className={`w-full mt-4 font-bold py-3 px-4 rounded-lg transition-colors ${
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