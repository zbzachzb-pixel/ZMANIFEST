// src/app/dashboard/page.tsx - FIXED VERSION
// ✅ REMOVED: 5-second polling (Firebase subscriptions provide real-time updates)
// ✅ ADDED: useApp() for global state (no prop drilling)
// ✅ ADDED: Toast notifications for operations
// ✅ ADDED: Proper loading states
// ✅ OPTIMIZED: Uses filtered queries for assignments and loads

'use client'

import React, { useState, useMemo } from 'react'
import { useCurrentPeriodAssignments, useActiveLoads } from '@/hooks/useDatabase'
import { useApp } from '@/contexts/AppContext'
import { useToast } from '@/contexts/ToastContext'
import { InstructorCard } from '@/components/InstructorCard'
import { AddJumpModal } from '@/components/AddJumpModal'
import { ReleaseAFFModal } from '@/components/ReleaseAFFModal'
import {
  calculateInstructorEarnings,
  calculateInstructorTotalEarnings,
  calculateAssignmentPay
} from '@/lib/utils'
import { PAY_RATES } from '@/lib/constants'
import type { Instructor } from '@/types'
import { PageErrorBoundary } from '@/components/ErrorBoundary'

function DashboardPageContent() {
  // ✅ IMPROVEMENT: Use global context instead of local hooks
  const { instructors, period, isLoading: contextLoading } = useApp()
  // ✅ OPTIMIZED: Only fetch current period assignments and active loads
  const { data: assignments, loading: assignmentsLoading } = useCurrentPeriodAssignments()
  const { data: loads } = useActiveLoads(7)
  const toast = useToast()
  
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)
  const [releaseInstructor, setReleaseInstructor] = useState<Instructor | null>(null)
  
  // ✅ FIXED: No more 5-second polling!
  // Firebase subscriptions in useApp() and useAssignments() already provide real-time updates
  
  const isLoading = contextLoading || assignmentsLoading
  
  // Calculate stats for each instructor
  const instructorStats = useMemo(() => {
    if (!period) return []
    
    return instructors.map(instructor => {
      // Balance (for rotation) - uses 1.2x multiplier for off days + includes pending loads
      const balance = calculateInstructorEarnings(
        instructor.id,
        assignments,
        instructors,
        period,
        loads
      )
      
      // Total earnings (actual pay) - NO multiplier
      const totalEarnings = calculateInstructorTotalEarnings(
        instructor.id,
        assignments,
        period
      )
      
      // Today's earnings
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todaysAssignments = assignments.filter(a => {
        const assignmentDate = new Date(a.timestamp)
        return assignmentDate >= today && 
               (a.instructorId === instructor.id || a.videoInstructorId === instructor.id)
      })
      
      const todayEarnings = todaysAssignments.reduce((sum, a) => {
        let earnings = 0
        if (a.instructorId === instructor.id) {
          earnings = calculateAssignmentPay(a)
        }
        if (a.videoInstructorId === instructor.id) {
          earnings += PAY_RATES.VIDEO_INSTRUCTOR
        }
        return sum + earnings
      }, 0)
      
      // Jump count
      const jumpCount = assignments.filter(a => 
        a.instructorId === instructor.id || a.videoInstructorId === instructor.id
      ).length
      
      return {
        instructor,
        balance,
        totalEarnings,
        todayEarnings,
        jumpCount
      }
    })
  }, [instructors, assignments, period, loads])
  
  const handleAddJump = (instructor: Instructor) => {
    setSelectedInstructor(instructor)
  }
  
  const handleReleaseAFF = (instructor: Instructor) => {
    if (instructor.affStudents.length === 0) {
      toast.error('This instructor has no locked AFF students')
      return
    }
    setReleaseInstructor(instructor)
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading dashboard...</p>
        </div>
      </div>
    )
  }
  
  // No period found
  if (!period) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">No Active Period</h2>
          <p className="text-slate-300 mb-6">
            Create a new period in Settings to start tracking instructor rotations.
          </p>
          <a
            href="/settings"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Go to Settings
          </a>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📊 Instructor Dashboard</h1>
          <p className="text-slate-300">Monitor instructor stats and manage rotations in real-time</p>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-sm text-slate-300 mb-1 font-semibold uppercase tracking-wide">
              Active Period
            </div>
            <div className="text-2xl font-bold text-white">
              {period.name}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              {new Date(period.start).toLocaleDateString()} - {new Date(period.end).toLocaleDateString()}
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
          {instructorStats.map(({ instructor, balance, totalEarnings, todayEarnings, jumpCount }) => (
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
              Jumps completed on your day off will be valued at 1.2x. This means for every 5 jumps you complete on your day off, the scheduled instructor can expect to have completed 6. Exceptions include requests, big parties, holidays, etc.
            </div>
            <div>
              <strong className="text-white">Total Earnings:</strong> Actual pay you receive. 
              Does not include the 1.2x multiplier - this is your real money for the period.
            </div>
            <div>
              <strong className="text-white">Today's Earnings:</strong> Money earned today. 
              Updates in real-time as jumps are assigned.
            </div>
            <div>
              <strong className="text-white">Team Colors:</strong> Red, Blue, or Gold indicate which team the instructor belongs to for scheduling purposes.
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {selectedInstructor && (
        <AddJumpModal
          instructor={selectedInstructor}
          onClose={() => setSelectedInstructor(null)}
          onSuccess={() => {
            toast.success('Jump added successfully!')
            setSelectedInstructor(null)
          }}
        />
      )}
      
      {releaseInstructor && (
        <ReleaseAFFModal
          instructor={releaseInstructor}
          onClose={() => setReleaseInstructor(null)}
          onSuccess={() => {
            toast.success('AFF student released!')
            setReleaseInstructor(null)
          }}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <PageErrorBoundary>
      <DashboardPageContent />
    </PageErrorBoundary>
  )
}