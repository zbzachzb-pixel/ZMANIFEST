// src/app/messages/page.tsx
// Messaging center for admin/manifest to send messages to fun jumpers

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useUsers } from '@/hooks/useUsers'
import { MessageService } from '@/lib/messageService'
import { RequireRole } from '@/components/auth'
import type { Message, CreateMessage, MessagePriority, RecipientType } from '@/types'

function MessagesPageContent() {
  const { userProfile } = useAuth()
  const toast = useToast()
  const { data: users } = useUsers()

  // Message composition state
  const [recipientType, setRecipientType] = useState<RecipientType>('individual')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<MessagePriority>('normal')
  const [requiresAck, setRequiresAck] = useState(false)
  const [sending, setSending] = useState(false)

  // Message history state
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'individual' | 'broadcast' | 'requires_ack'>('all')
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null)

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = await MessageService.getMessages()
        setMessages(data)
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setMessagesLoading(false)
      }
    }

    loadMessages()

    // Subscribe to real-time updates
    const unsubscribe = MessageService.subscribeToMessages((data) => {
      setMessages(data)
    })

    return () => unsubscribe()
  }, [])

  // Filter fun jumpers only
  const funJumpers = useMemo(() => {
    return users.filter(u => u.role === 'fun_jumper' && u.isActive)
  }, [users])

  // Filtered messages
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (filter === 'individual') return msg.recipientType === 'individual'
      if (filter === 'broadcast') return msg.recipientType === 'broadcast'
      if (filter === 'requires_ack') return msg.requiresAcknowledgment
      return true
    })
  }, [messages, filter])

  // Handle send message
  const handleSend = async () => {
    if (!userProfile) return

    // Validation
    if (recipientType === 'individual' && !selectedUserId) {
      toast.error('Validation Error', 'Please select a recipient')
      return
    }

    if (!subject.trim()) {
      toast.error('Validation Error', 'Please enter a subject')
      return
    }

    if (!body.trim()) {
      toast.error('Validation Error', 'Please enter a message')
      return
    }

    setSending(true)

    try {
      const selectedUser = funJumpers.find(u => u.uid === selectedUserId)

      const messageData: CreateMessage = {
        recipientType,
        recipientId: recipientType === 'individual' ? selectedUserId : undefined,
        recipientName: recipientType === 'individual' ? selectedUser?.displayName : undefined,
        subject: subject.trim(),
        body: body.trim(),
        priority,
        requiresAcknowledgment: requiresAck
      }

      await MessageService.sendMessage(
        userProfile.uid,
        userProfile.displayName,
        userProfile.role as 'admin' | 'manifest',
        messageData
      )

      toast.success(
        'Message Sent!',
        recipientType === 'broadcast'
          ? `Broadcast sent to ${funJumpers.length} fun jumpers`
          : `Message sent to ${selectedUser?.displayName}`
      )

      // Reset form
      setSelectedUserId('')
      setSubject('')
      setBody('')
      setPriority('normal')
      setRequiresAck(false)
    } catch (error: any) {
      toast.error('Failed to Send', error.message)
    } finally {
      setSending(false)
    }
  }

  // Handle delete message
  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return

    try {
      await MessageService.deleteMessage(messageId)
      toast.success('Message Deleted', 'Message has been removed')
    } catch (error: any) {
      toast.error('Failed to Delete', error.message)
    }
  }

  // Calculate message stats
  const getMessageStats = (message: Message) => {
    const readCount = message.readBy ? Object.keys(message.readBy).length : 0
    const ackCount = message.acknowledgedBy ? Object.keys(message.acknowledgedBy).length : 0
    const totalRecipients = message.recipientType === 'broadcast' ? funJumpers.length : 1

    return { readCount, ackCount, totalRecipients }
  }

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Messages</h1>
          <p className="text-slate-400">Send messages to fun jumpers</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compose Message Panel */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Compose Message</h2>

            <div className="space-y-4">
              {/* Recipient Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Recipient Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipientType('individual')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      recipientType === 'individual'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType('broadcast')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      recipientType === 'broadcast'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Broadcast to All
                  </button>
                </div>
              </div>

              {/* Recipient Selection (Individual only) */}
              {recipientType === 'individual' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Select Fun Jumper</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a fun jumper --</option>
                    {funJumpers.map(user => (
                      <option key={user.uid} value={user.uid}>
                        {user.displayName} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Broadcast Info */}
              {recipientType === 'broadcast' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-sm text-blue-300">
                    This message will be sent to <strong>{funJumpers.length} active fun jumpers</strong>
                  </p>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter message subject..."
                  maxLength={100}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">{subject.length}/100</p>
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter your message..."
                  rows={6}
                  maxLength={1000}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{body.length}/1000</p>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority('normal')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      priority === 'normal'
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('urgent')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      priority === 'urgent'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Urgent
                  </button>
                </div>
              </div>

              {/* Requires Acknowledgment */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresAck}
                    onChange={(e) => setRequiresAck(e.target.checked)}
                    className="mt-1 w-5 h-5 text-orange-500 bg-slate-900 border-slate-600 rounded focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-300">Require Acknowledgment</p>
                    <p className="text-xs text-orange-200/70 mt-1">
                      Recipients must acknowledge this message before they can submit new load requests
                    </p>
                  </div>
                </label>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !body.trim() || (recipientType === 'individual' && !selectedUserId)}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Message History Panel */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Message History</h2>
              <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium">
                {filteredMessages.length} messages
              </span>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4 overflow-x-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  filter === 'all' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('individual')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  filter === 'individual' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Individual
              </button>
              <button
                onClick={() => setFilter('broadcast')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  filter === 'broadcast' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Broadcast
              </button>
              <button
                onClick={() => setFilter('requires_ack')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  filter === 'requires_ack' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Requires Ack
              </button>
            </div>

            {/* Message List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {messagesLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-slate-400">Loading messages...</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">No messages found</p>
                </div>
              ) : (
                filteredMessages.map(message => {
                  const stats = getMessageStats(message)
                  const isExpanded = expandedMessageId === message.id

                  return (
                    <div
                      key={message.id}
                      className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-blue-500/50 transition-all"
                    >
                      {/* Message Header */}
                      <div
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => setExpandedMessageId(isExpanded ? null : message.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-semibold">{message.subject}</h3>
                            {message.priority === 'urgent' && (
                              <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-xs font-medium">
                                URGENT
                              </span>
                            )}
                            {message.requiresAcknowledgment && (
                              <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-xs font-medium">
                                Requires Ack
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              message.recipientType === 'broadcast'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {message.recipientType === 'broadcast' ? 'Broadcast' : message.recipientName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {formatTimestamp(message.createdAt)} • By {message.senderName}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(message.id)
                          }}
                          className="text-red-400 hover:text-red-300 px-2 py-1"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* Message Stats */}
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-slate-400">
                          Read: <span className="text-green-400 font-medium">{stats.readCount}/{stats.totalRecipients}</span>
                        </span>
                        {message.requiresAcknowledgment && (
                          <span className="text-slate-400">
                            Ack: <span className="text-orange-400 font-medium">{stats.ackCount}/{stats.totalRecipients}</span>
                          </span>
                        )}
                      </div>

                      {/* Message Body (Expandable) */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <p className="text-slate-300 text-sm whitespace-pre-wrap">{message.body}</p>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <RequireRole allowedRoles={['admin', 'manifest']}>
      <MessagesPageContent />
    </RequireRole>
  )
}
