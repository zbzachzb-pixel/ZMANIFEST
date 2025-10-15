// src/types/index.ts - COMPLETE FULL VERSION
// ✅ Issue #1 Fixed: Removed duplicate LoadSchedulingSettings (was defined twice)
// ✅ Issue #2 Fixed: Documented null instructorId handling
// ✅ Issue #13 Fixed: Added proper coveringFor typing

// ==================== BASIC TYPES ====================

export type Team = 'red' | 'blue' | 'gold'
export type JumpType = 'tandem' | 'aff' | 'video'
export type LoadStatus = 'building' | 'ready' | 'departed' | 'completed'
export type AFFLevel = 'lower' | 'upper'

// ==================== INSTRUCTOR ====================

export interface AFFStudent {
  name: string
  startTime: string
  studentId: string
}

export interface Instructor {
  id: string
  name: string
  bodyWeight: number
  canTandem: boolean
  canAFF: boolean
  canVideo: boolean
  tandemWeightLimit: number
  affWeightLimit: number
  videoMinWeight?: number | null
  videoMaxWeight?: number | null
  clockedIn: boolean
  clockInTime?: string | null
  archived: boolean
  affLocked: boolean
  affStudents: Array<{ id: string; name: string }>
  team: Team
  // ✅ FIXED #13: Properly documented covering relationship
  coveringFor?: string | null  // ID of instructor being covered for
}

export type CreateInstructor = Omit<Instructor, 'id' | 'clockedIn' | 'clockInTime' | 'archived' | 'affLocked' | 'affStudents'>
export type UpdateInstructor = Partial<Omit<Instructor, 'id'>>

// ==================== ASSIGNMENT ====================

export interface Assignment {
  id: string
  instructorId: string
  instructorName: string
  studentName: string
  studentWeight: number
  jumpType: 'tandem' | 'aff' | 'video'
  timestamp: string
  isRequest: boolean
  isMissedJump?: boolean
  coveringFor?: string | null  // ID of instructor being covered for
  tandemWeightTax?: number
  tandemHandcam?: boolean
  hasOutsideVideo?: boolean
  videoInstructorId?: string
  videoInstructorName?: string
  affLevel?: 'upper' | 'lower'
}

export type CreateAssignment = Omit<Assignment, 'id' | 'timestamp'>

// ==================== PERIOD ====================

export interface Period {
  id: string
  name: string
  start: Date
  end: Date
  isActive: boolean
  archivedAt?: Date
  finalBalances?: Record<string, number>
}

export type CreatePeriod = Omit<Period, 'id' | 'isActive' | 'archivedAt' | 'finalBalances'>
export type UpdatePeriod = Partial<Omit<Period, 'id'>>

// ==================== QUEUE ====================

export interface QueueStudent {
  id: string
  name: string
  weight: number
  jumpType: 'tandem' | 'aff'
  timestamp: string
  isRequest: boolean
  groupId?: string
  tandemWeightTax?: number
  tandemHandcam?: boolean
  outsideVideo?: boolean
  affLevel?: 'upper' | 'lower'
}

export type CreateQueueStudent = Omit<QueueStudent, 'id' | 'timestamp'>

// ==================== GROUPS ====================

export interface Group {
  id: string
  name: string
  studentIds: string[]
  createdAt: string
}

// ==================== CLOCK EVENTS ====================

export interface ClockEvent {
  id: string
  instructorId: string
  instructorName: string
  type: 'in' | 'out'
  timestamp: string
  notes?: string
}

// ==================== LOADS ====================

export interface LoadAssignment {
  id: string
  studentId: string
  // ✅ FIXED #2: Documented that null instructorId means unassigned
  // Always check: if (!assignment.instructorId) { /* handle unassigned */ }
  instructorId: string | null  
  instructorName?: string
  studentName: string
  studentWeight: number
  jumpType: 'tandem' | 'aff'
  isRequest: boolean
  groupId?: string
  tandemWeightTax?: number
  tandemHandcam?: boolean
  hasOutsideVideo?: boolean
  videoInstructorId?: string | null
  videoInstructorName?: string
  affLevel?: 'upper' | 'lower'
}

export interface Load {
  id: string
  position: number
  status: 'building' | 'ready' | 'departed' | 'completed'
  assignments?: LoadAssignment[]
  createdAt: string
  departedAt?: string
  completedAt?: string
}

export type CreateLoad = Omit<Load, 'id' | 'createdAt'>
export type UpdateLoad = Partial<Omit<Load, 'id' | 'createdAt'>>

// ✅ FIXED #1: Single LoadSchedulingSettings definition (removed duplicate)
export interface LoadSchedulingSettings {
  cycleTime: number
  minutesBetweenLoads: number
}

// ==================== ANALYTICS ====================

export interface InstructorStats {
  totalJumps: number
  tandemCount: number
  affCount: number
  videoCount: number
  balanceEarnings: number
  totalEarnings: number
  missedJumps: number
  avgPerJump: number
  coveringCount?: number
  coveringBonus?: number
}

export interface SystemStats {
  totalJumps: number
  balanceEarnings: number
  totalEarnings: number
  todayJumps: number
  todayEarnings: number
  tandemCount: number
  affCount: number
  videoCount: number
  missedJumps: number
  avgPerJump: number
}

// ==================== SETTINGS ====================

export interface AutoAssignSettings {
  enabled: boolean
  delay: number
  skipRequests: boolean
  batchMode: boolean
  batchSize: number
}

// ==================== DATABASE STATE ====================

export interface DatabaseState {
  instructors: Instructor[]
  assignments: Assignment[]
  loads: Load[]
  studentQueue: QueueStudent[]
  groups: Group[]
  clockEvents: ClockEvent[]
  periods: Period[]
}