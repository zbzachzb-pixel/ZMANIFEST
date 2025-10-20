// src/hooks/useLoadCountdown.ts - FIXED VERSION
// ✅ Timers cascade from the FIRST ready load (lowest position)
// ✅ Shows "WAITING" if first ready load doesn't have active timer yet

import { useState, useEffect } from 'react'
import type { Load, LoadSchedulingSettings } from '@/types'

interface CountdownState {
  countdown: number | null  // Seconds remaining
  formattedTime: string
  isReadyToDepart: boolean
  displayText: string
}

// ==================== REGULAR FUNCTION FOR COUNTDOWN STATE ====================

export function getLoadCountdown(
  load: Load,
  allLoads: Load[],
  minutesBetweenLoads: number,
  currentTime: number = Date.now()
): CountdownState {
  // Load is departed or completed
  if (load.status === 'departed' || load.status === 'completed') {
    return {
      countdown: null,
      formattedTime: '',
      isReadyToDepart: false,
      displayText: load.status === 'departed' ? '🛫 Departed' : '✅ Completed'
    }
  }
  
  // Load is still building
  if (load.status === 'building') {
    return {
      countdown: null,
      formattedTime: '',
      isReadyToDepart: false,
      displayText: '🔨 Building'
    }
  }
  
  // For ready loads, find the FIRST ready load (lowest position, not departed/completed)
  if (load.status === 'ready') {
    // Check if there are any loads with LOWER position that are still building
    const loadsBeforeThis = allLoads
      .filter(l => (l.position || 0) < (load.position || 0))
      .filter(l => l.status !== 'departed' && l.status !== 'completed')
    
    const hasUnreadyLoadsBefore = loadsBeforeThis.some(l => l.status === 'building')
    
    if (hasUnreadyLoadsBefore) {
      // There are building loads before this one - show waiting message
      const firstBuildingLoad = loadsBeforeThis.find(l => l.status === 'building')
      return {
        countdown: null,
        formattedTime: '',
        isReadyToDepart: false,
        displayText: `⏸️ Waiting on Load #${firstBuildingLoad?.position}`
      }
    }
    
    // No building loads before this one - proceed with normal timer logic
    // Find all ready loads that are before or at this load's position
    const readyLoads = allLoads
      .filter(l => l.status === 'ready')
      .sort((a, b) => (a.position || 0) - (b.position || 0))
    
    // Find the first ready load
    const firstReadyLoad = readyLoads[0]
    
    // If this IS the first ready load
    if (firstReadyLoad && firstReadyLoad.id === load.id) {
      // Check if it has a countdown started
      if (load.countdownStartTime) {
        const startTime = new Date(load.countdownStartTime).getTime()
        const targetTime = startTime + (minutesBetweenLoads * 60 * 1000)
        const remaining = Math.max(0, Math.floor((targetTime - currentTime) / 1000))
        
        if (remaining === 0) {
          return {
            countdown: 0,
            formattedTime: '0:00',
            isReadyToDepart: true,
            displayText: '✅ Clear to Depart'
          }
        }
        
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60
        const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`
        
        return {
          countdown: remaining,
          formattedTime: formatted,
          isReadyToDepart: false,
          displayText: `⏱️ ${formatted}`
        }
      } else {
        // First ready load but no timer started yet
        return {
          countdown: null,
          formattedTime: '',
          isReadyToDepart: false,
          displayText: '✅ Ready'
        }
      }
    }
    
    // This is NOT the first ready load - check if first ready load has active timer
    if (firstReadyLoad && firstReadyLoad.countdownStartTime) {
      // Calculate this load's timer based on first ready load
      if (load.countdownStartTime) {
        const startTime = new Date(load.countdownStartTime).getTime()
        const targetTime = startTime + (minutesBetweenLoads * 60 * 1000)
        const remaining = Math.max(0, Math.floor((targetTime - currentTime) / 1000))
        
        if (remaining === 0) {
          return {
            countdown: 0,
            formattedTime: '0:00',
            isReadyToDepart: true,
            displayText: '✅ Clear to Depart'
          }
        }
        
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60
        const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`
        
        return {
          countdown: remaining,
          formattedTime: formatted,
          isReadyToDepart: false,
          displayText: `⏱️ ${formatted}`
        }
      } else {
        // This load is ready but doesn't have timer - show waiting
        return {
          countdown: null,
          formattedTime: '',
          isReadyToDepart: false,
          displayText: `⏸️ Waiting on Load #${firstReadyLoad.position}`
        }
      }
    }
    
    // First ready load exists but has no active timer yet
    if (firstReadyLoad) {
      return {
        countdown: null,
        formattedTime: '',
        isReadyToDepart: false,
        displayText: `⏸️ Waiting on Load #${firstReadyLoad.position}`
      }
    }
    
    // No ready loads found (shouldn't happen)
    return {
      countdown: null,
      formattedTime: '',
      isReadyToDepart: false,
      displayText: '✅ Ready'
    }
  }
  
  return {
    countdown: null,
    formattedTime: '',
    isReadyToDepart: false,
    displayText: '⏸️ Waiting'
  }
}

