// src/types/index.ts - COMPLETE VERSION WITH BUG FIX
// ✅ FIXED: Added originalQueueTimestamp to LoadAssignment

// Import Fun Jumper types
import type { FunJumper } from './funJumpers'

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
  coveringFor?: string | null
  aircraftIds?: string[]          // ✅ ADDED: Aircraft qualifications (empty/undefined = all aircraft)
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
  coveringFor?: string | null
  tandemWeightTax?: number
  tandemHandcam?: boolean
  hasOutsideVideo?: boolean
  videoInstructorId?: string
  videoInstructorName?: string
  affLevel?: 'upper' | 'lower'
  loadId?: string  // Links assignment back to originating load for cleanup
  isDeleted?: boolean  // Soft-delete flag - assignment was reverted
  deletedAt?: string  // When assignment was soft-deleted
  deletedReason?: 'load_reverted' | 'manual_delete'  // Why it was deleted
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

export interface PeriodStats {
  totalJumps: number
  totalEarnings: number
  instructorCount: number
  tandemCount: number
  affCount: number
  videoCount: number
  missedJumps: number
  avgPerJump: number
}

// ==================== STUDENT ACCOUNTS ====================

export interface StudentAccount {
  id: string                    // Firebase generated ID
  studentId: string             // Editable ID (member number, manifest ID, etc.)
  name: string
  email?: string
  phone?: string
  weight: number
  dateOfBirth?: string
  emergencyContact?: string
  emergencyPhone?: string
  
  // Jump preferences
  preferredJumpType?: 'tandem' | 'aff'
  affLevel?: 'upper' | 'lower'
  totalJumps: number
  totalTandemJumps: number
  totalAFFJumps: number
  
  // Metadata
  createdAt: string
  lastJumpDate?: string
  notes?: string
  isActive: boolean
}

export type CreateStudentAccount = Omit<StudentAccount, 'id' | 'createdAt' | 'totalJumps' | 'totalTandemJumps' | 'totalAFFJumps' | 'lastJumpDate' | 'isActive'>
export type UpdateStudentAccount = Partial<Omit<StudentAccount, 'id' | 'createdAt'>>

// ==================== QUEUE ====================

export interface QueueStudent {
  id: string
  studentAccountId: string      // References StudentAccount
  name: string                  // Cached from account
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
  studentAccountIds: string[]  // ✅ CHANGED: Now stores permanent StudentAccount IDs
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

// ==================== AIRCRAFT ====================

export interface Aircraft {
  id: string
  name: string                    // Display name (e.g., "Caravan")
  tailNumber: string              // Aircraft registration (e.g., "N123AB")
  capacity: number                // Default passenger capacity
  isActive: boolean               // Currently in service
  order: number                   // Display order in UI
  createdAt: string
  updatedAt?: string
}

export type CreateAircraft = Omit<Aircraft, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateAircraft = Partial<Omit<Aircraft, 'id' | 'createdAt'>>

// ==================== LOADS ====================

// ✅ BUG FIX #3: Added originalQueueTimestamp field
export interface LoadAssignment {
  id: string
  studentId: string
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
  originalQueueTimestamp?: string  // ✅ ADDED: Preserves original queue position
}

export interface Load {
  id: string
  name?: string
  position: number
  aircraftId?: string             // ✅ ADDED: Reference to aircraft
  capacity?: number               // Override aircraft default capacity
  status: 'building' | 'ready' | 'departed' | 'completed'
  assignments?: LoadAssignment[]
  funJumpers?: FunJumper[]        // Fun jumpers assigned to this load
  createdAt: string
  departedAt?: string
  completedAt?: string
  delayMinutes?: number
  countdownStartTime?: string     // Timer start time for countdown
  plannedDepartureTime?: string   // Calculated departure time for cancellation time-lock
}

export type CreateLoad = Omit<Load, 'id' | 'createdAt'>
export type UpdateLoad = Partial<Omit<Load, 'id' | 'createdAt'>>

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

export interface LoadSchedulingSettings {
  minutesBetweenLoads: number
  instructorCycleTime: number
  defaultPlaneCapacity: number    // ⚠️ DEPRECATED: Use aircraft.capacity instead (kept for migration)
  activeAircraftIds?: string[]    // ✅ ADDED: Ordered list of aircraft flying today
}

export interface AppSettings {
  darkMode: boolean
  autoAssign: AutoAssignSettings
  loadScheduling: LoadSchedulingSettings
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  autoAssign: {
    enabled: false,
    delay: 5,
    skipRequests: true,
    batchMode: false,
    batchSize: 3
  },
  loadScheduling: {
    minutesBetweenLoads: 20,
    instructorCycleTime: 40,
    defaultPlaneCapacity: 18
  }
}

// ==================== DATABASE STATE ====================

export interface DatabaseState {
  instructors: Instructor[]
  assignments: Assignment[]
  loads: Load[]
  aircraft: Aircraft[]            // ✅ ADDED: Aircraft collection
  studentQueue: QueueStudent[]
  studentAccounts: StudentAccount[]
  groups: Group[]
  clockEvents: ClockEvent[]
  periods: Period[]
}

// ==================== RE-EXPORT FUN JUMPER TYPES ====================

export type {
  SkyDiveType,
  RequestStatus,
  UserRole,
  UserProfile,
  CreateUserProfile,
  UpdateUserProfile,
  RequestHistoryEntry,
  FunJumperRequest,
  CreateFunJumperRequest,
  UpdateFunJumperRequest,
  FunJumper,
  CreateFunJumper,
  FunJumperGroup,
  CreateFunJumperGroup,
  NotificationPayload,
  NotificationData,
  NotificationResults,
  ApiResponse,
  PaginatedResponse
} from './funJumpers'

// ==================== RE-EXPORT MESSAGE TYPES ====================

export type {
  MessagePriority,
  RecipientType,
  Message,
  CreateMessage,
  MessageWithStatus,
  UnreadMessagesSummary
} from './messages'