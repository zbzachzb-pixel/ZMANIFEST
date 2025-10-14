'use client'

import React, { useState, useMemo } from 'react'
import { useLoads, useQueue, useActiveInstructors, useAssignments, useCreateLoad, useUpdateLoad } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type { QueueStudent, Instructor, Load, LoadAssignment, Assignment } from '@/types'

export default function LoadBuilderPage() {
  const { data: loads, loading: loadsLoading } = useLoads()
  const { data: queue, loading: queueLoading } = useQueue()
  const { data: instructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { create: createLoad } = useCreateLoad()
  const { update: updateLoad } = useUpdateLoad()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedJumpType, setSelectedJumpType] = useState<'all' | 'tandem' | 'aff'>('all')
  const [draggedItem, setDraggedItem] = useState<{ type: 'student' | 'assignment', id: string, sourceLoadId?: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const period = getCurrentPeriod()
  const buildingLoads = loads.filter(l => l.status === 'building')

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
        
        if (assignment.instructorId === instructor.id) balance += pay
        if (assignment.videoInstructorId === instructor.id && !assignment.isMissedJump) balance += 45
      })
      balances.set(instructor.id, balance)
    })
    return balances
  }, [instructors, assignments, period])

  const filteredQueue = useMemo(() => {
    return queue.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = selectedJumpType === 'all' || student.jumpType === selectedJumpType
      return matchesSearch && matchesType
    })
  }, [queue, searchTerm, selectedJumpType])

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
      alert('Failed to create load')
    }
  }

  const handleDeleteLoad = async (loadId: string) => {
    const load = loads.find(l => l.id === loadId)
    if (!load) return
    
    const assignments = load.assignments || []
    if (assignments.length > 0) {
      if (!confirm(`Delete ${load.name}? All ${assignments.length} assignments will return to queue.`)) return
      
      // Return students to queue
      for (const assignment of assignments) {
        try {
          await db.addToQueue({
            name: assignment.studentName,
            weight: assignment.studentWeight,
            jumpType: assignment.jumpType,
            tandemWeightTax: assignment.tandemWeightTax,
            tandemHandcam: assignment.tandemHandcam,
            affLevel: assignment.affLevel,
            outsideVideo: assignment.hasOutsideVideo,
            isRequest: assignment.isRequest
          })
        } catch (error) {
          console.error('Failed to return student to queue:', error)
        }
      }
    }
    
    try {
      await db.deleteLoad(loadId)
    } catch (error) {
      console.error('Failed to delete load:', error)
      alert('Failed to delete load')
    }
  }

  const findBestInstructor = (student: QueueStudent, currentAssignments: LoadAssignment[]): Instructor | null => {
    const alreadyAssignedIds = new Set(currentAssignments.map(a => a.instructorId).filter(Boolean))
    const clockedIn = instructors.filter(i => i.clockedIn)
    
    const qualified = clockedIn.filter(instructor => {
      if (alreadyAssignedIds.has(instructor.id)) return false
      
      // Check certifications
      if (student.jumpType === 'tandem' && !instructor.tandem) return false
      if (student.jumpType === 'aff' && !instructor.aff) return false
      
      // Check weight limits
      const totalWeight = instructor.bodyWeight + student.weight
      if (student.jumpType === 'tandem' && instructor.tandemWeightLimit && totalWeight > instructor.tandemWeightLimit) return false
      if (student.jumpType === 'aff' && instructor.affWeightLimit && totalWeight > instructor.affWeightLimit) return false
      
      // Check AFF lock
      if (student.jumpType === 'aff' && instructor.affLocked) return false
      
      return true
    })

    if (qualified.length === 0) return null
    
    // Sort by balance (lowest first for fair rotation)
    qualified.sort((a, b) => {
      const balanceA = instructorBalances.get(a.id) || 0
      const balanceB = instructorBalances.get(b.id) || 0
      return balanceA - balanceB
    })
    
    return qualified[0]
  }

  const handleAssignInstructor = async (loadId: string, assignmentId: string) => {
    const load = loads.find(l => l.id === loadId)
    if (!load) return
    
    const assignments = load.assignments || []
    const assignment = assignments.find(a => a.id === assignmentId)
    if (!assignment || assignment.instructorId) return
    
    const student: QueueStudent = {
      id: assignment.studentId,
      name: assignment.studentName,
      weight: assignment.studentWeight,
      jumpType: assignment.jumpType,
      timestamp: new Date().toISOString(),
      tandemWeightTax: assignment.tandemWeightTax,
      tandemHandcam: assignment.tandemHandcam,
      affLevel: assignment.affLevel,
      isRequest: assignment.isRequest
    }
    
    const instructor = findBestInstructor(student, assignments)
    if (!instructor) {
      alert('❌ No qualified instructor available for this student')
      return
    }
    
    const updatedAssignments = assignments.map(a => 
      a.id === assignmentId 
        ? { ...a, instructorId: instructor.id, instructorName: instructor.name }
        : a
    )
    
    try {
      await updateLoad(loadId, { assignments: updatedAssignments })
    } catch (error) {
      console.error('Failed to assign instructor:', error)
      alert('Failed to assign instructor')
    }
  }

  const handleOptimizeLoad = async (loadId: string) => {
    const load = loads.find(l => l.id === loadId)
    if (!load) return
    
    const assignments = load.assignments || []
    const optimizedAssignments = [...assignments]
    let assignedCount = 0
    
    for (let i = 0; i < optimizedAssignments.length; i++) {
      const assignment = optimizedAssignments[i]
      if (assignment.instructorId) continue
      
      const student: QueueStudent = {
        id: assignment.studentId,
        name: assignment.studentName,
        weight: assignment.studentWeight,
        jumpType: assignment.jumpType,
        timestamp: new Date().toISOString(),
        tandemWeightTax: assignment.tandemWeightTax,
        affLevel: assignment.affLevel,
        isRequest: assignment.isRequest
      }
      
      const currentlyAssigned = optimizedAssignments.slice(0, i).filter(a => a.instructorId)
      const instructor = findBestInstructor(student, currentlyAssigned)
      
      if (instructor) {
        optimizedAssignments[i] = {
          ...assignment,
          instructorId: instructor.id,
          instructorName: instructor.name
        }
        assignedCount++
      }
    }
    
    try {
      await updateLoad(loadId, { assignments: optimizedAssignments })
      if (assignedCount > 0) {
        alert(`✅ Assigned ${assignedCount} instructor${assignedCount !== 1 ? 's' : ''}!`)
      } else {
        alert('⚠️ No available instructors could be assigned')
      }
    } catch (error) {
      console.error('Failed to optimize load:', error)
      alert('Failed to optimize load')
    }
  }

  const calculateLoadWeight = (load: Load) => {
    let totalPeople = 0
    const assignments = load.assignments || []
    assignments.forEach(a => {
      totalPeople += 2 // Student + instructor
      if (a.hasOutsideVideo || a.videoInstructorId) totalPeople += 1
    })
    return totalPeople
  }

  const handleDragStart = (e: React.DragEvent, type: 'student' | 'assignment', id: string, sourceLoadId?: string) => {
    setDraggedItem({ type, id, sourceLoadId })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(targetId)
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDrop = async (e: React.DragEvent, targetType: 'queue' | 'load', targetLoadId?: string) => {
    e.preventDefault()
    setDropTarget(null)
    
    if (!draggedItem) return

    // Student from queue to load
    if (draggedItem.type === 'student' && targetType === 'load' && targetLoadId) {
      const student = queue.find(s => s.id === draggedItem.id)
      if (!student) return
      
      const targetLoad = loads.find(l => l.id === targetLoadId)
      if (!targetLoad) return
      
      const currentPeople = calculateLoadWeight(targetLoad)
      const newPeople = 2 + (student.outsideVideo ? 1 : 0)
      
      if (currentPeople + newPeople > targetLoad.capacity) {
        alert(`⚠️ Cannot add student: would exceed capacity (${currentPeople + newPeople}/${targetLoad.capacity})`)
        return
      }
      
      const newAssignment: LoadAssignment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        studentId: student.id,
        studentName: student.name,
        studentWeight: student.weight,
        jumpType: student.jumpType,
        isRequest: student.isRequest,
        instructorId: '',
        instructorName: '',
        tandemWeightTax: student.tandemWeightTax,
        tandemHandcam: student.tandemHandcam,
        affLevel: student.affLevel,
        hasOutsideVideo: student.outsideVideo
      }
      
      try {
        await updateLoad(targetLoadId, { 
          assignments: [...(targetLoad.assignments || []), newAssignment] 
        })
        await db.removeFromQueue(student.id)
      } catch (error) {
        console.error('Failed to add student to load:', error)
        alert('Failed to add student to load')
      }
    }
    
    // Assignment from load to queue
    else if (draggedItem.type === 'assignment' && targetType === 'queue') {
      const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
      if (!sourceLoad) return
      
      const assignments = sourceLoad.assignments || []
      const assignment = assignments.find(a => a.id === draggedItem.id)
      if (!assignment) return
      
      try {
        await db.addToQueue({
          name: assignment.studentName,
          weight: assignment.studentWeight,
          jumpType: assignment.jumpType,
          tandemWeightTax: assignment.tandemWeightTax,
          tandemHandcam: assignment.tandemHandcam,
          affLevel: assignment.affLevel,
          outsideVideo: assignment.hasOutsideVideo,
          isRequest: assignment.isRequest
        })
        
        await updateLoad(draggedItem.sourceLoadId!, { 
          assignments: (sourceLoad.assignments || []).filter(a => a.id !== draggedItem.id) 
        })
      } catch (error) {
        console.error('Failed to return student to queue:', error)
        alert('Failed to return student to queue')
      }
    }
    
    // Assignment between loads
    else if (draggedItem.type === 'assignment' && targetType === 'load' && targetLoadId) {
      if (draggedItem.sourceLoadId === targetLoadId) return
      
      const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
      const targetLoad = loads.find(l => l.id === targetLoadId)
      if (!sourceLoad || !targetLoad) return
      
      const sourceAssignments = sourceLoad.assignments || []
      const assignment = sourceAssignments.find(a => a.id === draggedItem.id)
      if (!assignment) return
      
      const currentPeople = calculateLoadWeight(targetLoad)
      const newPeople = 2 + (assignment.hasOutsideVideo || assignment.videoInstructorId ? 1 : 0)
      
      if (currentPeople + newPeople > targetLoad.capacity) {
        alert(`⚠️ Cannot move student: would exceed capacity (${currentPeople + newPeople}/${targetLoad.capacity})`)
        return
      }
      
      try {
        // Remove instructor assignment when moving between loads
        const movedAssignment = { 
          ...assignment, 
          instructorId: undefined, 
          instructorName: undefined 
        }
        
        await updateLoad(draggedItem.sourceLoadId!, { 
          assignments: (sourceLoad.assignments || []).filter(a => a.id !== draggedItem.id) 
        })
        
        await updateLoad(targetLoadId, { 
          assignments: [...(targetLoad.assignments || []), movedAssignment] 
        })
      } catch (error) {
        console.error('Failed to move student between loads:', error)
        alert('Failed to move student between loads')
      }
    }

    setDraggedItem(null)
  }

  if (loadsLoading || queueLoading) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-[1920px] mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">✈️ Load Builder</h1>
            <p className="text-slate-300">Drag students from queue into loads. Smart assignment included!</p>
          </div>
          <button
            onClick={handleCreateLoad}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span> New Load
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Queue Sidebar */}
          <div className="col-span-3">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 sticky top-8">
              <h2 className="text-2xl font-bold text-white mb-4">📋 Student Queue ({queue.length})</h2>
              
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
                          ? type === 'all' ? 'bg-blue-500 text-white' : type === 'tandem' ? 'bg-green-500 text-white' : 'bg-purple-500 text-white'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                    >
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div
                onDragOver={(e) => handleDragOver(e, 'queue')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'queue')}
                className={`space-y-2 min-h-[400px] max-h-[600px] overflow-y-auto pr-2 rounded-lg p-2 transition-colors ${
                  dropTarget === 'queue' ? 'bg-blue-500/20 border-2 border-blue-500' : ''
                }`}
              >
                {filteredQueue.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    {searchTerm || selectedJumpType !== 'all' ? 'No students match filters' : 'Queue is empty'}
                  </div>
                ) : (
                  filteredQueue.map(student => (
                    <div
                      key={student.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'student', student.id)}
                      className="bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all cursor-move"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-white text-sm">{student.name}</div>
                          <div className="text-xs text-slate-400">{student.weight} lbs</div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          student.jumpType === 'tandem' ? 'bg-green-500/20 text-green-300' :
                          student.jumpType === 'aff' ? 'bg-purple-500/20 text-purple-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {student.jumpType.toUpperCase()}
                        </span>
                      </div>
                      
                      {student.jumpType === 'tandem' && (
                        <div className="flex gap-1 flex-wrap">
                          {(student.tandemWeightTax ?? 0) > 0 && (
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">
                              +${(student.tandemWeightTax ?? 0) * 20} tax
                            </span>
                          )}
                          {student.tandemHandcam && (
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                              📷 Handcam
                            </span>
                          )}
                          {student.outsideVideo && (
                            <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded">
                              🎥 Outside
                            </span>
                          )}
                        </div>
                      )}
                      
                      {student.jumpType === 'aff' && student.affLevel && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                          {student.affLevel === 'lower' ? 'AFF 1-4 ($55)' : 'AFF 5-7 ($45)'}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Loads Area */}
          <div className="col-span-9">
            {buildingLoads.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-12 text-center border border-white/20">
                <div className="text-6xl mb-4">✈️</div>
                <p className="text-white text-xl font-semibold mb-2">No loads created</p>
                <p className="text-slate-400 mb-6">Create your first load to start building</p>
                <button
                  onClick={handleCreateLoad}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <span className="text-xl">+</span> Create Load
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {buildingLoads.map(load => {
                  const assignments = load.assignments || []
                  const totalPeople = calculateLoadWeight(load)
                  const isOverCapacity = totalPeople > load.capacity
                  const unassignedCount = assignments.filter(a => !a.instructorId).length
                  const percentFull = Math.round((totalPeople / load.capacity) * 100)
                  
                  return (
                    <div key={load.id} className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border-2 border-white/20">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1">{load.name}</h3>
                          <div className={`text-sm font-medium mb-2 ${isOverCapacity ? 'text-red-400' : 'text-slate-400'}`}>
                            {totalPeople}/{load.capacity} people ({percentFull}%) {isOverCapacity && '⚠️ OVER CAPACITY'}
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
                        <div className="flex gap-2 ml-4">
                          {assignments.length > 0 && (
                            <button
                              onClick={() => handleOptimizeLoad(load.id)}
                              className="bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
                              title="Auto-assign all unassigned students"
                            >
                              ⚡ Optimize
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteLoad(load.id)}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {unassignedCount > 0 && (
                        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
                          <div className="text-yellow-300 font-semibold text-sm">
                            ⚠️ {unassignedCount} student{unassignedCount !== 1 ? 's' : ''} need instructor assignment
                          </div>
                        </div>
                      )}

                      <div
                        onDragOver={(e) => handleDragOver(e, `load-${load.id}`)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'load', load.id)}
                        className={`space-y-2 min-h-[200px] rounded-lg p-3 transition-colors ${
                          dropTarget === `load-${load.id}` ? 'bg-green-500/20 border-2 border-green-500' : 'bg-black/20'
                        }`}
                      >
                        {assignments.length === 0 ? (
                          <div className="text-center text-slate-400 py-12">
                            <div className="text-4xl mb-2">👇</div>
                            <div>Drag students here</div>
                          </div>
                        ) : (
                          assignments.map(assignment => (
                            <div
                              key={assignment.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, 'assignment', assignment.id, load.id)}
                              className={`bg-white/5 rounded-lg p-3 border transition-all cursor-move ${
                                assignment.instructorId ? 'border-green-500/50 bg-green-500/5' : 'border-yellow-500/50 bg-yellow-500/5'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                                    {assignment.studentName}
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      assignment.jumpType === 'tandem' ? 'bg-green-500/20 text-green-300' :
                                      'bg-purple-500/20 text-purple-300'
                                    }`}>
                                      {assignment.jumpType.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400">{assignment.studentWeight} lbs</div>
                                </div>
                              </div>

                              {assignment.instructorId ? (
                                <div className="bg-green-500/20 rounded px-3 py-2 text-xs border border-green-500/30">
                                  <span className="text-green-300 font-semibold">
                                    ✓ Instructor: {assignment.instructorName}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAssignInstructor(load.id, assignment.id)}
                                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded px-3 py-2 text-xs font-semibold transition-colors border border-blue-500/30"
                                >
                                  🎯 Assign Best Instructor
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {assignments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Students</div>
                            <div className="text-lg font-bold text-white">{assignments.length}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Assigned</div>
                            <div className="text-lg font-bold text-green-400">
                              {assignments.filter(a => a.instructorId).length}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Pending</div>
                            <div className="text-lg font-bold text-yellow-400">{unassignedCount}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}