// src/components/AddToQueueModal.tsx
// ✅ UPDATED: Removed request checkbox - requests now marked at assignment time

'use client'

import React, { useState } from 'react'
import { X, UserCheck } from 'lucide-react'
import { StudentAccountModal } from './StudentAccountModal'
import { useActiveStudentAccounts, useCreateStudentAccount, useUpdateStudentAccount } from '@/hooks/useStudentAccounts'
import { useAddToQueue } from '@/hooks/useDatabase'
import { useToast } from '@/contexts/ToastContext'
import { validateStudentWeight, validateWeightTax } from '@/lib/validation'
import type { StudentAccount, CreateQueueStudent } from '@/types'

interface AddToQueueModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddToQueueModal({ isOpen, onClose, onSuccess }: AddToQueueModalProps) {
  const { data: studentAccounts } = useActiveStudentAccounts()
  const { create: createAccount } = useCreateStudentAccount()
  const { update: updateAccount } = useUpdateStudentAccount()
  const { add: addToQueue } = useAddToQueue()
  const toast = useToast()

  const [showAccountModal, setShowAccountModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<StudentAccount | null>(null)
  
  // Queue-specific form data (overrides)
  const [queueData, setQueueData] = useState({
    weight: 0,  // Will be set from account
    jumpType: 'tandem' as 'tandem' | 'aff',
    tandemWeightTax: 0,
    tandemHandcam: false,
    outsideVideo: false,
    affLevel: 'lower' as 'upper' | 'lower'
  })
  
  const handleSelectAccount = (account: StudentAccount) => {
    setSelectedAccount(account)
    setQueueData({
      ...queueData,
      weight: account.weight,
      jumpType: account.preferredJumpType || 'tandem',
      affLevel: account.affLevel || 'lower'
    })
    setShowAccountModal(false)
  }
  
  const handleAddToQueue = async () => {
    // Validate account selected
    if (!selectedAccount) {
      toast.error('Please select a student account first')
      return
    }

    // Validate weight
    const weightValidation = validateStudentWeight(queueData.weight)
    if (!weightValidation.isValid) {
      toast.error(weightValidation.error!)
      return
    }

    // Validate weight tax for tandem
    if (queueData.jumpType === 'tandem') {
      const taxValidation = validateWeightTax(queueData.tandemWeightTax)
      if (!taxValidation.isValid) {
        toast.error(taxValidation.error!)
        return
      }
    }

    const queueStudent: CreateQueueStudent = {
      studentAccountId: selectedAccount.id,
      name: selectedAccount.name,
      weight: queueData.weight,
      jumpType: queueData.jumpType,
      isRequest: false, // ✅ Always false - requests are marked at assignment time
      tandemWeightTax: queueData.jumpType === 'tandem' ? queueData.tandemWeightTax : undefined,
      tandemHandcam: queueData.jumpType === 'tandem' ? queueData.tandemHandcam : undefined,
      outsideVideo: queueData.jumpType === 'tandem' ? queueData.outsideVideo : undefined,
      affLevel: queueData.jumpType === 'aff' ? queueData.affLevel : undefined
    }

    try {
      await addToQueue(queueStudent)
      toast.success('Student added to queue', `${selectedAccount.name} - ${queueData.jumpType.toUpperCase()}`)
      onSuccess()
    } catch (error) {
      console.error('Failed to add to queue:', error)
      toast.error('Failed to add student to queue')
    }
  }
  
  if (!isOpen) return null
  
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div
          className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-700 flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-queue-modal-title"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h2 id="add-to-queue-modal-title" className="text-xl font-bold text-white">Add Student to Queue</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Student Account Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Student Account
              </label>
              {selectedAccount ? (
                <div className="bg-slate-900 border-2 border-blue-500 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="w-5 h-5 text-blue-400" />
                        <h3 className="text-white font-semibold">{selectedAccount.name}</h3>
                      </div>
                      <div className="text-sm text-slate-400">
                        ID: {selectedAccount.studentId} • Total Jumps: {selectedAccount.totalJumps}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAccountModal(true)}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="w-full py-3 bg-slate-900 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-lg text-slate-400 hover:text-blue-400 transition-all"
                >
                  Click to select student account
                </button>
              )}
            </div>
            
            {selectedAccount && (
              <>
                {/* Jump Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Jump Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setQueueData({ ...queueData, jumpType: 'tandem' })}
                      className={`py-3 rounded-lg font-medium transition-all ${
                        queueData.jumpType === 'tandem'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      Tandem
                    </button>
                    <button
                      onClick={() => setQueueData({ ...queueData, jumpType: 'aff' })}
                      className={`py-3 rounded-lg font-medium transition-all ${
                        queueData.jumpType === 'aff'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      AFF
                    </button>
                  </div>
                </div>
                
                {/* Weight */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    value={queueData.weight}
                    onChange={(e) => setQueueData({ ...queueData, weight: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                
                {/* Tandem-specific fields */}
                {queueData.jumpType === 'tandem' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Weight Tax
                      </label>
                      <input
                        type="number"
                        value={queueData.tandemWeightTax}
                        onChange={(e) => setQueueData({ ...queueData, tandemWeightTax: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={queueData.tandemHandcam}
                          onChange={(e) => setQueueData({ ...queueData, tandemHandcam: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-slate-900 border-slate-700 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-300">Handcam</span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={queueData.outsideVideo}
                          onChange={(e) => setQueueData({ ...queueData, outsideVideo: e.target.checked })}
                          className="w-4 h-4 text-blue-600 bg-slate-900 border-slate-700 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-300">Outside Video</span>
                      </label>
                    </div>
                  </div>
                )}
                
                {/* AFF-specific fields */}
                {queueData.jumpType === 'aff' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      AFF Level
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setQueueData({ ...queueData, affLevel: 'lower' })}
                        className={`py-2 rounded-lg font-medium transition-all ${
                          queueData.affLevel === 'lower'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        Lower (1-4)
                      </button>
                      <button
                        onClick={() => setQueueData({ ...queueData, affLevel: 'upper' })}
                        className={`py-2 rounded-lg font-medium transition-all ${
                          queueData.affLevel === 'upper'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        Upper (5-7)
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-6 border-t border-slate-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToQueue}
              disabled={!selectedAccount}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
            >
              Add to Queue
            </button>
          </div>
        </div>
      </div>
      
      {/* Student Account Selection Modal */}
      <StudentAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onSelectAccount={handleSelectAccount}
        accounts={studentAccounts}
        onCreateAccount={async (account) => { await createAccount(account); }}
        onUpdateAccount={async (id, updates) => { await updateAccount(id, updates); }}
      />
    </>
  )
}