// src/hooks/useRequestsData.ts
// Combined hook for loading requests and loads data efficiently

import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { database } from '@/lib/firebase'
import type { FunJumperRequest, Load } from '@/types'

export interface RequestsData {
  requests: FunJumperRequest[]
  loads: Load[]
  loading: boolean
  error: string | null
}

/**
 * Custom hook that combines Firebase listeners for requests and loads
 * More efficient than separate listeners - reduces network overhead
 */
export function useRequestsData() {
  const [data, setData] = useState<RequestsData>({
    requests: [],
    loads: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    let requestsLoaded = false
    let loadsLoaded = false

    const checkComplete = () => {
      if (requestsLoaded && loadsLoaded) {
        setData(prev => ({ ...prev, loading: false }))
      }
    }

    // Listen to requests
    const requestsRef = ref(database, 'funJumperRequests')
    const unsubscribeRequests = onValue(
      requestsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const requestsData: FunJumperRequest[] = []
          snapshot.forEach(child => {
            requestsData.push(child.val() as FunJumperRequest)
          })

          // Sort by creation time (newest first)
          requestsData.sort((a, b) => b.createdAt - a.createdAt)

          setData(prev => ({ ...prev, requests: requestsData }))
        } else {
          setData(prev => ({ ...prev, requests: [] }))
        }
        requestsLoaded = true
        checkComplete()
      },
      (error) => {
        console.error('Failed to load requests:', error)
        setData(prev => ({ ...prev, error: error.message, loading: false }))
      }
    )

    // Listen to loads
    const loadsRef = ref(database, 'loads')
    const unsubscribeLoads = onValue(
      loadsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const loadsData: Load[] = []
          snapshot.forEach(child => {
            loadsData.push(child.val() as Load)
          })

          // Sort by position
          loadsData.sort((a, b) => (a.position || 0) - (b.position || 0))

          setData(prev => ({ ...prev, loads: loadsData }))
        } else {
          setData(prev => ({ ...prev, loads: [] }))
        }
        loadsLoaded = true
        checkComplete()
      },
      (error) => {
        console.error('Failed to load loads:', error)
        setData(prev => ({ ...prev, error: error.message, loading: false }))
      }
    )

    // Cleanup both listeners
    return () => {
      unsubscribeRequests()
      unsubscribeLoads()
    }
  }, [])

  return data
}

/**
 * Hook for loading available loads (building/ready only)
 * Used by submit-request page
 */
export function useAvailableLoads() {
  const [loads, setLoads] = useState<Load[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadsRef = ref(database, 'loads')

    const unsubscribe = onValue(loadsRef, (snapshot) => {
      if (snapshot.exists()) {
        const loadsData: Load[] = []
        snapshot.forEach(child => {
          const load = child.val() as Load
          // Only show building/ready loads
          if (load.status === 'building' || load.status === 'ready') {
            loadsData.push(load)
          }
        })

        loadsData.sort((a, b) => (a.position || 0) - (b.position || 0))
        setLoads(loadsData)
      } else {
        setLoads([])
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { loads, loading }
}
