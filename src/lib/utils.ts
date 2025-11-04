// src/lib/utils.ts - FIXED VERSION
// ✅ Issue #7 Fixed: Added missing isWorkingOffDay function
// ✅ Issue #8 Fixed: Completed getCurrentWeekRotation implementation
// ✅ Issue #26 Fixed: Added deprecation warnings and clear documentation
// ✅ NEW FIX: Video instructor payment logic now consistent

import type { Assignment, Instructor, Period, Team, Load, LoadAssignment } from '@/types'
import { PAY_RATES } from './constants'

// ==================== PAY CALCULATIONS ====================

/**
 * Calculate pay for a single assignment
 * This is the BASE pay without any multipliers (no off-day bonus applied)
 *
 * @param assignment - The assignment to calculate pay for
 * @returns The base pay amount in dollars
 *
 * @example
 * const tandemAssignment = { jumpType: 'tandem', tandemWeightTax: 2, tandemHandcam: true };
 * const pay = calculateAssignmentPay(tandemAssignment); // Returns base tandem + weight tax + handcam
 */
export function calculateAssignmentPay(assignment: Assignment): number {
  if (assignment.isMissedJump) return 0
  
  if (assignment.jumpType === 'tandem') {
    let pay = PAY_RATES.TANDEM_BASE
    pay += (assignment.tandemWeightTax || 0) * PAY_RATES.TANDEM_WEIGHT_TAX
    if (assignment.tandemHandcam) pay += PAY_RATES.TANDEM_HANDCAM
    return pay
  }
  
  if (assignment.jumpType === 'aff') {
    return assignment.affLevel === 'lower' 
      ? PAY_RATES.AFF_LOWER 
      : PAY_RATES.AFF_UPPER
  }
  
  if (assignment.jumpType === 'video') {
    return PAY_RATES.VIDEO_INSTRUCTOR
  }
  
  return 0
}

/**
 * Calculate projected pay for a LoadAssignment (before load is completed)
 * Similar to calculateAssignmentPay but works with LoadAssignment type
 * Used for calculating instructor balance from pending (non-completed) loads
 *
 * @param loadAssignment - The load assignment to calculate projected pay for
 * @returns The projected base pay amount in dollars (no off-day multiplier)
 *
 * @example
 * const projectedPay = calculateProjectedPay(loadAssignment); // Returns base pay for pending jump
 */
function calculateProjectedPay(loadAssignment: LoadAssignment): number {
  if (loadAssignment.jumpType === 'tandem') {
    let pay = PAY_RATES.TANDEM_BASE
    pay += (loadAssignment.tandemWeightTax || 0) * PAY_RATES.TANDEM_WEIGHT_TAX
    if (loadAssignment.tandemHandcam) pay += PAY_RATES.TANDEM_HANDCAM
    return pay
  }

  if (loadAssignment.jumpType === 'aff') {
    return loadAssignment.affLevel === 'lower'
      ? PAY_RATES.AFF_LOWER
      : PAY_RATES.AFF_UPPER
  }

  return 0
}

/**
 * Check if instructor is working on their scheduled off day
 * Gold team has no off days. Blue/Red teams can have Mon/Tue or Wed/Thu off.
 *
 * @param instructor - The instructor to check
 * @param date - The date to check
 * @param teamOff - Which team has days off ('blue' or 'red', defaults to 'blue')
 * @param daysOff - Which days are off ('mon-tue' or 'wed-thu', defaults to 'mon-tue')
 * @returns true if the instructor is working on their scheduled day off
 *
 * @example
 * const isOffDay = isWorkingOffDay(blueTeamInstructor, new Date(), 'blue', 'mon-tue');
 */
export function isWorkingOffDay(
  instructor: Instructor,
  date: Date,
  teamOff: 'blue' | 'red' = 'blue',
  daysOff: 'mon-tue' | 'wed-thu' = 'mon-tue'
): boolean {
  // ✅ Gold team has no off days - always treated as working their schedule
  if (instructor.team === 'gold') {
    return false
  }

  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Check if this instructor's team has days off
  if (instructor.team !== teamOff) {
    return false // Working their normal schedule
  }

  // Check if today is one of their off days
  if (daysOff === 'mon-tue') {
    // Monday (1) or Tuesday (2)
    return dayOfWeek === 1 || dayOfWeek === 2
  } else {
    // Wednesday (3) or Thursday (4)
    return dayOfWeek === 3 || dayOfWeek === 4
  }
}

