// ==================== JUMP TYPES ====================

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
  canTandem: boolean
  canAFF: boolean
  canVideo: boolean
  tandemWeightLimit?: number
  affWeightLimit?: number
  clockedIn: boolean
  archived: boolean
  affLocked: boolean
  affStudents?: AFFStudent[]
  
  // Covering for system
  coveringFor?: string  // ID of instructor being covered for
}

// ==================== ASSIGNMENT ====================

export interface Assignment {
  id: string
  instructorId: string
  instructorName: string
  videoInstructorId?: string
  videoInstructorName?: string
  studentName: string
  studentWeight: number
  jumpType: JumpType
  timestamp: string
  isMissedJump: boolean
  isRequest: boolean
  
  // Tandem specific
  tandemWeightTax?: number
  tandemHandcam?: boolean
  hasOutsideVideo?: boolean
  
  // AFF specific
  affLevel?: AFFLevel
  
  // Covering system
  coveringFor?: string 
}

export interface CreateAssignment {
  instructorId: string
  instructorName: string
  videoInstructorId?: string
  videoInstructorName?: string
  studentName: string
  studentWeight: number
  jumpType: JumpType
  isMissedJump?: boolean
  isRequest?: boolean
  tandemWeightTax?: number
  tandemHandcam?: boolean
  affLevel?: AFFLevel
}

// ==================== QUEUE ====================

export interface QueueStudent {
  id: string
  name: string
  weight: number
  jumpType: JumpType
  timestamp: string
  isRequest: boolean
  
  // Tandem specific
  tandemWeightTax?: number
  tandemHandcam?: boolean
  outsideVideo?: boolean
  
  // AFF specific
  affLevel?: AFFLevel
}

export interface CreateQueueStudent {
  name: string
  weight: number
  jumpType: JumpType
  isRequest?: boolean
  tandemWeightTax?: number
  tandemHandcam?: boolean
  outsideVideo?: boolean
  affLevel?: AFFLevel
}

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

// ==================== LOAD ====================

export interface LoadAssignment {
  id: string
  studentId: string
  instructorId: string
  instructorName: string
  videoInstructorId?: string
  videoInstructorName?: string
  studentName: string
  studentWeight: number
  jumpType: JumpType
  isRequest: boolean
  
  // Tandem specific
  tandemWeightTax?: number
  tandemHandcam?: boolean
  hasOutsideVideo?: boolean
  
  // AFF specific
  affLevel?: AFFLevel
}

export interface Load {
  id: string
  name: string
  status: LoadStatus
  assignments: LoadAssignment[]
  capacity: number
  createdAt: string
  
  // NEW COUNTDOWN FIELDS - ADD THESE:
  position: number                    // Load sequence: 1, 2, 3, 4...
  countdownStartTime?: string         // ISO timestamp when countdown began
  scheduledDepartureTime?: string     // Calculated departure time
  delayMinutes?: number              // Total minutes this load has been delayed
}

// NEW INTERFACE - ADD THIS:
export interface LoadSchedulingSettings {
  minutesBetweenLoads: number        // Default: 20
  instructorCycleTime: number        // Default: 40 (20 prep + 20 skydive)
}

// ==================== PERIOD ====================

export interface Period {
  id: string
  name: string
  start: string
  end: string
  status: 'active' | 'archived'
  finalBalances?: Record<string, number> // instructorId → finalBalance
  finalStats?: {
    totalJumps: number
    totalEarnings: number
    instructorCount: number
  }
  createdAt: string
  endedAt?: string
}

export interface PeriodData {
  start: Date
  end: Date
  name: string
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
  delay: number
  skipRequests: boolean
  batchMode: boolean
  batchSize: number
}

// NEW: Load Scheduling Settings
export interface LoadSchedulingSettings {
  minutesBetweenLoads: number   // Default: 20
  instructorCycleTime: number   // Default: 40 (20 prep + 20 skydive)
}

// ==================== API RESPONSES ====================

export interface DatabaseState {
  instructors: Instructor[]
  assignments: Assignment[]
  studentQueue: QueueStudent[]
  groups: Group[]
  loads: Load[]
  clockEvents: ClockEvent[]
  periods?: Period[]
  loadSchedulingSettings?: LoadSchedulingSettings
  lastSaved: string
}

// ==================== HELPER TYPES ====================

export type CreateInstructor = Omit<Instructor, 'id'>
export type UpdateInstructor = Partial<Instructor>

export type CreateLoad = Omit<Load, 'id' | 'createdAt'>
export type UpdateLoad = Partial<Load>

export type CreatePeriod = Omit<Period, 'id' | 'createdAt'>
export type UpdatePeriod = Partial<Period>