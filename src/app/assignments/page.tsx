'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useAssignments, useActiveInstructors, useDeleteClockEvent } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getCurrentPeriod } from '@/lib/utils'
import type { Assignment, ClockEvent } from '@/types'

export default function AssignmentsPage() {
  const { data: assignments, loading } = useAssignments()
  const { data: instructors } = useActiveInstructors()
  const { deleteEvent, loading: deleteClockLoading } = useDeleteClockEvent()
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
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
  
  const calculatePay = (assignment: Assignment) => {
    if (assignment.isMissedJump) return 0
    
    let pay = 0
    if (assignment.jumpType === 'tandem') {
      pay = 40 + (assignment.tandemWeightTax || 0) * 20
      if (assignment.tandemHandcam) pay += 30
    } else if (assignment.jumpType === 'aff') {
      pay = assignment.affLevel === 'lower' ? 55 : 45
    } else if (assignment.jumpType === 'video') {
      pay = 45
    }
    
    if (assignment.hasOutsideVideo) pay += 45
    
    return pay
  }
  
  const filteredAssignments = useMemo(() => {
    let filtered = assignments.filter(a => {
      const assignmentDate = new Date(a.timestamp)
      return assignmentDate >= period.start && assignmentDate <= period.end
    })
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(a => {
        const instructorName = getInstructorName(a.instructorId).toLowerCase()
        const videoName = a.videoInstructorId ? getInstructorName(a.videoInstructorId).toLowerCase() : ''
        const coveredName = a.coveringFor ? getInstructorName(a.coveringFor).toLowerCase() : ''
        return (
          a.name.toLowerCase().includes(search) ||
          instructorName.includes(search) ||
          videoName.includes(search) ||
          coveredName.includes(search) ||
          a.jumpType.toLowerCase().includes(search)
        )
      })
    }
    
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [assignments, period, searchTerm, instructors])
  
  const handleDelete = async (assignmentId: string) => {
    try {
      await db.deleteAssignment(assignmentId)
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
      } else {
        // If there's no clock-out (active shift), clock out the instructor
        const clockInEvent = clockEvents.find(e => e.id === deleteShiftConfirm.inId)
        if (clockInEvent) {
          await db.updateInstructor(clockInEvent.instructorId, {
            clockedIn: false
          })
        }
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
            <div className="text-center py-8 text-slate-400">
              <div className="text-4xl mb-2">⏰</div>
              <p className="text-sm">No clock activity for this date</p>
            </div>
          ) : (
            <>
              {/* Group events by instructor */}
              {(() => {
                // Group events by instructor
                const byInstructor = new Map<string, ClockEvent[]>()
                clockEvents.forEach(event => {
                  if (!byInstructor.has(event.instructorId)) {
                    byInstructor.set(event.instructorId, [])
                  }
                  byInstructor.get(event.instructorId)!.push(event)
                })

                // Calculate shifts for each instructor and filter out those with no shifts
                const instructorsWithShifts = Array.from(byInstructor.entries())
                  .map(([instructorId, events]) => {
                    const instructorName = events[0].instructorName
                    
                    // Calculate shifts (pair clock-ins with clock-outs)
                    const shifts: Array<{ 
                      in: Date, 
                      inId: string,
                      out: Date | null, 
                      outId: string | null,
                      duration: string | null 
                    }> = []
                    
                    for (let i = 0; i < events.length; i++) {
                      if (events[i].type === 'in') {
                        const clockInTime = new Date(events[i].timestamp)
                        const clockInId = events[i].id
                        let clockOutTime: Date | null = null
                        let clockOutId: string | null = null
                        let duration: string | null = null
                        
                        // Find matching clock out
                        if (i + 1 < events.length && events[i + 1].type === 'out') {
                          clockOutTime = new Date(events[i + 1].timestamp)
                          clockOutId = events[i + 1].id
                          const durationMs = clockOutTime.getTime() - clockInTime.getTime()
                          const hours = Math.floor(durationMs / (1000 * 60 * 60))
                          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
                          duration = `${hours}h ${minutes}m`
                        }
                        
                        shifts.push({ 
                          in: clockInTime, 
                          inId: clockInId,
                          out: clockOutTime, 
                          outId: clockOutId,
                          duration 
                        })
                      }
                    }
                    
                    // Calculate total hours for the day
                    const totalMs = shifts.reduce((sum, shift) => {
                      if (shift.out) {
                        return sum + (shift.out.getTime() - shift.in.getTime())
                      }
                      return sum
                    }, 0)
                    const totalHours = Math.floor(totalMs / (1000 * 60 * 60))
                    const totalMinutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60))
                    const totalTime = totalMs > 0 ? `${totalHours}h ${totalMinutes}m` : null
                    
                    const isCurrentlyIn = shifts.length > 0 && shifts[shifts.length - 1].out === null
                    
                    return {
                      instructorId,
                      instructorName,
                      shifts,
                      totalTime,
                      isCurrentlyIn
                    }
                  })
                  .filter(instructor => instructor.shifts.length > 0) // Only show instructors with shifts

                return instructorsWithShifts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <div className="text-4xl mb-2">⏰</div>
                    <p className="text-sm">No clock activity for this date</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {instructorsWithShifts.map(({ instructorId, instructorName, shifts, totalTime, isCurrentlyIn }) => (
                      <div
                        key={instructorId}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isCurrentlyIn
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-white/5 border-white/20'
                        }`}
                      >
                        {/* Instructor Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              isCurrentlyIn ? 'bg-green-400' : 'bg-gray-400'
                            }`} />
                            <span className="font-bold text-white">{instructorName}</span>
                          </div>
                          {totalTime && (
                            <span className="text-sm font-semibold text-blue-400">
                              {totalTime}
                            </span>
                          )}
                        </div>
                        
                        {/* Shifts */}
                        <div className="space-y-2">
                          {shifts.map((shift, idx) => (
                            <div key={idx} className="text-sm bg-black/20 rounded p-2 relative group">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-400">▶</span>
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
                    ))}
                  </div>
                )
              })()}
              
              {/* Daily Summary */}
              <div className="mt-6 pt-6 border-t border-white/20 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-slate-400 mb-1">Total Shifts</div>
                  <div className="text-2xl font-bold text-white">
                    {totalShifts}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-400 mb-1">Instructors</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {new Set(clockEvents.map(e => e.instructorId)).size}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-400 mb-1">Currently In</div>
                  <div className="text-2xl font-bold text-green-400">
                    {instructors.filter(i => i.clockedIn).length}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="mb-6">
          <input
            type="text"
            placeholder="🔍 Search by student, instructor, or jump type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        
        {filteredAssignments.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-12 text-center border border-white/20">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-white text-xl font-semibold mb-2">No assignments yet</p>
            <p className="text-slate-400">Assignments will appear here once you start assigning students</p>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden border border-white/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Date and Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Instructor
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Jump Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Pay
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredAssignments.map((assignment) => {
                    const date = new Date(assignment.timestamp)
                    const pay = calculatePay(assignment)
                    const instructorName = getInstructorName(assignment.instructorId)
                    const videoName = assignment.videoInstructorId ? getInstructorName(assignment.videoInstructorId) : null
                    const coveredForName = assignment.coveringFor ? getInstructorName(assignment.coveringFor) : null
                    
                    return (
                      <tr 
                        key={assignment.id} 
                        className={`hover:bg-white/5 transition-colors ${
                          assignment.isMissedJump ? 'bg-red-500/10' : 
                          assignment.coveringFor ? 'bg-blue-500/5' : ''
                        }`}
                      >
                        <td className="px-6 py-4 text-sm text-slate-300">
                          <div>{date.toLocaleDateString()}</div>
                          <div className="text-xs text-slate-400">{date.toLocaleTimeString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-white">
                            {assignment.isMissedJump ? 'MISSED JUMP' : assignment.name}
                          </div>
                          {assignment.weight > 0 && (
                            <div className="text-xs text-slate-400">{assignment.weight} lbs</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          <div className="flex items-center gap-2">
                            <span>{instructorName}</span>
                            {coveredForName && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                                🤝 Covering
                              </span>
                            )}
                          </div>
                          {coveredForName && (
                            <div className="text-xs text-blue-400 mt-1">
                              Covered for {coveredForName}
                            </div>
                          )}
                          {videoName && (
                            <div className="text-xs text-slate-400">Video: {videoName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-white uppercase">
                            {assignment.jumpType}
                            {assignment.jumpType === 'aff' && assignment.affLevel && (
                              <span className="text-xs text-slate-400"> ({assignment.affLevel})</span>
                            )}
                          </div>
                          {assignment.hasOutsideVideo && (
                            <div className="text-xs text-blue-400">+ Video</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold ${assignment.isMissedJump ? 'text-red-400' : 'text-green-400'}`}>
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
                          <button
                            onClick={() => setDeleteConfirm(assignment.id)}
                            className="px-3 py-1 bg-red-500/20 text-red-300 rounded text-xs font-bold hover:bg-red-500/30 transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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