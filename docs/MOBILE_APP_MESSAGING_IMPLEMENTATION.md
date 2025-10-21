# Mobile App Messaging Implementation Guide

## Overview

This guide provides complete instructions for implementing the messaging system in the mobile app (React Native/Expo). The web app backend is 100% complete and functional. You need to add 3 UI components to display messages and handle blocking logic.

---

## What's Already Built (Backend)

✅ **Firebase Database Schema**: Messages stored in `messages/` collection
✅ **Message Service**: Full CRUD operations available
✅ **Push Notifications**: Auto-sent when message created
✅ **Security Rules**: Proper read/write permissions configured
✅ **Web App UI**: Admin can send messages (individual or broadcast)

---

## What You Need to Build (Mobile App)

### **Phase 3: Blocking Modal** (CRITICAL - Blocks load requests)
### **Phase 4: Inbox Tab** (Shows message history)
### **Phase 5: Banner Notification** (Unread message indicator)

---

# Phase 3: Blocking Modal (30-45 minutes)

## Purpose
When a fun jumper tries to submit a load request, check for unread messages that require acknowledgment. If found, show a blocking modal that prevents load submission until acknowledged.

## Where to Implement
- **Location**: Request submission screen (wherever `FunJumperRequestService.createRequest()` is called)
- **Trigger**: Before showing load request form

## Step 1: Create Message Subscription Hook

**File**: `src/hooks/useUserMessages.ts`

```typescript
import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

interface Message {
  id: string
  senderId: string
  senderName: string
  senderRole: 'admin' | 'manifest'
  recipientType: 'individual' | 'broadcast'
  recipientId?: string
  subject: string
  body: string
  priority: 'normal' | 'urgent'
  requiresAcknowledgment: boolean
  createdAt: number
  expiresAt?: number
  readBy?: { [userId: string]: number }
  acknowledgedBy?: { [userId: string]: number }
}

interface UnreadMessagesSummary {
  totalUnread: number
  requiresAcknowledgment: number
  hasBlockingMessages: boolean
  messages: Message[]
}

export function useUserMessages() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<UnreadMessagesSummary>({
    totalUnread: 0,
    requiresAcknowledgment: 0,
    hasBlockingMessages: false,
    messages: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false)
      return
    }

    const messagesRef = ref(database, 'messages')

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setSummary({
          totalUnread: 0,
          requiresAcknowledgment: 0,
          hasBlockingMessages: false,
          messages: []
        })
        setLoading(false)
        return
      }

      const unreadMessages: Message[] = []
      const now = Date.now()

      snapshot.forEach(child => {
        const message = child.val() as Message

        // Check if message is for this user
        const isForUser =
          message.recipientType === 'broadcast' ||
          message.recipientId === user.uid

        if (!isForUser) return

        // Check if unread
        const isRead = message.readBy?.[user.uid] !== undefined
        if (isRead) return

        // Check if expired
        const isExpired = message.expiresAt && message.expiresAt < now
        if (isExpired) return

        unreadMessages.push(message)
      })

      const requiresAck = unreadMessages.filter(
        m => m.requiresAcknowledgment && !m.acknowledgedBy?.[user.uid]
      )

      setSummary({
        totalUnread: unreadMessages.length,
        requiresAcknowledgment: requiresAck.length,
        hasBlockingMessages: requiresAck.length > 0,
        messages: unreadMessages.sort((a, b) => b.createdAt - a.createdAt)
      })
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user?.uid])

  return { summary, loading }
}
```

## Step 2: Create Message Actions Helper

**File**: `src/lib/messageActions.ts`

```typescript
import { ref, update } from 'firebase/database'
import { database } from './firebase'

export async function markMessageAsRead(messageId: string, userId: string): Promise<void> {
  try {
    const messageRef = ref(database, `messages/${messageId}`)
    await update(messageRef, {
      [`readBy/${userId}`]: Date.now()
    })
    console.log(`✅ Message ${messageId} marked as read`)
  } catch (error) {
    console.error('Failed to mark message as read:', error)
    throw error
  }
}

export async function acknowledgeMessage(messageId: string, userId: string): Promise<void> {
  try {
    const messageRef = ref(database, `messages/${messageId}`)
    await update(messageRef, {
      [`acknowledgedBy/${userId}`]: Date.now(),
      [`readBy/${userId}`]: Date.now() // Also mark as read
    })
    console.log(`✅ Message ${messageId} acknowledged`)
  } catch (error) {
    console.error('Failed to acknowledge message:', error)
    throw error
  }
}
```

