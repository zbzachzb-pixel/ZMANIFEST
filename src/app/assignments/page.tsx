// src/app/assignments/page.tsx - COMPLETE REBUILT VERSION
'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useAssignments, useActiveInstructors, useDeleteClockEvent } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod, calculateAssignmentPay } from '@/lib/utils'
import { PAY_RATES } from '@/lib/constants'
import { useToast } from '@/contexts/ToastContext'
import { EditAssignmentModal } from '@/components/EditAssignmentModal'
import { EditClockEventModal } from '@/components/EditClockEventModal'
import type { Assignment, ClockEvent } from '@/types'

export default function AssignmentsPage() {
  const { data: assignments, loading } = useAssignments()
  const { data: instructors } = useActiveInstructors()
  const { deleteEvent, loading: deleteClockLoading } = useDeleteClockEvent()
  const toast = useToast()
  
  // State management
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [deleteShiftConfirm, setDeleteShiftConfirm] = useState<{ inId: string, outId: string | null } | null>(null)
  const [clockEvents, setClockEvents] = useState<ClockEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [editingClockEvent, setEditingClockEvent] = useState<ClockEvent | null>(null)
  
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
      events.forEach(event => {
        if (event.type === 'in') {
          count++
        }
      })
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
          a.studentName.toLowerCase().includes(search) ||
          getInstructorName(a.instructorId).toLowerCase().includes(search)
        )
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [assignments, searchTerm, period, instructors])
  
  const calculatePay = (assignment: Assignment) => {
    if (assignment.isMissedJump) return 0
    if (assignment.isRequest) return 0
    
    let pay = calculateAssignmentPay(assignment)
    
    // Add video instructor pay if applicable
    if (assignment.hasOutsideVideo) {
      pay += PAY_RATES.VIDEO_INSTRUCTOR
    }
    
    return pay
  }
  
  const handleDelete = async (id: string) => {
    try {
      await db.deleteAssignment(id)
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete assignment:', error)
      toast.error('Failed to delete assignment', 'Please try again.')
    }
  }
  
  const handleDeleteShift = async () => {
    if (!deleteShiftConfirm) return
    
    try {
      // Find the instructor from the clock event
      const clockEvent = clockEvents.find(e => e.id === deleteShiftConfirm.inId)
      if (!clockEvent) {
        throw new Error('Clock event not found')
      }
      
      // Delete clock-in event
      await deleteEvent(deleteShiftConfirm.inId)
      
      // Delete clock-out event if it exists
      if (deleteShiftConfirm.outId) {
        await deleteEvent(deleteShiftConfirm.outId)
      }
      
      // If the shift has no clock-out (still active), force clock out the instructor
      if (!deleteShiftConfirm.outId) {
        const instructor = instructors.find(i => i.id === clockEvent.instructorId)
        if (instructor && instructor.clockedIn) {
          await db.updateInstructor(instructor.id, {
            clockedIn: false
          })
        }
      }
      
      setDeleteShiftConfirm(null)
    } catch (error) {
      console.error('Failed to delete shift:', error)
      toast.error('Failed to delete shift', 'Please try again.')
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
                    const instructorName = events[0]?.instructorName || 'Unknown'
                    
                    // Create shifts (pair clock-ins with clock-outs)
                    const shifts: Array<{
                      in: Date
                      out: Date | null
                      duration: string | null
                      inId: string
                      outId: string | null
                      inEvent: ClockEvent
                      outEvent: ClockEvent | null
                    }> = []
                    
                    const sortedEvents = [...events].sort((a, b) => 
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    )
                    
                    for (let i = 0; i < sortedEvents.length; i++) {
                      const currentEvent = sortedEvents[i]
                      if (!currentEvent) continue

                      if (currentEvent.type === 'in') {
                        const inEvent = currentEvent
                        const inTime = new Date(inEvent.timestamp)

                        // Find matching out event
                        let outEvent: ClockEvent | null = null
                        let outTime: Date | null = null

                        for (let j = i + 1; j < sortedEvents.length; j++) {
                          const potentialOutEvent = sortedEvents[j]
                          if (!potentialOutEvent) continue

                          if (potentialOutEvent.type === 'out') {
                            outEvent = potentialOutEvent
                            outTime = new Date(outEvent.timestamp)
                            break
                          }
                        }
                        
                        let duration: string | null = null
                        if (outTime) {
                          const diff = outTime.getTime() - inTime.getTime()
                          const hours = Math.floor(diff / (1000 * 60 * 60))
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                          duration = `${hours}h ${minutes}m`
                        }
                        
                        shifts.push({
                          in: inTime,
                          out: outTime,
                          duration,
                          inId: inEvent.id,
                          outId: outEvent?.id || null,
                          inEvent,
                          outEvent
                        })
                      }
                    }
                    
                    return (
                      <div key={instructorId} className="bg-slate-700/50 rounded-lg p-4">
                        <h3 className="text-lg font-bold text-white mb-3">{instructorName}</h3>
                        <div className="space-y-2">
                          {shifts.map((shift, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-800/50 rounded p-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-4 text-sm">
                                  <div>
                                    <span className="text-green-400 font-semibold">⬇️ In:</span>
                                    <span className="text-white ml-2">{shift.in.toLocaleTimeString()}</span>
                                  </div>
                                  {shift.out ? (
                                    <>
                                      <div>
                                        <span className="text-red-400 font-semibold">⬆️ Out:</span>
                                        <span className="text-white ml-2">{shift.out.toLocaleTimeString()}</span>
                                      </div>
                                      <div className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold">
                                        {shift.duration}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-xs font-semibold">
                                      Still Clocked In
                                    </div>
                                  )}
                                </div>
                                
                                {/* Notes Display */}
                                {(shift.inEvent.notes || shift.outEvent?.notes) && (
                                  <div className="mt-2 text-xs text-slate-400 italic">
                                    {shift.inEvent.notes && <div>In: {shift.inEvent.notes}</div>}
                                    {shift.outEvent?.notes && <div>Out: {shift.outEvent.notes}</div>}
                                  </div>
                                )}
                              </div>
                              
                              {/* Edit Buttons */}
                              <div className="flex gap-2">
                                {isToday && (
                                  <>
                                    <button
                                      onClick={() => setEditingClockEvent(shift.inEvent)}
                                      className="px-3 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded text-xs font-semibold transition-colors"
                                      title="Edit clock in time"
                                    >
                                      ✏️ Edit In
                                    </button>
                                    
                                    {shift.outEvent && (
                                      <button
                                        onClick={() => setEditingClockEvent(shift.outEvent!)}
                                        className="px-3 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded text-xs font-semibold transition-colors"
                                        title="Edit clock out time"
                                      >
                                        ✏️ Edit Out
                                      </button>
                                    )}
                                  </>
                                )}
                                
                                {isToday && (
                                  <button
                                    onClick={() => setDeleteShiftConfirm({ inId: shift.inId, outId: shift.outId })}
                                    disabled={deleteClockLoading}
                                    className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </div>
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
              <div className="text-6xl mb-4">🔭</div>
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
                    const coveredForName = assignment.coveringFor ? 
                      getInstructorName(assignment.coveringFor) : null
                    
                    return (
                      <tr key={assignment.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="px-6 py-4 text-slate-300 text-sm">
                          {new Date(assignment.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-white font-semibold">
                          {assignment.studentName}
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
                          {assignment.studentWeight} lbs
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
      
      {/* Edit Clock Event Modal - PROPERLY TYPED */}
      {editingClockEvent !== null && (
        <EditClockEventModal
          event={editingClockEvent}
          onClose={() => setEditingClockEvent(null)}
          onSuccess={() => {
            setEditingClockEvent(null)
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
                {deleteShiftConfirm.outId ? 
                  ' Both the clock-in and clock-out events will be removed.' : 
                  ' The clock-in will be removed and the instructor will be clocked out.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteShiftConfirm(null)}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteShift}
                  disabled={deleteClockLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleteClockLoading ? 'Deleting...' : '✓ Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}