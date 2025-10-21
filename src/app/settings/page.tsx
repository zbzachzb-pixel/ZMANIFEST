// src/app/settings/page.tsx - COMPLETE FIXED VERSION WITH SAVE BUTTONS + AIRCRAFT MANAGEMENT
'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import type { LoadSchedulingSettings, Aircraft, CreateAircraft } from '@/types'
import {
  getLoadSettings,
  saveLoadSettings,
  getAutoAssignSettings,
  saveAutoAssignSettings,
  getDarkMode,
  saveDarkMode,
  type AutoAssignSettings
} from '@/lib/settingsStorage'
import { RequireRole } from '@/components/auth'
import { useAircraft, useCreateAircraft, useUpdateAircraft, useDeactivateAircraft, useReactivateAircraft } from '@/hooks/useDatabase'

// ✅ PERFORMANCE: Dynamic imports for modals - only loaded when opened
const EndPeriodModal = dynamic(() => import('@/components/EndPeriodModal').then(mod => ({ default: mod.EndPeriodModal })), { ssr: false })
const AircraftModal = dynamic(() => import('@/components/AircraftModal').then(mod => ({ default: mod.AircraftModal })), { ssr: false })

function SettingsPageContent() {
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

  // Aircraft management state
  const [showAircraftModal, setShowAircraftModal] = useState(false)
  const [editingAircraft, setEditingAircraft] = useState<Aircraft | null>(null)
  const [activeAircraftIds, setActiveAircraftIds] = useState<string[]>([])
  const [hasActiveAircraftChanges, setHasActiveAircraftChanges] = useState(false)
  const [activeAircraftSaveSuccess, setActiveAircraftSaveSuccess] = useState(false)

  // Aircraft hooks
  const { data: aircraft, loading: aircraftLoading } = useAircraft()
  const { create: createAircraft } = useCreateAircraft()
  const { update: updateAircraft } = useUpdateAircraft()
  const { deactivate: deactivateAircraft } = useDeactivateAircraft()
  const { reactivate: reactivateAircraft } = useReactivateAircraft()

  const period = getCurrentPeriod()

  // Load settings on mount
  useEffect(() => {
    const savedDarkMode = getDarkMode()
    setDarkMode(savedDarkMode)
    if (savedDarkMode) {
      document.documentElement.classList.add('dark')
    }

    const autoAssign = getAutoAssignSettings()
    const loads = getLoadSettings()
    setAutoAssignSettings(autoAssign)
    setLoadSettings(loads)

    // Load active aircraft IDs
    setActiveAircraftIds(loads.activeAircraftIds || [])
  }, [])

  // Update activeAircraftIds when aircraft list changes
  useEffect(() => {
    if (aircraft.length > 0 && activeAircraftIds.length === 0 && loadSettings.activeAircraftIds) {
      setActiveAircraftIds(loadSettings.activeAircraftIds)
    }
  }, [aircraft, activeAircraftIds.length, loadSettings.activeAircraftIds])
  
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

  // ==================== AIRCRAFT HANDLERS ====================

  const handleAddAircraft = () => {
    setEditingAircraft(null)
    setShowAircraftModal(true)
  }

  const handleEditAircraft = (aircraftToEdit: Aircraft) => {
    setEditingAircraft(aircraftToEdit)
    setShowAircraftModal(true)
  }

  const handleSaveAircraft = async (aircraftData: CreateAircraft | Aircraft) => {
    try {
      if ('id' in aircraftData) {
        // Update existing
        await updateAircraft(aircraftData.id, aircraftData)
        toast.success('Aircraft Updated', `${aircraftData.tailNumber} has been updated`)
      } else {
        // Create new
        await createAircraft(aircraftData)
        toast.success('Aircraft Added', `${aircraftData.tailNumber} has been added`)
      }
      setShowAircraftModal(false)
      setEditingAircraft(null)
    } catch (error) {
      toast.error('Failed to save aircraft', error instanceof Error ? error.message : 'Unknown error')
      throw error // Re-throw so modal can handle it
    }
  }

  const handleDeactivateAircraft = async (id: string, tailNumber: string) => {
    if (!confirm(`Deactivate ${tailNumber}? It will be hidden from active lists but preserved for history.`)) {
      return
    }

    try {
      await deactivateAircraft(id)
      toast.success('Aircraft Deactivated', `${tailNumber} has been deactivated`)
    } catch (error) {
      toast.error('Failed to deactivate aircraft', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const handleReactivateAircraft = async (id: string, tailNumber: string) => {
    try {
      await reactivateAircraft(id)
      toast.success('Aircraft Reactivated', `${tailNumber} is now active`)
    } catch (error) {
      toast.error('Failed to reactivate aircraft', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const handleToggleActiveAircraft = (aircraftId: string) => {
    setActiveAircraftIds(prev => {
      if (prev.includes(aircraftId)) {
        return prev.filter(id => id !== aircraftId)
      } else {
        return [...prev, aircraftId]
      }
    })
    setHasActiveAircraftChanges(true)
    setActiveAircraftSaveSuccess(false)
  }

  const handleSaveActiveAircraft = () => {
    try {
      const updatedSettings = {
        ...loadSettings,
        activeAircraftIds
      }
      saveLoadSettings(updatedSettings)
      setLoadSettings(updatedSettings)
      setHasActiveAircraftChanges(false)
      setActiveAircraftSaveSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => {
        setActiveAircraftSaveSuccess(false)
      }, 3000)

      toast.success('Active Aircraft Saved', `${activeAircraftIds.length} aircraft selected for today`)
    } catch (error) {
      toast.error('Failed to save active aircraft')
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

          {/* Aircraft Management */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">✈️ Aircraft Fleet</h2>
              <button
                onClick={handleAddAircraft}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                ➕ Add Aircraft
              </button>
            </div>

            {aircraftLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading aircraft...</p>
              </div>
            ) : aircraft.length === 0 ? (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-6 text-center">
                <p className="text-yellow-300 mb-4">
                  ⚠️ No aircraft configured. Add your first aircraft to enable multi-aircraft operations.
                </p>
                <button
                  onClick={handleAddAircraft}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Add Your First Aircraft
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active Aircraft */}
                {aircraft.filter(a => a.isActive).map(a => (
                  <div
                    key={a.id}
                    className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">✈️</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold text-lg">{a.tailNumber}</h3>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-300">{a.name}</span>
                        </div>
                        <div className="text-sm text-slate-400">
                          Capacity: {a.capacity} passengers • Order: {a.order}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditAircraft(a)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivateAircraft(a.id, a.tailNumber)}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg font-medium transition-colors border border-red-500/30"
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                ))}

                {/* Inactive Aircraft */}
                {aircraft.filter(a => !a.isActive).length > 0 && (
                  <>
                    <div className="pt-4 border-t border-white/10">
                      <h3 className="text-slate-400 font-semibold mb-3">Inactive Aircraft</h3>
                    </div>
                    {aircraft.filter(a => !a.isActive).map(a => (
                      <div
                        key={a.id}
                        className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between opacity-60"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl grayscale">✈️</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-slate-400 font-bold text-lg">{a.tailNumber}</h3>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-500">{a.name}</span>
                              <span className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded">INACTIVE</span>
                            </div>
                            <div className="text-sm text-slate-500">
                              Capacity: {a.capacity} passengers
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReactivateAircraft(a.id, a.tailNumber)}
                            className="bg-green-500/20 hover:bg-green-500/30 text-green-300 px-4 py-2 rounded-lg font-medium transition-colors border border-green-500/30"
                          >
                            Reactivate
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="mt-4 bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                💡 <strong>Tip:</strong> Aircraft are preserved when deactivated, maintaining historical load references.
                Reactivate anytime to resume operations.
              </p>
            </div>
          </div>

          {/* Today's Active Aircraft */}
          {aircraft.filter(a => a.isActive).length > 0 && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">🛫 Today's Flying Aircraft</h2>
                  <p className="text-sm text-slate-400 mt-1">Select which aircraft are operating today</p>
                </div>
                {activeAircraftSaveSuccess && (
                  <span className="text-green-400 text-sm font-semibold animate-pulse">
                    ✅ Saved successfully!
                  </span>
                )}
              </div>

              <div className="space-y-3 mb-4">
                {aircraft.filter(a => a.isActive).map(a => (
                  <div
                    key={a.id}
                    className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">✈️</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold">{a.tailNumber}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-300">{a.name}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-400 text-sm">{a.capacity} pax</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActiveAircraft(a.id)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        activeAircraftIds.includes(a.id) ? 'bg-green-500' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          activeAircraftIds.includes(a.id) ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveActiveAircraft}
                disabled={!hasActiveAircraftChanges}
                className={`w-full font-bold py-3 px-6 rounded-lg transition-all ${
                  hasActiveAircraftChanges
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {hasActiveAircraftChanges ? '💾 Save Active Aircraft' : '✓ Active Aircraft Saved'}
              </button>

              {activeAircraftIds.length === 0 && (
                <div className="mt-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-300">
                    ⚠️ <strong>Warning:</strong> No aircraft selected. Select at least one aircraft to operate loads today.
                  </p>
                </div>
              )}

              {activeAircraftIds.length > 1 && (
                <div className="mt-4 bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                  <p className="text-sm text-green-300">
                    ✅ <strong>Multi-Aircraft Mode:</strong> Load Builder will show separate columns for each active aircraft.
                  </p>
                </div>
              )}
            </div>
          )}

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

      {showAircraftModal && (
        <AircraftModal
          isOpen={showAircraftModal}
          onClose={() => {
            setShowAircraftModal(false)
            setEditingAircraft(null)
          }}
          onSave={handleSaveAircraft}
          aircraft={editingAircraft}
          existingAircraft={aircraft}
        />
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <RequireRole roles={["admin", "manifest"]}>
      <SettingsPageContent />
    </RequireRole>
  )
}
