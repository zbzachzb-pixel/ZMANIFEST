// src/services/assignmentLogic.ts
// ✅ CLEANED VERSION - No backwards compatibility code
// Updated version with instructor availability checks based on load timer

import { isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import { getCurrentPeriod, isWorkingOffDay, calculateInstructorBalance } from '@/lib/utils'
import { filterQualifiedInstructors } from '@/lib/instructorUtils'
import type { QueueStudent, Instructor, Assignment, Load, LoadSchedulingSettings } from '@/types'

/**
 * Result of instructor suggestion algorithm
 * Contains both primary and video instructor suggestions
 */
export interface SuggestedInstructors {
  /** Primary instructor for the jump */
  main: Instructor | null
  /** Video instructor (if needed for tandem with outside video) */
  video: Instructor | null
  /** Whether this jump requires outside video */
  needsVideo: boolean
  /** Whether the main instructor selection failed due to clock status */
  isMainClockedOut: boolean
  /** Reason why no instructor could be assigned */
  unavailableReason?: string
}

/**
 * Get suggested instructors for a student using intelligent assignment algorithm
 *
 * Algorithm prioritizes instructors based on:
 * 1. Qualification (tandem/AFF ratings)
 * 2. Availability (not on another load within cycle time)
 * 3. Not working on scheduled off day
 * 4. Lowest balance (fairness)
 * 5. Earliest clock-in time (tie-breaker)
 *
 * @param student - The student needing an instructor
 * @param instructors - All available instructors
 * @param assignments - Historical assignments for balance calculation
 * @param targetLoad - The load this student will be assigned to
 * @param allLoads - All loads (for cycle time availability checks)
 * @param loadSettings - Load timing settings (cycle time, minutes between loads)
 * @param ignoreClockStatus - If true, include clocked-out instructors (for requests)
 * @returns Suggested primary and video instructors with availability info
 *
 * @example
 * const suggestion = getSuggestedInstructors(
 *   tandemStudent,
 *   allInstructors,
 *   assignments,
 *   load,
 *   allLoads,
 *   settings
 * );
 * if (suggestion.main) {
 *   assignStudentToInstructor(student, suggestion.main);
 * }
 */
export function getSuggestedInstructors(
  student: QueueStudent,
  instructors: Instructor[],
  assignments: Assignment[],
  targetLoad: Load,
  allLoads: Load[],
  loadSettings: LoadSchedulingSettings,
  ignoreClockStatus = false
): SuggestedInstructors {
  const period = getCurrentPeriod()
  const needsVideo = student.jumpType === 'tandem' && (student.outsideVideo === true)

  // ✅ REFACTORED: Use shared utility function for instructor filtering
  const qualified = filterQualifiedInstructors(
    student,
    instructors,
    {
      ignoreClockStatus,
      targetLoad,
      allLoads,
      loadSettings
    }
  )

  if (qualified.length === 0) {
    return {
      main: null,
      video: null,
      needsVideo,
      isMainClockedOut: true,
      unavailableReason: 'No qualified instructors available for this load timing'
    }
  }

  // Sort by balance (lowest first)
  qualified.sort((a, b) => {
  // Priority 1: Not working on off day
  const aIsOff = isWorkingOffDay(a, new Date())
  const bIsOff = isWorkingOffDay(b, new Date())
  if (aIsOff !== bIsOff) return aIsOff ? 1 : -1
  
  // Priority 2: Balance (lowest first)
  const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period, allLoads)
  const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period, allLoads)
  if (balanceA !== balanceB) return balanceA - balanceB
  
  // Priority 3: Clock-in time (earliest first)
  const timeA = a.clockInTime ? new Date(a.clockInTime).getTime() : 0
  const timeB = b.clockInTime ? new Date(b.clockInTime).getTime() : 0
  return timeA - timeB
})

  const mainInstructor = qualified[0]
  if (!mainInstructor) {
    return {
      main: null,
      video: null,
      needsVideo,
      isMainClockedOut: false,
      unavailableReason: 'No qualified instructors available'
    }
  }

  // Find video instructor if needed
  let videoInstructor: Instructor | null = null
  if (needsVideo) {
    const qualifiedVideo = instructors.filter(inst => {
      if (inst.archived) return false
      if (!ignoreClockStatus && !inst.clockedIn) return false

      if (!inst.canVideo) return false
      if (inst.id === mainInstructor.id) return false

      // ✅ FIXED: Check video weight restrictions if applicable
      if (inst.videoMinWeight != null || inst.videoMaxWeight != null) {
        const combinedWeight = mainInstructor.bodyWeight + student.weight
        if (inst.videoMinWeight && combinedWeight < inst.videoMinWeight) return false
        if (inst.videoMaxWeight && combinedWeight > inst.videoMaxWeight) return false
      }

      // Check timing availability
      const available = isInstructorAvailableForLoad(
        inst.id, 
        targetLoad.position, 
        allLoads,
        loadSettings.instructorCycleTime,
        loadSettings.minutesBetweenLoads
      )
      if (!available) {
        console.log(`⏰ Video instructor ${inst.name} not available for Load #${targetLoad.position}`)
        return false
      }

      return true
    })

    if (qualifiedVideo.length > 0) {
      qualifiedVideo.sort((a, b) => {
        const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period, allLoads)
        const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period, allLoads)
        return balanceA - balanceB
      })
      videoInstructor = qualifiedVideo[0] || null
    }
  }

  return {
    main: mainInstructor,
    video: videoInstructor,
    needsVideo,
    isMainClockedOut: false
  }
}

