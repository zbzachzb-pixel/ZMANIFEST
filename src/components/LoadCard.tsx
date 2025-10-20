'use client'

import React from 'react'
import type { Load } from '@/types'
import { useUpdateLoad, useDeleteLoad } from '@/hooks/useDatabase'
import { useToast } from '@/contexts/ToastContext'

interface LoadCardProps {
  load: Load
}

export function LoadCard({ load }: LoadCardProps) {
  const { update, loading: updateLoading } = useUpdateLoad()
  const { deleteLoad, loading: deleteLoading } = useDeleteLoad()
  const toast = useToast()

  const loading = updateLoading || deleteLoading

  const handleStatusChange = async (newStatus: Load['status']) => {
    try {
      await update(load.id, { status: newStatus })
    } catch (error) {
      console.error('Failed to update load status:', error)
      toast.error('Failed to update', String(error))
    }
  }

  const handleDelete = async () => {
    try {
      await deleteLoad(load.id)
    } catch (error) {
      console.error('Failed to delete load:', error)
      toast.error('Failed to delete', String(error))
    }
  }
  
  return (
    <div className="rounded-xl shadow-lg p-6 border-2 border-blue-500 bg-blue-500/10">
      <h3 className="text-xl font-bold text-white mb-4">{load.name}</h3>
      
      <div className="space-y-2">
        {load.status === 'building' && (
          <button
            onClick={() => handleStatusChange('ready')}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Mark Ready'}
          </button>
        )}

        <button
          onClick={handleDelete}
          disabled={loading}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Delete Load'}
        </button>
      </div>
    </div>
  )
}