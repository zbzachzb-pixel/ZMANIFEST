// src/app/loads/page.tsx - COMPLETE FILE WITH FIXED GROUP DISPLAY

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
  const [statusFilter, setStatusFilter] = useState<'all' | Load['status']>('all')
  
  // Load scheduling settings
  const loadSchedulingSettings: LoadSchedulingSettings = {
    minutesBetweenLoads: 20,
    instructorCycleTime: 40
  }
  
  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  // Calculate instructor balances
  const instructorBalances = useMemo(() => {
    const balances = new Map<string, number>()
    const period = getCurrentPeriod()
    
    instructors.forEach(instructor => {
      const instructorAssignments = assignments.filter(a => 
        a.instructorId === instructor.id && 
        a.period === period
      )
      
      let balance = 0
      instructorAssignments.forEach(assignment => {
        if (assignment.pay) {
          balance += assignment.pay
        }
      })
      
      balances.set(instructor.id, balance)
    })
    
    return balances
  }, [instructors, assignments])
  
  // Filter queue by jump type
  const filteredQueue = useMemo(() => {
    let filtered = queue
    
    if (selectedJumpType !== 'all') {
      filtered = filtered.filter(s => s.jumpType === selectedJumpType)
    }
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.weight.toString().includes(searchTerm)
      )
    }
    
    return filtered
  }, [queue, selectedJumpType, searchTerm])
  
  // ✅ FIXED: Separate grouped and ungrouped students (like queue page)
  const { activeGroups, ungroupedStudents } = useMemo(() => {
    if (!groups || groups.length === 0) {
      return { activeGroups: [], ungroupedStudents: filteredQueue }
    }
    
    const activeGroups = groups.filter(g => 
      g.studentIds && g.studentIds.some(sid => filteredQueue.find(s => s.id === sid))
    )
    const groupedIds = new Set(activeGroups.flatMap(g => g.studentIds || []))
    const ungrouped = filteredQueue.filter(s => !groupedIds.has(s.id))
    
    return { activeGroups, ungroupedStudents: ungrouped }
  }, [groups, filteredQueue])
  
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
  
  // ✅ FIXED: Handle dropping groups/students back to queue
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
        
        // ✅ FIX: Update the Group document to include the student IDs
        if (groups && groups.length > 0) {
          const group = groups.find(g => g.id === groupId)
          if (group) {
            const studentIdsToAdd = groupAssignments.map(a => a.studentId)
            const updatedStudentIds = [...new Set([...(group.studentIds || []), ...studentIdsToAdd])]
            await db.updateGroup(groupId, { studentIds: updatedStudentIds })
          }
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
            groupId: groupId
          }
          
          await db.addToQueue(queueStudent, priorityTimestamp)
        }
        
      } else if (draggedItem.type === 'assignment') {
        // Dropping single assignment back to queue
        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) return
        
        // Update group if student was in one
        if (assignment.groupId && groups && groups.length > 0) {
          const group = groups.find(g => g.id === assignment.groupId)
          if (group && !group.studentIds.includes(assignment.studentId)) {
            await db.updateGroup(assignment.groupId, { 
              studentIds: [...(group.studentIds || []), assignment.studentId]
            })
          }
        }
        
        // Remove from load
        await updateLoad(sourceLoad.id, {
          assignments: sourceLoad.assignments?.filter(a => a.id !== draggedItem.id) || []
        })
        
        // Add back to queue with PRIORITY
        const queueStudent: CreateQueueStudent = {
          name: assignment.studentName,
          weight: assignment.studentWeight,
          jumpType: assignment.jumpType,
          isRequest: false,
          tandemWeightTax: assignment.tandemWeightTax || 0,
          tandemHandcam: assignment.tandemHandcam || false,
          outsideVideo: assignment.hasOutsideVideo,
          affLevel: assignment.affLevel,
          groupId: assignment.groupId
        }
        
        const priorityTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        await db.addToQueue(queueStudent, priorityTimestamp)
      }
      
      handleDragEnd()
    } catch (error) {
      console.error('Failed to drop to queue:', error)
      alert('Failed to return to queue')
      handleDragEnd()
    }
  }
  
  const handleDropToLoad = async (loadId: string) => {
    if (!draggedItem) return
    
    const targetLoad = loads.find(l => l.id === loadId)
    if (!targetLoad || targetLoad.status !== 'building') return
    
    try {
      if (draggedItem.type === 'student') {
        // Add student to load
        const student = queue.find(s => s.id === draggedItem.id)
        if (!student) return
        
        const newAssignment: LoadAssignment = {
          id: `assign-${Date.now()}-${Math.random()}`,
          studentId: student.id,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          loadId: loadId,
          hasOutsideVideo: student.outsideVideo || false,
          tandemWeightTax: student.tandemWeightTax || 0,
          tandemHandcam: student.tandemHandcam || false,
          affLevel: student.affLevel,
          groupId: student.groupId
        }
        
        await updateLoad(loadId, {
          assignments: [...(targetLoad.assignments || []), newAssignment]
        })
        
        await db.removeFromQueue(student.id)
        
      } else if (draggedItem.type === 'group') {
        // Add entire group to load
        const groupId = draggedItem.id
        if (!groups || groups.length === 0) {
          alert('Group not found')
          return
        }
        
        const group = groups.find(g => g.id === groupId)
        if (!group) return
        
        const groupStudents = queue.filter(s => (group.studentIds || []).includes(s.id))
        if (groupStudents.length === 0) return
        
        const newAssignments: LoadAssignment[] = groupStudents.map(student => ({
          id: `assign-${Date.now()}-${Math.random()}-${student.id}`,
          studentId: student.id,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          loadId: loadId,
          hasOutsideVideo: student.outsideVideo || false,
          tandemWeightTax: student.tandemWeightTax || 0,
          tandemHandcam: student.tandemHandcam || false,
          affLevel: student.affLevel,
          groupId: groupId
        }))
        
        await updateLoad(loadId, {
          assignments: [...(targetLoad.assignments || []), ...newAssignments]
        })
        
        for (const student of groupStudents) {
          await db.removeFromQueue(student.id)
        }
        
        // Remove students from group document
        await db.updateGroup(groupId, { 
          studentIds: (group.studentIds || []).filter(sid => !groupStudents.find(s => s.id === sid))
        })
        
      } else if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId) {
        // Move assignment between loads
        const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
        if (!sourceLoad) return
        
        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) return
        
        await updateLoad(sourceLoad.id, {
          assignments: sourceLoad.assignments?.filter(a => a.id !== draggedItem.id) || []
        })
        
        await updateLoad(loadId, {
          assignments: [...(targetLoad.assignments || []), { ...assignment, loadId }]
        })
      }
      
      handleDragEnd()
    } catch (error) {
      console.error('Failed to drop to load:', error)
      alert('Failed to add to load')
      handleDragEnd()
    }
  }
  
  // ============================================
  // RENDER
  // ============================================
  
  if (loadsLoading || queueLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">✈️ Load Builder</h1>
          <p className="text-slate-300">Build and manage loads, assign instructors, and track departures</p>
        </div>
        
        <div className="grid grid-cols-12 gap-6">
          {/* STUDENT QUEUE SIDEBAR */}
          <div className="col-span-3">
            <div
              className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border-2 border-white/20 sticky top-8 transition-all"
              onDragOver={(e) => {
                if (draggedItem?.sourceLoadId) {
                  e.preventDefault()
                  setDropTarget('queue')
                }
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={handleDropToQueue}
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
                    {/* ✅ FIXED: Render Groups with Individual Student Cards */}
                    {activeGroups.map((group) => {
                      const groupStudents = filteredQueue.filter(s => (group.studentIds || []).includes(s.id))
                      const totalCapacity = groupStudents.length * 2 + groupStudents.filter(s => s.outsideVideo).length
                      const overCapacity = totalCapacity > 18
                      
                      return (
                        <div
                          key={group.id}
                          draggable
                          onDragStart={() => handleDragStart('group', group.id)}
                          onDragEnd={handleDragEnd}
                          className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500/50 rounded-xl p-3 cursor-move hover:scale-102 hover:border-purple-400 transition-all space-y-2"
                        >
                          {/* Group Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-purple-500/30">
                            <div className="font-bold text-purple-300">👥 {group.name}</div>
                            <div className="text-xs text-purple-400">
                              {groupStudents.length} students • {totalCapacity}/18 slots
                              {overCapacity && <span className="text-red-400 ml-1">⚠️</span>}
                            </div>
                          </div>
                          
                          {/* Individual Student Cards within Group */}
                          {groupStudents.map(student => (
                            <div
                              key={student.id}
                              className="bg-slate-700/50 rounded-lg p-2 border border-purple-500/30"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-semibold text-white text-sm">{student.name}</div>
                                  <div className="text-xs text-slate-400">
                                    {student.jumpType.toUpperCase()} • {student.weight} lbs
                                    {student.outsideVideo && <span className="text-purple-400 ml-1">📹</span>}
                                  </div>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-bold ${
                                  student.jumpType === 'tandem' 
                                    ? 'bg-green-500/20 text-green-300' 
                                    : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                  {student.jumpType === 'tandem' ? 'T' : 'A'}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <div className="text-xs text-center text-purple-400 pt-1">
                            Drag entire group to load
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Individual (Ungrouped) Students */}
                    {activeGroups.length > 0 && ungroupedStudents.length > 0 && (
                      <div className="text-xs font-semibold text-slate-400 pt-2 pb-1">Individual Students</div>
                    )}
                    
                    {ungroupedStudents.map(student => (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={() => handleDragStart('student', student.id)}
                        onDragEnd={handleDragEnd}
                        className="bg-white/10 hover:bg-white/20 rounded-lg p-3 cursor-move transition-all border border-white/20 hover:border-blue-400"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-white">{student.name}</div>
                            <div className="text-sm text-slate-400">
                              {student.jumpType.toUpperCase()} • {student.weight} lbs
                              {student.outsideVideo && <span className="text-purple-400 ml-1">📹</span>}
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                            student.jumpType === 'tandem' 
                              ? 'bg-green-500/20 text-green-300' 
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {student.jumpType === 'tandem' ? 'TANDEM' : 'AFF'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* LOADS SECTION */}
          <div className="col-span-9">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex gap-2">
                {(['all', 'building', 'ready', 'departed', 'completed'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      statusFilter === status
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)} ({loadCounts[status]})
                  </button>
                ))}
              </div>
              
              <button
                onClick={handleCreateLoad}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                + New Load
              </button>
            </div>
            
            {filteredLoads.length === 0 ? (
              <div className="text-center py-16 bg-white/5 rounded-xl border-2 border-dashed border-white/20">
                <p className="text-slate-400 text-lg">No loads yet. Create your first load to get started!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredLoads.map(load => (
                  <LoadBuilderCard
                    key={load.id}
                    load={load}
                    allLoads={loads}
                    instructors={instructors}
                    instructorBalances={instructorBalances}
                    onDrop={handleDropToLoad}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    dropTarget={dropTarget}
                    setDropTarget={setDropTarget}
                    loadSchedulingSettings={loadSchedulingSettings}
                    onDelay={handleDelayLoad}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}