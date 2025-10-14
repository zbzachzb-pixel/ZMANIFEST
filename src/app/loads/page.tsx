// Save this file as: src/app/loads/page.tsx
'use client'

import React from 'react'
import { useLoads, useActiveInstructors, useQueue, useCreateLoad } from '@/hooks/useDatabase'
import { LoadCard } from '@/components/LoadCard'

export default function LoadsPage() {
  const { data: loads, loading: loadsLoading } = useLoads()
  const { data: instructors, loading: instructorsLoading } = useActiveInstructors()
  const { data: queue, loading: queueLoading } = useQueue()
  const { create: createLoad, loading: createLoading } = useCreateLoad()
  
  const buildingLoads = loads.filter(l => l.status === 'building')
  const clockedIn = instructors.filter(i => i.clockedIn)
  
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
    }
  }
  
  if (loadsLoading || instructorsLoading || queueLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading loads...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Build Loads</h1>
          <p className="text-slate-300">Create and manage loads for departure</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Clocked In
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {clockedIn.length}
            </div>
            <div className="text-sm text-slate-400">
              of {instructors.length} instructors
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              In Queue
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {queue.length}
            </div>
            <div className="text-sm text-slate-400">students waiting</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Active Loads
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {buildingLoads.length}
            </div>
            <div className="text-sm text-slate-400">building now</div>
          </div>
        </div>
        
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-white">Building Loads</h2>
            <button
              onClick={handleCreateLoad}
              disabled={createLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <span className="text-xl">+</span> New Load
            </button>
          </div>
          
          {buildingLoads.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-12 text-center border border-white/20">
              <div className="text-6xl mb-4">✈️</div>
              <p className="text-white text-xl font-semibold mb-2">No loads building</p>
              <p className="text-slate-400 mb-6">Create your first load to get started!</p>
              <button
                onClick={handleCreateLoad}
                disabled={createLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                <span className="text-xl">+</span> Create Load
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {buildingLoads.map(load => (
                <LoadCard key={load.id} load={load} />
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-xl p-8 text-center border border-purple-500/30">
          <h3 className="text-2xl font-bold text-white mb-3">🚀 Next: Load Assignment</h3>
          <p className="text-slate-300 mb-4">
            Drag-and-drop assignment from queue, auto-assign, and optimize load features coming next!
          </p>
        </div>
      </div>
    </div>
  )
}