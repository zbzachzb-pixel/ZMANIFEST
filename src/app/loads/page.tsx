'use client'

import React, { useState, useMemo } from 'react'
import { useLoads, useQueue, useActiveInstructors, useAssignments, useCreateLoad, useUpdateLoad } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type { QueueStudent, Instructor, Load, LoadAssignment, Assignment } from '@/types'

interface ConflictWarning {
  type: 'instructor_conflict' | 'capacity_exceeded' | 'no_qualified' | 'weight_violation'
  message: string
  severity: 'error' | 'warning'
  loadId?: string
}

interface SmartSuggestion {
  student: QueueStudent
  instructor: Instructor
  score: number
  reason: string
}

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
  const [optimizing, setOptimizing] = useState(false)
  const [showOptimizeConfirm, setShowOptimizeConfirm] = useState(false)

  const period = getCurrentPeriod()
  const buildingLoads = loads.filter(l => l.status === 'building')
  
  // Debug logging
  console.log('🔍 Load Builder Debug:', {
    totalLoads: loads.length,
    buildingLoads: buildingLoads.length,
    queueLength: queue.length,
    instructorsCount: instructors.length,
    clockedInCount: instructors.filter(i => i.clockedIn).length
  })

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

  // Detect conflicts across all loads
  const conflicts = useMemo((): ConflictWarning[] => {
    const warnings: ConflictWarning[] = []
    const instructorLoadMap = new Map<string, Set<string>>()
    
    buildingLoads.forEach(load => {
      const assignments = load.assignments || []
      
      // Check capacity
      const totalPeople = assignments.reduce((sum, a) => {
        let count = 2
        if (a.hasOutsideVideo || a.videoInstructorId) count += 1
        return sum + count
      }, 0)
      
      if (totalPeople > load.capacity) {
        warnings.push({
          type: 'capacity_exceeded',
          message: `${load.name} is over capacity: ${totalPeople}/${load.capacity}`,
          severity: 'error',
          loadId: load.id
        })
      }
      
      // Track instructors per load
      assignments.forEach(a => {
        if (a.instructorId) {
          if (!instructorLoadMap.has(a.instructorId)) {
            instructorLoadMap.set(a.instructorId, new Set())
          }
          instructorLoadMap.get(a.instructorId)!.add(load.id)
        }
        if (a.videoInstructorId) {
          if (!instructorLoadMap.has(a.videoInstructorId)) {
            instructorLoadMap.set(a.videoInstructorId, new Set())
          }
          instructorLoadMap.get(a.videoInstructorId)!.add(load.id)
        }
      })
    })
    
    // Check for instructor conflicts
    instructorLoadMap.forEach((loadIds, instructorId) => {
      if (loadIds.size > 1) {
        const instructor = instructors.find(i => i.id === instructorId)
        const loadNames = Array.from(loadIds).map(id => 
          buildingLoads.find(l => l.id === id)?.name || 'Unknown'
        ).join(', ')
        
        warnings.push({
          type: 'instructor_conflict',
          message: `${instructor?.name || 'Instructor'} is on multiple loads: ${loadNames}`,
          severity: 'error'
        })
      }
    })
    
    return warnings
  }, [buildingLoads, instructors])

  // Smart suggestions for next student
  const smartSuggestions = useMemo((): SmartSuggestion[] => {
    if (buildingLoads.length === 0 || queue.length === 0) return []
    
    const suggestions: SmartSuggestion[] = []
    
    // Get all instructors already assigned
    const assignedInstructors = new Set<string>()
    buildingLoads.forEach(load => {
      (load.assignments || []).forEach(a => {
        if (a.instructorId) assignedInstructors.add(a.instructorId)
        if (a.videoInstructorId) assignedInstructors.add(a.videoInstructorId)
      })
    })
    
    // Find available instructors
    const availableInstructors = instructors.filter(i => 
      i.clockedIn && !assignedInstructors.has(i.id)
    )
    
    // Score each queue student
    queue.slice(0, 5).forEach(student => {
      const qualifiedInstructors = availableInstructors.filter(instructor => {
        if (student.jumpType === 'tandem' && !instructor.tandem) return false
        if (student.jumpType === 'aff' && !instructor.aff) return false
        if (student.jumpType === 'tandem' && instructor.tandemWeightLimit && student.weight > instructor.tandemWeightLimit) return false
        if (student.jumpType === 'aff' && instructor.affWeightLimit && student.weight > instructor.affWeightLimit) return false
        if (student.jumpType === 'aff' && instructor.affLocked) return false
        return true
      })
      
      if (qualifiedInstructors.length > 0) {
        // Sort by balance
        qualifiedInstructors.sort((a, b) => {
          const balanceA = instructorBalances.get(a.id) || 0
          const balanceB = instructorBalances.get(b.id) || 0
          return balanceA - balanceB
        })
        
        const bestInstructor = qualifiedInstructors[0]
        const balance = instructorBalances.get(bestInstructor.id) || 0
        
        suggestions.push({
          student,
          instructor: bestInstructor,
          score: 100 - balance,
          reason: `Perfect match with ${bestInstructor.name} (Balance: $${balance})`
        })
      }
    })
    
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 3)
  }, [buildingLoads, queue, instructors, instructorBalances])

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
    
    console.log('🔍 Finding best instructor:', {
      student: student.name,
      studentWeight: student.weight,
      jumpType: student.jumpType,
      clockedInCount: clockedIn.length,
      excludedCount: excludeIds.size,
      alreadyAssigned: alreadyAssignedIds.size
    })
    
    const qualified = clockedIn.filter(instructor => {
      if (alreadyAssignedIds.has(instructor.id)) {
        console.log(`  ❌ ${instructor.name} already assigned`)
        return false
      }
      if (student.jumpType === 'tandem' && !instructor.tandem) {
        console.log(`  ❌ ${instructor.name} not tandem certified`)
        return false
      }
      if (student.jumpType === 'aff' && !instructor.aff) {
        console.log(`  ❌ ${instructor.name} not AFF certified`)
        return false
      }
      
      // FIXED: Tandem weight limit is STUDENT weight only (not combined)
      if (student.jumpType === 'tandem' && instructor.tandemWeightLimit && student.weight > instructor.tandemWeightLimit) {
        console.log(`  ❌ ${instructor.name} tandem weight limit exceeded (Student: ${student.weight} > Limit: ${instructor.tandemWeightLimit})`)
        return false
      }
      
      // FIXED: AFF weight limit is STUDENT weight only (not combined)
      if (student.jumpType === 'aff' && instructor.affWeightLimit && student.weight > instructor.affWeightLimit) {
        console.log(`  ❌ ${instructor.name} AFF weight limit exceeded (Student: ${student.weight} > Limit: ${instructor.affWeightLimit})`)
        return false
      }
      
      if (student.jumpType === 'aff' && instructor.affLocked) {
        console.log(`  ❌ ${instructor.name} AFF locked`)
        return false
      }
      console.log(`  ✅ ${instructor.name} qualified (Weight: ${student.weight} ≤ ${instructor.tandemWeightLimit || instructor.affWeightLimit || 'no limit'})`)
      return true
    })

    if (qualified.length === 0) {
      console.log('  ⚠️ No qualified instructors found')
      return null
    }
    
    qualified.sort((a, b) => {
      const balanceA = instructorBalances.get(a.id) || 0
      const balanceB = instructorBalances.get(b.id) || 0
      return balanceA - balanceB
    })
    
    console.log(`  ✅ Best: ${qualified[0].name} (Balance: $${instructorBalances.get(qualified[0].id) || 0})`)
    return qualified[0]
  }

  // FIXED: handleAssignInstructor with better error handling
  const handleAssignInstructor = async (loadId: string, assignmentId: string) => {
    console.log('🎯 Auto-assign clicked:', { loadId, assignmentId })
    
    const load = loads.find(l => l.id === loadId)
    if (!load) {
      console.error('Load not found:', loadId)
      alert('❌ Load not found')
      return
    }
    
    const assignments = load.assignments || []
    const assignment = assignments.find(a => a.id === assignmentId)
    
    if (!assignment) {
      console.error('Assignment not found:', assignmentId)
      alert('❌ Assignment not found')
      return
    }
    
    if (assignment.instructorId) {
      console.log('Already has instructor:', assignment.instructorName)
      return
    }
    
    // Build student object from assignment
    const student: QueueStudent = {
      id: assignment.studentId || assignmentId, // Fallback to assignmentId
      name: assignment.studentName,
      weight: assignment.studentWeight,
      jumpType: assignment.jumpType,
      timestamp: new Date().toISOString(),
      tandemWeightTax: assignment.tandemWeightTax,
      tandemHandcam: assignment.tandemHandcam,
      affLevel: assignment.affLevel,
      isRequest: assignment.isRequest
    }
    
    console.log('Student data:', student)
    
    // Get all instructors already used across ALL loads
    const usedInstructors = new Set<string>()
    buildingLoads.forEach(l => {
      (l.assignments || []).forEach(a => {
        if (a.instructorId) usedInstructors.add(a.instructorId)
        if (a.videoInstructorId) usedInstructors.add(a.videoInstructorId)
      })
    })
    
    console.log('Used instructors across all loads:', usedInstructors.size)
    
    const instructor = findBestInstructor(student, assignments, usedInstructors)
    if (!instructor) {
      alert('❌ No qualified instructor available (considering all loads)')
      return
    }
    
    console.log('✅ Assigning:', instructor.name)
    
    const updatedAssignments = assignments.map(a => 
      a.id === assignmentId 
        ? { ...a, instructorId: instructor.id, instructorName: instructor.name }
        : a
    )
    
    try {
      await updateLoad(loadId, { assignments: updatedAssignments })
      console.log('✅ Assignment complete')
    } catch (error) {
      console.error('Failed to assign instructor:', error)
      alert('Failed to assign instructor')
    }
  }

  // FIXED: handleOptimizeAll with React modal instead of browser confirm
  const handleOptimizeAll = async () => {
    console.log('🎯 Optimize All clicked')
    
    if (buildingLoads.length === 0) {
      console.log('❌ Stopping: No loads')
      alert('❌ No loads to optimize. Create a load first.')
      return
    }
    
    if (queue.length === 0) {
      console.log('❌ Stopping: Empty queue')
      alert('❌ Queue is empty. Add students to the queue first.')
      return
    }
    
    const clockedInInstructors = instructors.filter(i => i.clockedIn)
    if (clockedInInstructors.length === 0) {
      console.log('❌ Stopping: No clocked in instructors')
      alert('❌ No instructors are clocked in.')
      return
    }
    
    console.log('✅ Pre-checks passed')
    console.log('Starting optimization:', {
      loads: buildingLoads.length,
      students: queue.length,
      instructors: clockedInInstructors.length
    })
    
    console.log('🔔 Showing confirmation modal...')
    setShowOptimizeConfirm(true)
  }
  
  const executeOptimization = async () => {
    console.log('✅ User confirmed, starting optimization...')
    setShowOptimizeConfirm(false)
    setOptimizing(true)
    
    try {
      console.log('📋 Step 1: Initialize variables')
      const usedInstructors = new Set<string>()
      const eligibleStudents = [...queue] // Copy array
      const updates: { loadId: string, assignments: LoadAssignment[] }[] = []
      
      console.log('📋 Step 2: Prepare loads')
      buildingLoads.forEach(load => {
        console.log(`  Preparing load: ${load.name}`)
        updates.push({
          loadId: load.id,
          assignments: [...(load.assignments || [])]
        })
      })
      console.log(`✅ Prepared ${updates.length} loads`)
      
      let assignedCount = 0
      const studentsToRemove: string[] = []
      
      console.log('📋 Step 3: Assign students globally')
      console.log(`Processing ${eligibleStudents.length} students...`)
      
      // Assign students globally
      for (let i = 0; i < eligibleStudents.length; i++) {
        const student = eligibleStudents[i]
        console.log(`\n--- Processing student ${i + 1}/${eligibleStudents.length}: ${student.name} ---`)
        
        // Skip requests if needed
        if (student.isRequest) {
          console.log('  ⏭️ Skipping request jump')
          continue
        }
        
        // Find a load with space
        console.log('  🔍 Looking for load with space...')
        const loadWithSpace = updates.find(u => {
          const load = buildingLoads.find(l => l.id === u.loadId)
          if (!load) return false
          const totalPeople = u.assignments.reduce((sum, a) => {
            let count = 2
            if (a.hasOutsideVideo || a.videoInstructorId) count += 1
            return sum + count
          }, 0)
          const hasSpace = totalPeople + 2 <= load.capacity
          if (hasSpace) {
            console.log(`    ✅ Found space on ${load.name} (${totalPeople}/${load.capacity})`)
          }
          return hasSpace
        })
        
        if (!loadWithSpace) {
          console.log('  ⚠️ No loads have space, stopping')
          break
        }
        
        console.log('  🔍 Finding best instructor...')
        const instructor = findBestInstructor(student, loadWithSpace.assignments, usedInstructors)
        if (!instructor) {
          console.log('  ⚠️ No qualified instructor, skipping student')
          continue
        }
        
        console.log(`  ✅ Selected instructor: ${instructor.name}`)
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
        
        console.log(`  ✅ Successfully assigned ${student.name} to ${instructor.name}`)
      }
      
      console.log(`\n📋 Step 4: Apply updates (${assignedCount} assignments)`)
      
      if (assignedCount === 0) {
        console.log('⚠️ No students were assigned')
        alert('⚠️ No students could be assigned. Check console for details.')
        return
      }
      
      // Apply all updates
      console.log(`Updating ${updates.length} loads...`)
      for (const update of updates) {
        console.log(`  Updating load: ${update.loadId}`)
        await updateLoad(update.loadId, { assignments: update.assignments })
        console.log(`  ✅ Updated`)
      }
      
      console.log('📋 Step 5: Remove students from queue')
      console.log(`Removing ${studentsToRemove.length} students...`)
      for (const studentId of studentsToRemove) {
        console.log(`  Removing: ${studentId}`)
        await db.removeFromQueue(studentId)
        console.log(`  ✅ Removed`)
      }
      
      console.log('✅✅✅ OPTIMIZATION COMPLETE ✅✅✅')
      alert(`✅ Optimization complete! Assigned ${assignedCount} student(s) across ${buildingLoads.length} load(s).`)
    } catch (error) {
      console.error('❌❌❌ Global optimization failed:', error)
      alert('❌ Optimization failed. Check console for details.')
    } finally {
      console.log('🏁 Cleaning up, setting optimizing = false')
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
        const movedAssignment = { 
          ...assignment, 
          instructorId: '',
          instructorName: '' 
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

  // Show helpful message if conditions aren't met
  const canOptimize = buildingLoads.length > 0 && queue.length > 0 && instructors.filter(i => i.clockedIn).length > 0
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-[1920px] mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">✈️ Smart Load Builder</h1>
            <p className="text-slate-300">AI-powered load optimization with conflict detection</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleOptimizeAll}
              disabled={optimizing || !canOptimize}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!canOptimize ? 'Need: loads, students in queue, and clocked-in instructors' : ''}
            >
              {optimizing ? '⏳ Optimizing...' : '🎯 Optimize All Loads'}
            </button>
            <button
              onClick={handleCreateLoad}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <span className="text-xl">+</span> New Load
            </button>
          </div>
        </div>
        
        {/* Debug info when optimization is disabled */}
        {!canOptimize && !optimizing && (
          <div className="mb-6 bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <div className="font-bold text-blue-300 mb-2">Optimize All is disabled because:</div>
                <ul className="text-sm text-slate-300 space-y-1">
                  {buildingLoads.length === 0 && <li>• No loads created (click "+ New Load")</li>}
                  {queue.length === 0 && <li>• Queue is empty (add students to queue)</li>}
                  {instructors.filter(i => i.clockedIn).length === 0 && <li>• No instructors clocked in</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Conflict Warnings */}
        {conflicts.length > 0 && (
          <div className="mb-6 space-y-2">
            {conflicts.map((conflict, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border-2 ${
                  conflict.severity === 'error' 
                    ? 'bg-red-500/20 border-red-500' 
                    : 'bg-yellow-500/20 border-yellow-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {conflict.severity === 'error' ? '🚨' : '⚠️'}
                  </span>
                  <div>
                    <div className={`font-bold ${
                      conflict.severity === 'error' ? 'text-red-300' : 'text-yellow-300'
                    }`}>
                      {conflict.type === 'instructor_conflict' ? 'Instructor Conflict' :
                       conflict.type === 'capacity_exceeded' ? 'Capacity Exceeded' :
                       conflict.type === 'no_qualified' ? 'No Qualified Instructors' :
                       'Weight Violation'}
                    </div>
                    <div className="text-sm text-slate-300">{conflict.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Smart Suggestions */}
        {smartSuggestions.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-purple-500/30">
            <h3 className="text-xl font-bold text-white mb-4">💡 Smart Suggestions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {smartSuggestions.map((suggestion, index) => (
                <div key={index} className="bg-white/10 rounded-lg p-4 border border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">⭐</span>
                    <span className="font-bold text-white">{suggestion.student.name}</span>
                  </div>
                  <div className="text-sm text-slate-300 mb-2">
                    {suggestion.student.weight} lbs • {suggestion.student.jumpType.toUpperCase()}
                  </div>
                  <div className="text-xs text-green-400 font-semibold">
                    {suggestion.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                            {totalPeople}/{load.capacity} people ({percentFull}%) {isOverCapacity && '⚠️ OVER'}
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
                            ⚠️ {unassignedCount} student{unassignedCount !== 1 ? 's' : ''} need instructor
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
                                    ✓ {assignment.instructorName}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    console.log('Button clicked!', { loadId: load.id, assignmentId: assignment.id })
                                    handleAssignInstructor(load.id, assignment.id)
                                  }}
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
      
      {/* Optimization Confirmation Modal */}
      {showOptimizeConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => console.log('🔍 Backdrop clicked')}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-purple-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">🎯 Optimize All Loads?</h2>
              <p className="text-slate-300 mb-6">
                This will automatically assign <strong className="text-white">{queue.length} student(s)</strong> across{' '}
                <strong className="text-white">{buildingLoads.length} load(s)</strong> using the fairest rotation algorithm.
              </p>
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-300">
                  ✓ Students will be assigned to the best available instructors<br/>
                  ✓ Instructors with lowest balance will be prioritized<br/>
                  ✓ No instructor conflicts across loads<br/>
                  ✓ Capacity limits will be respected
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    console.log('❌ User canceled optimization')
                    setShowOptimizeConfirm(false)
                  }}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeOptimization}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  ✓ Optimize Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}