## Step 3: Create Blocking Modal Component

**File**: `src/components/MessageBlockingModal.tsx`

```tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import { acknowledgeMessage } from '../lib/messageActions'
import { useAuth } from '../contexts/AuthContext'

interface Message {
  id: string
  senderName: string
  subject: string
  body: string
  priority: 'normal' | 'urgent'
  createdAt: number
}

interface Props {
  visible: boolean
  messages: Message[]
  onAllAcknowledged: () => void
}

export function MessageBlockingModal({ visible, messages, onAllAcknowledged }: Props) {
  const { user } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [acknowledging, setAcknowledging] = useState(false)

  if (!visible || messages.length === 0) return null

  const currentMessage = messages[currentIndex]
  const isLast = currentIndex === messages.length - 1

  const handleAcknowledge = async () => {
    if (!user?.uid) return

    setAcknowledging(true)

    try {
      await acknowledgeMessage(currentMessage.id, user.uid)

      if (isLast) {
        // All messages acknowledged - unlock app
        onAllAcknowledged()
      } else {
        // Move to next message
        setCurrentIndex(currentIndex + 1)
      }
    } catch (error) {
      console.error('Failed to acknowledge message:', error)
      alert('Failed to acknowledge message. Please try again.')
    } finally {
      setAcknowledging(false)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {}} // Prevent closing - must acknowledge
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[
          styles.header,
          currentMessage.priority === 'urgent' ? styles.headerUrgent : styles.headerNormal
        ]}>
          <Text style={styles.headerIcon}>
            {currentMessage.priority === 'urgent' ? '⚠️' : '📬'}
          </Text>
          <Text style={styles.headerTitle}>
            {currentMessage.priority === 'urgent' ? 'URGENT MESSAGE' : 'Important Message'}
          </Text>
          <Text style={styles.headerSubtitle}>
            Acknowledgment Required ({currentIndex + 1} of {messages.length})
          </Text>
        </View>

        {/* Message Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.subject}>{currentMessage.subject}</Text>

          <Text style={styles.meta}>
            From: {currentMessage.senderName} • {formatTimestamp(currentMessage.createdAt)}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.body}>{currentMessage.body}</Text>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <Text style={styles.instruction}>
            You must acknowledge this message before you can submit new load requests.
          </Text>

          <TouchableOpacity
            style={[
              styles.acknowledgeButton,
              acknowledging && styles.acknowledgeButtonDisabled
            ]}
            onPress={handleAcknowledge}
            disabled={acknowledging}
          >
            <Text style={styles.acknowledgeButtonText}>
              {acknowledging ? 'Acknowledging...' : 'I Acknowledge'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b', // slate-800
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerNormal: {
    backgroundColor: '#3b82f6', // blue-500
  },
  headerUrgent: {
    backgroundColor: '#ef4444', // red-500
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0e7ff', // blue-100
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  subject: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  meta: {
    fontSize: 13,
    color: '#94a3b8', // slate-400
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#475569', // slate-600
    marginBottom: 20,
  },
  body: {
    fontSize: 16,
    color: '#e2e8f0', // slate-200
    lineHeight: 24,
  },
  actions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155', // slate-700
  },
  instruction: {
    fontSize: 13,
    color: '#cbd5e1', // slate-300
    textAlign: 'center',
    marginBottom: 15,
  },
  acknowledgeButton: {
    backgroundColor: '#10b981', // green-500
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acknowledgeButtonDisabled: {
    opacity: 0.6,
  },
  acknowledgeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
})
```

## Step 4: Integrate into Request Submission Flow

**File**: `src/screens/SubmitRequestScreen.tsx` (or wherever load requests are submitted)

```tsx
import React, { useState } from 'react'
import { useUserMessages } from '../hooks/useUserMessages'
import { MessageBlockingModal } from '../components/MessageBlockingModal'

export function SubmitRequestScreen() {
  const { summary, loading } = useUserMessages()
  const [showBlockingModal, setShowBlockingModal] = useState(false)

  // Check for blocking messages when user tries to submit
  const handleSubmitRequest = () => {
    if (summary.hasBlockingMessages) {
      // Show blocking modal
      setShowBlockingModal(true)
      return
    }

    // No blocking messages - proceed with request submission
    proceedWithRequestSubmission()
  }

  const proceedWithRequestSubmission = () => {
    // Your existing request submission logic here
    // ...
  }

  const handleAllMessagesAcknowledged = () => {
    setShowBlockingModal(false)
    // Now proceed with request
    proceedWithRequestSubmission()
  }

  return (
    <>
      {/* Your existing UI */}
      <TouchableOpacity onPress={handleSubmitRequest}>
        <Text>Submit Request</Text>
      </TouchableOpacity>

      {/* Blocking Modal */}
      <MessageBlockingModal
        visible={showBlockingModal}
        messages={summary.messages.filter(m => m.requiresAcknowledgment)}
        onAllAcknowledged={handleAllMessagesAcknowledged}
      />
    </>
  )
}
```

