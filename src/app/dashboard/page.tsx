'use client'

import React, { useState, useMemo } from 'react'
import { useActiveInstructors, useAssignments } from '@/hooks/useDatabase'
import { InstructorCard } from '@/components/InstructorCard'
import { AddJumpModal } from '@/components/AddJumpModal'
import { 
  getCurrentPeriod, 
  calculateInstructorEarnings, 
  calculateInstructorTotalEarnings,
  getScheduleDisplay 
} from '@/lib/utils'
import type { Instructor, Assignment } from '@/types'

export default function DashboardPage() {
  const { data: instructors, loading: instructorsLoading } = useActiveInstructors()
  const { data: assignments, loading: assignmentsLoading } = useAssignments()
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  
  const period = getCurrentPeriod()
  const schedule = getScheduleDisplay()
  
  // Calculate stats for each instructor
  const instructorStats = useMemo(() => {
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
        assignments
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
            } else if (assignment.jumpType === 'video') {
              pay = 45
            }
            todayEarnings += pay
          }
          
          if (assignment.videoInstructorId === instructor.id) {
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
    // Sort by balance (lowest first for fair rotation)
    .sort((a, b) => a.balance - b.balance)
  }, [instructors, assignments, period])
  
  const handleAddJump = (instructor: Instructor) => {
    setSelectedInstructor(instructor)
  }
  
  const handleReleaseAFF = async (instructor: Instructor) => {
    // This would connect to your release AFF modal/logic
    console.log('Release AFF for:', instructor.name)
  }
  
  if (instructorsLoading || assignmentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading dashboard...</p>
        </div>
      </div>
    )
  }
  
  if (instructors.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-12 border border-white/20 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Instructors Yet</h2>
            <p className="text-slate-300 mb-6">
              Add instructors to get started with the rotation system.
            </p>
            <a
              href="/instructors"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Go to Instructors
            </a>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-300">{period.name}</p>
        </div>
        
        {/* Team Schedule Card */}
        <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 text-center">📅 This Week's Schedule</h2>
          <div className="flex flex-wrap gap-6 justify-center items-center">
            <div className="text-center">
              <div className="text-lg font-semibold text-red-400 mb-1">🔴 Red Team</div>
              <div className="text-2xl font-bold text-white">{schedule.redTeam}</div>
            </div>
            <div className="text-4xl text-slate-600">•</div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-400 mb-1">🔵 Blue Team</div>
              <div className="text-2xl font-bold text-white">{schedule.blueTeam}</div>
            </div>
          </div>
          <p className="text-center text-slate-400 text-sm mt-4">
            EVERYONE WORKS WEEKENDS
          </p>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Total Instructors
            </div>
            <div className="text-4xl font-bold text-white">
              {instructors.length}
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Clocked In
            </div>
            <div className="text-4xl font-bold text-green-400">
              {instructors.filter(i => i.clockedIn).length}
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Total Jumps
            </div>
            <div className="text-4xl font-bold text-blue-400">
              {instructorStats.reduce((sum, stat) => sum + stat.jumpCount, 0)}
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
              key={instructor.id}
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
    </div>
  )
}