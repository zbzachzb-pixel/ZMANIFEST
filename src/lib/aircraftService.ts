// src/lib/aircraftService.ts
// Aircraft management service layer
// Handles CRUD operations for aircraft (planes, helicopters, etc.)

import { ref, get, set, update, remove, push, onValue } from 'firebase/database'
import { database } from './firebase'
import type { Aircraft, CreateAircraft, UpdateAircraft } from '@/types'

// ==================== HELPER FUNCTIONS ====================

/**
 * Get current timestamp
 */
function now(): string {
  return new Date().toISOString()
}

// ==================== CRUD OPERATIONS ====================

/**
 * Create a new aircraft
 */
export async function createAircraft(data: CreateAircraft): Promise<string> {
  try {
    // Validation
    if (!data.name || !data.tailNumber) {
      throw new Error('Name and tail number are required')
    }

    if (data.capacity <= 0) {
      throw new Error('Capacity must be greater than 0')
    }

    // Check for duplicate tail number
    const existingAircraft = await getAllAircraft()
    const duplicate = existingAircraft.find(
      a => a.tailNumber.toUpperCase() === data.tailNumber.toUpperCase() && a.isActive
    )
    if (duplicate) {
      throw new Error(`Aircraft with tail number ${data.tailNumber} already exists`)
    }

    // Create new aircraft
    const aircraftRef = ref(database, 'aircraft')
    const newAircraftRef = push(aircraftRef)

    const aircraft: Aircraft = {
      ...data,
      id: newAircraftRef.key!,
      createdAt: now()
    }

    await set(newAircraftRef, aircraft)

    console.log(`✅ Aircraft ${aircraft.tailNumber} created`)
    return newAircraftRef.key!
  } catch (error) {
    console.error('Failed to create aircraft:', error)
    throw error
  }
}

/**
 * Get all aircraft (active and inactive)
 */
export async function getAllAircraft(): Promise<Aircraft[]> {
  try {
    const aircraftRef = ref(database, 'aircraft')
    const snapshot = await get(aircraftRef)

    if (!snapshot.exists()) {
      return []
    }

    const aircraft: Aircraft[] = []
    snapshot.forEach(child => {
      aircraft.push(child.val() as Aircraft)
    })

    // Sort by order, then by name
    return aircraft.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('Failed to get aircraft:', error)
    throw error
  }
}

/**
 * Get active aircraft only
 */
export async function getActiveAircraft(): Promise<Aircraft[]> {
  const allAircraft = await getAllAircraft()
  return allAircraft.filter(a => a.isActive)
}

/**
 * Get a single aircraft by ID
 */
export async function getAircraftById(id: string): Promise<Aircraft | null> {
  try {
    const aircraftRef = ref(database, `aircraft/${id}`)
    const snapshot = await get(aircraftRef)

    if (!snapshot.exists()) {
      return null
    }

    return snapshot.val() as Aircraft
  } catch (error) {
    console.error(`Failed to get aircraft ${id}:`, error)
    throw error
  }
}

/**
 * Update an aircraft
 */
export async function updateAircraft(id: string, data: UpdateAircraft): Promise<void> {
  try {
    // Validation
    if (data.capacity !== undefined && data.capacity <= 0) {
      throw new Error('Capacity must be greater than 0')
    }

    // Check for duplicate tail number (if updating tail number)
    if (data.tailNumber) {
      const allAircraft = await getAllAircraft()
      const duplicate = allAircraft.find(
        a => a.id !== id &&
        a.tailNumber.toUpperCase() === data.tailNumber!.toUpperCase() &&
        a.isActive
      )
      if (duplicate) {
        throw new Error(`Aircraft with tail number ${data.tailNumber} already exists`)
      }
    }

    const aircraftRef = ref(database, `aircraft/${id}`)
    const updates = {
      ...data,
      updatedAt: now()
    }

    await update(aircraftRef, updates)

    console.log(`✅ Aircraft ${id} updated`)
  } catch (error) {
    console.error(`Failed to update aircraft ${id}:`, error)
    throw error
  }
}

