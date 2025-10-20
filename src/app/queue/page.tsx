// src/app/queue/page.tsx - COMPLETE FIXED VERSION
// ✅ Uses studentAccountIds for groups
// ✅ Complete and fully functional

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useTandemQueue, useAFFQueue, useRemoveMultipleFromQueue, useGroups } from '@/hooks/useDatabase'
import { useToast } from '@/contexts/ToastContext'
import { AddToQueueModal } from '@/components/AddToQueueModal'
import { EditStudentModal } from '@/components/EditStudentModal'
import { StudentCard } from '@/components/StudentCard'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { CreateGroupModal } from '@/components/CreateGroupModal'
import { GroupCard } from '@/components/GroupCard'
import { ImportStudentsModal } from '@/components/ImportStudentsModal'
import type { QueueStudent, Group } from '@/types'
import { useAddStudentToGroup } from '@/hooks/useDatabase'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { RequireRole } from '@/components/auth'

interface GroupWithStudents extends Group {
  students: QueueStudent[]
}

function QueuePageContent() {
  const { data: tandemQueue, loading: tandemLoading } = useTandemQueue()
  const { data: affQueue, loading: affLoading } = useAFFQueue()
  const { data: groups } = useGroups()
  const { removeMultiple, loading: removeLoading } = useRemoveMultipleFromQueue()
  const toast = useToast()

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTandem, setSelectedTandem] = useState<string[]>([])
  const [selectedAFF, setSelectedAFF] = useState<string[]>([])
  const [searchTandem, setSearchTandem] = useState('')
  const [searchAFF, setSearchAFF] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'tandem' | 'aff', count: number } | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<QueueStudent | null>(null)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [groupQueueType, setGroupQueueType] = useState<'tandem' | 'aff'>('tandem')
  const { addStudent: addStudentToGroup } = useAddStudentToGroup()
  const [dropZoneActive, setDropZoneActive] = useState(false)

  // ✅ FIXED: Group students by groupId field on QueueStudent
  const { tandemGroups, ungroupedTandem } = useMemo(() => {
    const studentsWithGroups = tandemQueue.filter(s => s.groupId)
    
    const groupMap = new Map<string, QueueStudent[]>()
    studentsWithGroups.forEach(student => {
      const groupId = student.groupId!
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(student)
    })
    
    const tandemGroupsWithStudents: GroupWithStudents[] = Array.from(groupMap.entries())
      .map(([groupId, students]) => {
        const groupDoc = groups.find(g => g.id === groupId)
        if (!groupDoc) return null
        return { ...groupDoc, students }
      })
      .filter((g): g is GroupWithStudents => g !== null)
    
    const groupedIds = new Set(studentsWithGroups.map(s => s.id))
    const ungrouped = tandemQueue.filter(s => !groupedIds.has(s.id))
    
    return { 
      tandemGroups: tandemGroupsWithStudents, 
      ungroupedTandem: ungrouped 
    }
  }, [groups, tandemQueue])

  const { affGroups, ungroupedAFF } = useMemo(() => {
    const studentsWithGroups = affQueue.filter(s => s.groupId)
    
    const groupMap = new Map<string, QueueStudent[]>()
    studentsWithGroups.forEach(student => {
      const groupId = student.groupId!
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(student)
    })
    
    const affGroupsWithStudents: GroupWithStudents[] = Array.from(groupMap.entries())
      .map(([groupId, students]) => {
        const groupDoc = groups.find(g => g.id === groupId)
        if (!groupDoc) return null
        return { ...groupDoc, students }
      })
      .filter((g): g is GroupWithStudents => g !== null)
    
    const groupedIds = new Set(studentsWithGroups.map(s => s.id))
    const ungrouped = affQueue.filter(s => !groupedIds.has(s.id))
    
    return { 
      affGroups: affGroupsWithStudents, 
      ungroupedAFF: ungrouped 
    }
  }, [groups, affQueue])

  const handleAddStudent = () => {
    setShowAddModal(true)
  }

  const handleEditStudent = (student: QueueStudent) => {
    setEditingStudent(student)
  }

  const toggleSelection = (studentId: string, type: 'tandem' | 'aff') => {
    if (type === 'tandem') {
      setSelectedTandem(prev => 
        prev.includes(studentId) 
          ? prev.filter(id => id !== studentId)
          : [...prev, studentId]
      )
    } else {
      setSelectedAFF(prev => 
        prev.includes(studentId) 
          ? prev.filter(id => id !== studentId)
          : [...prev, studentId]
      )
    }
  }

  const handleCreateGroup = (type: 'tandem' | 'aff') => {
    const selected = type === 'tandem' ? selectedTandem : selectedAFF
    if (selected.length < 2) {
      toast.warning('Please select at least 2 students to create a group')
      return
    }
    setGroupQueueType(type)
    setShowCreateGroupModal(true)
  }

  const handleRemoveSelected = (type: 'tandem' | 'aff') => {
    const selected = type === 'tandem' ? selectedTandem : selectedAFF

    if (selected.length === 0) {
      toast.warning('Please select at least one student')
      return
    }
    
    setConfirmDelete({ type, count: selected.length })
  }

  const confirmRemoval = async () => {
    if (!confirmDelete) return
    
    const selected = confirmDelete.type === 'tandem' ? selectedTandem : selectedAFF
    
    try {
      await removeMultiple(selected)
      
      if (confirmDelete.type === 'tandem') {
        setSelectedTandem([])
      } else {
        setSelectedAFF([])
      }
      
      setConfirmDelete(null)
    } catch (error) {
      console.error('Failed to remove students:', error)
      toast.error('Failed to remove students', error instanceof Error ? error.message : 'Unknown error')
      setConfirmDelete(null)
    }
  }

  const handleAssignGroup = async (_groupId: string) => {
    toast.info('Drag the entire group card to a load in the Load Builder page to assign all students together!')
  }

  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('groupId', groupId)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleStudentDragStart = (e: React.DragEvent, studentId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('studentId', studentId)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleStudentDragFromGroup = useCallback((e: React.DragEvent, studentId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('studentId', studentId)
    e.dataTransfer.setData('fromGroup', 'true')
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
    setDropZoneActive(true)
  }, [])

  const handleStudentDragEnd = useCallback(() => {
    setDropZoneActive(false)
  }, [])

  // ✅ FIXED: Use studentAccountId when adding to group
  const handleStudentDropOnGroup = async (groupId: string, studentId: string) => {
    try {
      const student = [...tandemQueue, ...affQueue].find(s => s.id === studentId)
      if (!student) {
        toast.error('Student not found')
        return
      }
      
      if (student.groupId === groupId) {
        return
      }
      
      // ✅ FIX: Use studentAccountId (permanent ID) instead of queue ID
      await addStudentToGroup(groupId, student.studentAccountId)
      
      setSelectedTandem(prev => prev.filter(id => id !== studentId))
      setSelectedAFF(prev => prev.filter(id => id !== studentId))
    } catch (error) {
      console.error('Failed to add student to group:', error)
      toast.error('Failed to add student to group')
    }
  }

  const filteredTandemQueue = useMemo(() => {
    return ungroupedTandem.filter(s => 
      s.name.toLowerCase().includes(searchTandem.toLowerCase()) ||
      s.weight.toString().includes(searchTandem)
    )
  }, [ungroupedTandem, searchTandem])

  const filteredAFFQueue = useMemo(() => {
    return ungroupedAFF.filter(s => 
      s.name.toLowerCase().includes(searchAFF.toLowerCase()) ||
      s.weight.toString().includes(searchAFF) ||
      (s.affLevel && s.affLevel.toLowerCase().includes(searchAFF.toLowerCase()))
    )
  }, [ungroupedAFF, searchAFF])

  const selectedTandemStudents = tandemQueue.filter(s => selectedTandem.includes(s.id))
  const selectedAFFStudents = affQueue.filter(s => selectedAFF.includes(s.id))

  if (tandemLoading || affLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Loading queue...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Student Queue</h1>
          <p className="text-slate-300">Add students and create groups for parties that need to jump together</p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/20 border-2 border-blue-500/50 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <div className="font-bold text-blue-300 mb-1">How to Use Groups</div>
              <p className="text-sm text-slate-300">
                1. Select multiple students (hold checkboxes)<br/>
                2. Click "Create Group" to group them together<br/>
                3. Drag entire group card to Load Builder to assign all students at once<br/>
                4. Groups keep students together on the same load
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleAddStudent}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
          >
            ➕ Add Student
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
          >
            📄 Import Students
          </button>
        </div>

        {/* Tandem and AFF Queues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tandem Queue */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">🪂 Tandem Queue</h2>
              <span className="text-sm text-slate-400">
                {tandemQueue.length} student{tandemQueue.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by name or weight..."
              value={searchTandem}
              onChange={(e) => setSearchTandem(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 mb-4"
            />

            {/* Selection Actions */}
            {selectedTandem.length > 0 && (
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
                <div className="flex gap-2">
                  {selectedTandem.length >= 2 && (
                    <button
                      onClick={() => handleCreateGroup('tandem')}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      👥 Create Group ({selectedTandem.length})
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSelected('tandem')}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    🗑️ Remove ({selectedTandem.length})
                  </button>
                </div>
              </div>
            )}

            {/* Groups */}
            <div className="space-y-3 mb-4">
              {tandemGroups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  students={group.students}
                  onAssignGroup={handleAssignGroup}
                  draggable
                  onDragStart={(e) => handleGroupDragStart(e, group.id)}
                  onStudentDrop={handleStudentDropOnGroup}
                  onStudentDragStart={handleStudentDragFromGroup}
                  onStudentDragEnd={handleStudentDragEnd}
                />
              ))}
            </div>

            {/* Individual Students */}
            <div 
              className={`space-y-2 max-h-[600px] overflow-y-auto ${
                dropZoneActive ? 'bg-blue-500/10 border-2 border-blue-500 rounded-lg p-2' : ''
              }`}
            >
              {filteredTandemQueue.map(student => (
                <StudentCard
                  key={student.id}
                  student={student}
                  selected={selectedTandem.includes(student.id)}
                  onToggle={() => toggleSelection(student.id, 'tandem')}
                  onEdit={() => handleEditStudent(student)}
                  draggable
                  onDragStart={(e) => handleStudentDragStart(e, student.id)}
                />
              ))}
              {filteredTandemQueue.length === 0 && tandemGroups.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  No tandem students in queue
                </div>
              )}
            </div>
          </div>

          {/* AFF Queue */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">🎓 AFF Queue</h2>
              <span className="text-sm text-slate-400">
                {affQueue.length} student{affQueue.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by name, weight, or level..."
              value={searchAFF}
              onChange={(e) => setSearchAFF(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 mb-4"
            />

            {/* Selection Actions */}
            {selectedAFF.length > 0 && (
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
                <div className="flex gap-2">
                  {selectedAFF.length >= 2 && (
                    <button
                      onClick={() => handleCreateGroup('aff')}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                      👥 Create Group ({selectedAFF.length})
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSelected('aff')}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    🗑️ Remove ({selectedAFF.length})
                  </button>
                </div>
              </div>
            )}

            {/* Groups */}
            <div className="space-y-3 mb-4">
              {affGroups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  students={group.students}
                  onAssignGroup={handleAssignGroup}
                  draggable
                  onDragStart={(e) => handleGroupDragStart(e, group.id)}
                  onStudentDrop={handleStudentDropOnGroup}
                  onStudentDragStart={handleStudentDragFromGroup}
                  onStudentDragEnd={handleStudentDragEnd}
                />
              ))}
            </div>

            {/* Individual Students */}
            <div 
              className={`space-y-2 max-h-[600px] overflow-y-auto ${
                dropZoneActive ? 'bg-blue-500/10 border-2 border-blue-500 rounded-lg p-2' : ''
              }`}
            >
              {filteredAFFQueue.map(student => (
                <StudentCard
                  key={student.id}
                  student={student}
                  selected={selectedAFF.includes(student.id)}
                  onToggle={() => toggleSelection(student.id, 'aff')}
                  onEdit={() => handleEditStudent(student)}
                  draggable
                  onDragStart={(e) => handleStudentDragStart(e, student.id)}
                />
              ))}
              {filteredAFFQueue.length === 0 && affGroups.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  No AFF students in queue
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddToQueueModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
          }}
        />
      )}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Remove Students"
          message={`Are you sure you want to remove ${confirmDelete.count} student${confirmDelete.count !== 1 ? 's' : ''} from the queue?`}
          onConfirm={confirmRemoval}
          onCancel={() => setConfirmDelete(null)}
          loading={removeLoading}
        />
      )}

      {showCreateGroupModal && (
        <CreateGroupModal
          selectedStudents={groupQueueType === 'tandem' ? selectedTandemStudents : selectedAFFStudents}
          onClose={() => setShowCreateGroupModal(false)}
          onSuccess={() => {
            setShowCreateGroupModal(false)
            if (groupQueueType === 'tandem') {
              setSelectedTandem([])
            } else {
              setSelectedAFF([])
            }
          }}
        />
      )}

      {showImportModal && (
        <ImportStudentsModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  )
}

export default function QueuePage() {
  return (
    <RequireRole roles={['admin', 'manifest']}>
      <PageErrorBoundary>
        <QueuePageContent />
      </PageErrorBoundary>
    </RequireRole>
  )
}