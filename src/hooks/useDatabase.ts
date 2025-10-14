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
  error: Error | null
  refresh: () => Promise<void>
}

function useRealtimeData<T>(
  subscribe: (callback: (data: T[]) => void) => () => void
): UseDataResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const unsubscribe = subscribe((newData) => {
      setData(newData)
      setLoading(false)
    })
    return unsubscribe
  }, [subscribe])

  const refresh = useCallback(async () => {
    setLoading(true)
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

  const add = useCallback(async (student: CreateQueueStudent) => {
    setLoading(true)
    setError(null)
    try {
      const newStudent = await db.addToQueue(student)
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

// ==================== PERIODS ====================

export function usePeriods() {
  return useRealtimeData<Period>(db.subscribeToPeriods)
}

export function useActivePeriod() {
  const { data: allPeriods, loading, error, refresh } = usePeriods()
  const activePeriod = allPeriods.find(p => p.status === 'active') || null
  return { data: activePeriod, loading, error, refresh }
}

export function useArchivedPeriods() {
  const { data: allPeriods, loading, error, refresh } = usePeriods()
  const archivedPeriods = allPeriods.filter(p => p.status === 'archived')
    .sort((a, b) => new Date(b.endedAt || b.end).getTime() - new Date(a.endedAt || a.end).getTime())
  return { data: archivedPeriods, loading, error, refresh }
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

export function useEndPeriod() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const endPeriod = useCallback(async (
    periodId: string,
    finalBalances: Record<string, number>,
    finalStats: any
  ) => {
    setLoading(true)
    setError(null)
    try {
      await db.endPeriod(periodId, finalBalances, finalStats)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { endPeriod, loading, error }
}