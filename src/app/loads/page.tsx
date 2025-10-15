// src/app/loads/page.tsx - COMPLETE FILE WITH FIXED GROUP HANDLING

'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useLoads, useQueue, useActiveInstructors, useAssignments, useCreateLoad, useUpdateLoad, useDeleteLoad, useGroups } from '@/hooks/useDatabase'
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
  const { data: groups } = useGroups()
  
  // State hooks - ALL called unconditionally
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedJumpType, setSelectedJumpType] = useState<'all' | 'tandem' | 'aff'>('all')
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<{ type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'building' | 'ready' | 'departed' | 'completed'>('all')
  
  // Load scheduling settings
  const [loadSettings] = useState<LoadSchedulingSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('loadSchedulingSettings')
      if (saved) return JSON.parse(saved)
    }
    return {
      minutesBetweenLoads: 20,
      instructorCycleTime: 40
    }
  })
  
  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const period = getCurrentPeriod()
  
  // Calculate instructor balances
  const instructorBalances = useMemo(() => {
    const balances = new Map<string, number>()
    
    instructors.forEach(instructor => {
      const instructorAssignments = assignments.filter(a => {
        const assignmentDate = new Date(a.timestamp)
        return (
          assignmentDate >= period.start &&
          assignmentDate <= period.end &&
          (a.instructorId === instructor.id || a.videoInstructorId === instructor.id)
        )
      })
      
      let balance = 0
      instructorAssignments.forEach(a => {
        if (a.isMissedJump) return
        
        if (a.instructorId === instructor.id && !a.isRequest) {
          if (a.jumpType === 'tandem') {
            balance += 40 + (a.tandemWeightTax || 0) * 20
            if (a.tandemHandcam) balance += 30
          } else if (a.jumpType === 'aff') {
            balance += a.affLevel === 'lower' ? 55 : 45
          }
        }
        
        if (a.videoInstructorId === instructor.id && !a.isRequest) {
          balance += 45
        }
      })
      
      balances.set(instructor.id, balance)
    })
    
    return balances
  }, [instructors, assignments, period])
  
  // Filter queue based on search and jump type
  const filteredQueue = useMemo(() => {
    let filtered = queue
    
    if (selectedJumpType !== 'all') {
      filtered = filtered.filter(s => s.jumpType === selectedJumpType)
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.weight.toString().includes(search)
      )
    }
    
    return filtered
  }, [queue, selectedJumpType, searchTerm])
  
  // Separate students by group status
  const { groupedStudents, individualStudents } = useMemo(() => {
    const grouped: QueueStudent[] = []
    const individual: QueueStudent[] = []
    
    filteredQueue.forEach(student => {
      if (student.groupId) {
        grouped.push(student)
      } else {
        individual.push(student)
      }
    })
    
    return { groupedStudents: grouped, individualStudents: individual }
  }, [filteredQueue])
  
  // Filter loads by status
  const filteredLoads = useMemo(() => {
    if (statusFilter === 'all') return loads
    return loads.filter(load => load.status === statusFilter)
  }, [loads, statusFilter])
  
  // Count loads by status
  const loadCounts = useMemo(() => ({
    all: loads.length,
    building: loads.filter(l => l.status === 'building').length,
    ready: loads.filter(l => l.status === 'ready').length,
    departed: loads.filter(l => l.status === 'departed').length,
    completed: loads.filter(l => l.status === 'completed').length
  }), [loads])
  
  const buildingLoads = loads.filter(l => l.status === 'building')
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleCreateLoad = async () => {
    try {
      const nextPosition = Math.max(0, ...loads.map(l => l.position || 0)) + 1
      const loadNumber = loads.length + 1
      
      await createLoad({
        name: `Load ${loadNumber}`,
        status: 'building',
        capacity: 18,
        assignments: [],
        position: nextPosition
      })
    } catch (error) {
      console.error('Failed to create load:', error)
      alert('Failed to create load')
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
  
  const handleDragStart = (type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string) => {
    setDraggedItem({ type, id, sourceLoadId })
    setIsDragging(true)
  }
  
  const handleDragEnd = () => {
    setDraggedItem(null)
    setDropTarget(null)
    setIsDragging(false)
  }
  
  // 🔥 FIXED: Handle dropping groups/students back to queue
  const handleDropToQueue = async () => {
    if (!draggedItem) return
    
    try {
      // Only handle drops from loads (must have sourceLoadId)
      if (!draggedItem.sourceLoadId) {
        handleDragEnd()
        return
      }
      
      const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
      if (!sourceLoad) return
      
      if (draggedItem.type === 'group') {
        // Dropping entire group back to queue
        const groupId = draggedItem.id
        const groupAssignments = sourceLoad.assignments?.filter(a => a.groupId === groupId) || []
        
        if (groupAssignments.length === 0) return
        
        // 🔥 FIX: Update the Group document to include the student IDs
        const group = groups.find(g => g.id === groupId)
        if (group) {
          const studentIdsToAdd = groupAssignments.map(a => a.studentId)
          const updatedStudentIds = [...new Set([...group.studentIds, ...studentIdsToAdd])]
          await db.updateGroup(groupId, { studentIds: updatedStudentIds })
        }
        
        // Remove group assignments from load
        await updateLoad(sourceLoad.id, {
          assignments: sourceLoad.assignments?.filter(a => a.groupId !== groupId) || []
        })
        
        // Add all students back to queue with PRIORITY
        const priorityTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        
        for (const assignment of groupAssignments) {
          const queueStudent: CreateQueueStudent = {
            name: assignment.studentName,
            weight: assignment.studentWeight,
            jumpType: assignment.jumpType,
            isRequest: false,
            tandemWeightTax: assignment.tandemWeightTax || 0,
            tandemHandcam: assignment.tandemHandcam || false,
            outsideVideo: assignment.hasOutsideVideo,
            affLevel: assignment.affLevel,
            groupId: groupId  // 🔥 PRESERVE GROUP ID
          }
          
          await db.addToQueue(queueStudent, priorityTimestamp)
        }
        
      } else if (draggedItem.type === 'assignment') {
        // Dropping single assignment back to queue
        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) return
        
        // 🔥 FIX: If student has groupId, update the Group document
        if (assignment.groupId) {
          const group = groups.find(g => g.id === assignment.groupId)
          if (group && !group.studentIds.includes(assignment.studentId)) {
            await db.updateGroup(assignment.groupId, { 
              studentIds: [...group.studentIds, assignment.studentId]
            })
          }
        }
        
        // Remove assignment from load
        await updateLoad(sourceLoad.id, {
          assignments: sourceLoad.assignments?.filter(a => a.id !== draggedItem.id) || []
        })
        
        // Add student back to queue with PRIORITY
        const priorityTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        
        const queueStudent: CreateQueueStudent = {
          name: assignment.studentName,
          weight: assignment.studentWeight,
          jumpType: assignment.jumpType,
          isRequest: false,
          tandemWeightTax: assignment.tandemWeightTax || 0,
          tandemHandcam: assignment.tandemHandcam || false,
          outsideVideo: assignment.hasOutsideVideo,
          affLevel: assignment.affLevel,
          groupId: assignment.groupId  // 🔥 PRESERVE GROUP ID
        }
        
        await db.addToQueue(queueStudent, priorityTimestamp)
      }
    } catch (error) {
      console.error('Failed to return to queue:', error)
      alert('Failed to return to queue')
    } finally {
      handleDragEnd()
    }
  }
  
  const handleDrop = async (loadId: string) => {
    if (!draggedItem) return
    
    try {
      const load = loads.find(l => l.id === loadId)
      if (!load) return
      
      // 🔥 Check if we're dropping a GROUP from another LOAD
      if (draggedItem.type === 'group' && draggedItem.sourceLoadId) {
        const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
        const targetLoad = loads.find(l => l.id === loadId)
        
        if (!sourceLoad || !targetLoad || sourceLoad.id === targetLoad.id) return
        
        const groupId = draggedItem.id
        
        // Find all assignments with this groupId in the source load
        const groupAssignments = sourceLoad.assignments?.filter(a => a.groupId === groupId) || []
        if (groupAssignments.length === 0) return
        
        // Remove group assignments from source load
        await updateLoad(sourceLoad.id, {
          assignments: sourceLoad.assignments?.filter(a => a.groupId !== groupId) || []
        })
        
        // Add group assignments to target load
        await updateLoad(targetLoad.id, {
          assignments: [...(targetLoad.assignments || []), ...groupAssignments]
        })
        
      } else if (draggedItem.type === 'group' && !draggedItem.sourceLoadId) {
        // Dropping a GROUP from QUEUE (existing logic)
        const groupId = draggedItem.id
        const group = groups.find(g => g.id === groupId)
        if (!group) return
        
        // Find all students in this group
        const groupStudents = queue.filter(s => group.studentIds.includes(s.id))
        if (groupStudents.length === 0) return
        
        // Generate unique IDs for all assignments
        const generateId = () => {
          const timestamp = Date.now()
          const random = Math.random().toString(36).substring(2, 11)
          return `${timestamp}-${random}`
        }
        
        // Create assignments for ALL students in the group
        const newAssignments: LoadAssignment[] = groupStudents.map(student => ({
          id: generateId(),
          studentId: student.id,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          affLevel: student.affLevel,
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          hasOutsideVideo: student.outsideVideo,
          groupId: groupId  // 🔥 PRESERVE GROUP ID
        }))
        
        // Add to load
        await updateLoad(load.id, {
          assignments: [...(load.assignments || []), ...newAssignments]
        })
        
        // Remove from queue
        for (const student of groupStudents) {
          await db.removeFromQueue(student.id)
        }
        
      } else if (draggedItem.type === 'student') {
        // Dropping a STUDENT from QUEUE
        const student = queue.find(s => s.id === draggedItem.id)
        if (!student) return
        
        const newAssignment: LoadAssignment = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          studentId: student.id,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          affLevel: student.affLevel,
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          hasOutsideVideo: student.outsideVideo,
          groupId: student.groupId  // 🔥 PRESERVE GROUP ID IF EXISTS
        }
        
        await updateLoad(load.id, {
          assignments: [...(load.assignments || []), newAssignment]
        })
        
        await db.removeFromQueue(draggedItem.id)
        
      } else if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId) {
        // Original assignment move logic
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
                      ? 'bg-blue-500/30 text-white shadow-lg scale-105 border-2 border-blue-400'
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
                    ✈️ Departed
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
                    🎉 Completed
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
            <div 
              className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/20 sticky top-8"
              onDragOver={(e) => {
                // Only allow drops from loads (must have sourceLoadId)
                if (draggedItem?.sourceLoadId) {
                  e.preventDefault()
                  setDropTarget('queue')
                }
              }}
              onDragLeave={() => {
                setDropTarget(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedItem?.sourceLoadId) {
                  handleDropToQueue()
                }
              }}
              style={{
                backgroundColor: dropTarget === 'queue' ? 'rgba(59, 130, 246, 0.2)' : undefined,
                borderColor: dropTarget === 'queue' ? 'rgb(59, 130, 246)' : undefined,
                transform: dropTarget === 'queue' ? 'scale(1.02)' : undefined
              }}
            >
              <h2 className="text-2xl font-bold text-white mb-4">📋 Student Queue</h2>
              
              {/* Jump Type Filter */}
              <div className="mb-4">
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
                {isDragging && draggedItem?.sourceLoadId && (
                  <div className="bg-blue-500/20 border-2 border-blue-500 border-dashed rounded-lg p-4 mb-4 text-center animate-pulse">
                    <div className="text-blue-300 font-semibold mb-1">
                      ↓ Drop here to return to queue
                    </div>
                    <div className="text-xs text-blue-400">
                      {draggedItem.type === 'group' 
                        ? 'All students will be returned together'
                        : 'Student will be added to top of queue'
                      }
                    </div>
                  </div>
                )}
                
                {queueLoading ? (
                  <div className="text-center py-8 text-slate-400">Loading queue...</div>
                ) : filteredQueue.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm">Queue is empty</p>
                  </div>
                ) : (
                  <>
                    {/* Render Groups */}
                    {groups.filter(g => g.studentIds.some(sid => filteredQueue.find(s => s.id === sid))).map((group) => {
                      const groupStudents = filteredQueue.filter(s => group.studentIds.includes(s.id))
                      const totalCapacity = groupStudents.length * 2 + groupStudents.filter(s => s.outsideVideo).length
                      
                      return (
                        <div
                          key={group.id}
                          draggable
                          onDragStart={() => handleDragStart('group', group.id)}
                          onDragEnd={handleDragEnd}
                          className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500/50 rounded-lg p-3 cursor-move hover:scale-105 transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-bold text-purple-300">👥 {group.name}</div>
                            <div className="text-xs text-purple-400">{groupStudents.length} students</div>
                          </div>
                          <div className="text-xs text-slate-400">
                            Capacity: {totalCapacity}/18 ({totalCapacity > 18 ? 'OVER' : 'OK'})
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Render Individual Students */}
                    {individualStudents.map((student) => (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={() => handleDragStart('student', student.id)}
                        onDragEnd={handleDragEnd}
                        className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 cursor-move hover:bg-slate-700 hover:border-blue-500 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-white">{student.name}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              {student.jumpType.toUpperCase()} • {student.weight} lbs
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}