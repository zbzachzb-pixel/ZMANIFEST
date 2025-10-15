// src/app/loads/page.tsx - COMPLETE FIXED FILE
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
  const [isDragging, setIsDragging] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'building' | 'ready' | 'departed' | 'completed'>('all')
  const [optimizeLoadId, setOptimizeLoadId] = useState<string | null>(null)

  // Load scheduling settings
  // Load scheduling settings - Load from Firebase on mount
const [loadSettings, setLoadSettings] = useState<LoadSchedulingSettings>({
  minutesBetweenLoads: 20,
  instructorCycleTime: 40,
  defaultPlaneCapacity: 18
})

useEffect(() => {
    db.getLoadSchedulingSettings().then(settings => {
      if (settings) {
        setLoadSettings(settings)
      } else {
        // Fallback to localStorage
        const saved = localStorage.getItem('loadSchedulingSettings')
        if (saved) {
          try {
            setLoadSettings(JSON.parse(saved))
          } catch (e) {
            console.error('Failed to load settings')
          }
        }
      }
    }).catch(error => {
      console.error('Failed to load settings from Firebase:', error)
    })
  }, [])

  // Subscribe to real-time settings updates
  useEffect(() => {
    const unsubscribe = db.subscribeToLoadSchedulingSettings((settings) => {
      if (settings) {
        setLoadSettings(settings)
        localStorage.setItem('loadSchedulingSettings', JSON.stringify(settings))
      }
    })
    
    return () => unsubscribe()
  }, [])

  
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
  
  // Filter queue
  const filteredQueue = useMemo(() => {
    return queue.filter(student => {
      const matchesSearch = searchTerm === '' || 
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = selectedJumpType === 'all' || student.jumpType === selectedJumpType
      return matchesSearch && matchesType
    })
  }, [queue, searchTerm, selectedJumpType])
  
  // Group queue students
  const queueGroups = useMemo(() => {
    return groups.map(groupDoc => {
      const groupId = groupDoc.id
      const students = filteredQueue.filter(s => s.groupId === groupId)
      return students.length > 0 ? { ...groupDoc, students, groupId } : null
    }).filter((g): g is (Group & { students: QueueStudent[], groupId: string }) => g !== null)
  }, [filteredQueue, groups])
  
  // Separate individual students (those without a groupId)
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
  // HANDLERS
  // ============================================
  
  const handleCreateLoad = async () => {
    try {
      // Get current load scheduling settings
      const savedSettings = localStorage.getItem('loadSchedulingSettings')
      let defaultCapacity = 18 // fallback default
      
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
      
      // Update the delay
      await updateLoad(loadId, {
        delayMinutes: newDelay
      })
      
      // 🔥 NEW: Auto re-optimize affected loads
      console.log(`⏰ Delayed ${load.name} by ${minutes} minutes. Checking for re-optimization...`)
      
      // Find all building loads that could be affected
      const buildingLoadsToOptimize = loads.filter(l => 
        l.status === 'building' && 
        l.id !== loadId &&
        (l.assignments || []).some(a => !a.instructorId)
      )
      
      if (buildingLoadsToOptimize.length > 0) {
        console.log(`🔄 Re-optimizing ${buildingLoadsToOptimize.length} building loads...`)
        
        for (const buildingLoad of buildingLoadsToOptimize) {
          const unassignedAssignments = (buildingLoad.assignments || []).filter(a => !a.instructorId)
          
          if (unassignedAssignments.length === 0) continue
          
          const updatedAssignments = [...(buildingLoad.assignments || [])]
          let madeChanges = false
          
          for (const assignment of unassignedAssignments) {
            const availableInstructors = instructors
              .filter(i => {
                if (!i.clockedIn) return false
                
                const isAvailable = isInstructorAvailableForLoad(
                  i.id,
                  buildingLoad.position || 0,
                  loads,
                  loadSettings.instructorCycleTime,
                  loadSettings.minutesBetweenLoads
                )
                
                if (!isAvailable) return false
                
                const canTandem = (i as any).canTandem ?? (i as any).tandem
                const canAFF = (i as any).canAFF ?? (i as any).aff
                
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
    setIsDragging(true)
  }
  
  const handleDragEnd = () => {
    setDraggedItem(null)
    setDropTarget(null)
    setIsDragging(false)
  }
  
  // Handle dropping groups/students back to queue
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
        
        // Update the Group document to include the student IDs
        const group = groups.find(g => g.id === groupId)
        if (!group) return  // ✅ Early return if no group
        
        const studentIdsToAdd = groupAssignments.map(a => a.studentId)
        const updatedStudentIds = [...new Set([...group.studentIds, ...studentIdsToAdd])]
        await db.updateGroup(groupId, { studentIds: updatedStudentIds })
        
        // Remove group assignments from load
        await updateLoad(sourceLoad.id, {
          assignments: sourceLoad.assignments?.filter(a => a.groupId !== groupId) || []
        })
        
        // Add all students back to queue with PRIORITY
        const priorityTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        
        // ✅ Add the for loop here
        for (const assignment of groupAssignments) {
          // Try to find existing student account by name
          const existingAccounts = await db.searchStudentAccounts(assignment.studentName)
          let studentAccountId: string

          if (existingAccounts.length > 0) {
            // Use existing student account
            studentAccountId = existingAccounts[0].id  // ✅ Use .id
          } else {
            // Create new student account
            const newAccount = await db.createStudentAccount({
              studentId: `STUDENT-${Date.now()}`,
              name: assignment.studentName,
              weight: assignment.studentWeight,
              preferredJumpType: assignment.jumpType,
              affLevel: assignment.jumpType === 'aff' ? assignment.affLevel : undefined
            })
            studentAccountId = newAccount.id  // ✅ Use .id
          }

          const queueStudent: CreateQueueStudent = {
            studentAccountId: studentAccountId,
            name: assignment.studentName,
            weight: assignment.studentWeight,
            jumpType: assignment.jumpType,
            isRequest: false,
            tandemWeightTax: assignment.tandemWeightTax || 0,
            tandemHandcam: assignment.tandemHandcam || false,
            outsideVideo: assignment.hasOutsideVideo,
            affLevel: assignment.affLevel,
            groupId: group.id  // ✅ Safe because we returned early if !group
          }
          
          await db.addToQueue(queueStudent, priorityTimestamp)
        }
        
      } else if (draggedItem.type === 'assignment') {
        // Dropping single assignment back to queue
        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) return
        
        // If student has groupId, update the Group document
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
          studentAccountId: assignment.studentId,
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
      
      // Check if we're dropping a GROUP from another LOAD
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
        // Dropping a GROUP from QUEUE
        const groupId = draggedItem.id
        const group = groups.find(g => g.id === groupId)
        if (!group) return
        
        // Find all students in this group by their groupId property
        const groupStudents = queue.filter(s => s.groupId === groupId)
        if (groupStudents.length === 0) return
        
        // Create assignments for all students in the group
        const newAssignments: LoadAssignment[] = []
        
        for (const student of groupStudents) {
          const newAssignment: LoadAssignment = {
            id: `${Date.now()}-${Math.random()}`,
            studentId: student.id,
            studentName: student.name,
            studentWeight: student.weight,
            jumpType: student.jumpType,
            hasOutsideVideo: student.outsideVideo || false,
            affLevel: student.affLevel,
            tandemWeightTax: student.tandemWeightTax,
            tandemHandcam: student.tandemHandcam,
            instructorId: '',
            videoInstructorId: student.outsideVideo ? '' : undefined,
            groupId: groupId,
            isRequest: student.isRequest
          }
          newAssignments.push(newAssignment)
        }
        
        await updateLoad(load.id, {
          assignments: [...(load.assignments || []), ...newAssignments]
        })
        
        // Remove all students in the group from queue
        for (const student of groupStudents) {
          await db.removeFromQueue(student.id)
        }
        
      } else if (draggedItem.type === 'student' && !draggedItem.sourceLoadId) {
        // Dropping a SINGLE STUDENT from QUEUE
        const student = queue.find(s => s.id === draggedItem.id)
        if (!student) return
        
        const newAssignment: LoadAssignment = {
          id: `${Date.now()}-${Math.random()}`,
          studentId: student.id,
          studentName: student.name,
          studentWeight: student.weight,
          jumpType: student.jumpType,
          hasOutsideVideo: student.outsideVideo || false,
          affLevel: student.affLevel,
          tandemWeightTax: student.tandemWeightTax,
          tandemHandcam: student.tandemHandcam,
          instructorId: '',
          videoInstructorId: student.outsideVideo ? '' : undefined,
          groupId: student.groupId,
          isRequest: student.isRequest
        }
        
        await updateLoad(load.id, {
          assignments: [...(load.assignments || []), newAssignment]
        })
        
        await db.removeFromQueue(draggedItem.id)
        
      } else if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId) {
        // Moving assignment between loads
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
              onClick={() => {
                const buildingLoad = loads.find(l => 
                  l.status === 'building' && 
                  (l.assignments || []).some(a => !a.instructorId)
                )
                if (buildingLoad) {
                  setOptimizeLoadId(buildingLoad.id)
                } else {
                  alert('No loads with unassigned students found. Add students to a load first!')
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              ⚡ Optimize Loads
            </button>
            <button
              onClick={handleCreateLoad}
              disabled={loadsLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              + New Load
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Content - Loads */}
          <div className="xl:col-span-3">
            {/* Status Filter Tabs */}
            <div className="mb-6">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {(['all', 'building', 'ready', 'departed', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                      statusFilter === status
                        ? 'bg-blue-500/30 text-white shadow-lg scale-105 border-2 border-blue-400'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {status === 'all' && '📋 All Loads'}
                      {status === 'building' && '🔨 Building'}
                      {status === 'ready' && '✅ Ready'}
                      {status === 'departed' && '✈️ Departed'}
                      {status === 'completed' && '🎉 Completed'}
                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                        {loadCounts[status]}
                      </span>
                    </span>
                  </button>
                ))}
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
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                
                <div className="flex gap-2">
                  {(['all', 'tandem', 'aff'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedJumpType(type)}
                      className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-colors ${
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