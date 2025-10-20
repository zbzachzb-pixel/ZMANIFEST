// src/components/KeyboardShortcuts.tsx - COMPLETE FILE
'use client'

import React, { useState, useEffect } from 'react'
import { useGlobalShortcuts, useGoToMenu } from '@/hooks/useKeyboardShortcuts'

// Global shortcuts provider component
export function GlobalShortcutsProvider() {
  // Use global shortcuts
  useGlobalShortcuts()

  // Use navigation shortcuts
  useGoToMenu()

  return null // This component doesn't render anything
}

// Shortcuts help modal component
export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)
  
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev)
    
    // Listen for custom event to toggle help
    document.addEventListener('toggle-shortcuts-help', handleToggle)
    
    // Also listen for keyboard shortcut (? key)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('toggle-shortcuts-help', handleToggle)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
  
  if (!isOpen) return null
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-6 z-50 max-w-3xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white transition-colors text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Global Actions */}
          <div>
            <h3 className="text-lg font-semibold text-blue-400 mb-2">Global Actions</h3>
            <div className="space-y-1">
              <ShortcutRow keys={['Ctrl', 'Z']} description="Undo last action" />
              <ShortcutRow keys={['Ctrl', 'Shift', 'Z']} description="Redo action" />
              <ShortcutRow keys={['Ctrl', 'Y']} description="Redo action (Windows)" />
              <ShortcutRow keys={['?']} description="Toggle this help menu" />
            </div>
          </div>

          {/* Global Navigation */}
          <div>
            <h3 className="text-lg font-semibold text-blue-400 mb-2">Global Navigation</h3>
            <div className="space-y-1">
              <ShortcutRow keys={['Alt', '1']} description="Go to Queue" />
              <ShortcutRow keys={['Alt', '2']} description="Go to Load Builder" />
              <ShortcutRow keys={['Alt', '3']} description="Go to Instructors" />
              <ShortcutRow keys={['Alt', '4']} description="Go to Assignments" />
              <ShortcutRow keys={['Alt', '5']} description="Go to Earnings" />
            </div>
          </div>
          
          {/* Queue Page */}
          <div>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Queue Page</h3>
            <div className="space-y-1">
              <ShortcutRow keys={['A']} description="Add new student" />
              <ShortcutRow keys={['I']} description="Import students" />
              <ShortcutRow keys={['G']} description="Create group from selected" />
              <ShortcutRow keys={['E']} description="Edit selected student" />
              <ShortcutRow keys={['Delete']} description="Remove selected students" />
              <ShortcutRow keys={['Ctrl', 'A']} description="Select all visible students" />
              <ShortcutRow keys={['Esc']} description="Clear selection" />
              <ShortcutRow keys={['/']} description="Focus search field" />
            </div>
          </div>
          
          {/* Load Builder Page */}
          <div>
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Load Builder Page</h3>
            <div className="space-y-1">
              <ShortcutRow keys={['N']} description="Create new load" />
              <ShortcutRow keys={['R']} description="Mark selected load as Ready" />
              <ShortcutRow keys={['D']} description="Mark selected load as Departed" />
              <ShortcutRow keys={['C']} description="Mark selected load as Completed" />
              <ShortcutRow keys={['Delete']} description="Delete selected load" />
              <ShortcutRow keys={['O']} description="Optimize first building/ready load" />
              <ShortcutRow keys={['A']} description="Auto-assign (same as O)" />
              <ShortcutRow keys={['↑']} description="Navigate to previous load" />
              <ShortcutRow keys={['↓']} description="Navigate to next load" />
              <ShortcutRow keys={['Enter']} description="Select first load" />
              <ShortcutRow keys={['Esc']} description="Cancel operation / Close modals" />
            </div>
          </div>

          {/* Within Load Card */}
          <div>
            <h3 className="text-lg font-semibold text-purple-300 mb-2">Within Load Card</h3>
            <div className="space-y-1">
              <ShortcutRow keys={['Q']} description="Quick assign (optimize)" />
              <ShortcutRow keys={['Ctrl', 'Enter']} description="Confirm assignment" />
              <ShortcutRow keys={['R']} description="Toggle request status" />
              <ShortcutRow keys={['M']} description="Mark as missed jump" />
            </div>
          </div>
          
          {/* Instructors Page */}
          <div>
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Instructors Page</h3>
            <div className="space-y-1">
              <ShortcutRow keys={['N']} description="Add new instructor" />
              <ShortcutRow keys={['C']} description="Clock in/out selected instructor" />
              <ShortcutRow keys={['E']} description="Edit selected instructor" />
              <ShortcutRow keys={['1']} description="Switch to Roster tab" />
              <ShortcutRow keys={['2']} description="Switch to Teams tab" />
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-700">
          <p className="text-sm text-slate-400">
            Press <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </>
  )
}

// Helper component for displaying shortcut rows
function ShortcutRow({ keys, description }: { keys: string[], description: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex gap-1">
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="text-slate-500">+</span>}
            <kbd className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300 font-mono">
              {key}
            </kbd>
          </React.Fragment>
        ))}
      </div>
      <span className="text-slate-300 text-sm ml-4">{description}</span>
    </div>
  )
}