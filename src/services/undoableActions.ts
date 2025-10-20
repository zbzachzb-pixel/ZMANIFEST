// src/services/undoableActions.ts
// Reversible action wrappers for database operations

import { db } from './index'
import type { Load, CreateLoad, QueueStudent, CreateQueueStudent, Instructor } from '@/types'
import type { Action } from '@/contexts/ActionHistoryContext'

/**
 * Create a load with undo capability
 */
export async function createLoadUndoable(
  loadData: CreateLoad,
  onAction: (action: Omit<Action, 'id' | 'timestamp'>) => void
): Promise<Load> {
  const createdLoad = await db.createLoad(loadData)

  onAction({
    type: 'CREATE_LOAD',
    description: `Created load "${createdLoad.name}"`,
    data: { load: createdLoad },
    undo: async () => {
      await db.deleteLoad(createdLoad.id)
    },
    redo: async () => {
      await db.createLoad({
        ...loadData,
        id: createdLoad.id // Preserve ID for consistency
      } as any) // Type assertion needed
    }
  })

  return createdLoad
}

/**
 * Delete a load with undo capability
 */
export async function deleteLoadUndoable(
  load: Load,
  onAction: (action: Omit<Action, 'id' | 'timestamp'>) => void
): Promise<void> {
  const loadSnapshot = { ...load }

  await db.deleteLoad(load.id)

  onAction({
    type: 'DELETE_LOAD',
    description: `Deleted load "${load.name}"`,
    data: { load: loadSnapshot },
    undo: async () => {
      await db.createLoad(loadSnapshot as any) // Restore with same ID
    },
    redo: async () => {
      await db.deleteLoad(load.id)
    }
  })
}

/**
 * Update load status with undo capability
 */
export async function updateLoadStatusUndoable(
  loadId: string,
  newStatus: Load['status'],
  currentLoad: Load,
  additionalUpdates?: Partial<Load>,
  onAction?: (action: Omit<Action, 'id' | 'timestamp'>) => void
): Promise<void> {
  const oldStatus = currentLoad.status
  const updates = { status: newStatus, ...additionalUpdates }

  await db.updateLoad(loadId, updates)

  if (onAction) {
    onAction({
      type: 'UPDATE_LOAD_STATUS',
      description: `Changed "${currentLoad.name}" from ${oldStatus} to ${newStatus}`,
      data: { loadId, oldStatus, newStatus, load: currentLoad },
      undo: async () => {
        const revertUpdates: Partial<Load> = { status: oldStatus }

        // Revert specific fields based on status
        if (oldStatus === 'building') {
          revertUpdates.countdownStartTime = undefined
        }
        if (oldStatus !== 'completed') {
          revertUpdates.completedAt = undefined
        }

        await db.updateLoad(loadId, revertUpdates)
      },
      redo: async () => {
        await db.updateLoad(loadId, updates)
      }
    })
  }
}

/**
 * Add student to queue with undo capability
 */
export async function addToQueueUndoable(
  student: CreateQueueStudent,
  customTimestamp: string | undefined,
  onAction: (action: Omit<Action, 'id' | 'timestamp'>) => void
): Promise<QueueStudent> {
  const addedStudent = await db.addToQueue(student, customTimestamp)

  onAction({
    type: 'ADD_TO_QUEUE',
    description: `Added ${student.name} to queue`,
    data: { student: addedStudent },
    undo: async () => {
      await db.removeFromQueue(addedStudent.id)
    },
    redo: async () => {
      await db.addToQueue(student, addedStudent.timestamp)
    }
  })

  return addedStudent
}

/**
 * Remove student from queue with undo capability
 */
export async function removeFromQueueUndoable(
  student: QueueStudent,
  onAction: (action: Omit<Action, 'id' | 'timestamp'>) => void
): Promise<void> {
  const studentSnapshot = { ...student }

  await db.removeFromQueue(student.id)

  onAction({
    type: 'REMOVE_FROM_QUEUE',
    description: `Removed ${student.name} from queue`,
    data: { student: studentSnapshot },
    undo: async () => {
      await db.addToQueue({
        studentAccountId: studentSnapshot.studentAccountId,
        name: studentSnapshot.name,
        weight: studentSnapshot.weight,
        jumpType: studentSnapshot.jumpType,
        isRequest: studentSnapshot.isRequest,
        tandemWeightTax: studentSnapshot.tandemWeightTax,
        tandemHandcam: studentSnapshot.tandemHandcam,
        outsideVideo: studentSnapshot.outsideVideo,
        affLevel: studentSnapshot.affLevel,
        groupId: studentSnapshot.groupId
      }, studentSnapshot.timestamp)
    },
    redo: async () => {
      await db.removeFromQueue(student.id)
    }
  })
}

/**
 * Update load assignments with undo capability
 */
export async function updateLoadAssignmentsUndoable(
  loadId: string,
  newAssignments: Load['assignments'],
  currentLoad: Load,
  description: string,
  onAction: (action: Omit<Action, 'id' | 'timestamp'>) => void
): Promise<void> {
  const oldAssignments = currentLoad.assignments || []

  await db.updateLoad(loadId, { assignments: newAssignments })

  onAction({
    type: 'UPDATE_LOAD_ASSIGNMENTS',
    description,
    data: { loadId, oldAssignments, newAssignments, load: currentLoad },
    undo: async () => {
      await db.updateLoad(loadId, { assignments: oldAssignments })
    },
    redo: async () => {
      await db.updateLoad(loadId, { assignments: newAssignments })
    }
  })
}

/**
 * Clock instructor in/out with undo capability
 */
export async function toggleInstructorClockUndoable(
  instructor: Instructor,
  onAction: (action: Omit<Action, 'id' | 'timestamp'>) => void
): Promise<void> {
  const wasClockedIn = instructor.clockedIn
  const newClockedIn = !wasClockedIn

  await db.updateInstructor(instructor.id, { clockedIn: newClockedIn })

  // Also log clock event
  const eventType = newClockedIn ? 'in' : 'out'
  await db.logClockEvent(instructor.id, instructor.name, eventType)

  onAction({
    type: 'TOGGLE_CLOCK',
    description: `Clocked ${instructor.name} ${newClockedIn ? 'in' : 'out'}`,
    data: { instructor, wasClockedIn, newClockedIn },
    undo: async () => {
      await db.updateInstructor(instructor.id, { clockedIn: wasClockedIn })
      // Note: We don't undo clock events for audit trail purposes
    },
    redo: async () => {
      await db.updateInstructor(instructor.id, { clockedIn: newClockedIn })
    }
  })
}

/**
 * Delay load with undo capability
 */
export async function delayLoadUndoable(
  loadId: string,
  minutesToDelay: number,
  currentLoad: Load,
  onAction: (action: Omit<Action, 'id' | 'timestamp'>) => void
): Promise<void> {
  const oldDelayMinutes = currentLoad.delayMinutes || 0
  const newDelayMinutes = oldDelayMinutes + minutesToDelay

  await db.updateLoad(loadId, { delayMinutes: newDelayMinutes })

  onAction({
    type: 'DELAY_LOAD',
    description: `Delayed "${currentLoad.name}" by ${minutesToDelay} minutes`,
    data: { loadId, oldDelayMinutes, newDelayMinutes, load: currentLoad },
    undo: async () => {
      await db.updateLoad(loadId, { delayMinutes: oldDelayMinutes })
    },
    redo: async () => {
      await db.updateLoad(loadId, { delayMinutes: newDelayMinutes })
    }
  })
}
