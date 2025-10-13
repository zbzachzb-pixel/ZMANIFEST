import type { Assignment, Instructor, Period } from '@/types'

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

export function calculateInstructorEarnings(
  instructorId: string,
  assignments: Assignment[],
  period: Period
): number {
  let total = 0
  
  for (const assignment of assignments) {
    const assignmentDate = new Date(assignment.timestamp)
    
    if (assignmentDate < period.start || assignmentDate > period.end) {
      continue
    }
    
    if (assignment.isRequest) continue
    
    if (assignment.instructorId === instructorId) {
      const pay = calculateAssignmentPay(assignment)
      total += pay
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