/**
 * Deactivate an aircraft (soft delete)
 * Preserves aircraft for historical load references
 */
export async function deactivateAircraft(id: string): Promise<void> {
  try {
    await updateAircraft(id, { isActive: false })
    console.log(`✅ Aircraft ${id} deactivated`)
  } catch (error) {
    console.error(`Failed to deactivate aircraft ${id}:`, error)
    throw error
  }
}

/**
 * Reactivate an aircraft
 */
export async function reactivateAircraft(id: string): Promise<void> {
  try {
    await updateAircraft(id, { isActive: true })
    console.log(`✅ Aircraft ${id} reactivated`)
  } catch (error) {
    console.error(`Failed to reactivate aircraft ${id}:`, error)
    throw error
  }
}

/**
 * Delete an aircraft (hard delete - use with caution!)
 * Only use if aircraft was created by mistake
 */
export async function deleteAircraft(id: string): Promise<void> {
  try {
    // Check if aircraft is referenced by any loads
    const loadsRef = ref(database, 'loads')
    const snapshot = await get(loadsRef)

    if (snapshot.exists()) {
      let hasReferences = false
      snapshot.forEach(child => {
        const load = child.val()
        if (load.aircraftId === id) {
          hasReferences = true
        }
      })

      if (hasReferences) {
        throw new Error('Cannot delete aircraft: it is referenced by existing loads. Use deactivate instead.')
      }
    }

    const aircraftRef = ref(database, `aircraft/${id}`)
    await remove(aircraftRef)

    console.log(`✅ Aircraft ${id} deleted`)
  } catch (error) {
    console.error(`Failed to delete aircraft ${id}:`, error)
    throw error
  }
}

/**
 * Reorder aircraft (update display order)
 */
export async function reorderAircraft(aircraftIds: string[]): Promise<void> {
  try {
    const updates: Record<string, any> = {}

    aircraftIds.forEach((id, index) => {
      updates[`aircraft/${id}/order`] = index
      updates[`aircraft/${id}/updatedAt`] = now()
    })

    await update(ref(database), updates)

    console.log(`✅ Aircraft reordered`)
  } catch (error) {
    console.error('Failed to reorder aircraft:', error)
    throw error
  }
}

// ==================== REAL-TIME SUBSCRIPTIONS ====================

/**
 * Subscribe to all aircraft (real-time updates)
 */
export function subscribeToAircraft(callback: (aircraft: Aircraft[]) => void): () => void {
  const aircraftRef = ref(database, 'aircraft')

  const unsubscribe = onValue(aircraftRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }

    const aircraft: Aircraft[] = []
    snapshot.forEach(child => {
      aircraft.push(child.val() as Aircraft)
    })

    // Sort by order, then by name
    const sorted = aircraft.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.name.localeCompare(b.name)
    })

    callback(sorted)
  })

  return unsubscribe
}

/**
 * Subscribe to active aircraft only
 */
export function subscribeToActiveAircraft(callback: (aircraft: Aircraft[]) => void): () => void {
  return subscribeToAircraft((aircraft) => {
    callback(aircraft.filter(a => a.isActive))
  })
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get aircraft display name (combines name and tail number)
 */
export function getAircraftDisplayName(aircraft: Aircraft): string {
  return `${aircraft.tailNumber} - ${aircraft.name}`
}

/**
 * Get aircraft by tail number
 */
export async function getAircraftByTailNumber(tailNumber: string): Promise<Aircraft | null> {
  const allAircraft = await getAllAircraft()
  return allAircraft.find(
    a => a.tailNumber.toUpperCase() === tailNumber.toUpperCase()
  ) || null
}

/**
 * Get default aircraft capacity
 * Falls back to first active aircraft, or 18 if no aircraft exist
 */
export async function getDefaultCapacity(): Promise<number> {
  const activeAircraft = await getActiveAircraft()
  if (activeAircraft.length === 0) {
    return 18 // Legacy default
  }
  return activeAircraft[0].capacity
}
