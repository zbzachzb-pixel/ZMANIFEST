// src/components/StudentCard.tsx
// ✅ UPDATED: Shows notes in top right corner with tooltip

'use client'

import React, { useEffect, useState } from 'react'
import type { QueueStudent, StudentAccount } from '@/types'
import { db } from '@/services'

interface StudentCardProps {
  student: QueueStudent
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  groupColor?: string
  groupName?: string
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

export function StudentCard({ 
  student, 
  selected, 
  onToggle, 
  onEdit, 
  groupColor, 
  groupName,
  draggable = false,
  onDragStart
}: StudentCardProps) {
  const [studentAccount, setStudentAccount] = useState<StudentAccount | null>(null)
  const [showNotesTooltip, setShowNotesTooltip] = useState(false)

  // Fetch the student account to get the student ID and notes
  useEffect(() => {
    const fetchAccount = async () => {
      if (student.studentAccountId) {
        try {
          const account = await db.getStudentAccountById(student.studentAccountId)
          setStudentAccount(account)
        } catch (error) {
          console.error('Failed to fetch student account:', error)
        }
      }
    }
    fetchAccount()
  }, [student.studentAccountId])

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit()
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e)
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  const hasNotes = studentAccount?.notes && studentAccount.notes.trim().length > 0

  return (
    <div
      onClick={onToggle}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`bg-white/10 backdrop-blur-lg rounded-lg p-4 border-2 ${
        draggable ? 'cursor-move hover:shadow-lg' : 'cursor-pointer'
      } transition-all hover:bg-white/15 ${
        selected 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-white/20'
      } relative`}
    >
      {/* Notes Indicator - Top Right Corner */}
      {hasNotes && (
        <div 
          className="absolute top-2 right-2 z-10"
          onMouseEnter={() => setShowNotesTooltip(true)}
          onMouseLeave={() => setShowNotesTooltip(false)}
        >
          <div className="bg-amber-500/20 text-amber-300 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold border border-amber-500/30 cursor-help">
            📝
          </div>
          
          {/* Tooltip */}
          {showNotesTooltip && studentAccount && (
            <div className="absolute top-8 right-0 bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-xl min-w-[200px] max-w-[300px] z-50">
              <div className="text-xs font-semibold text-amber-300 mb-1">Notes:</div>
              <div className="text-xs text-slate-300 whitespace-pre-wrap break-words">
                {studentAccount.notes}
              </div>
              {/* Arrow pointer */}
              <div className="absolute -top-2 right-2 w-4 h-4 bg-slate-900 border-l border-t border-slate-600 transform rotate-45"></div>
            </div>
          )}
        </div>
      )}

      {/* Group Indicator */}
      {groupName && (
        <div className="mb-2 flex items-center gap-1">
          <div 
            className="text-xs font-semibold px-2 py-1 rounded"
            style={{ 
              backgroundColor: groupColor || '#8b5cf6',
              color: 'white'
            }}
          >
            👥 {groupName}
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 pr-8"> {/* Added pr-8 to make room for notes icon */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-white">{student.name}</h3>
            {studentAccount?.studentId && (
              <span className="text-xs font-mono bg-slate-700 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                ID: {studentAccount.studentId}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300">
            {student.weight} lbs • {student.jumpType.toUpperCase()}
            {student.jumpType === 'aff' && student.affLevel && ` (${student.affLevel})`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleEditClick}
            className="p-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors"
            title="Edit Student"
          >
            ✏️
          </button>
          
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            selected 
              ? 'bg-blue-500 border-blue-500' 
              : 'border-white/40'
          }`}>
            {selected && <span className="text-white text-xs">✓</span>}
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="flex flex-wrap gap-2 text-xs">
        {student.tandemWeightTax > 0 && (
          <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded">
            TAX x {student.tandemWeightTax}
          </span>
        )}
        {student.tandemHandcam && (
          <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
            📹 Handcam
          </span>
        )}
        {student.outsideVideo && (
          <span className="bg-pink-500/20 text-pink-300 px-2 py-1 rounded">
            🎥 Outside Video
          </span>
        )}
        {student.isRequest && (
          <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
            ⭐ Request
          </span>
        )}
      </div>
    </div>
  )
}