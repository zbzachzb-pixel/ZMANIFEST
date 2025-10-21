// src/lib/funJumperRequests.ts
// Service for managing fun jumper requests

import { ref, get, set, update, push, query, orderByChild, equalTo, remove, onValue } from 'firebase/database'
import { database } from './firebase'
import { NotificationService, getUserNotificationSettings } from './notifications'
import { sendPushNotification } from './pushNotifications'
import type {
  FunJumperRequest,
  CreateFunJumperRequest,
  FunJumper,
  Load,
  RequestHistoryEntry
} from '@/types'

// ==================== HELPER FUNCTIONS ====================

/**
 * Get current timestamp
 */
function now(): number {
  return Date.now()
}

/**
 * Create history entry
 */
function createHistoryEntry(
  action: RequestHistoryEntry['action'],
  actorId?: string,
  actorName?: string,
  note?: string,
  oldStatus?: string,
  newStatus?: string
): RequestHistoryEntry {
  const entry: any = {
    action,
    timestamp: now()
  }

  // Only add optional fields if they're defined
  if (actorId !== undefined) entry.actorId = actorId
  if (actorName !== undefined) entry.actorName = actorName
  if (note !== undefined) entry.note = note
  if (oldStatus !== undefined) entry.oldStatus = oldStatus
  if (newStatus !== undefined) entry.newStatus = newStatus

  return entry as RequestHistoryEntry
}

// ==================== SERVICE CLASS ====================

export class FunJumperRequestService {
  /**
   * Create a new fun jumper request
   */
  static async createRequest(
    data: CreateFunJumperRequest
  ): Promise<string> {
    try {
      const requestsRef = ref(database, 'funJumperRequests')
      const newRequestRef = push(requestsRef)

      const request: FunJumperRequest = {
        id: newRequestRef.key!,
        ...data,
        status: 'pending',
        cancellationRequested: false,
        createdAt: now(),
        updatedAt: now(),
        history: [
          createHistoryEntry(
            'created',
            data.userId,
            data.userName,
            'Request submitted'
          )
        ]
      }

      await set(newRequestRef, request)
      return newRequestRef.key!
    } catch (error) {
      console.error('Failed to create request:', error)
      throw new Error('Failed to create request')
    }
  }

  /**
   * Get a specific request by ID
   */
  static async getRequest(requestId: string): Promise<FunJumperRequest> {
    try {
      const requestRef = ref(database, `funJumperRequests/${requestId}`)
      const snapshot = await get(requestRef)

      if (!snapshot.exists()) {
        throw new Error('Request not found')
      }

      return snapshot.val() as FunJumperRequest
    } catch (error) {
      console.error('Failed to get request:', error)
      throw error
    }
  }

  /**
   * Get all requests with optional status filter
   */
  static async getRequests(status?: string): Promise<FunJumperRequest[]> {
    try {
      const requestsRef = ref(database, 'funJumperRequests')

      let requestsQuery
      if (status) {
        requestsQuery = query(requestsRef, orderByChild('status'), equalTo(status))
      } else {
        requestsQuery = requestsRef
      }

      const snapshot = await get(requestsQuery)

      if (!snapshot.exists()) {
        return []
      }

      const requests: FunJumperRequest[] = []
      snapshot.forEach(child => {
        requests.push(child.val() as FunJumperRequest)
      })

      // Sort by creation time (newest first)
      return requests.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('Failed to get requests:', error)
      throw new Error('Failed to get requests')
    }
  }

  /**
   * Get requests for a specific user
   */
  static async getUserRequests(userId: string): Promise<FunJumperRequest[]> {
    try {
      const requestsRef = ref(database, 'funJumperRequests')
      const userQuery = query(requestsRef, orderByChild('userId'), equalTo(userId))
      const snapshot = await get(userQuery)

      if (!snapshot.exists()) {
        return []
      }

      const requests: FunJumperRequest[] = []
      snapshot.forEach(child => {
        requests.push(child.val() as FunJumperRequest)
      })

      return requests.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('Failed to get user requests:', error)
      throw new Error('Failed to get user requests')
    }
  }

  /**
   * Get a specific load
   */
  static async getLoad(loadId: string): Promise<Load> {
    try {
      const loadRef = ref(database, `loads/${loadId}`)
      const snapshot = await get(loadRef)

      if (!snapshot.exists()) {
        throw new Error('Load not found')
      }

      return snapshot.val() as Load
    } catch (error) {
      console.error('Failed to get load:', error)
      throw error
    }
  }

