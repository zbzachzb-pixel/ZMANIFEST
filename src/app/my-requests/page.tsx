// src/app/my-requests/page.tsx
// Page for fun jumpers to view their submitted requests

'use client'

import { useRouter } from 'next/navigation'
import { useMyRequests } from '@/hooks/useMyRequests'
import { RequireAuth } from '@/components/auth'
import type { RequestStatus, SkyDiveType } from '@/types'

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30' },
  approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' },
  denied: { label: 'Denied', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', bgColor: 'bg-gray-500/20 border-gray-500/30' },
  completed: { label: 'Completed', color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' }
}

const SKYDIVE_TYPE_ICONS: Record<SkyDiveType, string> = {
  hop_n_pop: '🪂',
  team_pass: '👥',
  full_altitude: '⬆️',
  high_pull: '☁️',
  wingsuit: '🦅'
}

const SKYDIVE_TYPE_LABELS: Record<SkyDiveType, string> = {
  hop_n_pop: 'Hop & Pop',
  team_pass: 'Team Pass',
  full_altitude: 'Full Altitude',
  high_pull: 'High Pull',
  wingsuit: 'Wingsuit'
}

function MyRequestsPageContent() {
  const router = useRouter()
  const { data: requests, loading, error, refresh } = useMyRequests()

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()

    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">My Jump Requests</h1>
              <p className="text-slate-400">View and track your fun jumper requests</p>
            </div>
            <button
              onClick={() => router.push('/submit-request')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <span>✈️</span>
              <span>New Request</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading requests...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 font-semibold mb-2">Error loading requests</p>
            <p className="text-red-300 text-sm mb-4">{error.message}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && requests.length === 0 && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-6xl mb-4">🪂</div>
            <h2 className="text-2xl font-bold text-white mb-2">No requests yet</h2>
            <p className="text-slate-400 mb-6">Submit your first jump request to get started!</p>
            <button
              onClick={() => router.push('/submit-request')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all inline-flex items-center gap-2"
            >
              <span>✈️</span>
              <span>Submit Request</span>
            </button>
          </div>
        )}

        {/* Requests List */}
        {!loading && !error && requests.length > 0 && (
          <div className="space-y-4">
            {requests.map((request) => {
              const statusConfig = STATUS_CONFIG[request.status]
              const icon = SKYDIVE_TYPE_ICONS[request.skyDiveType]
              const typeLabel = SKYDIVE_TYPE_LABELS[request.skyDiveType]

              return (
                <div
                  key={request.id}
                  className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6 hover:border-blue-500/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{icon}</div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{typeLabel}</h3>
                        <p className="text-sm text-slate-400">{formatDate(request.createdAt)}</p>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-lg border ${statusConfig.bgColor}`}>
                      <span className={`font-semibold ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Request Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Requested Loads</p>
                      <p className="text-white">
                        {request.requestedLoadIds.length} load{request.requestedLoadIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {request.assignedLoadId && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Assigned To</p>
                        <p className="text-green-400 font-semibold">Load {request.assignedLoadId}</p>
                      </div>
                    )}
                    {request.jumprunId && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Jumprun ID</p>
                        <p className="text-white">{request.jumprunId}</p>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {request.notes && (
                    <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-slate-500 mb-1">Notes</p>
                      <p className="text-slate-300 text-sm">{request.notes}</p>
                    </div>
                  )}

                  {/* Approval/Denial Info */}
                  {request.status === 'approved' && request.approvedByName && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <p className="text-green-400 text-sm">
                        <strong>Approved by:</strong> {request.approvedByName}
                      </p>
                      {request.approvalNote && (
                        <p className="text-green-300 text-sm mt-1">{request.approvalNote}</p>
                      )}
                    </div>
                  )}

                  {request.status === 'denied' && request.deniedByName && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <p className="text-red-400 text-sm">
                        <strong>Denied by:</strong> {request.deniedByName}
                      </p>
                      {request.denialReason && (
                        <p className="text-red-300 text-sm mt-1">{request.denialReason}</p>
                      )}
                    </div>
                  )}

                  {request.status === 'cancelled' && request.cancelledByName && (
                    <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3">
                      <p className="text-gray-400 text-sm">
                        <strong>Cancelled by:</strong> {request.cancelledByName}
                      </p>
                      {request.cancellationReason && (
                        <p className="text-gray-300 text-sm mt-1">{request.cancellationReason}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Stats Summary */}
        {!loading && !error && requests.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
              const count = requests.filter(r => r.status === status).length
              return (
                <div
                  key={status}
                  className={`${config.bgColor} border rounded-xl p-4 text-center`}
                >
                  <div className={`text-2xl font-bold ${config.color}`}>{count}</div>
                  <div className="text-xs text-slate-400 mt-1">{config.label}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MyRequestsPage() {
  return (
    <RequireAuth>
      <MyRequestsPageContent />
    </RequireAuth>
  )
}