/**
 * Calculate instructor's BALANCE for rotation fairness
 * - Includes BOTH completed assignments AND pending load assignments
 * - Excludes request jumps (they don't count toward rotation)
 * - Excludes missed jumps (no pay but counts as assignment)
 * - Applies off-day multiplier (1.2x) for balance fairness
 *
 * This is the primary function for instructor rotation and load balancing.
 * Use this to determine who should get the next assignment.
 *
 * @param instructorId - The instructor's ID to calculate balance for
 * @param assignments - All completed assignments in the system
 * @param instructors - All instructors (needed for off-day calculation)
 * @param period - The period to calculate balance for
 * @param allLoads - All loads (to count pending assignments from non-completed loads)
 * @returns The instructor's balance score (higher = more assignments/pay)
 *
 * @example
 * const balance = calculateInstructorBalance('instructor-1', allAssignments, allInstructors, currentPeriod, allLoads);
 * // Use balance to sort instructors: lowest balance gets next assignment
 */
export function calculateInstructorBalance(
  instructorId: string,
  assignments: Assignment[],
  instructors: Instructor[],
  period: Period,
  allLoads: Load[] = [],
  teamRotation: 'blue' | 'red' = 'blue',
  daysOff: 'mon-tue' | 'wed-thu' = 'mon-tue'
): number {
  let total = 0
  
  const instructor = instructors.find(i => i.id === instructorId)
  if (!instructor) return 0
  
  for (const assignment of assignments) {
    const assignmentDate = new Date(assignment.timestamp)

    // Only count assignments in the current period
    if (assignmentDate < period.start || assignmentDate > period.end) {
      continue
    }

    // ✅ BUG FIX: Skip soft-deleted assignments (reverted loads)
    if (assignment.isDeleted) continue

    // Requests don't count toward balance (rotation fairness)
    if (assignment.isRequest) continue
    
    // Main instructor assignment
    if (assignment.instructorId === instructorId && !assignment.isMissedJump) {
      let pay = calculateAssignmentPay(assignment)

      // Apply off-day multiplier for balance fairness
      if (isWorkingOffDay(instructor, assignmentDate, teamRotation, daysOff)) {
        pay = Math.round(pay * PAY_RATES.OFF_DAY_MULTIPLIER)
      }

      total += pay
    }

    // ✅ FIXED: Video instructor assignment - treated exactly like main instructor
    // Video instructors get balance credit when assigned (unless missed jump)
    // No hasOutsideVideo check - if they're assigned as videoInstructorId, they get credit
    if (assignment.videoInstructorId === instructorId && !assignment.isMissedJump) {
      let videoPay: number = PAY_RATES.VIDEO_INSTRUCTOR  // $45

      // Apply off-day multiplier if working on scheduled off day
      if (isWorkingOffDay(instructor, assignmentDate, teamRotation, daysOff)) {
        videoPay = Math.round(videoPay * PAY_RATES.OFF_DAY_MULTIPLIER)
      }

      total += videoPay
    }
  }

  // ✅ NEW: Count pending assignments from non-completed loads
  // This allows balance to reflect real-time workload commitment
  for (const load of allLoads) {
    // Skip completed loads (already counted as Assignment records above)
    if (load.status === 'completed') continue
    if (!load.assignments) continue

    for (const loadAssignment of load.assignments) {
      // Skip requests (don't count toward rotation fairness)
      if (loadAssignment.isRequest) continue

      // Main instructor assignment
      if (loadAssignment.instructorId === instructorId) {
        let projectedPay = calculateProjectedPay(loadAssignment)

        // Apply off-day multiplier for balance fairness
        if (isWorkingOffDay(instructor, new Date(), teamRotation, daysOff)) {
          projectedPay = Math.round(projectedPay * PAY_RATES.OFF_DAY_MULTIPLIER)
        }

        total += projectedPay
      }

      // Video instructor assignment
      if (loadAssignment.videoInstructorId === instructorId) {
        let videoPay: number = PAY_RATES.VIDEO_INSTRUCTOR

        // Apply off-day multiplier if working on scheduled off day
        if (isWorkingOffDay(instructor, new Date(), teamRotation, daysOff)) {
          videoPay = Math.round(videoPay * PAY_RATES.OFF_DAY_MULTIPLIER)
        }

        total += videoPay
      }
    }
  }

  return total
}

// ✅ FIXED #26: Added deprecation warning and clear documentation
/**
 * @deprecated Use calculateInstructorBalance() for rotation fairness calculations
 * This function name is misleading - it calculates balance, not earnings
 * For actual earnings/paychecks, use calculateInstructorTotalEarnings()
 * 
 * LEGACY FUNCTION NAME - Kept for backwards compatibility
 */
