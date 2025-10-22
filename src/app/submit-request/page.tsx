// src/app/submit-request/page.tsx
// Test Request Submission Page (simulates mobile app)
'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { FunJumperRequestService } from '@/lib/funJumperRequests'
import { useAvailableLoads } from '@/hooks/useRequestsData'
import type { SkyDiveType, UserProfile } from '@/types'
import { RequireAuth } from '@/components/auth'
import { db } from '@/services'

const SKYDIVE_TYPES: { value: SkyDiveType; label: string; icon: string }[] = [
  { value: 'hop_n_pop', label: 'Hop & Pop', icon: '🪂' },
  { value: 'team_pass', label: 'Team Pass', icon: '👥' },
  { value: 'full_altitude', label: 'Full Altitude', icon: '⬆️' },
  { value: 'high_pull', label: 'High Pull', icon: '☁️' },
  { value: 'wingsuit', label: 'Wingsuit', icon: '🦅' },
]

function SubmitRequestPageContent() {
  const { user, userProfile } = useAuth()
  const toast = useToast()
  const router = useRouter()

  // Use optimized hook for loading available loads
  const { loads, loading: loadsLoading } = useAvailableLoads()

  const [selectedLoadIds, setSelectedLoadIds] = useState<string[]>([])
  const [skyDiveType, setSkyDiveType] = useState<SkyDiveType | ''>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Friend selection for groups
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [funJumpers, setFunJumpers] = useState<UserProfile[]>([])
  const [loadingFriends, setLoadingFriends] = useState(true)

  // Load fun jumpers for friend selection
  useEffect(() => {
    const loadFunJumpers = async () => {
      try {
        const profiles = await db.getUserProfiles()
        // Filter to only fun jumpers (excluding current user)
        const funJumperList = profiles.filter(p =>
          p.role === 'fun_jumper' &&
          p.isActive &&
          p.uid !== user?.uid
        )
        setFunJumpers(funJumperList)
      } catch (error) {
        console.error('Failed to load fun jumpers:', error)
      } finally {
        setLoadingFriends(false)
      }
    }

    if (user) {
      loadFunJumpers()
    }
  }, [user])

  const toggleLoad = (loadId: string) => {
    setSelectedLoadIds(prev =>
      prev.includes(loadId)
        ? prev.filter(id => id !== loadId)
        : [...prev, loadId]
    )
  }

  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!user || !userProfile) {
      toast.error('Error', 'Please sign in')
      return
    }

    if (selectedLoadIds.length === 0) {
      toast.error('No loads selected', 'Please select at least one load')
      return
    }

    if (!skyDiveType) {
      toast.error('Jump type required', 'Please select your jump type')
      return
    }

    setSubmitting(true)

    try {
      // Generate shared groupId if friends are selected
      const groupId = selectedFriendIds.length > 0 ? `group_${Date.now()}_${user.uid}` : undefined

      // Create request for current user
      await FunJumperRequestService.createRequest({
        userId: user.uid,
        userName: userProfile.displayName,
        userEmail: userProfile.email,
        jumprunId: userProfile.jumprunId || '',
        requestedLoadIds: selectedLoadIds,
        skyDiveType: skyDiveType as SkyDiveType,
        groupId,
        notes: notes || undefined
      })

      // Create requests for each selected friend with the same groupId
      if (groupId && selectedFriendIds.length > 0) {
        const selectedFriends = funJumpers.filter(fj => selectedFriendIds.includes(fj.uid))

        for (const friend of selectedFriends) {
          await FunJumperRequestService.createRequest({
            userId: friend.uid,
            userName: friend.displayName,
            userEmail: friend.email,
            jumprunId: friend.jumprunId || '',
            requestedLoadIds: selectedLoadIds,
            skyDiveType: skyDiveType as SkyDiveType,
            groupId,
            notes: `Jumping with ${userProfile.displayName}${selectedFriendIds.length > 1 ? ` and ${selectedFriendIds.length - 1} other${selectedFriendIds.length > 2 ? 's' : ''}` : ''}`
          })
        }
      }

      const groupMessage = selectedFriendIds.length > 0
        ? ` (group of ${selectedFriendIds.length + 1})`
        : ''
      toast.success('Request Submitted!', `Your request${groupMessage} for ${selectedLoadIds.length} load(s) has been submitted`)

      // Reset form
      setSelectedLoadIds([])
      setSelectedFriendIds([])
      setSkyDiveType('')
      setNotes('')

      // Redirect to My Requests page
      router.push('/my-requests')
    } catch (error: any) {
      toast.error('Submission Failed', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Auth is handled by RequireAuth wrapper - user is guaranteed to exist here

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Submit Jump Request</h1>
          <p className="text-slate-400">Select loads and jump type (Testing - simulates mobile app)</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Load Selection */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white mb-4">1. Select Loads</h2>
            <p className="text-slate-400 mb-4">Choose one or more loads (you'll be assigned to the first available)</p>

            {loadsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-slate-400">Loading loads...</p>
              </div>
            ) : loads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">No loads available</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {loads.map(load => {
                  const isSelected = selectedLoadIds.includes(load.id)
                  const loadNumber = (load.position || 0) + 1

                  // Calculate available capacity
                  const loadAssignments = load.assignments || []
                  const loadCapacity = load.capacity || 18

                  // Count total people on load
                  const totalPeople = loadAssignments.reduce((sum, assignment) => {
                    let count = 2 // Student + Instructor
                    if (assignment.hasOutsideVideo) count += 1 // + Video Instructor
                    return sum + count
                  }, 0) + (load.funJumpers || []).length  // + Fun Jumpers (1 slot each)

                  const availableSlots = loadCapacity - totalPeople

                  return (
                    <button
                      key={load.id}
                      type="button"
                      onClick={() => toggleLoad(load.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-white/10 bg-slate-900/30 hover:border-blue-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-500'
                        }`}>
                          {isSelected && <span className="text-white text-sm">✓</span>}
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-white">Load {loadNumber}</p>
                          <p className="text-sm text-slate-400">{load.status === 'building' ? 'Building' : 'Ready'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Available</p>
                        <p className={`font-medium ${availableSlots > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {availableSlots} / {loadCapacity}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Jump Type Selection */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white mb-4">2. Select Jump Type</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SKYDIVE_TYPES.map(type => {
                const isSelected = skyDiveType === type.value

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSkyDiveType(type.value)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-white/10 bg-slate-900/30 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="text-center">
                      <p className="text-3xl mb-2">{type.icon}</p>
                      <p className="text-white font-semibold">{type.label}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Friend Selection */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">3. Jump with Friends (Optional)</h2>
                <p className="text-slate-400 text-sm mt-1">Select friends to jump together as a group</p>
              </div>
              {selectedFriendIds.length > 0 && (
                <div className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/40 rounded-lg">
                  <p className="text-purple-300 font-semibold text-sm">
                    👥 Group of {selectedFriendIds.length + 1}
                  </p>
                </div>
              )}
            </div>

            {loadingFriends ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-slate-400">Loading friends...</p>
              </div>
            ) : funJumpers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400">No other fun jumpers available</p>
              </div>
            ) : (
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {funJumpers.map(friend => {
                  const isSelected = selectedFriendIds.includes(friend.uid)

                  return (
                    <button
                      key={friend.uid}
                      type="button"
                      onClick={() => toggleFriend(friend.uid)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-white/10 bg-slate-900/30 hover:border-purple-500/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-purple-500 bg-purple-500' : 'border-slate-500'
                      }`}>
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold truncate">{friend.displayName}</p>
                        {friend.jumprunId && (
                          <p className="text-slate-400 text-xs">JumpRun ID: {friend.jumprunId}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {selectedFriendIds.length > 0 && (
              <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-purple-300 text-sm">
                  ℹ️ All group members must be approved together and will be assigned to the same load.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white mb-4">4. Notes (Optional)</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests or notes for manifest..."
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-slate-400 mt-2">{notes.length}/500 characters</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || selectedLoadIds.length === 0 || !skyDiveType}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none flex items-center justify-center gap-2 text-lg"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <span>✈️</span>
                <span>Submit Request</span>
              </>
            )}
          </button>

          {/* Summary */}
          {selectedLoadIds.length > 0 && skyDiveType && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-green-300 font-semibold mb-2">Summary</p>
              <ul className="text-sm text-green-200 space-y-1">
                <li>• {selectedLoadIds.length} load(s) selected</li>
                <li>• Jump type: {SKYDIVE_TYPES.find(t => t.value === skyDiveType)?.label}</li>
                {selectedFriendIds.length > 0 && (
                  <li>• Group request ({selectedFriendIds.length + 1} jumpers)</li>
                )}
                {notes && <li>• Notes included</li>}
              </ul>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}


export default function SubmitRequestPage() {
  return (
    <RequireAuth>
      <SubmitRequestPageContent />
    </RequireAuth>
  )
}
