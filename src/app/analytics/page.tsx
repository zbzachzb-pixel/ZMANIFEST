'use client'

import React, { useMemo } from 'react'
import { useAssignments, useActiveInstructors } from '@/hooks/useDatabase'
import { getCurrentPeriod } from '@/lib/utils'
import type { Assignment, Instructor } from '@/types'

function calculateInstructorStats(instructor: Instructor, assignments: Assignment[], period: any) {
  let totalJumps = 0
  let tandemCount = 0
  let affCount = 0
  let videoCount = 0
  let balanceEarnings = 0
  let totalEarnings = 0
  let missedJumps = 0
  
  for (const assignment of assignments) {
    const assignmentDate = new Date(assignment.timestamp)
    if (assignmentDate < period.start || assignmentDate > period.end) continue
    
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
  
  return {
    totalJumps,
    tandemCount,
    affCount,
    videoCount,
    balanceEarnings,
    totalEarnings,
    missedJumps,
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
    
    for (const a of periodAssignments) {
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Total Jumps</div>
            <div className="text-4xl font-bold text-white">{stats.totalJumps}</div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Missed Jumps</div>
            <div className="text-4xl font-bold text-red-400">{stats.missedJumps}</div>
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
                  <div className="w-20 text-right text-sm text-slate-300">{stats.totalJumps} jumps</div>
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Total Jumps</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Missed</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Tandem</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">AFF</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Video</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Total Earnings</th>
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
                      <td className="px-6 py-4 text-sm text-slate-300">{stats.tandemCount}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{stats.affCount}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{stats.videoCount}</td>
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