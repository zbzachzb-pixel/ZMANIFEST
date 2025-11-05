// src/services/database.ts - COMPLETE WITH STUDENT ACCOUNTS, SETTINGS, USER PROFILES, AND AIRCRAFT
import type {
  Instructor,
  CreateInstructor,
  UpdateInstructor,
  Aircraft,
  CreateAircraft,
  UpdateAircraft,
  Load,
  CreateLoad,
  UpdateLoad,
  Assignment,
  CreateAssignment,
  QueueStudent,
  CreateQueueStudent,
  Group,
  DatabaseState,
  ClockEvent,
  Period,
  CreatePeriod,
  UpdatePeriod,
  PeriodStats,
  StudentAccount,
  CreateStudentAccount,
  UpdateStudentAccount,
  AppSettings,
  AutoAssignSettings,
  LoadSchedulingSettings
} from '@/types'
import type { UserProfile } from '@/types/funJumpers'

export interface DatabaseService {
  // ==================== INSTRUCTORS ====================
  createInstructor(instructor: CreateInstructor): Promise<Instructor>
  getInstructors(): Promise<Instructor[]>
  getActiveInstructors(): Promise<Instructor[]>
  updateInstructor(id: string, updates: UpdateInstructor): Promise<void>
  archiveInstructor(id: string): Promise<void>
  subscribeToInstructors(callback: (instructors: Instructor[]) => void): () => void

  // ==================== AIRCRAFT ====================
  createAircraft(aircraft: CreateAircraft): Promise<string>
  getAllAircraft(): Promise<Aircraft[]>
  getActiveAircraft(): Promise<Aircraft[]>
  getAircraftById(id: string): Promise<Aircraft | null>
  updateAircraft(id: string, updates: UpdateAircraft): Promise<void>
  deactivateAircraft(id: string): Promise<void>
  reactivateAircraft(id: string): Promise<void>
  deleteAircraft(id: string): Promise<void>
  subscribeToAircraft(callback: (aircraft: Aircraft[]) => void): () => void

  // ==================== STUDENT ACCOUNTS ====================
  createStudentAccount(account: CreateStudentAccount): Promise<StudentAccount>
  getStudentAccounts(): Promise<StudentAccount[]>
  getActiveStudentAccounts(): Promise<StudentAccount[]>
  getStudentAccountById(id: string): Promise<StudentAccount | null>
  searchStudentAccounts(query: string): Promise<StudentAccount[]>
  updateStudentAccount(id: string, updates: UpdateStudentAccount): Promise<void>
  deactivateStudentAccount(id: string): Promise<void>
  incrementStudentJumpCount(studentAccountId: string, jumpType: 'tandem' | 'aff'): Promise<void>
  decrementStudentJumpCount(studentAccountId: string, jumpType: 'tandem' | 'aff'): Promise<void>
  subscribeToStudentAccounts(callback: (accounts: StudentAccount[]) => void): () => void

  // ==================== USER PROFILES ====================
  getUserProfiles(): Promise<UserProfile[]>
  getUserProfile(uid: string): Promise<UserProfile | null>
  updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void>
  deleteUserProfile(uid: string): Promise<void>
  subscribeToUserProfiles(callback: (users: UserProfile[]) => void): () => void

  // ==================== CLOCK EVENTS ====================
  logClockEvent(instructorId: string, instructorName: string, type: 'in' | 'out'): Promise<ClockEvent>
  getClockEvents(): Promise<ClockEvent[]>
  getClockEventsByDate(date: Date): Promise<ClockEvent[]>
  subscribeToClockEvents(callback: (events: ClockEvent[]) => void): () => void
  updateClockEvent(id: string, updates: Partial<ClockEvent>): Promise<void>
  deleteClockEvent(id: string): Promise<void>
  
