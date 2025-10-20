// src/components/EditStudentModal.tsx - Updated to edit Student ID

'use client'

import React, { useState, useEffect } from 'react'
import { db } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type { QueueStudent, JumpType, AFFLevel, StudentAccount } from '@/types'

interface EditStudentModalProps {
  student: QueueStudent
  onClose: () => void
}

export function EditStudentModal({ student, onClose }: EditStudentModalProps) {
  const toast = useToast()
  const [studentAccount, setStudentAccount] = useState<StudentAccount | null>(null)
  const [studentId, setStudentId] = useState('')
  const [name, setName] = useState(student.name)
  const [weight, setWeight] = useState(student.weight)
  const [jumpType, setJumpType] = useState<JumpType>(student.jumpType)
  const [weightTax, setWeightTax] = useState(student.tandemWeightTax || 0)
  const [handcam, setHandcam] = useState(student.tandemHandcam || false)
  const [outsideVideo, setOutsideVideo] = useState(student.outsideVideo || false)
  const [affLevel, setAffLevel] = useState<AFFLevel>(student.affLevel || 'lower')
  const [isRequest, setIsRequest] = useState(student.isRequest || false)
  const [loading, setLoading] = useState(false)
  const [loadingAccount, setLoadingAccount] = useState(true)

  // Fetch the student account
  useEffect(() => {
    const fetchAccount = async () => {
      if (student.studentAccountId) {
        try {
          const account = await db.getStudentAccountById(student.studentAccountId)
          setStudentAccount(account)
          if (account) {
            setStudentId(account.studentId || '')
          }
        } catch (error) {
          console.error('Failed to fetch student account:', error)
        }
      }
      setLoadingAccount(false)
    }
    fetchAccount()
  }, [student.studentAccountId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || weight < 100) {
      toast.error('Please fill in all required fields correctly')
      return
    }

    setLoading(true)
    try {
      // Update the student account if it exists and studentId changed
      if (studentAccount && studentId !== studentAccount.studentId) {
        await db.updateStudentAccount(studentAccount.id, {
          studentId: studentId.trim()
        })
      }

      // Update the student account's name and weight if changed
      if (studentAccount) {
        await db.updateStudentAccount(studentAccount.id, {
          name: name.trim(),
          weight: weight
        })
      }

      // Remove old queue entry
      await db.removeFromQueue(student.id)
      
      // Add updated queue entry
      await db.addToQueue({
        studentAccountId: student.studentAccountId,
        name: name.trim(),
        weight,
        jumpType: jumpType === 'video' ? 'tandem' : jumpType,
        isRequest,
        tandemWeightTax: jumpType === 'tandem' ? weightTax : undefined,
        tandemHandcam: jumpType === 'tandem' ? handcam : undefined,
        outsideVideo: jumpType === 'tandem' ? outsideVideo : undefined,
        affLevel: jumpType === 'aff' ? affLevel : undefined,
      })

      onClose()
    } catch (error) {
      console.error('Failed to update student:', error)
      toast.error('Failed to update student', 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingAccount) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto"></div>
          <p className="text-white mt-4">Loading student info...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Edit Student</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Student ID */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Student ID <span className="text-slate-500">(Optional - for linking to other systems)</span>
            </label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g., M1234, STU-456"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Student Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter student name"
              required
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Weight (lbs) *
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              min="100"
              max="400"
              required
            />
          </div>

          {/* Jump Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Jump Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setJumpType('tandem')}
                className={`py-3 rounded-lg font-medium transition-all ${
                  jumpType === 'tandem'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                Tandem
              </button>
              <button
                type="button"
                onClick={() => setJumpType('aff')}
                className={`py-3 rounded-lg font-medium transition-all ${
                  jumpType === 'aff'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                AFF
              </button>
            </div>
          </div>

          {/* Tandem Options */}
          {jumpType === 'tandem' && (
            <div className="space-y-3 bg-slate-700/50 p-4 rounded-lg">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Weight Tax
                </label>
                <input
                  type="number"
                  value={weightTax}
                  onChange={(e) => setWeightTax(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  min="0"
                  max="10"
                />
              </div>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={handcam}
                  onChange={(e) => setHandcam(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
                />
                <span className="text-slate-300">📹 Handcam</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={outsideVideo}
                  onChange={(e) => setOutsideVideo(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
                />
                <span className="text-slate-300">🎥 Outside Video</span>
              </label>
            </div>
          )}

          {/* AFF Options */}
          {jumpType === 'aff' && (
            <div className="space-y-3 bg-slate-700/50 p-4 rounded-lg">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                AFF Level
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAffLevel('lower')}
                  className={`py-2 rounded-lg font-medium transition-all ${
                    affLevel === 'lower'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Lower
                </button>
                <button
                  type="button"
                  onClick={() => setAffLevel('upper')}
                  className={`py-2 rounded-lg font-medium transition-all ${
                    affLevel === 'upper'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Upper
                </button>
              </div>
            </div>
          )}

          {/* Request Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-700/50 rounded-lg">
            <input
              type="checkbox"
              checked={isRequest}
              onChange={(e) => setIsRequest(e.target.checked)}
              className="w-5 h-5 text-yellow-600 bg-slate-800 border-slate-600 rounded focus:ring-yellow-500"
            />
            <span className="text-slate-300">⭐ This is a requested jump</span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}