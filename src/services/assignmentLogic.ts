// src/services/assignmentLogic.ts
import type { Instructor, Assignment, QueueStudent, Period } from '@/types'
import { PAY_RATES } from '@/lib/constants'
import { calculateInstructorBalance } from '@/lib/utils'



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

    // ✅ FIXED: Check department using correct property names
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
      // Check if this student is in their AFF students list
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
      // ✅ FIXED: Use correct property name
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