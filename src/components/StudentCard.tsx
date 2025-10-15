// src/components/StudentCard.tsx - Update to support dragging properly

'use client'

import React from 'react'
import type { QueueStudent } from '@/types'

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
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selection toggle
    onEdit()
  }

  const handleDragStart = (e: React.DragEvent) => {
    // Call the parent's drag start handler if provided
    if (onDragStart) {
      onDragStart(e)
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    // Reset opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

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
      }`}
    >
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
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{student.name}</h3>
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
            selected ? 'bg-blue-500 border-blue-500' : 'border-white/40'
          }`}>
            {selected && <span className="text-white text-xs">✓</span>}
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="flex gap-2 flex-wrap text-xs">
        {student.tandemWeightTax && student.tandemWeightTax > 0 && (
          <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">
            +{student.tandemWeightTax} lbs tax
          </span>
        )}
        {student.tandemHandcam && (
          <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
            📹 Handcam
          </span>
        )}
        {student.outsideVideo && (
          <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
            📹 Outside Video
          </span>
        )}
        {student.isRequest && (
          <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
            ⭐ Request
          </span>
        )}
      </div>
    </div>
  )
}