// src/hooks/useDatabase.ts - COMPLETE WITH MEMORY LEAK FIX
// ✅ FIXED: Added mounted flag to prevent state updates after unmount
// ✅ OPTIMIZED: Added date-filtered subscriptions for assignments and loads

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type {
  Instructor,
  Aircraft,
  CreateAircraft,
  UpdateAircraft,
  Load,
  Assignment,
  QueueStudent,
  Group,
  ClockEvent,
  Period,
  CreateInstructor,
  CreateLoad,
  CreateAssignment,
  CreateQueueStudent,
  CreatePeriod,
  StudentAccount,
  CreateStudentAccount,
  UpdateStudentAccount,
  AppSettings,
  AutoAssignSettings,
  LoadSchedulingSettings
} from '@/types'

interface UseDataResult<T> {
  data: T[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

interface UseSingleDataResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refresh: () => void
}

// ✅ BUG FIX #5: Memory leak prevention with mounted flag
function useRealtimeData<T>(
  subscriber: (callback: (data: T[]) => void) => () => void
): UseDataResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true // Track if component is still mounted
    setLoading(true)
    setError(null)

    try {
      const unsubscribe = subscriber((data) => {
        if (mounted) { // Only update state if still mounted
          setData(data)
          setLoading(false)
        }
      })

      return () => {
        mounted = false // Prevent state updates after unmount
        if (typeof unsubscribe === 'function') {
          unsubscribe()
          console.log('✅ Firebase subscription cleaned up')
        }
      }
    } catch (err) {
      if (mounted) {
        setError(err as Error)
        setLoading(false)
      }
      console.error('Firebase subscription error:', err)
      return undefined
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return { data, loading, error, refresh }
}

// ✅ BUG FIX #5: Also fix for single data subscriptions
function useRealtimeSingleData<T>(
  subscriber: (callback: (data: T) => void) => () => void
): UseSingleDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true // Track if component is still mounted
    setLoading(true)
    setError(null)
    
