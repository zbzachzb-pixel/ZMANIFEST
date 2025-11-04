// src/components/LoadModals.test.tsx
// Component tests for LoadModals (StatusChangeConfirmModal, DelayModal, DeleteConfirmModal)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusChangeConfirmModal, DelayModal, DeleteConfirmModal } from './LoadModals'

// Mock FocusTrap - we're testing modal logic, not focus trap library
vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

// ==================== StatusChangeConfirmModal ====================

describe('StatusChangeConfirmModal', () => {
  const mockOnConfirm = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when show is false', () => {
      render(
        <StatusChangeConfirmModal
          show={false}
          newStatus="boarding"
          statusLabel="Boarding"
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.queryByText('Confirm Status Change')).not.toBeInTheDocument()
    })

    it('should not render when newStatus is null', () => {
      render(
        <StatusChangeConfirmModal
          show={true}
          newStatus={null}
          statusLabel="Boarding"
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.queryByText('Confirm Status Change')).not.toBeInTheDocument()
    })

    it('should render when show is true and newStatus is set', () => {
      render(
        <StatusChangeConfirmModal
          show={true}
          newStatus="boarding"
          statusLabel="Boarding"
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Confirm Status Change')).toBeInTheDocument()
      expect(screen.getByText(/Change load status to/)).toBeInTheDocument()
      expect(screen.getByText('Boarding')).toBeInTheDocument()
    })

    it('should have proper ARIA attributes', () => {
      render(
        <StatusChangeConfirmModal
          show={true}
          newStatus="boarding"
          statusLabel="Boarding"
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'status-change-title')
    })
  })

  describe('Interactions', () => {
    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <StatusChangeConfirmModal
          show={true}
          newStatus="boarding"
          statusLabel="Boarding"
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const cancelButton = screen.getByLabelText('Cancel status change')
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
      expect(mockOnConfirm).not.toHaveBeenCalled()
    })

    it('should call onConfirm when Confirm button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <StatusChangeConfirmModal
          show={true}
          newStatus="boarding"
          statusLabel="Boarding"
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const confirmButton = screen.getByLabelText('Confirm status change to Boarding')
      await user.click(confirmButton)

      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
      expect(mockOnCancel).not.toHaveBeenCalled()
    })

    it('should disable Confirm button when loading', () => {
      render(
        <StatusChangeConfirmModal
          show={true}
          newStatus="boarding"
          statusLabel="Boarding"
          loading={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const confirmButton = screen.getByLabelText('Confirm status change to Boarding')
      expect(confirmButton).toBeDisabled()
    })
  })
})

// ==================== DelayModal ====================

