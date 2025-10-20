// src/lib/notifications.ts
// Multi-channel notification service for fun jumper requests

import type { NotificationPayload, NotificationResults } from '@/types'

// ==================== EMAIL NOTIFICATIONS ====================

/**
 * Send email notification
 * Using console.log for now - can be replaced with actual email service
 */
async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    console.log('📧 EMAIL NOTIFICATION:')
    console.log(`  To: ${to}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Body: ${body}`)
    console.log('─'.repeat(60))

    // TODO: Integrate with actual email service
    // Options:
    // 1. Firebase Trigger Email Extension (FREE)
    // 2. SendGrid (FREE tier: 100 emails/day)
    // 3. Resend (FREE tier: 100 emails/day)
    // 4. Nodemailer with Gmail

    // Example with Firebase Trigger Email:
    // await set(ref(database, `emails/${Date.now()}`), {
    //   to,
    //   message: { subject, text: body, html: `<p>${body}</p>` }
    // })

    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

// ==================== SMS NOTIFICATIONS ====================

/**
 * Send SMS notification via Twilio
 * Using console.log for now - requires Twilio credentials
 */
async function sendSMS(
  to: string,
  message: string
): Promise<boolean> {
  try {
    console.log('📱 SMS NOTIFICATION:')
    console.log(`  To: ${to}`)
    console.log(`  Message: ${message}`)
    console.log('─'.repeat(60))

    // TODO: Integrate with Twilio
    // Requires: npm install twilio
    // const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    // await twilioClient.messages.create({
    //   body: message,
    //   from: TWILIO_PHONE_NUMBER,
    //   to
    // })

    return true
  } catch (error) {
    console.error('Failed to send SMS:', error)
    return false
  }
}

// ==================== PUSH NOTIFICATIONS ====================

/**
 * Send push notification via Firebase Cloud Messaging
 * Using console.log for now - requires FCM setup
 */
async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    console.log('🔔 PUSH NOTIFICATION:')
    console.log(`  Token: ${fcmToken.substring(0, 20)}...`)
    console.log(`  Title: ${title}`)
    console.log(`  Body: ${body}`)
    console.log(`  Data:`, data)
    console.log('─'.repeat(60))

    // TODO: Integrate with Firebase Cloud Messaging
    // Requires: Firebase Admin SDK
    // const message = {
    //   token: fcmToken,
    //   notification: { title, body },
    //   data: data || {},
    //   android: { priority: 'high' },
    //   apns: { headers: { 'apns-priority': '10' } }
    // }
    // await admin.messaging().send(message)

    return true
  } catch (error) {
    console.error('Failed to send push notification:', error)
    return false
  }
}

// ==================== MULTI-CHANNEL NOTIFICATION SERVICE ====================

export interface NotificationOptions {
  email?: boolean
  sms?: boolean
  push?: boolean
}

export class NotificationService {
  /**
   * Send notification through all enabled channels
   */
  static async send(
    userId: string,
    userEmail: string,
    userPhone: string | undefined,
    fcmToken: string | undefined,
    payload: NotificationPayload,
    options: NotificationOptions = { email: true, sms: false, push: true },
    data?: Record<string, string>
  ): Promise<NotificationResults> {
    const results: NotificationResults = {
      push: false,
      sms: false,
      email: false
    }

    console.log('\n' + '='.repeat(60))
    console.log(`🚀 SENDING NOTIFICATIONS TO: ${userEmail}`)
    console.log(`   User ID: ${userId}`)
    console.log('='.repeat(60))

    // 1. Push Notification (Primary - FREE)
    if (options.push && fcmToken) {
      results.push = await sendPushNotification(
        fcmToken,
        payload.title,
        payload.body,
        data
      )
    } else if (options.push && !fcmToken) {
      console.log('⚠️  Push notification enabled but no FCM token available')
    }

    // 2. Email Notification (Backup - FREE)
    if (options.email && userEmail) {
      results.email = await sendEmail(
        userEmail,
        payload.title,
        payload.body
      )
    }

    // 3. SMS Notification (Optional - PAID)
    if (options.sms && userPhone) {
      const smsText = payload.smsText || payload.body
      results.sms = await sendSMS(userPhone, smsText)
    } else if (options.sms && !userPhone) {
      console.log('⚠️  SMS notification enabled but no phone number available')
    }

    console.log('\n📊 NOTIFICATION RESULTS:')
    console.log(`  Push: ${results.push ? '✅' : '❌'}`)
    console.log(`  Email: ${results.email ? '✅' : '❌'}`)
    console.log(`  SMS: ${results.sms ? '✅' : '❌'}`)
    console.log('='.repeat(60) + '\n')

    return results
  }

