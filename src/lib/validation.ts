// src/lib/validation.ts
// Comprehensive input validation utilities

export interface ValidationResult {
  isValid: boolean
  error?: string
}

// ==================== WEIGHT VALIDATION ====================

/**
 * Validate student weight
 * Must be between 50-350 lbs (reasonable skydiving range)
 */
export function validateStudentWeight(weight: number): ValidationResult {
  if (!weight || typeof weight !== 'number') {
    return { isValid: false, error: 'Weight is required' }
  }

  if (weight < 50) {
    return { isValid: false, error: 'Weight must be at least 50 lbs' }
  }

  if (weight > 350) {
    return { isValid: false, error: 'Weight cannot exceed 350 lbs' }
  }

  if (!Number.isInteger(weight)) {
    return { isValid: false, error: 'Weight must be a whole number' }
  }

  return { isValid: true }
}

/**
 * Validate instructor weight limit
 * Must be positive and reasonable (100-500 lbs)
 */
export function validateWeightLimit(limit: number | undefined, type: 'tandem' | 'aff'): ValidationResult {
  if (limit === undefined || limit === null) {
    return { isValid: true } // Optional field
  }

  if (typeof limit !== 'number') {
    return { isValid: false, error: 'Weight limit must be a number' }
  }

  if (limit <= 0) {
    return { isValid: false, error: 'Weight limit must be positive' }
  }

  if (limit < 100) {
    return { isValid: false, error: 'Weight limit seems too low (minimum 100 lbs)' }
  }

  if (limit > 500) {
    return { isValid: false, error: 'Weight limit seems too high (maximum 500 lbs)' }
  }

  // Type-specific validation
  if (type === 'tandem' && limit < 200) {
    return { isValid: false, error: 'Tandem weight limit should be at least 200 lbs' }
  }

  return { isValid: true }
}

/**
 * Validate weight tax (0-5 increments)
 */
export function validateWeightTax(tax: number): ValidationResult {
  if (tax === undefined || tax === null) {
    return { isValid: true } // Optional
  }

  if (!Number.isInteger(tax)) {
    return { isValid: false, error: 'Weight tax must be a whole number' }
  }

  if (tax < 0) {
    return { isValid: false, error: 'Weight tax cannot be negative' }
  }

  if (tax > 5) {
    return { isValid: false, error: 'Weight tax cannot exceed 5' }
  }

  return { isValid: true }
}

// ==================== DATE VALIDATION ====================

/**
 * Validate period dates
 * End date must be after start date
 */
export function validatePeriodDates(startDate: Date, endDate: Date): ValidationResult {
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    return { isValid: false, error: 'Invalid start date' }
  }

  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    return { isValid: false, error: 'Invalid end date' }
  }

  if (endDate <= startDate) {
    return { isValid: false, error: 'End date must be after start date' }
  }

  // Check if period is unreasonably long (more than 2 years)
  const twoYears = 2 * 365 * 24 * 60 * 60 * 1000
  if (endDate.getTime() - startDate.getTime() > twoYears) {
    return { isValid: false, error: 'Period cannot exceed 2 years' }
  }

  return { isValid: true }
}

/**
 * Validate assignment timestamp
 * Cannot be in the future
 */
export function validateAssignmentTimestamp(timestamp: Date | string): ValidationResult {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date/time' }
  }

  const now = new Date()
  if (date > now) {
    return { isValid: false, error: 'Assignment time cannot be in the future' }
  }

  // Check if unreasonably old (more than 1 year)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  if (date < oneYearAgo) {
    return { isValid: false, error: 'Assignment date seems too far in the past (over 1 year)' }
  }

  return { isValid: true }
}

// ==================== STRING VALIDATION ====================

/**
 * Validate name (not empty, reasonable length)
 */
export function validateName(name: string, fieldName: string = 'Name'): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: `${fieldName} is required` }
  }

  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return { isValid: false, error: `${fieldName} cannot be empty` }
  }

  if (trimmed.length < 2) {
    return { isValid: false, error: `${fieldName} must be at least 2 characters` }
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: `${fieldName} cannot exceed 100 characters` }
  }

  // Check for suspicious characters (basic SQL injection prevention)
  if (/[<>{}[\]\\]/.test(trimmed)) {
    return { isValid: false, error: `${fieldName} contains invalid characters` }
  }

  return { isValid: true }
}

/**
 * Validate student ID
 */
export function validateStudentId(id: string): ValidationResult {
  if (!id || typeof id !== 'string') {
    return { isValid: false, error: 'Student ID is required' }
  }

  const trimmed = id.trim()
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Student ID cannot be empty' }
  }

  if (trimmed.length > 50) {
    return { isValid: false, error: 'Student ID too long (max 50 characters)' }
  }

  // Alphanumeric and basic punctuation only
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
    return { isValid: false, error: 'Student ID contains invalid characters' }
  }

  return { isValid: true }
}

// ==================== CAPACITY VALIDATION ====================

/**
 * Validate load capacity
 */
export function validateLoadCapacity(capacity: number): ValidationResult {
  if (!capacity || typeof capacity !== 'number') {
    return { isValid: false, error: 'Capacity is required' }
  }

  if (!Number.isInteger(capacity)) {
    return { isValid: false, error: 'Capacity must be a whole number' }
  }

  if (capacity < 1) {
    return { isValid: false, error: 'Capacity must be at least 1' }
  }

  if (capacity > 50) {
    return { isValid: false, error: 'Capacity cannot exceed 50' }
  }

  return { isValid: true }
}

// ==================== TIMING VALIDATION ====================

/**
 * Validate minutes between loads
 */
export function validateMinutesBetweenLoads(minutes: number): ValidationResult {
  if (typeof minutes !== 'number') {
    return { isValid: false, error: 'Minutes must be a number' }
  }

  if (minutes < 5) {
    return { isValid: false, error: 'Minimum 5 minutes between loads' }
  }

  if (minutes > 120) {
    return { isValid: false, error: 'Maximum 120 minutes between loads' }
  }

  return { isValid: true }
}

/**
 * Validate instructor cycle time
 */
export function validateInstructorCycleTime(minutes: number): ValidationResult {
  if (typeof minutes !== 'number') {
    return { isValid: false, error: 'Cycle time must be a number' }
  }

  if (minutes < 10) {
    return { isValid: false, error: 'Minimum 10 minutes cycle time' }
  }

  if (minutes > 180) {
    return { isValid: false, error: 'Maximum 180 minutes cycle time' }
  }

  return { isValid: true }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  const firstError = results.find(r => !r.isValid)
  if (firstError) {
    return firstError
  }
  return { isValid: true }
}

/**
 * Validate and sanitize number input
 */
export function sanitizeNumberInput(value: string | number): number | null {
  if (typeof value === 'number') {
    return isNaN(value) ? null : value
  }

  if (typeof value === 'string') {
    const num = parseFloat(value.trim())
    return isNaN(num) ? null : num
  }

  return null
}
