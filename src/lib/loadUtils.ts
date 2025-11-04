// src/lib/loadUtils.ts
// Utility functions for load position management

import type { Load } from '@/types'

/**
 * Compute positions for building loads only
 *
 * This function renumbers ONLY building loads sequentially (1, 2, 3...),
 * while preserving the original positions of ready/departed/completed loads.
 * This prevents breaking timers and instructor availability checks that
 * depend on position for ready and departed loads.
 *
 * @param loads - Array of loads to process
 * @returns Array of loads with updated positions
 *
 * @example
 * // Before deletion:
 * // Load 1 (ready), Load 2 (building), Load 3 (building), Load 4 (departed), Load 5 (building)
 * //
 * // After deleting Load 3 (building):
 * // Load 1 (ready, position stays 1)
 * // Load 2 (building, renumbered to 2)
 * // Load 4 (departed, position stays 4)
 * // Load 5 (building, renumbered to 3)
 */
export function computeBuildingLoadPositions(loads: Load[]): Load[] {
  // Separate building loads from others
  const buildingLoads = loads.filter(l => l.status === 'building')
  const nonBuildingLoads = loads.filter(l => l.status !== 'building')

  // Sort building loads by sortOrder (if available) or fallback to position
  const sortedBuilding = buildingLoads.sort((a, b) => {
    const sortA = a.sortOrder ?? a.position
    const sortB = b.sortOrder ?? b.position
    return sortA - sortB
  })

  // Renumber building loads sequentially starting from 1
  let nextPosition = 1
  const renumberedBuilding = sortedBuilding.map(load => ({
    ...load,
    position: nextPosition++
  }))

  // Non-building loads keep their original position (IMMUTABLE)
  // This preserves timer and availability calculations
  const unchangedNonBuilding = nonBuildingLoads.map(load => ({
    ...load,
    position: load.position  // Explicitly preserve original position
  }))

  // Return combined array
  return [...renumberedBuilding, ...unchangedNonBuilding]
}
