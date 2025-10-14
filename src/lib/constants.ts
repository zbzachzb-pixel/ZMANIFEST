// src/lib/constants.ts
// 🎯 SINGLE SOURCE OF TRUTH FOR ALL PAY RATES

/**
 * Pay rates for skydiving assignments
 * These are used for balance calculations (rotation fairness)
 * NOT the same as actual paychecks in some cases
 */
export const PAY_RATES = {
  // Tandem jump rates
  TANDEM_BASE: 40,           // Base tandem jump pay
  TANDEM_WEIGHT_TAX: 20,     // Per weight tax increment
  TANDEM_HANDCAM: 30,        // Handcam video fee
  
  // AFF jump rates
  AFF_LOWER: 55,             // AFF levels 1-4
  AFF_UPPER: 45,             // AFF levels 5-7
  
  // Video rates
  VIDEO_INSTRUCTOR: 45,      // Outside video instructor fee
  
  // Special multipliers
  OFF_DAY_MULTIPLIER: 1.2,   // 20% bonus for working on scheduled off day (balance only)
} as const

/**
 * Load capacity settings
 */
export const LOAD_SETTINGS = {
  DEFAULT_CAPACITY: 18,      // Default airplane capacity
  SEATS_PER_TANDEM: 2,       // Tandem student + instructor
  SEATS_PER_AFF: 2,          // AFF student + instructor  
  SEATS_PER_VIDEO: 1,        // Additional seat for video instructor
} as const

/**
 * Scheduling settings
 */
export const SCHEDULE_SETTINGS = {
  MINUTES_BETWEEN_LOADS: 20,     // Default time between load departures
  INSTRUCTOR_CYCLE_TIME: 40,     // Time from briefing to available again
  INSTRUCTOR_TURNAROUND_LOADS: 2 // Loads needed between assignments for same instructor
} as const