  // ==================== LOADS ====================
  createLoad(load: CreateLoad): Promise<Load>
  getLoads(): Promise<Load[]>
  getLoadsByStatus(status: Load['status']): Promise<Load[]>
  updateLoad(id: string, updates: UpdateLoad): Promise<void>
  deleteLoad(id: string): Promise<void>
  subscribeToLoads(callback: (loads: Load[]) => void): () => void
  subscribeToActiveLoads(daysToKeep: number, callback: (loads: Load[]) => void): () => void
  
  // ==================== ASSIGNMENTS ====================
  createAssignment(assignment: CreateAssignment, customTimestamp?: string): Promise<Assignment>
  getAssignments(): Promise<Assignment[]>
  getInstructorAssignments(instructorId: string): Promise<Assignment[]>
  getAssignmentsByDateRange(start: Date, end: Date): Promise<Assignment[]>
  getAssignmentsByLoadId(loadId: string): Promise<Assignment[]>
  updateAssignment(id: string, updates: Partial<Assignment>): Promise<void>
  deleteAssignment(id: string): Promise<void>
  softDeleteAssignment(id: string, reason: 'load_reverted' | 'manual_delete'): Promise<void>
  subscribeToAssignments(callback: (assignments: Assignment[]) => void): () => void
  subscribeToAssignmentsByDateRange(startDate: Date, endDate: Date, callback: (assignments: Assignment[]) => void): () => void
  
  // ==================== QUEUE ====================
  addToQueue(student: CreateQueueStudent, customTimestamp?: string): Promise<QueueStudent>
  getQueue(): Promise<QueueStudent[]>
  removeFromQueue(id: string): Promise<void>
  removeMultipleFromQueue(ids: string[]): Promise<void>
  clearQueue(): Promise<void>
  updateQueueStudent(id: string, updates: Partial<QueueStudent>): Promise<void>
  subscribeToQueue(callback: (queue: QueueStudent[]) => void): () => void
  
  // ==================== GROUPS ====================
  createGroup(name: string, studentIds: string[]): Promise<Group>
  getGroups(): Promise<Group[]>
  updateGroup(id: string, updates: Partial<Group>): Promise<void>
  deleteGroup(id: string): Promise<void>
  removeStudentFromGroup(groupId: string, studentId: string): Promise<void>
  subscribeToGroups(callback: (groups: Group[]) => void): () => void
  addStudentToGroup(groupId: string, studentId: string): Promise<void>
  
  // ==================== PERIODS ====================
  createPeriod(period: CreatePeriod): Promise<Period>
  getPeriods(): Promise<Period[]>
  updatePeriod(id: string, updates: UpdatePeriod): Promise<void>
  endPeriod(id: string, finalBalances: Record<string, number>, finalStats: PeriodStats): Promise<void>
  subscribeToPeriods(callback: (periods: Period[]) => void): () => void
  
  // ==================== SETTINGS ====================
  getSettings(): Promise<AppSettings>
  updateSettings(settings: Partial<AppSettings>): Promise<void>
  updateAutoAssignSettings(settings: Partial<AutoAssignSettings>): Promise<void>
  updateLoadSchedulingSettings(settings: Partial<LoadSchedulingSettings>): Promise<void>
  updateDarkMode(enabled: boolean): Promise<void>
  subscribeToSettings(callback: (settings: AppSettings) => void): () => void
  
  // Legacy/convenience methods for backwards compatibility
  getLoadSchedulingSettings(): Promise<LoadSchedulingSettings>
  saveLoadSchedulingSettings(settings: LoadSchedulingSettings): Promise<void>
  subscribeToLoadSchedulingSettings(callback: (settings: LoadSchedulingSettings) => void): () => void
  getAutoAssignSettings(): Promise<AutoAssignSettings>
  getDarkMode(): Promise<boolean>
  
  // ==================== BULK ====================
  getFullState(): Promise<DatabaseState>
  restoreFullState(state: DatabaseState): Promise<void>
  subscribeToAll(callback: (state: DatabaseState) => void): () => void
}