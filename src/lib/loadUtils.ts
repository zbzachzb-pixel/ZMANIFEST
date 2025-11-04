// src/lib/loadUtils.ts
// Utility functions for load position management

import type { Load } from '@/types'

/**
 * Compute positions for building loads only, scoped per aircraft
 *
 * This function renumbers ONLY building loads sequentially (1, 2, 3...),
 * while preserving the original positions of ready/departed/completed loads.
 * This prevents breaking timers and instructor availability checks that
 * depend on position for ready and departed loads.
 *
 * IMPORTANT: Positions are scoped PER AIRCRAFT. Each aircraft has independent
 * load numbering (AC01 has loads 1-5, BA01 has loads 1-3, etc.)
 *
 * @param loads - Array of loads to process
 * @returns Array of loads with updated positions
 *
 * @example
 * // AC01: Load 1 (ready), Load 2 (building), Load 3 (building)
 * // BA01: Load 1 (building), Load 2 (departed), Load 3 (building)
 * //
 * // After deleting AC01 Load 3:
 * // AC01: Load 1 (ready, stays 1), Load 2 (building, stays 2)
 * // BA01: Load 1 (building, stays 1), Load 2 (departed, stays 2), Load 3 (building, stays 3)
 */
export function computeBuildingLoadPositions(loads: Load[]): Load[] {
  // Separate building loads from others
  const buildingLoads = loads.filter(l => l.status === 'building')
  const nonBuildingLoads = loads.filter(l => l.status !== 'building')

  // Group building loads by aircraft
  const loadsByAircraft = new Map<string, Load[]>()

  for (const load of buildingLoads) {
    const aircraftId = load.aircraftId || 'unknown'
    if (!loadsByAircraft.has(aircraftId)) {
      loadsByAircraft.set(aircraftId, [])
    }
    loadsByAircraft.get(aircraftId)!.push(load)
  }

  // Renumber building loads per aircraft
  const renumberedBuilding: Load[] = []

  for (const [_aircraftId, aircraftLoads] of loadsByAircraft) {
    // Sort by sortOrder (if available) or fallback to position
    const sorted = aircraftLoads.sort((a, b) => {
      const sortA = a.sortOrder ?? a.position
      const sortB = b.sortOrder ?? b.position
      return sortA - sortB
    })

    // Renumber sequentially starting from 1 for this aircraft
    let nextPosition = 1
    for (const load of sorted) {
      renumberedBuilding.push({
        ...load,
        position: nextPosition++
      })
    }
  }

  // Non-building loads keep their original position (IMMUTABLE)
  // This preserves timer and availability calculations
  const unchangedNonBuilding = nonBuildingLoads.map(load => ({
    ...load,
    position: load.position  // Explicitly preserve original position
  }))

  // Return combined array
  return [...renumberedBuilding, ...unchangedNonBuilding]
}
