// src/types/messages.ts
// Type definitions for one-way messaging system (admin/manifest → fun jumpers)

export type MessagePriority = 'normal' | 'urgent'
export type RecipientType = 'individual' | 'broadcast'

/**
 * Message sent from admin/manifest to fun jumper(s)
 */
export interface Message {
  id: string

  // Sender info
  senderId: string
  senderName: string
  senderRole: 'admin' | 'manifest'

  // Recipient info
  recipientType: RecipientType
  recipientId?: string  // Only for individual messages
  recipientName?: string  // For display purposes

  // Message content
  subject: string
  body: string
  priority: MessagePriority

  // Acknowledgment requirement
  requiresAcknowledgment: boolean  // If true, blocks load requests until acknowledged

  // Tracking
  createdAt: number
  expiresAt?: number  // Auto-cleanup timestamp (7 days)

  // Read tracking (for both individual and broadcast)
  readBy?: { [userId: string]: number }  // userId → timestamp

  // Acknowledgment tracking (only if requiresAcknowledgment = true)
  acknowledgedBy?: { [userId: string]: number }  // userId → timestamp
}

/**
 * Create message payload (what admin sends)
 */
export interface CreateMessage {
  recipientType: RecipientType
  recipientId?: string  // Required if recipientType = 'individual'
  recipientName?: string
  subject: string
  body: string
  priority: MessagePriority
  requiresAcknowledgment: boolean
}

/**
 * Message with computed status (for display in admin UI)
 */
export interface MessageWithStatus extends Message {
  readCount: number  // Number of recipients who read
  acknowledgedCount: number  // Number who acknowledged
  totalRecipients: number  // Total number of recipients (1 for individual, all fun jumpers for broadcast)
  isFullyRead: boolean
  isFullyAcknowledged: boolean
}

/**
 * User's unread messages summary
 */
export interface UnreadMessagesSummary {
  totalUnread: number
  requiresAcknowledgment: number  // Number of unread messages that require ack
  hasBlockingMessages: boolean  // True if any unread messages require ack
  messages: Message[]
}