/**
 * Simplified version without load timer checks (for backward compatibility)
 * Use this when you don't care about load timing
 */
export function getSuggestedInstructorsSimple(
  student: QueueStudent,
  instructors: Instructor[],
  assignments: Assignment[],
  ignoreClockStatus = false
): SuggestedInstructors {
  const period = getCurrentPeriod()
  const needsVideo = student.jumpType === 'tandem' && (student.outsideVideo === true)

  // Find qualified main instructors
  const qualified: Instructor[] = []

  for (const inst of instructors) {
    if (inst.archived) continue
    if (!ignoreClockStatus && !inst.clockedIn) continue

    // ✅ CLEAN: Use correct property names without fallbacks
    if (student.jumpType === 'tandem' && !inst.canTandem) continue
    if (student.jumpType === 'aff' && !inst.canAFF) continue

    // Check weight limits
    const totalWeight = student.weight + (student.tandemWeightTax || 0)
    if (student.jumpType === 'tandem' && inst.tandemWeightLimit) {
      if (totalWeight > inst.tandemWeightLimit) continue
    }
    if (student.jumpType === 'aff' && inst.affWeightLimit) {
      if (totalWeight > inst.affWeightLimit) continue
    }

    // Check AFF locked status
    if (student.jumpType === 'aff' && inst.affLocked) {
      const isTheirStudent = inst.affStudents?.some(s => s.name === student.name)
      if (!isTheirStudent) continue
    }

    qualified.push(inst)
  }

  if (qualified.length === 0) {
    return {
      main: null,
      video: null,
      needsVideo,
      isMainClockedOut: true
    }
  }

  // Sort by balance (lowest first)
  qualified.sort((a, b) => {
    const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period)
    const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period)
    return balanceA - balanceB
  })

  const mainInstructor = qualified[0]
  if (!mainInstructor) {
    return {
      main: null,
      video: null,
      needsVideo,
      isMainClockedOut: false,
      unavailableReason: 'No qualified instructors available'
    }
  }

  // Find video instructor if needed
  let videoInstructor: Instructor | null = null
  if (needsVideo) {
    const qualifiedVideo = instructors.filter(inst => {
      if (inst.archived) return false
      if (!ignoreClockStatus && !inst.clockedIn) return false

      // ✅ CLEAN: Use correct property name without fallback
      if (!inst.canVideo) return false
      if (inst.id === mainInstructor.id) return false
      return true
    })

    if (qualifiedVideo.length > 0) {
      qualifiedVideo.sort((a, b) => {
        const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period)
        const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period)
        return balanceA - balanceB
      })
      videoInstructor = qualifiedVideo[0] || null
    }
  }

  return {
    main: mainInstructor,
    video: videoInstructor,
    needsVideo,
    isMainClockedOut: false
  }
}