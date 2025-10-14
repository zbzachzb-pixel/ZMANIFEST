import type { Assignment, Instructor, Period, Team } from '@/types'

// PAY CALCULATIONS
export function calculateAssignmentPay(assignment: Assignment): number {
  if (assignment.isMissedJump) return 0
  
  if (assignment.jumpType === 'tandem') {
    let pay = 40
    pay += (assignment.tandemWeightTax || 0) * 20
    if (assignment.tandemHandcam) pay += 30
    return pay
  }
  
  if (assignment.jumpType === 'aff') {
    return assignment.affLevel === 'lower' ? 55 : 45
  }
  
  if (assignment.jumpType === 'video') {
    return 45
  }
  
  return 0
}

// TEAM SCHEDULE LOGIC
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

// EARNINGS CALCULATION
// This calculates the "balance" used for rotation - NOT actual pay
export function calculateInstructorEarnings(
  instructorId: string,
  assignments: Assignment[],
  instructors: Instructor[],
  period: Period
): number {
  let total = 0
  
  // Find the instructor
  const instructor = instructors.find(i => i.id === instructorId)
  if (!instructor) return 0
  
  for (const assignment of assignments) {
    const assignmentDate = new Date(assignment.timestamp)
    
    if (assignmentDate < period.start || assignmentDate > period.end) {
      continue
    }
    
    if (assignment.isRequest) continue
    
    if (assignment.instructorId === instructorId) {
      let pay = calculateAssignmentPay(assignment)
      
      // Apply 1.2x multiplier to BALANCE if working off day (for rotation purposes)
      if (!assignment.isMissedJump && isWorkingOffDay(instructor, assignmentDate)) {
        pay = Math.round(pay * 1.2)
      }
      
      total += pay
    }
    
    if (assignment.videoInstructorId === instructorId && !assignment.isMissedJump) {
      let videoPay = 45
      
      // Apply 1.2x multiplier to BALANCE if working off day (for rotation purposes)
      if (isWorkingOffDay(instructor, assignmentDate)) {
        videoPay = Math.round(videoPay * 1.2)
      }
      
      total += videoPay
    }
  }
  
  return total
}

// TOTAL EARNINGS CALCULATION
// This calculates ACTUAL pay (what shows on paychecks) - NO multiplier
export function calculateInstructorTotalEarnings(
  instructorId: string,
  assignments: Assignment[]
): number {
  let total = 0
  
  for (const assignment of assignments) {
    // For actual earnings, just use base pay - NO multiplier
    if (assignment.instructorId === instructorId && !assignment.isMissedJump) {
      total += calculateAssignmentPay(assignment)
    }
    
    if (assignment.videoInstructorId === instructorId && !assignment.isMissedJump) {
      total += 45
    }
  }
  
  return total
}

// PERIOD CALCULATIONS
export function getCurrentPeriod(): Period {
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

// SCHEDULE DISPLAY
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

// FORMATTING
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