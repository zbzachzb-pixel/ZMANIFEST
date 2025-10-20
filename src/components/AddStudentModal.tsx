// src/components/AddStudentModal.tsx
'use client'

import { AddToQueueModal } from './AddToQueueModal'

interface AddStudentModalProps {
  queueType: 'tandem' | 'aff'
  onClose: () => void
}

export function AddStudentModal({ queueType: _queueType, onClose }: AddStudentModalProps) {
  return (
    <AddToQueueModal 
      isOpen={true}
      onClose={onClose}
      onSuccess={onClose}
    />
  )
}