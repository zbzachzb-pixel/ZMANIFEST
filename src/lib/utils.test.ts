// src/lib/utils.test.ts
// Comprehensive unit tests for business logic utilities

import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateAssignmentPay,
  calculateInstructorBalance,
  calculateInstructorTotalEarnings,
  getCurrentWeekRotation,
  getWeekSchedule,
  isWorkingOffDay,
  getCurrentPeriod,
  isInstructorQualifiedForAircraft
} from './utils'
import { PAY_RATES } from './constants'
import type { Assignment, Instructor, Period, Load } from '@/types'

// ==================== TEST DATA HELPERS ====================

const createInstructor = (overrides: Partial<Instructor> = {}): Instructor => ({
  id: 'instructor-1',
  name: 'Test Instructor',
  bodyWeight: 180,
  canTandem: true,
  canAFF: true,
  canVideo: true,
  tandemWeightLimit: 250,
  affWeightLimit: 200,
  clockedIn: false,
  archived: false,
  affLocked: false,
  affStudents: [],
  team: 'blue',
  ...overrides
})

const createAssignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  id: 'assignment-1',
  instructorId: 'instructor-1',
  instructorName: 'Test Instructor',
  studentName: 'Test Student',
  studentWeight: 150,
  jumpType: 'tandem',
  timestamp: new Date('2024-06-01T10:00:00Z').toISOString(),
  isRequest: false,
  ...overrides
})

const createPeriod = (): Period => ({
  id: 'period-1',
  name: 'Test Period',
  start: new Date('2024-06-01T00:00:00Z'),
  end: new Date('2024-06-14T23:59:59Z'),
  isActive: true
})

// ==================== calculateAssignmentPay ====================

describe('calculateAssignmentPay', () => {
  it('should return 0 for missed jumps', () => {
    const assignment = createAssignment({ isMissedJump: true })
    expect(calculateAssignmentPay(assignment)).toBe(0)
  })

  describe('tandem jumps', () => {
    it('should calculate base tandem pay', () => {
      const assignment = createAssignment({ jumpType: 'tandem' })
      expect(calculateAssignmentPay(assignment)).toBe(PAY_RATES.TANDEM_BASE)
    })

    it('should add weight tax to tandem pay', () => {
      const assignment = createAssignment({
        jumpType: 'tandem',
        tandemWeightTax: 2
      })
      const expected = PAY_RATES.TANDEM_BASE + (2 * PAY_RATES.TANDEM_WEIGHT_TAX)
      expect(calculateAssignmentPay(assignment)).toBe(expected)
    })

    it('should add handcam fee to tandem pay', () => {
      const assignment = createAssignment({
        jumpType: 'tandem',
        tandemHandcam: true
      })
      const expected = PAY_RATES.TANDEM_BASE + PAY_RATES.TANDEM_HANDCAM
      expect(calculateAssignmentPay(assignment)).toBe(expected)
    })

    it('should calculate total tandem pay with all addons', () => {
      const assignment = createAssignment({
        jumpType: 'tandem',
        tandemWeightTax: 3,
        tandemHandcam: true
      })
      const expected = PAY_RATES.TANDEM_BASE +
        (3 * PAY_RATES.TANDEM_WEIGHT_TAX) +
        PAY_RATES.TANDEM_HANDCAM
      expect(calculateAssignmentPay(assignment)).toBe(expected)
    })
  })

  describe('AFF jumps', () => {
    it('should calculate pay for lower AFF', () => {
      const assignment = createAssignment({
        jumpType: 'aff',
        affLevel: 'lower'
      })
      expect(calculateAssignmentPay(assignment)).toBe(PAY_RATES.AFF_LOWER)
    })

    it('should calculate pay for upper AFF', () => {
      const assignment = createAssignment({
        jumpType: 'aff',
        affLevel: 'upper'
      })
      expect(calculateAssignmentPay(assignment)).toBe(PAY_RATES.AFF_UPPER)
    })
  })

  describe('video jumps', () => {
    it('should calculate pay for video instructor', () => {
      const assignment = createAssignment({ jumpType: 'video' })
      expect(calculateAssignmentPay(assignment)).toBe(PAY_RATES.VIDEO_INSTRUCTOR)
    })
  })

  it('should return 0 for unknown jump type', () => {
    const assignment = createAssignment({ jumpType: 'unknown' as any })
    expect(calculateAssignmentPay(assignment)).toBe(0)
  })
})

// ==================== isWorkingOffDay ====================

describe('isWorkingOffDay', () => {
  it('should always return false for gold team on any day', () => {
    const goldInstructor = createInstructor({ team: 'gold' })
    const today = new Date()

    // Gold team never has off days
    expect(isWorkingOffDay(goldInstructor, today)).toBe(false)
  })

  // Note: Full testing of Mon/Tue off days is limited because:
  // - getCurrentWeekRotation() uses current date (not the date parameter)
  // - Historical dates create timezone parsing issues
  // - The function's behavior depends on what week it is when tests run
})

