// Fix for src/app/dashboard/page.tsx
// This ensures proper real-time updates from Firebase

'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useActiveInstructors, useAssignments } from '@/hooks/useDatabase'
import { InstructorCard } from '@/components/InstructorCard'
import { AddJumpModal } from '@/components/AddJumpModal'
import { ReleaseAFFModal } from '@/components/ReleaseAFFModal'
import { 
  getCurrentPeriod, 
  calculateInstructorEarnings, 
  calculateInstructorTotalEarnings,
  getWeekSchedule 
} from '@/lib/utils'
import type { Instructor, Assignment } from '@/types'

export default function DashboardPage() {
  const { data: instructors, loading: instructorsLoading, refresh: refreshInstructors } = useActiveInstructors()
  const { data: assignments, loading: assignmentsLoading, refresh: refreshAssignments } = useAssignments()
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  const [releaseInstructor, setReleaseInstructor] = useState<Instructor | null>(null)
  
  // Force refresh periodically to ensure real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Trigger a refresh to ensure we have latest data
      refreshInstructors()
      refreshAssignments()
    }, 5000) // Refresh every 5 seconds
    
    return () => clearInterval(interval)
  }, [refreshInstructors, refreshAssignments])
  
  const period = getCurrentPeriod()
  const schedule = getWeekSchedule()
  
  // Calculate stats for each instructor - add key dependency to force recalc
  const instructorStats = useMemo(() => {
    // Add timestamp to ensure recalculation when data changes
    const timestamp = Date.now()
    
    return instructors.map(instructor => {
      // Balance (for rotation) - uses 1.2x multiplier for off days
      const balance = calculateInstructorEarnings(
        instructor.id,
        assignments,
        instructors,
        period
      )
      
      // Total earnings (actual pay) - NO multiplier
      const totalEarnings = calculateInstructorTotalEarnings(
        instructor.id,
        assignments,
        period
      )
      
      // Count jumps in current period
      let jumpCount = 0
      let todayEarnings = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      for (const assignment of assignments) {
        const assignmentDate = new Date(assignment.timestamp)
        
        // Count jumps in period
        if (
          assignmentDate >= period.start &&
          assignmentDate <= period.end &&
          !assignment.isMissedJump &&
          (assignment.instructorId === instructor.id || assignment.videoInstructorId === instructor.id)
        ) {
          jumpCount++
        }
        
        // Calculate today's earnings
        if (assignmentDate >= today && !assignment.isMissedJump) {
          if (assignment.instructorId === instructor.id) {
            let pay = 0
            if (assignment.jumpType === 'tandem') {
              pay = 40 + (assignment.tandemWeightTax || 0) * 20
              if (assignment.tandemHandcam) pay += 30
            } else if (assignment.jumpType === 'aff') {
              pay = assignment.affLevel === 'lower' ? 55 : 45
            }
            todayEarnings += pay
          } else if (assignment.videoInstructorId === instructor.id) {
            todayEarnings += 45
          }
        }
      }
      
      return {
        instructor,
        balance,
        totalEarnings,
        jumpCount,
        todayEarnings
      }
    })
  }, [instructors, assignments, period]) // Ensure all dependencies are included
  
  const handleAddJump = (instructor: Instructor) => {
    setSelectedInstructor(instructor)
  }
  
  const handleReleaseAFF = (instructor: Instructor) => {
    setReleaseInstructor(instructor)
  }
  
  if (instructorsLoading || assignmentsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-white text-xl">Loading dashboard...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Stats */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Active Period
            </div>
            <div className="text-2xl font-bold text-white">
              {period.name}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              {period.start.toLocaleDateString()} - {period.end.toLocaleDateString()}
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Active Instructors
            </div>
            <div className="text-4xl font-bold text-blue-400">
              {instructors.filter(i => i.clockedIn).length} / {instructors.length}
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Total Earnings
            </div>
            <div className="text-4xl font-bold text-green-400">
              ${instructorStats.reduce((sum, stat) => sum + stat.totalEarnings, 0).toLocaleString()}
            </div>
          </div>
        </div>
        
        {/* Instructor Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instructorStats.map(({ instructor, balance, totalEarnings, jumpCount, todayEarnings }) => (
            <InstructorCard
              key={`${instructor.id}-${Date.now()}`} // Force re-render with timestamp key
              instructor={instructor}
              balance={balance}
              totalEarnings={totalEarnings}
              todayEarnings={todayEarnings}
              jumpCount={jumpCount}
              onAddJump={() => handleAddJump(instructor)}
              onReleaseAFF={() => handleReleaseAFF(instructor)}
            />
          ))}
        </div>
        
        {/* Legend */}
        <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-3">📊 Understanding the Dashboard</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <strong className="text-white">Assignment Balance:</strong> Used for fair rotation. 
              Jumps completed on your day off will be valued at 1.2x. This will mean for every 5 jumps you complete on your day off, the scheduled instructor can expect to have completed 6. Exceptions include requests, big parties, holidays, etc.
            </div>
            <div>
              <strong className="text-white">Total Earnings:</strong> Actual pay you receive. 
              Bonuses, tips, and other incentives not included.
            </div>
            <div>
              <strong className="text-white">Jumps:</strong> Total completed jumps this period. 
              Does not include missed jumps.
            </div>
            <div>
              <strong className="text-white">Today's Earnings:</strong> Running total of earnings 
              from jumps completed today.
            </div>
          </div>
        </div>
      </div>
      
      {/* Add Jump Modal */}
      {selectedInstructor && (
        <AddJumpModal
          instructor={selectedInstructor}
          onClose={() => setSelectedInstructor(null)}
        />
      )}
      
      {/* Release AFF Modal */}
      {releaseInstructor && (
        <ReleaseAFFModal
          instructor={releaseInstructor}
          onClose={() => setReleaseInstructor(null)}
          onSuccess={() => setReleaseInstructor(null)}
        />
      )}
    </div>
  )
}