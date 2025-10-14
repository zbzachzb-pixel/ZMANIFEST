// src/services/assignmentLogic.ts
// Updated version with instructor availability checks based on load timer

import { isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import { getCurrentPeriod, calculateInstructorBalance } from '@/lib/utils'
import type { QueueStudent, Instructor, Assignment, Load, LoadSchedulingSettings } from '@/types'

export interface SuggestedInstructors {
  main: Instructor | null
  video: Instructor | null
  needsVideo: boolean
  isMainClockedOut: boolean
  unavailableReason?: string  // NEW: Reason why instructor isn't available
}

/**
 * Get suggested instructors for a student with load timer awareness
 * Now checks if instructors are available for the target load based on cycle time
 */
export function getSuggestedInstructors(
  student: QueueStudent,
  instructors: Instructor[],
  assignments: Assignment[],
  targetLoad: Load,  // NEW: Need to know which load we're assigning to
  allLoads: Load[],  // NEW: Need all loads to calculate availability
  loadSettings: LoadSchedulingSettings,  // NEW: Need settings for cycle time calculation
  ignoreClockStatus = false
): SuggestedInstructors {
  const period = getCurrentPeriod()
  const needsVideo = student.jumpType === 'tandem' && (student.outsideVideo === true)

  // Find qualified main instructors
  const qualified: Instructor[] = []

  for (const inst of instructors) {
    if (inst.archived) continue
    if (!ignoreClockStatus && !inst.clockedIn) continue

    // Check department qualification
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

    // ⚡ NEW: Check if instructor is available for this load based on cycle time
    const isAvailable = isInstructorAvailableForLoad(
      inst.id,
      targetLoad.position,
      allLoads,
      loadSettings.instructorCycleTime,
      loadSettings.minutesBetweenLoads
    )

    if (!isAvailable) {
      console.log(`⏰ Instructor ${inst.name} not available for Load #${targetLoad.position} (still on cooldown)`)
      continue
    }

    qualified.push(inst)
  }

  if (qualified.length === 0) {
    return {
      main: null,
      video: null,
      needsVideo,
      isMainClockedOut: true,
      unavailableReason: 'No qualified instructors available (check clock-in status and load cooldowns)'
    }
  }

  // Sort by balance (lowest first)
  qualified.sort((a, b) => {
    const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period)
    const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period)
    return balanceA - balanceB
  })

  const mainInstructor = qualified[0]

  // Find video instructor if needed
  let videoInstructor: Instructor | null = null
  if (needsVideo) {
    const qualifiedVideo = instructors.filter(inst => {
      if (inst.archived) return false
      if (!ignoreClockStatus && !inst.clockedIn) return false
      if (!inst.canVideo) return false
      if (inst.id === mainInstructor.id) return false
      
      // ⚡ NEW: Check video instructor availability too
      const isAvailable = isInstructorAvailableForLoad(
        inst.id,
        targetLoad.position,
        allLoads,
        loadSettings.instructorCycleTime,
        loadSettings.minutesBetweenLoads
      )
      
      if (!isAvailable) {
        console.log(`⏰ Video instructor ${inst.name} not available for Load #${targetLoad.position}`)
        return false
      }
      
      return true
    })

    if (qualifiedVideo.length > 0) {
      qualifiedVideo.sort((a, b) => {
        const balanceA = calculateInstructorBalance(a.id, assignments, instructors, period)
        const balanceB = calculateInstructorBalance(b.id, assignments, instructors, period)
        return balanceA - balanceB
      })
      videoInstructor = qualifiedVideo[0]
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

    // Check department qualification
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

  // Find video instructor if needed
  let videoInstructor: Instructor | null = null
  if (needsVideo) {
    const qualifiedVideo = instructors.filter(inst => {
      if (inst.archived) return false
      if (!ignoreClockStatus && !inst.clockedIn) return false
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
      videoInstructor = qualifiedVideo[0]
    }
  }

  return {
    main: mainInstructor,
    video: videoInstructor,
    needsVideo,
    isMainClockedOut: false
  }
}