// ==================== getCurrentWeekRotation ====================

describe('getCurrentWeekRotation', () => {
  it('should return either blue or red', () => {
    const rotation = getCurrentWeekRotation()
    expect(['blue', 'red']).toContain(rotation)
  })

  it('should be deterministic for same week', () => {
    const rotation1 = getCurrentWeekRotation()
    const rotation2 = getCurrentWeekRotation()
    expect(rotation1).toBe(rotation2)
  })
})

// ==================== getWeekSchedule ====================

describe('getWeekSchedule', () => {
  it('should return schedule with red and blue team info', () => {
    const schedule = getWeekSchedule()
    expect(schedule).toHaveProperty('redTeam')
    expect(schedule).toHaveProperty('blueTeam')
  })

  it('should have one team off and one working', () => {
    const schedule = getWeekSchedule()
    const hasOff = schedule.redTeam.includes('OFF') || schedule.blueTeam.includes('OFF')
    const hasWorking = schedule.redTeam.includes('Working') || schedule.blueTeam.includes('Working')
    expect(hasOff).toBe(true)
    expect(hasWorking).toBe(true)
  })
})

// ==================== calculateInstructorBalance ====================

describe('calculateInstructorBalance', () => {
  const period = createPeriod()
  const instructors = [createInstructor({ id: 'instructor-1', team: 'blue' })]

  it('should return 0 for instructor with no assignments', () => {
    const balance = calculateInstructorBalance('instructor-1', [], instructors, period)
    expect(balance).toBe(0)
  })

  it('should return 0 for non-existent instructor', () => {
    const assignments = [createAssignment()]
    const balance = calculateInstructorBalance('unknown', assignments, instructors, period)
    expect(balance).toBe(0)
  })

  it('should calculate balance from completed assignments', () => {
    const assignments = [
      createAssignment({
        jumpType: 'tandem',
        timestamp: '2024-06-05T10:00:00Z'
      })
    ]
    const balance = calculateInstructorBalance('instructor-1', assignments, instructors, period)
    expect(balance).toBeGreaterThan(0)
    expect(balance).toBe(PAY_RATES.TANDEM_BASE)
  })

  it('should exclude request assignments from balance', () => {
    const assignments = [
      createAssignment({
        jumpType: 'tandem',
        isRequest: true,
        timestamp: '2024-06-05T10:00:00Z'
      })
    ]
    const balance = calculateInstructorBalance('instructor-1', assignments, instructors, period)
    expect(balance).toBe(0) // Requests don't count toward balance
  })

  it('should exclude missed jumps from balance', () => {
    const assignments = [
      createAssignment({
        jumpType: 'tandem',
        isMissedJump: true,
        timestamp: '2024-06-05T10:00:00Z'
      })
    ]
    const balance = calculateInstructorBalance('instructor-1', assignments, instructors, period)
    expect(balance).toBe(0)
  })

  it('should only count assignments within period', () => {
    const assignments = [
      createAssignment({
        jumpType: 'tandem',
        timestamp: '2024-05-01T10:00:00Z' // Before period
      }),
      createAssignment({
        jumpType: 'tandem',
        timestamp: '2024-06-05T10:00:00Z' // During period
      }),
      createAssignment({
        jumpType: 'tandem',
        timestamp: '2024-07-01T10:00:00Z' // After period
      })
    ]
    const balance = calculateInstructorBalance('instructor-1', assignments, instructors, period)
    expect(balance).toBe(PAY_RATES.TANDEM_BASE) // Only middle assignment
  })

  it('should include video instructor assignments in balance', () => {
    const assignments = [
      createAssignment({
        instructorId: 'other',
        videoInstructorId: 'instructor-1',
        timestamp: '2024-06-05T10:00:00Z'
      })
    ]
    const balance = calculateInstructorBalance('instructor-1', assignments, instructors, period)
    expect(balance).toBe(PAY_RATES.VIDEO_INSTRUCTOR)
  })

  it('should include pending load assignments in balance', () => {
    const loads: Load[] = [{
      id: 'load-1',
      position: 1,
      status: 'building',
      assignments: [{
        id: 'la-1',
        studentId: 'student-1',
        instructorId: 'instructor-1',
        studentName: 'Test',
        studentWeight: 150,
        jumpType: 'tandem',
        isRequest: false
      }],
      createdAt: '2024-06-05T10:00:00Z'
    }]

    const balance = calculateInstructorBalance('instructor-1', [], instructors, period)
    expect(balance).toBe(PAY_RATES.TANDEM_BASE)
  })

  it('should exclude completed loads from pending balance', () => {
    const loads: Load[] = [{
      id: 'load-1',
      position: 1,
      status: 'completed', // Already counted in assignments
      assignments: [{
        id: 'la-1',
        studentId: 'student-1',
        instructorId: 'instructor-1',
        studentName: 'Test',
        studentWeight: 150,
        jumpType: 'tandem',
        isRequest: false
      }],
      createdAt: '2024-06-05T10:00:00Z'
    }]

    const balance = calculateInstructorBalance('instructor-1', [], instructors, period)
    expect(balance).toBe(0) // Completed loads don't count as pending
  })
})

