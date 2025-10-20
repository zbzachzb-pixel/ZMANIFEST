'use client'

import React, { useState, useMemo } from 'react'
import { useInstructors, useAssignments } from '@/hooks/useDatabase'
import { db } from '@/services'
import { calculateInstructorBalance } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import type { Period } from '@/types'

interface EndPeriodModalProps {
  period: Period
  onClose: () => void
  onSuccess: () => void
}

export function EndPeriodModal({ period, onClose, onSuccess }: EndPeriodModalProps) {
  const { data: instructors } = useInstructors()
  const { data: allAssignments } = useAssignments()
  const toast = useToast()
  const [newPeriodName, setNewPeriodName] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Filter assignments for current period
  const periodAssignments = useMemo(() => {
    return allAssignments.filter(a => {
      const assignmentDate = new Date(a.timestamp)
      return assignmentDate >= period.start && assignmentDate <= period.end
    })
  }, [allAssignments, period])
  
  // Calculate final balances
  const finalBalances = useMemo(() => {
    const balances: Record<string, number> = {}
    instructors.forEach(instructor => {
      balances[instructor.id] = calculateInstructorBalance(
        instructor.id,
        periodAssignments,
        instructors,
        period
      )
    })
    return balances
  }, [instructors, periodAssignments, period])
  
  // Calculate stats
  const stats = useMemo(() => {
    const totalJumps = periodAssignments.length
    const totalEarnings = Object.values(finalBalances).reduce((sum, bal) => sum + bal, 0)
    const instructorCount = Object.keys(finalBalances).length
    const tandemCount = periodAssignments.filter(a => a.jumpType === 'tandem').length
    const affCount = periodAssignments.filter(a => a.jumpType === 'aff').length
    const videoCount = periodAssignments.filter(a => a.hasOutsideVideo).length
    const missedJumps = periodAssignments.filter(a => a.isMissedJump).length
    
    return {
      totalJumps,
      totalEarnings,
      instructorCount,
      tandemCount,
      affCount,
      videoCount,
      missedJumps,
      avgPerJump: totalJumps > 0 ? Math.round(totalEarnings / totalJumps) : 0
    }
  }, [periodAssignments, finalBalances])
  
  // Get top instructors
  const topInstructors = useMemo(() => {
    return Object.entries(finalBalances)
      .map(([id, balance]) => ({
        instructor: instructors.find(i => i.id === id),
        balance
      }))
      .filter(item => item.instructor && item.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
  }, [finalBalances, instructors])
  
  const handleEndPeriod = async () => {
    if (!newPeriodName.trim()) {
      toast.error('Please enter a name for the new period')
      return
    }
    
    if (!confirm(`⚠️ This will end "${period.name}" and start a new period.\n\nThis action:\n• Archives all current data\n• Locks this period as read-only\n• Resets all balances to $0\n\nContinue?`)) {
      return
    }
    
    setLoading(true)
    
    try {
      // End current period
      await db.endPeriod(period.id, finalBalances, stats)
      
      // Reset all instructor balances
      const resetPromises = instructors.map(instructor => 
        db.updateInstructor(instructor.id, { 
          clockedIn: false  // Also clock everyone out
        })
      )
      await Promise.all(resetPromises)
      
      // Create new period
      const now = new Date()
      const twoWeeksLater = new Date(now)
      twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)
      
      await db.createPeriod({
        name: newPeriodName.trim(),
        start: now,
        end: twoWeeksLater
      })

      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to end period:', error)
      toast.error('Failed to end period', 'Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-red-500">
        <div className="sticky top-0 bg-slate-800 border-b border-red-500 p-6 z-10">
          <h2 className="text-3xl font-bold text-white">🔒 End Period: {period.name}</h2>
          <p className="text-slate-300 mt-2">
            {period.start.toLocaleDateString()} - {period.end.toLocaleDateString()}
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Period Summary */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">⚠️ Warning</h3>
            <p className="text-slate-300 mb-4">
              Ending this period will:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 mb-4">
              <li>Archive all data from this period (read-only)</li>
              <li>Lock final balances for all instructors</li>
              <li>Reset all balances to $0 for new period</li>
              <li>Clock out all instructors</li>
              <li>Start a fresh period with clean slate</li>
            </ul>
            <p className="text-red-400 font-bold">
              This action cannot be undone!
            </p>
          </div>
          
          {/* Period Statistics */}
          <div className="bg-white/5 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">📊 Period Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{stats.totalJumps}</div>
                <div className="text-sm text-slate-400 mt-1">Total Jumps</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400">${stats.totalEarnings}</div>
                <div className="text-sm text-slate-400 mt-1">Total Earnings</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{stats.instructorCount}</div>
                <div className="text-sm text-slate-400 mt-1">Instructors</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-400">${stats.avgPerJump}</div>
                <div className="text-sm text-slate-400 mt-1">Avg Per Jump</div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-300">{stats.tandemCount}</div>
                <div className="text-xs text-slate-400">Tandem</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-purple-300">{stats.affCount}</div>
                <div className="text-xs text-slate-400">AFF</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-300">{stats.videoCount}</div>
                <div className="text-xs text-slate-400">Video</div>
              </div>
            </div>
            
            {stats.missedJumps > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-4 text-center">
                <div className="text-xl font-bold text-red-400">{stats.missedJumps}</div>
                <div className="text-xs text-slate-400">Missed Jumps</div>
              </div>
            )}
          </div>
          
          {/* Top Instructors */}
          {topInstructors.length > 0 && (
            <div className="bg-white/5 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">🏆 Top Instructors</h3>
              <div className="space-y-2">
                {topInstructors.map((item, idx) => (
                  <div 
                    key={item.instructor!.id}
                    className="flex items-center justify-between bg-white/5 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl ${
                        idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏅'
                      }`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </div>
                      <div>
                        <div className="font-bold text-white">{item.instructor!.name}</div>
                        <div className="text-xs text-slate-400">
                          {periodAssignments.filter(a => a.instructorId === item.instructor!.id).length} jumps
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-400">
                      ${item.balance}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* All Instructor Balances */}
          <div className="bg-white/5 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">💰 Final Balances (All Instructors)</h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {Object.entries(finalBalances)
                .map(([id, balance]) => ({
                  instructor: instructors.find(i => i.id === id),
                  balance
                }))
                .filter(item => item.instructor)
                .sort((a, b) => b.balance - a.balance)
                .map(item => (
                  <div 
                    key={item.instructor!.id}
                    className="flex items-center justify-between bg-white/5 rounded p-2"
                  >
                    <span className="text-slate-300">{item.instructor!.name}</span>
                    <span className={`font-bold ${
                      item.balance > 0 ? 'text-green-400' : 
                      item.balance < 0 ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      ${item.balance}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          
          {/* New Period Name */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">📅 New Period</h3>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Name for new period *
            </label>
            <input
              type="text"
              value={newPeriodName}
              onChange={(e) => setNewPeriodName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g., December 2024 - Period 2"
              required
            />
            <p className="text-xs text-slate-400 mt-2">
              New period will start today and run for 2 weeks (customizable after creation)
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 text-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleEndPeriod}
              disabled={loading || !newPeriodName.trim()}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {loading ? '⏳ Ending Period...' : '🔒 End Period & Start New'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}