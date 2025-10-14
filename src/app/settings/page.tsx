'use client'

import React, { useState, useEffect } from 'react'
import { db } from '@/services'
import { EndPeriodModal } from '@/components/EndPeriodModal'
import { getCurrentPeriod } from '@/lib/utils'
import type { LoadSchedulingSettings } from '@/types'

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
  
  const [loadSettings, setLoadSettings] = useState<LoadSchedulingSettings>({
    minutesBetweenLoads: 20,
    instructorCycleTime: 40
  })
  
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [showEndPeriodModal, setShowEndPeriodModal] = useState(false)
  
  const period = getCurrentPeriod()
  
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
    
    const savedLoadSettings = localStorage.getItem('loadSchedulingSettings')
    if (savedLoadSettings) {
      try {
        setLoadSettings(JSON.parse(savedLoadSettings))
      } catch (e) {
        console.error('Failed to load load scheduling settings')
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
  
  const handleLoadSettingsChange = (updates: Partial<LoadSchedulingSettings>) => {
    const newSettings = { ...loadSettings, ...updates }
    setLoadSettings(newSettings)
    localStorage.setItem('loadSchedulingSettings', JSON.stringify(newSettings))
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
    
    if (!confirm('⚠️ This will replace ALL current data with the backup. Continue?')) {
      event.target.value = ''
      return
    }
    
    try {
      setImportLoading(true)
      
      const text = await file.text()
      const data = JSON.parse(text)
      
      await db.restoreFullState(data)
      
      alert('✅ Data imported successfully! Refreshing page...')
      window.location.reload()
    } catch (error) {
      console.error('Import failed:', error)
      alert('❌ Failed to import data. Check console for details.')
      event.target.value = ''
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">⚙️ Settings</h1>
        
        <div className="space-y-6">
          {/* Period Management */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">📅 Period Management</h2>
            
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-4">
              <p className="text-blue-300 text-sm mb-2">
                <strong>Current Period:</strong> {period.name}
              </p>
              <p className="text-blue-300 text-sm">
                {period.start.toLocaleDateString()} - {period.end.toLocaleDateString()}
              </p>
            </div>
            
            <button
              onClick={() => setShowEndPeriodModal(true)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              🔒 End Current Period
            </button>
          </div>
          
          {/* Load Scheduling */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">⏱️ Load Scheduling</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white font-semibold mb-2">
                  Minutes Between Loads
                </label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={loadSettings.minutesBetweenLoads}
                  onChange={(e) => handleLoadSettingsChange({ 
                    minutesBetweenLoads: parseInt(e.target.value) || 20 
                  })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Time gap between each load departure (default: 20 minutes)
                </p>
              </div>
              
              <div>
                <label className="block text-white font-semibold mb-2">
                  Instructor Cycle Time
                </label>
                <input
                  type="number"
                  min="20"
                  max="90"
                  value={loadSettings.instructorCycleTime}
                  onChange={(e) => handleLoadSettingsChange({ 
                    instructorCycleTime: parseInt(e.target.value) || 40 
                  })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Total time from meeting student until available again (default: 40 minutes)
                </p>
              </div>
              
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-300">
                  💡 <strong>How it works:</strong> When Load #1 is marked &quot;Ready&quot;, a {loadSettings.minutesBetweenLoads}-minute 
                  countdown begins. When Load #1 departs, Load #2&apos;s countdown starts automatically. 
                  This ensures proper spacing between loads and instructor rotation.
                </p>
              </div>
            </div>
          </div>
          
          {/* Auto-Assign Settings */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">🤖 Auto-Assign Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">Enable Auto-Assign</h3>
                  <p className="text-sm text-slate-400">Automatically assign students when they arrive</p>
                </div>
                <button
                  onClick={() => handleAutoAssignChange({ enabled: !autoAssignSettings.enabled })}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    autoAssignSettings.enabled ? 'bg-green-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      autoAssignSettings.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {autoAssignSettings.enabled && (
                <div className="space-y-4 pl-4 border-l-2 border-blue-500">
                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Delay (seconds)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={autoAssignSettings.delay}
                      onChange={(e) => handleAutoAssignChange({ delay: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="skipRequests"
                      checked={autoAssignSettings.skipRequests}
                      onChange={(e) => handleAutoAssignChange({ skipRequests: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-700"
                    />
                    <label htmlFor="skipRequests" className="text-white">
                      Skip request students
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="batchMode"
                      checked={autoAssignSettings.batchMode}
                      onChange={(e) => handleAutoAssignChange({ batchMode: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-700"
                    />
                    <label htmlFor="batchMode" className="text-white">
                      Batch mode (wait for multiple students)
                    </label>
                  </div>
                  
                  {autoAssignSettings.batchMode && (
                    <div>
                      <label className="block text-white font-semibold mb-2">
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
              )}
            </div>
          </div>
          
          {/* Data Management */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">💾 Data Management</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <h3 className="text-white font-semibold mb-2">Export Full Backup</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Download complete system data (instructors, assignments, queue, loads, periods)
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
            </div>
          </div>
          
          {/* Display Settings */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">🎨 Display Settings</h2>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">Dark Mode</h3>
                <p className="text-sm text-slate-400">Toggle dark/light theme</p>
              </div>
              <button
                onClick={handleDarkModeToggle}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  darkMode ? 'bg-blue-500' : 'bg-slate-600'
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
        </div>
      </div>
      
      {showEndPeriodModal && (
        <EndPeriodModal onClose={() => setShowEndPeriodModal(false)} />
      )}
    </div>
  )
}