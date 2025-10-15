// src/app/queue/page.tsx - FIXED VERSION WITH PROPER GROUP VISUAL HANDLING

'use client'

import React, { useState, useMemo } from 'react'
import { useTandemQueue, useAFFQueue, useRemoveMultipleFromQueue, useGroups } from '@/hooks/useDatabase'
import { AddToQueueModal } from '@/components/AddToQueueModal'  // ✅ CHANGED: New modal component
import { EditStudentModal } from '@/components/EditStudentModal'
import { StudentCard } from '@/components/StudentCard'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import { CreateGroupModal } from '@/components/CreateGroupModal'
import { GroupCard } from '@/components/GroupCard'
import { ImportStudentsModal } from '@/components/ImportStudentsModal'
import type { QueueStudent, Group } from '@/types'

// Extended Group type to include students
interface GroupWithStudents extends Group {
  students: QueueStudent[]
}

export default function QueuePage() {
  const { data: tandemQueue, loading: tandemLoading } = useTandemQueue()
  const { data: affQueue, loading: affLoading } = useAFFQueue()
  const { data: groups } = useGroups()
  const { removeMultiple, loading: removeLoading } = useRemoveMultipleFromQueue()
  
  const [showAddModal, setShowAddModal] = useState(false)
  // ✅ REMOVED: const [modalQueueType, setModalQueueType] = useState<'tandem' | 'aff'>('tandem')
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

  // 🔥 FIXED: Separate grouped and ungrouped students using groupId property on students
  const { tandemGroups, ungroupedTandem } = useMemo(() => {
    // Find all tandem students that have a groupId
    const studentsWithGroups = tandemQueue.filter(s => s.groupId)
    
    // Group students by their groupId
    const groupMap = new Map<string, QueueStudent[]>()
    studentsWithGroups.forEach(student => {
      const groupId = student.groupId!
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(student)
    })
    
    // Create group objects with students
    const tandemGroupsWithStudents: GroupWithStudents[] = Array.from(groupMap.entries())
      .map(([groupId, students]) => {
        const groupDoc = groups.find(g => g.id === groupId)
        if (!groupDoc) return null
        return { ...groupDoc, students }
      })
      .filter((g): g is GroupWithStudents => g !== null)
    
    // Get ungrouped students (those without a groupId)
    const groupedIds = new Set(studentsWithGroups.map(s => s.id))
    const ungrouped = tandemQueue.filter(s => !groupedIds.has(s.id))
    
    return { 
      tandemGroups: tandemGroupsWithStudents, 
      ungroupedTandem: ungrouped 
    }
  }, [groups, tandemQueue])

  const { affGroups, ungroupedAFF } = useMemo(() => {
    // Find all AFF students that have a groupId
    const studentsWithGroups = affQueue.filter(s => s.groupId)
    
    // Group students by their groupId
    const groupMap = new Map<string, QueueStudent[]>()
    studentsWithGroups.forEach(student => {
      const groupId = student.groupId!
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(student)
    })
    
    // Create group objects with students
    const affGroupsWithStudents: GroupWithStudents[] = Array.from(groupMap.entries())
      .map(([groupId, students]) => {
        const groupDoc = groups.find(g => g.id === groupId)
        if (!groupDoc) return null
        return { ...groupDoc, students }
      })
      .filter((g): g is GroupWithStudents => g !== null)
    
    // Get ungrouped students (those without a groupId)
    const groupedIds = new Set(studentsWithGroups.map(s => s.id))
    const ungrouped = affQueue.filter(s => !groupedIds.has(s.id))
    
    return { 
      affGroups: affGroupsWithStudents, 
      ungroupedAFF: ungrouped 
    }
  }, [groups, affQueue])

  // ✅ CHANGED: Simplified to just open modal (no queue type needed)
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
    alert('Drag the entire group card to a load in the Load Builder page to assign all students together!')
  }

  // 🔥 NEW: Group drag handler
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('groupId', groupId)
    e.dataTransfer.setData('type', 'group')
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  // 🔥 NEW: Student drag handler
  const handleStudentDragStart = (e: React.DragEvent, studentId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('studentId', studentId)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
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
                2. Click "Create Group" to group them together<br/>
                3. Drag entire group card to Load Builder to assign all students at once<br/>
                4. Groups returned from loads will maintain their visual grouping
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tandem Queue */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-green-400">🪂 Tandem Queue ({tandemQueue.length})</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  📋 Import
                </button>
                <button
                  onClick={handleAddStudent}  // ✅ CHANGED: No type parameter needed
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  + Add Student
                </button>
              </div>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by name or weight..."
              value={searchTandem}
              onChange={(e) => setSearchTandem(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-slate-400 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {/* Selection Actions */}
            {selectedTandem.length > 0 && (
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-blue-300 font-semibold">
                    {selectedTandem.length} student{selectedTandem.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCreateGroup('tandem')}
                      disabled={selectedTandem.length < 2}
                      className="bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Create Group
                    </button>
                    <button
                      onClick={() => handleRemoveSelected('tandem')}
                      disabled={removeLoading}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setSelectedTandem([])}
                      className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 🔥 FIXED: Groups with proper visual containers */}
            {tandemGroups.length > 0 && (
              <div className="mb-4 space-y-3">
                <h3 className="text-lg font-bold text-purple-300">👥 Groups</h3>
                {tandemGroups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onAssignGroup={handleAssignGroup}
                    draggable={true}
                    onDragStart={handleGroupDragStart}
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
                    draggable={true}
                    onDragStart={(e) => handleStudentDragStart(e, student.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                {searchTandem ? 'No students match your search' : tandemGroups.length > 0 ? 'No individual students' : 'No tandem students in queue'}
              </div>
            )}
          </div>

          {/* AFF Queue */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-blue-400">🎯 AFF Queue ({affQueue.length})</h2>
              <button
                onClick={handleAddStudent}  // ✅ CHANGED: No type parameter needed
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                + Add Student
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by name, weight, or level..."
              value={searchAFF}
              onChange={(e) => setSearchAFF(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-slate-400 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Selection Actions */}
            {selectedAFF.length > 0 && (
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-blue-300 font-semibold">
                    {selectedAFF.length} student{selectedAFF.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCreateGroup('aff')}
                      disabled={selectedAFF.length < 2}
                      className="bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Create Group
                    </button>
                    <button
                      onClick={() => handleRemoveSelected('aff')}
                      disabled={removeLoading}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setSelectedAFF([])}
                      className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 🔥 FIXED: Groups with proper visual containers */}
            {affGroups.length > 0 && (
              <div className="mb-4 space-y-3">
                <h3 className="text-lg font-bold text-purple-300">👥 Groups</h3>
                {affGroups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    onAssignGroup={handleAssignGroup}
                    draggable={true}
                    onDragStart={handleGroupDragStart}
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
                    onToggle={() => toggleSelection(student.id, 'aff')}
                    onEdit={() => handleEditStudent(student)}
                    draggable={true}
                    onDragStart={(e) => handleStudentDragStart(e, student.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                {searchAFF ? 'No students match your search' : affGroups.length > 0 ? 'No individual students' : 'No AFF students in queue'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* ✅ CHANGED: New modal component with different props */}
      {showAddModal && (
        <AddToQueueModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            // Queue auto-refreshes via realtime subscription
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
          onGroupCreated={handleGroupCreated}
        />
      )}

      {showImportModal && (
        <ImportStudentsModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  )
}