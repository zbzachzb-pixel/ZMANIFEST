'use client'

import React from 'react'
import type { Load } from '@/types'
import { useUpdateLoad, useDeleteLoad } from '@/hooks/useDatabase'

interface LoadCardProps {
  load: Load
}

export function LoadCard({ load }: LoadCardProps) {
  const { update, loading: updateLoading } = useUpdateLoad()
  const { deleteLoad, loading: deleteLoading } = useDeleteLoad()
  
  console.log('LoadCard render:', { loadId: load.id, updateLoading, deleteLoading })
  
  const loading = updateLoading || deleteLoading
  
  const testClick = () => {
    console.log('🎯 TEST BUTTON CLICKED!')
    alert('Button works!')
  }
  
  const handleStatusChange = async (newStatus: Load['status']) => {
    console.log('🔄 Status change clicked:', { loadId: load.id, newStatus })
    try {
      await update(load.id, { status: newStatus })
      console.log('✅ Status updated')
    } catch (error) {
      console.error('❌ Failed:', error)
      alert('Failed to update: ' + error)
    }
  }
  
  const handleDelete = async () => {
    console.log('🗑️ Delete clicked:', load.id)
    console.log('🔍 About to call deleteLoad function...')
    
    try {
      console.log('⏳ Calling deleteLoad now...')
      await deleteLoad(load.id)
      console.log('✅ DELETE COMPLETED SUCCESSFULLY!')
    } catch (error) {
      console.error('❌ DELETE FAILED:', error)
      alert('Failed to delete: ' + error)
    }
  }
  
  return (
    <div className="rounded-xl shadow-lg p-6 border-2 border-blue-500 bg-blue-500/10">
      <h3 className="text-xl font-bold text-white mb-4">{load.name}</h3>
      
      <div className="space-y-2">
        {/* TEST BUTTON */}
        <button
          onClick={testClick}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg"
        >
          🎯 TEST - Click Me First!
        </button>
        
        {/* STATUS BUTTONS */}
        {load.status === 'building' && (
          <button
            onClick={() => {
              console.log('Button clicked!');
              handleStatusChange('ready');
            }}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {loading ? '⏳ Loading...' : '✓ Mark Ready'}
          </button>
        )}
        
        {/* DELETE BUTTON */}
        <button
          onClick={() => {
            console.log('Delete button clicked!');
            handleDelete();
          }}
          disabled={loading}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
        >
          {loading ? '⏳ Loading...' : '🗑️ DELETE LOAD'}
        </button>
      </div>
    </div>
  )
}