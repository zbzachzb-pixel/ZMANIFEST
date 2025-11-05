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
 * Helper function to filter qualified video instructors
 */
function filterQualifiedVideoInstructors(
  mainInstructorId: string,
  instructors: Instructor[],
  targetLoad: Load,
  allLoads: Load[],
  loadSettings: LoadSchedulingSettings
): Instructor[] {
  return instructors.filter(i => {
    if (i.archived) return false
    if (!i.clockedIn) return false
    if (!i.canVideo) return false
    if (i.id === mainInstructorId) return false // Can't be same as main instructor

    // Check availability (cycle time)
    const isAvailable = isInstructorAvailableForLoad(
      i.id,
      targetLoad.position || 0,
      allLoads,
      loadSettings.instructorCycleTime,
      loadSettings.minutesBetweenLoads
    )

    return isAvailable
  })
}

/**
 * Smart assignment algorithm that prioritizes filling ALL slots (main + video) over perfect rotation balance
 *
 * Algorithm:
 * Phase 1: Lock requested pairings (never reassign)
 * Phase 2: Initial assignment with video awareness (balance-sorted)
 * Phase 3: Main instructor reassignment to fill empty main slots
 * Phase 4: Video-driven reassignment to fill empty video slots
 * Phase 5: Global optimization for any remaining unfilled slots
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

  // ✅ VIDEO: Track main and video instructors separately (instructors can only do ONE role per load)
  const usedMainInstructorIds = new Set<string>()
  const usedVideoInstructorIds = new Set<string>()

  // Separate requests from regular assignments
  const requestAssignments = loadAssignments.filter(a => a.isRequest && a.instructorId)
  const regularAssignments = loadAssignments.filter(a => !a.isRequest || !a.instructorId)

  // Phase 1: Lock in all requested pairings first (these are sacred - never reassign)
  for (const request of requestAssignments) {
    if (!request.instructorId) continue

    const mainInstructor = instructors.find(i => i.id === request.instructorId)
    if (!mainInstructor) continue

    // ✅ VIDEO: Also lock in requested video instructor if specified
    let videoInstructor: Instructor | null = null
    if (request.hasOutsideVideo && request.videoInstructorId) {
      videoInstructor = instructors.find(i => i.id === request.videoInstructorId) || null
      if (videoInstructor) {
        usedVideoInstructorIds.add(videoInstructor.id)
      }
    }

    assignmentMap.set(request.studentId, { main: mainInstructor, video: videoInstructor })
    usedMainInstructorIds.add(mainInstructor.id)
  }

  // Phase 2: Initial assignment for regular students with video awareness (balance-sorted)
  const unassignedStudents: LoadAssignment[] = []
  const partiallyAssignedStudents: LoadAssignment[] = [] // ✅ VIDEO: Students with main but no video
  const studentOptions = new Map<string, Instructor[]>() // Track all main instructor options
  const studentVideoOptions = new Map<string, Instructor[]>() // ✅ VIDEO: Track all video instructor options

  for (const assignment of regularAssignments) {
    // Get ALL qualified main instructors (not just lowest balance)
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

    // Filter out already-used main instructors
    const availableQualified = allQualified.filter(i =>
      !usedMainInstructorIds.has(i.id) && !usedVideoInstructorIds.has(i.id)
    )

    if (availableQualified.length === 0) {
      unassignedStudents.push(assignment)
      continue
    }

    // ✅ VIDEO: For multi-rated instructors, decide role based on balance AND student needs
    const sortedQualified = availableQualified.slice().sort((a, b) => {
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

    const selectedMainInstructor = sortedQualified[0]
    if (!selectedMainInstructor) {
      unassignedStudents.push(assignment)
      continue
    }

    // ✅ VIDEO: If student needs video, try to assign video instructor too
    let selectedVideoInstructor: Instructor | null = null
    if (assignment.hasOutsideVideo) {
      const allQualifiedVideo = filterQualifiedVideoInstructors(
        selectedMainInstructor.id,
        instructors,
        targetLoad,
        allLoads,
        loadSettings
      )

      // Store video options for later reassignment
      studentVideoOptions.set(assignment.studentId, allQualifiedVideo)

      // Filter out already-used video instructors
      const availableVideo = allQualifiedVideo.filter(i =>
        !usedMainInstructorIds.has(i.id) && !usedVideoInstructorIds.has(i.id)
      )

      if (availableVideo.length > 0) {
        // Sort by balance (lowest first)
        availableVideo.sort((a, b) => {
          const aIsOff = isWorkingOffDay(a, new Date(), teamRotation)
          const bIsOff = isWorkingOffDay(b, new Date(), teamRotation)
          if (aIsOff !== bIsOff) return aIsOff ? 1 : -1

          const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period, allLoads, teamRotation)
          const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period, allLoads, teamRotation)
          return balanceA - balanceB
        })

        selectedVideoInstructor = availableVideo[0] || null
        if (selectedVideoInstructor) {
          usedVideoInstructorIds.add(selectedVideoInstructor.id)
        }
      } else {
        // No video instructor available - mark as partially assigned
        partiallyAssignedStudents.push(assignment)
      }
    }

    assignmentMap.set(assignment.studentId, { main: selectedMainInstructor, video: selectedVideoInstructor })
    usedMainInstructorIds.add(selectedMainInstructor.id)
  }

  // Phase 3: Main instructor reassignment - try to fill unassigned main slots by reshuffling
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

    // Try to find a main instructor for this student by reassigning others
    let foundSolution = false

    for (const candidate of options) {
      // Skip if this instructor is on a request (can't reassign requests)
      const isOnRequest = requestAssignments.some(r => r.instructorId === candidate.id)
      if (isOnRequest) continue

      // ✅ VIDEO: Skip if instructor is being used as video on another student
      if (usedVideoInstructorIds.has(candidate.id)) continue

      // Is this instructor currently assigned as main to someone else?
      const currentlyAssignedTo = Array.from(assignmentMap.entries())
        .find(([_, assigned]) => assigned.main.id === candidate.id)?.[0]

      if (!currentlyAssignedTo) {
        // This instructor is free - assign them as main
        assignmentMap.set(unassignedStudent.studentId, { main: candidate, video: null })
        usedMainInstructorIds.add(candidate.id)
        foundSolution = true
        break
      }

      // This instructor is assigned to someone else. Can we reassign that other student?
      const otherStudent = regularAssignments.find(a => a.studentId === currentlyAssignedTo)
      if (!otherStudent) continue

      const otherOptions = (studentOptions.get(currentlyAssignedTo) || [])
        .filter(i =>
          (!usedMainInstructorIds.has(i.id) && !usedVideoInstructorIds.has(i.id)) ||
          i.id === candidate.id
        )

      // Does the other student have alternative main instructor options?
      const alternativeForOther = otherOptions.find(i => i.id !== candidate.id)

      if (alternativeForOther) {
        // Reshuffle: move candidate from other student to unassigned student
        // Preserve other student's video instructor if they had one
        const otherAssignment = assignmentMap.get(currentlyAssignedTo)
        assignmentMap.set(unassignedStudent.studentId, { main: candidate, video: null })
        assignmentMap.set(currentlyAssignedTo, {
          main: alternativeForOther,
          video: otherAssignment?.video || null
        })
        usedMainInstructorIds.delete(candidate.id)
        usedMainInstructorIds.add(candidate.id)
        usedMainInstructorIds.add(alternativeForOther.id)
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

  // ✅ Phase 4: Video-driven reassignment - try to fill empty video slots by reorganizing
  for (const partialStudent of partiallyAssignedStudents) {
    const currentAssignment = assignmentMap.get(partialStudent.studentId)
    if (!currentAssignment || currentAssignment.video) continue // Already has video or not assigned

    const videoOptions = studentVideoOptions.get(partialStudent.studentId) || []
    if (videoOptions.length === 0) {
      // No video instructors exist for this student
      errors.push({
        studentName: partialStudent.studentName,
        studentId: partialStudent.studentId,
        reasons: [`No video instructors available for ${partialStudent.jumpType.toUpperCase()} students`]
      })
      continue
    }

    let foundVideoSolution = false

    // Try to find a video instructor by checking if any are being used as main
    for (const videoCandidate of videoOptions) {
      // Skip if already used as video
      if (usedVideoInstructorIds.has(videoCandidate.id)) continue

      // ✅ KEY OPTIMIZATION: Check if this video-capable instructor is currently assigned as MAIN
      const assignedAsMainTo = Array.from(assignmentMap.entries())
        .find(([_, assigned]) => assigned.main.id === videoCandidate.id)?.[0]

      if (!assignedAsMainTo) {
        // This video instructor is free - assign them
        assignmentMap.set(partialStudent.studentId, {
          main: currentAssignment.main,
          video: videoCandidate
        })
        usedVideoInstructorIds.add(videoCandidate.id)
        foundVideoSolution = true
        break
      }

      // This video-capable instructor is currently being used as MAIN for another student
      // Can we swap them to video role and reassign that student to a different main instructor?
      const otherStudent = regularAssignments.find(a => a.studentId === assignedAsMainTo)
      if (!otherStudent) continue

      // Skip if this is a requested pairing
      const isRequest = requestAssignments.some(r => r.instructorId === videoCandidate.id)
      if (isRequest) continue

      // Find alternative main instructors for the other student
      const otherMainOptions = (studentOptions.get(assignedAsMainTo) || [])
        .filter(i =>
          i.id !== videoCandidate.id &&
          !usedMainInstructorIds.has(i.id) &&
          !usedVideoInstructorIds.has(i.id)
        )

      if (otherMainOptions.length > 0) {
        // Sort by balance
        otherMainOptions.sort((a, b) => {
          const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period, allLoads, teamRotation)
          const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period, allLoads, teamRotation)
          return balanceA - balanceB
        })

        const alternativeMain = otherMainOptions[0]
        if (alternativeMain) {
          // ✅ RESHUFFLE: Move videoCandidate from main→video, assign alternative to other student
          const otherAssignment = assignmentMap.get(assignedAsMainTo)

          assignmentMap.set(partialStudent.studentId, {
            main: currentAssignment.main,
            video: videoCandidate
          })

          assignmentMap.set(assignedAsMainTo, {
            main: alternativeMain,
            video: otherAssignment?.video || null
          })

          usedMainInstructorIds.delete(videoCandidate.id)
          usedMainInstructorIds.add(alternativeMain.id)
          usedVideoInstructorIds.add(videoCandidate.id)
          foundVideoSolution = true
          break
        }
      }
    }

    if (!foundVideoSolution) {
      // Couldn't assign video instructor even with reassignment
      errors.push({
        studentName: partialStudent.studentName,
        studentId: partialStudent.studentId,
        reasons: ['All video instructors are on other loads or already assigned']
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