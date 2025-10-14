'use client'

import React, { useMemo } from 'react'
import { useAssignments, useActiveInstructors } from '@/hooks/useDatabase'
import { getCurrentPeriod } from '@/lib/utils'
import type { Assignment, Instructor } from '@/types'

interface CoverageStats {
  timesCovered: number
  timesCovering: number
  missedJumps: number
  reliabilityScore: number
}

function calculateInstructorStats(instructor: Instructor, assignments: Assignment[], period: any) {
  let totalJumps = 0
  let tandemCount = 0
  let affCount = 0
  let videoCount = 0
  let balanceEarnings = 0
  let totalEarnings = 0
  let missedJumps = 0
  
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
    
    let pay = 0
    if (!assignment.isMissedJump) {
      if (assignment.jumpType === 'tandem') {
        pay = 40 + (assignment.tandemWeightTax || 0) * 20
        if (assignment.tandemHandcam) pay += 30
      } else if (assignment.jumpType === 'aff') {
        pay = assignment.affLevel === 'lower' ? 55 : 45
      } else if (assignment.jumpType === 'video') {
        pay = 45
      }
    }
    
    if (assignment.instructorId === instructor.id) {
      if (assignment.jumpType === 'tandem' && !assignment.isMissedJump) tandemCount++
      else if (assignment.jumpType === 'aff' && !assignment.isMissedJump) affCount++
      
      if (!assignment.isRequest) balanceEarnings += pay
      if (!assignment.isMissedJump) totalEarnings += pay
    }
    
    if (assignment.videoInstructorId === instructor.id && !assignment.isMissedJump) {
      videoCount++
      if (!assignment.isRequest) balanceEarnings += 45
      totalEarnings += 45
    }
  }
  
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
    avgPerJump: totalJumps > 0 ? Math.round(totalEarnings / totalJumps) : 0
  }
}

