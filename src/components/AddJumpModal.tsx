'use client'

import React, { useState } from 'react'
import { useCreateAssignment } from '@/hooks/useDatabase'
import type { Instructor, JumpType, AFFLevel } from '@/types'

interface AddJumpModalProps {
  instructor: Instructor
  onClose: () => void
  onSuccess: () => void
}

export function AddJumpModal({ instructor, onClose, onSuccess }: AddJumpModalProps) {
  const { create, loading } = useCreateAssignment()
  
  const [jumpType, setJumpType] = useState<JumpType>('aff')
  const [weightTax, setWeightTax] = useState(0)
  const [handcam, setHandcam] = useState(false)
  const [affLevel, setAffLevel] = useState<AFFLevel>('lower')
  const [isRequest, setIsRequest] = useState(false)
  
  const calculatePay = () => {
    if (isRequest) return 0
    
    if (jumpType === 'tandem') {
      let pay = 40
      pay += weightTax * 20
      if (handcam) pay += 30
      return pay
    } else if (jumpType === 'aff') {
      return affLevel === 'lower' ? 55 : 45
    } else if (jumpType === 'video') {
      return 45
    }
    return 0
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const assignmentData: any = {
        instructorId: instructor.id,
        name: '(Additional Jump)',
        weight: 0,
        jumpType,
        isRequest,
      }
      
      if (jumpType === 'tandem') {
        assignmentData.tandemWeightTax = weightTax
        assignmentData.tandemHandcam = handcam
      } else if (jumpType === 'aff') {
        assignmentData.affLevel = affLevel
      }
      
      await create(assignmentData)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to add jump:', error)
      alert('Failed to add jump. Please try again.')
    }
  }
  
  const pay = calculatePay()
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-white/20">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">
            Add Jump for {instructor.name}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Jump Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Jump Type
              </label>
              <select
                value={jumpType}
                onChange={(e) => setJumpType(e.target.value as JumpType)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="tandem">Tandem</option>
                <option value="aff">AFF</option>
                <option value="video">Video</option>
              </select>
            </div>
            
            {/* Tandem-specific fields */}
            {jumpType === 'tandem' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Weight Tax
                  </label>
                  <select
                    value={weightTax}
                    onChange={(e) => setWeightTax(parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value={0}>None ($0)</option>
                    <option value={1}>1x (+$20)</option>
                    <option value={2}>2x (+$40)</option>
                  </select>
                </div>
                
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handcam}
                      onChange={(e) => setHandcam(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span className="text-slate-300 font-medium">Handcam (+$30)</span>
                  </label>
                </div>
                
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRequest}
                      onChange={(e) => setIsRequest(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span className="text-slate-300 font-medium">Requested (counts toward jumps only)</span>
                  </label>
                </div>
              </>
            )}
            
            {/* AFF-specific fields */}
            {jumpType === 'aff' && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  AFF Level
                </label>
                <select
                  value={affLevel}
                  onChange={(e) => setAffLevel(e.target.value as AFFLevel)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="lower">Lower ($55)</option>
                  <option value="upper">Upper ($45)</option>
                </select>
              </div>
            )}
            
            {/* Pay Display */}
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-white font-bold">
                {isRequest ? (
                  'Jump Pay: $0 (Request - counts toward jumps only)'
                ) : (
                  `Jump Pay: $${pay}`
                )}
              </p>
            </div>
            
            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Jump'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}