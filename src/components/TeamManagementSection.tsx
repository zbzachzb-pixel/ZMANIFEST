// src/components/TeamManagementSection.tsx
'use client'

import React, { useState } from 'react'
import { useInstructors, useSettings } from '@/hooks/useDatabase'
import { db } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type { Instructor, Team } from '@/types'

export function TeamManagementSection() {
  const { data: instructors } = useInstructors()
  const { data: settings } = useSettings()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  // ✅ BUG FIX #1: Use manual team rotation setting instead of automatic week calculation
  const teamOff = settings?.teamRotation || 'blue'
  const schedule = {
    redTeam: teamOff === 'red' ? 'Monday & Tuesday OFF' : 'Working All Week',
    blueTeam: teamOff === 'blue' ? 'Monday & Tuesday OFF' : 'Working All Week'
  }

  // Toggle which team has days off
  const handleToggleRotation = async () => {
    const newTeamOff = teamOff === 'blue' ? 'red' : 'blue'
    try {
      await db.updateSettings({ teamRotation: newTeamOff })
      toast.success(`Rotation updated`, `${newTeamOff === 'red' ? 'Red' : 'Blue'} team now has Mon/Tue off`)
    } catch (error) {
      console.error('Failed to update rotation:', error)
      toast.error('Failed to update rotation', 'Please try again.')
    }
  }

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
      toast.error('Failed to update team', 'Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  // ✅ ADD THIS FUNCTION
  const handleClockToggle = async (instructor: Instructor) => {
    try {
      const newStatus = !instructor.clockedIn
      
      // Update instructor status
      await db.updateInstructor(instructor.id, {
        clockedIn: newStatus
      })
      
      // Log clock event
      await db.logClockEvent(
        instructor.id,
        instructor.name,
        newStatus ? 'in' : 'out'
      )
    } catch (error) {
      console.error('Failed to toggle clock:', error)
      toast.error('Failed to toggle clock', 'Please try again.')
    }
  }
  
  return (
    <div className="space-y-6">
      {/* ✅ BUG FIX #1: Team Rotation Toggle */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">📅 Weekly Rotation Schedule</h3>
            <p className="text-sm text-slate-400">
              {teamOff === 'red' ? '🔴 Red' : '🔵 Blue'} team has Monday & Tuesday off this week
            </p>
          </div>
          <button
            onClick={handleToggleRotation}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            🔄 Toggle Rotation
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className={`p-3 rounded-lg ${teamOff === 'red' ? 'bg-red-500/20 border border-red-500/30' : 'bg-slate-700/50'}`}>
            <div className="font-semibold text-white">🔴 Red Team</div>
            <div className={teamOff === 'red' ? 'text-red-300' : 'text-slate-400'}>{schedule.redTeam}</div>
          </div>
          <div className={`p-3 rounded-lg ${teamOff === 'blue' ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-slate-700/50'}`}>
            <div className="font-semibold text-white">🔵 Blue Team</div>
            <div className={teamOff === 'blue' ? 'text-blue-300' : 'text-slate-400'}>{schedule.blueTeam}</div>
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
                  onClockToggle={handleClockToggle} 
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
                  onClockToggle={handleClockToggle} 
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
            <div className="text-sm text-yellow-300 font-semibold">As-Needed</div>
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
                  onClockToggle={handleClockToggle}  
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
                  onClockToggle={handleClockToggle} 
                  loading={loading}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Help Text stays the same */}
    </div>
  )
}

// ✅ UPDATE InstructorTeamCard component
interface InstructorTeamCardProps {
  instructor: Instructor
  onTeamChange: (instructorId: string, newTeam: Team | null) => Promise<void>
  onClockToggle: (instructor: Instructor) => Promise<void>  // ✅ ADD THIS
  loading: boolean
}

function InstructorTeamCard({ instructor, onTeamChange, onClockToggle, loading }: InstructorTeamCardProps) {
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
      
      <div className="flex items-center gap-2">
        {/* ✅ ADD CLOCK IN/OUT BUTTON */}
        <button
          onClick={() => onClockToggle(instructor)}
          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
            instructor.clockedIn
              ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
          }`}
        >
          {instructor.clockedIn ? 'Clock Out' : 'Clock In'}
        </button>
        
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
    </div>
  )
}