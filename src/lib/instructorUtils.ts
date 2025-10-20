// src/lib/instructorUtils.ts
// Shared utility functions for instructor filtering and selection

import type { Instructor, QueueStudent, Assignment, Load, LoadSchedulingSettings, Period } from '@/types'
import { isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import { calculateInstructorBalance, getCurrentPeriod } from './utils'

/**
 * Options for filtering instructors
 */
export interface InstructorFilterOptions {
  /** Ignore clock status (include clocked out instructors) */
  ignoreClockStatus?: boolean
  /** Specific load to check availability for */
  targetLoad?: Load
  /** All loads (required if targetLoad is specified) */
  allLoads?: Load[]
  /** Load scheduling settings (required if targetLoad is specified) */
  loadSettings?: LoadSchedulingSettings
  /** Exclude specific instructor IDs */
  excludeIds?: string[]
  /** Only include video-qualified instructors */
  videoOnly?: boolean
  /** Combined weight for video instructor checks (student + main instructor) */
  combinedWeight?: number
}

/**
 * Options for sorting qualified instructors
 */
export interface InstructorSortOptions {
  /** Sort by balance (lowest first) */
  sortByBalance?: boolean
  /** Assignments for balance calculation */
  assignments?: Assignment[]
  /** All instructors for balance calculation */
  allInstructors?: Instructor[]
  /** Current period for balance calculation */
  period?: Period
  /** All loads for pending balance calculation */
  allLoads?: Load[]
}

/**
 * Filter instructors based on student requirements and constraints
 *
 * This is the single source of truth for instructor qualification logic.
 * Use this instead of duplicating filter logic across components.
 *
 * @param student - The student needing an instructor
 * @param instructors - All available instructors
 * @param options - Filter options
 * @returns Array of qualified instructors
 */
export function filterQualifiedInstructors(
  student: QueueStudent,
  instructors: Instructor[],
  options: InstructorFilterOptions = {}
): Instructor[] {
  const {
    ignoreClockStatus = false,
    targetLoad,
    allLoads,
    loadSettings,
    excludeIds = [],
    videoOnly = false,
    combinedWeight
  } = options

  return instructors.filter(instructor => {
    // Skip archived instructors
    if (instructor.archived) return false

    // Skip excluded instructors
    if (excludeIds.includes(instructor.id)) return false

    // Check clock status
    if (!ignoreClockStatus && !instructor.clockedIn) return false

    // Video-only filtering
    if (videoOnly) {
      if (!instructor.canVideo) return false

      // Check video weight restrictions if combinedWeight provided
      if (combinedWeight !== undefined) {
        const hasMinWeight = instructor.videoMinWeight !== undefined && instructor.videoMinWeight !== null
        const hasMaxWeight = instructor.videoMaxWeight !== undefined && instructor.videoMaxWeight !== null

        if (hasMinWeight && combinedWeight < instructor.videoMinWeight!) return false
        if (hasMaxWeight && combinedWeight > instructor.videoMaxWeight!) return false
      }

      return true
    }

    // Check jump type qualification
    if (student.jumpType === 'tandem' && !instructor.canTandem) return false
    if (student.jumpType === 'aff' && !instructor.canAFF) return false

    // Check weight limits
    const totalWeight = student.weight + (student.tandemWeightTax || 0)

    if (student.jumpType === 'tandem' && instructor.tandemWeightLimit) {
      if (totalWeight > instructor.tandemWeightLimit) return false
    }

    if (student.jumpType === 'aff' && instructor.affWeightLimit) {
      if (totalWeight > instructor.affWeightLimit) return false
    }

    // Check AFF locked status
    if (student.jumpType === 'aff' && instructor.affLocked) {
      const isTheirStudent = instructor.affStudents?.some(s => s.name === student.name)
      if (!isTheirStudent) return false
    }

    // Check load availability if targetLoad specified
    if (targetLoad && allLoads && loadSettings) {
      const available = isInstructorAvailableForLoad(
        instructor.id,
        targetLoad.position || 0,
        allLoads,
        loadSettings.instructorCycleTime,
        loadSettings.minutesBetweenLoads
      )
      if (!available) return false
    }

    return true
  })
}

/**
 * Sort instructors by balance (lowest first) or other criteria
 *
 * @param instructors - Instructors to sort
 * @param options - Sort options
 * @returns Sorted array of instructors
 */
export function sortInstructors(
  instructors: Instructor[],
  options: InstructorSortOptions = {}
): Instructor[] {
  const {
    sortByBalance = false,
    assignments = [],
    allInstructors = [],
    period,
    allLoads = []
  } = options

  if (!sortByBalance) {
    return instructors
  }

  // Sort by balance (lowest first for fairness)
  const currentPeriod = period || getCurrentPeriod()
  return [...instructors].sort((a, b) => {
    const balanceA = calculateInstructorBalance(a.id, assignments, allInstructors, currentPeriod, allLoads)
    const balanceB = calculateInstructorBalance(b.id, assignments, allInstructors, currentPeriod, allLoads)
    return balanceA - balanceB
  })
}

/**
 * Get the best qualified instructor for a student
 * Combines filtering and sorting to return the single best match
 *
 * @param student - The student needing an instructor
 * @param instructors - All available instructors
 * @param filterOptions - Filter options
 * @param sortOptions - Sort options
 * @returns Best qualified instructor or null
 */
export function getBestInstructor(
  student: QueueStudent,
  instructors: Instructor[],
  filterOptions: InstructorFilterOptions = {},
  sortOptions: InstructorSortOptions = {}
): Instructor | null {
  const qualified = filterQualifiedInstructors(student, instructors, filterOptions)

  if (qualified.length === 0) return null

  const sorted = sortInstructors(qualified, sortOptions)
  return sorted[0] || null
}
