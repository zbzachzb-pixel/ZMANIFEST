// src/hooks/useDatabaseWithToasts.ts
// ✅ NEW FILE: Enhanced database hooks with built-in toast notifications
// This wraps the base hooks to add user feedback for all operations

import { useState, useCallback } from 'react'
import { db } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type {
  CreateInstructor,
  UpdateInstructor,
  CreateAssignment,
  CreateQueueStudent,
  CreateLoad,
  UpdateLoad,
  CreateStudentAccount,
  UpdateStudentAccount,
  CreatePeriod,
  PeriodStats
} from '@/types'

// ==================== INSTRUCTORS ====================

export function useCreateInstructorWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const create = useCallback(async (instructor: CreateInstructor) => {
    setLoading(true)
    try {
      const result = await toast.promise(
        db.createInstructor(instructor),
        {
          loading: 'Creating instructor...',
          success: `✅ ${instructor.name} added to team!`,
          error: 'Failed to create instructor'
        }
      )
      return result
    } catch (error) {
      console.error('Create instructor error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { create, loading }
}

export function useUpdateInstructorWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const update = useCallback(async (id: string, updates: UpdateInstructor) => {
    setLoading(true)
    try {
      await toast.promise(
        db.updateInstructor(id, updates),
        {
          loading: 'Updating instructor...',
          success: '✅ Instructor updated!',
          error: 'Failed to update instructor'
        }
      )
    } catch (error) {
      console.error('Update instructor error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { update, loading }
}

export function useClockInWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const clockIn = useCallback(async (instructorId: string, instructorName: string) => {
    setLoading(true)
    try {
      await toast.promise(
        db.updateInstructor(instructorId, { clockedIn: true, clockInTime: new Date().toISOString() }),
        {
          loading: `Clocking in ${instructorName}...`,
          success: `✅ ${instructorName} clocked in!`,
          error: `Failed to clock in ${instructorName}`
        }
      )
      await db.logClockEvent(instructorId, instructorName, 'in')
    } catch (error) {
      console.error('Clock in error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  const clockOut = useCallback(async (instructorId: string, instructorName: string) => {
    setLoading(true)
    try {
      await toast.promise(
        db.updateInstructor(instructorId, { clockedIn: false, clockInTime: null }),
        {
          loading: `Clocking out ${instructorName}...`,
          success: `✅ ${instructorName} clocked out!`,
          error: `Failed to clock out ${instructorName}`
        }
      )
      await db.logClockEvent(instructorId, instructorName, 'out')
    } catch (error) {
      console.error('Clock out error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { clockIn, clockOut, loading }
}

// ==================== ASSIGNMENTS ====================

export function useCreateAssignmentWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const create = useCallback(async (assignment: CreateAssignment) => {
    setLoading(true)
    try {
      const result = await toast.promise(
        db.createAssignment(assignment),
        {
          loading: 'Adding assignment...',
          success: `✅ ${assignment.studentName} assigned to ${assignment.instructorName}!`,
          error: 'Failed to create assignment'
        }
      )
      return result
    } catch (error) {
      console.error('Create assignment error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { create, loading }
}

export function useDeleteAssignmentWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const deleteAssignment = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await toast.promise(
        db.deleteAssignment(id),
        {
          loading: 'Deleting assignment...',
          success: '✅ Assignment deleted!',
          error: 'Failed to delete assignment'
        }
      )
    } catch (error) {
      console.error('Delete assignment error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { deleteAssignment, loading }
}

// ==================== QUEUE ====================

export function useAddToQueueWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const addToQueue = useCallback(async (student: CreateQueueStudent) => {
    setLoading(true)
    try {
      const result = await toast.promise(
        db.addToQueue(student),
        {
          loading: 'Adding to queue...',
          success: `✅ ${student.name} added to ${student.jumpType.toUpperCase()} queue!`,
          error: 'Failed to add to queue'
        }
      )
      return result
    } catch (error) {
      console.error('Add to queue error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { addToQueue, loading }
}

export function useRemoveFromQueueWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const removeFromQueue = useCallback(async (id: string, studentName: string) => {
    setLoading(true)
    try {
      await toast.promise(
        db.removeFromQueue(id),
        {
          loading: 'Removing from queue...',
          success: `✅ ${studentName} removed from queue`,
          error: 'Failed to remove from queue'
        }
      )
    } catch (error) {
      console.error('Remove from queue error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  const removeMultiple = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    
    setLoading(true)
    try {
      await toast.promise(
        db.removeMultipleFromQueue(ids),
        {
          loading: `Removing ${ids.length} students from queue...`,
          success: `✅ Removed ${ids.length} students from queue`,
          error: 'Failed to remove students'
        }
      )
    } catch (error) {
      console.error('Remove multiple error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { removeFromQueue, removeMultiple, loading }
}

// ==================== LOADS ====================

export function useCreateLoadWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const create = useCallback(async (load: CreateLoad) => {
    setLoading(true)
    try {
      const result = await toast.promise(
        db.createLoad(load),
        {
          loading: 'Creating load...',
          success: '✅ Load created!',
          error: 'Failed to create load'
        }
      )
      return result
    } catch (error) {
      console.error('Create load error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { create, loading }
}

export function useUpdateLoadWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const update = useCallback(async (id: string, updates: UpdateLoad, silent = false) => {
    setLoading(true)
    try {
      if (silent) {
        // Silent update (no toast) - used for frequent updates
        await db.updateLoad(id, updates)
      } else {
        await toast.promise(
          db.updateLoad(id, updates),
          {
            loading: 'Updating load...',
            success: '✅ Load updated!',
            error: 'Failed to update load'
          }
        )
      }
    } catch (error) {
      if (!silent) {
        console.error('Update load error:', error)
      }
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { update, loading }
}

export function useDeleteLoadWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const deleteLoad = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await toast.promise(
        db.deleteLoad(id),
        {
          loading: 'Deleting load...',
          success: '✅ Load deleted!',
          error: 'Failed to delete load'
        }
      )
    } catch (error) {
      console.error('Delete load error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { deleteLoad, loading }
}

// ==================== STUDENT ACCOUNTS ====================

export function useCreateStudentAccountWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const create = useCallback(async (account: CreateStudentAccount) => {
    setLoading(true)
    try {
      const result = await toast.promise(
        db.createStudentAccount(account),
        {
          loading: 'Creating student account...',
          success: `✅ ${account.name} account created!`,
          error: 'Failed to create student account'
        }
      )
      return result
    } catch (error) {
      console.error('Create student account error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { create, loading }
}

export function useUpdateStudentAccountWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const update = useCallback(async (id: string, updates: UpdateStudentAccount) => {
    setLoading(true)
    try {
      await toast.promise(
        db.updateStudentAccount(id, updates),
        {
          loading: 'Updating student...',
          success: '✅ Student updated!',
          error: 'Failed to update student'
        }
      )
    } catch (error) {
      console.error('Update student error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { update, loading }
}

// ==================== PERIODS ====================

export function useCreatePeriodWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const create = useCallback(async (period: CreatePeriod) => {
    setLoading(true)
    try {
      const result = await toast.promise(
        db.createPeriod(period),
        {
          loading: 'Creating period...',
          success: `✅ Period "${period.name}" created!`,
          error: 'Failed to create period'
        }
      )
      return result
    } catch (error) {
      console.error('Create period error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { create, loading }
}

export function useEndPeriodWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const endPeriod = useCallback(async (
    id: string,
    finalBalances: Record<string, number>,
    finalStats: PeriodStats
  ) => {
    setLoading(true)
    try {
      await toast.promise(
        db.endPeriod(id, finalBalances, finalStats),
        {
          loading: 'Ending period...',
          success: '✅ Period ended and archived!',
          error: 'Failed to end period'
        }
      )
    } catch (error) {
      console.error('End period error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { endPeriod, loading }
}

// ==================== GROUPS ====================

export function useCreateGroupWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const create = useCallback(async (name: string, studentAccountIds: string[]) => {
    setLoading(true)
    try {
      const result = await toast.promise(
        db.createGroup(name, studentAccountIds),
        {
          loading: 'Creating group...',
          success: `✅ Group "${name}" created!`,
          error: 'Failed to create group'
        }
      )
      return result
    } catch (error) {
      console.error('Create group error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { create, loading }
}

export function useDeleteGroupWithToast() {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const deleteGroup = useCallback(async (id: string, groupName: string) => {
    setLoading(true)
    try {
      await toast.promise(
        db.deleteGroup(id),
        {
          loading: 'Deleting group...',
          success: `✅ Group "${groupName}" deleted`,
          error: 'Failed to delete group'
        }
      )
    } catch (error) {
      console.error('Delete group error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { deleteGroup, loading }
}