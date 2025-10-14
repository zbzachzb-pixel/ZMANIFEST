// src/app/queue/page.tsx
'use client'

import React, { useState } from 'react'
import { useTandemQueue, useAFFQueue, useRemoveMultipleFromQueue } from '@/hooks/useDatabase'
import { db } from '@/services'
import { AddStudentModal } from '@/components/AddStudentModal'
import { EditStudentModal } from '@/components/EditStudentModal'
import { StudentCard } from '@/components/StudentCard'
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal'
import type { QueueStudent } from '@/types'
import { ImportStudentsModal } from '@/components/ImportStudentsModal'

export default function QueuePage() {
  const { data: tandemQueue, loading: tandemLoading } = useTandemQueue()
  const { data: affQueue, loading: affLoading } = useAFFQueue()
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
  
  const handleRemoveSelected = (type: 'tandem' | 'aff') => {
    const selected = type === 'tandem' ? selectedTandem : selectedAFF
    
    if (selected.length === 0) {
      alert('Please select at least one student')
      return
    }
    
    // Show confirmation modal
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
  
  const filteredTandem = tandemQueue.filter(s => 
    s.name.toLowerCase().includes(searchTandem.toLowerCase()) ||
    s.weight.toString().includes(searchTandem)
  )
  
  const filteredAFF = affQueue.filter(s =>
    s.name.toLowerCase().includes(searchAFF.toLowerCase()) ||
    s.weight.toString().includes(searchAFF) ||
    (s.affLevel && s.affLevel.toLowerCase().includes(searchAFF.toLowerCase()))
  )
  
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
          <p className="text-slate-300">Add students here, then use Load Builder to assign them</p>
        </div>
        
        {/* Info Banner */}
        <div className="bg-blue-500/20 border-2 border-blue-500/50 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <div className="font-bold text-blue-300 mb-1">How to Assign Students</div>
              <p className="text-sm text-slate-300">
                1. Add students to this queue<br/>
                2. Go to <a href="/loads" className="text-blue-400 hover:text-blue-300 font-semibold underline">Load Builder</a><br/>
                3. Drag students from queue onto loads
              </p>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Tandem Queue */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Tandem Queue</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddStudent('tandem')}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span className="text-lg">+</span> Add Student
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                  📥 Import
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="🔍 Search by name or weight..."
                value={searchTandem}
                onChange={(e) => setSearchTandem(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div className="space-y-3 mb-4">
              {filteredTandem.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
                  <div className="text-4xl mb-2">🪂</div>
                  <p className="text-slate-300">No tandem students in queue</p>
                </div>
              ) : (
                filteredTandem.map(student => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    selected={selectedTandem.includes(student.id)}
                    onToggle={() => toggleSelection(student.id, 'tandem')}
                    onEdit={() => handleEditStudent(student)}
                  />
                ))
              )}
            </div>
            
            {selectedTandem.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleRemoveSelected('tandem')}
                  disabled={removeLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  {removeLoading ? '⏳ Removing...' : `🗑️ Remove Selected (${selectedTandem.length})`}
                </button>
                <button
                  onClick={() => setSelectedTandem([])}
                  className="px-4 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          
          {/* AFF Queue */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">AFF Queue</h2>
              <button
                onClick={() => handleAddStudent('aff')}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="text-lg">+</span> Add Student
              </button>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="🔍 Search by name, weight, or level..."
                value={searchAFF}
                onChange={(e) => setSearchAFF(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div className="space-y-3 mb-4">
              {filteredAFF.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
                  <div className="text-4xl mb-2">🎓</div>
                  <p className="text-slate-300">No AFF students in queue</p>
                </div>
              ) : (
                filteredAFF.map(student => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    selected={selectedAFF.includes(student.id)}
                    onToggle={() => toggleSelection(student.id, 'aff')}
                    onEdit={() => handleEditStudent(student)}
                  />
                ))
              )}
            </div>
            
            {selectedAFF.length > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleRemoveSelected('aff')}
                  disabled={removeLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  {removeLoading ? '⏳ Removing...' : `🗑️ Remove Selected (${selectedAFF.length})`}
                </button>
                <button
                  onClick={() => setSelectedAFF([])}
                  className="px-4 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
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
          count={confirmDelete.count}
          onConfirm={confirmRemoval}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      
      {showImportModal && (
        <ImportStudentsModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  )
}