export default function AnalyticsPage() {
  const { data: assignments, loading: assignmentsLoading } = useAssignments()
  const { data: instructors, loading: instructorsLoading } = useActiveInstructors()
  
  const period = getCurrentPeriod()
  
  const stats = useMemo(() => {
    const periodAssignments = assignments.filter(a => {
      const assignmentDate = new Date(a.timestamp)
      return assignmentDate >= period.start && assignmentDate <= period.end
    })
    
    let totalJumps = 0
    let balanceEarnings = 0
    let totalEarnings = 0
    let tandemCount = 0
    let affCount = 0
    let videoCount = 0
    let missedJumps = 0
    let totalCovers = 0
    
    for (const a of periodAssignments) {
      if (a.coveringFor) totalCovers++
      
      if (a.isMissedJump) {
        missedJumps++
        let pay = 0
        if (a.jumpType === 'tandem') {
          pay = 40 + (a.tandemWeightTax || 0) * 20
          if (a.tandemHandcam) pay += 30
        } else if (a.jumpType === 'aff') {
          pay = a.affLevel === 'lower' ? 55 : 45
        }
        if (!a.isRequest) balanceEarnings += pay
        continue
      }
      
      totalJumps++
      
      let pay = 0
      if (a.jumpType === 'tandem') {
        pay = 40 + (a.tandemWeightTax || 0) * 20
        if (a.tandemHandcam) pay += 30
        tandemCount++
      } else if (a.jumpType === 'aff') {
        pay = a.affLevel === 'lower' ? 55 : 45
        affCount++
      } else if (a.jumpType === 'video') {
        pay = 45
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
        stats: calculateInstructorStats(instructor, assignments, period)
      }))
      .sort((a, b) => b.stats.totalEarnings - a.stats.totalEarnings)
  }, [instructors, assignments, period])
  
  // Coverage leaderboards
  const mostHelpful = useMemo(() => {
    return [...instructorStats]
      .sort((a, b) => b.stats.timesCovering - a.stats.timesCovering)
      .slice(0, 5)
  }, [instructorStats])
  
  const mostReliable = useMemo(() => {
    return [...instructorStats]
      .sort((a, b) => b.stats.reliabilityScore - a.stats.reliabilityScore)
      .slice(0, 5)
  }, [instructorStats])
  
  const maxEarnings = instructorStats.length > 0 ? instructorStats[0].stats.totalEarnings : 1
  
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
        
        {/* NEW: Coverage Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">🏆 Most Helpful (Coverage)</h2>
            <p className="text-sm text-slate-400 mb-4">Instructors who covered for teammates the most</p>
            {mostHelpful.length === 0 ? (
              <div className="text-center text-slate-400 py-8">No coverage data yet</div>
            ) : (
              <div className="space-y-3">
                {mostHelpful.map(({ instructor, stats }, index) => (
                  <div key={instructor.id} className="flex items-center gap-4 bg-white/5 rounded-lg p-4">
                    <div className="text-2xl font-bold text-slate-500 w-8">#{index + 1}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{instructor.name}</div>
                      <div className="text-xs text-slate-400">
                        Covered {stats.timesCovering} jump{stats.timesCovering !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">{stats.timesCovering}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">💯 Most Reliable</h2>
            <p className="text-sm text-slate-400 mb-4">Based on jumps completed vs. missed/covered</p>
            {mostReliable.length === 0 ? (
              <div className="text-center text-slate-400 py-8">No reliability data yet</div>
            ) : (
              <div className="space-y-3">
                {mostReliable.map(({ instructor, stats }, index) => (
                  <div key={instructor.id} className="flex items-center gap-4 bg-white/5 rounded-lg p-4">
                    <div className="text-2xl font-bold text-slate-500 w-8">#{index + 1}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{instructor.name}</div>
                      <div className="text-xs text-slate-400">
                        {stats.missedJumps} missed • {stats.timesCovered} covered
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${
                      stats.reliabilityScore >= 95 ? 'text-green-400' :
                      stats.reliabilityScore >= 85 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {stats.reliabilityScore}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Jump Distribution</h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400">{stats.tandemCount}</div>
              <div className="text-sm text-slate-400 mt-1">Tandem</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400">{stats.affCount}</div>
              <div className="text-sm text-slate-400 mt-1">AFF</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400">{stats.videoCount}</div>
              <div className="text-sm text-slate-400 mt-1">Video</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Instructor Earnings</h2>
          {instructorStats.length === 0 ? (
            <div className="text-center text-slate-400 py-8">No instructor data yet</div>
          ) : (
            <div className="space-y-4">
              {instructorStats.map(({ instructor, stats }) => (
                <div key={instructor.id} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-semibold text-white truncate">{instructor.name}</div>
                  <div className="flex-1 bg-slate-700 rounded-full h-8 overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full flex items-center justify-end pr-3 transition-all duration-500"
                      style={{ 
                        width: `${maxEarnings > 0 ? (stats.totalEarnings / maxEarnings) * 100 : 0}%`, 
                        minWidth: stats.totalEarnings > 0 ? '60px' : '0' 
                      }}
                    >
                      {stats.totalEarnings > 0 && (
                        <span className="text-white text-xs font-bold">${stats.totalEarnings}</span>
                      )}
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <div className="text-sm text-slate-300">{stats.totalJumps} jumps</div>
                    {stats.reliabilityScore < 100 && (
                      <div className="text-xs text-slate-500">{stats.reliabilityScore}% reliable</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden border border-white/20">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Period Summary</h2>
          </div>
          {instructorStats.length === 0 ? (
            <div className="text-center text-slate-400 py-8 pb-12">No instructor data yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Instructor</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Jumps</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Missed</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Covered</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Covering</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Reliability</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Total $</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Avg/Jump</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {instructorStats.map(({ instructor, stats }) => (
                    <tr key={instructor.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-white">{instructor.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{stats.totalJumps}</td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <span className={stats.missedJumps > 0 ? 'text-red-400' : 'text-slate-300'}>
                          {stats.missedJumps}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <span className={stats.timesCovered > 0 ? 'text-yellow-400' : 'text-slate-300'}>
                          {stats.timesCovered}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <span className={stats.timesCovering > 0 ? 'text-blue-400' : 'text-slate-300'}>
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