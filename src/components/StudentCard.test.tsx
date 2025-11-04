// src/components/StudentCard.test.tsx
// Component tests for StudentCard

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentCard } from './StudentCard'
import type { QueueStudent, StudentAccount } from '@/types'

// Mock the Firebase service
vi.mock('@/services', () => ({
  db: {
    getStudentAccountById: vi.fn()
  }
}))

import { db } from '@/services'

// ==================== TEST DATA HELPERS ====================

const createQueueStudent = (overrides: Partial<QueueStudent> = {}): QueueStudent => ({
  id: 'student-1',
  name: 'John Doe',
  weight: 180,
  jumpType: 'tandem',
  studentAccountId: 'account-1',
  ...overrides
})

const createStudentAccount = (overrides: Partial<StudentAccount> = {}): StudentAccount => ({
  id: 'account-1',
  studentId: 'STU123',
  name: 'John Doe',
  weight: 180,
  email: '',
  phone: '',
  createdAt: new Date().toISOString(),
  ...overrides
})

// ==================== STUDENT CARD TESTS ====================

describe('StudentCard', () => {
  const mockOnToggle = vi.fn()
  const mockOnEdit = vi.fn()
  const mockOnDragStart = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render student name and basic info', () => {
      const student = createQueueStudent()
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText(/180 lbs/)).toBeInTheDocument()
      expect(screen.getByText(/TANDEM/)).toBeInTheDocument()
    })

    it('should render AFF level for AFF jumps', () => {
      const student = createQueueStudent({
        jumpType: 'aff',
        affLevel: 'lower'
      })
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByText(/AFF/)).toBeInTheDocument()
      expect(screen.getByText(/lower/)).toBeInTheDocument()
    })

    it('should render edit button', () => {
      const student = createQueueStudent()
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByTitle('Edit Student')).toBeInTheDocument()
    })
  })

  describe('Student Account Integration', () => {
    it('should fetch and display student ID from account', async () => {
      const student = createQueueStudent({ studentAccountId: 'account-1' })
      const account = createStudentAccount({ studentId: 'STU123' })

      vi.mocked(db.getStudentAccountById).mockResolvedValue(account)

      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/ID: STU123/)).toBeInTheDocument()
      })
    })

    it('should handle missing student account gracefully', async () => {
      const student = createQueueStudent({ studentAccountId: undefined })

      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      // Should render without student ID
      await waitFor(() => {
        expect(screen.queryByText(/ID:/)).not.toBeInTheDocument()
      })
    })

    it('should handle account fetch errors gracefully', async () => {
      const student = createQueueStudent({ studentAccountId: 'account-1' })

      vi.mocked(db.getStudentAccountById).mockRejectedValue(new Error('Network error'))

      // Should not throw
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/ID:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Selection State', () => {
    it('should show unchecked state when not selected', () => {
      const student = createQueueStudent()
      const { container } = render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      const checkbox = container.querySelector('.border-white\\/40')
      expect(checkbox).toBeInTheDocument()
      expect(screen.queryByText('✓')).not.toBeInTheDocument()
    })

    it('should show checked state when selected', () => {
      const student = createQueueStudent()
      render(
        <StudentCard
          student={student}
          selected={true}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('should apply selected styling when selected', () => {
      const student = createQueueStudent()
      const { container } = render(
        <StudentCard
          student={student}
          selected={true}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      const card = container.querySelector('.border-blue-500')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should call onToggle when card is clicked', async () => {
      const student = createQueueStudent()
      const user = userEvent.setup()

      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      const card = screen.getByText('John Doe').closest('div')!.parentElement!
      await user.click(card)

      expect(mockOnToggle).toHaveBeenCalledTimes(1)
    })

    it('should call onEdit when edit button is clicked', async () => {
      const student = createQueueStudent()
      const user = userEvent.setup()

      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      const editButton = screen.getByTitle('Edit Student')
      await user.click(editButton)

      expect(mockOnEdit).toHaveBeenCalledTimes(1)
      // Should not trigger onToggle due to stopPropagation
      expect(mockOnToggle).not.toHaveBeenCalled()
    })
  })

  describe('Drag and Drop', () => {
    it('should be draggable when draggable prop is true', () => {
      const student = createQueueStudent()
      const { container } = render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
          draggable={true}
        />
      )

      const card = container.querySelector('[draggable="true"]')
      expect(card).toBeInTheDocument()
    })

    it('should not be draggable by default', () => {
      const student = createQueueStudent()
      const { container } = render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      const card = container.querySelector('[draggable="false"]')
      expect(card).toBeInTheDocument()
    })

    it('should call onDragStart when drag starts', () => {
      const student = createQueueStudent()
      const { container } = render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
          draggable={true}
          onDragStart={mockOnDragStart}
        />
      )

      const card = container.querySelector('[draggable="true"]')!
      fireEvent.dragStart(card)

      expect(mockOnDragStart).toHaveBeenCalledTimes(1)
    })

    it('should show move cursor when draggable', () => {
      const student = createQueueStudent()
      const { container } = render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
          draggable={true}
        />
      )

      const card = container.querySelector('.cursor-move')
      expect(card).toBeInTheDocument()
    })

    it('should show pointer cursor when not draggable', () => {
      const student = createQueueStudent()
      const { container } = render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
          draggable={false}
        />
      )

      const card = container.querySelector('.cursor-pointer')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Group Display', () => {
    it('should show group indicator when in group', () => {
      const student = createQueueStudent()
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
          groupName="Sunset Crew"
          groupColor="#8b5cf6"
        />
      )

      expect(screen.getByText(/Sunset Crew/)).toBeInTheDocument()
      expect(screen.getByText(/👥/)).toBeInTheDocument()
    })

    it('should not show group indicator when not in group', () => {
      const student = createQueueStudent()
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.queryByText(/👥/)).not.toBeInTheDocument()
    })
  })

  describe('Notes Display', () => {
    it('should show notes indicator when student has notes', async () => {
      const student = createQueueStudent({ studentAccountId: 'account-1' })
      const account = createStudentAccount({ notes: 'Student is afraid of heights' })

      vi.mocked(db.getStudentAccountById).mockResolvedValue(account)

      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('📝')).toBeInTheDocument()
      })
    })

    it('should not show notes indicator when student has no notes', async () => {
      const student = createQueueStudent({ studentAccountId: 'account-1' })
      const account = createStudentAccount({ notes: '' })

      vi.mocked(db.getStudentAccountById).mockResolvedValue(account)

      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText('📝')).not.toBeInTheDocument()
      })
    })

    it('should show tooltip with notes on hover', async () => {
      const student = createQueueStudent({ studentAccountId: 'account-1' })
      const account = createStudentAccount({ notes: 'Student is afraid of heights' })

      vi.mocked(db.getStudentAccountById).mockResolvedValue(account)

      const user = userEvent.setup()
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      // Wait for notes indicator to appear
      await waitFor(() => {
        expect(screen.getByText('📝')).toBeInTheDocument()
      })

      // Hover over notes indicator
      const notesIndicator = screen.getByText('📝').closest('div')!
      await user.hover(notesIndicator)

      // Tooltip should appear
      await waitFor(() => {
        expect(screen.getByText('Notes:')).toBeInTheDocument()
        expect(screen.getByText('Student is afraid of heights')).toBeInTheDocument()
      })
    })

    it('should hide tooltip when mouse leaves', async () => {
      const student = createQueueStudent({ studentAccountId: 'account-1' })
      const account = createStudentAccount({ notes: 'Student is afraid of heights' })

      vi.mocked(db.getStudentAccountById).mockResolvedValue(account)

      const user = userEvent.setup()
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      // Wait for notes indicator
      await waitFor(() => {
        expect(screen.getByText('📝')).toBeInTheDocument()
      })

      const notesIndicator = screen.getByText('📝').closest('div')!

      // Hover and unhover
      await user.hover(notesIndicator)
      await waitFor(() => {
        expect(screen.getByText('Notes:')).toBeInTheDocument()
      })

      await user.unhover(notesIndicator)
      await waitFor(() => {
        expect(screen.queryByText('Notes:')).not.toBeInTheDocument()
      })
    })
  })

  describe('Badge Display', () => {
    it('should show weight tax badge when present', () => {
      const student = createQueueStudent({ tandemWeightTax: 3 })
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByText(/TAX x 3/)).toBeInTheDocument()
    })

    it('should not show weight tax badge when zero', () => {
      const student = createQueueStudent({ tandemWeightTax: 0 })
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.queryByText(/TAX/)).not.toBeInTheDocument()
    })

    it('should show handcam badge when enabled', () => {
      const student = createQueueStudent({ tandemHandcam: true })
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByText(/Handcam/)).toBeInTheDocument()
      expect(screen.getByText(/📹/)).toBeInTheDocument()
    })

    it('should show outside video badge when enabled', () => {
      const student = createQueueStudent({ outsideVideo: true })
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByText(/Outside Video/)).toBeInTheDocument()
      expect(screen.getByText(/🎥/)).toBeInTheDocument()
    })

    it('should show request badge when is request', () => {
      const student = createQueueStudent({ isRequest: true })
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByText(/Request/)).toBeInTheDocument()
      expect(screen.getByText(/⭐/)).toBeInTheDocument()
    })

    it('should show multiple badges simultaneously', () => {
      const student = createQueueStudent({
        tandemWeightTax: 2,
        tandemHandcam: true,
        outsideVideo: true,
        isRequest: true
      })
      render(
        <StudentCard
          student={student}
          selected={false}
          onToggle={mockOnToggle}
          onEdit={mockOnEdit}
        />
      )

      expect(screen.getByText(/TAX x 2/)).toBeInTheDocument()
      expect(screen.getByText(/Handcam/)).toBeInTheDocument()
      expect(screen.getByText(/Outside Video/)).toBeInTheDocument()
      expect(screen.getByText(/Request/)).toBeInTheDocument()
    })
  })

  describe('Memoization', () => {
    it('should be a memoized component', () => {
      // React.memo wraps the component - verify it's a valid React component
      expect(typeof StudentCard).toBe('object')
      expect(StudentCard.$$typeof.toString()).toContain('react.memo')
    })
  })
})
