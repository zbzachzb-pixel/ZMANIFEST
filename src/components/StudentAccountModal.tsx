// src/components/StudentAccountModal.tsx
'use client'

import React, { useState, useMemo } from 'react'
import { X, Search, UserPlus, Edit2, Users } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import type { StudentAccount, CreateStudentAccount } from '@/types'

interface StudentAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectAccount: (account: StudentAccount) => void
  accounts: StudentAccount[]
  onCreateAccount: (account: CreateStudentAccount) => Promise<void>
  onUpdateAccount: (id: string, updates: Partial<StudentAccount>) => Promise<void>
}

export function StudentAccountModal({
  isOpen,
  onClose,
  onSelectAccount,
  accounts,
  onCreateAccount,
  onUpdateAccount
}: StudentAccountModalProps) {
  const toast = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [mode, setMode] = useState<'search' | 'create' | 'edit'>('search')
  const [editingAccount, setEditingAccount] = useState<StudentAccount | null>(null)
  
  // Form state for create/edit
  const [formData, setFormData] = useState<Partial<CreateStudentAccount>>({
    studentId: '',
    name: '',
    email: '',
    phone: '',
    weight: undefined,
    preferredJumpType: 'tandem'
  })
  
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts
    
    const query = searchQuery.toLowerCase()
    return accounts.filter(account => 
      account.name.toLowerCase().includes(query) ||
      account.studentId.toLowerCase().includes(query) ||
      account.email?.toLowerCase().includes(query) ||
      account.phone?.includes(searchQuery)
    )
  }, [accounts, searchQuery])
  
  const handleCreateAccount = async () => {
    if (!formData.studentId || !formData.name || !formData.weight) {
      toast.error('Please fill in required fields', 'Student ID, Name, and Weight are required')
      return
    }
    
    await onCreateAccount(formData as CreateStudentAccount)
    setMode('search')
    setFormData({
      studentId: '',
      name: '',
      email: '',
      phone: '',
      weight: undefined,
      preferredJumpType: 'tandem'
    })
  }
  
  const handleUpdateAccount = async () => {
    if (!editingAccount) return
    
    await onUpdateAccount(editingAccount.id, formData)
    setMode('search')
    setEditingAccount(null)
    setFormData({
      studentId: '',
      name: '',
      email: '',
      phone: '',
      weight: undefined,
      preferredJumpType: 'tandem'
    })
  }
  
  const startEdit = (account: StudentAccount) => {
    setEditingAccount(account)
    setFormData({
      studentId: account.studentId,
      name: account.name,
      email: account.email,
      phone: account.phone,
      weight: account.weight,
      preferredJumpType: account.preferredJumpType,
      affLevel: account.affLevel,
      notes: account.notes
    })
    setMode('edit')
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-white">
                {mode === 'create' ? 'Create New Student Account' : 
                 mode === 'edit' ? 'Edit Student Account' : 
                 'Select Student Account'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {mode === 'search' ? 'Search existing accounts or create a new one' : 
                 'All fields marked with * are required'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* SEARCH MODE */}
          {mode === 'search' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, student ID, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  autoFocus
                />
              </div>
              
              {/* Create New Button */}
              <button
                onClick={() => setMode('create')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                Create New Student Account
              </button>
              
              {/* Results */}
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''} found
                </p>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredAccounts.map(account => (
                    <div
                      key={account.id}
                      className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex-1"
                          onClick={() => onSelectAccount(account)}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-semibold">{account.name}</h3>
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded">
                              ID: {account.studentId}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
                            <div>Weight: {account.weight} lbs</div>
                            <div>Total Jumps: {account.totalJumps}</div>
                            {account.email && <div>Email: {account.email}</div>}
                            {account.phone && <div>Phone: {account.phone}</div>}
                          </div>
                          
                          {account.notes && (
                            <p className="text-sm text-slate-500 mt-2 italic">{account.notes}</p>
                          )}
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(account)
                          }}
                          className="p-2 hover:bg-slate-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {filteredAccounts.length === 0 && searchQuery && (
                    <div className="text-center py-12">
                      <p className="text-slate-400 mb-4">No accounts found matching "{searchQuery}"</p>
                      <button
                        onClick={() => setMode('create')}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Create new account instead?
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* CREATE/EDIT MODE */}
          {(mode === 'create' || mode === 'edit') && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Student ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Student ID * <span className="text-slate-500">(Editable)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    placeholder="e.g., M1234, STU-456"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                
                {/* Weight */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Weight (lbs) *
                  </label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                
                {/* Preferred Jump Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Preferred Jump Type
                  </label>
                  <select
                    value={formData.preferredJumpType}
                    onChange={(e) => setFormData({ ...formData, preferredJumpType: e.target.value as 'tandem' | 'aff' })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="tandem">Tandem</option>
                    <option value="aff">AFF</option>
                  </select>
                </div>
                
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                
                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special notes or requirements..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setMode('search')
                    setEditingAccount(null)
                    setFormData({
                      studentId: '',
                      name: '',
                      email: '',
                      phone: '',
                      weight: undefined,
                      preferredJumpType: 'tandem'
                    })
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={mode === 'create' ? handleCreateAccount : handleUpdateAccount}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  {mode === 'create' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}