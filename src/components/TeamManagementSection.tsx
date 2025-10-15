// src/components/TeamManagementSection.tsx
'use client'

import React, { useState } from 'react'
import { useInstructors } from '@/hooks/useDatabase'
import { db } from '@/services'
import { getWeekSchedule, getCurrentWeekRotation } from '@/lib/utils'
import type { Instructor, Team } from '@/types'

export function TeamManagementSection() {
  const { data: instructors } = useInstructors()
  const [loading, setLoading] = useState(false)
  
  const schedule = getWeekSchedule()
  const currentRotation = getCurrentWeekRotation()
  
  // Group instructors by team
  const teamRosters = {
    red: instructors.filter(i => !i.archived && i.team === 'red'),
    blue: instructors.filter(i => !i.archived && i.team === 'blue'),
    gold: instructors.filter(i => !i.archived && i.team === 'gold'),
    unassigned: instructors.filter(i => !i.archived && !i.team)
  }
  
  const handleTeamChange = async (instructorId: string, newTeam: Team | null) => {
    setLoading(true)
    try {
      await db.updateInstructor(instructorId, { team: newTeam || undefined })
    } catch (error) {
      console.error('Failed to update team:', error)
      alert('Failed to update team. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  const getRotationInfo = (team: Team) => {
    if (team === 'gold') {
      return {
        daysOff: 'None (Works Every Day)',
        color: 'text-yellow-300',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30'
      }
    }
    
    const hasMonTueOff = team === currentRotation
    
    return {
      daysOff: hasMonTueOff ? 'Mon/Tue OFF' : 'Wed/Thu OFF',
      color: team === 'red' ? 'text-red-300' : 'text-blue-300',
      bgColor: team === 'red' ? 'bg-red-500/10' : 'bg-blue-500/10',
      borderColor: team === 'red' ? 'border-red-500/30' : 'border-blue-500/30',
      workingToday: !hasMonTueOff
    }
  }
  
  const getDayName = (offset: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const today = new Date()
    const targetDay = new Date(today)
    targetDay.setDate(today.getDate() + offset)
    return days[targetDay.getDay()]
  }
  
  return (
    <div className="space-y-6">
      {/* Current Week Schedule */}
      <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">
          📅 This Week's Rotation
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`${getRotationInfo('red').bgColor} ${getRotationInfo('red').borderColor} border-2 rounded-lg p-4 text-center`}>
            <div className="text-3xl mb-2">🔴</div>
            <div className="text-xl font-bold text-white mb-1">Red Team</div>
            <div className={`text-lg ${getRotationInfo('red').color} font-semibold`}>
              {schedule.redTeam}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              {teamRosters.red.length} instructors
            </div>
          </div>
          
          <div className={`${getRotationInfo('blue').bgColor} ${getRotationInfo('blue').borderColor} border-2 rounded-lg p-4 text-center`}>
            <div className="text-3xl mb-2">🔵</div>
            <div className="text-xl font-bold text-white mb-1">Blue Team</div>
            <div className={`text-lg ${getRotationInfo('blue').color} font-semibold`}>
              {schedule.blueTeam}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              {teamRosters.blue.length} instructors
            </div>
          </div>
          
          <div className={`${getRotationInfo('gold').bgColor} ${getRotationInfo('gold').borderColor} border-2 rounded-lg p-4 text-center`}>
            <div className="text-3xl mb-2">🟡</div>
            <div className="text-xl font-bold text-white mb-1">Gold Team</div>
            <div className={`text-lg ${getRotationInfo('gold').color} font-semibold`}>
              {getRotationInfo('gold').daysOff}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              {teamRosters.gold.length} instructors
            </div>
          </div>
        </div>
        
        {/* Weekly Calendar Preview */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-white font-semibold mb-3 text-center">Week at a Glance</h3>
          <div className="grid grid-cols-7 gap-2 text-center text-sm">
            {[0, 1, 2, 3, 4, 5, 6].map(offset => {
              const dayName = getDayName(offset)
              const isWeekend = dayName === 'Friday' || dayName === 'Saturday' || dayName === 'Sunday'
              const isMonTue = dayName === 'Monday' || dayName === 'Tuesday'
              const isWedThu = dayName === 'Wednesday' || dayName === 'Thursday'
              
              return (
                <div key={offset} className={`p-2 rounded ${isWeekend ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-700/50'}`}>
                  <div className="text-xs text-slate-400 mb-1">{dayName.slice(0, 3)}</div>
                  {isWeekend ? (
                    <div className="text-xs text-green-300 font-semibold">All Teams</div>
                  ) : isMonTue ? (
                    <>
                      <div className="text-xs text-red-300">{currentRotation === 'red' ? 'Red OFF' : 'Red'}</div>
                      <div className="text-xs text-blue-300">{currentRotation === 'blue' ? 'Blue OFF' : 'Blue'}</div>
                      <div className="text-xs text-yellow-300">Gold</div>
                    </>
                  ) : isWedThu ? (
                    <>
                      <div className="text-xs text-red-300">{currentRotation === 'red' ? 'Red' : 'Red OFF'}</div>
                      <div className="text-xs text-blue-300">{currentRotation === 'blue' ? 'Blue' : 'Blue OFF'}</div>
                      <div className="text-xs text-yellow-300">Gold</div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-300">All Teams</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Team Rosters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Red Team */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-red-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              🔴 Red Team <span className="text-sm text-slate-400">({teamRosters.red.length})</span>
            </h3>
            <div className="text-sm text-red-300 font-semibold">{schedule.redTeam}</div>
          </div>
          
          {teamRosters.red.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No instructors assigned</p>
          ) : (
            <div className="space-y-2">
              {teamRosters.red.map(instructor => (
                <InstructorTeamCard
                  key={instructor.id}
                  instructor={instructor}
                  onTeamChange={handleTeamChange}
                  loading={loading}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Blue Team */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-blue-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              🔵 Blue Team <span className="text-sm text-slate-400">({teamRosters.blue.length})</span>
            </h3>
            <div className="text-sm text-blue-300 font-semibold">{schedule.blueTeam}</div>
          </div>
          
          {teamRosters.blue.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No instructors assigned</p>
          ) : (
            <div className="space-y-2">
              {teamRosters.blue.map(instructor => (
                <InstructorTeamCard
                  key={instructor.id}
                  instructor={instructor}
                  onTeamChange={handleTeamChange}
                  loading={loading}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Gold Team */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-yellow-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              🟡 Gold Team <span className="text-sm text-slate-400">({teamRosters.gold.length})</span>
            </h3>
            <div className="text-sm text-yellow-300 font-semibold">Works Every Day</div>
          </div>
          
          {teamRosters.gold.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No instructors assigned</p>
          ) : (
            <div className="space-y-2">
              {teamRosters.gold.map(instructor => (
                <InstructorTeamCard
                  key={instructor.id}
                  instructor={instructor}
                  onTeamChange={handleTeamChange}
                  loading={loading}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Unassigned */}
        {teamRosters.unassigned.length > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                ⚠️ Unassigned <span className="text-sm text-slate-400">({teamRosters.unassigned.length})</span>
              </h3>
              <div className="text-sm text-red-400 font-semibold">No Team</div>
            </div>
            
            <div className="space-y-2">
              {teamRosters.unassigned.map(instructor => (
                <InstructorTeamCard
                  key={instructor.id}
                  instructor={instructor}
                  onTeamChange={handleTeamChange}
                  loading={loading}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Help Text */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-blue-300 font-semibold mb-2">📚 How Teams Work</h4>
        <div className="text-sm text-slate-300 space-y-1">
          <p>• <strong>Red & Blue Teams:</strong> Rotate Mon/Tue and Wed/Thu off days every week</p>
          <p>• <strong>Gold Team:</strong> Works every day (no rotation)</p>
          <p>• <strong>Off-Day Bonus:</strong> Instructors working their off day get 1.2x balance multiplier</p>
          <p>• <strong>Weekends:</strong> Everyone works Fri/Sat/Sun (no days off)</p>
        </div>
      </div>
    </div>
  )
}

// Helper component for instructor cards with team dropdown
interface InstructorTeamCardProps {
  instructor: Instructor
  onTeamChange: (instructorId: string, newTeam: Team | null) => Promise<void>
  loading: boolean
}

function InstructorTeamCard({ instructor, onTeamChange, loading }: InstructorTeamCardProps) {
  const [isChanging, setIsChanging] = useState(false)
  
  const handleChange = async (newTeam: string) => {
    setIsChanging(true)
    try {
      await onTeamChange(instructor.id, newTeam === 'none' ? null : newTeam as Team)
    } finally {
      setIsChanging(false)
    }
  }
  
  return (
    <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${instructor.clockedIn ? 'bg-green-400' : 'bg-slate-500'}`} />
        <div>
          <div className="text-white font-semibold">{instructor.name}</div>
          <div className="flex gap-1 text-xs">
            {instructor.canTandem && <span className="text-blue-300">T</span>}
            {instructor.canAFF && <span className="text-purple-300">A</span>}
            {instructor.canVideo && <span className="text-green-300">V</span>}
          </div>
        </div>
      </div>
      
      <select
        value={instructor.team || 'none'}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading || isChanging}
        className="px-3 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        <option value="none">⚠️ No Team</option>
        <option value="red">🔴 Red</option>
        <option value="blue">🔵 Blue</option>
        <option value="gold">🟡 Gold</option>
      </select>
    </div>
  )
}