  /**
   * Send approval notification
   */
  static async sendApproval(
    userId: string,
    userEmail: string,
    userPhone: string | undefined,
    fcmToken: string | undefined,
    userName: string,
    loadNumber: number,
    departureTime: string,
    requestId: string,
    loadId: string
  ): Promise<NotificationResults> {
    const payload: NotificationPayload = {
      title: '✅ Request Approved!',
      body: `${userName}, you're on Load ${loadNumber}! Departure: ${departureTime}. Be at the DZ 15 minutes early.`,
      smsText: `APPROVED: Load ${loadNumber} @ ${departureTime}. Be at DZ 15min early. Fun Jumper Request System.`
    }

    const data = {
      type: 'request_approved',
      requestId,
      loadId,
      loadNumber: String(loadNumber)
    }

    return await this.send(
      userId,
      userEmail,
      userPhone,
      fcmToken,
      payload,
      { push: true, email: true, sms: false }, // SMS opt-in only
      data
    )
  }

  /**
   * Send explicit denial notification
   * Note: NOT used for auto-resolved requests
   */
  static async sendDenial(
    userId: string,
    userEmail: string,
    userPhone: string | undefined,
    fcmToken: string | undefined,
    userName: string,
    reason: string,
    requestId: string
  ): Promise<NotificationResults> {
    const payload: NotificationPayload = {
      title: '❌ Request Denied',
      body: `${userName}, your jump request was denied. Reason: ${reason}`,
      smsText: `DENIED: Your jump request was denied. ${reason}`
    }

    const data = {
      type: 'request_denied',
      requestId,
      reason
    }

    return await this.send(
      userId,
      userEmail,
      userPhone,
      fcmToken,
      payload,
      { push: true, email: true, sms: false },
      data
    )
  }

  /**
   * Send cancellation notification
   */
  static async sendCancellation(
    userId: string,
    userEmail: string,
    userPhone: string | undefined,
    fcmToken: string | undefined,
    userName: string,
    loadNumber: number,
    requestId: string
  ): Promise<NotificationResults> {
    const payload: NotificationPayload = {
      title: '🚫 Request Cancelled',
      body: `${userName}, your request for Load ${loadNumber} has been cancelled.`,
      smsText: `CANCELLED: Your request for Load ${loadNumber} was cancelled.`
    }

    const data = {
      type: 'request_cancelled',
      requestId,
      loadNumber: String(loadNumber)
    }

    return await this.send(
      userId,
      userEmail,
      userPhone,
      fcmToken,
      payload,
      { push: true, email: true, sms: false },
      data
    )
  }
}

// ==================== HELPER: GET USER NOTIFICATION PREFERENCES ====================

import { ref, get } from 'firebase/database'
import { database } from './firebase'
import type { UserProfile } from '@/types'

/**
 * Get user notification settings from database
 */
export async function getUserNotificationSettings(userId: string): Promise<{
  email: string
  phone?: string
  fcmToken?: string
  preferences: NotificationOptions
} | null> {
  try {
    const userRef = ref(database, `users/${userId}`)
    const snapshot = await get(userRef)

    if (!snapshot.exists()) {
      return null
    }

    const user = snapshot.val() as UserProfile

    return {
      email: user.email,
      phone: user.phoneNumber,
      fcmToken: user.fcmToken,
      preferences: {
        push: user.notificationsEnabled !== false, // Default true
        email: user.emailNotificationsEnabled !== false, // Default true
        sms: user.smsNotificationsEnabled === true // Default false (opt-in)
      }
    }
  } catch (error) {
    console.error('Failed to get user notification settings:', error)
    return null
  }
}
