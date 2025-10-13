'use client'

import React, { useState } from 'react'
import { useAddToQueue } from '@/hooks/useDatabase'
import type { JumpType, AFFLevel } from '@/types'

interface AddStudentModalProps {
  queueType: 'tandem' | 'aff'
  onClose: () => void
}

export function AddStudentModal({ queueType, onClose }: AddStudentModalProps) {
  const { add, loading } = useAddToQueue()
  
  const [name, setName] = useState('')
  const [weight, setWeight] = useState('')
  const [jumpType, setJumpType] = useState<JumpType>(queueType)
  const [weightTax, setWeightTax] = useState(0)
  const [handcam, setHandcam] = useState(false)
  const [outsideVideo, setOutsideVideo] = useState(false)
  const [affLevel, setAffLevel] = useState<AFFLevel>('lower')
  const [isRequest, setIsRequest] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !weight) {
      alert('Please fill in student name and weight')
      return
    }
    
    try {
      await add({
        name: name.trim(),
        weight: parseFloat(weight),
        jumpType,
        isRequest,
        ...(jumpType === 'tandem' ? {
          tandemWeightTax: weightTax,
          tandemHandcam: handcam,
          outsideVideo: outsideVideo,
        } : {
          affLevel: affLevel,
        })
      })
      
      onClose()
    } catch (error) {
      console.error('Failed to add student:', error)
      alert('Failed to add student. Please try again.')
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-white/20">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Add Student to Queue</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Student Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter name"
              />
            </div>
            
            {/* Weight */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Weight (lbs)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter weight"
              />
            </div>
            
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
                
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handcam}
                      onChange={(e) => setHandcam(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-slate-300 font-medium">Handcam (+$30)</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outsideVideo}
                      onChange={(e) => setOutsideVideo(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-slate-300 font-medium">Outside Video (requires video instructor)</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRequest}
                      onChange={(e) => setIsRequest(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-slate-300 font-medium">Requested (won't count toward balance)</span>
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
            
            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add to Queue'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
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