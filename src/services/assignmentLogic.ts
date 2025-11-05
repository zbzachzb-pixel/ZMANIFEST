// src/services/assignmentLogic.ts
// ✅ CLEANED VERSION - No backwards compatibility code
// Updated version with instructor availability checks based on load timer

import { isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import { getCurrentPeriod, isWorkingOffDay, calculateInstructorBalance } from '@/lib/utils'
import { filterQualifiedInstructors } from '@/lib/instructorUtils'
import type { QueueStudent, Instructor, Assignment, Load, LoadSchedulingSettings, LoadAssignment } from '@/types'

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
 * Assignment error details for students that couldn't be assigned
 */
export interface AssignmentError {
  studentName: string
  studentId: string
  reasons: string[]
}

/**
 * Result of smart assignment algorithm
 */
export interface SmartAssignmentResult {
  /** Successfully assigned students with their instructors */
  assignments: Map<string, { main: Instructor; video: Instructor | null }>
  /** Students that couldn't be assigned with detailed error reasons */
  errors: AssignmentError[]
  /** Number of successful assignments */
  successCount: number
  /** Number of failed assignments */
  failureCount: number
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
  ignoreClockStatus = false,
  teamRotation: 'blue' | 'red' = 'blue'
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
  const aIsOff = isWorkingOffDay(a, new Date(), teamRotation)
  const bIsOff = isWorkingOffDay(b, new Date(), teamRotation)
  if (aIsOff !== bIsOff) return aIsOff ? 1 : -1

  // Priority 2: Balance (lowest first)
  const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period, allLoads, teamRotation)
  const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period, allLoads, teamRotation)
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
        const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period, allLoads, teamRotation)
        const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period, allLoads, teamRotation)
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

/**
 * Smart assignment algorithm that prioritizes filling ALL slots over perfect rotation balance
 *
 * Algorithm:
 * 1. Try initial assignment (balance-sorted, lowest balance first)
 * 2. Identify unassigned students
 * 3. Try reassignment: find students with multiple options and reshuffle
 * 4. Protect requested pairings (never reassign them)
 * 5. Use higher-balance instructors as fallback if needed
 * 6. Track detailed errors for impossible assignments
 *
 * @param loadAssignments - Current load assignments (may include requests)
 * @param instructors - All available instructors
 * @param assignments - Historical assignments for balance calculation
 * @param targetLoad - The load being assigned
 * @param allLoads - All loads (for timing checks)
 * @param loadSettings - Load settings
 * @param teamRotation - Team rotation schedule
 * @returns Result with assignments and detailed errors
 */
