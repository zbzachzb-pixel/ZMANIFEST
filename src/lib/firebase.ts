import { 
  ref, 
  set, 
  get, 
  update, 
  remove,
  onValue,
  runTransaction  // ✅ Added for atomic updates
} from 'firebase/database'
import type { DatabaseService } from './database'
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

import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)

export class FirebaseService implements DatabaseService {
  private db = database
  
  constructor() {
    // Bind all methods to preserve 'this' context
    this.subscribeToInstructors = this.subscribeToInstructors.bind(this)
    this.subscribeToLoads = this.subscribeToLoads.bind(this)
    this.subscribeToAssignments = this.subscribeToAssignments.bind(this)
    this.subscribeToQueue = this.subscribeToQueue.bind(this)
    this.subscribeToGroups = this.subscribeToGroups.bind(this)
    this.subscribeToClockEvents = this.subscribeToClockEvents.bind(this)
    this.subscribeToPeriods = this.subscribeToPeriods.bind(this)
    this.subscribeToAll = this.subscribeToAll.bind(this)
  }
  
  private cleanData<T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
  }
  
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  private async getData<T>(path: string): Promise<T[]> {
    const dataRef = ref(this.db, path)
    const snapshot = await get(dataRef)
    const data = snapshot.val()
    return data ? Object.values(data) : []
  }
  
  // ==================== INSTRUCTORS ====================
  
  async createInstructor(instructor: CreateInstructor): Promise<Instructor> {
    const newInstructor: Instructor = {
      ...instructor,
      id: this.generateId(),
      clockedIn: false,
      clockInTime: null,
      archived: false,
      affLocked: false,
      affStudents: [],
    }
    
    const cleanedInstructor = this.cleanData(newInstructor)
    const instructorRef = ref(this.db, `instructors/${newInstructor.id}`)
    await set(instructorRef, cleanedInstructor)
    
    return newInstructor
  }
  
  async getInstructors(): Promise<Instructor[]> {
    return this.getData<Instructor>('instructors')
  }
  
  async getActiveInstructors(): Promise<Instructor[]> {
    const allInstructors = await this.getInstructors()
    return allInstructors.filter(i => !i.archived)
  }
  
  async updateInstructor(id: string, updates: UpdateInstructor): Promise<void> {
    const instructorRef = ref(this.db, `instructors/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(instructorRef, cleanedUpdates)
  }
  
  async archiveInstructor(id: string): Promise<void> {
    await this.updateInstructor(id, { archived: true })
  }
  
  subscribeToInstructors(callback: (instructors: Instructor[]) => void): () => void {
    const instructorsRef = ref(this.db, 'instructors')
    const unsubscribe = onValue(instructorsRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }
  
  // ==================== CLOCK EVENTS ====================
  
  async logClockEvent(instructorId: string, instructorName: string, type: 'in' | 'out'): Promise<ClockEvent> {
    const newEvent: ClockEvent = {
      id: this.generateId(),
      instructorId,
      instructorName,
      type,
      timestamp: new Date().toISOString()
    }
    
    const eventRef = ref(this.db, `clockEvents/${newEvent.id}`)
    await set(eventRef, newEvent)
    
    return newEvent
  }
  
  async getClockEvents(): Promise<ClockEvent[]> {
    return this.getData<ClockEvent>('clockEvents')
  }
  
  async getClockEventsByDate(date: Date): Promise<ClockEvent[]> {
    const allEvents = await this.getClockEvents()
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.timestamp)
      return eventDate >= startOfDay && eventDate <= endOfDay
    })
  }
  
  async deleteClockEvent(id: string): Promise<void> {
    const clockEventRef = ref(this.db, `clockEvents/${id}`)
    await remove(clockEventRef)
  }
  
  async updateClockEvent(id: string, updates: Partial<ClockEvent>): Promise<void> {
    const clockEventRef = ref(this.db, `clockEvents/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(clockEventRef, cleanedUpdates)
  }
  
  subscribeToClockEvents(callback: (events: ClockEvent[]) => void): () => void {
    const eventsRef = ref(this.db, 'clockEvents')
    const unsubscribe = onValue(eventsRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }
  
  // ==================== LOADS ====================
  
  // ✅ FIXED Issue #29: Data consistency - sequential position validation
  async createLoad(load: CreateLoad): Promise<Load> {
    // Validate position is sequential
    const existingLoads = await this.getLoads()
    const activeLoads = existingLoads.filter(l => 
      l.status !== 'completed' && l.status !== 'departed'
    )
    
    const positions = activeLoads.map(l => l.position || 0)
    const maxPosition = positions.length > 0 ? Math.max(...positions) : 0
    
    if (load.position && load.position !== maxPosition + 1) {
      throw new Error(`Invalid position ${load.position}. Next position should be ${maxPosition + 1}`)
    }
    
    const newLoad: Load = {
      id: this.generateId(),
      ...load,
      position: load.position || maxPosition + 1,
      createdAt: new Date().toISOString(),
    }
    
    const loadRef = ref(this.db, `loads/${newLoad.id}`)
    const cleanedLoad = this.cleanData(newLoad)
    await set(loadRef, cleanedLoad)
    
    return newLoad
  }
  
  async getLoads(): Promise<Load[]> {
    return this.getData<Load>('loads')
  }
  
  async getLoadsByStatus(status: Load['status']): Promise<Load[]> {
    const allLoads = await this.getLoads()
    return allLoads.filter(load => load.status === status)
  }
  
  // ✅ FIXED Issue #4: Race condition - using Firebase transactions
  async updateLoad(id: string, updates: UpdateLoad): Promise<void> {
    const loadRef = ref(this.db, `loads/${id}`)
    
    // Use Firebase transaction for atomic updates
    await runTransaction(loadRef, (current) => {
      if (current === null) return null
      
      // Merge updates
      return { ...current, ...this.cleanData(updates) }
    })
  }
  
  async deleteLoad(id: string): Promise<void> {
    const loadRef = ref(this.db, `loads/${id}`)
    await remove(loadRef)
  }
  
  subscribeToLoads(callback: (loads: Load[]) => void): () => void {
    const loadsRef = ref(this.db, 'loads')
    const unsubscribe = onValue(loadsRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }
  
  // ==================== QUEUE ====================
  
  async addToQueue(student: CreateQueueStudent, customTimestamp?: string): Promise<QueueStudent> {
    const newStudent: QueueStudent = {
      ...student,
      id: this.generateId(),
      // Use custom timestamp if provided (for priority), otherwise use current time
      timestamp: customTimestamp || new Date().toISOString(),
    }
    
    const cleanedStudent = this.cleanData(newStudent)
    const studentRef = ref(this.db, `studentQueue/${newStudent.id}`)
    await set(studentRef, cleanedStudent)
    
    return newStudent
  }
  
  async getQueue(): Promise<QueueStudent[]> {
    return this.getData<QueueStudent>('studentQueue')
  }
  
  async removeFromQueue(id: string): Promise<void> {
    const studentRef = ref(this.db, `studentQueue/${id}`)
    await remove(studentRef)
  }
  
  async removeMultipleFromQueue(ids: string[]): Promise<void> {
    const promises = ids.map(id => this.removeFromQueue(id))
    await Promise.all(promises)
  }
  
  subscribeToQueue(callback: (queue: QueueStudent[]) => void): () => void {
    const queueRef = ref(this.db, 'studentQueue')
    const unsubscribe = onValue(queueRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }
  
  // ==================== ASSIGNMENTS ====================
  
  async createAssignment(assignment: CreateAssignment): Promise<Assignment> {
    const newAssignment: Assignment = {
      ...assignment,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    }
    
    const cleanedAssignment = this.cleanData(newAssignment)
    const assignmentRef = ref(this.db, `assignments/${newAssignment.id}`)
    await set(assignmentRef, cleanedAssignment)
    
    return newAssignment
  }
  
  async getAssignments(): Promise<Assignment[]> {
    return this.getData<Assignment>('assignments')
  }
  
  async getInstructorAssignments(instructorId: string): Promise<Assignment[]> {
    const allAssignments = await this.getAssignments()
    return allAssignments.filter(a => a.instructorId === instructorId)
  }
  
  async getAssignmentsByDateRange(start: Date, end: Date): Promise<Assignment[]> {
    const allAssignments = await this.getAssignments()
    return allAssignments.filter(assignment => {
      const assignmentDate = new Date(assignment.timestamp)
      return assignmentDate >= start && assignmentDate <= end
    })
  }
  
  async updateAssignment(id: string, updates: Partial<Assignment>): Promise<void> {
    const assignmentRef = ref(this.db, `assignments/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(assignmentRef, cleanedUpdates)
  }
  
  async deleteAssignment(id: string): Promise<void> {
    const assignmentRef = ref(this.db, `assignments/${id}`)
    await remove(assignmentRef)
  }
  
  subscribeToAssignments(callback: (assignments: Assignment[]) => void): () => void {
    const assignmentsRef = ref(this.db, 'assignments')
    const unsubscribe = onValue(assignmentsRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }
  
  // ==================== GROUPS ====================
  
  async createGroup(name: string, studentIds: string[]): Promise<Group> {
    const newGroup: Group = {
      id: this.generateId(),
      name,
      studentIds,
      createdAt: new Date().toISOString(),
    }
    
    const cleanedGroup = this.cleanData(newGroup)
    const groupRef = ref(this.db, `groups/${newGroup.id}`)
    await set(groupRef, cleanedGroup)
    
    return newGroup
  }
  
  async getGroups(): Promise<Group[]> {
    return this.getData<Group>('groups')
  }
  
  async updateGroup(id: string, updates: Partial<Group>): Promise<void> {
    const groupRef = ref(this.db, `groups/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(groupRef, cleanedUpdates)
  }
  
  async deleteGroup(id: string): Promise<void> {
    const groupRef = ref(this.db, `groups/${id}`)
    await remove(groupRef)
  }
  
  subscribeToGroups(callback: (groups: Group[]) => void): () => void {
    const groupsRef = ref(this.db, 'groups')
    const unsubscribe = onValue(groupsRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }
  
  // ==================== PERIODS ====================
  
  async createPeriod(period: CreatePeriod): Promise<Period> {
    const newPeriod: Period = {
      ...period,
      id: this.generateId(),
      isActive: false,
    }
    
    const cleanedPeriod = this.cleanData(newPeriod)
    const periodRef = ref(this.db, `periods/${newPeriod.id}`)
    await set(periodRef, cleanedPeriod)
    
    return newPeriod
  }
  
  async getPeriods(): Promise<Period[]> {
    const periods = await this.getData<any>('periods')
    return periods.map(p => ({
      ...p,
      start: new Date(p.start),
      end: new Date(p.end),
    }))
  }
  
  async updatePeriod(id: string, updates: UpdatePeriod): Promise<void> {
    const periodRef = ref(this.db, `periods/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(periodRef, cleanedUpdates)
  }
  
  async endPeriod(id: string, finalBalances: Record<string, number>, finalStats: any): Promise<void> {
    await this.updatePeriod(id, {
      isActive: false,
      archivedAt: new Date(),
      finalBalances,
    })
  }
  
  subscribeToPeriods(callback: (periods: Period[]) => void): () => void {
    const periodsRef = ref(this.db, 'periods')
    const unsubscribe = onValue(periodsRef, (snapshot) => {
      const data = snapshot.val()
      const periods = data ? Object.values(data).map((p: any) => ({
        ...p,
        start: new Date(p.start),
        end: new Date(p.end),
      })) : []
      callback(periods as Period[])
    })
    return unsubscribe
  }
  
  // ==================== BULK ====================
  
  async getFullState(): Promise<DatabaseState> {
    const [
      instructors, 
      assignments, 
      studentQueue, 
      groups, 
      loads, 
      clockEvents, 
      periods
    ] = await Promise.all([
      this.getInstructors(),
      this.getAssignments(),
      this.getQueue(),
      this.getGroups(),
      this.getLoads(),
      this.getClockEvents(),
      this.getPeriods(),
    ])
    
    return {
      instructors,
      assignments,
      studentQueue,
      groups,
      loads,
      clockEvents,
      periods,
    }
  }
  
  async restoreFullState(state: DatabaseState): Promise<void> {
    const rootRef = ref(this.db, '/')
    const cleanedState = this.cleanData(state)
    await set(rootRef, cleanedState)
  }
  
  subscribeToAll(callback: (state: DatabaseState) => void): () => void {
    const rootRef = ref(this.db, '/')
    const unsubscribe = onValue(rootRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        callback({
          instructors: data.instructors ? Object.values(data.instructors) : [],
          assignments: data.assignments ? Object.values(data.assignments) : [],
          studentQueue: data.studentQueue ? Object.values(data.studentQueue) : [],
          groups: data.groups ? Object.values(data.groups) : [],
          loads: data.loads ? Object.values(data.loads) : [],
          clockEvents: data.clockEvents ? Object.values(data.clockEvents) : [],
          periods: data.periods ? Object.values(data.periods).map((p: any) => ({
            ...p,
            start: new Date(p.start),
            end: new Date(p.end)
          })) : [],
        })
      }
    })
    return unsubscribe
  }
}