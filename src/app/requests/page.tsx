// src/app/requests/page.tsx
// Fun Jumper Request Management Page (Manifest/Admin Only)
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { FunJumperRequestService } from '@/lib/funJumperRequests'
import { useRequestsData } from '@/hooks/useRequestsData'
import type { FunJumperRequest } from '@/types'
import { RequireRole } from '@/components/auth'

function RequestsPageContent() {
  const { user, userProfile } = useAuth()
  const toast = useToast()

  // Use combined hook for better performance
  const { requests: serverRequests, loads, loading } = useRequestsData()

  const [requests, setRequests] = useState(serverRequests)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<FunJumperRequest | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [recentActivity, setRecentActivity] = useState<Array<{id: string, message: string, time: number}>>([])

  // Sync server data to local state
  useEffect(() => {
    setRequests(serverRequests)
  }, [serverRequests])

  // Detect recent activity (live status updates)
  useEffect(() => {
    if (serverRequests.length === 0) return

    const now = Date.now()
    const recentThreshold = 60000 // 1 minute

    const recent = serverRequests
      .filter(req => now - req.updatedAt < recentThreshold)
      .map(req => {
        const lastHistory = req.history[req.history.length - 1]
        let message = ''

        if (lastHistory?.action === 'approved') {
          message = `${req.userName}'s request was approved by ${lastHistory.actorName}`
        } else if (lastHistory?.action === 'denied') {
          message = `${req.userName}'s request was denied by ${lastHistory.actorName}`
        } else if (lastHistory?.action === 'cancelled') {
          message = `${req.userName}'s request was cancelled`
        } else if (lastHistory?.action === 'created') {
          message = `${req.userName} submitted a new request`
        }

        return {
          id: req.id,
          message,
          time: req.updatedAt
        }
      })
      .sort((a, b) => b.time - a.time)
      .slice(0, 3) // Show max 3 recent activities

    setRecentActivity(recent)
  }, [serverRequests])

  // Filter and search requests (memoized for performance)
  const filteredRequests = useMemo(() => {
    return requests
      .filter(req => {
        // Status filter
        if (filter === 'pending') return req.status === 'pending'
        if (filter === 'approved') return req.status === 'approved'
        return true // 'all'
      })
      .filter(req => {
        // Search filter
        if (!searchTerm) return true
        const search = searchTerm.toLowerCase()
        return (
          req.userName.toLowerCase().includes(search) ||
          req.jumprunId?.toLowerCase().includes(search) ||
          req.skyDiveType.toLowerCase().includes(search)
        )
      })
  }, [requests, filter, searchTerm])

  // Handle approve with optimistic update
  const handleApprove = async (request: FunJumperRequest, loadId: string) => {
    if (!userProfile) return

    setActionLoading(true)

    // Optimistic update
    const optimisticRequests = requests.map(r =>
      r.id === request.id
        ? { ...r, status: 'approved' as const, assignedLoadId: loadId, updatedAt: Date.now() }
        : r
    )
    setRequests(optimisticRequests)
    setSelectedRequest(null)

    try {
      await FunJumperRequestService.approveRequest(
        request.id,
        loadId,
        userProfile.uid,
        userProfile.displayName,
        `Approved for load`
      )

      toast.success('Request Approved', `${request.userName} assigned to load`)
    } catch (error: any) {
      // Rollback on error
      setRequests(serverRequests)
      toast.error('Approval Failed', error.message)
      setSelectedRequest(request) // Reopen modal
    } finally {
      setActionLoading(false)
    }
  }

  // Handle deny with optimistic update
  const handleDeny = async (request: FunJumperRequest, reason: string) => {
    if (!userProfile) return

    setActionLoading(true)

    // Optimistic update
    const optimisticRequests = requests.map(r =>
      r.id === request.id
        ? { ...r, status: 'denied' as const, updatedAt: Date.now() }
        : r
    )
    setRequests(optimisticRequests)
    setSelectedRequest(null)

    try {
      await FunJumperRequestService.denyRequest(
        request.id,
        userProfile.uid,
        userProfile.displayName,
        reason
      )

      toast.success('Request Denied', `Request from ${request.userName} denied`)
    } catch (error: any) {
      // Rollback on error
      setRequests(serverRequests)
      toast.error('Denial Failed', error.message)
      setSelectedRequest(request) // Reopen modal
    } finally {
      setActionLoading(false)
    }
  }

  // Handle approve cancellation with optimistic update
  const handleApproveCancellation = async (request: FunJumperRequest) => {
    if (!userProfile) return

    setActionLoading(true)

    // Optimistic update
    const optimisticRequests = requests.map(r =>
      r.id === request.id
        ? { ...r, status: 'cancelled' as const, cancellationRequested: false, updatedAt: Date.now() }
        : r
    )
    setRequests(optimisticRequests)

    try {
      await FunJumperRequestService.approveCancellation(
        request.id,
        userProfile.uid,
        userProfile.displayName
      )

      toast.success('Cancellation Approved', `Request cancelled`)
    } catch (error: any) {
      // Rollback on error
      setRequests(serverRequests)
      toast.error('Cancellation Failed', error.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Get load name
  const getLoadName = (loadId: string): string => {
    const load = loads.find(l => l.id === loadId)
    return load ? `Load ${load.position + 1}` : 'Unknown Load'
  }

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Format relative time for recent activity
  const formatRelativeTime = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    return formatTime(timestamp)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">Fun Jumper Requests</h1>
          <p className="text-slate-400">Manage jump requests from fun jumpers</p>
        </div>

        {/* Live Activity Feed */}
        {recentActivity.length > 0 && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <h3 className="text-sm font-semibold text-blue-300">Recent Activity</h3>
            </div>
            <div className="space-y-2">
              {recentActivity.map(activity => (
                <div key={activity.id} className="flex items-center justify-between text-sm">
                  <p className="text-blue-200">{activity.message}</p>
                  <p className="text-blue-400/60 text-xs">{formatRelativeTime(activity.time)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search Bar */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, jumprun ID, or jump type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'pending'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Pending ({requests.filter(r => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Approved ({requests.filter(r => r.status === 'approved').length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All ({requests.length})
            </button>
          </div>
        </div>

        {/* Results Count */}
        {searchTerm && (
          <p className="text-sm text-slate-400 mb-4">
            Found {filteredRequests.length} result{filteredRequests.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-white/10">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-slate-400">
              {searchTerm
                ? 'No requests match your search'
                : `No ${filter !== 'all' ? filter : ''} requests`
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredRequests.map(request => (
              <div
                key={request.id}
                className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-white/10 p-6 hover:border-blue-500/50 transition-all cursor-pointer"
                onClick={() => setSelectedRequest(request)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{request.userName}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        request.status === 'pending'
                          ? 'bg-orange-500/20 text-orange-300'
                          : request.status === 'approved'
                          ? 'bg-green-500/20 text-green-300'
                          : request.status === 'denied'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {request.status.toUpperCase()}
                      </span>
                      {request.cancellationRequested && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300">
                          ⚠️ CANCELLATION REQUESTED
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Jumprun ID</p>
                        <p className="text-white font-medium">{request.jumprunId || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Jump Type</p>
                        <p className="text-white font-medium">
                          {request.skyDiveType.replace('_', ' ').toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Requested Loads</p>
                        <p className="text-white font-medium">
                          {request.requestedLoadIds.map(getLoadName).join(', ')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Submitted</p>
                        <p className="text-white font-medium">{formatTime(request.createdAt)}</p>
                      </div>
                    </div>

                    {request.notes && (
                      <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
                        <p className="text-sm text-slate-300">{request.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    {request.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedRequest(request)
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
                      >
                        Review
                      </button>
                    )}
                    {request.cancellationRequested && request.status === 'approved' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleApproveCancellation(request)
                        }}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                      >
                        Approve Cancellation
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for request details/actions */}
      {selectedRequest && selectedRequest.status === 'pending' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl border border-white/10 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-white">Review Request</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-slate-400">Jumper</p>
                <p className="text-lg font-semibold text-white">{selectedRequest.userName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Jump Type</p>
                <p className="text-lg text-white">{selectedRequest.skyDiveType.replace('_', ' ').toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-2">Assign to Load</p>
                <div className="grid gap-2">
                  {selectedRequest.requestedLoadIds.map(loadId => {
                    const load = loads.find(l => l.id === loadId)
                    if (!load) return null

                    return (
                      <button
                        key={loadId}
                        onClick={() => handleApprove(selectedRequest, loadId)}
                        disabled={actionLoading}
                        className="flex justify-between items-center p-4 bg-slate-900/50 hover:bg-blue-900/30 rounded-lg transition-all text-left disabled:opacity-50"
                      >
                        <span className="text-white font-medium">{getLoadName(loadId)}</span>
                        <span className="text-sm text-slate-400">
                          {load.status === 'building' ? 'Building' : 'Ready'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDeny(selectedRequest, 'Request denied by manifest')}
                disabled={actionLoading}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                Deny Request
              </button>
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


export default function RequestsPage() {
  return (
    <RequireRole roles={["admin", "manifest"]}>
      <RequestsPageContent />
    </RequireRole>
  )
}
