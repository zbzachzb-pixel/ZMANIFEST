// src/hooks/useInstructorStats.ts
import { useMemo } from 'react'
import { useAssignments } from './useDatabase'
import { getCurrentPeriod, calculateAssignmentPay } from '@/lib/utils'
import { PAY_RATES } from '@/lib/constants'
import type { Instructor } from '@/types'

export function useInstructorStats(instructor: Instructor) {
  const { data: assignments } = useAssignments()
  const period = getCurrentPeriod()
  
  return useMemo(() => {
    const periodAssignments = assignments.filter(a => {
      const assignmentDate = new Date(a.timestamp)
      return assignmentDate >= period.start && assignmentDate <= period.end
    })
    
    // Assignment Balance (for rotation - excludes requests, includes missed)
    let balance = 0
    
    // Total Earnings (actual money - includes requests, excludes missed)
    let totalEarnings = 0
    
    // Today's earnings
    let todayEarnings = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Jump count (excludes missed)
    let jumpCount = 0
    
    for (const assignment of periodAssignments) {
      const assignmentDate = new Date(assignment.timestamp)
      const isToday = assignmentDate >= today
      
      // Main instructor
      if (assignment.instructorId === instructor.id) {
        const pay = calculateAssignmentPay(assignment)
        
        if (!assignment.isMissedJump) {
          jumpCount++
          totalEarnings += pay
          if (isToday) todayEarnings += pay
        }
        
        if (!assignment.isRequest) {
          balance += pay
        }
      }
      
      // Video instructor
      if (assignment.videoInstructorId === instructor.id && !assignment.isMissedJump) {
        jumpCount++
        const videoPay = PAY_RATES.VIDEO_INSTRUCTOR
        totalEarnings += videoPay
        if (isToday) todayEarnings += videoPay
        if (!assignment.isRequest) balance += videoPay
      }
    }
    
    return { balance, totalEarnings, todayEarnings, jumpCount }
  }, [assignments, instructor.id, period])
}