// src/app/analytics/page.tsx
// ✅ OPTIMIZED: Uses filtered queries for assignments and loads
'use client'

import React, { useMemo } from 'react'
import { useCurrentPeriodAssignments, useActiveInstructors, useActiveLoads } from '@/hooks/useDatabase'
import { getCurrentPeriod, calculateAssignmentPay, calculateInstructorBalance } from '@/lib/utils'
import type { Assignment, Instructor, Period, Load } from '@/types'
import { RequireRole } from '@/components/auth'

function calculateInstructorStats(
  instructor: Instructor,
  assignments: Assignment[],
  period: Period,
  allInstructors: Instructor[],
  loads: Load[]
) {
  let totalJumps = 0
  let tandemCount = 0
  let affCount = 0
  let videoCount = 0
  let totalEarnings = 0
  let missedJumps = 0
  let totalTandemWeight = 0  // NEW: Track total tandem student weight

  // Coverage tracking
  let timesCovered = 0
  let timesCovering = 0

  for (const assignment of assignments) {
    const assignmentDate = new Date(assignment.timestamp)
    if (assignmentDate < period.start || assignmentDate > period.end) continue
    
    // Check if this instructor was covered
    if (assignment.coveringFor === instructor.id) {
      timesCovered++
    }
    
    // Check if this instructor covered for someone
    if (assignment.instructorId === instructor.id && assignment.coveringFor) {
      timesCovering++
    }
    
    if (assignment.instructorId === instructor.id || assignment.videoInstructorId === instructor.id) {
      if (assignment.isMissedJump && assignment.instructorId === instructor.id) {
        missedJumps++
      } else if (!assignment.isMissedJump) {
        totalJumps++
      }
    }
    
    const pay = calculateAssignmentPay(assignment)
    
    if (assignment.instructorId === instructor.id) {
      if (assignment.jumpType === 'tandem' && !assignment.isMissedJump) {
        tandemCount++
        // NEW: Add student weight for tandem jumps
        totalTandemWeight += assignment.studentWeight || 0
      }
      else if (assignment.jumpType === 'aff' && !assignment.isMissedJump) affCount++

      if (!assignment.isMissedJump) totalEarnings += pay
    }

    if (assignment.videoInstructorId === instructor.id && !assignment.isMissedJump) {
      videoCount++
      totalEarnings += 45
    }
  }

  // ✅ Calculate balance using centralized function (includes pending loads)
  const balanceEarnings = calculateInstructorBalance(
    instructor.id,
    assignments,
    allInstructors,
    period,
    loads
  )

  // Calculate reliability score (0-100)
  const totalWorkload = totalJumps + missedJumps + timesCovered
  const reliabilityScore = totalWorkload > 0 
    ? Math.round(((totalJumps + timesCovered) / totalWorkload) * 100)
    : 100
  
  return {
    totalJumps,
    tandemCount,
    affCount,
    videoCount,
    balanceEarnings,
    totalEarnings,
    missedJumps,
    timesCovered,
    timesCovering,
    reliabilityScore,
    totalTandemWeight,  // NEW
    avgPerJump: totalJumps > 0 ? Math.round(totalEarnings / totalJumps) : 0
  }
}

