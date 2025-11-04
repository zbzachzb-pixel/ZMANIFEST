// src/lib/validation.test.ts
// Comprehensive unit tests for validation utilities

import { describe, it, expect } from 'vitest'
import {
  validateStudentWeight,
  validateWeightLimit,
  validateWeightTax,
  validatePeriodDates,
  validateAssignmentTimestamp,
  validateName,
  validateStudentId,
  validateEmail,
  validatePhone,
  validateLoadCapacity,
  validateMinutesBetweenLoads,
  validateInstructorCycleTime,
  combineValidations,
  sanitizeNumberInput
} from './validation'

describe('validateStudentWeight', () => {
  it('should accept valid weights', () => {
    expect(validateStudentWeight(150)).toEqual({ isValid: true })
    expect(validateStudentWeight(50)).toEqual({ isValid: true })
    expect(validateStudentWeight(350)).toEqual({ isValid: true })
    expect(validateStudentWeight(200)).toEqual({ isValid: true })
  })

  it('should reject weight below minimum', () => {
    const result = validateStudentWeight(40)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('at least 50')
  })

  it('should reject weight above maximum', () => {
    const result = validateStudentWeight(400)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cannot exceed 350')
  })

  it('should reject non-integer weights', () => {
    const result = validateStudentWeight(150.5)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('whole number')
  })

  it('should reject missing weight', () => {
    const result = validateStudentWeight(null as any)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('required')
  })
})

describe('validateWeightLimit', () => {
  it('should accept valid tandem weight limits', () => {
    expect(validateWeightLimit(250, 'tandem')).toEqual({ isValid: true })
    expect(validateWeightLimit(300, 'tandem')).toEqual({ isValid: true })
  })

  it('should accept valid AFF weight limits', () => {
    expect(validateWeightLimit(150, 'aff')).toEqual({ isValid: true })
    expect(validateWeightLimit(200, 'aff')).toEqual({ isValid: true })
  })

  it('should accept undefined (optional field)', () => {
    expect(validateWeightLimit(undefined, 'tandem')).toEqual({ isValid: true })
    expect(validateWeightLimit(undefined, 'aff')).toEqual({ isValid: true })
  })

  it('should reject tandem limit below 200', () => {
    const result = validateWeightLimit(150, 'tandem')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('at least 200')
  })

  it('should reject limits above 500', () => {
    const result = validateWeightLimit(600, 'tandem')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('500')
  })
})

describe('validateWeightTax', () => {
  it('should accept valid weight tax', () => {
    expect(validateWeightTax(0)).toEqual({ isValid: true })
    expect(validateWeightTax(3)).toEqual({ isValid: true })
    expect(validateWeightTax(5)).toEqual({ isValid: true })
  })

  it('should accept undefined (optional)', () => {
    expect(validateWeightTax(undefined as any)).toEqual({ isValid: true })
  })

  it('should reject negative values', () => {
    const result = validateWeightTax(-1)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cannot be negative')
  })

  it('should reject values above 5', () => {
    const result = validateWeightTax(6)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cannot exceed 5')
  })

  it('should reject non-integers', () => {
    const result = validateWeightTax(2.5)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('whole number')
  })
})

describe('validatePeriodDates', () => {
  it('should accept valid date ranges', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-12-31')
    expect(validatePeriodDates(start, end)).toEqual({ isValid: true })
  })

  it('should reject end date before start date', () => {
    const start = new Date('2024-12-31')
    const end = new Date('2024-01-01')
    const result = validatePeriodDates(start, end)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('after start date')
  })

  it('should reject end date equal to start date', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-01-01')
    const result = validatePeriodDates(start, end)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('after start date')
  })

  it('should reject periods longer than 2 years', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2027-01-01')
    const result = validatePeriodDates(start, end)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cannot exceed 2 years')
  })

  it('should reject invalid dates', () => {
    const result = validatePeriodDates(new Date('invalid'), new Date('2024-01-01'))
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Invalid')
  })
})

describe('validateAssignmentTimestamp', () => {
  it('should accept valid recent timestamps', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    expect(validateAssignmentTimestamp(yesterday)).toEqual({ isValid: true })
    expect(validateAssignmentTimestamp(yesterday.toISOString())).toEqual({ isValid: true })
  })

  it('should reject future timestamps', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const result = validateAssignmentTimestamp(future)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('future')
  })

  it('should reject timestamps older than 1 year', () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) // ~400 days ago
    const result = validateAssignmentTimestamp(old)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('too far in the past')
  })
})

describe('validateName', () => {
  it('should accept valid names', () => {
    expect(validateName('John Doe')).toEqual({ isValid: true })
    expect(validateName('Jane')).toEqual({ isValid: true })
    expect(validateName("O'Brien")).toEqual({ isValid: true })
    expect(validateName('Mary-Jane')).toEqual({ isValid: true })
  })

  it('should reject empty names', () => {
    const result = validateName('')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('required')
  })

  it('should reject names that are too short', () => {
    const result = validateName('A')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('at least 2 characters')
  })

  it('should reject names that are too long', () => {
    const longName = 'A'.repeat(101)
    const result = validateName(longName)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cannot exceed 100')
  })

  it('should reject names with invalid characters', () => {
    const result = validateName('John<script>')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('invalid characters')
  })

  it('should use custom field name in error messages', () => {
    const result = validateName('', 'Student name')
    expect(result.error).toContain('Student name')
  })
})

