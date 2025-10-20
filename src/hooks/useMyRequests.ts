// src/hooks/useMyRequests.ts
// Hook for fetching and subscribing to current user's fun jumper requests

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FunJumperRequestService } from '@/lib/funJumperRequests'
import type { FunJumperRequest } from '@/types'

interface UseMyRequestsResult {
  data: FunJumperRequest[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

/**
 * Hook to fetch and subscribe to the current user's fun jumper requests
 * @returns User's requests with loading/error states
 */
export function useMyRequests(): UseMyRequestsResult {
  const { user } = useAuth()
  const [data, setData] = useState<FunJumperRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!user) {
      setData([])
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)
    setError(null)

    const unsubscribe = FunJumperRequestService.subscribeToUserRequests(
      user.uid,
      (requests) => {
        if (mounted) {
          setData(requests)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [user, refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return { data, loading, error, refresh }
}