function AnalyticsPageContent() {
  // ✅ OPTIMIZED: Only fetch current period assignments and active loads
  const { data: assignments, loading: assignmentsLoading } = useCurrentPeriodAssignments()
  const { data: instructors, loading: instructorsLoading } = useActiveInstructors()
  const { data: loads } = useActiveLoads(7)

  const period = getCurrentPeriod()
  
  const stats = useMemo(() => {
    let totalJumps = 0
    let tandemCount = 0
    let affCount = 0
    let videoCount = 0
    let balanceEarnings = 0
    let totalEarnings = 0
    let missedJumps = 0
    let totalCovers = 0
    
    for (const a of assignments) {
      const assignmentDate = new Date(a.timestamp)
      if (assignmentDate < period.start || assignmentDate > period.end) continue
      
      if (a.coveringFor) {
        totalCovers++
      }
      
      if (a.isMissedJump) {
        missedJumps++
        continue
      }
      
      totalJumps++

      const pay = calculateAssignmentPay(a)

      if (a.jumpType === 'tandem') {
        tandemCount++
      } else if (a.jumpType === 'aff') {
        affCount++
      } else if (a.jumpType === 'video') {
        videoCount++
      }
      
      if (!a.isRequest) balanceEarnings += pay
      totalEarnings += pay
      
      if (a.hasOutsideVideo) {
        videoCount++
        if (!a.isRequest) balanceEarnings += 45
        totalEarnings += 45
      }
    }
    
    return {
      totalJumps,
      balanceEarnings,
      totalEarnings,
      tandemCount,
      affCount,
      videoCount,
      missedJumps,
      totalCovers,
      avgPerJump: totalJumps > 0 ? Math.round(totalEarnings / totalJumps) : 0
    }
  }, [assignments, period])
  
  const instructorStats = useMemo(() => {
    return instructors
      .map(instructor => ({
        instructor,
        stats: calculateInstructorStats(instructor, assignments, period, instructors, loads)
      }))
      .sort((a, b) => b.stats.totalEarnings - a.stats.totalEarnings)
  }, [instructors, assignments, period, loads])
  
  // NEW: The Tank leaderboard (total tandem weight)
  const theTank = useMemo(() => {
    return [...instructorStats]
      .filter(({ stats }) => stats.totalTandemWeight > 0)
      .sort((a, b) => b.stats.totalTandemWeight - a.stats.totalTandemWeight)
      .slice(0, 5)
  }, [instructorStats])
  
  // NEW: The Professor leaderboard (AFF jumps)
  const theProfessor = useMemo(() => {
    return [...instructorStats]
      .filter(({ stats }) => stats.affCount > 0)
      .sort((a, b) => b.stats.affCount - a.stats.affCount)
      .slice(0, 5)
  }, [instructorStats])
  
  const maxEarnings = instructorStats[0]?.stats.totalEarnings ?? 1
  
  if (assignmentsLoading || instructorsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading analytics...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Analytics and Reports</h1>
          <p className="text-slate-300">{period.name}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Total Jumps</div>
            <div className="text-4xl font-bold text-white">{stats.totalJumps}</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Missed Jumps</div>
            <div className="text-4xl font-bold text-red-400">{stats.missedJumps}</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Covers</div>
            <div className="text-4xl font-bold text-blue-400">{stats.totalCovers}</div>
            <div className="text-xs text-slate-400 mt-1">Teammate assists</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Balance Earnings</div>
            <div className="text-4xl font-bold text-purple-400">${stats.balanceEarnings}</div>
            <div className="text-xs text-slate-400 mt-1">For fair rotation</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Total Earnings</div>
            <div className="text-4xl font-bold text-green-400">${stats.totalEarnings}</div>
            <div className="text-xs text-slate-400 mt-1">Avg: ${stats.avgPerJump}/jump</div>
          </div>
        </div>
        
        {/* NEW: The Tank and The Professor Leaderboards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-3xl">💪</span> The Tank
            </h2>
            <p className="text-sm text-slate-400 mb-4">Most total tandem student weight carried</p>
            {theTank.length === 0 ? (
              <div className="text-center text-slate-400 py-8">No tandem jumps yet</div>
            ) : (
              <div className="space-y-3">
                {theTank.map(({ instructor, stats }, index) => (
                  <div key={instructor.id} className="flex items-center gap-4 bg-white/5 rounded-lg p-4">
                    <div className={`text-2xl font-bold w-8 ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-slate-300' :
                      index === 2 ? 'text-orange-600' : 'text-slate-500'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{instructor.name}</div>
                      <div className="text-xs text-slate-400">
                        {stats.tandemCount} tandem jump{stats.tandemCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-400">
                        {stats.totalTandemWeight.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400">lbs</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-3xl">🎓</span> The Professor
            </h2>
            <p className="text-sm text-slate-400 mb-4">Most AFF jumps completed</p>
            {theProfessor.length === 0 ? (
              <div className="text-center text-slate-400 py-8">No AFF jumps yet</div>
            ) : (
              <div className="space-y-3">
                {theProfessor.map(({ instructor, stats }, index) => (
                  <div key={instructor.id} className="flex items-center gap-4 bg-white/5 rounded-lg p-4">
                    <div className={`text-2xl font-bold w-8 ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-slate-300' :
                      index === 2 ? 'text-orange-600' : 'text-slate-500'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{instructor.name}</div>
                      <div className="text-xs text-slate-400">
                        Teaching the next generation
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-400">
                        {stats.affCount}
                      </div>
                      <div className="text-xs text-slate-400">AFF jumps</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden border border-white/20">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Period Summary</h2>
          </div>
          {instructorStats.length === 0 ? (
            <div className="text-center text-slate-400 p-12">No data yet for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Instructor</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tandem</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">AFF</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Video</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Missed</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Covered</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Covering</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Reliable</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Pay</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg/Jump</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {instructorStats.map(({ instructor, stats }) => (
                    <tr key={instructor.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{instructor.name}</div>
                        {/* Earnings bar */}
                        <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-green-400"
                            style={{ width: `${(stats.totalEarnings / maxEarnings) * 100}%`, minWidth: stats.totalEarnings > 0 ? '60px' : '0' }}
                          >
                            {stats.totalEarnings > 0 && (
                              <span className="text-white text-xs font-bold">${stats.totalEarnings}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">{stats.tandemCount}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{stats.affCount}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{stats.videoCount}</td>
                      <td className="px-6 py-4 text-sm font-bold text-white">{stats.totalJumps}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={stats.missedJumps > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>
                          {stats.missedJumps}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={stats.timesCovered > 0 ? 'text-yellow-400 font-bold' : 'text-slate-500'}>
                          {stats.timesCovered}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={stats.timesCovering > 0 ? 'text-blue-400 font-bold' : 'text-slate-500'}>
                          {stats.timesCovering}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold">
                        <span className={
                          stats.reliabilityScore >= 95 ? 'text-green-400' :
                          stats.reliabilityScore >= 85 ? 'text-yellow-400' : 'text-red-400'
                        }>
                          {stats.reliabilityScore}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-purple-400 font-bold">${stats.balanceEarnings}</td>
                      <td className="px-6 py-4 text-sm text-green-400 font-bold">${stats.totalEarnings}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">${stats.avgPerJump}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <RequireRole roles={["admin", "manifest"]}>
      <AnalyticsPageContent />
    </RequireRole>
  )
}
