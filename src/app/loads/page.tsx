// src/app/loads/page.tsx - COMPLETE FIXED FILE
// ✅ FIXED: Group weight validation added
// ✅ FIXED: Original queue timestamp preservation added

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
  
  // Get queue groups
  const queueGroups = useMemo(() => {
  return groups.map(groupDoc => {
    const groupId = groupDoc.id
    const students = filteredQueue.filter(s => s.groupId === groupId)
    
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
  // ✅ BUG FIX #2: Group weight validation function
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
      
      // Auto re-optimize affected loads
      const buildingLoads = loads.filter(l => l.status === 'building')
      
      if (buildingLoads.length > 0) {
        console.log('🔄 Re-optimizing building loads after delay...')
        
        for (const buildingLoad of buildingLoads) {
          const updatedAssignments = [...(buildingLoad.assignments || [])]
          let madeChanges = false
          
          for (const assignment of updatedAssignments) {
            if (!assignment.instructorId) {
              const availableInstructors = instructors
                .filter(i => {
                  if (!i.clockedIn) return false
                  
                  const canTandem = i.canTandem
                  const canAFF = i.canAFF
                  
                  if (assignment.jumpType === 'tandem' && !canTandem) return false
                  if (assignment.jumpType === 'aff' && !canAFF) return false
                  
                  if (assignment.jumpType === 'tandem' && i.tandemWeightLimit) {
                    const totalWeight = assignment.studentWeight + (assignment.tandemWeightTax || 0)
                    if (totalWeight > i.tandemWeightLimit) return false
                  }
                  if (assignment.jumpType === 'aff' && i.affWeightLimit) {
                    if (assignment.studentWeight > i.affWeightLimit) return false
                  }
                  
                  return true
                })
                .sort((a, b) => {
                  const balanceA = instructorBalances.get(a.id) || 0
                  const balanceB = instructorBalances.get(b.id) || 0
                  return balanceA - balanceB
                })
              
              if (availableInstructors.length > 0) {
                const bestInstructor = availableInstructors[0]
                
                const assignmentIndex = updatedAssignments.findIndex(a => a.id === assignment.id)
                if (assignmentIndex >= 0) {
                  updatedAssignments[assignmentIndex] = {
                    ...updatedAssignments[assignmentIndex],
                    instructorId: bestInstructor.id,
                    instructorName: bestInstructor.name
                  }
                  madeChanges = true
                  console.log(`✅ Re-assigned ${assignment.studentName} to ${bestInstructor.name} on ${buildingLoad.name}`)
                }
              }
            }
          }
          
          if (madeChanges) {
            await updateLoad(buildingLoad.id, {
              assignments: updatedAssignments
            })
          }
        }
        
        console.log('✅ Re-optimization complete!')
      } else {
        console.log('ℹ️ No building loads need re-optimization')
      }
      
    } catch (error) {
      console.error('Failed to delay load:', error)
      alert('Failed to delay load')
    }
  }
  
  const handleDragStart = (type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string) => {
    setDraggedItem({ type, id, sourceLoadId })
  }
  
  const handleDragEnd = () => {
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
      
      // ✅ BUG FIX #3: Preserve original timestamp
      const timestamp = assignment.originalQueueTimestamp || 
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
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
      }, timestamp)
      
      setDraggedItem(null)
    } catch (error) {
      console.error('Failed to move student to queue:', error)
      alert('Failed to move student to queue')
    }
  }
  
  const handleDrop = async (loadId: string) => {
    if (!draggedItem) return
    
    const load = loads.find(l => l.id === loadId)
    if (!load) return
    
    try {
      if (draggedItem.type === 'student') {
        const student = queue.find(s => s.id === draggedItem.id)
        if (!student) return
        
        // Check capacity
        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)
        const newPeople = 2 + (student.outsideVideo ? 1 : 0)
        
        if (currentPeople + newPeople > (load.capacity || 18)) {
          alert(`❌ Not enough capacity. Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available.`)
          return
        }
        
        // ✅ BUG FIX #3: Create assignment with original timestamp preserved
        const newAssignment: LoadAssignment = {
          id: `${Date.now()}-${Math.random()}`,
          studentId: student.id,
          instructorId: null,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          isRequest: student.isRequest,
          originalQueueTimestamp: student.timestamp, // Preserve original timestamp
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          hasOutsideVideo: student.outsideVideo,
          affLevel: student.affLevel
        }
        
        await updateLoad(loadId, {
          assignments: [...(load.assignments || []), newAssignment]
        })
        
        await db.removeFromQueue(student.id)
        
      } else if (draggedItem.type === 'group') {
        // ✅ BUG FIX #2: Validate group weight limits
        const group = groups.find(g => g.id === draggedItem.id)
        if (!group) return
        
        const groupStudents = queue.filter(s => group.studentIds.includes(s.id))
        
        // VALIDATE WEIGHT LIMITS
        const validation = validateGroupAssignments(groupStudents, load)
        if (!validation.valid) {
          alert(`❌ Cannot assign group to ${load.name}:\n\n${validation.errors.join('\n')}`)
          return
        }
        
        // Check capacity
        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)
        
        const newPeople = groupStudents.reduce((sum, s) => {
          return sum + 2 + (s.outsideVideo ? 1 : 0)
        }, 0)
        
        if (currentPeople + newPeople > (load.capacity || 18)) {
          alert(`❌ Not enough capacity. Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available.`)
          return
        }
        
        // ✅ BUG FIX #3: Create assignments with original timestamps preserved
        const newAssignments: LoadAssignment[] = groupStudents.map(student => ({
          id: `${Date.now()}-${Math.random()}`,
          studentId: student.id,
          instructorId: null,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          isRequest: student.isRequest,
          groupId: group.id,
          originalQueueTimestamp: student.timestamp, // Preserve original timestamp
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          hasOutsideVideo: student.outsideVideo,
          affLevel: student.affLevel
        }))
        
        await updateLoad(loadId, {
          assignments: [...(load.assignments || []), ...newAssignments]
        })
        
        await db.removeMultipleFromQueue(groupStudents.map(s => s.id))
        
      } else if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId) {
        // Moving between loads
        const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
        if (!sourceLoad) return
        
        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) return
        
        // Check capacity in target load
        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)
        const newPeople = 2 + (assignment.hasOutsideVideo ? 1 : 0)
        
        if (currentPeople + newPeople > (load.capacity || 18)) {
          alert(`❌ Not enough capacity. Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available.`)
          return
        }
        
        // Remove from source
        const updatedSourceAssignments = sourceLoad.assignments?.filter(a => a.id !== draggedItem.id) || []
        await updateLoad(sourceLoad.id, { assignments: updatedSourceAssignments })
        
        // Add to target
        await updateLoad(loadId, {
          assignments: [...(load.assignments || []), assignment]
        })
      }
      
      setDraggedItem(null)
    } catch (error) {
      console.error('Failed to drop item:', error)
      alert('Failed to assign to load')
    }
  }
  
  // ============================================
  // RENDER
  // ============================================
  
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