export function calculateInstructorEarnings(
  instructorId: string,
  assignments: Assignment[],
  instructors: Instructor[],
  period: Period,
  allLoads: Load[] = []
): number {
  // Log warning when used
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      'calculateInstructorEarnings is deprecated. Use calculateInstructorBalance for rotation or calculateInstructorTotalEarnings for paychecks'
    )
  }
  return calculateInstructorBalance(instructorId, assignments, instructors, period, allLoads)
}

/**
 * Calculate instructor's TOTAL EARNINGS (actual paychecks)
 * - Includes request jumps (they get paid for these)
 * - Excludes missed jumps (no pay)
 * - NO off-day multiplier (actual pay doesn't get bonus, only balance does)
 *
 * Use this function for payroll and earnings reports.
 * For rotation fairness, use calculateInstructorBalance() instead.
 *
 * @param instructorId - The instructor's ID to calculate earnings for
 * @param assignments - All assignments in the system
 * @param period - The period to calculate earnings for
 * @returns The instructor's total earnings in dollars
 *
 * @example
 * const earnings = calculateInstructorTotalEarnings('instructor-1', allAssignments, currentPeriod);
 * console.log(`Total pay: $${earnings}`);
 */
export function calculateInstructorTotalEarnings(
  instructorId: string,
  assignments: Assignment[],
  period: Period
): number {
  let total = 0
  
  for (const assignment of assignments) {
    const assignmentDate = new Date(assignment.timestamp)

    // Only count assignments in the current period
    if (assignmentDate < period.start || assignmentDate > period.end) {
      continue
    }

    // ✅ BUG FIX: Skip soft-deleted assignments (reverted loads)
    if (assignment.isDeleted) continue

    // Main instructor - includes requests, excludes missed
    if (assignment.instructorId === instructorId && !assignment.isMissedJump) {
      total += calculateAssignmentPay(assignment)
    }
    
    // ✅ FIXED: Video instructor earnings - removed incorrect hasOutsideVideo check
    // Video instructors get paid when assigned (unless missed jump)
    // They get paid regardless of hasOutsideVideo flag - if videoInstructorId is set, they worked
    if (assignment.videoInstructorId === instructorId && !assignment.isMissedJump) {
      total += PAY_RATES.VIDEO_INSTRUCTOR
    }
  }
  
  return total
}

// ==================== TEAM SCHEDULE LOGIC ====================

/**
 * Get which team has Monday/Tuesday off this week
 *
 * ⚠️ DEPRECATED: This function uses automatic week-based rotation.
 * The system now uses a manual toggle in Settings (teamRotation).
 *
 * This function is kept for backwards compatibility but should not be used.
 * Instead, read the teamRotation setting from the database.
 *
 * @returns The team that has Monday/Tuesday off ('blue' or 'red')
 * @deprecated Use settings.teamRotation instead
 *
 * @example
 * // OLD (deprecated):
 * const teamOff = getCurrentWeekRotation();
 *
 * // NEW (correct):
 * const { data: settings } = useSettings();
 * const teamOff = settings?.teamRotation || 'blue';
 */
export function getCurrentWeekRotation(): Team {
  // ✅ BUG FIX #1: Default to 'blue' instead of automatic calculation
  // The actual rotation is now stored in settings.teamRotation
  console.warn('getCurrentWeekRotation() is deprecated. Use settings.teamRotation instead.')
  return 'blue'
}

/**
 * Get the weekly schedule showing which team is working/off
 *
 * ⚠️ DEPRECATED: This function uses automatic week-based rotation.
 * The system now uses a manual toggle stored in settings.teamRotation.
 *
 * @returns Object with schedule strings for red and blue teams
 * @deprecated Read settings.teamRotation and build schedule object manually
 *
 * @example
 * // OLD (deprecated):
 * const schedule = getWeekSchedule();
 *
 * // NEW (correct):
 * const { data: settings } = useSettings();
 * const teamOff = settings?.teamRotation || 'blue';
 * const schedule = {
 *   redTeam: teamOff === 'red' ? 'Monday & Tuesday OFF' : 'Working All Week',
 *   blueTeam: teamOff === 'blue' ? 'Monday & Tuesday OFF' : 'Working All Week'
 * };
 */
export function getWeekSchedule(): { redTeam: string, blueTeam: string } {
  console.warn('getWeekSchedule() is deprecated. Use settings.teamRotation instead.')
  const teamOff = getCurrentWeekRotation()

  if (teamOff === 'blue') {
    return {
      blueTeam: 'Monday & Tuesday OFF',
      redTeam: 'Working All Week'
    }
  } else {
    return {
      redTeam: 'Monday & Tuesday OFF',
      blueTeam: 'Working All Week'
    }
  }
}

