// =========================================
// FILE: src/app/queue/page.tsx - COMPLETE REPLACEMENT
// =========================================
'use client'

import React, { useState, useMemo } from 'react'
import { useTandemQueue, useAFFQueue, useRemoveMultipleFromQueue, useGroups } from '@/hooks/useDatabase'
import { db } from '@/services'
import { AddStudentModal } from '@/components/AddStudentModal'
import { EditStudentModal } from '@/components/EditStudentModal'
import { StudentCard } from '@/components/StudentCard'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { CreateGroupModal } from '@/components/CreateGroupModal'
import { GroupCard } from '@/components/GroupCard'
import { ImportStudentsModal } from '@/components/ImportStudentsModal'
import type { QueueStudent } from '@/types'

export default function QueuePage() {
  const { data: tandemQueue, loading: tandemLoading } = useTandemQueue()
  const { data: affQueue, loading: affLoading } = useAFFQueue()
  const { data: groups } = useGroups()
  const { removeMultiple, loading: removeLoading } = useRemoveMultipleFromQueue()
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalQueueType, setModalQueueType] = useState<'tandem' | 'aff'>('tandem')
  const [selectedTandem, setSelectedTandem] = useState<string[]>([])
  const [selectedAFF, setSelectedAFF] = useState<string[]>([])
  const [searchTandem, setSearchTandem] = useState('')
  const [searchAFF, setSearchAFF] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'tandem' | 'aff', count: number } | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<QueueStudent | null>(null)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [groupQueueType, setGroupQueueType] = useState<'tandem' | 'aff'>('tandem')

  // Group colors for visual distinction
  const groupColors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

  // Separate grouped and ungrouped students
  const { tandemGroups, ungroupedTandem } = useMemo(() => {
    const tandemGroups = groups.filter(g => 
      g.studentIds.some(sid => tandemQueue.find(s => s.id === sid))
    )
    const groupedIds = new Set(tandemGroups.flatMap(g => g.studentIds))
    const ungrouped = tandemQueue.filter(s => !groupedIds.has(s.id))
    return { tandemGroups, ungroupedTandem: ungrouped }
  }, [groups, tandemQueue])

  const { affGroups, ungroupedAFF } = useMemo(() => {
    const affGroups = groups.filter(g => 
      g.studentIds.some(sid => affQueue.find(s => s.id === sid))
    )
    const groupedIds = new Set(affGroups.flatMap(g => g.studentIds))
    const ungrouped = affQueue.filter(s => !groupedIds.has(s.id))
    return { affGroups, ungroupedAFF: ungrouped }
  }, [groups, affQueue])

  const handleAddStudent = (type: 'tandem' | 'aff') => {
    setModalQueueType(type)
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
      alert('Please select at least 2 students to create a group')
      return
    }
    setGroupQueueType(type)
    setShowCreateGroupModal(true)
  }

  const handleGroupCreated = () => {
    setSelectedTandem([])
    setSelectedAFF([])
  }

  const handleRemoveSelected = (type: 'tandem' | 'aff') => {
    const selected = type === 'tandem' ? selectedTandem : selectedAFF
    
    if (selected.length === 0) {
      alert('Please select at least one student')
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
      alert(`Failed to remove students: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setConfirmDelete(null)
    }
  }

  const handleAssignGroup = async (groupId: string) => {
    // TODO: Implement group assignment to load
    // For now just show alert
    alert('Group assignment will be implemented in Load Builder. This group is ready to be assigned together!')
  }

  const filteredTandem = ungroupedTandem.filter(s => 
    s.name.toLowerCase().includes(searchTandem.toLowerCase()) ||
    s.weight.toString().includes(searchTandem)
  )

  const filteredAFF = ungroupedAFF.filter(s =>
    s.name.toLowerCase().includes(searchAFF.toLowerCase()) ||
    s.weight.toString().includes(searchAFF) ||
    (s.affLevel && s.affLevel.toLowerCase().includes(searchAFF.toLowerCase()))
  )

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
                2. Click "Create Group" to keep them together<br/>
                3. Use "Assign Group" to put entire party on same load<br/>
                4. Groups ensure families/parties jump together
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* TANDEM QUEUE */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">🪂 Tandem Queue</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  📥 Import
                </button>
                <button
                  onClick={() => handleAddStudent('tandem')}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  + Add Student
                </button>
              </div>
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchTandem}
              onChange={(e) => setSearchTandem(e.target.value)}
              placeholder="🔍 Search by name or weight..."
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white mb-4 focus:outline-none focus:border-blue-500"
            />

            {/* Selection Actions */}
            {selectedTandem.length > 0 && (
              <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-3 mb-4 flex items-center justify-between">
                <span className="text-blue-300 font-semibold">
                  {selectedTandem.length} selected
                </span>
                <div className="flex gap-2">
                  {selectedTandem.length >= 2 && (
                    <button
                      onClick={() => handleCreateGroup('tandem')}
                      className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      👥 Create Group
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSelected('tandem')}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm"
                  >
                    🗑️ Remove
                  </button>
                  <button
                    onClick={() => setSelectedTandem([])}
                    className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-1 px-3 rounded text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Groups */}
            {tandemGroups.length > 0 && (
              <div className="mb-4 space-y-3">
                <h3 className="text-lg font-bold text-purple-300">👥 Groups</h3>
                {tandemGroups.map((group, idx) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onAssignGroup={handleAssignGroup}
                  />
                ))}
              </div>
            )}

            {/* Individual Students */}
            {filteredTandem.length > 0 ? (
              <div className="space-y-3">
                {tandemGroups.length > 0 && (
                  <h3 className="text-lg font-bold text-slate-300">Individual Students</h3>
                )}
                {filteredTandem.map(student => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    selected={selectedTandem.includes(student.id)}
                    onToggle={() => toggleSelection(student.id, 'tandem')}
                    onEdit={() => handleEditStudent(student)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                {searchTandem ? 'No students match your search' : 'No tandem students in queue'}
              </div>
            )}
          </div>

          {/* AFF QUEUE */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">🎓 AFF Queue</h2>
              <button
                onClick={() => handleAddStudent('aff')}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                + Add Student
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchAFF}
              onChange={(e) => setSearchAFF(e.target.value)}
              placeholder="🔍 Search by name, weight, or level..."
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white mb-4 focus:outline-none focus:border-blue-500"
            />

            {/* Selection Actions */}
            {selectedAFF.length > 0 && (
              <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-3 mb-4 flex items-center justify-between">
                <span className="text-blue-300 font-semibold">
                  {selectedAFF.length} selected
                </span>
                <div className="flex gap-2">
                  {selectedAFF.length >= 2 && (
                    <button
                      onClick={() => handleCreateGroup('aff')}
                      className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      👥 Create Group
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveSelected('aff')}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm"
                  >
                    🗑️ Remove
                  </button>
                  <button
                    onClick={() => setSelectedAFF([])}
                    className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-1 px-3 rounded text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Groups */}
            {affGroups.length > 0 && (
              <div className="mb-4 space-y-3">
                <h3 className="text-lg font-bold text-purple-300">👥 Groups</h3>
                {affGroups.map((group, idx) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onAssignGroup={handleAssignGroup}
                  />
                ))}
              </div>
            )}

            {/* Individual Students */}
            {filteredAFF.length > 0 ? (
              <div className="space-y-3">
                {affGroups.length > 0 && (
                  <h3 className="text-lg font-bold text-slate-300">Individual Students</h3>
                )}
                {filteredAFF.map(student => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    selected={selectedAFF.includes(student.id)}
                    onToggleSelect={() => toggleSelection(student.id, 'aff')}
                    onEdit={() => handleEditStudent(student)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                {searchAFF ? 'No students match your search' : 'No AFF students in queue'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddStudentModal
          queueType={modalQueueType}
          onClose={() => setShowAddModal(false)}
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
          title={`Remove ${confirmDelete.count} student${confirmDelete.count > 1 ? 's' : ''}?`}
          message="This will permanently remove these students from the queue."
          onConfirm={confirmRemoval}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showCreateGroupModal && (
        <CreateGroupModal
          selectedStudents={groupQueueType === 'tandem' ? selectedTandemStudents : selectedAFFStudents}
          onClose={() => setShowCreateGroupModal(false)}
          onSuccess={handleGroupCreated}
        />
      )}

      {showImportModal && (
        <ImportStudentsModal
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}