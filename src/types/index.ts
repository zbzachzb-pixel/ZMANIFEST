// ==================== CORE TYPES ====================

export type Team = 'red' | 'blue' | 'gold' | null

export type JumpType = 'tandem' | 'aff' | 'video'

export type LoadStatus = 'building' | 'ready' | 'departed' | 'completed'

export type AFFLevel = 'lower' | 'upper'

// ==================== INSTRUCTOR ====================

export interface Instructor {
  id: string
  name: string
  bodyWeight: number
  team: Team
  
  // Departments
  tandem: boolean
  aff: boolean
  video: boolean
  
  // Weight limits
  tandemWeightLimit: number | null
  affWeightLimit: number | null
  
  // Video restrictions
  videoRestricted: boolean
  videoMinWeight: number | null
  videoMaxWeight: number | null
  
  // Status
  clockedIn: boolean
  archived: boolean
  
  // AFF locking
  affLocked: boolean
  affStudents: AFFStudent[]
}

export interface AFFStudent {
  name: string
  startTime: string
  studentId: string
}

// ==================== STUDENT QUEUE ====================

export interface QueueStudent {
  id: string
  name: string
  weight: number
  jumpType: JumpType
  timestamp: string
  
  // Tandem specific
  tandemWeightTax?: number
  tandemHandcam?: boolean
  outsideVideo?: boolean
  
  // AFF specific
  affLevel?: AFFLevel
  
  // General
  isRequest: boolean
  groupId?: string
}

// ==================== GROUP ====================

export interface Group {
  id: string
  name: string
  studentIds: string[]
  createdAt: string
}


// ==================== ASSIGNMENT ====================

export interface Assignment {
  id: string
  instructorId: string
  name: string
  weight: number
  jumpType: JumpType
  timestamp: string
  isRequest: boolean
  
  // Tandem specific
  tandemWeightTax?: number
  tandemHandcam?: boolean
  
  // AFF specific
  affLevel?: AFFLevel
  
  // Video
  videoInstructorId?: string
  hasOutsideVideo?: boolean
  
  // Missed jumps
  isMissedJump?: boolean
  
  // ⭐ NEW: Covering for system - add this line
  coveringFor?: string  // ID of instructor being covered for
}

// Rest of your types remain unchanged

// ==================== LOAD ====================

export interface LoadAssignment {
  id: string
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
}

// ==================== PERIOD ====================

export interface Period {
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

// ==================== API RESPONSES ====================

export interface DatabaseState {
  instructors: Instructor[]
  assignments: Assignment[]
  studentQueue: QueueStudent[]
  groups: Group[]
  loads: Load[]
  lastSaved: string
}

// ==================== HELPER TYPES ====================

export type CreateInstructor = Omit<Instructor, 'id'>
export type UpdateInstructor = Partial<Instructor>

export type CreateLoad = Omit<Load, 'id' | 'createdAt'>
export type UpdateLoad = Partial<Load>

export type CreateAssignment = Omit<Assignment, 'id' | 'timestamp'>

export type CreateQueueStudent = Omit<QueueStudent, 'id' | 'timestamp'>