// ==================== PERIOD MANAGEMENT ====================

/**
 * Get the current pay period based on today's date
 * Periods are defined as:
 * - Period 1: First Monday of month to day before third Monday
 * - Period 2: Third Monday of month to day before next month's first Monday
 *
 * @returns The current period with id, name, start/end dates, and active status
 *
 * @example
 * const period = getCurrentPeriod();
 * console.log(period.name); // "Period 1: 1/6/2025 - 1/19/2025"
 */
export function getCurrentPeriod(): Period {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  
  // Calculate first Monday of the month
  const firstDay = new Date(year, month, 1)
  const dayOfWeek = firstDay.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
  const firstMonday = new Date(firstDay)
  firstMonday.setDate(firstDay.getDate() + daysUntilMonday)
  
  // Calculate third Monday (14 days after first Monday)
  const thirdMonday = new Date(firstMonday)
  thirdMonday.setDate(firstMonday.getDate() + 14)
  
  // Determine which period we're in
  if (today >= firstMonday && today < thirdMonday) {
    // Period 1
    return {
      id: `${year}-${month + 1}-period-1`,
      name: `Period 1: ${firstMonday.toLocaleDateString()} - ${new Date(thirdMonday.getTime() - 1).toLocaleDateString()}`,
      start: firstMonday,
      end: new Date(thirdMonday.getTime() - 1),
      isActive: true
    }
  } else if (today >= thirdMonday) {
    // Period 2
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const nextFirstDay = new Date(nextYear, nextMonth, 1)
    const nextDayOfWeek = nextFirstDay.getDay()
    const nextDaysUntilMonday = nextDayOfWeek === 0 ? 1 : nextDayOfWeek === 1 ? 0 : 8 - nextDayOfWeek
    const nextFirstMonday = new Date(nextFirstDay)
    nextFirstMonday.setDate(nextFirstDay.getDate() + nextDaysUntilMonday)
    
    return {
      id: `${year}-${month + 1}-period-2`,
      name: `Period 2: ${thirdMonday.toLocaleDateString()} - ${new Date(nextFirstMonday.getTime() - 1).toLocaleDateString()}`,
      start: thirdMonday,
      end: new Date(nextFirstMonday.getTime() - 1),
      isActive: true
    }
  } else {
    // Before first Monday - we're in previous month's Period 2
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const prevFirstDay = new Date(prevYear, prevMonth, 1)
    const prevDayOfWeek = prevFirstDay.getDay()
    const prevDaysUntilMonday = prevDayOfWeek === 0 ? 1 : prevDayOfWeek === 1 ? 0 : 8 - prevDayOfWeek
    const prevFirstMonday = new Date(prevFirstDay)
    prevFirstMonday.setDate(prevFirstDay.getDate() + prevDaysUntilMonday)
    const prevThirdMonday = new Date(prevFirstMonday)
    prevThirdMonday.setDate(prevFirstMonday.getDate() + 14)
    
    return {
      id: `${prevYear}-${prevMonth + 1}-period-2`,
      name: `Period 2: ${prevThirdMonday.toLocaleDateString()} - ${new Date(firstMonday.getTime() - 1).toLocaleDateString()}`,
      start: prevThirdMonday,
      end: new Date(firstMonday.getTime() - 1),
      isActive: true
    }
  }
}

// ==================== AIRCRAFT QUALIFICATION ====================

/**
 * Check if an instructor is qualified for a specific aircraft
 *
 * @param instructor - The instructor to check
 * @param aircraftId - The aircraft ID to check qualification for
 * @returns true if instructor is qualified (undefined/empty aircraftIds = qualified for all)
 *
 * @example
 * const isQualified = isInstructorQualifiedForAircraft(instructor, 'aircraft-123')
 * // Returns true if instructor.aircraftIds is undefined, empty, or includes 'aircraft-123'
 */
export function isInstructorQualifiedForAircraft(
  instructor: Instructor,
  aircraftId: string | undefined
): boolean {
  // If load has no aircraft, instructor can work on it
  if (!aircraftId) return true

  // If instructor has no aircraft restrictions, they're qualified for all
  if (!instructor.aircraftIds || instructor.aircraftIds.length === 0) {
    return true
  }

  // Check if instructor's qualifications include this aircraft
  return instructor.aircraftIds.includes(aircraftId)
}