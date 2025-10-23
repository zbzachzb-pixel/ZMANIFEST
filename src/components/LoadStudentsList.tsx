// src/components/LoadStudentsList.tsx
// Extracted from LoadBuilderCard.tsx - Displays list of students/assignments on a load

'use client'

import React, { useState } from 'react'
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
  const [isExpanded, setIsExpanded] = useState(true) // Default to open
  const count = assignments.length

  const renderAssignments = () => {
    if (assignments.length === 0) {
      return (
        <div className="p-6 space-y-3 min-h-[200px] max-h-[500px] overflow-y-auto">
          <div className="text-center text-white/60 py-12 text-base font-medium">
            Drop students here to build the load
          </div>
        </div>
      )
    }

    return (
      <div className="p-5 space-y-3 min-h-[200px] max-h-[500px] overflow-y-auto">
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
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-move hover:bg-white/15 transition-all hover:scale-[1.02] hover:shadow-lg border border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {group && (
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/20">
                      <span className="text-xl">👥</span>
                      <span className="text-base font-bold text-purple-300">
                        {group.name} ({groupAssignments.length})
                      </span>
                    </div>
                  )}

                  {groupAssignments.map((ga, idx) => {
                    const gaInstructor = ga.instructorId ? instructors.find(i => i.id === ga.instructorId) : null
                    const gaVideoInstructor = ga.videoInstructorId ? instructors.find(i => i.id === ga.videoInstructorId) : null

                    return (
                      <div key={ga.id} className={idx > 0 ? 'mt-3 pt-3 border-t border-white/20' : ''}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base min-w-0 shrink">
                            {ga.studentName}
                          </span>
                          <span className="text-xs font-bold bg-white/30 px-2.5 py-1 rounded-md text-white shadow-sm whitespace-nowrap shrink-0">
                            {ga.jumpType.toUpperCase()}
                          </span>
                          {ga.isRequest && (
                            <span className="text-xs font-bold bg-yellow-500/40 px-2.5 py-1 rounded-md text-yellow-100 shadow-sm whitespace-nowrap shrink-0">
                              ⭐ REQUEST
                            </span>
                          )}
                        </div>

                        {gaInstructor && (
                          <div className="text-sm text-white/70 mt-2 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-base">👤</span>
                              <span className="text-white/90">{gaInstructor.name}</span>
                            </span>
                            {gaVideoInstructor && (
                              <span className="ml-3 inline-flex items-center gap-1.5">
                                <span className="text-base">📹</span>
                                <span className="text-white/90">{gaVideoInstructor.name}</span>
                              </span>
                            )}
                          </div>
                        )}

                        {!gaInstructor && (
                          <div className="text-xs text-yellow-300 mt-1 font-semibold flex items-center gap-1">
                            <span className="text-sm">⚠️</span> <span className="whitespace-nowrap">No instructor</span>
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
                    className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-all hover:scale-110 font-bold text-lg"
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

  return (
    <div className="border-t border-white/10">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📚</span>
          <span className="font-semibold text-white">Students</span>
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-sm rounded-full font-medium">
            {count}
          </span>
        </div>

        {/* Chevron Icon */}
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Content */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? 'max-h-[600px]' : 'max-h-0'
        }`}
      >
        {renderAssignments()}
      </div>
    </div>
  )
}
