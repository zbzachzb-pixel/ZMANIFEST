// src/components/ConflictWarnings.tsx
// UI component for displaying conflict warnings
'use client'

import React, { useState } from 'react'
import type { Conflict } from '@/lib/conflictDetection'

interface ConflictWarningsProps {
  conflicts: Conflict[]
  compact?: boolean
}

export function ConflictWarnings({ conflicts, compact = false }: ConflictWarningsProps) {
  const [expanded, setExpanded] = useState(false)

  if (conflicts.length === 0) return null

  const errors = conflicts.filter(c => c.severity === 'error')
  const warnings = conflicts.filter(c => c.severity === 'warning')
  const infos = conflicts.filter(c => c.severity === 'info')

  if (compact) {
    return (
      <div className="flex gap-2 text-xs">
        {errors.length > 0 && (
          <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded-md border border-red-500/30">
            🚫 {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-md border border-yellow-500/30">
            ⚠️ {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
        {infos.length > 0 && (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md border border-blue-500/30">
            ℹ️ {infos.length} info
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Summary Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          {errors.length > 0 && (
            <span className="text-red-400 font-semibold">
              🚫 {errors.length} Error{errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="text-yellow-400 font-semibold">
              ⚠️ {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
            </span>
          )}
          {infos.length > 0 && (
            <span className="text-blue-400 font-semibold">
              ℹ️ {infos.length} Info
            </span>
          )}
        </div>
        <span className="text-slate-400 text-sm">
          {expanded ? '▼' : '▶'} {expanded ? 'Hide' : 'Show'} Details
        </span>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="space-y-2">
          {/* Errors */}
          {errors.map(conflict => (
            <ConflictCard key={conflict.id} conflict={conflict} />
          ))}

          {/* Warnings */}
          {warnings.map(conflict => (
            <ConflictCard key={conflict.id} conflict={conflict} />
          ))}

          {/* Info */}
          {infos.map(conflict => (
            <ConflictCard key={conflict.id} conflict={conflict} />
          ))}
        </div>
      )}
    </div>
  )
}

function ConflictCard({ conflict }: { conflict: Conflict }) {
  const [showSuggestions, setShowSuggestions] = useState(false)

  const colors = {
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-300',
      icon: '🚫'
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-300',
      icon: '⚠️'
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-300',
      icon: 'ℹ️'
    }
  }

  const style = colors[conflict.severity]

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-3 space-y-2`}>
      {/* Title */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-lg">{style.icon}</span>
          <div className="flex-1">
            <h4 className={`font-semibold ${style.text}`}>{conflict.title}</h4>
            <p className="text-sm text-slate-300 mt-1">{conflict.message}</p>
          </div>
        </div>

        {conflict.suggestions && conflict.suggestions.length > 0 && (
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
          >
            {showSuggestions ? 'Hide' : 'Solutions'}
          </button>
        )}
      </div>

      {/* Suggestions */}
      {showSuggestions && conflict.suggestions && (
        <div className="mt-2 pl-7 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase">Suggestions:</p>
          <ul className="text-sm text-slate-300 space-y-1">
            {conflict.suggestions.map((suggestion, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-green-400">→</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Auto-fix button */}
      {conflict.autoFixAvailable && conflict.autoFix && (
        <button
          onClick={conflict.autoFix}
          className="mt-2 ml-7 text-xs px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
        >
          ✨ Auto-fix
        </button>
      )}
    </div>
  )
}

/**
 * Inline conflict badge for compact display
 */
export function ConflictBadge({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null

  const errors = conflicts.filter(c => c.severity === 'error').length
  const warnings = conflicts.filter(c => c.severity === 'warning').length

  if (errors > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs border border-red-500/30">
        🚫 {errors}
      </span>
    )
  }

  if (warnings > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs border border-yellow-500/30">
        ⚠️ {warnings}
      </span>
    )
  }

  return null
}
