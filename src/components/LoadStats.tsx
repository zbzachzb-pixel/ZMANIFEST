// src/components/LoadStats.tsx
// Extracted from LoadBuilderCard.tsx - Displays load capacity with visual progress bar

'use client'

import React from 'react'

interface LoadStatsProps {
  totalStudents: number
  totalPeople: number
  loadCapacity: number
  availableSlots: number
  isOverCapacity: boolean
}

export function LoadStats({
  totalStudents,
  totalPeople,
  loadCapacity,
  availableSlots,
  isOverCapacity
}: LoadStatsProps) {
  if (totalStudents === 0) return null

  // Calculate fill percentage (cap at 100% for visual bar)
  const fillPercentage = Math.min(100, (totalPeople / loadCapacity) * 100)

  // Determine color based on capacity
  const getColor = () => {
    if (isOverCapacity) return 'red'
    if (availableSlots <= 2) return 'orange'
    if (availableSlots <= 5) return 'yellow'
    return 'blue'
  }

  const color = getColor()

  const colorClasses = {
    red: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/40',
      bar: 'bg-gradient-to-r from-red-600 to-red-500',
      text: 'text-red-300'
    },
    orange: {
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/40',
      bar: 'bg-gradient-to-r from-orange-600 to-orange-500',
      text: 'text-orange-300'
    },
    yellow: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/40',
      bar: 'bg-gradient-to-r from-yellow-600 to-yellow-500',
      text: 'text-yellow-300'
    },
    blue: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/40',
      bar: 'bg-gradient-to-r from-blue-600 to-blue-500',
      text: 'text-blue-300'
    }
  }

  const colors = colorClasses[color]

  // Format status text
  const statusText = isOverCapacity
    ? `${Math.abs(availableSlots)} over`
    : availableSlots === 0
    ? 'Full'
    : `${availableSlots} slot${availableSlots !== 1 ? 's' : ''} left`

  return (
    <div className="p-4 border-t border-white/10">
      <div className={`rounded-lg p-3 ${colors.bg} border ${colors.border}`}>
        {/* Progress Bar */}
        <div className="relative w-full h-3 bg-slate-700/50 rounded-full overflow-hidden mb-2 shadow-inner">
          <div
            className={`absolute inset-y-0 left-0 ${colors.bar} transition-all duration-500 rounded-full`}
            style={{ width: `${fillPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>

        {/* Text */}
        <div className="flex items-center justify-between text-sm">
          <span className={`font-bold ${colors.text}`}>
            {totalPeople}/{loadCapacity}
          </span>
          <span className={`font-semibold ${colors.text}`}>
            {statusText}
          </span>
        </div>
      </div>
    </div>
  )
}
