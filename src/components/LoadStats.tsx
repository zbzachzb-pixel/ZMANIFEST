// src/components/LoadStats.tsx
// Extracted from LoadBuilderCard.tsx - Displays load statistics (students, pay, capacity)

'use client'

import React from 'react'

interface LoadStatsProps {
  totalStudents: number
  totalPay: number
  totalPeople: number
  loadCapacity: number
  availableSlots: number
  isOverCapacity: boolean
}

export function LoadStats({
  totalStudents,
  totalPay,
  totalPeople,
  loadCapacity,
  availableSlots,
  isOverCapacity
}: LoadStatsProps) {
  if (totalStudents === 0) return null

  return (
    <div className="p-4 border-t border-white/10">
      <div className="flex flex-wrap gap-2">
        {/* Students Chip */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20">
          <span className="text-xs text-white/70">👥</span>
          <span className="text-sm font-semibold text-white">{totalStudents}</span>
          <span className="text-xs text-white/50">student{totalStudents !== 1 ? 's' : ''}</span>
        </div>

        {/* Pay Chip */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
          <span className="text-xs">💵</span>
          <span className="text-sm font-bold text-green-400">${totalPay}</span>
        </div>

        {/* Capacity Chip */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
          isOverCapacity
            ? 'bg-red-500/10 border-red-500/30'
            : availableSlots <= 2
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-blue-500/10 border-blue-500/30'
        }`}>
          <span className="text-xs">
            {isOverCapacity ? '⚠️' : availableSlots <= 2 ? '⏱️' : '✈️'}
          </span>
          <span className={`text-sm font-semibold ${
            isOverCapacity ? 'text-red-400' : availableSlots <= 2 ? 'text-orange-400' : 'text-blue-400'
          }`}>
            {totalPeople}/{loadCapacity}
          </span>
          <span className={`text-xs ${
            isOverCapacity ? 'text-red-400/70' : availableSlots <= 2 ? 'text-orange-400/70' : 'text-blue-400/70'
          }`}>
            {isOverCapacity
              ? `${Math.abs(availableSlots)} over`
              : `${availableSlots} slot${availableSlots !== 1 ? 's' : ''}`
            }
          </span>
        </div>
      </div>
    </div>
  )
}
