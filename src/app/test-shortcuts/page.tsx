// app/test-shortcuts/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TestShortcutsPage() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [lastKey, setLastKey] = useState<string>('')
  const [keyHistory, setKeyHistory] = useState<any[]>([])

  // Manual test of keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()
      const isTyping = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
      
      // Log key info
      const keyInfo = {
        key: e.key,
        code: e.code,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        target: tagName.toUpperCase(),
        isTyping: isTyping,
        timestamp: new Date().toLocaleTimeString()
      }
      
      console.log('Test page received key:', e.key, keyInfo)
      setLastKey(`${e.key} (${e.code})`)
      setKeyHistory(prev => [keyInfo, ...prev.slice(0, 9)])
      
      // Skip all shortcuts if user is typing in an input
      if (isTyping) {
        console.log('User is typing in input, skipping shortcuts')
        return
      }
      
      // Test number navigation
      if (e.key >= '1' && e.key <= '8' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const routes = [
          '/dashboard',    // 1
          '/loads',        // 2
          '/queue',        // 3
          '/instructors',  // 4
          '/assignments',  // 5
          '/analytics',    // 6
          '/notes',        // 7
          '/settings'      // 8
        ]
        const index = parseInt(e.key) - 1
        const route = routes[index]
        if (route) {
          e.preventDefault()
          setMessage(`Navigating to ${route}...`)
          setTimeout(() => {
            router.push(route)
          }, 500)
        }
      }
      
      // Test letter shortcuts
      if (e.key === 't' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        setMessage('Test shortcut T pressed!')
        setTimeout(() => setMessage(''), 2000)
      }
      
      if (e.key === '?') {
        e.preventDefault()
        setMessage('Help shortcut ? pressed!')
        setTimeout(() => setMessage(''), 2000)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">🧪 Keyboard Shortcuts Test</h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Test Instructions</h2>
          
          <div className="space-y-3 text-slate-300">
            <p>Try pressing these keys to test if shortcuts are working:</p>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Navigation (1-8)</h3>
                <ul className="space-y-1 text-sm">
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">1</kbd> → Dashboard</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">2</kbd> → Load Builder</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">3</kbd> → Queue</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">4</kbd> → Instructors</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">5</kbd> → History</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">6</kbd> → Analytics</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">7</kbd> → Notes</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">8</kbd> → Settings</li>
                </ul>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Test Shortcuts</h3>
                <ul className="space-y-1 text-sm">
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">T</kbd> → Test message</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">?</kbd> → Help</li>
                  <li><kbd className="px-2 py-1 bg-slate-700 rounded">G</kbd> → Go to menu</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className="bg-green-500/20 border border-green-500 text-green-300 rounded-lg p-4 mb-6">
            <div className="text-lg font-semibold">✅ {message}</div>
          </div>
        )}

        {/* Test Input Field */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">Test Focus Behavior</h3>
          <p className="text-slate-300 mb-4">
            Shortcuts should NOT work when typing in this input:
          </p>
          <input
            type="text"
            placeholder="Try typing numbers here - they shouldn't navigate"
            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
          />
        </div>

        {/* Console Output */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">📋 Check Console</h3>
          <p className="text-slate-300">
            Open your browser's Developer Console (F12) to see detailed logs of key presses.
          </p>
          <p className="text-slate-400 text-sm mt-2">
            You should see "Test page received key: [key]" messages when pressing keys.
          </p>
        </div>
      </div>

      {/* Inline Debug Component */}
      <div className="fixed bottom-4 right-4 bg-slate-800 rounded-lg shadow-xl p-4 border border-slate-700 z-50 max-w-md">
        <div className="text-xs font-mono space-y-2">
          <div className="text-green-400 font-bold mb-2">🐛 Keyboard Debug</div>
          
          {message && (
            <div className="bg-green-500/20 text-green-300 p-2 rounded mb-2">
              ✅ {message}
            </div>
          )}
          
          <div className="text-white">
            Last key: <span className="text-yellow-400">{lastKey || 'None'}</span>
          </div>
          
          <div className="text-slate-400">
            Press <kbd className="px-1 py-0.5 bg-slate-700 rounded">T</kbd> to test shortcuts
          </div>
          
          <div className="text-slate-400">
            Press <kbd className="px-1 py-0.5 bg-slate-700 rounded">1-8</kbd> for navigation
          </div>
          
          <div className="border-t border-slate-700 pt-2 mt-2">
            <div className="text-slate-500 text-xs mb-1">History:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {keyHistory.map((k, i) => (
                <div key={i} className="text-xs text-slate-400">
                  {k.timestamp} - {k.key} 
                  {k.ctrl && ' +Ctrl'} 
                  {k.alt && ' +Alt'} 
                  {k.shift && ' +Shift'}
                  {k.meta && ' +Meta'}
                  <span className="text-slate-600"> in {k.target}</span>
                  {k.isTyping && <span className="text-red-400"> [TYPING]</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}