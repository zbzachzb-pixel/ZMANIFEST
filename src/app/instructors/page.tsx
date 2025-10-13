'use client'

import React, { useState } from 'react'
import { useActiveInstructors } from '@/hooks/useDatabase'
import { db } from '@/services'
import { AddInstructorModal } from '@/components/AddInstructorModal'
import type { Instructor } from '@/types'

export default function InstructorsPage() {
  const { data: instructors, loading } = useActiveInstructors()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null)
  
  const handleClockToggle = async (instructor: Instructor) => {
    try {
      await db.updateInstructor(instructor.id, {
        clockedIn: !instructor.clockedIn
      })
    } catch (error) {
      console.error('Failed to toggle clock:', error)
    }
  }
  
  const handleArchive = async (instructor: Instructor) => {
    if (confirm(`Archive ${instructor.name}? They will be removed from rotation.`)) {
      try {
        await db.archiveInstructor(instructor.id)
      } catch (error) {
        console.error('Failed to archive:', error)
      }
    }
  }
  
  const handleEdit = (instructor: Instructor) => {
    setEditingInstructor(instructor)
    setIsModalOpen(true)
  }
  
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingInstructor(null)
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading instructors...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Instructors</h1>
            <p className="text-slate-300">Manage your instructor team</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span> Add Instructor
          </button>
        </div>
        
        {instructors.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-12 text-center border border-white/20">
            <div className="text-6xl mb-4">👨‍✈️</div>
            <p className="text-white text-xl font-semibold mb-2">No instructors yet</p>
            <p className="text-slate-400 mb-6">Add your first instructor to get started!</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <span className="text-xl">+</span> Add Instructor
            </button>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden border border-white/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Team and Depts
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Weight Limits
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {instructors.map((instructor) => (
                    <tr key={instructor.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-white">{instructor.name}</div>
                        <div className="text-xs text-slate-400">{instructor.bodyWeight} lbs</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {instructor.team === 'red' && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-semibold">
                              🔴 Red
                            </span>
                          )}
                          {instructor.team === 'blue' && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                              🔵 Blue
                            </span>
                          )}
                          {instructor.team === 'gold' && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-semibold">
                              🟡 Gold
                            </span>
                          )}
                          {!instructor.team && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-semibold">
                              ⚠️ No Team
                            </span>
                          )}
                          {instructor.tandem && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">T</span>
                          )}
                          {instructor.aff && (
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-semibold">A</span>
                          )}
                          {instructor.video && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-semibold">V</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300">
                          {instructor.tandem && instructor.tandemWeightLimit && (
                            <div>T: {instructor.tandemWeightLimit} lbs</div>
                          )}
                          {instructor.aff && instructor.affWeightLimit && (
                            <div>A: {instructor.affWeightLimit} lbs</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          instructor.clockedIn 
                            ? 'bg-green-500/20 text-green-300' 
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
                          {instructor.clockedIn ? '✓ Clocked In' : 'Clocked Out'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleClockToggle(instructor)}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                              instructor.clockedIn
                                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                            }`}
                          >
                            {instructor.clockedIn ? 'Clock Out' : 'Clock In'}
                          </button>
                          <button
                            onClick={() => handleEdit(instructor)}
                            className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-bold hover:bg-blue-500/30 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchive(instructor)}
                            className="px-3 py-1 bg-red-500/20 text-red-300 rounded text-xs font-bold hover:bg-red-500/30 transition-colors"
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {isModalOpen && (
        <AddInstructorModal
          instructor={editingInstructor}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}