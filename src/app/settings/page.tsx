'use client'

import React, { useState, useEffect } from 'react'
import { db } from '@/services'

interface AutoAssignSettings {
  enabled: boolean
  delay: number
  skipRequests: boolean
  batchMode: boolean
  batchSize: number
}

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false)
  const [autoAssignSettings, setAutoAssignSettings] = useState<AutoAssignSettings>({
    enabled: false,
    delay: 5,
    skipRequests: true,
    batchMode: false,
    batchSize: 3
  })
  
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  
  // Load settings on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true'
    setDarkMode(savedDarkMode)
    if (savedDarkMode) {
      document.documentElement.classList.add('dark')
    }
    
    const savedAutoAssign = localStorage.getItem('autoAssignSettings')
    if (savedAutoAssign) {
      try {
        setAutoAssignSettings(JSON.parse(savedAutoAssign))
      } catch (e) {
        console.error('Failed to load auto-assign settings')
      }
    }
  }, [])
  
  const handleDarkModeToggle = () => {
    const newValue = !darkMode
    setDarkMode(newValue)
    localStorage.setItem('darkMode', String(newValue))
    
    if (newValue) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  
  const handleAutoAssignChange = (updates: Partial<AutoAssignSettings>) => {
    const newSettings = { ...autoAssignSettings, ...updates }
    setAutoAssignSettings(newSettings)
    localStorage.setItem('autoAssignSettings', JSON.stringify(newSettings))
  }
  
  const handleExportData = async () => {
    try {
      setExportLoading(true)
      
      const state = await db.getFullState()
      
      const dataStr = JSON.stringify(state, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `instructor-rotation-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert('✅ Data exported successfully!')
    } catch (error) {
      console.error('Export failed:', error)
      alert('❌ Failed to export data. Check console for details.')
    } finally {
      setExportLoading(false)
    }
  }
  
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      setImportLoading(true)
      
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (!data.instructors || !data.assignments || !data.studentQueue) {
        alert('❌ Invalid backup file format!')
        return
      }
      
      if (!confirm('⚠️ This will REPLACE all current data. Continue?')) {
        return
      }
      
      await db.importState(data)
      
      alert('✅ Data imported successfully! Refreshing...')
      window.location.reload()
    } catch (error) {
      console.error('Import failed:', error)
      alert('❌ Failed to import data. Check console for details.')
    } finally {
      setImportLoading(false)
      event.target.value = ''
    }
  }
  
  const handleExportPeriodReport = async () => {
    try {
      const state = await db.getFullState()
      
      let report = 'INSTRUCTOR ROTATION SYSTEM - PERIOD REPORT\n'
      report += '='.repeat(60) + '\n\n'
      report += `Generated: ${new Date().toLocaleString()}\n\n`
      
      report += 'SUMMARY\n'
      report += '-'.repeat(40) + '\n'
      report += `Total Instructors: ${state.instructors.filter(i => !i.archived).length}\n`
      report += `Total Assignments: ${state.assignments.length}\n`
      report += `Students in Queue: ${state.studentQueue.length}\n\n`
      
      report += 'INSTRUCTORS\n'
      report += '-'.repeat(40) + '\n'
      state.instructors.filter(i => !i.archived).forEach(instructor => {
        const assignments = state.assignments.filter(a => 
          a.instructorId === instructor.id || a.videoInstructorId === instructor.id
        )
        report += `\n${instructor.name}:\n`
        report += `  Total Jumps: ${assignments.length}\n`
        report += `  Team: ${instructor.team || 'None'}\n`
        report += `  Clocked In: ${instructor.clockedIn ? 'Yes' : 'No'}\n`
      })
      
      const blob = new Blob([report], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `period-report-${new Date().toISOString().split('T')[0]}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert('✅ Report exported successfully!')
    } catch (error) {
      console.error('Report export failed:', error)
      alert('❌ Failed to export report.')
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-300">Manage system preferences and data</p>
        </div>
        
        {/* Appearance */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-6">🎨 Appearance</h2>
          
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <div className="text-white font-semibold mb-1">Dark Mode</div>
              <div className="text-sm text-slate-400">Toggle dark theme for the entire system</div>
            </div>
            <button
              onClick={handleDarkModeToggle}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                darkMode ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
        
        {/* Auto-Assignment */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-6">🤖 Auto-Assignment</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div>
                <div className="text-white font-semibold mb-1">Enable Auto-Assignment</div>
                <div className="text-sm text-slate-400">Automatically assign students after countdown</div>
              </div>
              <button
                onClick={() => handleAutoAssignChange({ enabled: !autoAssignSettings.enabled })}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  autoAssignSettings.enabled ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    autoAssignSettings.enabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <label className="block text-white font-semibold mb-3">
                Countdown Delay (seconds)
              </label>
              <input
                type="number"
                min="3"
                max="30"
                value={autoAssignSettings.delay}
                onChange={(e) => handleAutoAssignChange({ delay: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-2">Time before auto-assignment executes</p>
            </div>
            
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAssignSettings.skipRequests}
                  onChange={(e) => handleAutoAssignChange({ skipRequests: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                />
                <div>
                  <div className="text-white font-semibold">Skip Requested Jumps</div>
                  <div className="text-sm text-slate-400">Don&apos;t auto-assign request jumps</div>
                </div>
              </label>
            </div>
            
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={autoAssignSettings.batchMode}
                  onChange={(e) => handleAutoAssignChange({ batchMode: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                />
                <div>
                  <div className="text-white font-semibold">Batch Mode</div>
                  <div className="text-sm text-slate-400">Wait for multiple students before assigning</div>
                </div>
              </label>
              
              {autoAssignSettings.batchMode && (
                <div className="ml-8 mt-3">
                  <label className="block text-white font-semibold mb-2 text-sm">
                    Batch Size
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={autoAssignSettings.batchSize}
                    onChange={(e) => handleAutoAssignChange({ batchSize: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Data Management */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">💾 Data Management</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Export Full Backup</h3>
              <p className="text-sm text-slate-400 mb-4">
                Download complete system data (instructors, assignments, queue, loads)
              </p>
              <button
                onClick={handleExportData}
                disabled={exportLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportLoading ? '⏳ Exporting...' : '📥 Export Data (JSON)'}
              </button>
            </div>
            
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Import Backup</h3>
              <p className="text-sm text-slate-400 mb-4">
                ⚠️ This will replace all current data with the backup file
              </p>
              <label className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-colors cursor-pointer">
                {importLoading ? '⏳ Importing...' : '📤 Import Data (JSON)'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  disabled={importLoading}
                  className="hidden"
                />
              </label>
            </div>
            
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Export Period Report</h3>
              <p className="text-sm text-slate-400 mb-4">
                Generate a text summary of current period activity
              </p>
              <button
                onClick={handleExportPeriodReport}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                📊 Export Report (TXT)
              </button>
            </div>
            
            <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <h3 className="text-yellow-300 font-semibold mb-2">💡 Backup Tip</h3>
              <p className="text-sm text-yellow-200">
                Export regular backups to prevent data loss. Your data is also automatically synced to Firebase in real-time.
              </p>
            </div>
          </div>
        </div>
        
        {/* System Info */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mt-6">
          <h2 className="text-2xl font-bold text-white mb-4">ℹ️ System Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Version:</span>
              <span className="font-semibold">2.0.0 (TypeScript Edition)</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Database:</span>
              <span className="font-semibold">Firebase Realtime Database</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Framework:</span>
              <span className="font-semibold">Next.js 15 + React 19</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Last Updated:</span>
              <span className="font-semibold">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}