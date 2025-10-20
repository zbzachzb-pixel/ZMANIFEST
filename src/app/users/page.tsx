// src/app/users/page.tsx
// User management page for admins

'use client'

import React, { useState, useMemo } from 'react'
import { useUsers } from '@/hooks/useUsers'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { db } from '@/services'
import { CreateUserModal } from '@/components/CreateUserModal'
import { EditUserModal } from '@/components/EditUserModal'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { RequireRole } from '@/components/auth'
import type { UserProfile, UserRole } from '@/types/funJumpers'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manifest: 'Manifest',
  instructor: 'Instructor',
  fun_jumper: 'Fun Jumper'
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-500/20 text-red-300 border-red-500/30',
  manifest: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  instructor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  fun_jumper: 'bg-green-500/20 text-green-300 border-green-500/30'
}

function UsersPageContent() {
  const { data: users, loading, refresh } = useUsers()
  const { user: currentUser } = useAuth()
  const toast = useToast()

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Filter and search users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        user.displayName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.jumprunId?.toLowerCase().includes(searchLower) ||
        false

      if (!matchesSearch) return false

      // Role filter
      if (roleFilter !== 'all' && user.role !== roleFilter) return false

      // Status filter
      if (statusFilter === 'active' && !user.isActive) return false
      if (statusFilter === 'inactive' && user.isActive) return false

      return true
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  // Stats
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
      byRole: {
        admin: users.filter(u => u.role === 'admin').length,
        manifest: users.filter(u => u.role === 'manifest').length,
        instructor: users.filter(u => u.role === 'instructor').length,
        fun_jumper: users.filter(u => u.role === 'fun_jumper').length
      }
    }
  }, [users])

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return

    // Prevent self-deletion
    if (deletingUser.uid === currentUser?.uid) {
      toast.error('Cannot delete yourself', 'You cannot delete your own account')
      setDeletingUser(null)
      return
    }

    setDeleteLoading(true)

    try {
      await db.deleteUserProfile(deletingUser.uid)
      toast.success('User deleted', `${deletingUser.displayName} has been removed from the system`)
      setDeletingUser(null)
      refresh()
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast.error('Delete failed', error instanceof Error ? error.message : 'Failed to delete user')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">👥 User Management</h1>
          <p className="text-slate-300">Manage user accounts, roles, and permissions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-3">
            <div className="text-slate-400 text-xs font-semibold mb-1">Total</div>
            <div className="text-white text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-green-500/10 backdrop-blur-lg rounded-lg border border-green-500/20 p-3">
            <div className="text-green-400 text-xs font-semibold mb-1">Active</div>
            <div className="text-white text-2xl font-bold">{stats.active}</div>
          </div>
          <div className="bg-red-500/10 backdrop-blur-lg rounded-lg border border-red-500/20 p-3">
            <div className="text-red-400 text-xs font-semibold mb-1">Inactive</div>
            <div className="text-white text-2xl font-bold">{stats.inactive}</div>
          </div>
          <div className="bg-red-500/10 backdrop-blur-lg rounded-lg border border-red-500/20 p-3">
            <div className="text-red-400 text-xs font-semibold mb-1">Admins</div>
            <div className="text-white text-2xl font-bold">{stats.byRole.admin}</div>
          </div>
          <div className="bg-blue-500/10 backdrop-blur-lg rounded-lg border border-blue-500/20 p-3">
            <div className="text-blue-400 text-xs font-semibold mb-1">Manifest</div>
            <div className="text-white text-2xl font-bold">{stats.byRole.manifest}</div>
          </div>
          <div className="bg-purple-500/10 backdrop-blur-lg rounded-lg border border-purple-500/20 p-3">
            <div className="text-purple-400 text-xs font-semibold mb-1">Instructors</div>
            <div className="text-white text-2xl font-bold">{stats.byRole.instructor}</div>
          </div>
          <div className="bg-green-500/10 backdrop-blur-lg rounded-lg border border-green-500/20 p-3">
            <div className="text-green-400 text-xs font-semibold mb-1">Fun Jumpers</div>
            <div className="text-white text-2xl font-bold">{stats.byRole.fun_jumper}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-white/20 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, email, or Jumprun ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                className="w-full md:w-40 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manifest">Manifest</option>
                <option value="instructor">Instructor</option>
                <option value="fun_jumper">Fun Jumper</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full md:w-40 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold rounded-lg transition-all shadow-lg text-sm flex items-center gap-2 justify-center"
            >
              <span>➕</span>
              <span>Create User</span>
            </button>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl border border-white/20 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-lg">No users found</p>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Jumprun ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((user) => {
                    const isSelf = user.uid === currentUser?.uid

                    return (
                      <tr key={user.uid} className="hover:bg-white/5 transition-colors">
                        {/* User Info */}
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              {user.displayName}
                              {isSelf && (
                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-400">{user.email}</div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              ROLE_COLORS[user.role]
                            }`}
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>

                        {/* Jumprun ID */}
                        <td className="px-4 py-3">
                          {user.jumprunId ? (
                            <span className="text-sm font-mono text-blue-300 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                              {user.jumprunId}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Last Login */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-400">
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : 'Never'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors text-xs font-semibold border border-blue-500/30"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => setDeletingUser(user)}
                              disabled={isSelf}
                              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors text-xs font-semibold border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={isSelf ? 'Cannot delete yourself' : 'Delete user'}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results count */}
        {filteredUsers.length > 0 && (
          <div className="mt-4 text-center text-sm text-slate-400">
            Showing {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            refresh()
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null)
            refresh()
          }}
        />
      )}

      {deletingUser && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Delete User"
          message={`Are you sure you want to delete ${deletingUser.displayName}? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingUser(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}

export default function UsersPage() {
  return (
    <RequireRole roles={['admin']}>
      <UsersPageContent />
    </RequireRole>
  )
}