  /**
   * Check if load has available capacity
   */
  static async checkLoadCapacity(loadId: string): Promise<boolean> {
    try {
      const load = await this.getLoad(loadId)

      const assignments = load.assignments || []
      const funJumpers = load.funJumpers || []
      const capacity = load.capacity || 18

      // Calculate total people on load
      const totalPeople = assignments.reduce((sum, assignment) => {
        let count = 2 // Student + Instructor
        if (assignment.hasOutsideVideo) count += 1 // + Video Instructor
        return sum + count
      }, 0) + funJumpers.length // + Fun Jumpers (1 slot each)

      return totalPeople < capacity
    } catch (error) {
      console.error('Failed to check load capacity:', error)
      throw error
    }
  }

  /**
   * Add fun jumper to load
   */
  static async addFunJumperToLoad(
    loadId: string,
    request: FunJumperRequest,
    addedBy: string,
    addedByName: string
  ): Promise<void> {
    try {
      const load = await this.getLoad(loadId)

      const funJumper: FunJumper = {
        userId: request.userId,
        userName: request.userName,
        jumprunId: request.jumprunId,
        skyDiveType: request.skyDiveType,
        requestId: request.id,
        addedAt: now(),
        addedBy,
        addedByName
      }

      const funJumpers = load.funJumpers || []
      funJumpers.push(funJumper)

      const loadRef = ref(database, `loads/${loadId}`)
      await update(loadRef, { funJumpers })
    } catch (error) {
      console.error('Failed to add fun jumper to load:', error)
      throw error
    }
  }

  /**
   * Remove fun jumper from load
   */
  static async removeFunJumperFromLoad(
    loadId: string,
    requestId: string
  ): Promise<void> {
    try {
      const load = await this.getLoad(loadId)
      const funJumpers = (load.funJumpers || []).filter(fj => fj.requestId !== requestId)

      const loadRef = ref(database, `loads/${loadId}`)
      await update(loadRef, { funJumpers })
    } catch (error) {
      console.error('Failed to remove fun jumper from load:', error)
      throw error
    }
  }

  /**
   * Approve a request and assign to a load
   *
   * This is the SMART approval logic:
   * - Assigns to the specified load
   * - Auto-resolves other requested loads WITHOUT sending notifications
   * - Sends ONE approval notification only
   */
  static async approveRequest(
    requestId: string,
    assignedLoadId: string,
    approvedBy: string,
    approvedByName: string,
    approvalNote?: string
  ): Promise<void> {
    try {
      const request = await this.getRequest(requestId)

      // Validation
      if (request.status !== 'pending') {
        throw new Error(`Cannot approve - request is ${request.status}`)
      }

      if (!request.requestedLoadIds.includes(assignedLoadId)) {
        throw new Error('Assigned load is not in the requested loads list')
      }

      // Check capacity
      const hasCapacity = await this.checkLoadCapacity(assignedLoadId)
      if (!hasCapacity) {
        throw new Error('Load is at full capacity')
      }

      // Get auto-resolved load IDs (all except the assigned one)
      const autoResolvedLoadIds = request.requestedLoadIds.filter(id => id !== assignedLoadId)

      // Update request
      const updates: Partial<FunJumperRequest> = {
        status: 'approved',
        assignedLoadId,
        autoResolvedLoadIds,
        approvedAt: now(),
        approvedBy,
        approvedByName,
        approvalNote,
        updatedAt: now(),
        history: [
          ...request.history,
          createHistoryEntry(
            'approved',
            approvedBy,
            approvedByName,
            approvalNote || `Approved for load`,
            'pending',
            'approved'
          )
        ]
      }

      const requestRef = ref(database, `funJumperRequests/${requestId}`)
      await update(requestRef, updates)

      // Add to load
      await this.addFunJumperToLoad(assignedLoadId, request, approvedBy, approvedByName)

      console.log(`Request ${requestId} approved for load ${assignedLoadId}`)

      // Send notification
      try {
        const load = await this.getLoad(assignedLoadId)
        const loadNumber = (load.position || 0) + 1
        const departureTime = 'TBD' // TODO: Add plannedDepartureTime to Load type

        const userSettings = await getUserNotificationSettings(request.userId)
        if (userSettings) {
          await NotificationService.sendApproval(
            request.userId,
            userSettings.email,
            userSettings.phone,
            userSettings.fcmToken,
            request.userName,
            loadNumber,
            departureTime,
            requestId,
            assignedLoadId
          )
        }
      } catch (notifError) {
        console.error('Failed to send approval notification:', notifError)
        // Don't throw - approval succeeded even if notification failed
      }

      // Send push notification to mobile user
      try {
        const userRef = ref(database, `users/${request.userId}`)
        const userSnap = await get(userRef)
        const userData = userSnap.val()

        if (userData?.fcmToken) {
          const load = await this.getLoad(assignedLoadId)
          const loadNumber = (load.position || 0) + 1

          await sendPushNotification(
            userData.fcmToken,
            '✅ Request Approved!',
            `Hi ${request.userName}, you're on Load #${loadNumber}. Check your timer!`
          )
        }
      } catch (error) {
        console.error('Failed to send push notification:', error)
        // Don't fail the approval if notification fails
      }
    } catch (error) {
      console.error('Failed to approve request:', error)
      throw error
    }
  }

