// src/components/AssignInstructorsModal.tsx
// Extracted from LoadBuilderCard.tsx - Modal for assigning/editing instructors on a load

'use client'

import React from 'react'
import type { LoadAssignment, Instructor } from '@/types'

interface AssignInstructorsModalProps {
  show: boolean
  isEditMode: boolean
  assignments: LoadAssignment[]
  assignmentSelections: Record<string, {
    instructorId: string
    videoInstructorId?: string
    isRequest: boolean
  }>
  qualifiedInstructorsMap: Map<string, Instructor[]>
  videoInstructors: Instructor[]
  instructorBalances: Map<string, number>
  instructors: Instructor[]
  loading: boolean
  onClose: () => void
  onAssign: () => void
  onSelectionChange: (
    assignmentId: string,
    updates: { instructorId?: string; videoInstructorId?: string }
  ) => void
}

export function AssignInstructorsModal({
  show,
  isEditMode,
  assignments,
  assignmentSelections,
  qualifiedInstructorsMap,
  videoInstructors,
  instructorBalances,
  instructors,
  loading,
  onClose,
  onAssign,
  onSelectionChange
}: AssignInstructorsModalProps) {
  if (!show) return null

  const assignmentsToShow = isEditMode
    ? assignments
    : assignments.filter(a => !a.instructorId)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] border border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-xl font-bold text-white">
            {isEditMode ? 'Edit Instructors' : 'Assign Instructors'}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {isEditMode
              ? 'Change instructor assignments for all students on this load.'
              : 'Auto-selected lowest balance instructors. Adjust as needed.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {assignmentsToShow.map(assignment => {
            const qualified = qualifiedInstructorsMap.get(assignment.id) || []
            const selection = assignmentSelections[assignment.id]

            // Collect all instructors already used across the load
            const usedInstructorIds = new Set<string>()
            const usedVideoInstructorIds = new Set<string>()

            Object.entries(assignmentSelections).forEach(([assignId, sel]) => {
              // Don't count this assignment's own selections as "used"
              if (assignId !== assignment.id) {
                if (sel.instructorId) {
                  usedInstructorIds.add(sel.instructorId)
                  // Instructors doing primary can't also do video for someone else
                  usedVideoInstructorIds.add(sel.instructorId)
                }
                if (sel.videoInstructorId) {
                  usedVideoInstructorIds.add(sel.videoInstructorId)
                  // Video instructors can't also do primary for someone else
                  usedInstructorIds.add(sel.videoInstructorId)
                }
              }
            })

            // Filter qualified instructors to exclude those already used
            const availableQualified = qualified.filter(
              instructor =>
                !usedInstructorIds.has(instructor.id) ||
                instructor.id === selection?.instructorId
            )

            // Filter video instructors to exclude:
            // 1. This student's primary instructor
            // 2. Anyone already used on this load
            const availableVideo = videoInstructors.filter(
              instructor =>
                instructor.id !== selection?.instructorId &&
                (!usedVideoInstructorIds.has(instructor.id) ||
                  instructor.id === selection?.videoInstructorId)
            )

            return (
              <div key={assignment.id} className="bg-slate-700 rounded-lg p-4">
                <div className="font-semibold text-white mb-2">
                  {assignment.studentName} • {assignment.jumpType.toUpperCase()}
                  {assignment.instructorId && isEditMode && (
                    <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                      Currently: {instructors.find(i => i.id === assignment.instructorId)?.name}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-300 block mb-1">Primary Instructor</label>
                    <select
                      value={selection?.instructorId || ''}
                      onChange={(e) => {
                        onSelectionChange(assignment.id, { instructorId: e.target.value })
                      }}
                      className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">Select instructor...</option>
                      {availableQualified.map(instructor => (
                        <option key={instructor.id} value={instructor.id}>
                          {instructor.name} (${instructorBalances.get(instructor.id) || 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  {assignment.hasOutsideVideo && (
                    <div>
                      <label className="text-sm text-slate-300 block mb-1">
                        Video Instructor
                        {assignment.videoInstructorId && isEditMode && (
                          <span className="ml-2 text-xs text-green-400">
                            (Currently: {instructors.find(i => i.id === assignment.videoInstructorId)?.name})
                          </span>
                        )}
                      </label>
                      <select
                        value={selection?.videoInstructorId || ''}
                        onChange={(e) => {
                          onSelectionChange(assignment.id, { videoInstructorId: e.target.value })
                        }}
                        className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white"
                      >
                        <option value="">Select video instructor...</option>
                        {availableVideo.map(instructor => (
                          <option key={instructor.id} value={instructor.id}>
                            {instructor.name} (${instructorBalances.get(instructor.id) || 0})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {!isEditMode && assignmentsToShow.length === 0 && (
            <div className="text-center text-slate-400 py-8">
              ✅ All students already have instructors assigned!
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onAssign}
            disabled={loading}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Assign Selected')}
          </button>
        </div>
      </div>
    </div>
  )
}
