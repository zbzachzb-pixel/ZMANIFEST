'use client'

import React, { useState } from 'react'
import { db } from '@/services'
import type { QueueStudent, JumpType, AFFLevel } from '@/types'

interface EditStudentModalProps {
  student: QueueStudent
  onClose: () => void
}

export function EditStudentModal({ student, onClose }: EditStudentModalProps) {
  const [name, setName] = useState(student.name)
  const [weight, setWeight] = useState(student.weight)
  const [jumpType, setJumpType] = useState<JumpType>(student.jumpType)
  const [weightTax, setWeightTax] = useState(student.tandemWeightTax || 0)
  const [handcam, setHandcam] = useState(student.tandemHandcam || false)
  const [outsideVideo, setOutsideVideo] = useState(student.outsideVideo || false)
  const [affLevel, setAffLevel] = useState<AFFLevel>(student.affLevel || 'lower')
  const [isRequest, setIsRequest] = useState(student.isRequest || false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || weight < 100) {
      alert('Please fill in all required fields correctly')
      return
    }

    setLoading(true)
    try {
      // Remove old student
      await db.removeFromQueue(student.id)
      
      // Add updated student
      await db.addToQueue({
        name: name.trim(),
        weight,
        jumpType,
        isRequest,
        tandemWeightTax: jumpType === 'tandem' ? weightTax : undefined,
        tandemHandcam: jumpType === 'tandem' ? handcam : undefined,
        outsideVideo: jumpType === 'tandem' ? outsideVideo : undefined,
        affLevel: jumpType === 'aff' ? affLevel : undefined,
      })

      onClose()
    } catch (error) {
      console.error('Failed to update student:', error)
      alert('Failed to update student. Please try again.')
    } finally {
      setLoading(false)
    }
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
              onChange={(e) => setWeight(parseInt(e.target.value))}
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
            <select
              value={jumpType}
              onChange={(e) => setJumpType(e.target.value as JumpType)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="tandem">Tandem</option>
              <option value="aff">AFF</option>
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
                  <option value={3}>3x (+$60)</option>
                  <option value={4}>4x (+$80)</option>
                  <option value={5}>5x (+$100)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="handcam"
                  checked={handcam}
                  onChange={(e) => setHandcam(e.target.checked)}
                  className="w-5 h-5 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="handcam" className="text-sm font-semibold text-slate-300 cursor-pointer">
                  Handcam (+$30)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="outsideVideo"
                  checked={outsideVideo}
                  onChange={(e) => setOutsideVideo(e.target.checked)}
                  className="w-5 h-5 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="outsideVideo" className="text-sm font-semibold text-slate-300 cursor-pointer">
                  Outside Video (+$45)
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
                <option value="lower">Lower (Levels 1-4) - $55</option>
                <option value="upper">Upper (Levels 5-7) - $45</option>
              </select>
            </div>
          )}

          {/* Request Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRequest"
              checked={isRequest}
              onChange={(e) => setIsRequest(e.target.checked)}
              className="w-5 h-5 bg-slate-700 border border-slate-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="isRequest" className="text-sm font-semibold text-slate-300 cursor-pointer">
              Request Jump (doesn't count toward balance)
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}