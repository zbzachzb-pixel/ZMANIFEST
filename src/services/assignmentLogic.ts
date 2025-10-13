import type { Instructor, QueueStudent, Assignment, Period } from '@/types'

// Payment rates
export const RATES = {
  TANDEM_BASE: 50,
  TANDEM_HANDCAM: 10,
  TANDEM_VIDEO: 25,
  AFF_LOWER: 45,
  AFF_UPPER: 55,
  OFF_DAY_MULTIPLIER: 1.2
}

// Calculate pay for an assignment
export interface PayCalculation {
  mainPay: number
  videoPay: number
  total: number
}

export function calculatePay(
  student: QueueStudent,
  instructor: Instructor,
  videoInstructor?: Instructor,
  isOffDay: boolean = false
): PayCalculation {
  let mainPay = 0
  let videoPay = 0

  if (student.jumpType === 'tandem') {
    mainPay = RATES.TANDEM_BASE
    if (student.tandemHandcam) mainPay += RATES.TANDEM_HANDCAM
    if (student.outsideVideo && videoInstructor) {
      videoPay = RATES.TANDEM_VIDEO
    }
  } else if (student.jumpType === 'aff') {
    mainPay = student.affLevel === 'upper' ? RATES.AFF_UPPER : RATES.AFF_LOWER
  }

  // Apply off-day multiplier
  if (isOffDay && !student.isRequest) {
    mainPay = Math.round(mainPay * RATES.OFF_DAY_MULTIPLIER)
    videoPay = Math.round(videoPay * RATES.OFF_DAY_MULTIPLIER)
  }

  // Requests don't count toward balance
  if (student.isRequest) {
    mainPay = 0
    videoPay = 0
  }

  return {
    mainPay,
    videoPay,
    total: mainPay + videoPay
  }
}

// Calculate instructor's current balance earnings
export function calculateInstructorBalance(
  instructorId: string,
  assignments: Assignment[],
  period: Period
): number {
  let total = 0

  for (const assignment of assignments) {
    const assignmentDate = new Date(assignment.timestamp)
    if (assignmentDate < period.start || assignmentDate > period.end) continue
    if (assignment.isMissedJump) continue

    if (assignment.instructorId === instructorId) {
      if (assignment.jumpType === 'tandem') {
        total += RATES.TANDEM_BASE
        if (assignment.tandemHandcam) total += RATES.TANDEM_HANDCAM
      } else if (assignment.jumpType === 'aff') {
        total += assignment.affLevel === 'upper' ? RATES.AFF_UPPER : RATES.AFF_LOWER
      }
    }

    if (assignment.videoInstructorId === instructorId && !assignment.hasOutsideVideo) {
      total += RATES.TANDEM_VIDEO
    }
  }

  return total
}

// Check if instructor is working on their off day
export function isWorkingOffDay(instructor: Instructor, date: Date): boolean {
  if (!instructor.team) return false

  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate which week of the year
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneWeek = 1000 * 60 * 60 * 24 * 7
  const weekNumber = Math.floor(diff / oneWeek)

  // Even weeks: Blue has Mon/Tue off, Red has Wed/Thu off
  // Odd weeks: Red has Mon/Tue off, Blue has Wed/Thu off
  const isEvenWeek = weekNumber % 2 === 0

  if (instructor.team === 'blue') {
    if (isEvenWeek) {
      return dayOfWeek === 1 || dayOfWeek === 2 // Mon or Tue
    } else {
      return dayOfWeek === 3 || dayOfWeek === 4 // Wed or Thu
    }
  } else if (instructor.team === 'red') {
    if (isEvenWeek) {
      return dayOfWeek === 3 || dayOfWeek === 4 // Wed or Thu
    } else {
      return dayOfWeek === 1 || dayOfWeek === 2 // Mon or Tue
    }
  }

  return false
}

// Instructor suggestion result
export interface InstructorSuggestion {
  main: Instructor | null
  video: Instructor | null
  needsVideo: boolean
  isMainClockedOut: boolean
}

