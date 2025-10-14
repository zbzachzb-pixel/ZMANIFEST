'use client'

import React, { useState, useEffect } from 'react'
import { useCreateInstructor } from '@/hooks/useDatabase'
import { db } from '@/services'
import type { Instructor, Team } from '@/types'

interface AddInstructorModalProps {
  instructor?: Instructor | null
  onClose: () => void
}

export function AddInstructorModal({ instructor, onClose }: AddInstructorModalProps) {
  const { create, loading: createLoading } = useCreateInstructor()
  const [loading, setLoading] = useState(false)
  
  const isEdit = !!instructor
  
  const [name, setName] = useState(instructor?.name || '')
  const [bodyWeight, setBodyWeight] = useState(instructor?.bodyWeight || 180)
  const [team, setTeam] = useState<Team>(instructor?.team || null)
  const [tandem, setTandem] = useState(instructor?.tandem || false)
  const [aff, setAff] = useState(instructor?.aff || false)
  const [video, setVideo] = useState(instructor?.video || false)
  const [tandemWeightLimit, setTandemWeightLimit] = useState(instructor?.tandemWeightLimit || 240)
  const [affWeightLimit, setAffWeightLimit] = useState(instructor?.affWeightLimit || 220)
  const [videoRestricted, setVideoRestricted] = useState(instructor?.videoRestricted || false)
  const [videoMinWeight, setVideoMinWeight] = useState(instructor?.videoMinWeight || 300)
  const [videoMaxWeight, setVideoMaxWeight] = useState(instructor?.videoMaxWeight || 450)
  const [clockedIn, setClockedIn] = useState(instructor?.clockedIn || false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      alert('Please enter instructor name')
      return
    }
    
    if (!tandem && !aff && !video) {
      alert('Please select at least one department')
      return
    }
    
    if (tandem && !tandemWeightLimit) {
      alert('Please enter Tandem weight limit')
      return
    }
    
    if (aff && !affWeightLimit) {
      alert('Please enter AFF weight limit')
      return
    }
    
    const instructorData = {
      name: name.trim(),
      bodyWeight,
      team,
      tandem,
      aff,
      video,
      tandemWeightLimit: tandem ? tandemWeightLimit : null,
      affWeightLimit: aff ? affWeightLimit : null,
      videoRestricted,
      videoMinWeight: videoRestricted && videoMinWeight ? videoMinWeight : null,
      videoMaxWeight: videoRestricted && videoMaxWeight ? videoMaxWeight : null,
      clockedIn,
      archived: false,
      affLocked: instructor?.affLocked || false,
      affStudents: instructor?.affStudents || []
    }
    
    try {
      setLoading(true)
      
      if (isEdit && instructor) {
        await db.updateInstructor(instructor.id, instructorData)
      } else {
        await create(instructorData)
      }
      
      onClose()
    } catch (error) {
      console.error('Failed to save instructor:', error)
      alert('Failed to save instructor. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full border border-white/20 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">
            {isEdit ? 'Edit Instructor' : 'Add New Instructor'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter name"
                required
              />
            </div>
            
            {/* Body Weight */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Instructor Body Weight (lbs) *
              </label>
              <input
                type="number"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="180"
                required
              />
            </div>
            
            {/* Team */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Team
              </label>
              <select
                value={team || ''}
                onChange={(e) => setTeam(e.target.value === '' ? null : e.target.value as Team)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">No Team (⚠️ Warning on assignment)</option>
                <option value="red">🔴 Red Team</option>
                <option value="blue">🔵 Blue Team</option>
                <option value="gold">🟡 Gold Team </option>
              </select>
            </div>
            
            {/* Departments */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Departments *
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tandem}
                    onChange={(e) => setTandem(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                  />
                  <span className="text-slate-300 font-medium">Tandem</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aff}
                    onChange={(e) => setAff(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                  />
                  <span className="text-slate-300 font-medium">AFF</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={video}
                    onChange={(e) => setVideo(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                  />
                  <span className="text-slate-300 font-medium">Video</span>
                </label>
              </div>
            </div>
            
            {/* Tandem Weight Limit */}
            {tandem && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Tandem Weight Limit (student max, lbs) *
                </label>
                <input
                  type="number"
                  value={tandemWeightLimit}
                  onChange={(e) => setTandemWeightLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="240"
                  required
                />
              </div>
            )}
            
            {/* AFF Weight Limit */}
            {aff && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  AFF Weight Limit (student max, lbs) *
                </label>
                <input
                  type="number"
                  value={affWeightLimit}
                  onChange={(e) => setAffWeightLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="220"
                  required
                />
              </div>
            )}
            
            {/* Video Restrictions */}
            {video && (
              <>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={videoRestricted}
                      onChange={(e) => setVideoRestricted(e.target.checked)}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span className="text-slate-300 font-medium">I have weight restrictions for video</span>
                  </label>
                </div>
                
                {videoRestricted && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Minimum Combined Weight (optional, lbs)
                      </label>
                      <input
                        type="number"
                        value={videoMinWeight}
                        onChange={(e) => setVideoMinWeight(parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="300"
                      />
                      <p className="text-xs text-slate-400 mt-1">Combined weight = Tandem Instructor + Student</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Maximum Combined Weight (optional, lbs)
                      </label>
                      <input
                        type="number"
                        value={videoMaxWeight}
                        onChange={(e) => setVideoMaxWeight(parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="450"
                      />
                    </div>
                  </>
                )}
              </>
            )}
            
            {/* Clocked In */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clockedIn}
                  onChange={(e) => setClockedIn(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-blue-500"
                />
                <span className="text-slate-300 font-medium">Clocked In</span>
              </label>
            </div>
            
            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading || createLoading}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading || createLoading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Instructor'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading || createLoading}
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