  /**
   * Deny a request
   *
   * Note: This is for EXPLICIT denials only.
   * Auto-resolved loads (when approved for another load) don't use this method.
   */
  static async denyRequest(
    requestId: string,
    deniedBy: string,
    deniedByName: string,
    denialReason?: string
  ): Promise<void> {
    try {
      const request = await this.getRequest(requestId)

      if (request.status !== 'pending') {
        throw new Error(`Cannot deny - request is ${request.status}`)
      }

      const updates: Partial<FunJumperRequest> = {
        status: 'denied',
        deniedAt: now(),
        deniedBy,
        deniedByName,
        denialReason,
        updatedAt: now(),
        history: [
          ...request.history,
          createHistoryEntry(
            'denied',
            deniedBy,
            deniedByName,
            denialReason || 'Request denied',
            'pending',
            'denied'
          )
        ]
      }

      const requestRef = ref(database, `funJumperRequests/${requestId}`)
      await update(requestRef, updates)

      console.log(`Request ${requestId} denied`)

      // Send notification (explicit denial only)
      try {
        const userSettings = await getUserNotificationSettings(request.userId)
        if (userSettings) {
          await NotificationService.sendDenial(
            request.userId,
            userSettings.email,
            userSettings.phone,
            userSettings.fcmToken,
            request.userName,
            denialReason || 'No reason provided',
            requestId
          )
        }
      } catch (notifError) {
        console.error('Failed to send denial notification:', notifError)
        // Don't throw - denial succeeded even if notification failed
      }

      // Send push notification to mobile user
      try {
        const userRef = ref(database, `users/${request.userId}`)
        const userSnap = await get(userRef)
        const userData = userSnap.val()

        if (userData?.fcmToken) {
          await sendPushNotification(
            userData.fcmToken,
            '❌ Request Denied',
            `Your request was denied: ${denialReason || 'No reason provided'}`
          )
        }
      } catch (error) {
        console.error('Failed to send push notification:', error)
        // Don't fail the denial if notification fails
      }
    } catch (error) {
      console.error('Failed to deny request:', error)
      throw error
    }
  }

  /**
   * Cancel a pending request (instant)
   */
  static async cancelPendingRequest(
    requestId: string,
    userId: string
  ): Promise<void> {
    try {
      const request = await this.getRequest(requestId)

      if (request.userId !== userId) {
        throw new Error('Unauthorized - can only cancel your own requests')
      }

      if (request.status !== 'pending') {
        throw new Error(`Cannot cancel - request is ${request.status}`)
      }

      const updates: Partial<FunJumperRequest> = {
        status: 'cancelled',
        cancelledAt: now(),
        cancelledBy: userId,
        cancelledByName: request.userName,
        cancellationReason: 'Cancelled by user',
        updatedAt: now(),
        history: [
          ...request.history,
          createHistoryEntry(
            'cancelled',
            userId,
            request.userName,
            'Cancelled by user',
            'pending',
            'cancelled'
          )
        ]
      }

      const requestRef = ref(database, `funJumperRequests/${requestId}`)
      await update(requestRef, updates)

      console.log(`Request ${requestId} cancelled`)
    } catch (error) {
      console.error('Failed to cancel request:', error)
      throw error
    }
  }

  /**
   * Request cancellation for approved request (needs manifest approval)
   *
   * Time-locked: Cannot request cancellation if <10 minutes before departure
   */
  static async requestCancellation(
    requestId: string,
    userId: string,
    cancellationNotes?: string
  ): Promise<void> {
    try {
      const request = await this.getRequest(requestId)

      if (request.userId !== userId) {
        throw new Error('Unauthorized - can only cancel your own requests')
      }

      if (request.status !== 'approved') {
        throw new Error('Can only request cancellation for approved requests')
      }

      if (request.cancellationRequested) {
        throw new Error('Cancellation already requested')
      }

      // Check time restriction (10 minutes)
      if (request.assignedLoadId) {
        // TODO: Add plannedDepartureTime to Load type and implement time check
        // const load = await this.getLoad(request.assignedLoadId)
        // const timeRemaining = getTimeRemaining(load)
        // if (timeRemaining !== null && timeRemaining < 10) {
        //   throw new Error('Cannot cancel - load departing in less than 10 minutes')
        // }

        // For now, allow cancellation requests for approved loads
      }

      const updates: Partial<FunJumperRequest> = {
        cancellationRequested: true,
        cancellationRequestedAt: now(),
        cancellationNotes,
        updatedAt: now(),
        history: [
          ...request.history,
          createHistoryEntry(
            'cancelled',
            userId,
            request.userName,
            `Cancellation requested: ${cancellationNotes || 'No reason provided'}`
          )
        ]
      }

      const requestRef = ref(database, `funJumperRequests/${requestId}`)
      await update(requestRef, updates)

      console.log(`Cancellation requested for request ${requestId}`)
    } catch (error) {
      console.error('Failed to request cancellation:', error)
      throw error
    }
  }

