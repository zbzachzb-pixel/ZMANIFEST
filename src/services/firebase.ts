// src/services/firebase.ts - COMPLETE VERSION WITH ALL METHODS
// ✅ FIXED: Added ALL missing methods from DatabaseService interface
// ✅ FIXED: Added transaction safety for updateLoad

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
  AppSettings,
  AutoAssignSettings,
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
    this.subscribeToSettings = this.subscribeToSettings.bind(this)
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
    const accounts = await this.getStudentAccounts()
    const lowerQuery = query.toLowerCase()
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
    const account = await this.getStudentAccountById(studentAccountId)
    if (!account) return
    
    const updates: UpdateStudentAccount = {
      totalJumps: account.totalJumps + 1,
      lastJumpDate: new Date().toISOString()
    }
    
    if (jumpType === 'tandem') {
      updates.totalTandemJumps = account.totalTandemJumps + 1
    } else if (jumpType === 'aff') {
      updates.totalAFFJumps = account.totalAFFJumps + 1
    }
    
    await this.updateStudentAccount(studentAccountId, updates)
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
    const event: ClockEvent = {
      id: this.generateId(),
      instructorId,
      instructorName,
      type,
      timestamp: new Date().toISOString()
    }
    
    const eventRef = ref(this.db, `clockEvents/${event.id}`)
    await set(eventRef, event)
    
    return event
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
    await update(eventRef, updates)
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
  
  // ✅ BUG FIX: Transaction-safe load updates
  async updateLoad(id: string, updates: UpdateLoad): Promise<void> {
    const loadRef = ref(this.db, `loads/${id}`)
    
    // Clean the data before the transaction to avoid context issues
    const cleanedUpdates = this.cleanData(updates)
    
    try {
      await runTransaction(loadRef, (currentLoad) => {
        if (!currentLoad) {
          throw new Error('Load not found')
        }
        
        // Validate instructor assignments don't conflict
        if (cleanedUpdates.assignments) {
          const instructorUsage = new Map<string, string[]>()
          
          for (const assignment of cleanedUpdates.assignments) {
            if (assignment.instructorId) {
              if (!instructorUsage.has(assignment.instructorId)) {
                instructorUsage.set(assignment.instructorId, [])
              }
              instructorUsage.get(assignment.instructorId)!.push(`Main: ${assignment.studentName}`)
            }
            
            if (assignment.videoInstructorId) {
              if (!instructorUsage.has(assignment.videoInstructorId)) {
                instructorUsage.set(assignment.videoInstructorId, [])
              }
              instructorUsage.get(assignment.videoInstructorId)!.push(`Video: ${assignment.studentName}`)
            }
          }
          
          // Check for conflicts
          for (const [instructorId, uses] of instructorUsage) {
            if (uses.length > 1) {
              throw new Error(`Conflict: Instructor assigned multiple times: ${uses.join(', ')}`)
            }
          }
        }
        
        // Apply updates atomically
        return { ...currentLoad, ...cleanedUpdates }
      })
      
      console.log(`✅ Load ${id} updated atomically`)
    } catch (error) {
      console.error('Transaction failed:', error)
      throw error
    }
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
      timestamp: new Date().toISOString()
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
      const date = new Date(a.timestamp)
      return date >= start && date <= end
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
      timestamp: customTimestamp || new Date().toISOString()
    }
    
    const cleanedStudent = this.cleanData(newStudent)
    const studentRef = ref(this.db, `queue/${newStudent.id}`)
    await set(studentRef, cleanedStudent)
    
    return newStudent
  }
  
  async getQueue(): Promise<QueueStudent[]> {
    return this.getData<QueueStudent>('queue')
  }
  
  async removeFromQueue(id: string): Promise<void> {
    const queueRef = ref(this.db, `queue/${id}`)
    await remove(queueRef)
  }
  
  async removeMultipleFromQueue(ids: string[]): Promise<void> {
    const updates: any = {}
    ids.forEach(id => {
      updates[`queue/${id}`] = null
    })
    const rootRef = ref(this.db)
    await update(rootRef, updates)
  }
  
  async updateQueueStudent(id: string, updates: Partial<QueueStudent>): Promise<void> {
    const studentRef = ref(this.db, `queue/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(studentRef, cleanedUpdates)
  }
  
  subscribeToQueue(callback: (queue: QueueStudent[]) => void): () => void {
    const queueRef = ref(this.db, 'queue')
    const unsubscribe = onValue(queueRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }
  
 // ==================== GROUPS ====================

async createGroup(name: string, studentAccountIds: string[]): Promise<Group> {
  console.log('🔥 Creating group with studentAccountIds:', studentAccountIds)
  
  const newGroup: Group = {
    id: this.generateId(),
    name,
    studentAccountIds,  // ✅ Store permanent StudentAccount IDs
    createdAt: new Date().toISOString()
  }
  
  const cleanedGroup = this.cleanData(newGroup)
  const groupRef = ref(this.db, `groups/${newGroup.id}`)
  await set(groupRef, cleanedGroup)
  
  // ✅ Set groupId on queue students by matching studentAccountId
  const queue = await this.getQueue()
  const updates: any = {}
  
  for (const student of queue) {
    if (studentAccountIds.includes(student.studentAccountId)) {
      updates[`queue/${student.id}/groupId`] = newGroup.id
      console.log(`  ✅ Setting groupId for student account ${student.studentAccountId} (queue id: ${student.id})`)
    }
  }
  
  if (Object.keys(updates).length > 0) {
    const rootRef = ref(this.db)
    await update(rootRef, updates)
    console.log('✅ All students updated with groupId')
  }
  
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
  console.log('🗑️ Deleting group:', id)
  
  const groupRef = ref(this.db, `groups/${id}`)
  const snapshot = await get(groupRef)
  
  if (snapshot.exists()) {
    const group = snapshot.val()
    const queue = await this.getQueue()
    
    console.log('  Group studentAccountIds:', group.studentAccountIds)
    
    // Clear groupId from all queue students that match this group's studentAccountIds
    const updates: any = {}
    for (const student of queue) {
      if (group.studentAccountIds.includes(student.studentAccountId)) {
        updates[`queue/${student.id}/groupId`] = null
        console.log(`  ✅ Clearing groupId from student account ${student.studentAccountId}`)
      }
    }
    
    if (Object.keys(updates).length > 0) {
      const rootRef = ref(this.db)
      await update(rootRef, updates)
      console.log('  ✅ All students ungrouped')
    }
  }
  
  await remove(groupRef)
  console.log('✅ Group deleted')
}

async addStudentToGroup(groupId: string, studentAccountId: string): Promise<void> {
  console.log('➕ Adding student to group:', { groupId, studentAccountId })
  
  const groupRef = ref(this.db, `groups/${groupId}`)
  const snapshot = await get(groupRef)
  
  if (snapshot.exists()) {
    const group = snapshot.val()
    const updatedStudentAccountIds = [...(group.studentAccountIds || []), studentAccountId]
    
    // Update the group with new studentAccountId
    await update(groupRef, { studentAccountIds: updatedStudentAccountIds })
    
    // Find queue student with this studentAccountId and set their groupId
    const queue = await this.getQueue()
    const student = queue.find(s => s.studentAccountId === studentAccountId)
    
    if (student) {
      const studentRef = ref(this.db, `queue/${student.id}`)
      await update(studentRef, { groupId })
      console.log('✅ Student added to group and groupId set')
    } else {
      console.log('⚠️ Student not found in queue, but added to group')
    }
  }
}

async removeStudentFromGroup(groupId: string, studentAccountId: string): Promise<void> {
  console.log('➖ Removing student from group:', { groupId, studentAccountId })
  
  const groupRef = ref(this.db, `groups/${groupId}`)
  const snapshot = await get(groupRef)
  
  if (snapshot.exists()) {
    const group = snapshot.val()
    const updatedStudentAccountIds = (group.studentAccountIds || [])
      .filter((id: string) => id !== studentAccountId)
    
    // Update the group
    await update(groupRef, { studentAccountIds: updatedStudentAccountIds })
    
    // Find queue student and clear their groupId
    const queue = await this.getQueue()
    const student = queue.find(s => s.studentAccountId === studentAccountId)
    
    if (student) {
      const studentRef = ref(this.db, `queue/${student.id}`)
      await update(studentRef, { groupId: null })
      console.log('✅ Student removed from group and groupId cleared')
    }
    
    // If group now has 0 or 1 students, delete it
    if (updatedStudentAccountIds.length <= 1) {
      console.log('⚠️ Group has ≤1 student, deleting group')
      
      // Clear groupId from remaining student if any
      if (updatedStudentAccountIds.length === 1) {
        const remaining = queue.find(s => s.studentAccountId === updatedStudentAccountIds[0])
        if (remaining) {
          const remainingRef = ref(this.db, `queue/${remaining.id}`)
          await update(remainingRef, { groupId: null })
          console.log(`  ✅ Cleared groupId from remaining student ${remaining.studentAccountId}`)
        }
      }
      
      await remove(groupRef)
      console.log('  ✅ Group deleted')
    }
  }
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
    // First, deactivate any active periods
    const allPeriods = await this.getPeriods()
    for (const p of allPeriods.filter(p => p.isActive)) {
      await this.updatePeriod(p.id, { isActive: false })
    }
    
    const newPeriod: Period = {
      ...period,
      id: this.generateId(),
      isActive: true
    }
    
    const cleanedPeriod = this.cleanData(newPeriod)
    const periodRef = ref(this.db, `periods/${newPeriod.id}`)
    await set(periodRef, cleanedPeriod)
    
    return newPeriod
  }
  
  async getPeriods(): Promise<Period[]> {
    const periodsRef = ref(this.db, 'periods')
    const snapshot = await get(periodsRef)
    const data = snapshot.val()
    
    if (!data) return []
    
    return Object.values(data).map((p: any) => ({
      ...p,
      start: new Date(p.start),
      end: new Date(p.end),
      archivedAt: p.archivedAt ? new Date(p.archivedAt) : undefined
    }))
  }
  
  async getActivePeriod(): Promise<Period | null> {
    const periods = await this.getPeriods()
    return periods.find(p => p.isActive) || null
  }
  
  async updatePeriod(id: string, updates: UpdatePeriod): Promise<void> {
    const periodRef = ref(this.db, `periods/${id}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(periodRef, cleanedUpdates)
  }
  
  async archivePeriod(id: string): Promise<void> {
    await this.updatePeriod(id, {
      isActive: false,
      archivedAt: new Date()
    })
  }
  
  // ✅ ADDED: Missing method from interface
  async endPeriod(id: string, finalBalances: Record<string, number>, finalStats: any): Promise<void> {
    // Update the period with finalBalances only (as per the Period type)
    await this.updatePeriod(id, {
      isActive: false,
      archivedAt: new Date(),
      finalBalances
    })
    
    // Store finalStats separately in Firebase if needed
    if (finalStats) {
      const statsRef = ref(this.db, `periods/${id}/finalStats`)
      await set(statsRef, this.cleanData(finalStats))
    }
  }
  
  subscribeToPeriods(callback: (periods: Period[]) => void): () => void {
    const periodsRef = ref(this.db, 'periods')
    const unsubscribe = onValue(periodsRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        callback([])
        return
      }
      
      const periods = Object.values(data).map((p: any) => ({
        ...p,
        start: new Date(p.start),
        end: new Date(p.end),
        archivedAt: p.archivedAt ? new Date(p.archivedAt) : undefined
      }))
      
      callback(periods)
    })
    return unsubscribe
  }
  
  // ==================== SETTINGS ====================
  
  async getSettings(): Promise<AppSettings> {
    const settingsRef = ref(this.db, 'settings')
    const snapshot = await get(settingsRef)
    
    if (snapshot.exists()) {
      return snapshot.val()
    }
    
    // Return default settings if none exist
    const defaultSettings: AppSettings = {
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
    
    // Save default settings
    await set(settingsRef, defaultSettings)
    return defaultSettings
  }
  
  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    const settingsRef = ref(this.db, 'settings')
    const cleanedUpdates = this.cleanData(updates)
    await update(settingsRef, cleanedUpdates)
  }
  
  async updateAutoAssignSettings(settings: Partial<AutoAssignSettings>): Promise<void> {
    const autoAssignRef = ref(this.db, 'settings/autoAssign')
    const cleanedSettings = this.cleanData(settings)
    await update(autoAssignRef, cleanedSettings)
  }
  
  async updateLoadSchedulingSettings(settings: Partial<LoadSchedulingSettings>): Promise<void> {
    const loadSchedulingRef = ref(this.db, 'settings/loadScheduling')
    const cleanedSettings = this.cleanData(settings)
    await update(loadSchedulingRef, cleanedSettings)
  }
  
  async updateDarkMode(enabled: boolean): Promise<void> {
    const darkModeRef = ref(this.db, 'settings/darkMode')
    await set(darkModeRef, enabled)
  }
  
  subscribeToSettings(callback: (settings: AppSettings) => void): () => void {
    const settingsRef = ref(this.db, 'settings')
    const unsubscribe = onValue(settingsRef, async (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val())
      } else {
        // Create default settings if they don't exist
        const defaultSettings: AppSettings = {
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
        await set(settingsRef, defaultSettings)
        callback(defaultSettings)
      }
    })
    return unsubscribe
  }
  
  subscribeToAutoAssignSettings(callback: (settings: AutoAssignSettings) => void): () => void {
    const autoAssignRef = ref(this.db, 'settings/autoAssign')
    const unsubscribe = onValue(autoAssignRef, async (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val())
      } else {
        // Create default auto-assign settings if they don't exist
        const defaultSettings: AutoAssignSettings = {
          enabled: false,
          delay: 5,
          skipRequests: true,
          batchMode: false,
          batchSize: 3
        }
        await set(autoAssignRef, defaultSettings)
        callback(defaultSettings)
      }
    })
    return unsubscribe
  }
  
  subscribeToLoadSchedulingSettings(callback: (settings: LoadSchedulingSettings) => void): () => void {
    const loadSchedulingRef = ref(this.db, 'settings/loadScheduling')
    const unsubscribe = onValue(loadSchedulingRef, async (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val())
      } else {
        // Create default load scheduling settings if they don't exist
        const defaultSettings: LoadSchedulingSettings = {
          minutesBetweenLoads: 20,
          instructorCycleTime: 40,
          defaultPlaneCapacity: 18
        }
        await set(loadSchedulingRef, defaultSettings)
        callback(defaultSettings)
      }
    })
    return unsubscribe
  }
  
  async getAutoAssignSettings(): Promise<AutoAssignSettings> {
    const settings = await this.getSettings()
    return settings.autoAssign
  }
  
  async getDarkMode(): Promise<boolean> {
    const settings = await this.getSettings()
    return settings.darkMode
  }
  
  // Legacy/convenience methods for backwards compatibility
  async getLoadSchedulingSettings(): Promise<LoadSchedulingSettings> {
    const settings = await this.getSettings()
    return settings.loadScheduling
  }
  
  // ✅ ADDED: Missing method from interface
  async saveLoadSchedulingSettings(settings: LoadSchedulingSettings): Promise<void> {
    await this.updateLoadSchedulingSettings(settings)
  }
  
  // ==================== BULK OPERATIONS ====================
  
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
          studentQueue: data.queue ? Object.values(data.queue) : [],
          studentAccounts: data.studentAccounts ? Object.values(data.studentAccounts) : [],
          groups: data.groups ? Object.values(data.groups) : [],
          loads: data.loads ? Object.values(data.loads) : [],
          clockEvents: data.clockEvents ? Object.values(data.clockEvents) : [],
          periods: data.periods ? Object.values(data.periods).map((p: any) => ({
            ...p,
            start: new Date(p.start),
            end: new Date(p.end),
            archivedAt: p.archivedAt ? new Date(p.archivedAt) : undefined
          })) : []
        })
      } else {
        callback({
          instructors: [],
          assignments: [],
          studentQueue: [],
          studentAccounts: [],
          groups: [],
          loads: [],
          clockEvents: [],
          periods: []
        })
      }
    })
    return unsubscribe
  }
}