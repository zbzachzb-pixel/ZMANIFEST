'use client'

import React, { useState } from 'react'
import { useActiveInstructors } from '@/hooks/useDatabase'
import { db } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import { AddInstructorModal } from '@/components/AddInstructorModal'
import { ReleaseAFFModal } from '@/components/ReleaseAFFModal'
import type { Instructor } from '@/types'
import { TeamManagementSection } from '@/components/TeamManagementSection'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { RequireRole } from '@/components/auth'

function InstructorsPageContent() {
  const { data: instructors, loading } = useActiveInstructors()
  const toast = useToast()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null)
  const [releaseInstructor, setReleaseInstructor] = useState<Instructor | null>(null)
  const [activeTab] = useState<'roster' | 'teams'>('teams')

  const handleClockToggle = async (instructor: Instructor) => {
    try {
      const newStatus = !instructor.clockedIn
      
      // Update instructor status
      await db.updateInstructor(instructor.id, {
        clockedIn: newStatus
      })
      
      // Log clock event
      await db.logClockEvent(
        instructor.id,
        instructor.name,
        newStatus ? 'in' : 'out'
      )
    } catch (error) {
      console.error('Failed to toggle clock:', error)
      toast.error('Failed to update clock status', 'Please try again.')
    }
  }
  
  const handleArchive = async (instructor: Instructor) => {
    if (confirm(`Archive ${instructor.name}? They will be removed from rotation.`)) {
      try {
        await db.archiveInstructor(instructor.id)
      } catch (error) {
        console.error('Failed to archive:', error)
        toast.error('Failed to archive instructor', 'Please try again.')
      }
    }
  }
  
  const handleEdit = (instructor: Instructor) => {
    setEditingInstructor(instructor)
    setIsAddModalOpen(true)
  }
  
  const handleReleaseAFF = (instructor: Instructor) => {
    if (!instructor.affLocked || !instructor.affStudents || instructor.affStudents.length === 0) {
      toast.warning('This instructor has no AFF students to release')
      return
    }
    setReleaseInstructor(instructor)
  }
  
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false)
    setEditingInstructor(null)
  }
  
  const handleCloseReleaseModal = () => {
    setReleaseInstructor(null)
  }
  
  // Fixed: Actually close the modal and clear state on success
  const handleReleaseSuccess = () => {
    setReleaseInstructor(null)
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
            <p className="text-slate-300">Entire Team Overview</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span> Add Instructor
          </button>
        </div>

{activeTab === 'roster' ? (
  // INSTRUCTOR ROSTER TAB
  instructors.length === 0 ? (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-12 text-center border border-white/20">
      <div className="text-6xl mb-4">👥</div>
      <p className="text-white text-xl font-semibold mb-2">No instructors yet</p>
      <p className="text-slate-400 mb-6">Add your first instructor to get started</p>
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors inline-flex items-center gap-2"
      >
        <span className="text-xl">+</span> Add Instructor
      </button>
    </div>
  ) : (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 overflow-hidden">
      <table className="w-full">
        <thead className="bg-white/5">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Instructor</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Certifications</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Weight Limits</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {instructors.map(instructor => {
            const isAFFLocked = instructor.affLocked && instructor.affStudents && instructor.affStudents.length > 0
            
            return (
              <tr 
                key={instructor.id} 
                className={`hover:bg-white/5 transition-colors ${isAFFLocked ? 'bg-yellow-500/10' : ''}`}
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-white">{instructor.name}</div>
                  <div className="flex gap-2 mt-1">
                    {instructor.team === 'red' && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs font-semibold">🔴 Red</span>
                    )}
                    {instructor.team === 'blue' && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">🔵 Blue</span>
                    )}
                    {instructor.team === 'gold' && (
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs font-semibold">🟡 Gold</span>
                    )}
                    {!instructor.team && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs font-semibold">⚠️ No Team</span>
                    )}
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  <div className="flex gap-2 flex-wrap">
                    {instructor.canTandem && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">Tandem</span>
                    )}
                    {instructor.canAFF && (
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-semibold">AFF</span>
                    )}
                    {instructor.canVideo && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-semibold">Video</span>
                    )}
                    {isAFFLocked && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-semibold">
                        🔒 AFF Locked
                      </span>
                    )}
                  </div>
                  {isAFFLocked && instructor.affStudents && (
                    <div className="text-xs text-yellow-300 mt-1">
                      {instructor.affStudents.length} student(s)
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-300">
                    {instructor.canTandem && instructor.tandemWeightLimit && (
                      <div>Tandem: {instructor.tandemWeightLimit} lbs</div>
                    )}
                    {instructor.canAFF && instructor.affWeightLimit && (
                      <div>AFF: {instructor.affWeightLimit} lbs</div>
                    )}
                    {instructor.canVideo && (instructor.videoMinWeight || instructor.videoMaxWeight) && (
                      <div className="text-xs text-slate-400 mt-1">
                        Video: {instructor.videoMinWeight || 0}-{instructor.videoMaxWeight || '∞'} lbs
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${instructor.clockedIn ? 'bg-green-400' : 'bg-slate-500'}`} />
                    <span className={`text-sm font-medium ${instructor.clockedIn ? 'text-green-300' : 'text-slate-400'}`}>
                      {instructor.clockedIn ? 'Clocked In' : 'Clocked Out'}
                    </span>
                  </div>
                  {instructor.clockedIn && instructor.clockInTime && (
                    <div className="text-xs text-slate-400 mt-1">
                      Since {new Date(instructor.clockInTime).toLocaleTimeString()}
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4">
                  <div className="flex gap-2 justify-end flex-wrap">
                    <button
                      onClick={() => handleClockToggle(instructor)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        instructor.clockedIn
                          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                          : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                      }`}
                    >
                      {instructor.clockedIn ? 'Clock Out' : 'Clock In'}
                    </button>
                    
                    {isAFFLocked && (
                      <button
                        onClick={() => handleReleaseAFF(instructor)}
                        className="px-3 py-1 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 rounded text-xs font-semibold transition-colors"
                      >
                        🔓 Release AFF
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleEdit(instructor)}
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded text-xs font-semibold transition-colors"
                    >
                      ✏️ Edit
                    </button>
                    
                    <button
                      onClick={() => handleArchive(instructor)}
                      className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded text-xs font-semibold transition-colors"
                    >
                      🗑️ Archive
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
) : (
  // TEAM MANAGEMENT TAB
  <TeamManagementSection />
)}
      </div>
      
      {isAddModalOpen && (
        <AddInstructorModal
          instructor={editingInstructor}
          onClose={handleCloseAddModal}
        />
      )}
      
      {releaseInstructor && (
        <ReleaseAFFModal
          instructor={releaseInstructor}
          onClose={handleCloseReleaseModal}
          onSuccess={handleReleaseSuccess}
        />
      )}
    </div>
  )
}

export default function InstructorsPage() {
  return (
    <RequireRole roles={['admin', 'manifest']}>
      <PageErrorBoundary>
        <InstructorsPageContent />
      </PageErrorBoundary>
    </RequireRole>
  )
}