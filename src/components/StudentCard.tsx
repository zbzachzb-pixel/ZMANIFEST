'use client'

import React from 'react'
import type { QueueStudent } from '@/types'

interface StudentCardProps {
  student: QueueStudent
  selected: boolean
  onToggle: () => void
}

export function StudentCard({ student, selected, onToggle }: StudentCardProps) {
  return (
    <div
      onClick={onToggle}
      className={`bg-white/10 backdrop-blur-lg rounded-lg p-4 border-2 cursor-pointer transition-all hover:bg-white/15 ${
        selected 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-white/20'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-bold text-white">{student.name}</h3>
          <p className="text-sm text-slate-300">
            {student.weight} lbs • {student.jumpType.toUpperCase()}
            {student.jumpType === 'aff' && ` (${student.affLevel})`}
          </p>
        </div>
        
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
          selected ? 'bg-blue-500 border-blue-500' : 'border-white/40'
        }`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {student.jumpType === 'tandem' && (
          <>
            {student.tandemWeightTax !== undefined && student.tandemWeightTax > 0 && (
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-semibold">
                {student.tandemWeightTax}x Tax
              </span>
            )}
            {student.tandemHandcam && (
              <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-semibold">
                Handcam
              </span>
            )}
            {student.outsideVideo && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                Outside Video
              </span>
            )}
          </>
        )}
        
        {student.isRequest && (
          <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-semibold">
            Request
          </span>
        )}
      </div>
    </div>
  )
}