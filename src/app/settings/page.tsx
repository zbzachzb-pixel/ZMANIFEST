// src/app/settings/page.tsx - COMPLETE FIXED VERSION WITH SAVE BUTTONS
'use client'

import React, { useState, useEffect } from 'react'
import { db } from '@/services'
import { EndPeriodModal } from '@/components/EndPeriodModal'
import { getCurrentPeriod } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import type { LoadSchedulingSettings } from '@/types'
import {
  getLoadSettings,
  saveLoadSettings,
  getAutoAssignSettings,
  saveAutoAssignSettings,
  getDarkMode,
  saveDarkMode,
  type AutoAssignSettings
} from '@/lib/settingsStorage'

export default function SettingsPage() {
  const toast = useToast()
  const [darkMode, setDarkMode] = useState(false)
  const [autoAssignSettings, setAutoAssignSettings] = useState<AutoAssignSettings>(getAutoAssignSettings())
  const [loadSettings, setLoadSettings] = useState<LoadSchedulingSettings>(getLoadSettings())

  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [showEndPeriodModal, setShowEndPeriodModal] = useState(false)

  // Track unsaved changes
  const [hasLoadChanges, setHasLoadChanges] = useState(false)
  const [hasAutoAssignChanges, setHasAutoAssignChanges] = useState(false)

  // Track save success states
  const [loadSaveSuccess, setLoadSaveSuccess] = useState(false)
  const [autoAssignSaveSuccess, setAutoAssignSaveSuccess] = useState(false)

  const period = getCurrentPeriod()

  // Load settings on mount
  useEffect(() => {
    const savedDarkMode = getDarkMode()
    setDarkMode(savedDarkMode)
    if (savedDarkMode) {
      document.documentElement.classList.add('dark')
    }

    setAutoAssignSettings(getAutoAssignSettings())
    setLoadSettings(getLoadSettings())
  }, [])
  
  const handleDarkModeToggle = () => {
    const newValue = !darkMode
    setDarkMode(newValue)
    saveDarkMode(newValue)

    if (newValue) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  
  const handleAutoAssignChange = (updates: Partial<AutoAssignSettings>) => {
    const newSettings = { ...autoAssignSettings, ...updates }
    setAutoAssignSettings(newSettings)
    setHasAutoAssignChanges(true)
    setAutoAssignSaveSuccess(false)
  }
  
  const handleLoadSettingsChange = (updates: Partial<LoadSchedulingSettings>) => {
    const newSettings = { ...loadSettings, ...updates }
    setLoadSettings(newSettings)
    setHasLoadChanges(true)
    setLoadSaveSuccess(false)
  }
  
  const handleSaveLoadSettings = () => {
    try {
      saveLoadSettings(loadSettings)
      setHasLoadChanges(false)
      setLoadSaveSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => {
        setLoadSaveSuccess(false)
      }, 3000)
    } catch (error) {
      toast.error('Failed to save load settings')
    }
  }

  const handleSaveAutoAssignSettings = () => {
    try {
      saveAutoAssignSettings(autoAssignSettings)
      setHasAutoAssignChanges(false)
      setAutoAssignSaveSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => {
        setAutoAssignSaveSuccess(false)
      }, 3000)
    } catch (error) {
      toast.error('Failed to save auto-assign settings')
    }
  }
  
  const handleExport = async () => {
    setExportLoading(true)
    try {
      const data = await db.getFullState()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `instructor-rotation-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export data')
    } finally {
      setExportLoading(false)
    }
  }
  
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setImportLoading(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (confirm('⚠️ This will replace ALL current data. Are you sure?')) {
        await db.restoreFullState(data)
        toast.success('Data imported successfully!')
        window.location.reload()
      }
    } catch (error) {
      console.error('Import failed:', error)
      toast.error('Failed to import data', 'Check file format.')
    } finally {
      setImportLoading(false)
      event.target.value = ''
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">⚙️ Settings</h1>
          <p className="text-slate-300">Configure system preferences and behavior</p>
        </div>
        
        <div className="space-y-6">
          {/* Period Info */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">📅 Current Period</h2>
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <div className="text-white font-semibold mb-2">{period.name}</div>
              <div className="text-sm text-blue-300">
                {new Date(period.start).toLocaleDateString()} - {new Date(period.end).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={() => setShowEndPeriodModal(true)}
              className="mt-4 w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold py-3 px-6 rounded-lg transition-colors"
            >
              🔒 End Current Period
            </button>
          </div>
          
          {/* Load Scheduling */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">✈️ Load Scheduling</h2>
              {loadSaveSuccess && (
                <span className="text-green-400 text-sm font-semibold animate-pulse">
                  ✅ Saved successfully!
                </span>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white font-semibold mb-2">
                  Minutes Between Load Departures
                </label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={loadSettings.minutesBetweenLoads}
                  onChange={(e) => handleLoadSettingsChange({ minutesBetweenLoads: parseInt(e.target.value) || 20 })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-sm text-slate-400 mt-1">Time between loads departing (default: 20 minutes)</p>
              </div>
              
              <div>
                <label className="block text-white font-semibold mb-2">
                  Instructor Cycle Time (minutes)
                </label>
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={loadSettings.instructorCycleTime}
                  onChange={(e) => handleLoadSettingsChange({ instructorCycleTime: parseInt(e.target.value) || 40 })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-sm text-slate-400 mt-1">Time from briefing to available again (default: 40 minutes)</p>
              </div>
              
              <div>
                <label className="block text-white font-semibold mb-2">
                  Default Plane Capacity
                </label>
                <input
                  type="number"
                  min="10"
                  max="25"
                  value={loadSettings.defaultPlaneCapacity}
                  onChange={(e) => handleLoadSettingsChange({ defaultPlaneCapacity: parseInt(e.target.value) || 18 })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-sm text-slate-400 mt-1">Default capacity for new loads (default: 18)</p>
              </div>
              
              <button
                onClick={handleSaveLoadSettings}
                disabled={!hasLoadChanges}
                className={`w-full font-bold py-3 px-6 rounded-lg transition-all ${
                  hasLoadChanges
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {hasLoadChanges ? '💾 Save Load Settings' : '✓ Load Settings Saved'}
              </button>
            </div>
          </div>
          
          {/* Auto-Assign */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">🤖 Auto-Assignment</h2>
              {autoAssignSaveSuccess && (
                <span className="text-green-400 text-sm font-semibold animate-pulse">
                  ✅ Saved successfully!
                </span>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">Enable Auto-Assignment</h3>
                  <p className="text-sm text-slate-400">Automatically assign students to instructors</p>
                </div>
                <button
                  onClick={() => handleAutoAssignChange({ enabled: !autoAssignSettings.enabled })}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    autoAssignSettings.enabled ? 'bg-blue-500' : 'bg-slate-600'
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
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Delay (seconds)
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="30"
                      value={autoAssignSettings.delay}
                      onChange={(e) => handleAutoAssignChange({ delay: parseInt(e.target.value) || 5 })}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold">Skip Requested Jumps</h3>
                      <p className="text-sm text-slate-400">Don't auto-assign if student has instructor request</p>
                    </div>
                    <button
                      onClick={() => handleAutoAssignChange({ skipRequests: !autoAssignSettings.skipRequests })}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        autoAssignSettings.skipRequests ? 'bg-blue-500' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          autoAssignSettings.skipRequests ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold">Batch Mode</h3>
                      <p className="text-sm text-slate-400">Wait for multiple students before assigning</p>
                    </div>
                    <button
                      onClick={() => handleAutoAssignChange({ batchMode: !autoAssignSettings.batchMode })}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        autoAssignSettings.batchMode ? 'bg-blue-500' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          autoAssignSettings.batchMode ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
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
                        onChange={(e) => handleAutoAssignChange({ batchSize: parseInt(e.target.value) || 3 })}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={handleSaveAutoAssignSettings}
                disabled={!hasAutoAssignChanges}
                className={`w-full font-bold py-3 px-6 rounded-lg transition-all ${
                  hasAutoAssignChanges
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {hasAutoAssignChanges ? '💾 Save Auto-Assign Settings' : '✓ Auto-Assign Settings Saved'}
              </button>
            </div>
          </div>
          
          {/* Appearance */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">🎨 Appearance</h2>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">Dark Mode</h3>
                <p className="text-sm text-slate-400">Toggle dark theme (auto-saves)</p>
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
          
          {/* Data Management */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">💾 Data Management</h2>
            
            <div className="space-y-3">
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {exportLoading ? '⏳ Exporting...' : '📥 Export All Data'}
              </button>
              
              <label className="block">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={importLoading}
                  className="hidden"
                />
                <div className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors text-center cursor-pointer">
                  {importLoading ? '⏳ Importing...' : '📤 Import Data'}
                </div>
              </label>
              
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-sm text-yellow-300">
                  ⚠️ <strong>Warning:</strong> Importing will replace all current data. Export a backup first!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showEndPeriodModal && (
        <EndPeriodModal 
          period={period}
          onClose={() => setShowEndPeriodModal(false)}
          onSuccess={() => {
            setShowEndPeriodModal(false)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}