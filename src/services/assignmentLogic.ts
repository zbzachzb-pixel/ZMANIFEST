// src/services/assignmentLogic.ts
// ✅ CLEANED VERSION - No backwards compatibility code
// Updated version with instructor availability checks based on load timer

import { isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import { getCurrentPeriod, isWorkingOffDay, calculateInstructorBalance } from '@/lib/utils'
import { filterQualifiedInstructors } from '@/lib/instructorUtils'
import type { QueueStudent, Instructor, Assignment, Load, LoadSchedulingSettings, LoadAssignment, Period } from '@/types'

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
  /** Phase 5 exhaustive search metrics (if triggered) */
  exhaustiveSearchMetrics?: {
    /** Whether Phase 5 was triggered */
    wasTriggered: boolean
    /** Whether Phase 5 found a complete solution */
    foundSolution: boolean
    /** Number of combinations tried */
    attempts: number
    /** Time spent searching in milliseconds */
    timeMs: number
    /** Whether search timed out */
    timedOut: boolean
    /** Number of students that triggered exhaustive search */
    unassignedCount: number
  }
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

  // ✅ PRIORITY ASSIGNMENT: Sort students by constraint level (fewest options first)
  // This ensures most-constrained students get first pick, preventing later blocking
  const sortedRegularAssignments = regularAssignments.slice().sort((a, b) => {
    const studentA: QueueStudent = {
      id: a.id,
      studentAccountId: a.studentId,
      name: a.studentName,
      weight: a.studentWeight,
      jumpType: a.jumpType,
      isRequest: a.isRequest,
      timestamp: new Date().toISOString(),
      tandemWeightTax: a.tandemWeightTax,
      tandemHandcam: a.tandemHandcam,
      outsideVideo: a.hasOutsideVideo,
      affLevel: a.affLevel
    }

    const studentB: QueueStudent = {
      id: b.id,
      studentAccountId: b.studentId,
      name: b.studentName,
      weight: b.studentWeight,
      jumpType: b.jumpType,
      isRequest: b.isRequest,
      timestamp: new Date().toISOString(),
      tandemWeightTax: b.tandemWeightTax,
      tandemHandcam: b.tandemHandcam,
      outsideVideo: b.hasOutsideVideo,
      affLevel: b.affLevel
    }

    const optionsA = filterQualifiedInstructors(studentA, instructors, {
      ignoreClockStatus: false,
      targetLoad,
      allLoads,
      loadSettings
    }).length

    const optionsB = filterQualifiedInstructors(studentB, instructors, {
      ignoreClockStatus: false,
      targetLoad,
      allLoads,
      loadSettings
    }).length

    // Fewest options first (most constrained)
    return optionsA - optionsB
  })

  for (const assignment of sortedRegularAssignments) {
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

  // Phase 5: Exhaustive backtracking search for remaining unassigned students
  // Only runs if Phase 1-4 left students unassigned
  // Tries ALL possible instructor combinations to maximize assignment completion
  const finalUnassigned = regularAssignments.filter(a => !assignmentMap.has(a.studentId))

  if (finalUnassigned.length > 0) {
    console.log(`⚠️ [Phase 5] ${finalUnassigned.length} students still unassigned after Phase 4, trying exhaustive search...`)

    const exhaustiveResult = tryExhaustiveAssignment(
      finalUnassigned,
      assignmentMap,
      instructors,
      requestAssignments,
      regularAssignments,
      studentOptions,
      studentVideoOptions,
      targetLoad,
      allLoads,
      loadSettings,
      assignments,
      period,
      teamRotation,
      0,                    // Initial depth
      5,                    // Max depth (allows complex reassignment chains)
      Date.now(),           // Start time
      10000,                // 10 second timeout (will use Web Worker in Part 3)
      usedMainInstructorIds,
      usedVideoInstructorIds
    )

    if (exhaustiveResult.success) {
      console.log(`✅ [Phase 5] Found complete assignment after ${exhaustiveResult.attempts} attempts in ${exhaustiveResult.timeMs}ms`)
      return {
        assignments: exhaustiveResult.assignments,
        errors,
        successCount: exhaustiveResult.assignments.size,
        failureCount: errors.length,
        exhaustiveSearchMetrics: {
          wasTriggered: true,
          foundSolution: true,
          attempts: exhaustiveResult.attempts,
          timeMs: exhaustiveResult.timeMs,
          timedOut: false,
          unassignedCount: finalUnassigned.length
        }
      }
    } else if (exhaustiveResult.timedOut) {
      console.warn(`⏱️ [Phase 5] Timeout after ${exhaustiveResult.attempts} attempts - ${finalUnassigned.length} students remain unassigned`)
      // Add timeout errors for remaining students
      finalUnassigned.forEach(student => {
        if (!exhaustiveResult.assignments.has(student.studentId)) {
          errors.push({
            studentName: student.studentName,
            studentId: student.studentId,
            reasons: [
              'Complex assignment - exhaustive search timed out',
              `Tried ${exhaustiveResult.attempts} combinations`,
              'Please assign manually or adjust load'
            ]
          })
        }
      })

      return {
        assignments: assignmentMap,
        errors,
        successCount: assignmentMap.size,
        failureCount: errors.length,
        exhaustiveSearchMetrics: {
          wasTriggered: true,
          foundSolution: false,
          attempts: exhaustiveResult.attempts,
          timeMs: exhaustiveResult.timeMs,
          timedOut: true,
          unassignedCount: finalUnassigned.length
        }
      }
    } else {
      console.warn(`❌ [Phase 5] No solution found after ${exhaustiveResult.attempts} attempts`)
      // Errors already added in Phase 3 for truly impossible assignments

      return {
        assignments: assignmentMap,
        errors,
        successCount: assignmentMap.size,
        failureCount: errors.length,
        exhaustiveSearchMetrics: {
          wasTriggered: true,
          foundSolution: false,
          attempts: exhaustiveResult.attempts,
          timeMs: exhaustiveResult.timeMs,
          timedOut: false,
          unassignedCount: finalUnassigned.length
        }
      }
    }
  }

  return {
    assignments: assignmentMap,
    errors,
    successCount: assignmentMap.size,
    failureCount: errors.length
    // No exhaustiveSearchMetrics if Phase 5 wasn't triggered
  }
}

/**
 * Phase 5: Exhaustive backtracking search to find ANY valid complete assignment
 *
 * This function uses recursive backtracking to try all possible instructor combinations.
 * It's only called when Phases 1-4 leave students unassigned.
 *
 * SAFETY FEATURES:
 * - Respects locked requests (never reassigns)
 * - Validates all constraints (weight, certs, cycle time)
 * - Handles video assignments
 * - Detects reassignment cycles
 * - Depth limit prevents exponential blowup
 * - Time limit prevents UI freeze
 *
 * @returns Result object with success status, assignments, attempts, time, and timeout flag
 */
function tryExhaustiveAssignment(
  unassigned: LoadAssignment[],
  currentAssignments: Map<string, {main: Instructor, video: Instructor | null}>,
  instructors: Instructor[],
  requestAssignments: LoadAssignment[],
  regularAssignments: LoadAssignment[],
  studentOptions: Map<string, Instructor[]>,
  studentVideoOptions: Map<string, Instructor[]>,
  targetLoad: Load,
  allLoads: Load[],
  loadSettings: LoadSchedulingSettings,
  assignments: Assignment[],
  period: Period,
  teamRotation: 'blue' | 'red',
  depth: number,
  maxDepth: number,
  startTime: number,
  timeLimit: number,
  usedMainInstructorIds: Set<string>,
  usedVideoInstructorIds: Set<string>,
  attempts: number = 0,
  reassignmentChain: Array<{student: string, instructor: string}> = []
): {
  success: boolean
  assignments: Map<string, {main: Instructor, video: Instructor | null}>
  attempts: number
  timeMs: number
  timedOut: boolean
} {
  attempts++

  // Safety check: Time limit
  const elapsed = Date.now() - startTime
  if (elapsed > timeLimit) {
    return {
      success: false,
      assignments: currentAssignments,
      attempts,
      timeMs: elapsed,
      timedOut: true
    }
  }

  // Safety check: Depth limit
  if (depth > maxDepth) {
    return {
      success: false,
      assignments: currentAssignments,
      attempts,
      timeMs: elapsed,
      timedOut: false
    }
  }

  // Base case: All students assigned!
  if (unassigned.length === 0) {
    return {
      success: true,
      assignments: new Map(currentAssignments),
      attempts,
      timeMs: elapsed,
      timedOut: false
    }
  }

  // Try to assign first unassigned student
  const student = unassigned[0]
  if (!student) {
    // Should never happen due to length check above, but satisfies TypeScript
    return {
      success: false,
      assignments: currentAssignments,
      attempts,
      timeMs: elapsed,
      timedOut: false
    }
  }

  const remainingStudents = unassigned.slice(1)

  // Get qualified instructors for this student
  const qualifiedInstructors = (studentOptions.get(student.studentId) || [])
    .filter(i => !i.archived && i.clockedIn)

  // Try each qualified instructor
  for (const instructor of qualifiedInstructors) {
    // Check if instructor is already locked in a request
    const isLockedRequest = requestAssignments.some(
      r => r.instructorId === instructor.id || r.videoInstructorId === instructor.id
    )
    if (isLockedRequest) continue

    // Check if instructor is free
    const assignedTo = Array.from(currentAssignments.entries())
      .find(([_, assigned]) => assigned.main.id === instructor.id || assigned.video?.id === instructor.id)

    if (!assignedTo) {
      // Instructor is free - try direct assignment
      const newAssignments = new Map(currentAssignments)
      const newUsedMain = new Set(usedMainInstructorIds)
      const newUsedVideo = new Set(usedVideoInstructorIds)

      // Assign main instructor
      let videoInstructor: Instructor | null = null

      // If student needs video, try to assign video instructor
      if (student.hasOutsideVideo) {
        const videoOptions = (studentVideoOptions.get(student.studentId) || [])
          .filter(v =>
            !newUsedMain.has(v.id) &&
            !newUsedVideo.has(v.id) &&
            !requestAssignments.some(r => r.instructorId === v.id || r.videoInstructorId === v.id)
          )

        if (videoOptions.length > 0 && videoOptions[0]) {
          videoInstructor = videoOptions[0]
          newUsedVideo.add(videoInstructor.id)
        } else {
          // Can't assign required video - skip this branch
          continue
        }
      }

      newAssignments.set(student.studentId, { main: instructor, video: videoInstructor })
      newUsedMain.add(instructor.id)

      // Recursively try to assign remaining students
      const result = tryExhaustiveAssignment(
        remainingStudents,
        newAssignments,
        instructors,
        requestAssignments,
        regularAssignments,
        studentOptions,
        studentVideoOptions,
        targetLoad,
        allLoads,
        loadSettings,
        assignments,
        period,
        teamRotation,
        depth,
        maxDepth,
        startTime,
        timeLimit,
        newUsedMain,
        newUsedVideo,
        attempts,
        reassignmentChain
      )

      if (result.success) return result
      attempts = result.attempts

    } else {
      // Instructor is already assigned - try reassignment
      const [assignedStudentId, assignedInstructors] = assignedTo

      // Check for reassignment cycle
      const wouldCreateCycle = reassignmentChain.some(
        r => r.instructor === instructor.id && r.student === assignedStudentId
      )
      if (wouldCreateCycle) continue

      // Skip if assigned to a locked request
      const assignedIsRequest = requestAssignments.some(r => r.studentId === assignedStudentId)
      if (assignedIsRequest) continue

      // Find the assigned student's details
      const assignedStudent = regularAssignments.find(a => a.studentId === assignedStudentId)
      if (!assignedStudent) continue

      // Get alternative instructors for the currently-assigned student
      const alternativeInstructors = (studentOptions.get(assignedStudentId) || [])
        .filter(alt =>
          alt.id !== instructor.id &&
          !alt.archived &&
          alt.clockedIn &&
          !requestAssignments.some(r => r.instructorId === alt.id)
        )

      // Try each alternative for the other student
      for (const alternative of alternativeInstructors) {
        // Check if alternative is free
        const altAssignedTo = Array.from(currentAssignments.entries())
          .find(([_, assigned]) => assigned.main.id === alternative.id || assigned.video?.id === alternative.id)

        if (altAssignedTo) continue // Alternative is also used, skip

        // Create new assignment map with reassignment
        const newAssignments = new Map(currentAssignments)
        const newUsedMain = new Set(usedMainInstructorIds)
        const newUsedVideo = new Set(usedVideoInstructorIds)

        // Assign current student to the instructor
        let videoInstructor: Instructor | null = null
        if (student.hasOutsideVideo) {
          const videoOptions = (studentVideoOptions.get(student.studentId) || [])
            .filter(v =>
              !newUsedMain.has(v.id) &&
              !newUsedVideo.has(v.id) &&
              v.id !== instructor.id &&
              v.id !== alternative.id &&
              !requestAssignments.some(r => r.instructorId === v.id || r.videoInstructorId === v.id)
            )

          if (videoOptions.length > 0 && videoOptions[0]) {
            videoInstructor = videoOptions[0]
            newUsedVideo.add(videoInstructor.id)
          } else {
            continue // Can't assign required video
          }
        }

        newAssignments.set(student.studentId, { main: instructor, video: videoInstructor })

        // Reassign the other student to alternative
        let altVideoInstructor: Instructor | null = assignedInstructors.video
        if (assignedStudent.hasOutsideVideo && !altVideoInstructor) {
          // Other student needs video too
          const altVideoOptions = (studentVideoOptions.get(assignedStudentId) || [])
            .filter(v =>
              !newUsedMain.has(v.id) &&
              !newUsedVideo.has(v.id) &&
              v.id !== instructor.id &&
              v.id !== alternative.id &&
              !requestAssignments.some(r => r.instructorId === v.id || r.videoInstructorId === v.id)
            )

          if (altVideoOptions.length > 0 && altVideoOptions[0]) {
            altVideoInstructor = altVideoOptions[0]
            newUsedVideo.add(altVideoInstructor.id)
          } else {
            continue // Can't assign required video to reassigned student
          }
        }

        newAssignments.set(assignedStudentId, { main: alternative, video: altVideoInstructor })

        // Update usage tracking
        newUsedMain.delete(instructor.id)
        newUsedMain.add(alternative.id)

        // Add to reassignment chain
        const newChain = [
          ...reassignmentChain,
          { student: assignedStudentId, instructor: instructor.id }
        ]

        // Recursively try to assign remaining students
        const result = tryExhaustiveAssignment(
          remainingStudents,
          newAssignments,
          instructors,
          requestAssignments,
          regularAssignments,
          studentOptions,
          studentVideoOptions,
          targetLoad,
          allLoads,
          loadSettings,
          assignments,
          period,
          teamRotation,
          depth + 1, // Increment depth for reassignment
          maxDepth,
          startTime,
          timeLimit,
          newUsedMain,
          newUsedVideo,
          attempts,
          newChain
        )

        if (result.success) return result
        attempts = result.attempts
      }
    }
  }

  // No solution found in this branch
  return {
    success: false,
    assignments: currentAssignments,
    attempts,
    timeMs: Date.now() - startTime,
    timedOut: false
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