export function smartAssignInstructors(
  loadAssignments: LoadAssignment[],
  instructors: Instructor[],
  assignments: Assignment[],
  targetLoad: Load,
  allLoads: Load[],
  loadSettings: LoadSchedulingSettings,
  teamRotation: 'blue' | 'red' = 'blue'
): SmartAssignmentResult {
  const period = getCurrentPeriod()
  const assignmentMap = new Map<string, { main: Instructor; video: Instructor | null }>()
  const errors: AssignmentError[] = []

  // Track which instructors are used (one student per instructor rule)
  const usedInstructorIds = new Set<string>()

  // Separate requests from regular assignments
  const requestAssignments = loadAssignments.filter(a => a.isRequest && a.instructorId)
  const regularAssignments = loadAssignments.filter(a => !a.isRequest || !a.instructorId)

  // Phase 1: Lock in all requested pairings first (these are sacred)
  for (const request of requestAssignments) {
    if (!request.instructorId) continue

    const instructor = instructors.find(i => i.id === request.instructorId)
    if (instructor) {
      assignmentMap.set(request.studentId, { main: instructor, video: null })
      usedInstructorIds.add(instructor.id)
    }
  }

  // Phase 2: Initial assignment for regular students (balance-sorted)
  const unassignedStudents: LoadAssignment[] = []
  const studentOptions = new Map<string, Instructor[]>() // Track all options for each student

  for (const assignment of regularAssignments) {
    // Get ALL qualified instructors (not just lowest balance)
    const student: QueueStudent = {
      id: assignment.id,
      studentAccountId: assignment.studentId,
      name: assignment.studentName,
      weight: assignment.studentWeight,
      jumpType: assignment.jumpType,
      isRequest: assignment.isRequest,
      timestamp: new Date().toISOString(),
      tandemWeightTax: assignment.tandemWeightTax,
      tandemHandcam: assignment.tandemHandcam,
      outsideVideo: assignment.hasOutsideVideo,
      affLevel: assignment.affLevel
    }

    const allQualified = filterQualifiedInstructors(student, instructors, {
      ignoreClockStatus: false,
      targetLoad,
      allLoads,
      loadSettings
    })

    // Store all options for this student (for reassignment later)
    studentOptions.set(assignment.studentId, allQualified)

    // Filter out already-used instructors
    const availableQualified = allQualified.filter(i => !usedInstructorIds.has(i.id))

    if (availableQualified.length === 0) {
      unassignedStudents.push(assignment)
      continue
    }

    // Sort by balance (lowest first for fairness)
    availableQualified.sort((a, b) => {
      // Priority 1: Not working off day
      const aIsOff = isWorkingOffDay(a, new Date(), teamRotation)
      const bIsOff = isWorkingOffDay(b, new Date(), teamRotation)
      if (aIsOff !== bIsOff) return aIsOff ? 1 : -1

      // Priority 2: Balance
      const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period, allLoads, teamRotation)
      const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period, allLoads, teamRotation)
      if (balanceA !== balanceB) return balanceA - balanceB

      // Priority 3: Clock-in time
      const timeA = a.clockInTime ? new Date(a.clockInTime).getTime() : 0
      const timeB = b.clockInTime ? new Date(b.clockInTime).getTime() : 0
      return timeA - timeB
    })

    const selectedInstructor = availableQualified[0]
    if (selectedInstructor) {
      assignmentMap.set(assignment.studentId, { main: selectedInstructor, video: null })
      usedInstructorIds.add(selectedInstructor.id)
    } else {
      unassignedStudents.push(assignment)
    }
  }

  // Phase 3: Smart reassignment - try to fill unassigned slots by reshuffling
  for (const unassignedStudent of unassignedStudents) {
    const options = studentOptions.get(unassignedStudent.studentId) || []

    if (options.length === 0) {
      // No possible instructors for this student - track detailed error
      errors.push({
        studentName: unassignedStudent.studentName,
        studentId: unassignedStudent.studentId,
        reasons: buildErrorReasons(unassignedStudent, instructors, targetLoad, allLoads, loadSettings)
      })
      continue
    }

    // Try to find an instructor for this student by reassigning others
    let foundSolution = false

    for (const candidate of options) {
      // Skip if this instructor is on a request (can't reassign requests)
      const isOnRequest = requestAssignments.some(r => r.instructorId === candidate.id)
      if (isOnRequest) continue

      // Is this instructor currently assigned to someone else?
      const currentlyAssignedTo = Array.from(assignmentMap.entries())
        .find(([_, assigned]) => assigned.main.id === candidate.id)?.[0]

      if (!currentlyAssignedTo) {
        // This instructor is free - just assign them
        assignmentMap.set(unassignedStudent.studentId, { main: candidate, video: null })
        usedInstructorIds.add(candidate.id)
        foundSolution = true
        break
      }

      // This instructor is assigned to someone else. Can we reassign that other student?
      const otherStudent = regularAssignments.find(a => a.studentId === currentlyAssignedTo)
      if (!otherStudent) continue

      const otherOptions = (studentOptions.get(currentlyAssignedTo) || [])
        .filter(i => !usedInstructorIds.has(i.id) || i.id === candidate.id) // Include their current instructor

      // Does the other student have alternative options?
      const alternativeForOther = otherOptions.find(i => i.id !== candidate.id)

      if (alternativeForOther) {
        // Reshuffle: move candidate from other student to unassigned student
        // Then assign alternativeForOther to other student
        assignmentMap.set(unassignedStudent.studentId, { main: candidate, video: null })
        assignmentMap.set(currentlyAssignedTo, { main: alternativeForOther, video: null })
        usedInstructorIds.delete(candidate.id)
        usedInstructorIds.add(candidate.id)
        usedInstructorIds.add(alternativeForOther.id)
        foundSolution = true
        break
      }
    }

    if (!foundSolution) {
      // Couldn't find a solution even with reassignment
      errors.push({
        studentName: unassignedStudent.studentName,
        studentId: unassignedStudent.studentId,
        reasons: buildErrorReasons(unassignedStudent, instructors, targetLoad, allLoads, loadSettings)
      })
    }
  }

  return {
    assignments: assignmentMap,
    errors,
    successCount: assignmentMap.size,
    failureCount: errors.length
  }
}

/**
 * Build detailed error reasons for why a student couldn't be assigned
 */
function buildErrorReasons(
  assignment: LoadAssignment,
  instructors: Instructor[],
  targetLoad: Load,
  allLoads: Load[],
  loadSettings: LoadSchedulingSettings
): string[] {
  const reasons: string[] = []
  const totalWeight = assignment.studentWeight + (assignment.tandemWeightTax || 0)

  // Check various failure reasons
  const clockedInInstructors = instructors.filter(i => i.clockedIn && !i.archived)
  if (clockedInInstructors.length === 0) {
    reasons.push('No instructors are clocked in')
  }

  const certifiedInstructors = instructors.filter(i => {
    if (assignment.jumpType === 'tandem') return i.canTandem
    if (assignment.jumpType === 'aff') return i.canAFF
    return false
  })

  if (certifiedInstructors.length === 0) {
    reasons.push(`No instructors have ${assignment.jumpType.toUpperCase()} certification`)
  }

  const weightOkayInstructors = instructors.filter(i => {
    if (assignment.jumpType === 'tandem') {
      return !i.tandemWeightLimit || totalWeight <= i.tandemWeightLimit
    }
    if (assignment.jumpType === 'aff') {
      return !i.affWeightLimit || assignment.studentWeight <= i.affWeightLimit
    }
    return false
  })

  if (weightOkayInstructors.length === 0) {
    reasons.push(`Student weight (${totalWeight}lbs) exceeds all instructor limits`)
  }

  const availableInstructors = instructors.filter(i =>
    isInstructorAvailableForLoad(i.id, targetLoad.position || 0, allLoads, loadSettings.instructorCycleTime, loadSettings.minutesBetweenLoads)
  )

  if (availableInstructors.length === 0) {
    reasons.push('All instructors are on other loads (cycle time restriction)')
  }

  if (reasons.length === 0) {
    reasons.push('All qualified instructors already assigned to other students')
  }

  return reasons
}