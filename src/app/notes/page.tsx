'use client'

import { useState, useEffect } from 'react'
import { ref, onValue, set } from 'firebase/database'
import { database } from '@/lib/firebase'
import { useToast } from '@/contexts/ToastContext'
import { RequireRole } from '@/components/auth'

function NotesPageContent() {
  const toast = useToast()
  const [notes, setNotes] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Load notes from Firebase on mount
  useEffect(() => {
    let mounted = true
    const notesRef = ref(database, 'testingNotes')

    const unsubscribe = onValue(notesRef, (snapshot) => {
      if (!mounted) return

      const data = snapshot.val()
      if (data?.content) {
        setNotes(data.content)
        if (data.lastModified) {
          setLastSaved(new Date(data.lastModified))
        }
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  // Save notes to Firebase with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (notes !== '') {
        saveNotes()
      }
    }, 1000) // Wait 1 second after typing stops

    return () => clearTimeout(timer)
  }, [notes])

  const saveNotes = async () => {
    setIsSaving(true)
    try {
      const notesRef = ref(database, 'testingNotes')
      await set(notesRef, {
        content: notes,
        lastModified: new Date().toISOString()
      })
      setLastSaved(new Date())
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error('Failed to save notes', 'Your changes may not be saved.')
    } finally{
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">📝 Testing Notes</h1>
              <p className="text-slate-300">
                Type your testing notes here. They'll sync automatically across all devices.
              </p>
            </div>
            <div className="text-right">
              {isSaving && (
                <div className="text-yellow-400 text-sm flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                  Saving...
                </div>
              )}
              {!isSaving && lastSaved && (
                <div className="text-green-400 text-sm">
                  ✓ Last saved: {lastSaved.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Start typing your testing notes here...

Examples:
- Bugs found
- Features tested
- Edge cases discovered
- Questions or feedback"
            className="w-full h-[600px] bg-white/5 border border-white/20 rounded-lg p-6 text-white placeholder-slate-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />

          <div className="mt-4 flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              Auto-saves after 1 second of typing
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
              Syncs in real-time across devices
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotesPage() {
  return (
    <RequireRole roles={["admin", "manifest", "instructor"]}>
      <NotesPageContent />
    </RequireRole>
  )
}
