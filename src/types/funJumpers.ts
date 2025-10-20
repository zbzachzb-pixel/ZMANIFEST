// src/types/funJumpers.ts
// Type definitions for Fun Jumper request system

// ==================== BASIC TYPES ====================

/**
 * Skydive types available for fun jumpers
 */
export type SkyDiveType =
  | 'hop_n_pop'      // 3,500 ft exit
  | 'team_pass'      // Formation practice
  | 'full_altitude'  // 13,500+ ft
  | 'high_pull'      // Canopy work
  | 'wingsuit'       // Wingsuit jump

/**
 * Request lifecycle states
 */
export type RequestStatus =
  | 'pending'    // Submitted, awaiting manifest approval
  | 'approved'   // Approved and assigned to a load
  | 'denied'     // Explicitly denied by manifest
  | 'cancelled'  // Cancelled by user or system
  | 'completed'  // Jump completed

/**
 * User roles for authentication
 */
export type UserRole =
  | 'admin'       // Full system access
  | 'manifest'    // Can approve/deny requests
  | 'instructor'  // Can view loads
  | 'fun_jumper'  // Can submit requests

// ==================== USER PROFILE ====================

/**
 * Enhanced user profile with role and notification preferences
 */
export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  uspaNumber?: string
  jumprunId?: string
  phoneNumber?: string
  fcmToken?: string
  fcmTokenUpdatedAt?: number
  platform?: 'ios' | 'android'

  // Notification preferences
  notificationsEnabled: boolean
  smsNotificationsEnabled: boolean
  emailNotificationsEnabled: boolean

  // Metadata
  createdAt: number
  lastLogin?: number
  isActive: boolean
}

export type CreateUserProfile = Omit<UserProfile, 'uid' | 'createdAt' | 'lastLogin' | 'isActive'>
export type UpdateUserProfile = Partial<Omit<UserProfile, 'uid' | 'createdAt'>>

// ==================== FUN JUMPER REQUEST ====================

/**
 * Request history entry for audit trail
 */
export interface RequestHistoryEntry {
  action: 'created' | 'approved' | 'denied' | 'cancelled' | 'auto_resolved'
  timestamp: number
  actorId?: string
  actorName?: string
  note?: string
  oldStatus?: RequestStatus
  newStatus?: RequestStatus
}

/**
 * Fun Jumper request - main entity
 */
export interface FunJumperRequest {
  id: string

  // User info
  userId: string
  userName: string
  userEmail: string
  jumprunId: string

  // Request details
  requestedLoadIds: string[]  // Prioritized list of load IDs
  skyDiveType: SkyDiveType
  groupId?: string            // Optional group ID for jumping with friends
  notes?: string              // Optional notes for manifest

  // Status
  status: RequestStatus
  assignedLoadId?: string     // Set when approved
  autoResolvedLoadIds?: string[]  // Other loads auto-resolved without notification

  // Approval info
  approvedAt?: number
  approvedBy?: string
  approvedByName?: string
  approvalNote?: string

  // Denial info
  deniedAt?: number
  deniedBy?: string
  deniedByName?: string
  denialReason?: string

  // Cancellation
  cancellationRequested: boolean
  cancellationRequestedAt?: number
  cancellationNotes?: string
  cancelledAt?: number
  cancelledBy?: string
  cancelledByName?: string
  cancellationReason?: string

  // Completion
  completedAt?: number

  // Metadata
  createdAt: number
  updatedAt: number
  history: RequestHistoryEntry[]
}

export type CreateFunJumperRequest = Omit<
  FunJumperRequest,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'history' | 'cancellationRequested'
>

export type UpdateFunJumperRequest = Partial<Omit<FunJumperRequest, 'id' | 'userId' | 'createdAt'>>

// ==================== FUN JUMPER ON LOAD ====================

/**
 * Fun jumper assigned to a specific load
 * This is stored in the Load.funJumpers array
 */
export interface FunJumper {
  userId: string
  userName: string
  jumprunId: string
  skyDiveType: SkyDiveType
  requestId: string
  addedAt: number
  addedBy?: string
  addedByName?: string
}

export type CreateFunJumper = Omit<FunJumper, 'addedAt'>

// ==================== FUN JUMPER GROUP ====================

/**
 * Group of fun jumpers who want to jump together
 * Future feature - not implemented in Phase 1
 */
export interface FunJumperGroup {
  id: string
  name: string
  creatorId: string
  creatorName: string
  memberIds: string[]
  createdAt: number
}

export type CreateFunJumperGroup = Omit<FunJumperGroup, 'id' | 'createdAt'>

// ==================== NOTIFICATION ====================

/**
 * Notification payload for multi-channel delivery
 */
export interface NotificationPayload {
  title: string
  body: string
  smsText?: string  // Optional custom SMS text
}

/**
 * Notification data for deep linking
 */
export interface NotificationData {
  type: 'request_approved' | 'request_denied' | 'request_cancelled' | 'load_update'
  requestId?: string
  loadId?: string
  [key: string]: any
}

/**
 * Notification delivery results
 */
export interface NotificationResults {
  push: boolean
  sms: boolean
  email: boolean
}

// ==================== API RESPONSE TYPES ====================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