describe('validateStudentId', () => {
  it('should accept valid student IDs', () => {
    expect(validateStudentId('STU123')).toEqual({ isValid: true })
    expect(validateStudentId('M-456')).toEqual({ isValid: true })
    expect(validateStudentId('student_789')).toEqual({ isValid: true })
    expect(validateStudentId('ID 001')).toEqual({ isValid: true })
  })

  it('should reject empty student IDs', () => {
    const result = validateStudentId('')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('required')
  })

  it('should reject student IDs that are too long', () => {
    const longId = 'A'.repeat(51)
    const result = validateStudentId(longId)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('too long')
  })

  it('should reject student IDs with invalid characters', () => {
    const result = validateStudentId('STU@123')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('invalid characters')
  })
})

describe('validateEmail', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('test@example.com')).toEqual({ isValid: true })
    expect(validateEmail('user.name+tag@example.co.uk')).toEqual({ isValid: true })
  })

  it('should accept empty email (optional field)', () => {
    expect(validateEmail('')).toEqual({ isValid: true })
    expect(validateEmail('   ')).toEqual({ isValid: true })
  })

  it('should reject invalid email formats', () => {
    const result1 = validateEmail('not-an-email')
    expect(result1.isValid).toBe(false)
    expect(result1.error).toContain('valid email')

    const result2 = validateEmail('missing@domain')
    expect(result2.isValid).toBe(false)

    const result3 = validateEmail('@example.com')
    expect(result3.isValid).toBe(false)
  })
})

describe('validatePhone', () => {
  it('should accept valid phone numbers', () => {
    expect(validatePhone('555-123-4567')).toEqual({ isValid: true })
    expect(validatePhone('(555) 123-4567')).toEqual({ isValid: true })
    expect(validatePhone('5551234567')).toEqual({ isValid: true })
    expect(validatePhone('+1-555-123-4567')).toEqual({ isValid: true })
  })

  it('should accept empty phone (optional field)', () => {
    expect(validatePhone('')).toEqual({ isValid: true })
  })

  it('should reject phone numbers with too few digits', () => {
    const result = validatePhone('555-1234') // Only 7 digits
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('10-15 digits')
  })

  it('should reject phone numbers with too many digits', () => {
    const result = validatePhone('1234567890123456') // 16 digits
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('10-15 digits')
  })
})

describe('validateLoadCapacity', () => {
  it('should accept valid capacities', () => {
    expect(validateLoadCapacity(18)).toEqual({ isValid: true })
    expect(validateLoadCapacity(1)).toEqual({ isValid: true })
    expect(validateLoadCapacity(50)).toEqual({ isValid: true })
  })

  it('should reject capacity below 1', () => {
    const result = validateLoadCapacity(0)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('required')
  })

  it('should reject capacity above 50', () => {
    const result = validateLoadCapacity(51)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cannot exceed 50')
  })

  it('should reject non-integer capacity', () => {
    const result = validateLoadCapacity(18.5)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('whole number')
  })
})

describe('validateMinutesBetweenLoads', () => {
  it('should accept valid time intervals', () => {
    expect(validateMinutesBetweenLoads(20)).toEqual({ isValid: true })
    expect(validateMinutesBetweenLoads(5)).toEqual({ isValid: true })
    expect(validateMinutesBetweenLoads(120)).toEqual({ isValid: true })
  })

  it('should reject values below 5 minutes', () => {
    const result = validateMinutesBetweenLoads(4)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Minimum 5 minutes')
  })

  it('should reject values above 120 minutes', () => {
    const result = validateMinutesBetweenLoads(121)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Maximum 120 minutes')
  })
})

describe('validateInstructorCycleTime', () => {
  it('should accept valid cycle times', () => {
    expect(validateInstructorCycleTime(40)).toEqual({ isValid: true })
    expect(validateInstructorCycleTime(10)).toEqual({ isValid: true })
    expect(validateInstructorCycleTime(180)).toEqual({ isValid: true })
  })

  it('should reject values below 10 minutes', () => {
    const result = validateInstructorCycleTime(9)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Minimum 10 minutes')
  })

  it('should reject values above 180 minutes', () => {
    const result = validateInstructorCycleTime(181)
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Maximum 180 minutes')
  })
})

describe('combineValidations', () => {
  it('should return valid when all validations pass', () => {
    const result = combineValidations(
      { isValid: true },
      { isValid: true },
      { isValid: true }
    )
    expect(result.isValid).toBe(true)
  })

  it('should return first error when any validation fails', () => {
    const result = combineValidations(
      { isValid: true },
      { isValid: false, error: 'First error' },
      { isValid: false, error: 'Second error' }
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('First error')
  })

  it('should handle empty array', () => {
    const result = combineValidations()
    expect(result.isValid).toBe(true)
  })
})

describe('sanitizeNumberInput', () => {
  it('should handle valid numbers', () => {
    expect(sanitizeNumberInput(150)).toBe(150)
    expect(sanitizeNumberInput(0)).toBe(0)
    expect(sanitizeNumberInput(-50)).toBe(-50)
  })

  it('should parse valid number strings', () => {
    expect(sanitizeNumberInput('150')).toBe(150)
    expect(sanitizeNumberInput('  150  ')).toBe(150)
    expect(sanitizeNumberInput('150.5')).toBe(150.5)
  })

  it('should return null for invalid inputs', () => {
    expect(sanitizeNumberInput('not a number')).toBe(null)
    expect(sanitizeNumberInput('')).toBe(null)
    expect(sanitizeNumberInput(NaN)).toBe(null)
  })

  it('should handle edge cases', () => {
    expect(sanitizeNumberInput(null as any)).toBe(null)
    expect(sanitizeNumberInput(undefined as any)).toBe(null)
  })
})
