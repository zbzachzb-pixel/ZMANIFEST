// src/app/test-dashboard/page.tsx
// Test Mode Dashboard - View test assignment data with date range filtering

'use client'

import React, { useState, useMemo } from 'react'
import { useTestAssignmentsByDateRange } from '@/hooks/useDatabase'
import { useApp } from '@/contexts/AppContext'
import { InstructorCard } from '@/components/InstructorCard'
import {
  calculateInstructorBalance,
  calculateAssignmentPay,
  getCurrentPeriod
} from '@/lib/utils'
import { PAY_RATES } from '@/lib/constants'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { RequireRole } from '@/components/auth'

function TestDashboardPageContent() {
  const { instructors, isLoading: contextLoading } = useApp()

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date('2025-10-01')
    return d
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date('2025-10-07')
    return d
  })
  const [asOfDate, setAsOfDate] = useState(() => new Date('2025-10-07'))

  // Fetch test assignments within date range
  const { data: allTestAssignments, loading: assignmentsLoading } = useTestAssignmentsByDateRange(startDate, endDate)

  const isLoading = contextLoading || assignmentsLoading

  // Filter assignments up to "as of" date for cumulative view
  const assignmentsAsOf = useMemo(() => {
    const asOfTime = new Date(asOfDate)
    asOfTime.setHours(23, 59, 59, 999) // End of selected date

    return allTestAssignments.filter(a => {
      const assignmentDate = new Date(a.timestamp)
      return assignmentDate <= asOfTime && !a.isDeleted
    })
  }, [allTestAssignments, asOfDate])

  // Calculate stats for each instructor
  const instructorStats = useMemo(() => {
    const period = getCurrentPeriod() // Use for balance calculation structure

    return instructors.map(instructor => {
      // Balance (for rotation) - using test assignments
      const balance = calculateInstructorBalance(
        instructor.id,
        assignmentsAsOf,
        instructors,
        period,
        [], // No loads for test mode balance
        'blue' // Default team rotation
      )

      // Total earnings within date range
      const totalEarnings = assignmentsAsOf
        .filter(a => a.instructorId === instructor.id || a.videoInstructorId === instructor.id)
        .reduce((sum, a) => {
          let earnings = 0
          if (a.instructorId === instructor.id) {
            earnings = calculateAssignmentPay(a)
          }
          if (a.videoInstructorId === instructor.id) {
            earnings += PAY_RATES.VIDEO_INSTRUCTOR
          }
          return sum + earnings
        }, 0)

      // Earnings on the "as of" date
      const asOfDateStart = new Date(asOfDate)
      asOfDateStart.setHours(0, 0, 0, 0)
      const asOfDateEnd = new Date(asOfDate)
      asOfDateEnd.setHours(23, 59, 59, 999)

      const dayAssignments = assignmentsAsOf.filter(a => {
        const assignmentDate = new Date(a.timestamp)
        return assignmentDate >= asOfDateStart && assignmentDate <= asOfDateEnd &&
               (a.instructorId === instructor.id || a.videoInstructorId === instructor.id)
      })

      const dayEarnings = dayAssignments.reduce((sum, a) => {
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
      const jumpCount = assignmentsAsOf.filter(a =>
        (a.instructorId === instructor.id || a.videoInstructorId === instructor.id)
      ).length

      return {
        instructor,
        balance,
        totalEarnings,
        todayEarnings: dayEarnings,
        jumpCount
      }
    })
  }, [instructors, assignmentsAsOf, asOfDate])

  // Calculate period summary
  const periodSummary = useMemo(() => {
    const totalJumps = assignmentsAsOf.length
    const tandemJumps = assignmentsAsOf.filter(a => a.jumpType === 'tandem').length
    const affJumps = assignmentsAsOf.filter(a => a.jumpType === 'aff').length
    const videoJumps = assignmentsAsOf.filter(a => a.jumpType === 'video' || a.hasOutsideVideo).length
    const totalEarnings = assignmentsAsOf.reduce((sum, a) => sum + calculateAssignmentPay(a), 0)

    return {
      totalJumps,
      tandemJumps,
      affJumps,
      videoJumps,
      totalEarnings
    }
  }, [assignmentsAsOf])

  // Format date for input
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  return (
    <div className="p-4 min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            🧪 Test Mode Dashboard
          </h1>
          <p className="text-slate-400">
            View and analyze test assignment data for planning and simulation
          </p>
        </div>

        {/* Date Range Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 shadow-xl mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={formatDateForInput(startDate)}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={formatDateForInput(endDate)}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                View Totals As Of
              </label>
              <input
                type="date"
                value={formatDateForInput(asOfDate)}
                onChange={(e) => setAsOfDate(new Date(e.target.value))}
                min={formatDateForInput(startDate)}
                max={formatDateForInput(endDate)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-400">
            <span className="font-medium text-white">Tip:</span> Use "View Totals As Of" to see cumulative balances and earnings through a specific date in your test period.
          </div>
        </div>

        {/* Period Summary */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-6 shadow-xl mb-6 text-white">
          <h2 className="text-xl font-bold mb-4">
            Period Summary ({formatDateForInput(startDate)} to {formatDateForInput(asOfDate)})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-sm opacity-90">Total Jumps</div>
              <div className="text-3xl font-bold">{periodSummary.totalJumps}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-sm opacity-90">Tandem</div>
              <div className="text-3xl font-bold">{periodSummary.tandemJumps}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-sm opacity-90">AFF</div>
              <div className="text-3xl font-bold">{periodSummary.affJumps}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-sm opacity-90">Video</div>
              <div className="text-3xl font-bold">{periodSummary.videoJumps}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-sm opacity-90">Earnings</div>
              <div className="text-3xl font-bold">${periodSummary.totalEarnings.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-blue-500"></div>
            <p className="mt-4 text-slate-400">Loading test data...</p>
          </div>
        )}

        {/* No Data State */}
        {!isLoading && assignmentsAsOf.length === 0 && (
          <div className="bg-white/5 backdrop-blur-lg rounded-xl p-12 border border-white/10 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-2">No Test Data Found</h3>
            <p className="text-slate-400 mb-4">
              No test assignments found in the selected date range. Enable test mode and complete some loads to generate test data.
            </p>
            <div className="text-sm text-slate-500">
              Date Range: {formatDateForInput(startDate)} to {formatDateForInput(asOfDate)}
            </div>
          </div>
        )}

        {/* Instructor Cards */}
        {!isLoading && assignmentsAsOf.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4">
              Instructor Stats (as of {formatDateForInput(asOfDate)})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instructorStats
                .filter(stat => stat.jumpCount > 0) // Only show instructors with jumps
                .sort((a, b) => b.balance - a.balance) // Sort by balance (highest first)
                .map(stat => (
                  <InstructorCard
                    key={stat.instructor.id}
                    instructor={stat.instructor}
                    balance={stat.balance}
                    totalEarnings={stat.totalEarnings}
                    todayEarnings={stat.todayEarnings}
                    jumpCount={stat.jumpCount}
                    onAddJump={() => {}} // Disabled for test mode
                    onReleaseAFF={() => {}} // Disabled for test mode
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TestDashboardPage() {
  return (
    <RequireRole roles={['admin', 'instructor']}>
      <PageErrorBoundary>
        <TestDashboardPageContent />
      </PageErrorBoundary>
    </RequireRole>
  )
}
