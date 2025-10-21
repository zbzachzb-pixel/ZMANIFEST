// src/components/AircraftMigrationPanel.tsx
// UI component for running aircraft migration

'use client'

import React, { useState, useEffect } from 'react'
import {
  needsAircraftMigration,
  getMigrationStats,
  migrateLoadsToAircraft,
  validateLoadAircraftReferences
} from '@/lib/aircraftMigration'

interface MigrationStats {
  totalLoads: number
  loadsWithAircraft: number
  loadsWithoutAircraft: number
  percentageMigrated: number
}

export function AircraftMigrationPanel() {
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [stats, setStats] = useState<MigrationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [migrationComplete, setMigrationComplete] = useState(false)
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean
    migratedCount: number
    defaultAircraftId: string
    errors: string[]
  } | null>(null)

  const checkMigrationStatus = async () => {
    setLoading(true)
    try {
      const [needed, migrationStats] = await Promise.all([
        needsAircraftMigration(),
        getMigrationStats()
      ])

      setMigrationNeeded(needed)
      setStats(migrationStats)
    } catch (error) {
      console.error('Failed to check migration status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkMigrationStatus()
  }, [])

  const handleRunMigration = async () => {
    if (!confirm('This will assign a default aircraft to all existing loads. Continue?')) {
      return
    }

    setMigrating(true)
    try {
      const result = await migrateLoadsToAircraft()
      setMigrationResult(result)

      if (result.success) {
        setMigrationComplete(true)
        setMigrationNeeded(false)
        await checkMigrationStatus() // Refresh stats
      }
    } catch (error) {
      console.error('Migration failed:', error)
      setMigrationResult({
        success: false,
        migratedCount: 0,
        defaultAircraftId: '',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      })
    } finally {
      setMigrating(false)
    }
  }

  const handleValidate = async () => {
    setLoading(true)
    try {
      const validation = await validateLoadAircraftReferences()

      if (validation.valid) {
        alert(`✅ All ${validation.totalLoads} loads have valid aircraft references!`)
      } else {
        const invalidList = validation.invalidLoads
          .map(l => `• ${l.loadName}: ${l.issue}`)
          .join('\n')
        alert(`⚠️ Found ${validation.invalidLoads.length} invalid loads:\n\n${invalidList}`)
      }
    } catch (error) {
      alert(`❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-4">🔄 Aircraft Migration</h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Checking migration status...</p>
        </div>
      </div>
    )
  }

  // Migration already complete
  if (!migrationNeeded && !migrationComplete && stats) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-4">🔄 Aircraft Migration</h2>
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">✅</span>
            <div>
              <h3 className="text-green-300 font-bold text-lg">Migration Complete</h3>
              <p className="text-green-200 text-sm">All loads have aircraft assignments</p>
            </div>
          </div>
          <div className="text-sm text-green-200 space-y-1">
            <p>• Total loads: {stats.totalLoads}</p>
            <p>• Loads with aircraft: {stats.loadsWithAircraft} ({stats.percentageMigrated}%)</p>
          </div>
          <button
            onClick={handleValidate}
            className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Validate References
          </button>
        </div>
      </div>
    )
  }

  // Migration needed
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-4">🔄 Aircraft Migration Required</h2>

      {migrationComplete && migrationResult?.success ? (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">✅</span>
            <div>
              <h3 className="text-green-300 font-bold text-lg">Migration Successful!</h3>
              <p className="text-green-200 text-sm">Loads have been assigned to aircraft</p>
            </div>
          </div>
          <div className="text-sm text-green-200 space-y-1">
            <p>• Migrated {migrationResult.migratedCount} loads</p>
            <p>• Default aircraft ID: {migrationResult.defaultAircraftId.substring(0, 8)}...</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Refresh Page
          </button>
        </div>
      ) : migrationResult && !migrationResult.success ? (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">❌</span>
            <div>
              <h3 className="text-red-300 font-bold text-lg">Migration Failed</h3>
              <p className="text-red-200 text-sm">Please try again or contact support</p>
            </div>
          </div>
          {migrationResult.errors.length > 0 && (
            <div className="text-sm text-red-200 space-y-1 mt-4">
              <p className="font-semibold">Errors:</p>
              {migrationResult.errors.map((error, i) => (
                <p key={i}>• {error}</p>
              ))}
            </div>
          )}
          <button
            onClick={handleRunMigration}
            className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Retry Migration
          </button>
        </div>
      ) : (
        <>
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">⚠️</span>
              <div>
                <h3 className="text-yellow-300 font-bold text-lg">Migration Needed</h3>
                <p className="text-yellow-200 text-sm">Existing loads need aircraft assignments</p>
              </div>
            </div>

            {stats && (
              <div className="text-sm text-yellow-200 space-y-1">
                <p>• Total loads: {stats.totalLoads}</p>
                <p>• Loads with aircraft: {stats.loadsWithAircraft}</p>
                <p>• Loads without aircraft: <strong>{stats.loadsWithoutAircraft}</strong></p>
                <p>• Migration progress: {stats.percentageMigrated}%</p>
              </div>
            )}
          </div>

          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-200">
              <strong>What this does:</strong> Assigns a default aircraft to all existing loads.
              If no aircraft exists, a default one will be created with your current capacity settings.
            </p>
          </div>

          <button
            onClick={handleRunMigration}
            disabled={migrating}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
          >
            {migrating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Migrating Loads...
              </span>
            ) : (
              '🚀 Run Migration Now'
            )}
          </button>

          <p className="text-xs text-slate-400 mt-3 text-center">
            This operation is safe and can be run multiple times
          </p>
        </>
      )}
    </div>
  )
}