describe('DelayModal', () => {
  const mockOnDelayChange = vi.fn()
  const mockOnApply = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when show is false', () => {
      render(
        <DelayModal
          show={false}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.queryByText(/Change Call Time/)).not.toBeInTheDocument()
    })

    it('should render when show is true', () => {
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/Change Call Time/)).toBeInTheDocument()
      expect(screen.getByText(/Adjust the departure call/)).toBeInTheDocument()
    })

    it('should have proper ARIA attributes', () => {
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'delay-modal-title')
    })

    it('should show all preset buttons', () => {
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('-5 min')).toBeInTheDocument()
      expect(screen.getByText('-2 min')).toBeInTheDocument()
      expect(screen.getByText('+2 min')).toBeInTheDocument()
      expect(screen.getByText('+5 min')).toBeInTheDocument()
    })

    it('should show current delay value in input', () => {
      render(
        <DelayModal
          show={true}
          delayMinutes={10}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const input = screen.getByLabelText(/Delay minutes/)
      expect(input).toHaveValue(10)
    })
  })

  describe('Interactions', () => {
    it('should call onDelayChange when -5 min button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const button = screen.getByText('-5 min')
      await user.click(button)

      expect(mockOnDelayChange).toHaveBeenCalledWith(-5)
    })

    it('should call onDelayChange when -2 min button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const button = screen.getByText('-2 min')
      await user.click(button)

      expect(mockOnDelayChange).toHaveBeenCalledWith(-2)
    })

    it('should call onDelayChange when +2 min button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const button = screen.getByText('+2 min')
      await user.click(button)

      expect(mockOnDelayChange).toHaveBeenCalledWith(2)
    })

    it('should call onDelayChange when +5 min button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const button = screen.getByText('+5 min')
      await user.click(button)

      expect(mockOnDelayChange).toHaveBeenCalledWith(5)
    })

    it('should call onDelayChange when input value changes', () => {
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const input = screen.getByLabelText(/Delay minutes/)

      // Use fireEvent.change to set value directly
      fireEvent.change(input, { target: { value: '15' } })

      expect(mockOnDelayChange).toHaveBeenCalledWith(15)
    })

    it('should handle non-numeric input by calling onDelayChange with 0', async () => {
      const user = userEvent.setup()
      render(
        <DelayModal
          show={true}
          delayMinutes={10}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const input = screen.getByLabelText(/Delay minutes/)
      await user.clear(input)
      await user.type(input, 'abc')

      expect(mockOnDelayChange).toHaveBeenCalledWith(0)
    })

    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const cancelButton = screen.getByLabelText('Cancel time change')
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
      expect(mockOnApply).not.toHaveBeenCalled()
    })

    it('should call onApply when Apply Change button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DelayModal
          show={true}
          delayMinutes={5}
          loading={false}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const applyButton = screen.getByLabelText('Apply time change')
      await user.click(applyButton)

      expect(mockOnApply).toHaveBeenCalledTimes(1)
      expect(mockOnCancel).not.toHaveBeenCalled()
    })

    it('should disable Apply button when loading', () => {
      render(
        <DelayModal
          show={true}
          delayMinutes={0}
          loading={true}
          onDelayChange={mockOnDelayChange}
          onApply={mockOnApply}
          onCancel={mockOnCancel}
        />
      )

      const applyButton = screen.getByLabelText('Apply time change')
      expect(applyButton).toBeDisabled()
    })
  })
})

// ==================== DeleteConfirmModal ====================

describe('DeleteConfirmModal', () => {
  const mockOnConfirm = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when show is false', () => {
      render(
        <DeleteConfirmModal
          show={false}
          isCompleted={false}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.queryByText(/Delete Load/)).not.toBeInTheDocument()
    })

    it('should render when show is true', () => {
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={false}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByRole('heading', { name: /Delete Load/ })).toBeInTheDocument()
    })

    it('should have proper ARIA attributes', () => {
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={false}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'delete-modal-title')
    })

    it('should show regular message for non-completed loads', () => {
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={false}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/All students will be returned to the queue/)).toBeInTheDocument()
      expect(screen.queryByText(/COMPLETED load/)).not.toBeInTheDocument()
    })

    it('should show warning message for completed loads', () => {
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={true}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/COMPLETED load/)).toBeInTheDocument()
      expect(screen.queryByText(/returned to the queue/)).not.toBeInTheDocument()
    })

    it('should have appropriate aria-label for non-completed loads', () => {
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={false}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByLabelText('Delete load and return students to queue')
      expect(deleteButton).toBeInTheDocument()
    })

    it('should have warning aria-label for completed loads', () => {
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={true}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByLabelText(/Delete completed load \(warning: affects stats\)/)
      expect(deleteButton).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={false}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const cancelButton = screen.getByLabelText('Cancel delete load')
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
      expect(mockOnConfirm).not.toHaveBeenCalled()
    })

    it('should call onConfirm when Delete Load button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={false}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByLabelText('Delete load and return students to queue')
      await user.click(deleteButton)

      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
      expect(mockOnCancel).not.toHaveBeenCalled()
    })

    it('should disable Delete Load button when loading', () => {
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={false}
          loading={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByLabelText('Delete load and return students to queue')
      expect(deleteButton).toBeDisabled()
    })

    it('should call onConfirm for completed loads', async () => {
      const user = userEvent.setup()
      render(
        <DeleteConfirmModal
          show={true}
          isCompleted={true}
          loading={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      )

      const deleteButton = screen.getByLabelText(/Delete completed load/)
      await user.click(deleteButton)

      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    })
  })
})
