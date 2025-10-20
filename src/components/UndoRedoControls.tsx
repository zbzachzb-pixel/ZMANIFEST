// src/components/UndoRedoControls.tsx
// UI controls for undo/redo functionality
'use client'

import React from 'react'
import { useActionHistory } from '@/contexts/ActionHistoryContext'

export function UndoRedoControls() {
  const { canUndo, canRedo, undo, redo, history, currentIndex } = useActionHistory()

  return (
    <div className="flex items-center gap-2">
      {/* Undo Button */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          canUndo
            ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30'
            : 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/30'
        }`}
        title={canUndo ? `Undo: ${history[currentIndex]?.description}` : 'Nothing to undo'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <span className="hidden md:inline">Undo</span>
      </button>

      {/* Redo Button */}
      <button
        onClick={redo}
        disabled={!canRedo}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          canRedo
            ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30'
            : 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/30'
        }`}
        title={canRedo ? `Redo: ${history[currentIndex + 1]?.description}` : 'Nothing to redo'}
      >
        <span className="hidden md:inline">Redo</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
        </svg>
      </button>

      {/* History indicator */}
      {history.length > 0 && (
        <div className="text-xs text-slate-400 px-2">
          {currentIndex + 1}/{history.length}
        </div>
      )}
    </div>
  )
}

/**
 * Compact version for mobile
 */
export function UndoRedoCompact() {
  const { canUndo, canRedo, undo, redo } = useActionHistory()

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={undo}
        disabled={!canUndo}
        className={`p-2 rounded ${
          canUndo
            ? 'text-blue-400 hover:bg-blue-500/20'
            : 'text-slate-600 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>

      <button
        onClick={redo}
        disabled={!canRedo}
        className={`p-2 rounded ${
          canRedo
            ? 'text-blue-400 hover:bg-blue-500/20'
            : 'text-slate-600 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Shift+Z)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
        </svg>
      </button>
    </div>
  )
}
