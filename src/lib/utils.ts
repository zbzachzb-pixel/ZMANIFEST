// src/lib/utils.ts - FIXED VERSION
// ✅ Issue #7 Fixed: Added missing isWorkingOffDay function
// ✅ Issue #8 Fixed: Completed getCurrentWeekRotation implementation
// ✅ Issue #26 Fixed: Added deprecation warnings and clear documentation

import type { Assignment, Instructor, Period, Team } from '@/types'
import { PAY_RATES } from './constants'

// ==================== PAY CALCULATIONS ====================

/**
 * Calculate pay for a single assignment
 * This is the BASE pay without any multipliers
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

// ✅ FIXED #7: Added missing isWorkingOffDay function
/**
 * Check if instructor is working on their scheduled off day
 */
export function isWorkingOffDay(instructor: Instructor, date: Date): boolean {
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Get current week's rotation
  const teamOffDay = getCurrentWeekRotation()
  
  // Check if this instructor's team has this day off
  if (instructor.team === teamOffDay && (dayOfWeek === 1 || dayOfWeek === 2)) {
    return true
  }
  
  return false
}

/**
 * Calculate instructor's BALANCE for rotation fairness
 * - Excludes request jumps (they don't count toward rotation)
 * - Excludes missed jumps (no pay but counts as assignment)
 * - Applies off-day multiplier (1.2x) for balance fairness
 * 
 * This is the function that should be used for instructor rotation and balancing
 */
export function calculateInstructorBalance(
  instructorId: string,
  assignments: Assignment[],
  instructors: Instructor[],
  period: Period
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
    
    // Requests don't count toward balance (rotation fairness)
    if (assignment.isRequest) continue
    
    // Main instructor assignment
    if (assignment.instructorId === instructorId && !assignment.isMissedJump) {
      let pay = calculateAssignmentPay(assignment)
      
      // Apply off-day multiplier for balance fairness
      if (isWorkingOffDay(instructor, assignmentDate)) {
        pay = Math.round(pay * PAY_RATES.OFF_DAY_MULTIPLIER)
      }
      
      total += pay
    }
    
    // Video instructor assignment (only if not outside video)
    if (assignment.videoInstructorId === instructorId && 
        !assignment.isMissedJump && 
        !assignment.hasOutsideVideo) {
      let videoPay = PAY_RATES.VIDEO_INSTRUCTOR
      
      // Apply off-day multiplier for balance fairness
      if (isWorkingOffDay(instructor, assignmentDate)) {
        videoPay = Math.round(videoPay * PAY_RATES.OFF_DAY_MULTIPLIER)
      }
      
      total += videoPay
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
  period: Period
): number {
  // Log warning when used
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      'calculateInstructorEarnings is deprecated. Use calculateInstructorBalance for rotation or calculateInstructorTotalEarnings for paychecks'
    )
  }
  return calculateInstructorBalance(instructorId, assignments, instructors, period)
}

/**
 * Calculate instructor's TOTAL EARNINGS (actual paychecks)
 * - Includes request jumps (they get paid for these)
 * - Excludes missed jumps (no pay)
 * - NO off-day multiplier (actual pay doesn't get bonus, only balance does)
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
    
    // Main instructor - includes requests, excludes missed
    if (assignment.instructorId === instructorId && !assignment.isMissedJump) {
      total += calculateAssignmentPay(assignment)
    }
    
    // Video instructor - includes requests, excludes missed
    if (assignment.videoInstructorId === instructorId && 
        !assignment.isMissedJump && 
        !assignment.hasOutsideVideo) {
      total += PAY_RATES.VIDEO_INSTRUCTOR
    }
  }
  
  return total
}

// ==================== TEAM SCHEDULE LOGIC ====================

// ✅ FIXED #8: Completed getCurrentWeekRotation implementation
export function getCurrentWeekRotation(): Team {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const oneWeek = 1000 * 60 * 60 * 24 * 7
  const weekNumber = Math.floor(diff / oneWeek)
  
  // Even weeks: Blue has Mon/Tue off
  // Odd weeks: Red has Mon/Tue off
  return weekNumber % 2 === 0 ? 'blue' : 'red'
}

export function getWeekSchedule(): { redTeam: string, blueTeam: string } {
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