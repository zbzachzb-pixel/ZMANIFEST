// src/components/LoadStudentsList.tsx
// Extracted from LoadBuilderCard.tsx - Displays list of students/assignments on a load

'use client'

import React from 'react'
import type { LoadAssignment, Instructor, Group } from '@/types'

interface LoadStudentsListProps {
  assignments: LoadAssignment[]
  groups?: Group[]
  instructors: Instructor[]
  isCompleted: boolean
  loadId: string
  onDragStart: (type: 'student' | 'assignment' | 'group', id: string, sourceLoadId?: string) => void
  onDragEnd: () => void
  onRemoveAssignment: (assignment: LoadAssignment) => void
  onRemoveGroup: (groupAssignments: LoadAssignment[]) => void
}

export function LoadStudentsList({
  assignments,
  groups,
  instructors,
  isCompleted,
  loadId,
  onDragStart,
  onDragEnd,
  onRemoveAssignment,
  onRemoveGroup
}: LoadStudentsListProps) {
  if (assignments.length === 0) {
    return (
      <div className="p-4 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
        <div className="text-center text-white/60 py-8">
          Drop students here to build the load
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2 min-h-[200px] max-h-[500px] overflow-y-auto">
      {assignments.map((assignment) => {
        const groupAssignments = assignment.groupId
          ? assignments.filter(a => a.groupId === assignment.groupId)
          : [assignment]
        const firstInGroup = groupAssignments[0]
        const isFirstInGroup = firstInGroup?.id === assignment.id

        if (assignment.groupId && !isFirstInGroup) return null

        const group = assignment.groupId ? groups?.find(g => g.id === assignment.groupId) : null

        return (
          <div
            key={assignment.id}
            draggable={!isCompleted}
            onDragStart={(e) => {
              if (isCompleted) {
                e.preventDefault()
                return
              }
              if (assignment.groupId) {
                onDragStart('group', assignment.groupId, loadId)
              } else {
                onDragStart('assignment', assignment.id, loadId)
              }
            }}
            onDragEnd={onDragEnd}
            className="bg-white/10 rounded-lg p-3 cursor-move hover:bg-white/15 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {group && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">👥</span>
                    <span className="text-sm font-semibold text-blue-300">
                      {group.name} ({groupAssignments.length} students)
                    </span>
                  </div>
                )}

                {groupAssignments.map((ga, idx) => {
                  const gaInstructor = ga.instructorId ? instructors.find(i => i.id === ga.instructorId) : null
                  const gaVideoInstructor = ga.videoInstructorId ? instructors.find(i => i.id === ga.videoInstructorId) : null

                  return (
                    <div key={ga.id} className={idx > 0 ? 'mt-2 pt-2 border-t border-white/10' : ''}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {ga.studentName}
                        </span>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white">
                          {ga.jumpType.toUpperCase()}
                        </span>
                        {ga.isRequest && (
                          <span className="text-xs bg-yellow-500/30 px-2 py-0.5 rounded text-yellow-200">
                            REQUEST
                          </span>
                        )}
                      </div>

                      {gaInstructor && (
                        <div className="text-sm text-white/80 mt-1">
                          👤 {gaInstructor.name}
                          {gaVideoInstructor && (
                            <span className="ml-2">
                              📹 {gaVideoInstructor.name}
                            </span>
                          )}
                        </div>
                      )}

                      {!gaInstructor && (
                        <div className="text-sm text-yellow-300 mt-1">
                          ⚠️ No instructor assigned
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {!isCompleted && (
                <button
                  onClick={() => {
                    if (assignment.groupId) {
                      onRemoveGroup(groupAssignments)
                    } else {
                      onRemoveAssignment(assignment)
                    }
                  }}
                  className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                  title="Remove"
                  aria-label="Remove from load"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
