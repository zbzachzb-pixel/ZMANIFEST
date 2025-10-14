'use client'

import React, { useState, useMemo } from 'react'
import { useActiveInstructors, useAssignments, useCreatePeriod } from '@/hooks/useDatabase'
import { getCurrentPeriod, calculateInstructorEarnings } from '@/lib/utils'

interface EndPeriodModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function EndPeriodModal({ onClose, onSuccess }: EndPeriodModalProps) {
  const { data: instructors } = useActiveInstructors()
  const { data: assignments } = useAssignments()
  const { create: createPeriod } = useCreatePeriod()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'confirm' | 'final-confirm' | 'processing' | 'complete'>('confirm')
  
  const period = getCurrentPeriod()
  
  const stats = useMemo(() => {
    const finalBalances: Record<string, number> = {}
    let totalJumps = 0
    let totalEarnings = 0
    
    instructors.forEach(instructor => {
      const balance = calculateInstructorEarnings(
        instructor.id,
        assignments,
        instructors,
        period
      )
      finalBalances[instructor.id] = balance
    })
    
    assignments.forEach(a => {
      const assignmentDate = new Date(a.timestamp)
      if (assignmentDate >= period.start && assignmentDate <= period.end) {
        if (!a.isMissedJump) totalJumps++
        
        let pay = 0
        if (!a.isMissedJump && !a.isRequest) {
          if (a.jumpType === 'tandem') {
            pay = 40 + (a.tandemWeightTax || 0) * 20
            if (a.tandemHandcam) pay += 30
          } else if (a.jumpType === 'aff') {
            pay = a.affLevel === 'lower' ? 55 : 45
          }
          if (a.hasOutsideVideo) pay += 45
        }
        totalEarnings += pay
      }
    })
    
    return {
      finalBalances,
      totalJumps,
      totalEarnings,
      instructorCount: instructors.length
    }
  }, [instructors, assignments, period])
  
  const handleEndPeriod = () => {
    console.log('🔘 End period button clicked!')
    setStep('final-confirm')
  }
  
  const handleFinalConfirm = async () => {
    console.log('✅ User confirmed - proceeding...')
    setLoading(true)
    setStep('processing')
    
    try {
      console.log('🔄 Starting period end process...')
      console.log('Current period:', period)
      
      // 1. Create archived period record
      console.log('📦 Creating archived period...')
      const archivedPeriod = await createPeriod({
        name: period.name,
        start: period.start,
        end: period.end,
        status: 'archived',
        finalBalances: stats.finalBalances,
        finalStats: {
          totalJumps: stats.totalJumps,
          totalEarnings: stats.totalEarnings,
          instructorCount: stats.instructorCount
        },
        endedAt: new Date().toISOString()
      })
      console.log('✅ Archived period created:', archivedPeriod)
      
      // 2. Calculate next period dates
      const nextStart = new Date(period.end)
      nextStart.setDate(nextStart.getDate() + 1)
      
      // Find first Monday after period end
      const firstMonday = new Date(nextStart)
      const dayOfWeek = firstMonday.getDay()
      const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
      firstMonday.setDate(firstMonday.getDate() + daysUntilMonday)
      
      // Third Monday (2 weeks later)
      const thirdMonday = new Date(firstMonday)
      thirdMonday.setDate(firstMonday.getDate() + 14)
      
      console.log('📅 New period dates:', { firstMonday, thirdMonday })
      
      // 3. Create new active period
      console.log('📦 Creating new active period...')
      const newPeriod = await createPeriod({
        name: `Period 1: ${firstMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${thirdMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        start: firstMonday,
        end: thirdMonday,
        status: 'active'
      })
      console.log('✅ New active period created:', newPeriod)
      
      setStep('complete')
      
      setTimeout(() => {
        onSuccess()
        onClose()
        window.location.reload()
      }, 2000)
      
    } catch (error: any) {
      console.error('❌ Failed to end period:', error)
      console.error('Error details:', error.message, error.stack)
      alert(`❌ Failed to end period: ${error.message || 'Unknown error'}. Check console for details.`)
      setStep('final-confirm')
    } finally {
      setLoading(false)
    }
  }
  
  if (step === 'processing') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-white/20 p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white text-lg font-semibold">Ending period...</p>
            <p className="text-slate-400 text-sm mt-2">This may take a moment</p>
          </div>
        </div>
      </div>
    )
  }
  
  if (step === 'complete') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-green-500/50 p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Period Ended!</h2>
            <p className="text-slate-300">New period has been created</p>
            <p className="text-slate-400 text-sm mt-2">Refreshing page...</p>
          </div>
        </div>
      </div>
    )
  }
  
  if (step === 'final-confirm') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border-2 border-red-500">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-white mb-4">Final Confirmation</h2>
              <p className="text-red-300 font-semibold mb-4">
                This action cannot be undone!
              </p>
              <p className="text-slate-300 text-sm">
                Are you absolutely sure you want to end the current period?
              </p>
            </div>
            
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm font-semibold">
                ✓ Current period will be archived<br/>
                ✓ All instructor balances will reset to $0<br/>
                ✓ A new active period will be created
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep('confirm')}
                disabled={loading}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalConfirm}
                disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                Yes, End Period Now
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">🔒 End Current Period</h2>
          
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <p className="text-yellow-300 font-semibold mb-2">⚠️ Warning</p>
            <p className="text-sm text-yellow-200">
              This will permanently archive the current period and start a new one. 
              All instructor balances will be reset to $0 for the new period.
              Historical data will remain accessible.
            </p>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Period Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-400">Period Name</div>
                <div className="text-white font-semibold">{period.name}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Total Jumps</div>
                <div className="text-white font-semibold">{stats.totalJumps}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Total Earnings</div>
                <div className="text-green-400 font-semibold">${stats.totalEarnings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Active Instructors</div>
                <div className="text-white font-semibold">{stats.instructorCount}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Final Balances</h3>
            <div className="space-y-2">
              {instructors
                .sort((a, b) => (stats.finalBalances[b.id] || 0) - (stats.finalBalances[a.id] || 0))
                .map(instructor => (
                  <div key={instructor.id} className="flex justify-between items-center py-1">
                    <span className="text-slate-300">{instructor.name}</span>
                    <span className="text-white font-semibold">
                      ${stats.finalBalances[instructor.id] || 0}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-blue-300 text-sm">
              💡 <strong>What happens next:</strong> A new period will be created starting from the next Monday.
              All instructors will start with $0 balance. You can view historical data anytime from the Analytics page.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleEndPeriod}
              disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '⏳ Ending Period...' : '🔒 Continue to Confirmation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}