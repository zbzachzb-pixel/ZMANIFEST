// src/services/firebase.ts - COMPLETE WITH STUDENT ACCOUNTS AND GROUP FIXES
import { database } from '@/lib/firebase'
import { 
  ref, 
  set, 
  get, 
  update, 
  remove,
  onValue,
  runTransaction
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
  UpdatePeriod,
  StudentAccount,
  CreateStudentAccount,
  UpdateStudentAccount,
  LoadSchedulingSettings
} from '@/types'

export class FirebaseService implements DatabaseService {
  private db = database
  
  constructor() {
    this.subscribeToInstructors = this.subscribeToInstructors.bind(this)
    this.subscribeToLoads = this.subscribeToLoads.bind(this)
    this.subscribeToAssignments = this.subscribeToAssignments.bind(this)
    this.subscribeToQueue = this.subscribeToQueue.bind(this)
    this.subscribeToGroups = this.subscribeToGroups.bind(this)
    this.subscribeToClockEvents = this.subscribeToClockEvents.bind(this)
    this.subscribeToPeriods = this.subscribeToPeriods.bind(this)
    this.subscribeToStudentAccounts = this.subscribeToStudentAccounts.bind(this)
    this.subscribeToAll = this.subscribeToAll.bind(this)
  }
  
  private cleanData<T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
  }
  
  private generateId(): string {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9)
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
      affStudents: []
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
  
  // ==================== STUDENT ACCOUNTS ====================
  
  async createStudentAccount(account: CreateStudentAccount): Promise<StudentAccount> {
    const newAccount: StudentAccount = {
      ...account,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      totalJumps: 0,
      totalTandemJumps: 0,
      totalAFFJumps: 0,
      isActive: true
    }
    
    const cleanedAccount = this.cleanData(newAccount)
    const accountRef = ref(this.db, `studentAccounts/${newAccount.id}`)
    await set(accountRef, cleanedAccount)
    
    return newAccount
  }
  
  async getStudentAccounts(): Promise<StudentAccount[]> {
    return this.getData<StudentAccount>('studentAccounts')
  }
  
  async getActiveStudentAccounts(): Promise<StudentAccount[]> {
    const accounts = await this.getStudentAccounts()
    return accounts.filter(account => account.isActive)
  }
  
  async getStudentAccountById(id: string): Promise<StudentAccount | null> {
    const accountRef = ref(this.db, `studentAccounts/${id}`)
    const snapshot = await get(accountRef)
    return snapshot.exists() ? snapshot.val() : null
  }
  
  async searchStudentAccounts(query: string): Promise<StudentAccount[]> {
    const accounts = await this.getActiveStudentAccounts()
    const lowerQuery = query.toLowerCase().trim()
    
    if (!lowerQuery) return accounts
    
    return accounts.filter(account => 
      account.name.toLowerCase().includes(lowerQuery) ||
      account.studentId.toLowerCase().includes(lowerQuery) ||
      account.email?.toLowerCase().includes(lowerQuery) ||
      account.phone?.includes(query)
    )
  }
  
  async updateStudentAccount(id: string, updates: UpdateStudentAccount): Promise<void> {
    const accountRef = ref(this.db, `studentAccounts/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(accountRef, cleanedUpdates)
  }
  
  async deactivateStudentAccount(id: string): Promise<void> {
    await this.updateStudentAccount(id, { isActive: false })
  }
  
  async incrementStudentJumpCount(studentAccountId: string, jumpType: 'tandem' | 'aff'): Promise<void> {
    const accountRef = ref(this.db, `studentAccounts/${studentAccountId}`)
    
    await runTransaction(accountRef, (account) => {
      if (account) {
        account.totalJumps = (account.totalJumps || 0) + 1
        
        if (jumpType === 'tandem') {
          account.totalTandemJumps = (account.totalTandemJumps || 0) + 1
        } else if (jumpType === 'aff') {
          account.totalAFFJumps = (account.totalAFFJumps || 0) + 1
        }
        
        account.lastJumpDate = new Date().toISOString()
      }
      return account
    })
  }
  
  subscribeToStudentAccounts(callback: (accounts: StudentAccount[]) => void): () => void {
    const accountsRef = ref(this.db, 'studentAccounts')
    const unsubscribe = onValue(accountsRef, (snapshot) => {
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
  
  async updateClockEvent(id: string, updates: Partial<ClockEvent>): Promise<void> {
    const eventRef = ref(this.db, `clockEvents/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(eventRef, cleanedUpdates)
  }
  
  async deleteClockEvent(id: string): Promise<void> {
    const eventRef = ref(this.db, `clockEvents/${id}`)
    await remove(eventRef)
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
  
  // ==================== QUEUE ====================
  
  async addToQueue(student: CreateQueueStudent, customTimestamp?: string): Promise<QueueStudent> {
    const newStudent: QueueStudent = {
      ...student,
      id: this.generateId(),
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
    
    // 🔥 FIX: Update each student in the queue to have the groupId
    const updatePromises = studentIds.map(async (studentId) => {
      const studentRef = ref(this.db, `studentQueue/${studentId}`)
      await update(studentRef, { groupId: newGroup.id })
    })
    
    await Promise.all(updatePromises)
    
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
    // First, get the group to find all student IDs
    const groupRef = ref(this.db, `groups/${id}`)
    const snapshot = await get(groupRef)
    
    if (snapshot.exists()) {
      const group = snapshot.val() as Group
      
      // Remove groupId from all students in the queue
      const updatePromises = group.studentIds.map(async (studentId) => {
        const studentRef = ref(this.db, `studentQueue/${studentId}`)
        // Get the student first to check if it exists
        const studentSnapshot = await get(studentRef)
        if (studentSnapshot.exists()) {
          // Remove the groupId field by setting it to null
          await update(studentRef, { groupId: null })
        }
      })
      
      await Promise.all(updatePromises)
    }
    
    // Finally, delete the group document
    await remove(groupRef)
  }
  
  async removeStudentFromGroup(groupId: string, studentId: string): Promise<void> {
    // Get the group
    const groupRef = ref(this.db, `groups/${groupId}`)
    const snapshot = await get(groupRef)
    
    if (!snapshot.exists()) {
      throw new Error('Group not found')
    }
    
    const group = snapshot.val() as Group
    
    // Remove student from group's studentIds array
    const updatedStudentIds = group.studentIds.filter(id => id !== studentId)
    
    // Remove groupId from the student in the queue
    const studentRef = ref(this.db, `studentQueue/${studentId}`)
    const studentSnapshot = await get(studentRef)
    if (studentSnapshot.exists()) {
      await update(studentRef, { groupId: null })
    }
    
    // If group now has 1 or 0 students, delete the group
    if (updatedStudentIds.length <= 1) {
      // If there's 1 student left, remove their groupId too
      if (updatedStudentIds.length === 1) {
        const lastStudentRef = ref(this.db, `studentQueue/${updatedStudentIds[0]}`)
        const lastStudentSnapshot = await get(lastStudentRef)
        if (lastStudentSnapshot.exists()) {
          await update(lastStudentRef, { groupId: null })
        }
      }
      // Delete the group
      await remove(groupRef)
    } else {
      // Update the group with new studentIds
      await update(groupRef, { studentIds: updatedStudentIds })
    }
  }
  async addStudentToGroup(groupId: string, studentId: string): Promise<void> {
    // Get the group
    const groupRef = ref(this.db, `groups/${groupId}`)
    const groupSnapshot = await get(groupRef)
    
    if (!groupSnapshot.exists()) {
      throw new Error('Group not found')
    }
    
    const group = groupSnapshot.val() as Group
    
    // Get the student
    const studentRef = ref(this.db, `studentQueue/${studentId}`)
    const studentSnapshot = await get(studentRef)
    
    if (!studentSnapshot.exists()) {
      throw new Error('Student not found in queue')
    }
    
    const student = studentSnapshot.val() as QueueStudent
    
    // Check if student is already in a group
    if (student.groupId) {
      // If already in THIS group, do nothing
      if (student.groupId === groupId) {
        return
      }
      
      // If in a DIFFERENT group, remove from old group first
      const oldGroupRef = ref(this.db, `groups/${student.groupId}`)
      const oldGroupSnapshot = await get(oldGroupRef)
      
      if (oldGroupSnapshot.exists()) {
        const oldGroup = oldGroupSnapshot.val() as Group
        const updatedOldStudentIds = oldGroup.studentIds.filter(id => id !== studentId)
        
        // If old group now has 1 or 0 students, delete it
        if (updatedOldStudentIds.length <= 1) {
          if (updatedOldStudentIds.length === 1) {
            const lastStudentRef = ref(this.db, `studentQueue/${updatedOldStudentIds[0]}`)
            await update(lastStudentRef, { groupId: null })
          }
          await remove(oldGroupRef)
        } else {
          await update(oldGroupRef, { studentIds: updatedOldStudentIds })
        }
      }
    }
    
    // Check if student is already in the new group's studentIds
    if (!group.studentIds.includes(studentId)) {
      // Add student to new group's studentIds array
      await update(groupRef, { 
        studentIds: [...group.studentIds, studentId] 
      })
    }
    
    // Update student's groupId
    await update(studentRef, { groupId: groupId })
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
      })) as Period[] : []
      callback(periods)
    })
    return unsubscribe
  }
  // ==================== SETTINGS ====================

