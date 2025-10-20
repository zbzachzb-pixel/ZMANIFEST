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
    <div className="p-5 border-t border-white/10">
      <div className="flex flex-wrap gap-3">
        {/* Students Chip */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 shadow-sm hover:bg-white/15 transition-colors">
          <span className="text-base text-white/70">👥</span>
          <span className="text-base font-bold text-white">{totalStudents}</span>
          <span className="text-sm text-white/60 font-medium">student{totalStudents !== 1 ? 's' : ''}</span>
        </div>

        {/* Pay Chip */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/40 shadow-sm hover:bg-green-500/25 transition-colors">
          <span className="text-base">💵</span>
          <span className="text-base font-extrabold text-green-300">${totalPay}</span>
        </div>

        {/* Capacity Chip */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm transition-colors ${
          isOverCapacity
            ? 'bg-red-500/20 border-red-500/40 hover:bg-red-500/25'
            : availableSlots <= 2
            ? 'bg-orange-500/20 border-orange-500/40 hover:bg-orange-500/25'
            : 'bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/25'
        }`}>
          <span className="text-base">
            {isOverCapacity ? '⚠️' : availableSlots <= 2 ? '⏱️' : '✈️'}
          </span>
          <span className={`text-base font-bold ${
            isOverCapacity ? 'text-red-300' : availableSlots <= 2 ? 'text-orange-300' : 'text-blue-300'
          }`}>
            {totalPeople}/{loadCapacity}
          </span>
          <span className={`text-sm font-medium ${
            isOverCapacity ? 'text-red-300/80' : availableSlots <= 2 ? 'text-orange-300/80' : 'text-blue-300/80'
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
