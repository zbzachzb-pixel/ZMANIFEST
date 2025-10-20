// src/lib/settingsStorage.ts
// Centralized settings persistence layer
// Single source of truth for all app settings stored in localStorage

import type { LoadSchedulingSettings } from '@/types'

// ==================== TYPES ====================

export interface AutoAssignSettings {
  enabled: boolean
  delay: number
  skipRequests: boolean
  batchMode: boolean
  batchSize: number
}

// ==================== DEFAULT VALUES ====================

const DEFAULT_LOAD_SETTINGS: LoadSchedulingSettings = {
  minutesBetweenLoads: 20,
  instructorCycleTime: 40,
  defaultPlaneCapacity: 18
}

const DEFAULT_AUTO_ASSIGN_SETTINGS: AutoAssignSettings = {
  enabled: false,
  delay: 5,
  skipRequests: true,
  batchMode: false,
  batchSize: 3
}

// ==================== LOAD SCHEDULING SETTINGS ====================

/**
 * Gets load scheduling settings from localStorage
 * @returns Load scheduling settings or defaults if not found
 */
export function getLoadSettings(): LoadSchedulingSettings {
  if (typeof window === 'undefined') return DEFAULT_LOAD_SETTINGS

  try {
    const saved = localStorage.getItem('loadSchedulingSettings')
    if (!saved) return DEFAULT_LOAD_SETTINGS

    const parsed = JSON.parse(saved)
    return {
      minutesBetweenLoads: parsed.minutesBetweenLoads || DEFAULT_LOAD_SETTINGS.minutesBetweenLoads,
      instructorCycleTime: parsed.instructorCycleTime || DEFAULT_LOAD_SETTINGS.instructorCycleTime,
      defaultPlaneCapacity: parsed.defaultPlaneCapacity || DEFAULT_LOAD_SETTINGS.defaultPlaneCapacity
    }
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error)
    return DEFAULT_LOAD_SETTINGS
  }
}

/**
 * Saves load scheduling settings to localStorage
 * @param settings - Load scheduling settings to save
 */
export function saveLoadSettings(settings: LoadSchedulingSettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('loadSchedulingSettings', JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save load settings:', error)
    throw new Error('Failed to save settings')
  }
}

// ==================== AUTO-ASSIGN SETTINGS ====================

/**
 * Gets auto-assign settings from localStorage
 * @returns Auto-assign settings or defaults if not found
 */
export function getAutoAssignSettings(): AutoAssignSettings {
  if (typeof window === 'undefined') return DEFAULT_AUTO_ASSIGN_SETTINGS

  try {
    const saved = localStorage.getItem('autoAssignSettings')
    if (!saved) return DEFAULT_AUTO_ASSIGN_SETTINGS

    const parsed = JSON.parse(saved)
    return {
      enabled: parsed.enabled ?? DEFAULT_AUTO_ASSIGN_SETTINGS.enabled,
      delay: parsed.delay ?? DEFAULT_AUTO_ASSIGN_SETTINGS.delay,
      skipRequests: parsed.skipRequests ?? DEFAULT_AUTO_ASSIGN_SETTINGS.skipRequests,
      batchMode: parsed.batchMode ?? DEFAULT_AUTO_ASSIGN_SETTINGS.batchMode,
      batchSize: parsed.batchSize ?? DEFAULT_AUTO_ASSIGN_SETTINGS.batchSize
    }
  } catch (error) {
    console.error('Failed to load auto-assign settings from localStorage:', error)
    return DEFAULT_AUTO_ASSIGN_SETTINGS
  }
}

/**
 * Saves auto-assign settings to localStorage
 * @param settings - Auto-assign settings to save
 */
export function saveAutoAssignSettings(settings: AutoAssignSettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('autoAssignSettings', JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save auto-assign settings:', error)
    throw new Error('Failed to save settings')
  }
}

// ==================== DARK MODE ====================

/**
 * Gets dark mode preference from localStorage
 * @returns true if dark mode is enabled
 */
export function getDarkMode(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return localStorage.getItem('darkMode') === 'true'
  } catch (error) {
    console.error('Failed to load dark mode setting:', error)
    return false
  }
}

/**
 * Saves dark mode preference to localStorage
 * @param enabled - Whether dark mode is enabled
 */
export function saveDarkMode(enabled: boolean): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('darkMode', String(enabled))
  } catch (error) {
    console.error('Failed to save dark mode setting:', error)
    throw new Error('Failed to save dark mode setting')
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Clears all settings from localStorage (for testing/reset)
 */
export function clearAllSettings(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem('loadSchedulingSettings')
    localStorage.removeItem('autoAssignSettings')
    localStorage.removeItem('darkMode')
  } catch (error) {
    console.error('Failed to clear settings:', error)
  }
}

/**
 * Exports all settings as JSON (for backup)
 */
export function exportSettings(): string {
  return JSON.stringify({
    loadSettings: getLoadSettings(),
    autoAssignSettings: getAutoAssignSettings(),
    darkMode: getDarkMode()
  }, null, 2)
}

/**
 * Imports settings from JSON (for restore)
 * @param json - JSON string containing settings
 */
export function importSettings(json: string): void {
  try {
    const data = JSON.parse(json)
    if (data.loadSettings) saveLoadSettings(data.loadSettings)
    if (data.autoAssignSettings) saveAutoAssignSettings(data.autoAssignSettings)
    if (typeof data.darkMode === 'boolean') saveDarkMode(data.darkMode)
  } catch (error) {
    console.error('Failed to import settings:', error)
    throw new Error('Invalid settings format')
  }
}
