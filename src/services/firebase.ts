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
  runTransaction,
  query,
  orderByChild,
  startAt,
  endAt
} from 'firebase/database'
import type { DatabaseService } from './database'
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

// Helper type for raw Firebase Period data (dates are stored as ISO strings)
type FirebasePeriod = Omit<Period, 'start' | 'end' | 'archivedAt'> & {
  start: string
  end: string
  archivedAt?: string
}

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
    this.subscribeToUserProfiles = this.subscribeToUserProfiles.bind(this)
    this.subscribeToAircraft = this.subscribeToAircraft.bind(this)
    this.subscribeToSettings = this.subscribeToSettings.bind(this)
    this.subscribeToAll = this.subscribeToAll.bind(this)
  }
  
  private cleanData<T>(data: T): T {
    try {
      if (data === undefined || data === null) {
        return data
      }
      return JSON.parse(JSON.stringify(data))
    } catch (error) {
      console.error('Error cleaning data:', error, data)
      return data
    }
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

  // ==================== AIRCRAFT ====================

  async createAircraft(aircraft: CreateAircraft): Promise<string> {
    const aircraftService = await import('@/lib/aircraftService')
    return aircraftService.createAircraft(aircraft)
  }

  async getAllAircraft(): Promise<Aircraft[]> {
    const aircraftService = await import('@/lib/aircraftService')
    return aircraftService.getAllAircraft()
  }

  async getActiveAircraft(): Promise<Aircraft[]> {
    const aircraftService = await import('@/lib/aircraftService')
    return aircraftService.getActiveAircraft()
  }

  async getAircraftById(id: string): Promise<Aircraft | null> {
    const aircraftService = await import('@/lib/aircraftService')
    return aircraftService.getAircraftById(id)
  }

  async updateAircraft(id: string, updates: UpdateAircraft): Promise<void> {
    const aircraftService = await import('@/lib/aircraftService')
    return aircraftService.updateAircraft(id, updates)
  }

  async deactivateAircraft(id: string): Promise<void> {
    const aircraftService = await import('@/lib/aircraftService')
    return aircraftService.deactivateAircraft(id)
  }

  async reactivateAircraft(id: string): Promise<void> {
    const aircraftService = await import('@/lib/aircraftService')
    return aircraftService.reactivateAircraft(id)
  }

  async deleteAircraft(id: string): Promise<void> {
    const aircraftService = await import('@/lib/aircraftService')
    return aircraftService.deleteAircraft(id)
  }

  subscribeToAircraft(callback: (aircraft: Aircraft[]) => void): () => void {
    const aircraftRef = ref(this.db, 'aircraft')
    const unsubscribe = onValue(aircraftRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        callback([])
        return
      }

      const aircraft: Aircraft[] = Object.values(data)
      // Sort by order, then by name
      const sorted = aircraft.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order
        return a.name.localeCompare(b.name)
      })

      callback(sorted)
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
    const accountRef = ref(this.db, `studentAccounts/${studentAccountId}`)

    await runTransaction(accountRef, (currentData) => {
      if (!currentData) return currentData

      // Increment total jumps
      currentData.totalJumps = (currentData.totalJumps || 0) + 1
      currentData.lastJumpDate = new Date().toISOString()

      // Increment jump type specific count
      if (jumpType === 'tandem') {
        currentData.totalTandemJumps = (currentData.totalTandemJumps || 0) + 1
      } else if (jumpType === 'aff') {
        currentData.totalAFFJumps = (currentData.totalAFFJumps || 0) + 1
      }

      return currentData
    })
  }

  async decrementStudentJumpCount(studentAccountId: string, jumpType: 'tandem' | 'aff'): Promise<void> {
    const accountRef = ref(this.db, `studentAccounts/${studentAccountId}`)

    await runTransaction(accountRef, (currentData) => {
      if (!currentData) return currentData

      // Decrement total jumps (floor at 0 to prevent negative counts)
      currentData.totalJumps = Math.max(0, (currentData.totalJumps || 0) - 1)

      // Decrement jump type specific count (floor at 0)
      if (jumpType === 'tandem') {
        currentData.totalTandemJumps = Math.max(0, (currentData.totalTandemJumps || 0) - 1)
      } else if (jumpType === 'aff') {
        currentData.totalAFFJumps = Math.max(0, (currentData.totalAFFJumps || 0) - 1)
      }

      return currentData
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

  // ==================== USER PROFILES ====================

  async getUserProfiles(): Promise<UserProfile[]> {
    return this.getData<UserProfile>('users')
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = ref(this.db, `users/${uid}`)
    const snapshot = await get(userRef)
    return snapshot.exists() ? snapshot.val() : null
  }

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const userRef = ref(this.db, `users/${uid}`)
    const cleanedUpdates = this.cleanData(updates)
    await update(userRef, cleanedUpdates)
  }

  async deleteUserProfile(uid: string): Promise<void> {
    const userRef = ref(this.db, `users/${uid}`)
    await remove(userRef)
  }

  subscribeToUserProfiles(callback: (users: UserProfile[]) => void): () => void {
    const usersRef = ref(this.db, 'users')
    const unsubscribe = onValue(usersRef, (snapshot) => {
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
          for (const [_instructorId, uses] of instructorUsage) {
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

  // ✅ OPTIMIZED: Subscribe to active loads only (excludes old completed loads)
  subscribeToActiveLoads(
    daysToKeep: number = 7,
    callback: (loads: Load[]) => void
  ): () => void {
    const loadsRef = ref(this.db, 'loads')
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const unsubscribe = onValue(loadsRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        callback([])
        return
      }

      // Filter client-side: include non-completed OR recently completed loads
      const loads: Load[] = Object.values(data)
      const activeLoads = loads.filter(load => {
        if (load.status !== 'completed') return true // Keep all non-completed

        // For completed loads, only keep recent ones
        if (load.completedAt) {
          const completedDate = new Date(load.completedAt)
          return completedDate >= cutoffDate
        }

        return false // Exclude old completed loads without timestamp
      })

      callback(activeLoads)
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

  async getAssignmentsByLoadId(loadId: string): Promise<Assignment[]> {
    const allAssignments = await this.getAssignments()
    return allAssignments.filter(a => a.loadId === loadId)
  }

  async softDeleteAssignment(id: string, reason: 'load_reverted' | 'manual_delete'): Promise<void> {
    const assignmentRef = ref(this.db, `assignments/${id}`)
    await update(assignmentRef, {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedReason: reason
    })
  }

  subscribeToAssignments(callback: (assignments: Assignment[]) => void): () => void {
    const assignmentsRef = ref(this.db, 'assignments')
    const unsubscribe = onValue(assignmentsRef, (snapshot) => {
      const data = snapshot.val()
      callback(data ? Object.values(data) : [])
    })
    return unsubscribe
  }

  // ✅ OPTIMIZED: Subscribe to assignments filtered by date range
  subscribeToAssignmentsByDateRange(
    startDate: Date,
    endDate: Date,
    callback: (assignments: Assignment[]) => void
  ): () => void {
    const assignmentsRef = ref(this.db, 'assignments')

    // Firebase query: order by timestamp, filter by date range
    const assignmentsQuery = query(
      assignmentsRef,
      orderByChild('timestamp'),
      startAt(startDate.toISOString()),
      endAt(endDate.toISOString())
    )

    const unsubscribe = onValue(assignmentsQuery, (snapshot) => {
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
    const updates: Record<string, null> = {}
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
  const updates: Record<string, string> = {}

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

  // ✅ OPTIMIZED: Fetch group and queue in parallel
  const [groupSnapshot, queue] = await Promise.all([
    get(ref(this.db, `groups/${id}`)),
    this.getQueue()
  ])

  if (!groupSnapshot.exists()) {
    console.log('  ⚠️ Group not found')
    return
  }

  const group = groupSnapshot.val()
  console.log('  Group studentAccountIds:', group.studentAccountIds)

  // Build batch updates for queue students + group deletion
  const updates: Record<string, null> = {}

  // Clear groupId from matching students
  for (const student of queue) {
    if (group.studentAccountIds.includes(student.studentAccountId)) {
      updates[`queue/${student.id}/groupId`] = null
      console.log(`  ✅ Clearing groupId from student account ${student.studentAccountId}`)
    }
  }

  // Delete the group itself
  updates[`groups/${id}`] = null

  // ✅ Single batched update for everything
  const rootRef = ref(this.db)
  await update(rootRef, updates)
  console.log('✅ Group deleted and students ungrouped')
}

async addStudentToGroup(groupId: string, studentAccountId: string): Promise<void> {
  console.log('➕ Adding student to group:', { groupId, studentAccountId })

  // Get queue to find student
  const queue = await this.getQueue()
  const student = queue.find(s => s.studentAccountId === studentAccountId)

  // Use transaction to atomically update group
  const groupRef = ref(this.db, `groups/${groupId}`)
  await runTransaction(groupRef, (currentGroup) => {
    if (!currentGroup) {
      console.log('  ⚠️ Group not found')
      return currentGroup
    }

    // Add student to group if not already present
    const studentAccountIds = currentGroup.studentAccountIds || []
    if (!studentAccountIds.includes(studentAccountId)) {
      currentGroup.studentAccountIds = [...studentAccountIds, studentAccountId]
    }

    return currentGroup
  })

  // After group update succeeds, update queue student's groupId
  if (student) {
    await update(ref(this.db, `queue/${student.id}`), { groupId })
    console.log('  ✅ Set groupId for queue student:', student.id)
  } else {
    console.log('  ⚠️ Student not found in queue')
  }

  console.log('✅ Student added to group')
}

async removeStudentFromGroup(groupId: string, studentAccountId: string): Promise<void> {
  console.log('➖ Removing student from group:', { groupId, studentAccountId })

  // Get queue to find students
  const queue = await this.getQueue()
  const student = queue.find(s => s.studentAccountId === studentAccountId)

  // Use transaction to atomically update/delete group
  const groupRef = ref(this.db, `groups/${groupId}`)
  let shouldDeleteGroup = false
  let remainingStudentIds: string[] = []

  await runTransaction(groupRef, (currentGroup) => {
    if (!currentGroup) {
      console.log('  ⚠️ Group not found')
      return currentGroup
    }

    // Remove student from group
    const updatedStudentAccountIds = (currentGroup.studentAccountIds || [])
      .filter((id: string) => id !== studentAccountId)

    // If group will have ≤1 students, mark for deletion
    if (updatedStudentAccountIds.length <= 1) {
      console.log('⚠️ Group has ≤1 student after removal, deleting group')
      shouldDeleteGroup = true
      remainingStudentIds = updatedStudentAccountIds
      return null // Delete the group
    }

    // Group will still have 2+ students, update it
    currentGroup.studentAccountIds = updatedStudentAccountIds
    return currentGroup
  })

  // After group transaction, update queue students
  const updates: Record<string, any> = {}

  // Clear groupId from removed student
  if (student) {
    updates[`queue/${student.id}/groupId`] = null
  }

  // If group was deleted, clear groupId from remaining student
  if (shouldDeleteGroup && remainingStudentIds.length === 1) {
    const remaining = queue.find(s => s.studentAccountId === remainingStudentIds[0])
    if (remaining) {
      updates[`queue/${remaining.id}/groupId`] = null
      console.log(`  ✅ Clearing groupId from remaining student ${remaining.studentAccountId}`)
    }
  }

  // Apply queue updates
  if (Object.keys(updates).length > 0) {
    const rootRef = ref(this.db)
    await update(rootRef, updates)
  }

  console.log('✅ Student removed from group')
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
    // ✅ OPTIMIZED: Batch deactivate all active periods in single update
    const periodsRef = ref(this.db, 'periods')
    const snapshot = await get(periodsRef)
    const data = snapshot.val()

    // Build batch updates for deactivating active periods
    const updates: Record<string, boolean> = {}
    if (data) {
      Object.entries(data).forEach(([id, p]: [string, any]) => {
        if (p.isActive) {
          updates[`periods/${id}/isActive`] = false
        }
      })
    }

    // Create new period
    const newPeriod: Period = {
      ...period,
      id: this.generateId(),
      isActive: true
    }

    const cleanedPeriod = this.cleanData(newPeriod)
    updates[`periods/${newPeriod.id}`] = cleanedPeriod as any

    // Single batched update for all changes
    const rootRef = ref(this.db)
    await update(rootRef, updates)

    return newPeriod
  }
  
  async getPeriods(): Promise<Period[]> {
    const periodsRef = ref(this.db, 'periods')
    const snapshot = await get(periodsRef)
    const data = snapshot.val()
    
    if (!data) return []

    return (Object.values(data) as FirebasePeriod[]).map((p) => ({
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
  async endPeriod(id: string, finalBalances: Record<string, number>, finalStats: PeriodStats): Promise<void> {
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

      const periods = (Object.values(data) as FirebasePeriod[]).map((p) => ({
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
      aircraft,
      clockEvents,
      periods
    ] = await Promise.all([
      this.getInstructors(),
      this.getAssignments(),
      this.getQueue(),
      this.getStudentAccounts(),
      this.getGroups(),
      this.getLoads(),
      this.getAllAircraft(),
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
      aircraft,
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
          aircraft: data.aircraft ? Object.values(data.aircraft) : [],
          clockEvents: data.clockEvents ? Object.values(data.clockEvents) : [],
          periods: data.periods ? (Object.values(data.periods) as FirebasePeriod[]).map((p) => ({
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
          aircraft: [],
          clockEvents: [],
          periods: []
        })
      }
    })
    return unsubscribe
  }
}