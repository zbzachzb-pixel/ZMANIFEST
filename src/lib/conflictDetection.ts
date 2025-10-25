// src/lib/conflictDetection.ts
// Conflict detection and warning system

import type { Load, Instructor, LoadSchedulingSettings } from '@/types'
import { isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'

export type ConflictSeverity = 'error' | 'warning' | 'info'

export interface Conflict {
  id: string
  severity: ConflictSeverity
  title: string
  message: string
  affectedItems: string[] // IDs of affected instructors, loads, students
  suggestions?: string[]
  autoFixAvailable?: boolean
  autoFix?: () => Promise<void>
}

export interface ConflictDetectionCallbacks {
  onRemoveLastStudent?: (loadId: string) => Promise<void>
  onAutoAssignInstructors?: (loadId: string) => Promise<void>
  onRemoveOutsideVideo?: (loadId: string, assignmentIds: string[]) => Promise<void>
}

/**
 * Detect all conflicts for a specific load
 */
export function detectLoadConflicts(
  load: Load,
  allLoads: Load[],
  instructors: Instructor[],
  settings: LoadSchedulingSettings,
  callbacks?: ConflictDetectionCallbacks
): Conflict[] {
  const conflicts: Conflict[] = []

  // 1. Check for instructors on too many consecutive loads
  conflicts.push(...detectConsecutiveLoadConflicts(load, allLoads, instructors))

  // 2. Check for unavailable instructors (cycle time)
  conflicts.push(...detectUnavailableInstructorConflicts(load, allLoads, instructors, settings))

  // 3. Check for capacity issues
  conflicts.push(...detectCapacityConflicts(load, callbacks))

  // 4. Check for weight limit violations
  conflicts.push(...detectWeightLimitConflicts(load, instructors))

  // 5. Check for clocked out instructors
  conflicts.push(...detectClockedOutConflicts(load, instructors))

  // 6. Check for unassigned students
  conflicts.push(...detectUnassignedStudentConflicts(load, callbacks))

  // 7. Check for missing video instructors
  conflicts.push(...detectMissingVideoConflicts(load, callbacks))

  return conflicts
}

/**
 * Detect instructors on too many consecutive loads
 */
function detectConsecutiveLoadConflicts(
  load: Load,
  allLoads: Load[],
  instructors: Instructor[]
): Conflict[] {
  const conflicts: Conflict[] = []
  const MAX_CONSECUTIVE = 4 // Configurable threshold

  if (!load.assignments) return conflicts

  const instructorIds = new Set(
    load.assignments
      .map(a => a.instructorId)
      .filter((id): id is string => Boolean(id))
  )

  instructorIds.forEach(instructorId => {
    const instructor = instructors.find(i => i.id === instructorId)
    if (!instructor) return

    // Count consecutive loads before this one
    const sortedLoads = allLoads
      .filter(l => l.status !== 'completed')
      .sort((a, b) => (a.position || 0) - (b.position || 0))

    const currentLoadIndex = sortedLoads.findIndex(l => l.id === load.id)
    let consecutiveCount = 1

    // Look backwards
    for (let i = currentLoadIndex - 1; i >= 0; i--) {
      const prevLoad = sortedLoads[i]
      if (!prevLoad) break

      const isOnLoad = prevLoad.assignments?.some(a => a.instructorId === instructorId)
      if (isOnLoad) {
        consecutiveCount++
      } else {
        break
      }
    }

    if (consecutiveCount >= MAX_CONSECUTIVE) {
      conflicts.push({
        id: `consecutive_${load.id}_${instructorId}`,
        severity: 'warning',
        title: 'Consecutive Load Warning',
        message: `${instructor.name} is on ${consecutiveCount} consecutive loads. Consider rotation.`,
        affectedItems: [instructorId, load.id],
        suggestions: [
          'Assign a different instructor to this load',
          'Review rotation fairness',
          'Consider instructor fatigue'
        ]
      })
    }
  })

  return conflicts
}

/**
 * Detect instructors who aren't available due to cycle time
 */
function detectUnavailableInstructorConflicts(
  load: Load,
  allLoads: Load[],
  instructors: Instructor[],
  settings: LoadSchedulingSettings
): Conflict[] {
  const conflicts: Conflict[] = []

  if (!load.assignments) return conflicts

  // Only check loads that come BEFORE this load (not including the current load)
  const previousLoads = allLoads.filter(l => (l.position || 0) < (load.position || 0))

  load.assignments.forEach(assignment => {
    const instructor = instructors.find(i => i.id === assignment.instructorId)
    if (!instructor) return

    const isAvailable = isInstructorAvailableForLoad(
      instructor.id,
      load.position || 0,
      previousLoads, // Only check previous loads, not all loads
      settings.instructorCycleTime,
      settings.minutesBetweenLoads
    )

    if (!isAvailable) {
      conflicts.push({
        id: `unavailable_${load.id}_${instructor.id}`,
        severity: 'error',
        title: 'Instructor Not Available',
        message: `${instructor.name} may not be back from previous load in time (${settings.instructorCycleTime}min cycle time).`,
        affectedItems: [instructor.id, load.id],
        suggestions: [
          'Delay this load',
          'Assign a different instructor',
          'Adjust cycle time settings'
        ]
      })
    }
  })

  return conflicts
}

/**
 * Detect capacity issues
 */
function detectCapacityConflicts(load: Load, callbacks?: ConflictDetectionCallbacks): Conflict[] {
  const conflicts: Conflict[] = []

  if (!load.assignments) return conflicts

  const totalPeople = load.assignments.reduce((sum, a) => {
    return sum + 2 + (a.hasOutsideVideo ? 1 : 0) // student + instructor + optional videographer
  }, 0)

  const capacity = load.capacity || 18

  if (totalPeople > capacity) {
    conflicts.push({
      id: `capacity_${load.id}`,
      severity: 'error',
      title: 'Capacity Exceeded',
      message: `Load has ${totalPeople} people but capacity is ${capacity}. Remove ${totalPeople - capacity} slot(s).`,
      affectedItems: [load.id],
      suggestions: [
        'Remove last student from this load',
        'Move students to a different load',
        'Split into multiple loads'
      ],
      autoFixAvailable: !!callbacks?.onRemoveLastStudent,
      autoFix: callbacks?.onRemoveLastStudent ? async () => {
        await callbacks.onRemoveLastStudent!(load.id)
      } : undefined
    })
  } else if (totalPeople === capacity) {
    conflicts.push({
      id: `capacity_full_${load.id}`,
      severity: 'info',
      title: 'Load at Full Capacity',
      message: `Load is at maximum capacity (${totalPeople}/${capacity}).`,
      affectedItems: [load.id]
    })
  }

  return conflicts
}

/**
 * Detect weight limit violations
 */
function detectWeightLimitConflicts(
  load: Load,
  instructors: Instructor[]
): Conflict[] {
  const conflicts: Conflict[] = []

  if (!load.assignments) return conflicts

  load.assignments.forEach(assignment => {
    const instructor = instructors.find(i => i.id === assignment.instructorId)
    if (!instructor) return

    if (assignment.jumpType === 'tandem') {
      const totalWeight = assignment.studentWeight + (assignment.tandemWeightTax || 0)
      const limit = instructor.tandemWeightLimit

      if (limit && totalWeight > limit) {
        conflicts.push({
          id: `weight_${load.id}_${assignment.id}`,
          severity: 'error',
          title: 'Weight Limit Exceeded',
          message: `${assignment.studentName} (${totalWeight}lbs) exceeds ${instructor.name}'s limit (${limit}lbs).`,
          affectedItems: [instructor.id, load.id],
          suggestions: [
            'Assign to an instructor with higher weight limit',
            'Verify student weight is correct'
          ]
        })
      }
    }

    if (assignment.jumpType === 'aff') {
      const weight = assignment.studentWeight
      const limit = instructor.affWeightLimit

      if (limit && weight > limit) {
        conflicts.push({
          id: `aff_weight_${load.id}_${assignment.id}`,
          severity: 'error',
          title: 'AFF Weight Limit Exceeded',
          message: `${assignment.studentName} (${weight}lbs) exceeds ${instructor.name}'s AFF limit (${limit}lbs).`,
          affectedItems: [instructor.id, load.id],
          suggestions: [
            'Assign to an instructor with higher weight limit',
            'Verify student weight is correct'
          ]
        })
      }
    }
  })

  return conflicts
}

/**
 * Detect clocked out instructors
 */
function detectClockedOutConflicts(
  load: Load,
  instructors: Instructor[]
): Conflict[] {
  const conflicts: Conflict[] = []

  if (!load.assignments) return conflicts

  const instructorIds = new Set([
    ...load.assignments.map(a => a.instructorId),
    ...load.assignments.map(a => a.videoInstructorId)
  ].filter((id): id is string => Boolean(id)))

  instructorIds.forEach(instructorId => {
    const instructor = instructors.find(i => i.id === instructorId)
    if (!instructor) return

    if (!instructor.clockedIn) {
      conflicts.push({
        id: `clocked_out_${load.id}_${instructorId}`,
        severity: 'warning',
        title: 'Instructor Not Clocked In',
        message: `${instructor.name} is assigned but not clocked in.`,
        affectedItems: [instructorId, load.id],
        suggestions: [
          'Clock in the instructor',
          'Assign a different instructor'
        ]
      })
    }
  })

  return conflicts
}

/**
 * Detect unassigned students
 */
function detectUnassignedStudentConflicts(load: Load, callbacks?: ConflictDetectionCallbacks): Conflict[] {
  const conflicts: Conflict[] = []

  if (!load.assignments || load.status === 'building') return conflicts

  const unassignedCount = load.assignments.filter(a => !a.instructorId).length

  if (unassignedCount > 0 && (load.status === 'ready' || load.status === 'departed')) {
    conflicts.push({
      id: `unassigned_${load.id}`,
      severity: 'error',
      title: 'Unassigned Students',
      message: `${unassignedCount} student(s) have no instructor assigned.`,
      affectedItems: [load.id],
      suggestions: [
        'Use auto-assign to assign instructors',
        'Manually assign instructors',
        'Move students back to queue'
      ],
      autoFixAvailable: !!callbacks?.onAutoAssignInstructors,
      autoFix: callbacks?.onAutoAssignInstructors ? async () => {
        await callbacks.onAutoAssignInstructors!(load.id)
      } : undefined
    })
  }

  return conflicts
}

/**
 * Detect missing video instructors for outside video
 */
function detectMissingVideoConflicts(
  load: Load,
  callbacks?: ConflictDetectionCallbacks
): Conflict[] {
  const conflicts: Conflict[] = []

  if (!load.assignments || load.status === 'building') return conflicts

  const missingVideo = load.assignments.filter(a => a.hasOutsideVideo && !a.videoInstructorId)

  if (missingVideo.length > 0) {
    const assignmentIds = missingVideo.map(a => a.id)

    conflicts.push({
      id: `missing_video_${load.id}`,
      severity: 'warning',
      title: 'Missing Video Instructor',
      message: `${missingVideo.length} student(s) need outside video but no video instructor assigned.`,
      affectedItems: [load.id],
      suggestions: [
        'Assign video instructors',
        'Remove outside video option',
        'Use auto-assign'
      ],
      autoFixAvailable: !!callbacks?.onRemoveOutsideVideo,
      autoFix: callbacks?.onRemoveOutsideVideo ? async () => {
        await callbacks.onRemoveOutsideVideo!(load.id, assignmentIds)
      } : undefined
    })
  }

  return conflicts
}

/**
 * Get conflict summary for display
 */
export function getConflictSummary(conflicts: Conflict[]): {
  errors: number
  warnings: number
  info: number
  total: number
  hasBlockers: boolean
} {
  const errors = conflicts.filter(c => c.severity === 'error').length
  const warnings = conflicts.filter(c => c.severity === 'warning').length
  const info = conflicts.filter(c => c.severity === 'info').length

  return {
    errors,
    warnings,
    info,
    total: conflicts.length,
    hasBlockers: errors > 0
  }
}
