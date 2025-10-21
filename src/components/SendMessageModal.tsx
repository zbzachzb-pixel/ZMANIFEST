// src/components/SendMessageModal.tsx
// Quick send message modal for use in other pages

'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { MessageService } from '@/lib/messageService'
import type { CreateMessage, MessagePriority } from '@/types'

interface SendMessageModalProps {
  isOpen: boolean
  onClose: () => void
  recipientId: string
  recipientName: string
}

export function SendMessageModal({
  isOpen,
  onClose,
  recipientId,
  recipientName
}: SendMessageModalProps) {
  const { userProfile } = useAuth()
  const toast = useToast()

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<MessagePriority>('normal')
  const [requiresAck, setRequiresAck] = useState(false)
  const [sending, setSending] = useState(false)

  if (!isOpen) return null

  const handleClose = () => {
    setSubject('')
    setBody('')
    setPriority('normal')
    setRequiresAck(false)
    onClose()
  }

  const handleSend = async () => {
    if (!userProfile) return

    // Validation
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
      const messageData: CreateMessage = {
        recipientType: 'individual',
        recipientId,
        recipientName,
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

      toast.success('Message Sent!', `Message sent to ${recipientName}`)
      handleClose()
    } catch (error: any) {
      toast.error('Failed to Send', error.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Send Message</h2>
              <p className="text-slate-400 text-sm mt-1">To: {recipientName}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
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
                    Recipient must acknowledge this message before submitting new load requests
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleClose}
              disabled={sending}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim()}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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
      </div>
    </div>
  )
}
