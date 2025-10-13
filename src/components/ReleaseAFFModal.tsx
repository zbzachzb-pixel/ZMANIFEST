'use client'

import React, { useState } from 'react'
import { db } from '@/services'
import type { Instructor } from '@/types'

interface ReleaseAFFModalProps {
  instructor: Instructor
  onClose: () => void
  onSuccess: () => void
}

export function ReleaseAFFModal({ instructor, onClose, onSuccess }: ReleaseAFFModalProps) {
  const [loading, setLoading] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<string[]>(
    instructor.affStudents?.map(s => s.studentId) || []
  )
  
  if (!instructor.affStudents || instructor.affStudents.length === 0) {
    return null
  }
  
  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }
  
  const handleRelease = async () => {
    if (selectedStudents.length === 0) {
      alert('Please select at least one student to release')
      return
    }
    
    try {
      setLoading(true)
      
      // Filter out selected students
      const remainingStudents = instructor.affStudents.filter(
        s => !selectedStudents.includes(s.studentId)
      )
      
      // Update instructor
      await db.updateInstructor(instructor.id, {
        affStudents: remainingStudents,
        affLocked: remainingStudents.length > 0
      })
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to release students:', error)
      alert('Failed to release students. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-white/20">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">
            Release {instructor.name} from AFF
          </h2>
          
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-slate-300 text-sm">
              Select which AFF student(s) to release. This will allow the instructor to be assigned to other students.
            </p>
          </div>
          
          <div className="space-y-3 mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Release Students:
            </label>
            
            {instructor.affStudents.map((student) => {
              const startTime = new Date(student.startTime)
              return (
                <label
                  key={student.studentId}
                  className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.studentId)}
                    onChange={() => toggleStudent(student.studentId)}
                    className="w-5 h-5 rounded bg-slate-600 border-slate-500 text-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-white font-semibold">{student.name}</div>
                    <div className="text-xs text-slate-400">
                      Started {startTime.toLocaleTimeString()}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleRelease}
              disabled={loading || selectedStudents.length === 0}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Releasing...' : `Release Selected (${selectedStudents.length})`}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}