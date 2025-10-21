// src/app/loads/page.tsx - COMPLETE FIXED VERSION
// ✅ Fixed syntax errors
// ✅ Uses studentAccountIds for groups
// ✅ Prevents duplicate drops
// ✅ OPTIMIZED: Uses useActiveLoads() to fetch only recent loads (excludes old completed loads)
// ✅ KEYBOARD SHORTCUTS: N=New, R=Ready, D=Departed, C=Completed, Delete=Remove, O/A=Optimize, Arrows=Navigate

'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useActiveLoads, useQueue, useActiveInstructors, useAssignments, useUpdateLoad, useDeleteLoad, useGroups, useAircraft } from '@/hooks/useDatabase'
import { LoadBuilderCard } from '@/components/LoadBuilderCard'
import { useToast } from '@/contexts/ToastContext'
import { useActionHistory } from '@/contexts/ActionHistoryContext'
import { db } from '@/services'
import { createLoadUndoable, deleteLoadUndoable, updateLoadStatusUndoable, delayLoadUndoable } from '@/services/undoableActions'
import { getCurrentPeriod, calculateInstructorBalance } from '@/lib/utils'
import { isInstructorAvailableForLoad } from '@/hooks/useLoadCountdown'
import type { QueueStudent, Load, LoadAssignment, LoadSchedulingSettings, Group } from '@/types'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { getLoadSettings } from '@/lib/settingsStorage'
import { useLoadsPageShortcuts } from '@/hooks/useKeyboardShortcuts'
import { RequireRole } from '@/components/auth'
import { LoadBuilderProvider } from '@/contexts/LoadBuilderContext'

// ✅ PERFORMANCE: Dynamic import for OptimizeLoadModal - only loaded when needed
const OptimizeLoadModal = dynamic(() => import('@/components/OptimizeLoadModal').then(mod => ({ default: mod.OptimizeLoadModal })), {
  ssr: false,
  loading: () => <div className="text-white">Loading...</div>
})

