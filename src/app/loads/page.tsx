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
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<{ type: 'student' | 'assignment', id: string, sourceLoadId?: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [showOptimizeConfirm, setShowOptimizeConfirm] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

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

  const findBestInstructor = (student: QueueStudent, currentAssignments: LoadAssignment[], excludeIds: Set<string>): Instructor | null => {
    const alreadyAssignedIds = new Set([...currentAssignments.map(a => a.instructorId).filter(Boolean), ...excludeIds])
    const clockedIn = instructors.filter(i => i.clockedIn)
    
    const qualified = clockedIn.filter(instructor => {
      if (alreadyAssignedIds.has(instructor.id)) return false
      if (student.jumpType === 'tandem' && !instructor.tandem) return false
      if (student.jumpType === 'aff' && !instructor.aff) return false
      if (student.jumpType === 'tandem' && instructor.tandemWeightLimit && student.weight > instructor.tandemWeightLimit) return false
      if (student.jumpType === 'aff' && instructor.affWeightLimit && student.weight > instructor.affWeightLimit) return false
      if (student.jumpType === 'aff' && instructor.affLocked) return false
      return true
    })

    if (qualified.length === 0) return null
    
    qualified.sort((a, b) => {
      const balanceA = instructorBalances.get(a.id) || 0
      const balanceB = instructorBalances.get(b.id) || 0
      return balanceA - balanceB
    })
    
    return qualified[0]
  }

  // ⭐ NEW: Helper function to lock AFF instructor
 const lockAFFInstructor = async (instructorId: string, studentName: string, studentId: string) => {
  console.log('🔒 LOCKING AFF INSTRUCTOR:', { instructorId, studentName, studentId })
  
  const instructor = instructors.find(i => i.id === instructorId)
  if (!instructor) {
    console.log('❌ Instructor not found!')
    return
  }

  const updatedAffStudents = [
    ...(instructor.affStudents || []),
    {
      name: studentName,
      startTime: new Date().toISOString(),
      studentId: studentId
    }
  ]

  console.log('✅ About to update instructor with:', { affLocked: true, affStudents: updatedAffStudents })
  
  await db.updateInstructor(instructorId, {
    affLocked: true,
    affStudents: updatedAffStudents
  })
  
  console.log('✅ Instructor updated!')
}

  const handleAssignInstructor = async (loadId: string, assignmentId: string) => {
    const load = loads.find(l => l.id === loadId)
    if (!load) {
      alert('❌ Load not found')
      return
    }
    
    const assignments = load.assignments || []
    const assignment = assignments.find(a => a.id === assignmentId)
    
    if (!assignment || assignment.instructorId) return
    
    const student: QueueStudent = {
      id: assignment.studentId || assignmentId,
      name: assignment.studentName,
      weight: assignment.studentWeight,
      jumpType: assignment.jumpType,
      timestamp: new Date().toISOString(),
      tandemWeightTax: assignment.tandemWeightTax,
      tandemHandcam: assignment.tandemHandcam,
      affLevel: assignment.affLevel,
      isRequest: assignment.isRequest
    }
    
    const usedInstructors = new Set<string>()
    buildingLoads.forEach(l => {
      (l.assignments || []).forEach(a => {
        if (a.instructorId) usedInstructors.add(a.instructorId)
        if (a.videoInstructorId) usedInstructors.add(a.videoInstructorId)
      })
    })
    
    const instructor = findBestInstructor(student, assignments, usedInstructors)
    if (!instructor) {
      alert('❌ No qualified instructor available')
      return
    }
    
    const updatedAssignments = assignments.map(a => 
      a.id === assignmentId 
        ? { ...a, instructorId: instructor.id, instructorName: instructor.name }
        : a
    )
    
    try {
      await updateLoad(loadId, { assignments: updatedAssignments })
      
      // ⭐ LOCK AFF INSTRUCTOR if this is an AFF jump
      if (student.jumpType === 'aff') {
        await lockAFFInstructor(instructor.id, student.name, student.id)
      }
    } catch (error) {
      console.error('Failed to assign instructor:', error)
      alert('Failed to assign instructor')
    }
  }

  const handleOptimizeAll = () => {
    if (buildingLoads.length === 0) {
      alert('❌ No loads to optimize. Create a load first.')
      return
    }
    
    if (queue.length === 0) {
      alert('❌ Queue is empty. Add students to the queue first.')
      return
    }
    
    const clockedInInstructors = instructors.filter(i => i.clockedIn)
    if (clockedInInstructors.length === 0) {
      alert('❌ No instructors are clocked in.')
      return
    }
    
    setShowOptimizeConfirm(true)
  }
  
  const executeOptimization = async () => {
    setShowOptimizeConfirm(false)
    setOptimizing(true)
    
    try {
      const usedInstructors = new Set<string>()
      const eligibleStudents = [...queue]
      const updates: { loadId: string, assignments: LoadAssignment[] }[] = []
      
      buildingLoads.forEach(load => {
        updates.push({
          loadId: load.id,
          assignments: [...(load.assignments || [])]
        })
      })
      
      let assignedCount = 0
      const studentsToRemove: string[] = []
      const affLocksToApply: { instructorId: string, studentName: string, studentId: string }[] = []
      
      for (let i = 0; i < eligibleStudents.length; i++) {
        const student = eligibleStudents[i]
        
        if (student.isRequest) continue
        
        const loadWithSpace = updates.find(u => {
          const load = buildingLoads.find(l => l.id === u.loadId)
          if (!load) return false
          const totalPeople = u.assignments.reduce((sum, a) => {
            let count = 2
            if (a.hasOutsideVideo || a.videoInstructorId) count += 1
            return sum + count
          }, 0)
          return totalPeople + 2 <= load.capacity
        })
        
        if (!loadWithSpace) break
        
        const instructor = findBestInstructor(student, loadWithSpace.assignments, usedInstructors)
        if (!instructor) continue
        
        usedInstructors.add(instructor.id)
        
        const newAssignment: LoadAssignment = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          studentId: student.id,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          isRequest: student.isRequest,
          instructorId: instructor.id,
          instructorName: instructor.name,
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          affLevel: student.affLevel,
          hasOutsideVideo: student.outsideVideo
        }
        
        loadWithSpace.assignments.push(newAssignment)
        studentsToRemove.push(student.id)
        assignedCount++
        
        // ⭐ Track AFF locks to apply after load updates
        if (student.jumpType === 'aff') {
          affLocksToApply.push({
            instructorId: instructor.id,
            studentName: student.name,
            studentId: student.id
          })
        }
      }
      
      if (assignedCount === 0) {
        alert('⚠️ No students could be assigned.')
        return
      }
      
      // Update all loads
      for (const update of updates) {
        await updateLoad(update.loadId, { assignments: update.assignments })
      }
      
      // ⭐ Apply AFF locks
      for (const lock of affLocksToApply) {
        await lockAFFInstructor(lock.instructorId, lock.studentName, lock.studentId)
      }
      
      // Remove students from queue
      for (const studentId of studentsToRemove) {
        await db.removeFromQueue(studentId)
      }
      
      alert(`✅ Optimization complete! Assigned ${assignedCount} student(s).`)
    } catch (error) {
      console.error('❌ Optimization failed:', error)
      alert('❌ Optimization failed.')
    } finally {
      setOptimizing(false)
    }
  }

  const calculateLoadWeight = (load: Load) => {
    let totalPeople = 0
    const assignments = load.assignments || []
    assignments.forEach(a => {
      totalPeople += 2
      if (a.hasOutsideVideo || a.videoInstructorId) totalPeople += 1
    })
    return totalPeople
  }

  const handleDragStart = (e: React.DragEvent, type: 'student' | 'assignment', id: string, sourceLoadId?: string) => {
    setDraggedItem({ type, id, sourceLoadId })
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDropTarget(null)
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
    setIsDragging(false)
    
    if (!draggedItem) return

    if (draggedItem.type === 'student' && targetType === 'load' && targetLoadId) {
      const student = queue.find(s => s.id === draggedItem.id)
      if (!student) return
      
      const targetLoad = loads.find(l => l.id === targetLoadId)
      if (!targetLoad) return
      
      const currentPeople = calculateLoadWeight(targetLoad)
      const newPeople = 2 + (student.outsideVideo ? 1 : 0)
      
      if (currentPeople + newPeople > targetLoad.capacity) {
        alert(`⚠️ Cannot add student: would exceed capacity`)
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

    setDraggedItem(null)
  }

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(studentId)) {
        newSet.delete(studentId)
      } else {
        newSet.add(studentId)
      }
      return newSet
    })
  }

  const handleBatchAssign = async () => {
    if (selectedStudents.size === 0) {
      alert('Please select at least one student')
      return
    }

    if (buildingLoads.length === 0) {
      alert('Please create a load first')
      return
    }

    const studentsToAssign = queue.filter(s => selectedStudents.has(s.id))
    
    try {
      const usedInstructors = new Set<string>()
      const updates: { loadId: string, assignments: LoadAssignment[] }[] = []
      
      buildingLoads.forEach(load => {
        updates.push({
          loadId: load.id,
          assignments: [...(load.assignments || [])]
        })
      })
      
      let assignedCount = 0
      const studentsToRemove: string[] = []
      const affLocksToApply: { instructorId: string, studentName: string, studentId: string }[] = []
      
      for (const student of studentsToAssign) {
        const loadWithSpace = updates.find(u => {
          const load = buildingLoads.find(l => l.id === u.loadId)
          if (!load) return false
          const totalPeople = u.assignments.reduce((sum, a) => {
            let count = 2
            if (a.hasOutsideVideo || a.videoInstructorId) count += 1
            return sum + count
          }, 0)
          return totalPeople + 2 <= load.capacity
        })
        
        if (!loadWithSpace) break
        
        const instructor = findBestInstructor(student, loadWithSpace.assignments, usedInstructors)
        if (!instructor) continue
        
        usedInstructors.add(instructor.id)
        
        const newAssignment: LoadAssignment = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          studentId: student.id,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          isRequest: student.isRequest,
          instructorId: instructor.id,
          instructorName: instructor.name,
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          affLevel: student.affLevel,
          hasOutsideVideo: student.outsideVideo
        }
        
        loadWithSpace.assignments.push(newAssignment)
        studentsToRemove.push(student.id)
        assignedCount++
        
        // ⭐ Track AFF locks to apply
        if (student.jumpType === 'aff') {
          affLocksToApply.push({
            instructorId: instructor.id,
            studentName: student.name,
            studentId: student.id
          })
        }
      }
      
      if (assignedCount === 0) {
        alert('⚠️ No students could be assigned.')
        return
      }
      
      // Update loads
      for (const update of updates) {
        await updateLoad(update.loadId, { assignments: update.assignments })
      }
      
      // ⭐ Apply AFF locks
      for (const lock of affLocksToApply) {
        await lockAFFInstructor(lock.instructorId, lock.studentName, lock.studentId)
      }
      
      // Remove from queue
      for (const studentId of studentsToRemove) {
        await db.removeFromQueue(studentId)
      }
      
      setSelectedStudents(new Set())
      alert(`✅ Assigned ${assignedCount} student(s)!`)
    } catch (error) {
      console.error('Batch assign failed:', error)
      alert('❌ Batch assign failed.')
    }
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

  const canOptimize = buildingLoads.length > 0 && queue.length > 0 && instructors.filter(i => i.clockedIn).length > 0
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-[1920px] mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">✈️ Smart Load Builder</h1>
            <p className="text-slate-300">Click or drag students to assign them to loads</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleOptimizeAll}
              disabled={optimizing || !canOptimize}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {optimizing ? '⏳ Optimizing...' : '🎯 Optimize All'}
            </button>
            <button
              onClick={handleCreateLoad}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <span className="text-xl">+</span> New Load
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
                  💡 <strong>Click</strong> to select • <strong>Drag</strong> to move
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
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedStudents.size > 0 && (
                <div className="mb-4 bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-green-300">
                      {selectedStudents.size} selected
                    </span>
                    <button
                      onClick={() => setSelectedStudents(new Set())}
                      className="text-xs text-green-300 hover:text-green-200"
                    >
                      Clear
                    </button>
                  </div>
                  <button
                    onClick={handleBatchAssign}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
                  >
                    ✓ Assign Selected
                  </button>
                </div>
              )}

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
                  filteredQueue.map(student => {
                    const isSelected = selectedStudents.has(student.id)
                    const isBeingDragged = draggedItem?.type === 'student' && draggedItem.id === student.id
                    
                    return (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'student', student.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => toggleStudentSelection(student.id)}
                        className={`rounded-lg p-3 border-2 transition-all cursor-pointer ${
                          isBeingDragged 
                            ? 'opacity-50 scale-95' 
                            : isSelected
                              ? 'bg-green-500/20 border-green-500 shadow-lg'
                              : 'bg-white/5 border-white/10 hover:border-blue-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-white text-sm flex items-center gap-2">
                              {isSelected && <span className="text-green-400">✓</span>}
                              {student.name}
                            </div>
                            <div className="text-xs text-slate-400">{student.weight} lbs</div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            student.jumpType === 'tandem' ? 'bg-green-500/20 text-green-300' :
                            'bg-purple-500/20 text-purple-300'
                          }`}>
                            {student.jumpType.toUpperCase()}
                          </span>
                        </div>
                        
                        {student.jumpType === 'tandem' && (
                          <div className="flex gap-1 flex-wrap">
                            {(student.tandemWeightTax ?? 0) > 0 && (
                              <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">
                                +${(student.tandemWeightTax ?? 0) * 20}
                              </span>
                            )}
                            {student.tandemHandcam && (
                              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                                📷
                              </span>
                            )}
                            {student.outsideVideo && (
                              <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded">
                                🎥
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
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
                  const isDropTarget = dropTarget === `load-${load.id}`
                  
                  return (
                    <div 
                      key={load.id} 
                      className={`bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border-2 transition-all ${
                        isDropTarget ? 'border-green-500 bg-green-500/10 scale-105' : 'border-white/20'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1">{load.name}</h3>
                          <div className={`text-sm font-medium mb-2 ${isOverCapacity ? 'text-red-400' : 'text-slate-400'}`}>
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
                          className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm ml-4"
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
                        onDragOver={(e) => handleDragOver(e, `load-${load.id}`)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'load', load.id)}
                        className={`space-y-2 min-h-[200px] rounded-lg p-3 transition-colors ${
                          isDropTarget ? 'bg-green-500/20 border-2 border-green-500' : 'bg-black/20'
                        }`}
                      >
                        {assignments.length === 0 ? (
                          <div className="text-center text-slate-400 py-12">
                            <div className="text-4xl mb-2">👇</div>
                            <div>Drag or assign students here</div>
                          </div>
                        ) : (
                          assignments.map(assignment => (
                            <div
                              key={assignment.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, 'assignment', assignment.id, load.id)}
                              onDragEnd={handleDragEnd}
                              className={`bg-white/5 rounded-lg p-3 border transition-all cursor-move ${
                                assignment.instructorId ? 'border-green-500/50' : 'border-yellow-500/50'
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
                                    ✓ {assignment.instructorName}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAssignInstructor(load.id, assignment.id)}
                                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded px-3 py-2 text-xs font-semibold transition-colors border border-blue-500/30"
                                >
                                  🎯 Auto-Assign
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
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeOptimization}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  ✓ Optimize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}