// src/hooks/useUsers.ts
// Hook for managing user profiles

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/services'
import type { UserProfile } from '@/types/funJumpers'

interface UseUsersResult {
  data: UserProfile[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

/**
 * Hook to fetch and subscribe to all user profiles
 * @returns User profiles with loading/error states
 */
export function useUsers(): UseUsersResult {
  const [data, setData] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    try {
      const unsubscribe = db.subscribeToUserProfiles((users) => {
        if (mounted) {
          setData(users)
          setLoading(false)
        }
      })

      return () => {
        mounted = false
        unsubscribe()
      }
    } catch (err) {
      if (mounted) {
        setError(err instanceof Error ? err : new Error('Failed to subscribe to users'))
        setLoading(false)
      }
    }
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return { data, loading, error, refresh }
}

/**
 * Hook to fetch and subscribe to active user profiles only
 * @returns Active user profiles with loading/error states
 */
export function useActiveUsers(): UseUsersResult {
  const { data: allUsers, loading, error, refresh } = useUsers()

  const activeUsers = allUsers.filter(user => user.isActive)

  return { data: activeUsers, loading, error, refresh }
}
