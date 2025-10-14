// src/services/database.ts
import type {
  Instructor,
  CreateInstructor,
  UpdateInstructor,
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
  UpdatePeriod
} from '@/types'

export interface DatabaseService {
  // INSTRUCTORS
  createInstructor(instructor: CreateInstructor): Promise<Instructor>
  getInstructors(): Promise<Instructor[]>
  getActiveInstructors(): Promise<Instructor[]>
  updateInstructor(id: string, updates: UpdateInstructor): Promise<void>
  archiveInstructor(id: string): Promise<void>
  subscribeToInstructors(callback: (instructors: Instructor[]) => void): () => void
  
  // CLOCK EVENTS
  logClockEvent(instructorId: string, instructorName: string, type: 'in' | 'out'): Promise<ClockEvent>
  getClockEvents(): Promise<ClockEvent[]>
  getClockEventsByDate(date: Date): Promise<ClockEvent[]>
  subscribeToClockEvents(callback: (events: ClockEvent[]) => void): () => void
  updateClockEvent(id: string, updates: Partial<ClockEvent>): Promise<void>  // ✅ NEW
  deleteClockEvent(id: string): Promise<void>
  
  // LOADS
  createLoad(load: CreateLoad): Promise<Load>
  getLoads(): Promise<Load[]>
  getLoadsByStatus(status: Load['status']): Promise<Load[]>
  updateLoad(id: string, updates: UpdateLoad): Promise<void>
  deleteLoad(id: string): Promise<void>
  subscribeToLoads(callback: (loads: Load[]) => void): () => void
  
  // ASSIGNMENTS
  createAssignment(assignment: CreateAssignment): Promise<Assignment>
  getAssignments(): Promise<Assignment[]>
  getInstructorAssignments(instructorId: string): Promise<Assignment[]>
  getAssignmentsByDateRange(start: Date, end: Date): Promise<Assignment[]>
  updateAssignment(id: string, updates: Partial<Assignment>): Promise<void>
  deleteAssignment(id: string): Promise<void>
  subscribeToAssignments(callback: (assignments: Assignment[]) => void): () => void
  
  // QUEUE
  addToQueue(student: CreateQueueStudent): Promise<QueueStudent>
  getQueue(): Promise<QueueStudent[]>
  removeFromQueue(id: string): Promise<void>
  removeMultipleFromQueue(ids: string[]): Promise<void>
  subscribeToQueue(callback: (queue: QueueStudent[]) => void): () => void
  
  // GROUPS
  createGroup(name: string, studentIds: string[]): Promise<Group>
  getGroups(): Promise<Group[]>
  updateGroup(id: string, updates: Partial<Group>): Promise<void>
  deleteGroup(id: string): Promise<void>
  subscribeToGroups(callback: (groups: Group[]) => void): () => void
  
  // PERIODS
  createPeriod(period: CreatePeriod): Promise<Period>
  getPeriods(): Promise<Period[]>
  updatePeriod(id: string, updates: UpdatePeriod): Promise<void>
  endPeriod(id: string, finalBalances: Record<string, number>, finalStats: any): Promise<void>
  subscribeToPeriods(callback: (periods: Period[]) => void): () => void
  
  // BULK
  getFullState(): Promise<DatabaseState>
  restoreFullState(state: DatabaseState): Promise<void>
  subscribeToAll(callback: (state: DatabaseState) => void): () => void
}