async saveLoadSchedulingSettings(settings: LoadSchedulingSettings): Promise<void> {
  const settingsRef = ref(this.db, 'settings/loadScheduling')
  const cleanedSettings = this.cleanData(settings)
  await set(settingsRef, cleanedSettings)
}

async getLoadSchedulingSettings(): Promise<LoadSchedulingSettings | null> {
  const settingsRef = ref(this.db, 'settings/loadScheduling')
  const snapshot = await get(settingsRef)
  return snapshot.exists() ? snapshot.val() : null
}

subscribeToLoadSchedulingSettings(callback: (settings: LoadSchedulingSettings | null) => void): () => void {
  const settingsRef = ref(this.db, 'settings/loadScheduling')
  const unsubscribe = onValue(settingsRef, (snapshot) => {
    const data = snapshot.val()
    callback(data || null)
  })
  return unsubscribe
}
  // ==================== BULK ====================
  
  async getFullState(): Promise<DatabaseState> {
    const [
      instructors, 
      assignments, 
      studentQueue, 
      studentAccounts,
      groups, 
      loads, 
      clockEvents, 
      periods
    ] = await Promise.all([
      this.getInstructors(),
      this.getAssignments(),
      this.getQueue(),
      this.getStudentAccounts(),
      this.getGroups(),
      this.getLoads(),
      this.getClockEvents(),
      this.getPeriods()
    ])
    
    return {
      instructors,
      assignments,
      studentQueue,
      studentAccounts,
      groups,
      loads,
      clockEvents,
      periods
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
          studentAccounts: data.studentAccounts ? Object.values(data.studentAccounts) : [],
          groups: data.groups ? Object.values(data.groups) : [],
          loads: data.loads ? Object.values(data.loads) : [],
          clockEvents: data.clockEvents ? Object.values(data.clockEvents) : [],
          periods: data.periods ? Object.values(data.periods).map((p: any) => ({
            ...p,
            start: new Date(p.start),
            end: new Date(p.end)
          })) : []
        })
      }
    })
    return unsubscribe
  }
}