// Find best instructor for a student
export function suggestInstructorsForStudent(
  student: QueueStudent,
  instructors: Instructor[],
  assignments: Assignment[],
  period: Period,
  ignoreClockStatus: boolean = false
): InstructorSuggestion {
  const needsVideo = student.jumpType === 'tandem' && (student.outsideVideo === true)

  // Find qualified main instructors
  const qualified: Instructor[] = []

  for (const inst of instructors) {
    if (inst.archived) continue
    if (!ignoreClockStatus && !inst.clockedIn) continue

    // Check department
    if (student.jumpType === 'tandem' && !inst.tandem) continue
    if (student.jumpType === 'aff' && !inst.aff) continue

    // Check weight limits
    const totalWeight = student.weight + (student.tandemWeightTax || 0)
    if (student.jumpType === 'tandem' && inst.tandemWeightLimit) {
      if (totalWeight > inst.tandemWeightLimit) continue
    }
    if (student.jumpType === 'aff' && inst.affWeightLimit) {
      if (student.weight > inst.affWeightLimit) continue
    }

    // Check AFF locking
    if (student.jumpType === 'aff' && inst.affLocked) {
      const hasThisStudent = inst.affStudents?.some(s => s.studentId === student.id)
      if (!hasThisStudent) continue
    }

    qualified.push(inst)
  }

  if (qualified.length === 0) {
    return { main: null, video: null, needsVideo, isMainClockedOut: false }
  }

  // Sort by balance (lowest first) considering off-day multiplier
  qualified.sort((a, b) => {
    const balanceA = calculateInstructorBalance(a.id, assignments, period)
    const balanceB = calculateInstructorBalance(b.id, assignments, period)

    // If balances are equal, prioritize people NOT on their off day
    if (balanceA === balanceB) {
      const aIsOffDay = isWorkingOffDay(a, new Date())
      const bIsOffDay = isWorkingOffDay(b, new Date())
      
      if (aIsOffDay && !bIsOffDay) return 1
      if (!aIsOffDay && bIsOffDay) return -1
    }

    return balanceA - balanceB
  })

  const mainInstructor = qualified[0]
  let videoInstructor: Instructor | null = null

  // Find video instructor if needed
  if (needsVideo) {
    const combinedWeight = mainInstructor.bodyWeight + student.weight
    const qualifiedVideo: Instructor[] = []

    for (const inst of instructors) {
      if (inst.archived) continue
      if (!ignoreClockStatus && !inst.clockedIn) continue
      if (!inst.video) continue
      if (inst.id === mainInstructor.id) continue

      // Check video weight restrictions
      if (inst.videoRestricted) {
        if (inst.videoMinWeight && combinedWeight < inst.videoMinWeight) continue
        if (inst.videoMaxWeight && combinedWeight > inst.videoMaxWeight) continue
      }

      qualifiedVideo.push(inst)
    }

    if (qualifiedVideo.length > 0) {
      qualifiedVideo.sort((a, b) => {
        return calculateInstructorBalance(a.id, assignments, period) - 
               calculateInstructorBalance(b.id, assignments, period)
      })
      videoInstructor = qualifiedVideo[0]
    }
  }

  return {
    main: mainInstructor,
    video: videoInstructor,
    needsVideo,
    isMainClockedOut: !mainInstructor.clockedIn
  }
}

// Group assignment plan
export interface GroupAssignmentPlan {
  student: QueueStudent
  mainInstructor: Instructor
  videoInstructor: Instructor | null
  mainPay: number
  videoPay: number
}

// Assign multiple students optimally (for groups)
export function planGroupAssignment(
  students: QueueStudent[],
  instructors: Instructor[],
  assignments: Assignment[],
  period: Period
): GroupAssignmentPlan[] {
  const plan: GroupAssignmentPlan[] = []
  const usedMainIds = new Set<string>()
  const usedVideoIds = new Set<string>()
  
  // Create projected balances
  const projectedBalances: Record<string, number> = {}
  for (const inst of instructors) {
    projectedBalances[inst.id] = calculateInstructorBalance(inst.id, assignments, period)
  }

  for (const student of students) {
    // Find qualified main instructors (not yet used)
    const qualified = instructors.filter(inst => {
      if (inst.archived || !inst.clockedIn) return false
      if (usedMainIds.has(inst.id)) return false
      if (student.jumpType === 'tandem' && !inst.tandem) return false
      if (student.jumpType === 'aff' && !inst.aff) return false

      const totalWeight = student.weight + (student.tandemWeightTax || 0)
      if (student.jumpType === 'tandem' && inst.tandemWeightLimit) {
        if (totalWeight > inst.tandemWeightLimit) return false
      }
      if (student.jumpType === 'aff' && inst.affWeightLimit) {
        if (student.weight > inst.affWeightLimit) return false
      }

      if (student.jumpType === 'aff' && inst.affLocked) {
        const hasThisStudent = inst.affStudents?.some(s => s.studentId === student.id)
        if (!hasThisStudent) return false
      }

      return true
    })

    if (qualified.length === 0) continue

    // Sort by projected balance
    qualified.sort((a, b) => projectedBalances[a.id] - projectedBalances[b.id])
    const mainInst = qualified[0]
    usedMainIds.add(mainInst.id)

    const isOffDay = isWorkingOffDay(mainInst, new Date())
    const pay = calculatePay(student, mainInst, undefined, isOffDay)

    // Update projected balance
    if (!student.isRequest) {
      projectedBalances[mainInst.id] += pay.mainPay
    }

    let videoInst: Instructor | null = null

    // Find video if needed
    if (student.jumpType === 'tandem' && student.outsideVideo) {
      const combinedWeight = mainInst.bodyWeight + student.weight
      const qualifiedVideo = instructors.filter(inst => {
        if (inst.archived || !inst.clockedIn) return false
        if (!inst.video) return false
        if (inst.id === mainInst.id) return false
        if (usedVideoIds.has(inst.id)) return false

        if (inst.videoRestricted) {
          if (inst.videoMinWeight && combinedWeight < inst.videoMinWeight) return false
          if (inst.videoMaxWeight && combinedWeight > inst.videoMaxWeight) return false
        }

        return true
      })

      if (qualifiedVideo.length > 0) {
        qualifiedVideo.sort((a, b) => projectedBalances[a.id] - projectedBalances[b.id])
        videoInst = qualifiedVideo[0]
        usedVideoIds.add(videoInst.id)

        if (!student.isRequest) {
          projectedBalances[videoInst.id] += pay.videoPay
        }
      }
    }

    plan.push({
      student,
      mainInstructor: mainInst,
      videoInstructor: videoInst,
      mainPay: pay.mainPay,
      videoPay: pay.videoPay
    })
  }

  return plan
}