// src/lib/messageService.ts
// Service for managing one-way messages (admin/manifest → fun jumpers)

import { ref, get, set, update, push, onValue, remove } from 'firebase/database'
import { database } from './firebase'
import { sendPushNotification } from './pushNotifications'
import type { Message, CreateMessage, MessageWithStatus, UnreadMessagesSummary } from '@/types/messages'
import type { UserProfile } from '@/types'

// ==================== CONSTANTS ====================

const MESSAGE_EXPIRY_DAYS = 7
// const MAX_MESSAGES_PER_HOUR = 10 // TODO: Implement rate limiting

// ==================== HELPER FUNCTIONS ====================

/**
 * Get current timestamp
 */
function now(): number {
  return Date.now()
}

/**
 * Calculate expiry timestamp (7 days from now)
 */
function getExpiryTimestamp(): number {
  return now() + (MESSAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Get all fun jumper user IDs
 */
async function getFunJumperIds(): Promise<string[]> {
  try {
    const usersRef = ref(database, 'users')
    const snapshot = await get(usersRef)

    if (!snapshot.exists()) {
      return []
    }

    const funJumperIds: string[] = []
    snapshot.forEach(child => {
      const user = child.val() as UserProfile
      if (user.role === 'fun_jumper' && user.isActive) {
        funJumperIds.push(user.uid)
      }
    })

    return funJumperIds
  } catch (error) {
    console.error('Failed to get fun jumper IDs:', error)
    return []
  }
}

/**
 * Get user's FCM token for push notifications
 */
async function getUserFCMToken(userId: string): Promise<string | null> {
  try {
    const userRef = ref(database, `users/${userId}`)
    const snapshot = await get(userRef)

    if (!snapshot.exists()) {
      return null
    }

    const user = snapshot.val() as UserProfile
    return user.fcmToken || null
  } catch (error) {
    console.error(`Failed to get FCM token for user ${userId}:`, error)
    return null
  }
}

// ==================== MESSAGE SERVICE ====================

export class MessageService {
  /**
   * Send a message (individual or broadcast)
   */
  static async sendMessage(
    senderId: string,
    senderName: string,
    senderRole: 'admin' | 'manifest',
    messageData: CreateMessage
  ): Promise<string> {
    try {
      // Validation
      if (messageData.recipientType === 'individual' && !messageData.recipientId) {
        throw new Error('Recipient ID required for individual messages')
      }

      if (!messageData.subject || !messageData.body) {
        throw new Error('Subject and body are required')
      }

      // TODO: Rate limiting check (max 10 messages/hour)
      // const recentMessages = await this.getRecentMessages(senderId, 1)
      // if (recentMessages.length >= MAX_MESSAGES_PER_HOUR) {
      //   throw new Error('Rate limit exceeded. Please wait before sending more messages.')
      // }

      // Create message
      const messagesRef = ref(database, 'messages')
      const newMessageRef = push(messagesRef)

      const message: Message = {
        id: newMessageRef.key!,
        senderId,
        senderName,
        senderRole,
        recipientType: messageData.recipientType,
        recipientId: messageData.recipientId,
        recipientName: messageData.recipientName,
        subject: messageData.subject,
        body: messageData.body,
        priority: messageData.priority,
        requiresAcknowledgment: messageData.requiresAcknowledgment,
        createdAt: now(),
        expiresAt: getExpiryTimestamp()
      }

      await set(newMessageRef, message)

      console.log(`✅ Message ${newMessageRef.key} created by ${senderName}`)

      // Send push notifications
      await this.sendPushNotifications(message)

      return newMessageRef.key!
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  /**
   * Send push notifications for a message
   */
  private static async sendPushNotifications(message: Message): Promise<void> {
    try {
      let recipientIds: string[] = []

      if (message.recipientType === 'individual' && message.recipientId) {
        recipientIds = [message.recipientId]
      } else if (message.recipientType === 'broadcast') {
        recipientIds = await getFunJumperIds()
      }

      console.log(`📤 Sending push notifications to ${recipientIds.length} recipients`)

      // Send notifications in parallel
      const notificationPromises = recipientIds.map(async (userId) => {
        const fcmToken = await getUserFCMToken(userId)
        if (!fcmToken) {
          console.log(`⚠️ No FCM token for user ${userId}`)
          return
        }

        const title = message.requiresAcknowledgment
          ? `⚠️ ${message.subject}`
          : `📬 ${message.subject}`

        const body = message.priority === 'urgent'
          ? `URGENT: ${message.body.substring(0, 100)}...`
          : message.body.substring(0, 100) + (message.body.length > 100 ? '...' : '')

        await sendPushNotification(fcmToken, title, body, {
          type: 'message',
          messageId: message.id,
          requiresAck: String(message.requiresAcknowledgment)
        })
      })

      await Promise.allSettled(notificationPromises)
    } catch (error) {
      console.error('Failed to send push notifications:', error)
      // Don't throw - message was created successfully
    }
  }

  /**
   * Get all messages (admin view)
   */
  static async getMessages(): Promise<Message[]> {
    try {
      const messagesRef = ref(database, 'messages')
      const snapshot = await get(messagesRef)

      if (!snapshot.exists()) {
        return []
      }

      const messages: Message[] = []
      snapshot.forEach(child => {
        messages.push(child.val() as Message)
      })

      // Sort by most recent first
      return messages.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('Failed to get messages:', error)
      throw error
    }
  }

  /**
   * Get messages with status (for admin UI)
   */
  static async getMessagesWithStatus(): Promise<MessageWithStatus[]> {
    try {
      const messages = await this.getMessages()
      const funJumperCount = (await getFunJumperIds()).length

      return messages.map(message => {
        const readCount = message.readBy ? Object.keys(message.readBy).length : 0
        const acknowledgedCount = message.acknowledgedBy ? Object.keys(message.acknowledgedBy).length : 0
        const totalRecipients = message.recipientType === 'broadcast' ? funJumperCount : 1

        return {
          ...message,
          readCount,
          acknowledgedCount,
          totalRecipients,
          isFullyRead: readCount >= totalRecipients,
          isFullyAcknowledged: message.requiresAcknowledgment
            ? acknowledgedCount >= totalRecipients
            : true
        } as MessageWithStatus
      })
    } catch (error) {
      console.error('Failed to get messages with status:', error)
      throw error
    }
  }

  /**
   * Get user's unread messages (fun jumper view)
   */
  static async getUserUnreadMessages(userId: string): Promise<UnreadMessagesSummary> {
    try {
      const messagesRef = ref(database, 'messages')
      const snapshot = await get(messagesRef)

      if (!snapshot.exists()) {
        return {
          totalUnread: 0,
          requiresAcknowledgment: 0,
          hasBlockingMessages: false,
          messages: []
        }
      }

      const unreadMessages: Message[] = []

      snapshot.forEach(child => {
        const message = child.val() as Message

        // Check if message is for this user
        const isForUser = message.recipientType === 'broadcast' || message.recipientId === userId

        if (!isForUser) return

        // Check if unread
        const isRead = message.readBy?.[userId] !== undefined
        if (isRead) return

        // Check if expired
        const isExpired = message.expiresAt && message.expiresAt < now()
        if (isExpired) return

        unreadMessages.push(message)
      })

      const requiresAck = unreadMessages.filter(m => m.requiresAcknowledgment && !m.acknowledgedBy?.[userId])

      return {
        totalUnread: unreadMessages.length,
        requiresAcknowledgment: requiresAck.length,
        hasBlockingMessages: requiresAck.length > 0,
        messages: unreadMessages.sort((a, b) => b.createdAt - a.createdAt)
      }
    } catch (error) {
      console.error('Failed to get user unread messages:', error)
      throw error
    }
  }

  /**
   * Get user's message history (recent messages, read or unread)
   */
  static async getUserMessages(userId: string, includeRead: boolean = true): Promise<Message[]> {
    try {
      const messagesRef = ref(database, 'messages')
      const snapshot = await get(messagesRef)

      if (!snapshot.exists()) {
        return []
      }

      const userMessages: Message[] = []
      const oneDayAgo = now() - (24 * 60 * 60 * 1000)

      snapshot.forEach(child => {
        const message = child.val() as Message

        // Check if message is for this user
        const isForUser = message.recipientType === 'broadcast' || message.recipientId === userId

        if (!isForUser) return

        // Filter by recent (last 24 hours) or unread
        const isRecent = message.createdAt > oneDayAgo
        const isUnread = !message.readBy?.[userId]

        if (includeRead ? isRecent : isUnread) {
          userMessages.push(message)
        }
      })

      return userMessages.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('Failed to get user messages:', error)
      throw error
    }
  }

  /**
   * Mark message as read
   */
  static async markAsRead(messageId: string, userId: string): Promise<void> {
    try {
      const messageRef = ref(database, `messages/${messageId}`)
      await update(messageRef, {
        [`readBy/${userId}`]: now()
      })

      console.log(`✅ Message ${messageId} marked as read by user ${userId}`)
    } catch (error) {
      console.error('Failed to mark message as read:', error)
      throw error
    }
  }

  /**
   * Mark message as acknowledged
   */
  static async markAsAcknowledged(messageId: string, userId: string): Promise<void> {
    try {
      const messageRef = ref(database, `messages/${messageId}`)
      await update(messageRef, {
        [`acknowledgedBy/${userId}`]: now(),
        [`readBy/${userId}`]: now()  // Also mark as read
      })

      console.log(`✅ Message ${messageId} acknowledged by user ${userId}`)
    } catch (error) {
      console.error('Failed to mark message as acknowledged:', error)
      throw error
    }
  }

  /**
   * Delete a message (admin only)
   */
  static async deleteMessage(messageId: string): Promise<void> {
    try {
      const messageRef = ref(database, `messages/${messageId}`)
      await remove(messageRef)

      console.log(`✅ Message ${messageId} deleted`)
    } catch (error) {
      console.error('Failed to delete message:', error)
      throw error
    }
  }

  /**
   * Subscribe to user's messages (real-time updates)
   */
  static subscribeToUserMessages(
    userId: string,
    callback: (summary: UnreadMessagesSummary) => void
  ): () => void {
    const messagesRef = ref(database, 'messages')

    const unsubscribe = onValue(messagesRef, async () => {
      const summary = await this.getUserUnreadMessages(userId)
      callback(summary)
    })

    return unsubscribe
  }

  /**
   * Subscribe to all messages (admin view)
   */
  static subscribeToMessages(
    callback: (messages: Message[]) => void
  ): () => void {
    const messagesRef = ref(database, 'messages')

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([])
        return
      }

      const messages: Message[] = []
      snapshot.forEach(child => {
        messages.push(child.val() as Message)
      })

      callback(messages.sort((a, b) => b.createdAt - a.createdAt))
    })

    return unsubscribe
  }

  /**
   * Clean up expired messages (admin maintenance task)
   */
  static async cleanupExpiredMessages(): Promise<number> {
    try {
      const messages = await this.getMessages()
      const currentTime = now()
      let deletedCount = 0

      const deletePromises = messages
        .filter(m => m.expiresAt && m.expiresAt < currentTime)
        .map(async (m) => {
          await this.deleteMessage(m.id)
          deletedCount++
        })

      await Promise.all(deletePromises)

      console.log(`✅ Cleaned up ${deletedCount} expired messages`)
      return deletedCount
    } catch (error) {
      console.error('Failed to cleanup expired messages:', error)
      throw error
    }
  }
}