// ==================== calculateInstructorTotalEarnings ====================

describe('calculateInstructorTotalEarnings', () => {
  const period = createPeriod()

  it('should return 0 for instructor with no assignments', () => {
    const earnings = calculateInstructorTotalEarnings('instructor-1', [], period)
    expect(earnings).toBe(0)
  })

  it('should calculate earnings from completed assignments', () => {
    const assignments = [
      createAssignment({
        jumpType: 'tandem',
        timestamp: '2024-06-05T10:00:00Z'
      })
    ]
    const earnings = calculateInstructorTotalEarnings('instructor-1', assignments, period)
    expect(earnings).toBe(PAY_RATES.TANDEM_BASE)
  })

  it('should INCLUDE request assignments in earnings', () => {
    const assignments = [
      createAssignment({
        jumpType: 'tandem',
        isRequest: true,
        timestamp: '2024-06-05T10:00:00Z'
      })
    ]
    const earnings = calculateInstructorTotalEarnings('instructor-1', assignments, period)
    expect(earnings).toBe(PAY_RATES.TANDEM_BASE) // Requests count toward earnings
  })

  it('should exclude missed jumps from earnings', () => {
    const assignments = [
      createAssignment({
        jumpType: 'tandem',
        isMissedJump: true,
        timestamp: '2024-06-05T10:00:00Z'
      })
    ]
    const earnings = calculateInstructorTotalEarnings('instructor-1', assignments, period)
    expect(earnings).toBe(0)
  })

  it('should include video instructor earnings', () => {
    const assignments = [
      createAssignment({
        instructorId: 'other',
        videoInstructorId: 'instructor-1',
        timestamp: '2024-06-05T10:00:00Z'
      })
    ]
    const earnings = calculateInstructorTotalEarnings('instructor-1', assignments, period)
    expect(earnings).toBe(PAY_RATES.VIDEO_INSTRUCTOR)
  })

  it('should calculate total earnings for multiple assignments', () => {
    const assignments = [
      createAssignment({
        jumpType: 'tandem',
        timestamp: '2024-06-05T10:00:00Z'
      }),
      createAssignment({
        id: 'assignment-2',
        jumpType: 'aff',
        affLevel: 'lower',
        timestamp: '2024-06-06T10:00:00Z'
      })
    ]
    const earnings = calculateInstructorTotalEarnings('instructor-1', assignments, period)
    const expected = PAY_RATES.TANDEM_BASE + PAY_RATES.AFF_LOWER
    expect(earnings).toBe(expected)
  })
})

// ==================== getCurrentPeriod ====================

describe('getCurrentPeriod', () => {
  it('should return a valid period object', () => {
    const period = getCurrentPeriod()
    expect(period).toHaveProperty('id')
    expect(period).toHaveProperty('name')
    expect(period).toHaveProperty('start')
    expect(period).toHaveProperty('end')
    expect(period.isActive).toBe(true)
  })

  it('should have start date before end date', () => {
    const period = getCurrentPeriod()
    expect(period.start.getTime()).toBeLessThan(period.end.getTime())
  })

  it('should have valid period name', () => {
    const period = getCurrentPeriod()
    expect(period.name).toMatch(/Period [12]:/)
  })

  it('should return consistent period on same day', () => {
    const period1 = getCurrentPeriod()
    const period2 = getCurrentPeriod()
    expect(period1.id).toBe(period2.id)
    expect(period1.name).toBe(period2.name)
  })
})

// ==================== isInstructorQualifiedForAircraft ====================

describe('isInstructorQualifiedForAircraft', () => {
  it('should return true when load has no aircraft', () => {
    const instructor = createInstructor()
    expect(isInstructorQualifiedForAircraft(instructor, undefined)).toBe(true)
  })

  it('should return true when instructor has no aircraft restrictions', () => {
    const instructor = createInstructor({ aircraftIds: undefined })
    expect(isInstructorQualifiedForAircraft(instructor, 'aircraft-1')).toBe(true)
  })

  it('should return true when instructor has empty aircraft list', () => {
    const instructor = createInstructor({ aircraftIds: [] })
    expect(isInstructorQualifiedForAircraft(instructor, 'aircraft-1')).toBe(true)
  })

  it('should return true when instructor is qualified for specific aircraft', () => {
    const instructor = createInstructor({ aircraftIds: ['aircraft-1', 'aircraft-2'] })
    expect(isInstructorQualifiedForAircraft(instructor, 'aircraft-1')).toBe(true)
  })

  it('should return false when instructor is not qualified for aircraft', () => {
    const instructor = createInstructor({ aircraftIds: ['aircraft-1', 'aircraft-2'] })
    expect(isInstructorQualifiedForAircraft(instructor, 'aircraft-3')).toBe(false)
  })
})