---

# Phase 4: Inbox Tab (45-60 minutes)

## Purpose
Show fun jumpers their message history in a dedicated inbox tab. Display recent messages (today + last 7 days), allow reading, and acknowledgment.

## Step 1: Create Inbox Screen

**File**: `src/screens/MessagesInboxScreen.tsx`

```tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useUserMessages } from '../hooks/useUserMessages'
import { markMessageAsRead, acknowledgeMessage } from '../lib/messageActions'
import { useAuth } from '../contexts/AuthContext'

interface Message {
  id: string
  senderName: string
  subject: string
  body: string
  priority: 'normal' | 'urgent'
  requiresAcknowledgment: boolean
  createdAt: number
  readBy?: { [userId: string]: number }
  acknowledgedBy?: { [userId: string]: number }
}

export function MessagesInboxScreen() {
  const { user } = useAuth()
  const { summary, loading } = useUserMessages()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    // Firebase subscription will auto-refresh
    setTimeout(() => setRefreshing(false), 1000)
  }

  const handlePress = async (message: Message) => {
    if (!user?.uid) return

    // Toggle expand
    if (expandedId === message.id) {
      setExpandedId(null)
    } else {
      setExpandedId(message.id)

      // Mark as read if not already
      if (!message.readBy?.[user.uid]) {
        try {
          await markMessageAsRead(message.id, user.uid)
        } catch (error) {
          console.error('Failed to mark as read:', error)
        }
      }
    }
  }

  const handleAcknowledge = async (message: Message) => {
    if (!user?.uid) return

    setAcknowledging(message.id)

    try {
      await acknowledgeMessage(message.id, user.uid)
    } catch (error) {
      console.error('Failed to acknowledge:', error)
      alert('Failed to acknowledge message. Please try again.')
    } finally {
      setAcknowledging(null)
    }
  }

  const isRead = (message: Message) => {
    return user?.uid ? message.readBy?.[user.uid] !== undefined : false
  }

  const isAcknowledged = (message: Message) => {
    return user?.uid ? message.acknowledgedBy?.[user.uid] !== undefined : false
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    }
  }

  const renderMessage = ({ item: message }: { item: Message }) => {
    const expanded = expandedId === message.id
    const read = isRead(message)
    const acknowledged = isAcknowledged(message)
    const needsAck = message.requiresAcknowledgment && !acknowledged

    return (
      <TouchableOpacity
        style={[
          styles.messageCard,
          !read && styles.messageCardUnread,
          message.priority === 'urgent' && styles.messageCardUrgent,
        ]}
        onPress={() => handlePress(message)}
      >
        {/* Header */}
        <View style={styles.messageHeader}>
          <View style={styles.messageHeaderLeft}>
            <Text style={[styles.subject, !read && styles.subjectUnread]}>
              {!read && '• '}
              {message.subject}
            </Text>
            <Text style={styles.meta}>
              {message.senderName} • {formatTimestamp(message.createdAt)}
            </Text>
          </View>

          <View style={styles.badges}>
            {message.priority === 'urgent' && (
              <View style={styles.badgeUrgent}>
                <Text style={styles.badgeText}>URGENT</Text>
              </View>
            )}
            {needsAck && (
              <View style={styles.badgeAck}>
                <Text style={styles.badgeText}>ACK REQ</Text>
              </View>
            )}
          </View>
        </View>

        {/* Expanded Body */}
        {expanded && (
          <>
            <View style={styles.divider} />
            <Text style={styles.body}>{message.body}</Text>

            {/* Acknowledge Button */}
            {needsAck && (
              <TouchableOpacity
                style={[
                  styles.ackButton,
                  acknowledging === message.id && styles.ackButtonDisabled
                ]}
                onPress={() => handleAcknowledge(message)}
                disabled={acknowledging === message.id}
              >
                <Text style={styles.ackButtonText}>
                  {acknowledging === message.id ? 'Acknowledging...' : '✓ Acknowledge'}
                </Text>
              </TouchableOpacity>
            )}

            {acknowledged && (
              <View style={styles.acknowledgedBadge}>
                <Text style={styles.acknowledgedText}>✓ Acknowledged</Text>
              </View>
            )}
          </>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        {summary.totalUnread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{summary.totalUnread}</Text>
          </View>
        )}
      </View>

      {/* Messages List */}
      {summary.messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📬</Text>
          <Text style={styles.emptyText}>No messages</Text>
          <Text style={styles.emptySubtext}>
            You'll see messages from manifest here
          </Text>
        </View>
      ) : (
        <FlatList
          data={summary.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155', // slate-700
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  unreadBadge: {
    backgroundColor: '#ef4444', // red-500
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  messageCard: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155', // slate-700
  },
  messageCardUnread: {
    borderColor: '#3b82f6', // blue-500
    borderWidth: 2,
  },
  messageCardUrgent: {
    borderColor: '#ef4444', // red-500
    backgroundColor: '#7f1d1d', // red-900/20
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  messageHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  subject: {
    fontSize: 16,
    color: '#cbd5e1', // slate-300
    marginBottom: 4,
  },
  subjectUnread: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  meta: {
    fontSize: 12,
    color: '#64748b', // slate-500
  },
  badges: {
    gap: 4,
  },
  badgeUrgent: {
    backgroundColor: '#dc2626', // red-600
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeAck: {
    backgroundColor: '#ea580c', // orange-600
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#475569', // slate-600
    marginVertical: 12,
  },
  body: {
    fontSize: 14,
    color: '#e2e8f0', // slate-200
    lineHeight: 20,
  },
  ackButton: {
    backgroundColor: '#10b981', // green-500
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  ackButtonDisabled: {
    opacity: 0.6,
  },
  ackButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  acknowledgedBadge: {
    backgroundColor: '#065f46', // green-900
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  acknowledgedText: {
    color: '#34d399', // green-400
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cbd5e1', // slate-300
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b', // slate-500
    textAlign: 'center',
  },
})
```

