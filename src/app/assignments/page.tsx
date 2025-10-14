'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useAssignments, useActiveInstructors, useDeleteClockEvent } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import { EditAssignmentModal } from '@/components/EditAssignmentModal'
import type { Assignment, ClockEvent } from '@/types'

export default function AssignmentsPage() {
  const { data: assignments, loading } = useAssignments()
  const { data: instructors } = useActiveInstructors()
  const { deleteEvent, loading: deleteClockLoading } = useDeleteClockEvent()
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [deleteShiftConfirm, setDeleteShiftConfirm] = useState<{ inId: string, outId: string | null } | null>(null)
  const [clockEvents, setClockEvents] = useState<ClockEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  const period = getCurrentPeriod()
  
  // Check if selected date is today
  const isToday = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selected = new Date(selectedDate)
    selected.setHours(0, 0, 0, 0)
    return today.getTime() === selected.getTime()
  }, [selectedDate])
  
  // Calculate total shifts from clock events
  const totalShifts = useMemo(() => {
    const byInstructor = new Map<string, ClockEvent[]>()
    clockEvents.forEach(event => {
      if (!byInstructor.has(event.instructorId)) {
        byInstructor.set(event.instructorId, [])
      }
      byInstructor.get(event.instructorId)!.push(event)
    })
    
    let count = 0
    byInstructor.forEach(events => {
      for (let i = 0; i < events.length; i++) {
        if (events[i].type === 'in') {
          count++
        }
      }
    })
    
    return count
  }, [clockEvents])
  
  // Subscribe to clock events
  useEffect(() => {
    const unsubscribe = db.subscribeToClockEvents((events) => {
      // Filter events for selected date
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      const filtered = events.filter(event => {
        const eventDate = new Date(event.timestamp)
        return eventDate >= startOfDay && eventDate <= endOfDay
      }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      
      setClockEvents(filtered)
    })
    
    return unsubscribe
  }, [selectedDate])
  
  const getInstructorName = (id: string) => {
    const instructor = instructors.find(i => i.id === id)
    return instructor ? instructor.name : 'Unknown'
  }
  
  const filteredAssignments = useMemo(() => {
    return assignments
      .filter(a => {
        const assignmentDate = new Date(a.timestamp)
        return assignmentDate >= period.start && assignmentDate <= period.end
      })
      .filter(a => {
        if (!searchTerm) return true
        const search = searchTerm.toLowerCase()
        return (
          a.name.toLowerCase().includes(search) ||
          getInstructorName(a.instructorId).toLowerCase().includes(search)
        )
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [assignments, searchTerm, period, instructors])
  
  const calculatePay = (assignment: Assignment) => {
    if (assignment.isMissedJump) return 0
    if (assignment.isRequest) return 0
    
    let pay = 0
    
    if (assignment.jumpType === 'tandem') {
      pay = 40
      if (assignment.tandemWeightTax) {
        pay += assignment.tandemWeightTax * 20
      }
      if (assignment.tandemHandcam) {
        pay += 30
      }
    } else if (assignment.jumpType === 'aff') {
      pay = assignment.affLevel === 'lower' ? 55 : 45
    } else if (assignment.jumpType === 'video') {
      pay = 45
    }
    
    if (assignment.hasOutsideVideo && !assignment.isMissedJump) {
      pay += 45
    }
    
    return pay
  }
  
  const handleDelete = async (id: string) => {
    try {
      await db.deleteAssignment(id)
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete assignment:', error)
      alert('Failed to delete assignment. Please try again.')
    }
  }
  
  const handleDeleteShift = async () => {
    if (!deleteShiftConfirm) return
    
    try {
      // Delete clock-in event
      await deleteEvent(deleteShiftConfirm.inId)
      
      // Delete clock-out event if it exists
      if (deleteShiftConfirm.outId) {
        await deleteEvent(deleteShiftConfirm.outId)
      }
      
      setDeleteShiftConfirm(null)
    } catch (error) {
      console.error('Failed to delete shift:', error)
      alert('Failed to delete shift. Please try again.')
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading assignments...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Assignment History</h1>
          <p className="text-slate-300">View and manage all assignments for {period.name}</p>
        </div>
        
        {/* Clock Tracking Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                🕐 Clock Activity
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {totalShifts} {totalShifts === 1 ? 'shift' : 'shifts'} • {new Set(clockEvents.map(e => e.instructorId)).size} instructors
                {!isToday && <span className="text-yellow-400 ml-2">• Historical (read-only)</span>}
              </p>
            </div>
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          
          {clockEvents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-slate-400">No clock activity for this date</p>
            </div>
          ) : (
            (() => {
              // Group clock events by instructor
              const byInstructor = new Map<string, ClockEvent[]>()
              clockEvents.forEach(event => {
                if (!byInstructor.has(event.instructorId)) {
                  byInstructor.set(event.instructorId, [])
                }
                byInstructor.get(event.instructorId)!.push(event)
              })

              return (
                <div className="space-y-4">
                  {Array.from(byInstructor.entries()).map(([instructorId, events]) => {
                    const instructorName = events[0].instructorName
                    
                    // Create shifts (pair clock-ins with clock-outs)
                    const shifts: Array<{
                      in: Date
                      out: Date | null
                      duration: string | null
                      inId: string
                      outId: string | null
                    }> = []
                    
                    for (let i = 0; i < events.length; i++) {
                      if (events[i].type === 'in') {
                        const clockIn = new Date(events[i].timestamp)
                        let clockOut: Date | null = null
                        let outId: string | null = null
                        
                        // Find matching clock-out
                        for (let j = i + 1; j < events.length; j++) {
                          if (events[j].type === 'out') {
                            clockOut = new Date(events[j].timestamp)
                            outId = events[j].id
                            break
                          }
                        }
                        
                        let duration: string | null = null
                        if (clockOut) {
                          const diffMs = clockOut.getTime() - clockIn.getTime()
                          const hours = Math.floor(diffMs / (1000 * 60 * 60))
                          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                          duration = `${hours}h ${minutes}m`
                        }
                        
                        shifts.push({
                          in: clockIn,
                          out: clockOut,
                          duration,
                          inId: events[i].id,
                          outId
                        })
                      }
                    }
                    
                    return (
                      <div key={instructorId} className="bg-slate-800/50 rounded-lg p-4">
                        <h3 className="text-white font-semibold mb-3">{instructorName}</h3>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {shifts.map((shift, idx) => (
                            <div 
                              key={idx}
                              className="relative bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 transition-colors group"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-400">●</span>
                                  <span className="text-slate-300">
                                    {shift.in.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {shift.out ? (
                                    <>
                                      <span className="text-slate-300">
                                        {shift.out.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className="text-red-400">■</span>
                                    </>
                                  ) : (
                                    <span className="text-green-400 font-semibold">Active</span>
                                  )}
                                </div>
                              </div>
                              {shift.duration && (
                                <div className="text-xs text-slate-400 text-center mt-1">
                                  {shift.duration}
                                </div>
                              )}
                              
                              {/* Delete button - only show for today's shifts */}
                              {isToday && (
                                <button
                                  onClick={() => setDeleteShiftConfirm({ inId: shift.inId, outId: shift.outId })}
                                  disabled={deleteClockLoading}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-2 py-1 rounded disabled:opacity-50"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          )}
              
          {/* Daily Summary */}
          <div className="mt-6 pt-6 border-t border-white/20 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Total Shifts</div>
              <div className="text-2xl font-bold text-white">
                {totalShifts}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Active Instructors</div>
              <div className="text-2xl font-bold text-white">
                {new Set(clockEvents.map(e => e.instructorId)).size}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">Clock Events</div>
              <div className="text-2xl font-bold text-white">
                {clockEvents.length}
              </div>
            </div>
          </div>
        </div>
        
        {/* Assignments Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">📋 Assignment History</h2>
            <input
              type="text"
              placeholder="Search by name or instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>
          
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-slate-400">
                {searchTerm ? 'No assignments match your search' : 'No assignments yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left px-6 py-3 text-slate-300 font-semibold">Date/Time</th>
                    <th className="text-left px-6 py-3 text-slate-300 font-semibold">Student</th>
                    <th className="text-left px-6 py-3 text-slate-300 font-semibold">Instructor</th>
                    <th className="text-left px-6 py-3 text-slate-300 font-semibold">Type</th>
                    <th className="text-left px-6 py-3 text-slate-300 font-semibold">Weight</th>
                    <th className="text-left px-6 py-3 text-slate-300 font-semibold">Pay</th>
                    <th className="text-left px-6 py-3 text-slate-300 font-semibold">Tags</th>
                    <th className="text-left px-6 py-3 text-slate-300 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map(assignment => {
                    const pay = calculatePay(assignment)
                    const coveredForName = assignment.coveringFor ? getInstructorName(assignment.coveringFor) : null
                    
                    return (
                      <tr key={assignment.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="px-6 py-4 text-slate-300 text-sm">
                          {new Date(assignment.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-white font-semibold">
                          {assignment.name}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          <div>
                            {coveredForName ? (
                              <div className="flex items-center gap-2">
                                <span>{getInstructorName(assignment.instructorId)}</span>
                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                                  covering {coveredForName}
                                </span>
                              </div>
                            ) : (
                              getInstructorName(assignment.instructorId)
                            )}
                          </div>
                          {assignment.videoInstructorId && (
                            <div className="text-xs text-slate-400 mt-1">
                              📹 {getInstructorName(assignment.videoInstructorId)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            assignment.jumpType === 'tandem' ? 'bg-green-500/20 text-green-300' :
                            assignment.jumpType === 'aff' ? 'bg-purple-500/20 text-purple-300' :
                            'bg-blue-500/20 text-blue-300'
                          }`}>
                            {assignment.jumpType.toUpperCase()}
                            {assignment.jumpType === 'aff' && ` ${assignment.affLevel?.toUpperCase()}`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {assignment.weight} lbs
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${pay === 0 ? 'text-red-400' : 'text-green-400'}`}>
                            ${pay}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {assignment.isRequest && (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-semibold">
                                Request
                              </span>
                            )}
                            {assignment.isMissedJump && (
                              <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-semibold">
                                Missed
                              </span>
                            )}
                            {coveredForName && (
                              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                                Cover
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingAssignment(assignment)}
                              className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-bold hover:bg-blue-500/30 transition-colors"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(assignment.id)}
                              className="px-3 py-1 bg-red-500/20 text-red-300 rounded text-xs font-bold hover:bg-red-500/30 transition-colors"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        
          <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="flex justify-between items-center text-slate-300">
              <span>Total Assignments: <strong className="text-white">{filteredAssignments.length}</strong></span>
              <span>
                Covers: <strong className="text-blue-400">
                  {filteredAssignments.filter(a => a.coveringFor).length}
                </strong>
              </span>
              <span>
                Total Pay: <strong className="text-green-400">
                  ${filteredAssignments.reduce((sum, a) => sum + calculatePay(a), 0)}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onSuccess={() => {
            setEditingAssignment(null)
          }}
        />
      )}
      
      {/* Delete Assignment Confirmation Modal */}
      {deleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-red-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">🗑️ Delete Assignment?</h2>
              <p className="text-slate-300 mb-6">
                This will permanently remove this assignment from the history. 
                <strong className="text-white block mt-2">This will affect earnings and jump counts.</strong>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  ✓ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Shift Confirmation Modal */}
      {deleteShiftConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div 
            className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-red-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">🗑️ Delete Clock Shift?</h2>
              <p className="text-slate-300 mb-6">
                This will permanently delete this clock-in/out shift.
                {deleteShiftConfirm.outId ? (
                  <strong className="text-white block mt-2">Both clock-in and clock-out events will be removed.</strong>
                ) : (
                  <strong className="text-yellow-300 block mt-2">⚠️ This is an active shift. The instructor will be automatically clocked out.</strong>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteShiftConfirm(null)}
                  disabled={deleteClockLoading}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteShift}
                  disabled={deleteClockLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleteClockLoading ? '⏳ Deleting...' : '✓ Delete Shift'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}