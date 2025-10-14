// src/lib/utils.ts
// ✅ UPDATED: Tasks #3 & #4 - Fixed double multiplier bug and standardized pay rates

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

/**
 * LEGACY FUNCTION NAME - Kept for backwards compatibility
 * Use calculateInstructorBalance() instead for new code
 */
export function calculateInstructorEarnings(
  instructorId: string,
  assignments: Assignment[],
  instructors: Instructor[],
  period: Period
): number {
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

export function isWorkingOffDay(instructor: Instructor, date: Date): boolean {
  if (!instructor.team || instructor.team === 'gold') {
    return false // Gold team never works "off" days
  }
  
  const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  
  // Everyone works weekends (Fri/Sat/Sun)
  if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
    return false
  }
  
  const teamWithMonTueOff = getCurrentWeekRotation()
  
  // Monday or Tuesday
  if (dayOfWeek === 1 || dayOfWeek === 2) {
    return instructor.team === teamWithMonTueOff
  }
  
  // Wednesday or Thursday
  if (dayOfWeek === 3 || dayOfWeek === 4) {
    return instructor.team !== teamWithMonTueOff
  }
  
  return false
}

// ==================== PERIOD CALCULATIONS ====================

export function getCurrentPeriod(): PeriodData {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const firstMonday = new Date(firstDay)
  const dayOfWeek = firstDay.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
  firstMonday.setDate(firstDay.getDate() + daysUntilMonday)
  
  const thirdMonday = new Date(firstMonday)
  thirdMonday.setDate(firstMonday.getDate() + 14)
  
  if (today >= firstMonday && today < thirdMonday) {
    return {
      start: firstMonday,
      end: new Date(thirdMonday.getTime() - 1),
      name: `Period 1: ${formatDate(firstMonday)} - ${formatDate(new Date(thirdMonday.getTime() - 1))}`
    }
  } else if (today >= thirdMonday) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const nextFirstDay = new Date(nextYear, nextMonth, 1)
    
    const nextFirstMonday = new Date(nextFirstDay)
    const nextDayOfWeek = nextFirstDay.getDay()
    const nextDaysUntilMonday = nextDayOfWeek === 0 ? 1 : nextDayOfWeek === 1 ? 0 : 8 - nextDayOfWeek
    nextFirstMonday.setDate(nextFirstDay.getDate() + nextDaysUntilMonday)
    
    return {
      start: thirdMonday,
      end: new Date(nextFirstMonday.getTime() - 1),
      name: `Period 2: ${formatDate(thirdMonday)} - ${formatDate(new Date(nextFirstMonday.getTime() - 1))}`
    }
  } else {
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const prevFirstDay = new Date(prevYear, prevMonth, 1)
    
    const prevFirstMonday = new Date(prevFirstDay)
    const prevDayOfWeek = prevFirstDay.getDay()
    const prevDaysUntilMonday = prevDayOfWeek === 0 ? 1 : prevDayOfWeek === 1 ? 0 : 8 - prevDayOfWeek
    prevFirstMonday.setDate(prevFirstDay.getDate() + prevDaysUntilMonday)
    
    const prevThirdMonday = new Date(prevFirstMonday)
    prevThirdMonday.setDate(prevFirstMonday.getDate() + 14)
    
    return {
      start: prevThirdMonday,
      end: new Date(firstMonday.getTime() - 1),
      name: `Period 2: ${formatDate(prevThirdMonday)} - ${formatDate(new Date(firstMonday.getTime() - 1))}`
    }
  }
}

// ==================== SCHEDULE DISPLAY ====================

export function getScheduleDisplay(): { redTeam: string; blueTeam: string } {
  const teamWithMonTueOff = getCurrentWeekRotation()
  
  if (teamWithMonTueOff === 'blue') {
    return {
      redTeam: 'OFF WED/THUR',
      blueTeam: 'OFF MON/TUE'
    }
  } else {
    return {
      redTeam: 'OFF MON/TUE',
      blueTeam: 'OFF WED/THUR'
    }
  }
}

// ==================== FORMATTING ====================

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit'
  })
}

/**
 * Convert Period (with string dates) to PeriodData (with Date objects)
 * Use this when you need to work with dates in calculations
 */
export function periodToData(period: Period): PeriodData {
  return {
    start: new Date(period.start),
    end: new Date(period.end),
    name: period.name
  }
}

/**
 * Check if a date is within a period
 */
export function isDateInPeriod(date: Date, period: Period): boolean {
  const periodStart = new Date(period.start)
  const periodEnd = new Date(period.end)
  return date >= periodStart && date <= periodEnd
}

/**
 * Compare two periods for sorting (newest first)
 */
export function comparePeriods(a: Period, b: Period): number {
  return new Date(b.start).getTime() - new Date(a.start).getTime()
}