## Step 2: Add to Bottom Tab Navigation

**File**: `src/navigation/BottomTabNavigator.tsx` (or wherever your tabs are defined)

```tsx
import { MessagesInboxScreen } from '../screens/MessagesInboxScreen'
import { useUserMessages } from '../hooks/useUserMessages'

// Inside your tab navigator component
function TabNavigator() {
  const { summary } = useUserMessages()

  return (
    <Tab.Navigator>
      {/* Your existing tabs */}
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        // ...
      />

      {/* NEW: Messages Tab */}
      <Tab.Screen
        name="Messages"
        component={MessagesInboxScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
              {summary.totalUnread > 0 && (
                <View style={{
                  position: 'absolute',
                  right: -6,
                  top: -3,
                  backgroundColor: '#ef4444',
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 'bold',
                  }}>
                    {summary.totalUnread > 9 ? '9+' : summary.totalUnread}
                  </Text>
                </View>
              )}
            </View>
          ),
          tabBarBadge: summary.totalUnread > 0 ? summary.totalUnread : undefined,
        }}
      />

      {/* Your other tabs */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        // ...
      />
    </Tab.Navigator>
  )
}
```

---

# Phase 5: Banner Notification (20-30 minutes)

## Purpose
Show a persistent banner at the top of the app when there are unread messages. Tap to navigate to inbox.

## Implementation

**File**: `src/components/UnreadMessagesBanner.tsx`

```tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useUserMessages } from '../hooks/useUserMessages'

export function UnreadMessagesBanner() {
  const navigation = useNavigation()
  const { summary } = useUserMessages()

  if (summary.totalUnread === 0) return null

  const isUrgent = summary.requiresAcknowledgment > 0

  const handlePress = () => {
    navigation.navigate('Messages')
  }

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        isUrgent ? styles.bannerUrgent : styles.bannerNormal
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>
          {isUrgent ? '⚠️' : '📬'}
        </Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isUrgent
              ? `${summary.requiresAcknowledgment} message${summary.requiresAcknowledgment > 1 ? 's' : ''} require acknowledgment`
              : `You have ${summary.totalUnread} unread message${summary.totalUnread > 1 ? 's' : ''}`
            }
          </Text>
          <Text style={styles.subtitle}>Tap to view</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  bannerNormal: {
    backgroundColor: '#1e40af', // blue-800
    borderBottomColor: '#3b82f6', // blue-500
  },
  bannerUrgent: {
    backgroundColor: '#991b1b', // red-900
    borderBottomColor: '#ef4444', // red-500
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    color: '#cbd5e1', // slate-300
    fontSize: 12,
  },
  arrow: {
    color: '#ffffff',
    fontSize: 24,
    marginLeft: 8,
  },
})
```