function LoadBuilderPageContent() {
  // ============================================
  // HOOKS - ALL CALLED AT TOP LEVEL IN SAME ORDER ALWAYS
  // ============================================
  
  // Database hooks - using optimized subscriptions
  const { data: loads, loading: loadsLoading } = useActiveLoads(7) // Only fetch loads from last 7 days
  const { data: queue, loading: queueLoading } = useQueue()
  const { data: instructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { update: updateLoad } = useUpdateLoad()
  useDeleteLoad()
  const { data: groups } = useGroups()
  const { data: aircraft } = useAircraft()

  // Toast notifications and action history
  const toast = useToast()
  const { addAction } = useActionHistory()

  // State hooks - ALL called unconditionally
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedJumpType, setSelectedJumpType] = useState<'all' | 'tandem' | 'aff'>('all')
  const [draggedItem, setDraggedItem] = useState<{ type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'building' | 'ready' | 'departed' | 'completed'>('all')
  const [optimizeLoadId, setOptimizeLoadId] = useState<string | null>(null)
  const [loadSettings, setLoadSettings] = useState<LoadSchedulingSettings>(getLoadSettings())
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null)
  const [showAircraftSelector, setShowAircraftSelector] = useState(false)

  // ============================================
  // EFFECTS - ALWAYS IN SAME ORDER
  // ============================================

  // Load settings from storage on mount
  useEffect(() => {
    try {
      setLoadSettings(getLoadSettings())
    } catch (e) {
      console.error('Failed to load settings:', e)
      toast.warning('Failed to load settings', 'Using default values.')
    }
  }, [])

  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const period = getCurrentPeriod()
  
  // Calculate instructor balances (includes both completed and pending assignments)
  const instructorBalances = useMemo(() => {
    const balances = new Map<string, number>()

    instructors.forEach(instructor => {
      // ✅ Use centralized function that includes pending LoadAssignments
      const balance = calculateInstructorBalance(
        instructor.id,
        assignments,
        instructors,
        period,
        loads  // ✅ Includes pending assignments from non-completed loads
      )
      balances.set(instructor.id, balance)
    })

    return balances
  }, [instructors, assignments, period, loads])
  
  // ✅ OPTIMIZED: Single-pass filtering and grouping to reduce O(3n) to O(n)
  const { filteredQueue, queueGroups, individualStudents } = useMemo(() => {
    // Step 1: Filter and sort queue in single pass
    const filtered = queue
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

    // Step 2: Build student lookup map for O(1) group matching
    const studentMap = new Map(filtered.map(s => [s.studentAccountId, s]))
    const groupedStudentIds = new Set<string>()

    // Step 3: Build groups and track grouped students simultaneously
    const groups_result = groups
      .map(groupDoc => {
        const students = groupDoc.studentAccountIds
          .map(accountId => studentMap.get(accountId))
          .filter((s): s is QueueStudent => s !== undefined)

        if (students.length > 0) {
          // Mark these students as grouped
          students.forEach(s => groupedStudentIds.add(s.id))

          return {
            ...groupDoc,
            students,
            groupId: groupDoc.id
          }
        }
        return null
      })
      .filter((g): g is (Group & { students: QueueStudent[], groupId: string }) => g !== null)

    // Step 4: Get individual students (not in any group)
    const individuals = filtered.filter(s => !groupedStudentIds.has(s.id))

    return {
      filteredQueue: filtered,
      queueGroups: groups_result,
      individualStudents: individuals
    }
  }, [queue, searchTerm, selectedJumpType, groups])
  
  // Get active aircraft from settings
  const activeAircraft = useMemo(() => {
    const activeIds = loadSettings.activeAircraftIds || []
    if (activeIds.length === 0) {
      // No active aircraft configured - use all active aircraft
      return aircraft.filter(a => a.isActive)
    }
    return aircraft.filter(a => activeIds.includes(a.id) && a.isActive)
  }, [aircraft, loadSettings.activeAircraftIds])

  // ✅ OPTIMIZED: Single-pass load filtering and counting, grouped by aircraft
  const { filteredLoads, loadCounts, loadsByAircraft } = useMemo(() => {
    const counts = {
      all: loads.length,
      building: 0,
      ready: 0,
      departed: 0,
      completed: 0
    }

    // Count all statuses in single pass
    loads.forEach(load => {
      counts[load.status]++
    })

    // Filter if needed
    const filtered = statusFilter === 'all'
      ? loads
      : loads.filter(load => load.status === statusFilter)

    // Group by aircraft
    const byAircraft = new Map<string, Load[]>()

    // Initialize with active aircraft
    activeAircraft.forEach(ac => {
      byAircraft.set(ac.id, [])
    })

    // Add loads to their aircraft groups
    filtered.forEach(load => {
      if (load.aircraftId && byAircraft.has(load.aircraftId)) {
        byAircraft.get(load.aircraftId)!.push(load)
      } else if (load.aircraftId) {
        // Load has aircraft but it's not in active list
        if (!byAircraft.has(load.aircraftId)) {
          byAircraft.set(load.aircraftId, [])
        }
        byAircraft.get(load.aircraftId)!.push(load)
      } else {
        // Load has no aircraft - put in "unassigned" group
        if (!byAircraft.has('unassigned')) {
          byAircraft.set('unassigned', [])
        }
        byAircraft.get('unassigned')!.push(load)
      }
    })

    // Sort loads within each aircraft group by position
    byAircraft.forEach((loads) => {
      loads.sort((a, b) => (a.position || 0) - (b.position || 0))
    })

    return { filteredLoads: filtered, loadCounts: counts, loadsByAircraft: byAircraft }
  }, [loads, statusFilter, activeAircraft])

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
  
  const handleCreateLoad = async (aircraftId?: string) => {
    try {
      // If multiple active aircraft and no aircraft selected, show selector
      if (!aircraftId && activeAircraft.length > 1) {
        setShowAircraftSelector(true)
        return
      }

      // Determine aircraft ID
      let targetAircraftId = aircraftId
      if (!targetAircraftId) {
        if (activeAircraft.length === 1 && activeAircraft[0]) {
          targetAircraftId = activeAircraft[0].id
        } else if (activeAircraft.length === 0) {
          toast.error('No Active Aircraft', 'Please configure aircraft in Settings first.')
          return
        }
      }

      // Get aircraft to use its capacity
      const targetAircraft = aircraft.find(a => a.id === targetAircraftId)
      const defaultCapacity = targetAircraft?.capacity || loadSettings.defaultPlaneCapacity || 18

      // Calculate load number per aircraft (each aircraft has independent load numbering)
      const aircraftLoads = loads.filter(l => l.aircraftId === targetAircraftId)
      const loadNumber = aircraftLoads.length + 1

      const nextPosition = Math.max(0, ...loads.map(l => l.position || 0)) + 1

      // ✅ Use undoable action
      await createLoadUndoable({
        name: `Load ${loadNumber}`,
        status: 'building',
        capacity: defaultCapacity,
        aircraftId: targetAircraftId,
        assignments: [],
        position: nextPosition
      }, addAction)

      toast.success('Load created')
      setShowAircraftSelector(false)
    } catch (error) {
      console.error('Failed to create load:', error)
      toast.error('Failed to create load')
    }
  }
  
  // ✅ OPTIMIZED: Memoized with useCallback to prevent child re-renders
  const handleDelayLoad = useCallback(async (loadId: string, minutes: number) => {
    try {
      const load = loads.find(l => l.id === loadId)
      if (!load) return

      // ✅ Use undoable action
      await delayLoadUndoable(loadId, minutes, load, addAction)
    } catch (error) {
      console.error('Failed to delay load:', error)
      toast.error('Failed to delay load')
    }
  }, [loads, addAction, toast])

  // ✅ OPTIMIZED: Memoized with useCallback
  const handleDragStart = useCallback((type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string) => {
    setDraggedItem({ type, id, sourceLoadId })
  }, [])

  // ✅ OPTIMIZED: Memoized with useCallback
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null)
    setDropTarget(null)
  }, [])
  

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
      toast.error('Failed to move student to queue')
    }
  }

  // ✅ OPTIMIZED: Memoized handleDrop to prevent LoadBuilderCard re-renders
  const handleDrop = useCallback(async (loadId: string) => {
    if (!draggedItem) {
      return
    }

    // Prevent dropping back onto same load (creates duplicates)
    if ((draggedItem.type === 'assignment' || draggedItem.type === 'group') && draggedItem.sourceLoadId === loadId) {
      setDraggedItem(null)
      return
    }

    const load = loads.find(l => l.id === loadId)
    if (!load) {
      return
    }

    try {
      if (draggedItem.type === 'student') {
        const student = queue.find(s => s.id === draggedItem.id)
        if (!student) {
          return
        }

        // Check capacity
        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)
        const newPeople = 2 + (student.outsideVideo ? 1 : 0)

        if (currentPeople + newPeople > (load.capacity || 18)) {
          toast.warning('Not enough capacity', `Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available`)
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

        const updatedAssignments = [...(load.assignments || []), newAssignment]

        await updateLoad(loadId, {
          assignments: updatedAssignments
        })

        await db.removeFromQueue(student.id)

      } else if (draggedItem.type === 'group' && !draggedItem.sourceLoadId) {
        // Handle adding a group from the queue to a load
        const group = groups.find(g => g.id === draggedItem.id)

        if (!group) {
          toast.error('Group not found')
          return
        }

        // Match by studentAccountId (permanent)
        const groupStudents = queue.filter(s =>
          group.studentAccountIds.includes(s.studentAccountId)
        )

        if (groupStudents.length === 0) {
          toast.warning('No students found in this group', 'They may have already been assigned')
          return
        }

        // Validate weight limits
        const validation = validateGroupAssignments(groupStudents, load)
        if (!validation.valid) {
          toast.error(`Cannot assign group to ${load.name}`, validation.errors.join(', '))
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
          toast.warning('Not enough capacity', `Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available`)
          return
        }

        // Create assignments
        const newAssignments: LoadAssignment[] = groupStudents.map((student, index) => {
          return {
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
        })

        const currentAssignments = load.assignments || []
        const allAssignments = [...currentAssignments, ...newAssignments]

        try {
          await updateLoad(loadId, {
            assignments: allAssignments
          })

          const studentIdsToRemove = groupStudents.map(s => s.id)

          await db.removeMultipleFromQueue(studentIdsToRemove)

        } catch (error) {
          console.error('Error in updateLoad or removeMultipleFromQueue:', error)
          toast.error('Failed to add group to load', String(error))
          return
        }

      } else if (draggedItem.type === 'assignment' && draggedItem.sourceLoadId) {
        const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
        if (!sourceLoad) {
          return
        }

        const assignment = sourceLoad.assignments?.find(a => a.id === draggedItem.id)
        if (!assignment) {
          return
        }

        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)
        const newPeople = 2 + (assignment.hasOutsideVideo ? 1 : 0)

        if (currentPeople + newPeople > (load.capacity || 18)) {
          toast.warning('Not enough capacity', `Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available`)
          return
        }

        const updatedSourceAssignments = sourceLoad.assignments?.filter(a => a.id !== draggedItem.id) || []
        await updateLoad(sourceLoad.id, { assignments: updatedSourceAssignments })

        await updateLoad(loadId, {
          assignments: [...(load.assignments || []), assignment]
        })

      } else if (draggedItem.type === 'group' && draggedItem.sourceLoadId) {
        // Handle moving a group from one load to another
        const sourceLoad = loads.find(l => l.id === draggedItem.sourceLoadId)
        if (!sourceLoad) {
          return
        }

        // Find all assignments in the group - try groupId first
        let groupAssignments = sourceLoad.assignments?.filter(a => a.groupId === draggedItem.id) || []

        // ✅ FIXED: Fallback to matching by studentAccountId if groupId doesn't match
        if (groupAssignments.length === 0) {
          console.log('⚠️ No assignments found with groupId, trying fallback matching...')
          console.log('  Dragged group ID:', draggedItem.id)
          console.log('  Source load assignments:', sourceLoad.assignments)

          const group = groups.find(g => g.id === draggedItem.id)
          if (group) {
            console.log('  Group studentAccountIds:', group.studentAccountIds)
            groupAssignments = sourceLoad.assignments?.filter(a =>
              group.studentAccountIds.includes(a.studentId)
            ) || []
            console.log('  Found assignments via fallback:', groupAssignments.length)
          }
        }

        if (groupAssignments.length === 0) {
          console.error('❌ Failed to find group assignments even with fallback')
          toast.warning('No students found in this group', 'They may have already been assigned')
          return
        }

        // Check capacity for all group members
        const currentPeople = (load.assignments || []).reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)

        const newPeople = groupAssignments.reduce((sum, a) => {
          return sum + 2 + (a.hasOutsideVideo ? 1 : 0)
        }, 0)

        if (currentPeople + newPeople > (load.capacity || 18)) {
          toast.warning('Not enough capacity', `Need ${newPeople} seats, only ${(load.capacity || 18) - currentPeople} available`)
          return
        }

        // Remove group from source load
        const updatedSourceAssignments = sourceLoad.assignments?.filter(a => a.groupId !== draggedItem.id) || []
        await updateLoad(sourceLoad.id, { assignments: updatedSourceAssignments })

        // Add group to destination load
        await updateLoad(loadId, {
          assignments: [...(load.assignments || []), ...groupAssignments]
        })
      }

      setDraggedItem(null)
    } catch (error) {
      console.error('Critical error in handleDrop:', error)
      toast.error('Failed to assign to load', String(error))
    }
  }, [draggedItem, loads, queue, groups, updateLoad, toast, instructors, loadSettings])

  // ============================================
  // KEYBOARD SHORTCUT HANDLERS
  // ============================================

  const handleMarkReady = async () => {
    if (!selectedLoadId) {
      toast.info('No load selected', 'Click on a load or use arrow keys to select one.')
      return
    }
    const load = loads.find(l => l.id === selectedLoadId)
    if (!load) return

    if (load.status !== 'building') {
      toast.warning('Cannot mark as ready', 'Load must be in "building" status.')
      return
    }

    try {
      // ✅ Use undoable action
      await updateLoadStatusUndoable(
        load.id,
        'ready',
        load,
        { countdownStartTime: new Date().toISOString() },
        addAction
      )
    } catch (error) {
      console.error('Failed to update load status:', error)
      toast.error('Failed to update load status')
    }
  }

  const handleMarkDeparted = async () => {
    if (!selectedLoadId) {
      toast.info('No load selected', 'Click on a load or use arrow keys to select one.')
      return
    }
    const load = loads.find(l => l.id === selectedLoadId)
    if (!load) return

    if (load.status !== 'ready') {
      toast.warning('Cannot mark as departed', 'Load must be in "ready" status.')
      return
    }

    try {
      // ✅ Use undoable action
      await updateLoadStatusUndoable(load.id, 'departed', load, {}, addAction)
    } catch (error) {
      console.error('Failed to update load status:', error)
      toast.error('Failed to update load status')
    }
  }

  const handleMarkCompleted = async () => {
    if (!selectedLoadId) {
      toast.info('No load selected', 'Click on a load or use arrow keys to select one.')
      return
    }
    const load = loads.find(l => l.id === selectedLoadId)
    if (!load) return

    if (load.status !== 'departed') {
      toast.warning('Cannot mark as completed', 'Load must be in "departed" status.')
      return
    }

    try {
      // ✅ Use undoable action
      await updateLoadStatusUndoable(
        load.id,
        'completed',
        load,
        { completedAt: new Date().toISOString() },
        addAction
      )
    } catch (error) {
      console.error('Failed to update load status:', error)
      toast.error('Failed to update load status')
    }
  }

  const handleDeleteLoad = async () => {
    if (!selectedLoadId) {
      toast.info('No load selected', 'Click on a load or use arrow keys to select one.')
      return
    }
    const load = loads.find(l => l.id === selectedLoadId)
    if (!load) return

    if (load.status === 'completed') {
      toast.warning('Cannot delete completed load', 'Completed loads should not be deleted.')
      return
    }

    if (!confirm(`Delete "${load.name}"? This can be undone with Ctrl+Z.`)) {
      return
    }

    try {
      // ✅ Use undoable action
      await deleteLoadUndoable(load, addAction)
      setSelectedLoadId(null)
    } catch (error) {
      console.error('Failed to delete load:', error)
      toast.error('Failed to delete load')
    }
  }

  const handleNavigateUp = () => {
    const sortedLoads = filteredLoads.sort((a, b) => (a.position || 0) - (b.position || 0))
    if (sortedLoads.length === 0) return

    if (!selectedLoadId) {
      const firstLoad = sortedLoads[0]
      if (firstLoad) setSelectedLoadId(firstLoad.id)
      return
    }

    const currentIndex = sortedLoads.findIndex(l => l.id === selectedLoadId)
    if (currentIndex > 0) {
      const prevLoad = sortedLoads[currentIndex - 1]
      if (prevLoad) setSelectedLoadId(prevLoad.id)
    }
  }

  const handleNavigateDown = () => {
    const sortedLoads = filteredLoads.sort((a, b) => (a.position || 0) - (b.position || 0))
    if (sortedLoads.length === 0) return

    if (!selectedLoadId) {
      const firstLoad = sortedLoads[0]
      if (firstLoad) setSelectedLoadId(firstLoad.id)
      return
    }

    const currentIndex = sortedLoads.findIndex(l => l.id === selectedLoadId)
    if (currentIndex < sortedLoads.length - 1) {
      const nextLoad = sortedLoads[currentIndex + 1]
      if (nextLoad) setSelectedLoadId(nextLoad.id)
    }
  }

  const handleToggleExpand = () => {
    if (!selectedLoadId) {
      const sortedLoads = filteredLoads.sort((a, b) => (a.position || 0) - (b.position || 0))
      const firstLoad = sortedLoads[0]
      if (firstLoad) {
        setSelectedLoadId(firstLoad.id)
      }
      return
    }
    // For now, just provide visual feedback - expand/collapse would need LoadBuilderCard changes
    toast.info('Load selected', 'Use R/D/C for status changes, Delete to remove.')
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  useLoadsPageShortcuts({
    onNewLoad: handleCreateLoad,
    onMarkReady: handleMarkReady,
    onMarkDeparted: handleMarkDeparted,
    onMarkCompleted: handleMarkCompleted,
    onDeleteLoad: handleDeleteLoad,
    onOptimizeLoad: () => {
      // Find first building or ready load with assignments
      const loadToOptimize = loads.find(l =>
        (l.status === 'building' || l.status === 'ready') &&
        l.assignments &&
        l.assignments.length > 0
      )
      if (loadToOptimize) {
        setOptimizeLoadId(loadToOptimize.id)
      } else {
        toast.info('No loads available to optimize', 'Create a load and assign students first.')
      }
    },
    onNavigateUp: handleNavigateUp,
    onNavigateDown: handleNavigateDown,
    onToggleExpand: handleToggleExpand
  })

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-3 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-4 mb-6 border border-white/20">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">🛫 Load Builder</h1>
              <p className="text-sm text-slate-300">Drag students from queue to loads</p>
            </div>
            <button
              onClick={() => handleCreateLoad()}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-lg text-sm"
            >
              ➕ New Load
            </button>
          </div>

          {/* Status Filter Tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(['all', 'building', 'ready', 'departed', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
                  statusFilter === status
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-1.5 text-xs">({loadCounts[status]})</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Loads Grid */}
          <div className="xl:col-span-3">
            {/* ✅ PERFORMANCE: LoadBuilderProvider reduces 11 props to 1 per card */}
            <LoadBuilderProvider
              value={{
                allLoads: loads,
                instructors,
                instructorBalances,
                loadSchedulingSettings: loadSettings,
                dropTarget,
                setDropTarget,
                onDrop: handleDrop,
                onDragStart: handleDragStart,
                onDragEnd: handleDragEnd,
                onDelay: handleDelayLoad
              }}
            >
              {filteredLoads.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
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
              ) : activeAircraft.length <= 1 ? (
                // Single aircraft mode - use original grid layout
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3">
                  {filteredLoads
                    .sort((a, b) => (a.position || 0) - (b.position || 0))
                    .map((load) => (
                      <div
                        key={load.id}
                        onClick={() => setSelectedLoadId(load.id)}
                        className={`rounded-xl transition-all ${
                          selectedLoadId === load.id
                            ? 'ring-4 ring-blue-400 ring-offset-2 ring-offset-slate-900'
                            : ''
                        }`}
                      >
                        <LoadBuilderCard load={load} />
                      </div>
                    ))
                  }
                </div>
              ) : (
                // Multi-aircraft mode - column per aircraft
                <div className={`grid gap-4 ${
                  activeAircraft.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
                  activeAircraft.length === 3 ? 'grid-cols-1 lg:grid-cols-3' :
                  'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                }`}>
                  {Array.from(loadsByAircraft.entries()).map(([aircraftId, aircraftLoads]) => {
                    const aircraftInfo = aircraft.find(a => a.id === aircraftId)
                    const isUnassigned = aircraftId === 'unassigned'

                    return (
                      <div key={aircraftId} className="space-y-3">
                        {/* Aircraft Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-3 shadow-lg sticky top-0 z-10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{isUnassigned ? '⚠️' : '✈️'}</span>
                              <div>
                                <h3 className="text-white font-bold text-lg">
                                  {isUnassigned ? 'Unassigned' : aircraftInfo?.tailNumber || 'Unknown'}
                                </h3>
                                {!isUnassigned && aircraftInfo && (
                                  <p className="text-blue-100 text-sm">
                                    {aircraftInfo.name} • {aircraftInfo.capacity} pax
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-white font-bold text-lg">{aircraftLoads.length}</div>
                              <div className="text-blue-100 text-xs">Loads</div>
                            </div>
                          </div>
                          {!isUnassigned && (
                            <button
                              onClick={() => handleCreateLoad(aircraftId)}
                              className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm"
                            >
                              + Create Load
                            </button>
                          )}
                        </div>

                        {/* Loads for this aircraft */}
                        <div className="space-y-3">
                          {aircraftLoads.length === 0 ? (
                            <div className="bg-white/5 border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                              <p className="text-slate-400 text-sm">
                                No loads for this aircraft
                              </p>
                            </div>
                          ) : (
                            aircraftLoads.map((load) => (
                              <div
                                key={load.id}
                                onClick={() => setSelectedLoadId(load.id)}
                                className={`rounded-xl transition-all ${
                                  selectedLoadId === load.id
                                    ? 'ring-4 ring-blue-400 ring-offset-2 ring-offset-slate-900'
                                    : ''
                                }`}
                              >
                                <LoadBuilderCard load={load} />
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </LoadBuilderProvider>
          </div>
          
          {/* Sidebar - Queue */}
          <div className="xl:col-span-1">
            <div
              className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-white/20 sticky top-20"
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
              <h2 className="text-lg font-bold text-white mb-2">📋 Student Queue</h2>
              <div className="text-xs text-slate-300 mb-3">
                {filteredQueue.length} student{filteredQueue.length !== 1 ? 's' : ''} waiting
              </div>

              {/* Search and Filter */}
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400"
                />

                <div className="flex gap-1.5">
                  {(['all', 'tandem', 'aff'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedJumpType(type)}
                      className={`flex-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
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
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {/* Groups */}
                {queueGroups.map((group) => (
                  <div
                    key={group.groupId}
                    draggable
                    onDragStart={() => handleDragStart('group', group.groupId)}
                    onDragEnd={handleDragEnd}
                    className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500/40 rounded-lg p-2.5 cursor-move hover:bg-purple-500/30"
                  >
                    <div className="font-semibold text-sm text-purple-300 mb-1.5">👥 {group.name}</div>
                    <div className="space-y-1">
                      {group.students.map(student => (
                        <div key={student.id} className="text-xs text-white bg-black/20 rounded px-2 py-0.5">
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
                    className="bg-white/5 rounded-lg p-2.5 border border-white/10 cursor-move hover:bg-white/10"
                  >
                    <div className="font-medium text-sm text-white">{student.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
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

      {/* Aircraft Selector Modal */}
      {showAircraftSelector && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl max-w-md w-full border border-white/20">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                ✈️ Select Aircraft for New Load
              </h2>

              <div className="space-y-3 mb-6">
                {activeAircraft.map((aircraftItem) => (
                  <button
                    key={aircraftItem.id}
                    onClick={() => {
                      handleCreateLoad(aircraftItem.id)
                      setShowAircraftSelector(false)
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg p-4 transition-all shadow-lg hover:shadow-xl text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg">{aircraftItem.tailNumber}</div>
                        <div className="text-sm text-blue-100">{aircraftItem.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{aircraftItem.capacity}</div>
                        <div className="text-xs text-blue-200">passengers</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAircraftSelector(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LoadBuilderPage() {
  return (
    <RequireRole roles={['admin', 'manifest', 'instructor']}>
      <PageErrorBoundary>
        <LoadBuilderPageContent />
      </PageErrorBoundary>
    </RequireRole>
  )
}