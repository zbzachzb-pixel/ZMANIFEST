// src/app/loads/page.tsx
'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useLoads, useQueue, useActiveInstructors, useAssignments, useCreateLoad, useUpdateLoad, useDeleteLoad } from '@/hooks/useDatabase'
import { LoadBuilderCard } from '@/components/LoadBuilderCard'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type { QueueStudent, Instructor, Load, LoadAssignment, Assignment, LoadSchedulingSettings, CreateQueueStudent } from '@/types'

export default function LoadBuilderPage() {
  // ============================================
  // HOOKS - ALL CALLED AT TOP LEVEL IN SAME ORDER ALWAYS
  // ============================================
  
  // Database hooks
  const { data: loads, loading: loadsLoading } = useLoads()
  const { data: queue, loading: queueLoading } = useQueue()
  const { data: instructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { create: createLoad } = useCreateLoad()
  const { update: updateLoad } = useUpdateLoad()
  const { deleteLoad } = useDeleteLoad()
  
  // State hooks - ALL called unconditionally
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedJumpType, setSelectedJumpType] = useState<'all' | 'tandem' | 'aff'>('all')
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<{ type: 'student' | 'assignment', id: string, sourceLoadId?: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [showOptimizeConfirm, setShowOptimizeConfirm] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [loadSettings, setLoadSettings] = useState<LoadSchedulingSettings>({
    minutesBetweenLoads: 20,
    instructorCycleTime: 40
  })
  const [statusFilter, setStatusFilter] = useState<'all' | Load['status']>('all')
  
  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('loadSchedulingSettings')
    if (savedSettings) {
      try {
        setLoadSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error('Failed to load scheduling settings')
      }
    }
  }, [])
  
  // Constants
  const period = getCurrentPeriod()
  const buildingLoads = loads.filter(l => l.status === 'building')
  
  // Filter loads by status
  const filteredLoads = useMemo(() => {
    if (statusFilter === 'all') return loads
    return loads.filter(l => l.status === statusFilter)
  }, [loads, statusFilter])
  
  // Count loads by status
  const loadCounts = useMemo(() => ({
    all: loads.length,
    building: loads.filter(l => l.status === 'building').length,
    ready: loads.filter(l => l.status === 'ready').length,
    departed: loads.filter(l => l.status === 'departed').length,
    completed: loads.filter(l => l.status === 'completed').length
  }), [loads])
  
  // ============================================
  // MEMOIZED VALUES
  // ============================================
  
  // Calculate instructor balances
  const instructorBalances = useMemo(() => {
    const balances = new Map<string, number>()
    instructors.forEach(instructor => {
      let balance = 0
      assignments.forEach(assignment => {
        const assignmentDate = new Date(assignment.timestamp)
        if (assignmentDate < period.start || assignmentDate > period.end) return
        if (assignment.isRequest) return
        
        let pay = 0
        if (!assignment.isMissedJump) {
          if (assignment.jumpType === 'tandem') {
            pay = 40 + (assignment.tandemWeightTax || 0) * 20
            if (assignment.tandemHandcam) pay += 30
          } else if (assignment.jumpType === 'aff') {
            pay = assignment.affLevel === 'lower' ? 50 : 70
          }
        }
        
        let multiplier = 1.0
        if (assignment.outsideVideo) pay += 50
        
        if (assignment.isOffDay) multiplier = 1.2
        
        const finalPay = pay * multiplier
        
        if (assignment.instructorId === instructor.id) {
          balance += finalPay
        }
        if (assignment.videoInstructorId === instructor.id) {
          balance += 50 * multiplier
        }
      })
      balances.set(instructor.id, balance)
    })
    return balances
  }, [instructors, assignments, period])
  
  // Filter queue by jump type and search
  const filteredQueue = useMemo(() => {
    return queue.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = selectedJumpType === 'all' || student.jumpType === selectedJumpType
      return matchesSearch && matchesType
    })
  }, [queue, searchTerm, selectedJumpType])
  
  // ============================================
  // EVENT HANDLERS
  // ============================================
  
  const handleCreateLoad = async () => {
    try {
      const maxPosition = loads.length > 0 
        ? Math.max(...loads.map(l => l.position || 0))
        : 0
      
      await createLoad({
        name: `Load #${loads.length + 1}`,
        status: 'building',
        capacity: 18,
        assignments: [],
        position: maxPosition + 1,
        delayMinutes: 0
      })
    } catch (error) {
      console.error('Failed to create load:', error)
      alert('Failed to create load')
    }
  }
  
  const handleDeleteLoad = async (loadId: string) => {
    if (!confirm('Delete this load? All assignments will be moved back to queue.')) return
    
    try {
      const load = loads.find(l => l.id === loadId)
      if (!load) return
      
      // Move assignments back to queue
      for (const assignment of (load.assignments || [])) {
        await db.addToQueue({
          name: assignment.studentName,
          weight: assignment.studentWeight,
          jumpType: assignment.jumpType,
          tandemWeightTax: assignment.tandemWeightTax || 0,
          tandemHandcam: assignment.tandemHandcam || false,
          affLevel: assignment.affLevel,
          outsideVideo: assignment.hasOutsideVideo,
          isRequest: false
        })
      }
      
      await deleteLoad(loadId)
    } catch (error) {
      console.error('Failed to delete load:', error)
      alert('Failed to delete load')
    }
  }
  
  const handleDelayLoad = async (loadId: string, minutes: number) => {
    try {
      const load = loads.find(l => l.id === loadId)
      if (!load) return
      
      const currentDelay = load.delayMinutes || 0
      await updateLoad(loadId, {
        delayMinutes: currentDelay + minutes
      })
    } catch (error) {
      console.error('Failed to delay load:', error)
      alert('Failed to delay load')
    }
  }
  
  const handleDragStart = (type: 'student' | 'assignment', id: string, sourceLoadId?: string) => {
    setDraggedItem({ type, id, sourceLoadId })
    setIsDragging(true)
  }
  
  const handleDragEnd = () => {
    setDraggedItem(null)
    setDropTarget(null)
    setIsDragging(false)
  }
  
  const handleDrop = async (loadId: string) => {
    if (!draggedItem) return
    
    try {
      if (draggedItem.type === 'student') {
        const student = queue.find(s => s.id === draggedItem.id)
        if (!student) return
        
        const load = loads.find(l => l.id === loadId)
        if (!load) return
        
        // Generate unique ID using timestamp + random string
        const generateId = () => {
          const timestamp = Date.now()
          const random = Math.random().toString(36).substring(2, 11)
          return `${timestamp}-${random}`
        }
        
        const newAssignment: LoadAssignment = {
          id: generateId(),
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          affLevel: student.affLevel,
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          hasOutsideVideo: student.outsideVideo,
          instructorId: null,
          videoInstructorId: null
        }
        
        await updateLoad(loadId, {
          assignments: [...(load.assignments || []), newAssignment]
        })
        
        await db.removeFromQueue(draggedItem.id)
      } else if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId) {
        const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
        const targetLoad = loads.find(l => l.id === loadId)
        
        if (!sourceLoad || !targetLoad || sourceLoad.id === targetLoad.id) return
        
        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) return
        
        await updateLoad(sourceLoad.id, {
          assignments: sourceLoad.assignments?.filter(a => a.id !== draggedItem.id) || []
        })
        
        await updateLoad(targetLoad.id, {
          assignments: [...(targetLoad.assignments || []), assignment]
        })
      }
    } catch (error) {
      console.error('Failed to handle drop:', error)
      alert('Failed to move item')
    } finally {
      handleDragEnd()
    }
  }
  
  // ============================================
  // RENDER
  // ============================================
  
  if (loadsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading loads...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-[2000px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">🛫 Load Builder</h1>
          <div className="flex gap-3">
            <button
              onClick={() => alert('Optimize feature coming soon! This will auto-assign students to instructors based on balance.')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
              disabled={buildingLoads.length === 0}
            >
              🎯 Optimize All
            </button>
            <button
              onClick={handleCreateLoad}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
            >
              ➕ New Load
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Content - Loads */}
          <div className="xl:col-span-3">
            {/* Status Filter */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/20 mb-8">
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    statusFilter === 'all'
                      ? 'bg-blue-500/30 text-white shadow-lg scale-105 border-2 border-blue-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    📋 All Loads
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{loadCounts.all}</span>
                  </span>
                </button>
                
                <button
                  onClick={() => setStatusFilter('building')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    statusFilter === 'building'
                      ? 'bg-slate-500/30 text-white shadow-lg scale-105 border-2 border-slate-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    🔨 Building
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{loadCounts.building}</span>
                  </span>
                </button>
                
                <button
                  onClick={() => setStatusFilter('ready')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    statusFilter === 'ready'
                      ? 'bg-green-500/30 text-white shadow-lg scale-105 border-2 border-green-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    ✅ Ready
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{loadCounts.ready}</span>
                  </span>
                </button>
                
                <button
                  onClick={() => setStatusFilter('departed')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    statusFilter === 'departed'
                      ? 'bg-yellow-500/30 text-white shadow-lg scale-105 border-2 border-yellow-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    🛫 In Air
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{loadCounts.departed}</span>
                  </span>
                </button>
                
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    statusFilter === 'completed'
                      ? 'bg-purple-500/30 text-white shadow-lg scale-105 border-2 border-purple-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    ✔️ Completed
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{loadCounts.completed}</span>
                  </span>
                </button>
              </div>
            </div>
            
            {/* Loads Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredLoads.length === 0 ? (
                <div className="col-span-full text-center text-slate-400 py-12">
                  <p className="text-xl mb-2">
                    {statusFilter === 'all' ? 'No loads yet' : `No ${statusFilter} loads`}
                  </p>
                  <p>
                    {statusFilter === 'all' 
                      ? 'Click "New Load" to get started'
                      : `Switch to "All Loads" or create a new load`
                    }
                  </p>
                </div>
              ) : (
                filteredLoads
                  .sort((a, b) => (a.position || 0) - (b.position || 0))
                  .map((load) => (
                    <LoadBuilderCard
                      key={load.id}
                      load={load}
                      allLoads={loads}
                      instructors={instructors}
                      instructorBalances={instructorBalances}
                      onDrop={handleDrop}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      dropTarget={dropTarget}
                      setDropTarget={setDropTarget}
                      loadSchedulingSettings={loadSettings}
                      onDelay={handleDelayLoad}
                    />
                  ))
              )}
            </div>
          </div>
          
          {/* Sidebar - Queue */}
          <div className="xl:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/20 sticky top-8">
              <h2 className="text-2xl font-bold text-white mb-4">👥 Student Queue</h2>
              
              {/* Search and Filter */}
              <div className="mb-4 space-y-2">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedJumpType('all')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      selectedJumpType === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedJumpType('tandem')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      selectedJumpType === 'tandem'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Tandem
                  </button>
                  <button
                    onClick={() => setSelectedJumpType('aff')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      selectedJumpType === 'aff'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    AFF
                  </button>
                </div>
              </div>
              
              {/* Queue List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {queueLoading ? (
                  <div className="text-center py-8 text-slate-400">Loading queue...</div>
                ) : filteredQueue.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm">Queue is empty</p>
                  </div>
                ) : (
                  filteredQueue.map((student) => (
                    <div
                      key={student.id}
                      draggable
                      onDragStart={() => handleDragStart('student', student.id)}
                      onDragEnd={handleDragEnd}
                      className="bg-slate-700/50 p-3 rounded-lg cursor-move hover:bg-slate-700 transition-all border border-slate-600"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-semibold">{student.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          student.jumpType === 'tandem' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-purple-500 text-white'
                        }`}>
                          {student.jumpType === 'tandem' ? 'TANDEM' : student.affLevel?.toUpperCase() || 'AFF'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {student.weight} lbs
                        {student.tandemWeightTax > 0 && ` • +${student.tandemWeightTax} tax`}
                        {student.tandemHandcam && ' • 📹 Handcam'}
                        {student.outsideVideo && ' • 🎥 Outside'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}