// src/components/LoadFunJumpers.tsx
// Collapsible fun jumper list for load cards
'use client'

import { useState } from 'react'
import type { FunJumper } from '@/types'

interface LoadFunJumpersProps {
  funJumpers: FunJumper[]
  isCompleted: boolean
  onRemove: (funJumper: FunJumper) => void
}

// Jump type display configuration
const JUMP_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  hop_n_pop: { label: 'Hop & Pop', icon: '🪂', color: 'bg-yellow-500/20 text-yellow-300' },
  team_pass: { label: 'Team Pass', icon: '👥', color: 'bg-blue-500/20 text-blue-300' },
  full_altitude: { label: 'Full Altitude', icon: '⬆️', color: 'bg-purple-500/20 text-purple-300' },
  high_pull: { label: 'High Pull', icon: '☁️', color: 'bg-cyan-500/20 text-cyan-300' },
  wingsuit: { label: 'Wingsuit', icon: '🦅', color: 'bg-orange-500/20 text-orange-300' }
}

// Format relative time (e.g., "2h ago", "5m ago")
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function LoadFunJumpers({ funJumpers, isCompleted, onRemove }: LoadFunJumpersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const count = funJumpers.length

  // Don't render if no fun jumpers
  if (count === 0) {
    return null
  }

  return (
    <div className="border-t border-white/10">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🪂</span>
          <span className="font-semibold text-white">Fun Jumpers</span>
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-sm rounded-full font-medium">
            {count}
          </span>
        </div>

        {/* Chevron Icon */}
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Content */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? 'max-h-[500px]' : 'max-h-0'
        }`}
      >
        <div className="px-5 pb-4 space-y-2">
          {funJumpers.map((jumper, index) => {
            const jumpConfig = JUMP_TYPE_CONFIG[jumper.skyDiveType] || {
              label: jumper.skyDiveType,
              icon: '🪂',
              color: 'bg-slate-500/20 text-slate-300'
            }

            return (
              <div
                key={`${jumper.userId}-${index}`}
                className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Jumper Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white truncate">{jumper.userName}</span>
                      {jumper.jumprunId && (
                        <span className="text-xs text-slate-400 font-mono">#{jumper.jumprunId}</span>
                      )}
                    </div>

                    {/* Jump Type Badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${jumpConfig.color}`}
                      >
                        <span>{jumpConfig.icon}</span>
                        <span>{jumpConfig.label}</span>
                      </span>

                      {/* Time Added */}
                      <span className="text-xs text-slate-500">
                        {formatRelativeTime(jumper.addedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Remove Button */}
                  {!isCompleted && (
                    <button
                      onClick={() => onRemove(jumper)}
                      className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-all hover:scale-110 font-bold text-lg"
                      title="Remove from load"
                      aria-label="Remove fun jumper from load"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Added By Info (if available) */}
                {jumper.addedByName && (
                  <div className="mt-2 text-xs text-slate-400 border-t border-white/5 pt-2">
                    Added by {jumper.addedByName}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
