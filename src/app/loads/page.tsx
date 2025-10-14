'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useLoads, useQueue, useActiveInstructors, useAssignments, useCreateLoad, useUpdateLoad, useDeleteLoad } from '@/hooks/useDatabase'
import { getLoadCountdown } from '@/hooks/useLoadCountdown'
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
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [statusFilter, setStatusFilter] = useState<'all' | Load['status']>('all')
  const [reopenConfirm, setReopenConfirm] = useState<{ loadId: string, loadName: string, step: 1 | 2 } | null>(null)
  
  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  
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
            pay = assignment.affLevel === 'lower' ? 55 : 45
          } else if (assignment.jumpType === 'video') {
            pay = 45
          }
        }
        
        if (assignment.instructorId === instructor.id) {
          balance += pay
        }
        if (assignment.videoInstructorId === instructor.id && !assignment.isMissedJump) {
          balance += 45
        }
      })
      
      balances.set(instructor.id, balance)
    })
    return balances
  }, [instructors, assignments, period])
  
  // Filter queue
  const filteredQueue = useMemo(() => {
    let filtered = [...queue]
    
    if (selectedJumpType !== 'all') {
      filtered = filtered.filter(s => s.jumpType === selectedJumpType)
    }
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    return filtered.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }, [queue, selectedJumpType, searchTerm])
  
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
  
  const handleStatusChange = async (loadId: string, newStatus: Load['status']) => {
    console.log('🔄 handleStatusChange called:', { loadId, newStatus })
    
    const load = loads.find(l => l.id === loadId)
    if (!load) {
      console.error('❌ Load not found:', loadId)
      return
    }
    
    console.log('📦 Current load:', { name: load.name, currentStatus: load.status, targetStatus: newStatus })
    
    // ⚠️ SPECIAL HANDLING: Show custom modal for reopening completed loads
    if (load.status === 'completed' && newStatus === 'departed') {
      console.log('🔴 Attempting to reopen completed load - showing confirmation modal...')
      setReopenConfirm({ loadId: load.id, loadName: load.name, step: 1 })
      return // Exit here - the modal will handle the actual update
    }
    
    // Regular status changes for all other transitions
    try {
      const updates: Partial<Load> = { status: newStatus }
      
      // If marking as ready, start countdown
      if (newStatus === 'ready' && !load.countdownStartTime) {
        updates.countdownStartTime = new Date().toISOString()
        console.log('⏱️ Starting countdown timer')
      }
      
      // If moving back from ready to building, clear countdown
      if (newStatus === 'building' && load.countdownStartTime) {
        updates.countdownStartTime = null
        console.log('🔄 Clearing countdown timer')
      }
      
      console.log('💾 Calling updateLoad with:', { loadId, updates })
      await updateLoad(loadId, updates)
      console.log('✅ Status updated successfully!')
      
    } catch (error) {
      console.error('❌ Failed to update status:', error)
      alert('Failed to update status: ' + (error as Error).message)
    }
  }

  const executeReopenLoad = async (loadId: string) => {
    console.log('🔓 Executing reopen for load:', loadId)
    try {
      await updateLoad(loadId, { status: 'departed' })
      console.log('✅ Load reopened successfully!')
      setReopenConfirm(null)
    } catch (error) {
      console.error('❌ Failed to reopen load:', error)
      alert('Failed to reopen load: ' + (error as Error).message)
    }
  }
  
  const handleDelayAll = async (minutes: number) => {
    try {
      for (const load of loads) {
        const currentDelay = load.delayMinutes || 0
        await updateLoad(load.id, {
          delayMinutes: currentDelay + minutes
        })
      }
    } catch (error) {
      console.error('Failed to delay loads:', error)
    }
  }
  
  const handleDragStart = (e: React.DragEvent, type: 'student' | 'assignment', id: string, sourceLoadId?: string) => {
    setDraggedItem({ type, id, sourceLoadId })
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragEnd = () => {
    setIsDragging(false)
    setDropTarget(null)
    setDragOverIndex(null)
    setDraggedItem(null)
  }
  
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(targetId)
  }
  
  const handleDragLeave = () => {
    setDropTarget(null)
  }
  
  const handleQueueDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (draggedItem?.type === 'student' && !draggedItem.sourceLoadId) {
      setDragOverIndex(index)
    }
  }
  
  const handleQueueReorder = async (draggedStudentId: string, targetIndex: number) => {
    const draggedStudent = filteredQueue.find(s => s.id === draggedStudentId)
    if (!draggedStudent) return
    
    const currentIndex = filteredQueue.findIndex(s => s.id === draggedStudentId)
    if (currentIndex === targetIndex) return
    
    try {
      const newOrder = [...filteredQueue]
      newOrder.splice(currentIndex, 1)
      newOrder.splice(targetIndex, 0, draggedStudent)
      
      const baseTime = Date.now()
      for (let i = 0; i < newOrder.length; i++) {
        const student = newOrder[i]
        const newTimestamp = new Date(baseTime - (newOrder.length - i) * 1000).toISOString()
        
        if (student.timestamp !== newTimestamp) {
          await db.addToQueue({
            name: student.name,
            weight: student.weight,
            jumpType: student.jumpType,
            tandemWeightTax: student.tandemWeightTax,
            tandemHandcam: student.tandemHandcam,
            affLevel: student.affLevel,
            outsideVideo: student.outsideVideo,
            isRequest: student.isRequest
          })
          await db.removeFromQueue(student.id)
        }
      }
    } catch (error) {
      console.error('Failed to reorder queue:', error)
    }
  }
  
  const handleDrop = async (e: React.DragEvent, targetType: 'queue' | 'load', targetLoadId?: string, targetIndex?: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    setDropTarget(null)
    setDragOverIndex(null)
    
    if (!draggedItem) return
    
    try {
      if (targetType === 'queue' && draggedItem.type === 'student' && typeof targetIndex === 'number') {
        await handleQueueReorder(draggedItem.id, targetIndex)
      } else if (targetType === 'load' && targetLoadId) {
        const targetLoad = loads.find(l => l.id === targetLoadId)
        if (!targetLoad) return
        
        if (targetLoad.status === 'completed') {
          alert('❌ Cannot modify completed loads')
          return
        }
        
        if (draggedItem.type === 'student') {
          const student = queue.find(s => s.id === draggedItem.id)
          if (!student) return
          
          const newAssignment: LoadAssignment = {
            id: `${Date.now()}-${Math.random()}`,
            studentName: student.name,
            studentWeight: student.weight,
            jumpType: student.jumpType,
            tandemWeightTax: student.tandemWeightTax,
            tandemHandcam: student.tandemHandcam,
            affLevel: student.affLevel,
            hasOutsideVideo: student.outsideVideo,
            instructorId: null,
            instructorName: null,
            videoInstructorId: null,
            videoInstructorName: null,
            timestamp: new Date().toISOString()
          }
          
          await updateLoad(targetLoadId, {
            assignments: [...(targetLoad.assignments || []), newAssignment]
          })
          
          await db.removeFromQueue(draggedItem.id)
        } else if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId) {
          const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
          
          if (sourceLoad?.status === 'completed') {
            alert('❌ Cannot move assignments from completed loads')
            return
          }
          
          if (!sourceLoad || !targetLoad || draggedItem.sourceLoadId === targetLoadId) return
          
          const assignment = (sourceLoad.assignments || []).find(a => a.id === draggedItem.id)
          if (!assignment) return
          
          await updateLoad(draggedItem.sourceLoadId, {
            assignments: (sourceLoad.assignments || []).filter(a => a.id !== draggedItem.id)
          })
          
          await updateLoad(targetLoadId, {
            assignments: [...(targetLoad.assignments || []), assignment]
          })
        }
      }
    } catch (error) {
      console.error('Drop failed:', error)
      alert('Failed to complete operation')
    } finally {
      setDraggedItem(null)
    }
  }

  const handleRemoveAssignment = async (loadId: string, assignmentId: string) => {
    try {
      const load = loads.find(l => l.id === loadId)
      if (!load) return
      
      const assignment = load.assignments?.find(a => a.id === assignmentId)
      if (!assignment) return
      
      const queueStudent: CreateQueueStudent = {
        name: assignment.studentName,
        weight: assignment.studentWeight,
        jumpType: assignment.jumpType,
        isRequest: false,
        tandemWeightTax: assignment.tandemWeightTax,
        tandemHandcam: assignment.tandemHandcam,
        outsideVideo: assignment.hasOutsideVideo,
        affLevel: assignment.affLevel
      }
      
      await db.addToQueue(queueStudent)
      
      await updateLoad(loadId, {
        assignments: (load.assignments || []).filter(a => a.id !== assignmentId)
      })
    } catch (error) {
      console.error('Failed to remove assignment:', error)
      alert('Failed to remove assignment')
    }
  }
  
  const executeOptimization = async () => {
    setOptimizing(true)
    setShowOptimizeConfirm(false)
    
    try {
      const availableLoads = buildingLoads.filter(l => {
        const totalPeople = (l.assignments || []).reduce((sum, a) => {
          let count = 2
          if (a.hasOutsideVideo || a.videoInstructorId) count += 1
          return sum + count
        }, 0)
        return totalPeople < l.capacity
      })
      
      if (availableLoads.length === 0) {
        alert('No loads with available capacity')
        return
      }
      
      const studentsToAssign = [...filteredQueue]
      
      for (const student of studentsToAssign) {
        const targetLoad = availableLoads.find(load => {
          const totalPeople = (load.assignments || []).reduce((sum, a) => {
            let count = 2
            if (a.hasOutsideVideo || a.videoInstructorId) count += 1
            return sum + count
          }, 0)
          const newPeople = 2 + (student.outsideVideo ? 1 : 0)
          return totalPeople + newPeople <= load.capacity
        })
        
        if (!targetLoad) continue
        
        const newAssignment: LoadAssignment = {
          id: `${Date.now()}-${Math.random()}`,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          affLevel: student.affLevel,
          hasOutsideVideo: student.outsideVideo,
          instructorId: null,
          instructorName: null,
          videoInstructorId: null,
          videoInstructorName: null,
          timestamp: new Date().toISOString()
        }
        
        await updateLoad(targetLoad.id, {
          assignments: [...(targetLoad.assignments || []), newAssignment]
        })
        
        await db.removeFromQueue(student.id)
      }
    } catch (error) {
      console.error('Optimization failed:', error)
      alert('Failed to optimize loads')
    } finally {
      setOptimizing(false)
    }
  }
  
  // ============================================
  // RENDER
  // ============================================
  
  if (loadsLoading || queueLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              🛫 Load Builder
              {statusFilter !== 'all' && (
                <span className="text-2xl text-slate-400 ml-3">
                  / {statusFilter === 'building' ? '🔨 Building' :
                     statusFilter === 'ready' ? '✅ Ready' :
                     statusFilter === 'departed' ? '🛫 In Air' :
                     '✔️ Completed'}
                </span>
              )}
            </h1>
            <p className="text-slate-300">
              {statusFilter === 'all' 
                ? 'Drag students from queue to loads'
                : `Showing ${loadCounts[statusFilter]} ${statusFilter} load${loadCounts[statusFilter] !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleDelayAll(20)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              ⏱️ Delay All +20min
            </button>
            {(statusFilter === 'all' || statusFilter === 'building') && (
              <button
                onClick={() => setShowOptimizeConfirm(true)}
                disabled={optimizing || queue.length === 0 || buildingLoads.length === 0}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {optimizing ? '⏳ Optimizing...' : '🎯 Optimize All'}
              </button>
            )}
            <button
              onClick={handleCreateLoad}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <span className="text-xl">+</span> New Load
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="mb-6">
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-2 border border-white/20 inline-flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white/20 text-white shadow-lg scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="flex items-center gap-2">
                🎯 All Loads
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
                  ? 'bg-blue-500/30 text-white shadow-lg scale-105 border-2 border-blue-400'
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

        <div className="grid grid-cols-12 gap-6">
          {/* Queue Sidebar */}
          <div className="col-span-3">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 sticky top-8">
              <h2 className="text-2xl font-bold text-white mb-4">📋 Queue ({queue.length})</h2>
              
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-300">
                  💡 <strong>Click</strong> to select • <strong>Drag up/down</strong> to reorder • <strong>Drag right</strong> to assign
                </p>
              </div>
              
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors mb-3"
                />
                
                <div className="flex gap-2">
                  {(['all', 'tandem', 'aff'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedJumpType(type)}
                      className={`flex-1 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        selectedJumpType === type 
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                    >
                      {type === 'all' ? 'All' : type === 'tandem' ? 'Tandem' : 'AFF'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                {filteredQueue.map((student, index) => (
                  <div
                    key={student.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'student', student.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleQueueDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, 'queue', undefined, index)}
                    className={`bg-slate-800/50 p-3 rounded-lg border-2 cursor-move hover:border-blue-500 transition-all ${
                      dragOverIndex === index ? 'border-green-500 mt-8' : 'border-transparent'
                    } ${selectedStudents.has(student.id) ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="text-white font-semibold text-sm mb-1">{student.name}</div>
                    <div className="flex gap-2 items-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        student.jumpType === 'tandem' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {student.jumpType.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">⚖️ {student.weight}lbs</span>
                      {student.outsideVideo && (
                        <span className="text-xs text-yellow-400">📹</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Loads Grid */}
          <div className="col-span-9">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  .map((load) => {
                    const countdown = getLoadCountdown(load, loads, loadSettings.minutesBetweenLoads, currentTime)
                    
                    const assignments = load.assignments || []
                    const totalPeople = assignments.reduce((sum, a) => {
                      let count = 2
                      if (a.hasOutsideVideo || a.videoInstructorId) count += 1
                      return sum + count
                    }, 0)
                    const percentFull = Math.round((totalPeople / load.capacity) * 100)
                    const isOverCapacity = totalPeople > load.capacity
                    const unassignedCount = assignments.filter(a => !a.instructorId).length
                    const isDropTarget = dropTarget === `load-${load.id}`
                    const isCompleted = load.status === 'completed'
                    
                    const statusConfig = {
                      building: { icon: '🔨', label: 'Building', color: 'bg-slate-500' },
                      ready: { icon: '✅', label: 'Ready', color: 'bg-green-500' },
                      departed: { icon: '🛫', label: 'Departed', color: 'bg-yellow-500' },
                      completed: { icon: '✔️', label: 'Completed', color: 'bg-blue-500' }
                    }
                    
                    const config = statusConfig[load.status]
                    
                    return (
                      <div
                        key={load.id}
                        className={`bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border-2 transition-all ${
                          isCompleted 
                            ? 'opacity-75 border-purple-500/50'
                            : isDropTarget
                              ? 'bg-green-500/20 border-2 border-green-500 scale-105'
                              : 'border-white/20'
                        }`}
                        onDragOver={(e) => !isCompleted && handleDragOver(e, `load-${load.id}`)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'load', load.id)}
                      >
                        {/* Load Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-white">{load.name}</h3>
                              <span className={`${config.color} text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1`}>
                                {config.icon} {config.label}
                              </span>
                              {isCompleted && (
                                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded font-bold">
                                  🔒 LOCKED
                                </span>
                              )}
                            </div>
                            <div className={`text-sm font-semibold ${isOverCapacity ? 'text-red-400' : 'text-slate-400'}`}>
                              {totalPeople}/{load.capacity} people ({percentFull}%)
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  isOverCapacity ? 'bg-red-500' : percentFull > 80 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(percentFull, 100)}%` }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteLoad(load.id)}
                            disabled={isCompleted}
                            className={`ml-4 px-4 py-2 rounded-lg transition-colors text-sm font-bold ${
                              isCompleted
                                ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                          >
                            🗑️
                          </button>
                        </div>

                        {unassignedCount > 0 && (
                          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
                            <div className="text-yellow-300 font-semibold text-sm">
                              ⚠️ {unassignedCount} need instructor
                            </div>
                          </div>
                        )}

                        <div
                          className={`space-y-2 min-h-[200px] rounded-lg p-3 transition-colors ${
                            isDropTarget && !isCompleted ? 'bg-green-500/20 border-2 border-green-500' : 'bg-black/20'
                          }`}
                        >
                          {assignments.length === 0 ? (
                            <div className="text-center text-slate-400 py-8">
                              <p className="text-sm">{isCompleted ? 'No assignments' : 'Drop students here'}</p>
                            </div>
                          ) : (
                            assignments.map((assignment) => (
                              <div
                                key={assignment.id}
                                draggable={!isCompleted && load.status === 'building'}
                                onDragStart={(e) => !isCompleted && handleDragStart(e, 'assignment', assignment.id, load.id)}
                                onDragEnd={handleDragEnd}
                                className={`bg-slate-700/50 p-3 rounded-lg border border-white/10 transition-all ${
                                  !isCompleted && load.status === 'building' ? 'cursor-move hover:border-white/30' : 'cursor-default'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <div className="text-white font-semibold text-sm mb-1">{assignment.studentName}</div>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                      assignment.jumpType === 'tandem' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                                    }`}>
                                      {assignment.jumpType.toUpperCase()}
                                    </span>
                                  </div>
                                  {!isCompleted && load.status === 'building' && (
                                    <button
                                      onClick={() => handleRemoveAssignment(load.id, assignment.id)}
                                      className="ml-2 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors text-xs"
                                      title="Remove & Return to Queue"
                                    >
                                      ↩️
                                    </button>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 space-y-0.5">
                                  <div>👤 TI: {assignment.instructorName || '⚠️ Not assigned'}</div>
                                  {assignment.hasOutsideVideo && assignment.videoInstructorName && (
                                    <div>📹 VI: {assignment.videoInstructorName}</div>
                                  )}
                                  <div>⚖️ {assignment.studentWeight} lbs</div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Status Transition Buttons */}
                        <div className="mt-4 space-y-2">
                          {load.status === 'building' && (
                            <button
                              onClick={() => handleStatusChange(load.id, 'ready')}
                              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                              ✓ Mark Ready
                            </button>
                          )}
                          
                          {load.status === 'ready' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(load.id, 'building')}
                                className="w-full bg-slate-500 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                              >
                                🔨 Back to Building
                              </button>
                              <button
                                onClick={() => handleStatusChange(load.id, 'departed')}
                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                              >
                                🛫 Mark Departed
                              </button>
                            </>
                          )}
                          
                          {load.status === 'departed' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(load.id, 'ready')}
                                className="w-full bg-slate-500 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                              >
                                ✅ Back to Ready
                              </button>
                              <button
                                onClick={() => handleStatusChange(load.id, 'completed')}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                              >
                                ✔️ Mark Completed
                              </button>
                            </>
                          )}
                          
                          {load.status === 'completed' && (
                            <button
                              onClick={() => handleStatusChange(load.id, 'departed')}
                              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors border-2 border-red-400"
                            >
                              ⚠️ 🛫 Reopen Load (Move to Departed)
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Reopen Completed Load Confirmation Modal */}
      {reopenConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[10000]"
          onClick={() => setReopenConfirm(null)}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-red-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {reopenConfirm.step === 1 ? (
                <>
                  <h2 className="text-2xl font-bold text-white mb-4">⚠️ WARNING: Reopen Completed Load?</h2>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                    <p className="text-red-300 text-sm mb-2">
                      This will move <strong className="text-white">"{reopenConfirm.loadName}"</strong> from COMPLETED back to DEPARTED status.
                    </p>
                    <p className="text-red-300 text-sm">
                      This action should only be done if the load was marked completed by mistake.
                    </p>
                  </div>
                  <p className="text-slate-300 mb-6">
                    Do you want to continue?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setReopenConfirm(null)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setReopenConfirm({ ...reopenConfirm, step: 2 })}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                      Continue →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-4">🔴 SECOND CONFIRMATION REQUIRED</h2>
                  <div className="bg-red-600/20 border-2 border-red-500 rounded-lg p-4 mb-4">
                    <p className="text-white font-bold mb-3">
                      Are you absolutely sure you want to reopen this completed load?
                    </p>
                    <div className="space-y-1 text-sm">
                      <p className="text-red-200">
                        <strong>Load:</strong> {reopenConfirm.loadName}
                      </p>
                      <p className="text-red-200">
                        <strong>Action:</strong> COMPLETED → DEPARTED
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-300 mb-6 text-sm">
                    Click "Reopen Load" to proceed or "Cancel" to abort.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setReopenConfirm(null)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => executeReopenLoad(reopenConfirm.loadId)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors border-2 border-red-400"
                    >
                      🔓 Reopen Load
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Optimize Confirmation Modal */}
      {showOptimizeConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-purple-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">🎯 Optimize All Loads?</h2>
              <p className="text-slate-300 mb-6">
                This will automatically assign <strong className="text-white">{queue.length} student(s)</strong> across{' '}
                <strong className="text-white">{buildingLoads.length} load(s)</strong>.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOptimizeConfirm(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeOptimization}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Optimize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}