'use client'

import React from 'react'
import type { Instructor } from '@/types'

interface InstructorCardProps {
  instructor: Instructor
  balance: number
  totalEarnings: number
  todayEarnings: number
  jumpCount: number
  onAddJump: () => void
  onReleaseAFF: () => void
}

export function InstructorCard({
  instructor,
  balance,
  totalEarnings,
  todayEarnings,
  jumpCount,
  onAddJump,
  onReleaseAFF
}: InstructorCardProps) {
  const getTeamBadge = () => {
    if (instructor.team === 'red') {
      return <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-semibold">🔴 Red</span>
    } else if (instructor.team === 'blue') {
      return <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">🔵 Blue</span>
    } else if (instructor.team === 'gold') {
      return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-semibold">🟡 Gold</span>
    } else {
      return <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-semibold">⚠️ No Team</span>
    }
  }
  
  const isAFFLocked = instructor.affLocked && instructor.affStudents && instructor.affStudents.length > 0
  
  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border transition-all hover:border-white/40 ${
      isAFFLocked ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/20'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">{instructor.name}</h3>
          <div className="flex flex-wrap gap-2">
            {getTeamBadge()}
            {instructor.canTandem && <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">T</span>}
            {instructor.canAFF && <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-semibold">A</span>}
            {instructor.canVideo && <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-semibold">V</span>}
            {isAFFLocked && (
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-semibold">
                🔒 AFF Locked
              </span>
            )}
          </div>
        </div>
        
        <div className={`w-4 h-4 rounded-full ${instructor.clockedIn ? 'bg-green-400' : 'bg-gray-400'}`} />
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Balance:</span>
          <span className="text-2xl font-bold text-white">${balance}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Total Earnings:</span>
          <span className="text-lg font-bold text-green-400">${totalEarnings}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Jumps:</span>
          <span className="text-sm font-semibold text-slate-300">{jumpCount}</span>
        </div>
        
        {todayEarnings > 0 && (
          <div className="bg-green-500/20 rounded-lg px-3 py-2 mt-2">
            <span className="text-sm font-semibold text-green-300">Today: ${todayEarnings}</span>
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <button
          onClick={onAddJump}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
          ➕ Add Jump
        </button>
        
        {isAFFLocked && (
          <button
            onClick={onReleaseAFF}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            🔓 Release from AFF
          </button>
        )}
      </div>
    </div>
  )
}