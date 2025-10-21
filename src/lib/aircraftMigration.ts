// src/lib/aircraftMigration.ts
// Data migration utilities for multi-aircraft support
// Migrates existing loads to have aircraft references

import { ref, get, update, push } from 'firebase/database'
import { database } from './firebase'
import type { Load, Aircraft } from '@/types'
import { getLoadSettings } from './settingsStorage'

// ==================== MIGRATION STATUS ====================

/**
 * Check if migration is needed
 * Returns true if there are loads without aircraftId
 */
export async function needsAircraftMigration(): Promise<boolean> {
  try {
    const loadsRef = ref(database, 'loads')
    const snapshot = await get(loadsRef)

    if (!snapshot.exists()) {
      return false // No loads = no migration needed
    }

    const loads: Load[] = []
    snapshot.forEach(child => {
      loads.push(child.val() as Load)
    })

    // Check if any loads are missing aircraftId
    const loadsWithoutAircraft = loads.filter(load => !load.aircraftId)
    return loadsWithoutAircraft.length > 0
  } catch (error) {
    console.error('Failed to check migration status:', error)
    return false
  }
}

/**
 * Get migration statistics
 */
export async function getMigrationStats(): Promise<{
  totalLoads: number
  loadsWithAircraft: number
  loadsWithoutAircraft: number
  percentageMigrated: number
}> {
  try {
    const loadsRef = ref(database, 'loads')
    const snapshot = await get(loadsRef)

    if (!snapshot.exists()) {
      return {
        totalLoads: 0,
        loadsWithAircraft: 0,
        loadsWithoutAircraft: 0,
        percentageMigrated: 100
      }
    }

    const loads: Load[] = []
    snapshot.forEach(child => {
      loads.push(child.val() as Load)
    })

    const loadsWithAircraft = loads.filter(load => load.aircraftId).length
    const loadsWithoutAircraft = loads.length - loadsWithAircraft

    return {
      totalLoads: loads.length,
      loadsWithAircraft,
      loadsWithoutAircraft,
      percentageMigrated: loads.length > 0 ? Math.round((loadsWithAircraft / loads.length) * 100) : 100
    }
  } catch (error) {
    console.error('Failed to get migration stats:', error)
    throw error
  }
}

// ==================== MIGRATION EXECUTION ====================

/**
 * Migrate all existing loads to use default aircraft
 * Creates a default aircraft if none exists
 */
export async function migrateLoadsToAircraft(): Promise<{
  success: boolean
  migratedCount: number
  defaultAircraftId: string
  errors: string[]
}> {
  const errors: string[] = []
  let migratedCount = 0

  try {
    // Step 1: Get or create default aircraft
    const aircraftRef = ref(database, 'aircraft')
    const aircraftSnapshot = await get(aircraftRef)

    let defaultAircraftId: string | null = null

    if (!aircraftSnapshot.exists() || Object.keys(aircraftSnapshot.val() || {}).length === 0) {
      // No aircraft exists - create a default one
      console.log('No aircraft found, creating default aircraft...')

      const settings = getLoadSettings()
      const newAircraftRef = push(ref(database, 'aircraft'))
      const defaultAircraft: Aircraft = {
        id: newAircraftRef.key!,
        name: 'Primary Aircraft',
        tailNumber: 'N123XX',
        capacity: settings.defaultPlaneCapacity || 18,
        isActive: true,
        order: 0,
        createdAt: new Date().toISOString()
      }

      await update(ref(database), {
        [`aircraft/${defaultAircraft.id}`]: defaultAircraft
      })

      defaultAircraftId = defaultAircraft.id
      console.log(`✅ Created default aircraft: ${defaultAircraft.tailNumber}`)
    } else {
      // Use first active aircraft, or first aircraft if none active
      const aircraftList: Aircraft[] = []
      aircraftSnapshot.forEach(child => {
        aircraftList.push(child.val() as Aircraft)
      })

      const activeAircraft = aircraftList.filter(a => a.isActive)
      const targetAircraft = activeAircraft.length > 0 ? activeAircraft[0] : aircraftList[0]

      if (!targetAircraft) {
        throw new Error('No aircraft available for migration')
      }

      defaultAircraftId = targetAircraft.id
      console.log(`✅ Using existing aircraft for migration: ${targetAircraft.tailNumber}`)
    }

    // Step 2: Get all loads without aircraftId
    const loadsRef = ref(database, 'loads')
    const loadsSnapshot = await get(loadsRef)

    if (!loadsSnapshot.exists()) {
      console.log('No loads found - migration complete')
      return {
        success: true,
        migratedCount: 0,
        defaultAircraftId: defaultAircraftId!,
        errors: []
      }
    }

    const loads: Load[] = []
    loadsSnapshot.forEach(child => {
      loads.push(child.val() as Load)
    })

    const loadsToMigrate = loads.filter(load => !load.aircraftId)

    if (loadsToMigrate.length === 0) {
      console.log('All loads already have aircraft assigned')
      return {
        success: true,
        migratedCount: 0,
        defaultAircraftId: defaultAircraftId!,
        errors: []
      }
    }

    // Step 3: Update loads with aircraftId
    console.log(`Migrating ${loadsToMigrate.length} loads...`)

    const updates: Record<string, any> = {}
    loadsToMigrate.forEach(load => {
      updates[`loads/${load.id}/aircraftId`] = defaultAircraftId
    })

    await update(ref(database), updates)

    migratedCount = loadsToMigrate.length
    console.log(`✅ Successfully migrated ${migratedCount} loads to aircraft ${defaultAircraftId}`)

    // Step 4: Update settings to include default aircraft as active
    const currentSettings = getLoadSettings()
    if (!currentSettings.activeAircraftIds || currentSettings.activeAircraftIds.length === 0) {
      const updatedSettings = {
        ...currentSettings,
        activeAircraftIds: [defaultAircraftId!]
      }

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('loadSchedulingSettings', JSON.stringify(updatedSettings))
      }

      console.log('✅ Updated settings with default active aircraft')
    }

    return {
      success: true,
      migratedCount,
      defaultAircraftId: defaultAircraftId!,
      errors
    }
  } catch (error) {
    console.error('Migration failed:', error)
    errors.push(error instanceof Error ? error.message : 'Unknown error')

    return {
      success: false,
      migratedCount,
      defaultAircraftId: '',
      errors
    }
  }
}

