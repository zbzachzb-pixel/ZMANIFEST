import { database } from '@/lib/firebase'
import { 
  ref, 
  set, 
  get, 
  update, 
  remove,
  onValue
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
  ClockEvent
} from '@/types'

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
    this.subscribeToAll = this.subscribeToAll.bind(this)
  }
  
  private cleanData<T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
  }
  
  private async getData<T>(path: string): Promise<T[]> {
    const dataRef = ref(this.db, path)
    const snapshot = await get(dataRef)
    const data = snapshot.val()
    return data ? Object.values(data) : []
  }
  
  private generateId(): string {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9)
  }
  
  async createInstructor(instructor: CreateInstructor): Promise<Instructor> {
    const newInstructor: Instructor = {
      ...instructor,
      id: this.generateId(),
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
    await this.updateInstructor(id, { archived: true, clockedIn: false })
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
  
  subscribeToClockEvents(callback: (events: ClockEvent[]) => void): () => void {
    const eventsRef = ref(this.db, 'clockEvents')
    const unsubscribe = onValue(eventsRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }

  async createLoad(load: CreateLoad): Promise<Load> {
    const newLoad: Load = {
      ...load,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    }
    
    const cleanedLoad = this.cleanData(newLoad)
    const loadRef = ref(this.db, `loads/${newLoad.id}`)
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
  
  async updateLoad(id: string, updates: UpdateLoad): Promise<void> {
    const loadRef = ref(this.db, `loads/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(loadRef, cleanedUpdates)
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
    return allAssignments.filter(a => 
      a.instructorId === instructorId || a.videoInstructorId === instructorId
    )
  }
  
  async getAssignmentsByDateRange(start: Date, end: Date): Promise<Assignment[]> {
    const allAssignments = await this.getAssignments()
    return allAssignments.filter(a => {
      const assignmentDate = new Date(a.timestamp)
      return assignmentDate >= start && assignmentDate <= end
    })
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
  
  async addToQueue(student: CreateQueueStudent): Promise<QueueStudent> {
    const newStudent: QueueStudent = {
      ...student,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
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
  
  async createGroup(name: string, studentIds: string[]): Promise<Group> {
    const newGroup: Group = {
      id: this.generateId(),
      name,
      studentIds,
      createdAt: new Date().toISOString(),
    }
    
    const groupRef = ref(this.db, `groups/${newGroup.id}`)
    await set(groupRef, newGroup)
    
    return newGroup
  }
  
  async getGroups(): Promise<Group[]> {
    return this.getData<Group>('groups')
  }
  
  async updateGroup(id: string, updates: Partial<Group>): Promise<void> {
    const groupRef = ref(this.db, `groups/${id}`)
    await update(groupRef, updates)
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
  
  async getFullState(): Promise<DatabaseState> {
    const [instructors, assignments, studentQueue, groups, loads, clockEvents] = await Promise.all([
      this.getInstructors(),
      this.getAssignments(),
      this.getQueue(),
      this.getGroups(),
      this.getLoads(),
      this.getClockEvents(),
    ])
    
    return {
      instructors,
      assignments,
      studentQueue,
      groups,
      loads,
      clockEvents,
      lastSaved: new Date().toISOString(),
    }
  }
  
  async importState(state: DatabaseState): Promise<void> {
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
          lastSaved: data.lastSaved || new Date().toISOString(),
        })
      }
    })
    return unsubscribe
  }
}