## Add to Main App Layout

**File**: `src/App.tsx` or main layout component

```tsx
import { UnreadMessagesBanner } from './components/UnreadMessagesBanner'

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Banner at top of app */}
      <UnreadMessagesBanner />

      {/* Your main navigation/content */}
      <NavigationContainer>
        {/* ... */}
      </NavigationContainer>
    </SafeAreaView>
  )
}
```

---

# Push Notification Handling

## Deep Linking to Inbox

When user taps a push notification, open the app and navigate to the Messages inbox.

**File**: `src/navigation/linking.ts` (or notification handler)

```typescript
import * as Notifications from 'expo-notifications'

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Handle notification tap
export function useNotificationTapHandler() {
  const navigation = useNavigation()

  useEffect(() => {
    // Handle notification tap when app is open
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data

      if (data.type === 'message') {
        // Navigate to Messages inbox
        navigation.navigate('Messages')
      }
    })

    return () => subscription.remove()
  }, [navigation])
}
```

---

# Testing Checklist

## Phase 3: Blocking Modal
- [ ] Send message with "Requires Acknowledgment" checked
- [ ] Open mobile app, try to submit load request
- [ ] Blocking modal appears with message
- [ ] Click "I Acknowledge"
- [ ] Modal closes, can now submit request
- [ ] Test with multiple messages requiring acknowledgment
- [ ] Verify carousel/list shows all messages

## Phase 4: Inbox Tab
- [ ] Open Messages tab
- [ ] See unread messages with blue border
- [ ] See read messages (no border)
- [ ] Tap message to expand
- [ ] Message auto-marks as read
- [ ] Tap "Acknowledge" button
- [ ] Badge count decreases
- [ ] Pull to refresh works
- [ ] Empty state shows when no messages

## Phase 5: Banner
- [ ] Send message (not requiring ack)
- [ ] Yellow/blue banner appears
- [ ] Shows correct unread count
- [ ] Tap banner navigates to Messages tab
- [ ] Send message requiring ack
- [ ] Banner turns red
- [ ] Shows "X messages require acknowledgment"

## Push Notifications
- [ ] Send message from web app
- [ ] Mobile device receives push notification
- [ ] Notification title shows subject
- [ ] Tap notification opens app to Messages tab
- [ ] Message appears in inbox

---

# Firebase Database Structure Reference

```json
{
  "messages": {
    "messageId123": {
      "id": "messageId123",
      "senderId": "adminUserId",
      "senderName": "John Admin",
      "senderRole": "admin",
      "recipientType": "individual",
      "recipientId": "funJumperUserId",
      "recipientName": "Jane Jumper",
      "subject": "Weather Update",
      "body": "Winds picking up - high pulls only today",
      "priority": "urgent",
      "requiresAcknowledgment": true,
      "createdAt": 1704153600000,
      "expiresAt": 1704758400000,
      "readBy": {
        "funJumperUserId": 1704155000000
      },
      "acknowledgedBy": {
        "funJumperUserId": 1704155100000
      }
    }
  }
}
```

---

# Common Issues & Solutions

## Issue: Messages not appearing
**Solution**: Check Firebase security rules - user must be authenticated

## Issue: Read status not updating
**Solution**: Verify `userId` matches exactly between `useAuth()` and Firebase

## Issue: Push notifications not received
**Solution**:
1. Verify FCM token is saved to `users/{userId}/fcmToken`
2. Check console logs in web app - should see "Push notification sent"
3. Test on physical device (simulators don't support push)

## Issue: Blocking modal shows after acknowledging
**Solution**: Firebase subscription should auto-update - check network connection

---

# Summary

**Estimated Total Time**: 2-3 hours

- **Phase 3 (Blocking Modal)**: 30-45 minutes
- **Phase 4 (Inbox Tab)**: 45-60 minutes
- **Phase 5 (Banner)**: 20-30 minutes
- **Testing & Polish**: 30-45 minutes

**What's Working After Implementation**:
✅ Fun jumpers blocked from requesting loads until ack
✅ Message inbox with read/unread tracking
✅ Unread message banner with navigation
✅ Push notifications with deep linking
✅ Real-time message sync
✅ Acknowledgment enforcement

**Backend is 100% ready** - just add these 3 UI components and you're done!
