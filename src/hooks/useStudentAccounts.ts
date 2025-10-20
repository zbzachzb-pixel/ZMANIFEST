// src/hooks/useStudentAccounts.ts
import { useState, useCallback, useEffect } from 'react'
import { db } from '@/services'
import type { StudentAccount, CreateStudentAccount, UpdateStudentAccount } from '@/types'

function useRealtimeData<T>(
  subscriber: (callback: (data: T[]) => void) => () => void
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    try {
      const unsubscribe = subscriber((data) => {
        if (mounted) {
          setData(data)
          setLoading(false)
        }
      })

      return () => {
        mounted = false
        if (typeof unsubscribe === 'function') {
          unsubscribe()
        }
      }
    } catch (err) {
      if (mounted) {
        setError(err as Error)
        setLoading(false)
      }
      console.error('Firebase subscription error:', err)
      return undefined
    }
  }, [subscriber, refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  return { data, loading, error, refresh }
}

export function useStudentAccounts() {
  return useRealtimeData<StudentAccount>(db.subscribeToStudentAccounts)
}

export function useActiveStudentAccounts() {
  const { data: allAccounts, loading, error, refresh } = useStudentAccounts()
  const activeAccounts = allAccounts.filter(account => account.isActive)
  return { data: activeAccounts, loading, error, refresh }
}

export function useCreateStudentAccount() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (account: CreateStudentAccount) => {
    setLoading(true)
    setError(null)
    try {
      const newAccount = await db.createStudentAccount(account)
      return newAccount
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}

export function useUpdateStudentAccount() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (id: string, updates: UpdateStudentAccount) => {
    setLoading(true)
    setError(null)
    try {
      await db.updateStudentAccount(id, updates)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { update, loading, error }
}

export function useSearchStudentAccounts() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const search = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const results = await db.searchStudentAccounts(query)
      return results
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { search, loading, error }
}

export function useDeactivateStudentAccount() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const deactivate = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await db.deactivateStudentAccount(id)
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { deactivate, loading, error }
}