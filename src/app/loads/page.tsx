// src/app/loads/page.tsx - COMPLETE FIXED VERSION
// ✅ Fixed syntax errors
// ✅ Uses studentAccountIds for groups
// ✅ Prevents duplicate drops

'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useLoads, useQueue, useActiveInstructors, useAssignments, useCreateLoad, useUpdateLoad, useDeleteLoad, useGroups } from '@/hooks/useDatabase'
import { LoadBuilderCard } from '@/components/LoadBuilderCard'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import { isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import type { QueueStudent, Instructor, Load, LoadAssignment, Assignment, LoadSchedulingSettings, CreateQueueStudent, Group } from '@/types'
import { OptimizeLoadModal } from '@/components/OptimizeLoadModal'

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'building' | 'ready' | 'departed' | 'completed'>('all')
  const [optimizeLoadId, setOptimizeLoadId] = useState<string | null>(null)
  const [loadSettings, setLoadSettings] = useState<LoadSchedulingSettings>({
    minutesBetweenLoads: 20,
    instructorCycleTime: 40,
    defaultPlaneCapacity: 18
  })
  
  // ============================================
  // EFFECTS - ALWAYS IN SAME ORDER
  // ============================================
  
  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('loadSchedulingSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setLoadSettings(parsed)
      } catch (e) {
        console.error('Failed to parse load settings')
      }
    }
  }, [])
  
  // 🔍 DEBUG: Log when loads change
  useEffect(() => {
    console.log('🔄 Loads updated:', loads.length, 'loads')
    loads.forEach(load => {
      console.log(`  Load ${load.name}: ${load.assignments?.length || 0} assignments`)
    })
  }, [loads])
  
  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const period = getCurrentPeriod()
  
  // Calculate instructor balances
  const instructorBalances = useMemo(() => {
    const balances = new Map<string, number>()
    
    instructors.forEach(instructor => {
      let balance = 0
      
      for (const assignment of assignments) {
        const assignmentDate = new Date(assignment.timestamp)
        if (assignmentDate < period.start || assignmentDate > period.end) continue
        if (assignment.isRequest) continue
        
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
      }
      
      balances.set(instructor.id, balance)
    })
    
    return balances
  }, [instructors, assignments, period])
  
  // Filter queue
  const filteredQueue = useMemo(() => {
    return queue
      .filter(s => {
        if (searchTerm) {
          const search = searchTerm.toLowerCase()
          if (!s.name.toLowerCase().includes(search)) return false
        }
        if (selectedJumpType !== 'all' && s.jumpType !== selectedJumpType) {
          return false
        }
        return true
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [queue, searchTerm, selectedJumpType])
  
  // Get queue groups - ✅ FIXED: Use studentAccountIds
  const queueGroups = useMemo(() => {
    return groups.map(groupDoc => {
      const groupId = groupDoc.id
      
      // ✅ FIX: Match by studentAccountId (permanent) instead of QueueStudent.id
      const students = filteredQueue.filter(s => 
        groupDoc.studentAccountIds.includes(s.studentAccountId)
      )
      
      // Only return groups that have students in the current filtered queue
      if (students.length > 0) {
        return {
          ...groupDoc,
          students,
          groupId
        }
      }
      return null
    }).filter((g): g is (Group & { students: QueueStudent[], groupId: string }) => g !== null)
  }, [filteredQueue, groups])
  
  // Separate individual students
  const individualStudents = useMemo(() => {
    const groupedIds = new Set(queueGroups.flatMap(g => g.students.map(s => s.id)))
    return filteredQueue.filter(s => !groupedIds.has(s.id))
  }, [filteredQueue, queueGroups])
  
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
  // Group weight validation function
  // ============================================
  
  const validateGroupAssignments = (
    students: QueueStudent[],
    targetLoad: Load
  ): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    // Get available instructors for this load
    const availableInstructors = instructors.filter(i => {
      if (!i.clockedIn) return false
      
      // Check if available for this load timing
      return isInstructorAvailableForLoad(
        i.id,
        targetLoad.position || 0,
        loads,
        loadSettings.instructorCycleTime,
        loadSettings.minutesBetweenLoads
      )
    })
    
    // Check each student
    for (const student of students) {
      const totalWeight = student.weight + (student.tandemWeightTax || 0)
      
      const qualified = availableInstructors.filter(i => {
        if (student.jumpType === 'tandem') {
          if (!i.canTandem) return false
          if (i.tandemWeightLimit && totalWeight > i.tandemWeightLimit) return false
        } else if (student.jumpType === 'aff') {
          if (!i.canAFF) return false
          if (i.affWeightLimit && student.weight > i.affWeightLimit) return false
        }
        return true
      })
      
      if (qualified.length === 0) {
        errors.push(`${student.name} (${totalWeight}lbs) - No qualified instructor available`)
      }
    }
    
    return { valid: errors.length === 0, errors }
  }
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleCreateLoad = async () => {
    try {
      const savedSettings = localStorage.getItem('loadSchedulingSettings')
      let defaultCapacity = 18
      
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings)
          defaultCapacity = settings.defaultPlaneCapacity || 18
        } catch (e) {
          console.error('Failed to parse load settings, using default capacity')
        }
      }
      
      const nextPosition = Math.max(0, ...loads.map(l => l.position || 0)) + 1
      const loadNumber = loads.length + 1
      
      await createLoad({
        name: `Load ${loadNumber}`,
        status: 'building',
        capacity: defaultCapacity,
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
      const newDelay = currentDelay + minutes
      
      await updateLoad(loadId, {
        delayMinutes: newDelay
      })
      
      console.log(`⏰ Delayed ${load.name} by ${minutes} minutes. Total delay: ${newDelay} minutes`)
    } catch (error) {
      console.error('Failed to delay load:', error)
      alert('Failed to delay load')
    }
  }
  
  const handleDragStart = (type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string) => {
    console.log('🎯 DRAG START:', { type, id, sourceLoadId })
    setDraggedItem({ type, id, sourceLoadId })
  }
  
  const handleDragEnd = () => {
    console.log('🏁 DRAG END')
    setDraggedItem(null)
    setDropTarget(null)
  }
  

    const handleDropToQueue = async () => {
      if (!draggedItem || !draggedItem.sourceLoadId) return
      
      try {
        const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
        if (!sourceLoad) return
        
        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) return
        
        const updatedAssignments = sourceLoad.assignments?.filter(a => a.id !== draggedItem.id) || []
        await updateLoad(sourceLoad.id, { assignments: updatedAssignments })
        
        // Preserve original timestamp
        const timestamp = assignment.originalQueueTimestamp || 
          new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await db.addToQueue({
        studentAccountId: assignment.studentId,
        name: assignment.studentName,
        weight: assignment.studentWeight,
        jumpType: assignment.jumpType,
        isRequest: assignment.isRequest,
        tandemWeightTax: assignment.tandemWeightTax,
        tandemHandcam: assignment.tandemHandcam,
        outsideVideo: assignment.hasOutsideVideo,
        affLevel: assignment.affLevel,
        groupId: assignment.groupId
      }, timestamp instanceof Date ? timestamp.toISOString() : timestamp)

      
      setDraggedItem(null)
    } catch (error) {
      console.error('Failed to move student to queue:', error)
      alert('Failed to move student to queue')
    }
  }

  const handleDrop = async (loadId: string) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎯 HANDLE DROP CALLED')
    console.log('  LoadId:', loadId)
    console.log('  DraggedItem:', draggedItem)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    if (!draggedItem) {
      console.log('❌ No dragged item - aborting')
      return
    }
    
    // 🔥 FIX: Prevent dropping assignment back onto same load (creates duplicates)
    if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId === loadId) {
      console.log('⚠️ Cannot drop assignment back onto same load - aborting')
      setDraggedItem(null)
      return
    }
    
    const load = loads.find(l => l.id === loadId)
    if (!load) {
      console.log('❌ Load not found - aborting')
      return
    }
    
    console.log('📦 Target Load:', {
      id: load.id,
      name: load.name,
      currentAssignments: load.assignments?.length || 0
    })
    
    try {
      if (draggedItem.type === 'student') {
        console.log('👤 Processing INDIVIDUAL STUDENT drop')
        const student = queue.find(s => s.id === draggedItem.id)
        if (!student) {
          console.log('❌ Student not found in queue')
          return
        }
        
        console.log('  Student:', student.name, student.weight, 'lbs')
        
        // Check capacity
        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)
        const newPeople = 2 + (student.outsideVideo ? 1 : 0)
        
        console.log('  Capacity check:', { currentPeople, newPeople, capacity: load.capacity || 18 })
        
        if (currentPeople + newPeople > (load.capacity || 18)) {
          alert(`❌ Not enough capacity. Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available.`)
          return
        }
        
        const newAssignment: LoadAssignment = {
          id: `single-${load.id}-${student.id}`,
          studentId: student.studentAccountId,
          instructorId: null,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          isRequest: student.isRequest,
          originalQueueTimestamp: student.timestamp,
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          hasOutsideVideo: student.outsideVideo,
          affLevel: student.affLevel
        }
        
        console.log('  New assignment created:', newAssignment)
        
        const updatedAssignments = [...(load.assignments || []), newAssignment]
        console.log('  Updating load with', updatedAssignments.length, 'assignments')
        
        await updateLoad(loadId, {
          assignments: updatedAssignments
        })
        
        console.log('✅ Load updated, removing from queue')
        await db.removeFromQueue(student.id)
        console.log('✅ Student removed from queue')
        
      } else if (draggedItem.type === 'group') {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('👥 Processing GROUP drop')
        console.log('  Group ID:', draggedItem.id)
        
        const group = groups.find(g => g.id === draggedItem.id)
        console.log('  Group found:', group ? `YES - ${group.name}` : 'NO')
        
        if (!group) {
          console.log('❌ Group not found - aborting')
          alert('Group not found')
          return
        }
        
        console.log('  Group details:', {
          name: group.name,
          studentAccountIds: group.studentAccountIds,
          studentCount: group.studentAccountIds.length
        })
        
        // ✅ FIX: Match by studentAccountId (permanent)
        const groupStudents = queue.filter(s => 
          group.studentAccountIds.includes(s.studentAccountId)
        )
        
        console.log('  Students in queue:', groupStudents.length)
        groupStudents.forEach(s => {
          console.log(`    - ${s.name} (${s.weight}lbs) - Account ID: ${s.studentAccountId}`)
        })
        
        if (groupStudents.length === 0) {
          console.log('❌ No students in group found in queue')
          alert('⚠️ No students found in this group. They may have already been assigned.')
          return
        }
        
        // VALIDATE WEIGHT LIMITS
        console.log('  Validating weight limits...')
        const validation = validateGroupAssignments(groupStudents, load)
        if (!validation.valid) {
          console.log('❌ Validation failed:', validation.errors)
          alert(`❌ Cannot assign group to ${load.name}:\n\n${validation.errors.join('\n')}`)
          return
        }
        console.log('✅ Weight validation passed')
        
        // Check capacity
        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)
        
        const newPeople = groupStudents.reduce((sum, s) => {
          return sum + 2 + (s.outsideVideo ? 1 : 0)
        }, 0)
        
        console.log('  Capacity check:', { 
          currentPeople, 
          newPeople, 
          total: currentPeople + newPeople,
          capacity: load.capacity || 18 
        })
        
        if (currentPeople + newPeople > (load.capacity || 18)) {
          console.log('❌ Not enough capacity')
          alert(`❌ Not enough capacity. Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available.`)
          return
        }
        console.log('✅ Capacity check passed')
        
        // Create assignments
        console.log('  Creating assignments...')
        const newAssignments: LoadAssignment[] = groupStudents.map((student, index) => {
          const assignment = {
            id: `grp-${group.id}-${index}-${student.id}`,
            studentId: student.studentAccountId,
            instructorId: null,
            studentName: student.name,
            studentWeight: student.weight,
            jumpType: student.jumpType,
            isRequest: student.isRequest,
            groupId: group.id,
            originalQueueTimestamp: student.timestamp,
            tandemWeightTax: student.tandemWeightTax,
            tandemHandcam: student.tandemHandcam,
            hasOutsideVideo: student.outsideVideo,
            affLevel: student.affLevel
          }
          console.log(`    Assignment ${index + 1}:`, assignment)
          return assignment
        })
        
        const currentAssignments = load.assignments || []
        const allAssignments = [...currentAssignments, ...newAssignments]
        
        console.log('  Current load assignments:', currentAssignments.length)
        console.log('  New group assignments:', newAssignments.length)
        console.log('  Total assignments after merge:', allAssignments.length)
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('🔥 CALLING updateLoad')
        console.log('  Load ID:', loadId)
        console.log('  Assignments to save:', allAssignments.length)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        try {
          await updateLoad(loadId, {
            assignments: allAssignments
          })
          console.log('✅ updateLoad completed successfully')
          
          console.log('🗑️ Removing students from queue...')
          const studentIdsToRemove = groupStudents.map(s => s.id)
          console.log('  IDs to remove:', studentIdsToRemove)
          
          await db.removeMultipleFromQueue(studentIdsToRemove)
          console.log('✅ Students removed from queue')
          
        } catch (error) {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.error('❌ ERROR in updateLoad or removeMultipleFromQueue')
          console.error('Error:', error)
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          alert('Failed to add group to load: ' + error)
          return
        }
        
      } else if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId) {
        console.log('📋 Processing ASSIGNMENT move')
        const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
        if (!sourceLoad) {
          console.log('❌ Source load not found')
          return
        }
        
        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) {
          console.log('❌ Assignment not found in source load')
          return
        }
        
        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)
        const newPeople = 2 + (assignment.hasOutsideVideo ? 1 : 0)
        
        if (currentPeople + newPeople > (load.capacity || 18)) {
          alert(`❌ Not enough capacity. Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available.`)
          return
        }
        
        const updatedSourceAssignments = sourceLoad.assignments?.filter(a => a.id !== draggedItem.id) || []
        await updateLoad(sourceLoad.id, { assignments: updatedSourceAssignments })
        
        await updateLoad(loadId, {
          assignments: [...(load.assignments || []), assignment]
        })
        
        console.log('✅ Assignment moved successfully')
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('✅ handleDrop completed successfully')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      setDraggedItem(null)
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌ CRITICAL ERROR in handleDrop')
      console.error('Error:', error)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      alert('Failed to assign to load: ' + error)
    }
  }
  
  if (loadsLoading || queueLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 mb-8 border border-white/20">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">🛫 Load Builder</h1>
              <p className="text-slate-300">Drag students from queue to loads</p>
            </div>
            <button
              onClick={handleCreateLoad}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
            >
              ➕ New Load
            </button>
          </div>
          
          {/* Status Filter Tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {(['all', 'building', 'ready', 'departed', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  statusFilter === status
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-2 text-xs">({loadCounts[status]})</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Loads Grid */}
          <div className="xl:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
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
              <div className="text-sm text-slate-300 mb-4">
                {filteredQueue.length} student{filteredQueue.length !== 1 ? 's' : ''} waiting
              </div>
              
              {/* Search and Filter */}
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400"
                />
                
                <div className="flex gap-2">
                  {(['all', 'tandem', 'aff'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedJumpType(type)}
                      className={`flex-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        selectedJumpType === type
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Queue List */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {/* Groups */}
                {queueGroups.map((group) => (
                  <div
                    key={group.groupId}
                    draggable
                    onDragStart={() => handleDragStart('group', group.groupId)}
                    onDragEnd={handleDragEnd}
                    className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500/40 rounded-lg p-3 cursor-move hover:bg-purple-500/30"
                  >
                    <div className="font-bold text-purple-300 mb-2">👥 {group.name}</div>
                    <div className="space-y-1">
                      {group.students.map(student => (
                        <div key={student.id} className="text-sm text-white bg-black/20 rounded px-2 py-1">
                          {student.name} ({student.weight} lbs)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Individual Students */}
                {individualStudents.map((student) => (
                  <div
                    key={student.id}
                    draggable
                    onDragStart={() => handleDragStart('student', student.id)}
                    onDragEnd={handleDragEnd}
                    className="bg-white/5 rounded-lg p-3 border border-white/10 cursor-move hover:bg-white/10"
                  >
                    <div className="font-semibold text-white">{student.name}</div>
                    <div className="text-sm text-slate-400">
                      {student.jumpType.toUpperCase()} • {student.weight} lbs
                      {student.tandemWeightTax && ` • Tax: ${student.tandemWeightTax}`}
                      {student.isRequest && ' • ⭐ Request'}
                    </div>
                  </div>
                ))}
                
                {filteredQueue.length === 0 && (
                  <div className="text-center text-slate-400 py-8">
                    No students in queue
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Optimize Modal */}
      {optimizeLoadId && (
        <OptimizeLoadModal
          load={loads.find(l => l.id === optimizeLoadId)!}
          onClose={() => setOptimizeLoadId(null)}
        />
      )}
    </div>
  )
}