  /**
   * Approve cancellation (manifest only)
   */
  static async approveCancellation(
    requestId: string,
    approvedBy: string,
    approvedByName: string
  ): Promise<void> {
    try {
      const request = await this.getRequest(requestId)

      if (!request.cancellationRequested) {
        throw new Error('No cancellation requested')
      }

      if (request.status !== 'approved') {
        throw new Error('Can only approve cancellation for approved requests')
      }

      // Remove from load
      if (request.assignedLoadId) {
        await this.removeFunJumperFromLoad(request.assignedLoadId, requestId)
      }

      const updates: Partial<FunJumperRequest> = {
        status: 'cancelled',
        cancelledAt: now(),
        cancelledBy: approvedBy,
        cancelledByName: approvedByName,
        cancellationReason: request.cancellationNotes || 'Cancellation approved',
        updatedAt: now(),
        history: [
          ...request.history,
          createHistoryEntry(
            'cancelled',
            approvedBy,
            approvedByName,
            'Cancellation approved by manifest',
            'approved',
            'cancelled'
          )
        ]
      }

      const requestRef = ref(database, `funJumperRequests/${requestId}`)
      await update(requestRef, updates)

      console.log(`Cancellation approved for request ${requestId}`)

      // Send cancellation notification
      try {
        const load = request.assignedLoadId ? await this.getLoad(request.assignedLoadId) : null
        const loadNumber = load ? (load.position || 0) + 1 : 0

        const userSettings = await getUserNotificationSettings(request.userId)
        if (userSettings) {
          await NotificationService.sendCancellation(
            request.userId,
            userSettings.email,
            userSettings.phone,
            userSettings.fcmToken,
            request.userName,
            loadNumber,
            requestId
          )
        }
      } catch (notifError) {
        console.error('Failed to send cancellation notification:', notifError)
        // Don't throw - cancellation succeeded even if notification failed
      }
    } catch (error) {
      console.error('Failed to approve cancellation:', error)
      throw error
    }
  }

  /**
   * Deny cancellation (manifest only)
   */
  static async denyCancellation(
    requestId: string,
    deniedBy: string,
    deniedByName: string,
    denialReason?: string
  ): Promise<void> {
    try {
      const request = await this.getRequest(requestId)

      if (!request.cancellationRequested) {
        throw new Error('No cancellation requested')
      }

      const updates: Partial<FunJumperRequest> = {
        cancellationRequested: false,
        updatedAt: now(),
        history: [
          ...request.history,
          createHistoryEntry(
            'cancelled',
            deniedBy,
            deniedByName,
            `Cancellation denied: ${denialReason || 'No reason provided'}`
          )
        ]
      }

      const requestRef = ref(database, `funJumperRequests/${requestId}`)
      await update(requestRef, updates)

      console.log(`Cancellation denied for request ${requestId}`)
    } catch (error) {
      console.error('Failed to deny cancellation:', error)
      throw error
    }
  }

  /**
   * Subscribe to user's requests with real-time updates
   */
  static subscribeToUserRequests(
    userId: string,
    callback: (requests: FunJumperRequest[]) => void
  ): () => void {
    const requestsRef = ref(database, 'funJumperRequests')
    const userQuery = query(requestsRef, orderByChild('userId'), equalTo(userId))

    const unsubscribe = onValue(userQuery, (snapshot) => {
      if (!snapshot.exists()) {
        callback([])
        return
      }

      const requests: FunJumperRequest[] = []
      snapshot.forEach(child => {
        requests.push(child.val() as FunJumperRequest)
      })

      // Sort by most recent first
      callback(requests.sort((a, b) => b.createdAt - a.createdAt))
    })

    return unsubscribe
  }

  /**
   * Delete a request (admin only)
   */
  static async deleteRequest(requestId: string): Promise<void> {
    try {
      const request = await this.getRequest(requestId)

      // Remove from load if assigned
      if (request.assignedLoadId && request.status === 'approved') {
        await this.removeFunJumperFromLoad(request.assignedLoadId, requestId)
      }

      const requestRef = ref(database, `funJumperRequests/${requestId}`)
      await remove(requestRef)

      console.log(`Request ${requestId} deleted`)
    } catch (error) {
      console.error('Failed to delete request:', error)
      throw error
    }
  }
}
