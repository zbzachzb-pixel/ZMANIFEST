// src/hooks/useLoadCountdown.ts
import type { Load } from '@/types'

interface CountdownState {
  timeRemaining: number | null  // Seconds remaining
  status: 'waiting' | 'countdown' | 'ready' | 'departed'
  displayText: string
}

// This is now a REGULAR FUNCTION, not a hook
export function getLoadCountdown(
  load: Load,
  allLoads: Load[],
  minutesBetweenLoads: number,
  currentTime: number = Date.now()
): CountdownState {
  // Load is departed or completed
  if (load.status === 'departed' || load.status === 'completed') {
    return { timeRemaining: null, status: 'departed', displayText: '✅ Departed' }
  }
  
  // Load is still building
  if (load.status === 'building') {
    return { timeRemaining: null, status: 'waiting', displayText: '🔨 Building' }
  }
  
  // Find previous load
  const previousLoad = allLoads.find(l => l.position === load.position - 1)
  
  // Load is Ready but waiting for previous load to depart
  if (load.status === 'ready' && previousLoad && previousLoad.status !== 'departed') {
    return { 
      timeRemaining: null, 
      status: 'waiting', 
      displayText: `⏸️ Waiting for Load #${previousLoad.position}` 
    }
  }
  
  // Calculate countdown based on load's countdownStartTime
  if (load.countdownStartTime && load.status === 'ready') {
    const startTime = new Date(load.countdownStartTime).getTime()
    const targetTime = startTime + (minutesBetweenLoads * 60 * 1000)
    const remaining = Math.max(0, Math.floor((targetTime - currentTime) / 1000))
    
    if (remaining === 0) {
      return { timeRemaining: 0, status: 'ready', displayText: '✅ Clear to Depart' }
    }
    
    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    return { 
      timeRemaining: remaining, 
      status: 'countdown', 
      displayText: `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}` 
    }
  }
  
  // Default ready state
  if (load.status === 'ready') {
    return { timeRemaining: null, status: 'ready', displayText: '✅ Ready' }
  }
  
  return { timeRemaining: null, status: 'waiting', displayText: '⏸️ Waiting' }
}