    try {
      const unsubscribe = subscriber((data) => {
        if (mounted) { // Only update state if still mounted
          setData(data)
          setLoading(false)
        }
      })

      return () => {
        mounted = false // Prevent state updates after unmount
        if (typeof unsubscribe === 'function') {
          unsubscribe()
          console.log('✅ Firebase single data subscription cleaned up')
        }
      }
    } catch (err) {
      if (mounted) {
        setError(err as Error)
        setLoading(false)
      }
      console.error('Firebase subscription error:', err)
      return undefined
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return { data, loading, error, refresh }
}

// ==================== INSTRUCTORS ====================

export function useInstructors() {
  return useRealtimeData<Instructor>(db.subscribeToInstructors)
}

export function useActiveInstructors() {
  const { data: allInstructors, loading, error, refresh } = useInstructors()
  const activeInstructors = allInstructors.filter(i => !i.archived)
  return { data: activeInstructors, loading, error, refresh }
}

export function useClockedInInstructors() {
  const { data: activeInstructors, loading, error, refresh } = useActiveInstructors()
  const clockedIn = activeInstructors.filter(i => i.clockedIn)
  return { data: clockedIn, loading, error, refresh }
}

export function useCreateInstructor() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (instructor: CreateInstructor) => {
    setLoading(true)
    setError(null)
    try {
      const newInstructor = await db.createInstructor(instructor)
      return newInstructor
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdateInstructor() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (id: string, updates: Partial<Instructor>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateInstructor(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

// ==================== AIRCRAFT ====================

export function useAircraft() {
  return useRealtimeData<Aircraft>(db.subscribeToAircraft)
}

export function useActiveAircraft() {
  const { data: allAircraft, loading, error, refresh } = useAircraft()
  const activeAircraft = allAircraft.filter(a => a.isActive)
  return { data: activeAircraft, loading, error, refresh }
}

export function useCreateAircraft() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (aircraft: CreateAircraft) => {
    setLoading(true)
    setError(null)
    try {
      const newAircraftId = await db.createAircraft(aircraft)
      return newAircraftId
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdateAircraft() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (id: string, updates: UpdateAircraft) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateAircraft(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

export function useDeleteAircraft() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const remove = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deleteAircraft(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { remove, loading, error }
}

export function useDeactivateAircraft() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deactivate = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deactivateAircraft(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { deactivate, loading, error }
}

export function useReactivateAircraft() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reactivate = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.reactivateAircraft(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { reactivate, loading, error }
}

// ==================== STUDENT ACCOUNTS ====================

export function useStudentAccounts() {
  return useRealtimeData<StudentAccount>(db.subscribeToStudentAccounts)
}

export function useActiveStudentAccounts() {
  const { data: allAccounts, loading, error, refresh } = useStudentAccounts()
  const activeAccounts = allAccounts.filter(account => account.isActive)
  return { data: activeAccounts, loading, error, refresh }
}

export function useCreateStudentAccount() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (account: CreateStudentAccount) => {
    setLoading(true)
    setError(null)
    try {
      const newAccount = await db.createStudentAccount(account)
      return newAccount
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdateStudentAccount() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (id: string, updates: UpdateStudentAccount) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateStudentAccount(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

// ==================== CLOCK EVENTS ====================

export function useClockEvents() {
  return useRealtimeData<ClockEvent>(db.subscribeToClockEvents)
}

export function useLogClockEvent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const log = useCallback(async (instructorId: string, instructorName: string, type: 'in' | 'out') => {
    setLoading(true)
    setError(null)
    try {
      const event = await db.logClockEvent(instructorId, instructorName, type)
      return event
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { log, loading, error }
}

export function useUpdateClockEvent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (id: string, updates: Partial<ClockEvent>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateClockEvent(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

export function useDeleteClockEvent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteEvent = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deleteClockEvent(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { deleteEvent, loading, error }
}

// ==================== LOADS ====================

export function useLoads() {
  return useRealtimeData<Load>(db.subscribeToLoads)
}

// ✅ OPTIMIZED: Only fetches active loads (excludes old completed loads)
// ✅ POSITION COMPUTATION: Renumbers building loads automatically
export function useActiveLoads(daysToKeep: number = 7) {
  const [data, setData] = useState<Load[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    let unsubscribe: (() => void) | undefined
    let previousLoadIds: Set<string> | null = null

    setLoading(true)
    setError(null)

    try {
      unsubscribe = db.subscribeToActiveLoads(daysToKeep, (loads) => {
        if (mounted) {
          const { computeBuildingLoadPositions } = require('@/lib/loadUtils')

          // Track load IDs to detect deletions
          const currentLoadIds = new Set(loads.map(l => l.id))

          // Check if this is a deletion (load count decreased)
          const isDeletion = previousLoadIds !== null && currentLoadIds.size < previousLoadIds.size

          // ✅ FIX: Only recompute positions if a deletion occurred
          // Otherwise, pass loads through unchanged to preserve positions on status changes
          const loadsWithComputedPositions = isDeletion
            ? computeBuildingLoadPositions(loads)
            : loads

          previousLoadIds = currentLoadIds
          setData(loadsWithComputedPositions)
          setLoading(false)
        }
      })
    } catch (err) {
      if (mounted) {
        setError(err as Error)
        setLoading(false)
      }
    }

    // Always return cleanup function
    return () => {
      mounted = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [daysToKeep, refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return { data, loading, error, refresh }
}

export function useLoadsByStatus(status: Load['status']) {
  const { data: allLoads, loading, error, refresh } = useLoads()
  const filteredLoads = allLoads.filter(load => load.status === status)
  return { data: filteredLoads, loading, error, refresh }
}

export function useCreateLoad() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (load: CreateLoad) => {
    setLoading(true)
    setError(null)
    try {
      const newLoad = await db.createLoad(load)
      return newLoad
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdateLoad() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (id: string, updates: Partial<Load>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateLoad(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

export function useDeleteLoad() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteLoad = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deleteLoad(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { deleteLoad, loading, error }
}

// ==================== ASSIGNMENTS ====================

export function useAssignments() {
  return useRealtimeData<Assignment>(db.subscribeToAssignments)
}

// ✅ OPTIMIZED: Only fetches assignments within date range (e.g., current period)
export function useAssignmentsByDateRange(startDate: Date, endDate: Date) {
  return useRealtimeData<Assignment>((callback) =>
    db.subscribeToAssignmentsByDateRange(startDate, endDate, callback)
  )
}

// ✅ OPTIMIZED: Fetches current period assignments only
export function useCurrentPeriodAssignments() {
  const period = getCurrentPeriod()
  return useAssignmentsByDateRange(period.start, period.end)
}

export function useCreateAssignment() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (assignment: CreateAssignment) => {
    setLoading(true)
    setError(null)
    try {
      const newAssignment = await db.createAssignment(assignment)
      return newAssignment
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdateAssignment() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateAssignment = useCallback(async (id: string, updates: Partial<Assignment>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateAssignment(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { updateAssignment, loading, error }
}

export function useDeleteAssignment() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteAssignment = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deleteAssignment(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { deleteAssignment, loading, error }
}

// ==================== QUEUE ====================

export function useQueue() {
  return useRealtimeData<QueueStudent>(db.subscribeToQueue)
}

export function useTandemQueue() {
  const { data: allQueue, loading, error, refresh } = useQueue()
  const tandemQueue = allQueue.filter(s => s.jumpType === 'tandem')
  return { data: tandemQueue, loading, error, refresh }
}

export function useAFFQueue() {
  const { data: allQueue, loading, error, refresh } = useQueue()
  const affQueue = allQueue.filter(s => s.jumpType === 'aff')
  return { data: affQueue, loading, error, refresh }
}

export function useAddToQueue() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const add = useCallback(async (student: CreateQueueStudent, customTimestamp?: string) => {
    setLoading(true)
    setError(null)
    try {
      const newStudent = await db.addToQueue(student, customTimestamp)
      return newStudent
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { add, loading, error }
}

export function useRemoveFromQueue() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const remove = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.removeFromQueue(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { remove, loading, error }
}

export function useRemoveMultipleFromQueue() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const removeMultiple = useCallback(async (ids: string[]) => {
    setLoading(true)
    setError(null)
    try {
      await db.removeMultipleFromQueue(ids)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { removeMultiple, loading, error }
}

// ==================== GROUPS ====================

export function useGroups() {
  return useRealtimeData<Group>(db.subscribeToGroups)
}

export function useCreateGroup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (name: string, studentIds: string[]) => {
    setLoading(true)
    setError(null)
    try {
      const newGroup = await db.createGroup(name, studentIds)
      return newGroup
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdateGroup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (id: string, updates: Partial<Group>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateGroup(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

export function useDeleteGroup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deleteGroup = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deleteGroup(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { deleteGroup, loading, error }
}

export function useAddStudentToGroup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const addStudent = useCallback(async (groupId: string, studentId: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.addStudentToGroup(groupId, studentId)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { addStudent, loading, error }
}
export function useRemoveStudentFromGroup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const removeStudent = useCallback(async (groupId: string, studentAccountId: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.removeStudentFromGroup(groupId, studentAccountId)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { removeStudent, loading, error }
}

// ==================== PERIODS ====================

export function usePeriods() {
  return useRealtimeData<Period>(db.subscribeToPeriods)
}

export function useActivePeriod() {
  const { data: allPeriods, loading, error, refresh } = usePeriods()
  const activePeriod = allPeriods.find(p => p.isActive) || null
  return { data: activePeriod, loading, error, refresh }
}

export function useCreatePeriod() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (period: CreatePeriod) => {
    setLoading(true)
    setError(null)
    try {
      const newPeriod = await db.createPeriod(period)
      return newPeriod
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdatePeriod() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (id: string, updates: Partial<Period>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updatePeriod(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

// ==================== SETTINGS ====================

export function useSettings() {
  return useRealtimeSingleData<AppSettings>(db.subscribeToSettings)
}

export function useUpdateSettings() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const updateSettings = useCallback(async (settings: Partial<AppSettings>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateSettings(settings)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateAutoAssign = useCallback(async (settings: Partial<AutoAssignSettings>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateAutoAssignSettings(settings)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateLoadScheduling = useCallback(async (settings: Partial<LoadSchedulingSettings>) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateLoadSchedulingSettings(settings)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateDarkMode = useCallback(async (enabled: boolean) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateDarkMode(enabled)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { 
    updateSettings, 
    updateAutoAssign, 
    updateLoadScheduling, 
    updateDarkMode, 
    loading, 
    error 
  }
}