// ==================== INSTRUCTOR AVAILABILITY ====================

/**
 * Calculate which load number an instructor will next be available for
 * Returns null if instructor is not currently assigned to any loads
 * Returns load number if they need to skip loads due to cycle time
 */
export function getInstructorNextAvailableLoad(
  instructorId: string,
  allLoads: Load[],
  instructorCycleTime: number = 40,
  minutesBetweenLoads: number = 20
): number | null {
  // Find all loads where instructor is assigned (not completed)
  const activeLoads = allLoads
    .filter(l => l.status !== 'completed')
    .sort((a, b) => (a.position || 0) - (b.position || 0))
  
  // Find the highest position load this instructor is on
  let highestLoadPosition: number | null = null
  
  for (const load of activeLoads) {
    const assignments = load.assignments || []
    const isOnThisLoad = assignments.some(
      a => a.instructorId === instructorId || a.videoInstructorId === instructorId
    )
    
    if (isOnThisLoad && (highestLoadPosition === null || load.position > highestLoadPosition)) {
      highestLoadPosition = load.position
    }
  }
  
  // If instructor is not on any loads, they're available for any load
  if (highestLoadPosition === null) {
    return null
  }
  
  // Calculate how many loads need to pass before instructor is available again
  // Formula: loadsToSkip = ceil(instructorCycleTime / minutesBetweenLoads)
  const loadsToSkip = Math.ceil(instructorCycleTime / minutesBetweenLoads)
  
  // They're available for the load at position: currentPosition + loadsToSkip
  return highestLoadPosition + loadsToSkip
}

/**
 * Check if an instructor is available for a specific load
 */
export function isInstructorAvailableForLoad(
  instructorId: string,
  targetLoadPosition: number,
  allLoads: Load[],
  instructorCycleTime: number = 40,
  minutesBetweenLoads: number = 20
): boolean {
  const nextAvailable = getInstructorNextAvailableLoad(
    instructorId,
    allLoads,
    instructorCycleTime,
    minutesBetweenLoads
  )
  
  // If null, they're available for any load
  if (nextAvailable === null) return true
  
  // Otherwise, check if target load is at or after their next available load
  return targetLoadPosition >= nextAvailable
}

// ==================== REACT HOOK FOR COMPONENT USE ====================

/**
 * Hook version that automatically updates every second
 * Use this in React components that need live countdown updates
 */
export function useLoadCountdown(
  load: Load,
  settings: LoadSchedulingSettings,
  allLoads?: Load[]
): CountdownState {
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Calculate countdown state
  return getLoadCountdown(
    load,
    allLoads || [load],
    settings.minutesBetweenLoads,
    currentTime
  )
}