'use client'

import React, { useState } from 'react'
import { useLoads, useQueue, useActiveInstructors, useAssignments, useCreateLoad } from '@/hooks/useDatabase'
import { LoadBuilderCard } from '@/components/LoadBuilderCard'
import { QueuePanel } from '@/components/QueuePanel'
import { AddStudentModal } from '@/components/AddStudentModal'
import { getCurrentPeriod } from '@/lib/utils'

export default function LoadsPage() {
  const { data: loads, loading: loadsLoading } = useLoads()
  const { data: queue, loading: queueLoading } = useQueue()
  const { data: instructors, loading: instructorsLoading } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { create: createLoad, loading: createLoading } = useCreateLoad()
  
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false)
  
  const period = getCurrentPeriod()
  const buildingLoads = loads.filter(l => l.status === 'building')
  const clockedInInstructors = instructors.filter(i => i.clockedIn)
  
  const handleCreateLoad = async () => {
    try {
      await createLoad({
        name: `Load #${loads.length + 1}`,
        status: 'building',
        capacity: 18,
        assignments: []
      })
    } catch (error) {
      console.error('Failed to create load:', error)
      alert('Failed to create load. Please try again.')
    }
  }
  
  if (loadsLoading || queueLoading || instructorsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading load builder...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="flex h-screen">
        {/* Main Load Builder Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white mb-2">Load Builder</h1>
            <p className="text-slate-300">{period.name}</p>
          </div>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="text-xs text-slate-300 uppercase tracking-wide mb-1">Building Loads</div>
              <div className="text-3xl font-bold text-white">{buildingLoads.length}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="text-xs text-slate-300 uppercase tracking-wide mb-1">In Queue</div>
              <div className="text-3xl font-bold text-blue-400">{queue.length}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="text-xs text-slate-300 uppercase tracking-wide mb-1">Clocked In</div>
              <div className="text-3xl font-bold text-green-400">{clockedInInstructors.length}</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <div className="text-xs text-slate-300 uppercase tracking-wide mb-1">Capacity</div>
              <div className="text-3xl font-bold text-yellow-400">
                {buildingLoads.reduce((sum, l) => sum + (l.assignments?.length || 0), 0)}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleCreateLoad}
              disabled={createLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <span className="text-xl">+</span> New Load
            </button>
            
            <button
              onClick={() => setIsAddStudentOpen(true)}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <span className="text-xl">+</span> Add Student to Queue
            </button>
          </div>
          
          {/* Loads Grid */}
          {buildingLoads.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 text-center border border-white/20">
              <div className="text-6xl mb-4">✈️</div>
              <h2 className="text-2xl font-bold text-white mb-2">No Loads Building</h2>
              <p className="text-slate-400 mb-6">Create your first load to start building!</p>
              <button
                onClick={handleCreateLoad}
                disabled={createLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                <span className="text-xl">+</span> Create Load
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
              {buildingLoads.map(load => (
                <LoadBuilderCard
                  key={load.id}
                  load={load}
                  instructors={instructors}
                  assignments={assignments}
                  period={period}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Queue Sidebar */}
        <QueuePanel
          queue={queue}
          instructors={clockedInInstructors}
          onAddStudent={() => setIsAddStudentOpen(true)}
        />
      </div>
      
      {/* Add Student Modal */}
      {isAddStudentOpen && (
        <AddStudentModal
          onClose={() => setIsAddStudentOpen(false)}
        />
      )}
    </div>
  )
}