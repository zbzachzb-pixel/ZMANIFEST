// src/hooks/useDatabase.ts - COMPLETE FIXED VERSION
// ✅ Issue #3 Fixed: Proper unsubscribe with dependencies
// ✅ Issue #10 Fixed: Error handling for Firebase subscription failures

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/services'
import type {
  Instructor,
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
} from '@/types'

interface UseDataResult<T> {
  data: T[]
  loading: boolean
  error: Error | null  // ✅ Added error to return type
  refresh: () => void
}

// ✅ FIXED Issue #3 & #10: Proper error handling and dependencies
function useRealtimeData<T>(
  subscriber: (callback: (data: T[]) => void) => () => void
): UseDataResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)  // ✅ Added error state
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    
    try {
      const unsubscribe = subscriber((data) => {
        setData(data)
        setLoading(false)
      })

      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe()
        }
      }
    } catch (err) {
      setError(err as Error)
      setLoading(false)
      console.error('Firebase subscription error:', err)
    }
  }, [subscriber, refreshKey])  // ✅ Added subscriber to dependencies

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return { data, loading, error, refresh }  // ✅ Return error
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

// ==================== LOADS ====================

export function useLoads() {
  return useRealtimeData<Load>(db.subscribeToLoads)
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

// ==================== CLOCK EVENTS ====================

export function useClockEvents() {
  return useRealtimeData<ClockEvent>(db.subscribeToClockEvents)
}

export function useLogClockEvent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const logEvent = useCallback(async (instructorId: string, instructorName: string, type: 'in' | 'out') => {
    setLoading(true)
    setError(null)
    try {
      const newEvent = await db.logClockEvent(instructorId, instructorName, type)
      return newEvent
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { logEvent, loading, error }
}

// ==================== PERIODS ====================

export function usePeriods() {
  return useRealtimeData<Period>(db.subscribeToPeriods)
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