// ==================== MANUAL MIGRATION ====================

/**
 * Assign specific aircraft to specific loads
 * Useful for custom migration scenarios
 */
export async function assignAircraftToLoads(
  loadIds: string[],
  aircraftId: string
): Promise<{
  success: boolean
  updatedCount: number
  errors: string[]
}> {
  const errors: string[] = []

  try {
    // Validate aircraft exists
    const aircraftRef = ref(database, `aircraft/${aircraftId}`)
    const aircraftSnapshot = await get(aircraftRef)

    if (!aircraftSnapshot.exists()) {
      throw new Error(`Aircraft ${aircraftId} not found`)
    }

    // Update loads
    const updates: Record<string, any> = {}
    loadIds.forEach(loadId => {
      updates[`loads/${loadId}/aircraftId`] = aircraftId
    })

    await update(ref(database), updates)

    console.log(`✅ Assigned aircraft ${aircraftId} to ${loadIds.length} loads`)

    return {
      success: true,
      updatedCount: loadIds.length,
      errors: []
    }
  } catch (error) {
    console.error('Failed to assign aircraft to loads:', error)
    errors.push(error instanceof Error ? error.message : 'Unknown error')

    return {
      success: false,
      updatedCount: 0,
      errors
    }
  }
}

// ==================== VALIDATION ====================

/**
 * Validate all loads have valid aircraft references
 * Returns loads with invalid or missing aircraft
 */
export async function validateLoadAircraftReferences(): Promise<{
  valid: boolean
  totalLoads: number
  invalidLoads: Array<{
    loadId: string
    loadName: string
    issue: string
  }>
}> {
  try {
    // Get all aircraft
    const aircraftRef = ref(database, 'aircraft')
    const aircraftSnapshot = await get(aircraftRef)

    const validAircraftIds = new Set<string>()
    if (aircraftSnapshot.exists()) {
      aircraftSnapshot.forEach(child => {
        validAircraftIds.add(child.key!)
      })
    }

    // Get all loads
    const loadsRef = ref(database, 'loads')
    const loadsSnapshot = await get(loadsRef)

    if (!loadsSnapshot.exists()) {
      return {
        valid: true,
        totalLoads: 0,
        invalidLoads: []
      }
    }

    const invalidLoads: Array<{ loadId: string; loadName: string; issue: string }> = []
    let totalLoads = 0

    loadsSnapshot.forEach(child => {
      const load = child.val() as Load
      totalLoads++

      if (!load.aircraftId) {
        invalidLoads.push({
          loadId: load.id,
          loadName: load.name || `Load ${load.position}`,
          issue: 'Missing aircraftId'
        })
      } else if (!validAircraftIds.has(load.aircraftId)) {
        invalidLoads.push({
          loadId: load.id,
          loadName: load.name || `Load ${load.position}`,
          issue: `Invalid aircraftId: ${load.aircraftId}`
        })
      }
    })

    return {
      valid: invalidLoads.length === 0,
      totalLoads,
      invalidLoads
    }
  } catch (error) {
    console.error('Failed to validate load aircraft references:', error)
    throw error
  }
}
