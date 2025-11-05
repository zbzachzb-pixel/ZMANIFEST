# Load Deletion with Student Return to Queue - Implementation Plan

## Summary

**Feature Request**: Allow deleting a load that has students assigned, with automatic return of students to the queue.

**Current State**: Safety check at `LoadBuilderCard.tsx:927-934` prevents deleting loads with students.

**Status**: ⚠️ **NOT SAFE TO IMPLEMENT WITHOUT FIXES** - 8 critical issues identified

---

## Critical Issues Found

### 1. No Transaction Support - Partial Failure Risk ⚠️⚠️⚠️
**Location**: `LoadBuilderCard.tsx:946-975`

**Problem**: Operations run sequentially without atomicity:
- Students added to queue ✅
- Load deletion fails ❌
- **Result**: Students duplicated (in queue + on load)

**Fix Required**: Use Firebase multi-location update for atomic batch operation.

---

### 2. Race Condition - Stale Queue Data ⚠️⚠️⚠️
**Location**: `LoadBuilderCard.tsx:944`

**Problem**: Queue fetched once at start, but another user could modify it during processing.

**Scenario**:
```
T0: User A fetches queue (Alice not in queue)
T1: User B adds Alice to queue
T2: User A adds Alice to queue → DUPLICATED
```

**Fix Required**: Use atomic operations or check for duplicates before adding.

---

### 3. Incomplete Field Updates ⚠️⚠️⚠️
**Location**: `LoadBuilderCard.tsx:951-956`

**Problem**: Only updates `groupId` for existing students, other field changes lost.

**Example**:
- Alice in queue with weight: 150
- Alice assigned to load, weight updated to 155
- Load deleted → Alice returned with OLD weight (150)

**Fix Required**: Update ALL fields when student already exists in queue.

---

### 4. Falsy Values Lost ⚠️⚠️⚠️
**Location**: `LoadBuilderCard.tsx:965-972`

**Problem**: Truthy checks exclude falsy values:
```typescript
...(assignment.tandemWeightTax && {  // ❌ 0 is falsy, excluded!
  tandemWeightTax: assignment.tandemWeightTax
})
```

**Data Loss**:
- `tandemWeightTax: 0` → lost
- `tandemHandcam: false` → lost

**Fix Required**: Use nullish coalescing (`??`) instead of truthy checks.

---

### 5. Unsafe Timestamp Fallback ⚠️⚠️
**Location**: `LoadBuilderCard.tsx:492-493`

**Problem**: Uses 24-hour fallback if `originalQueueTimestamp` missing:
```typescript
const timestamp = assignment.originalQueueTimestamp ||
  new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
```

**Issue**: Student gets unfair priority (appears as oldest in queue).

**Fix Required**: Use current time and warn user position couldn't be preserved.

---

### 6. Load State Can Change ⚠️⚠️
**Location**: `LoadBuilderCard.tsx:917`

**Problem**: Status checked before deletion, but another user could change it during processing.

**Scenario**:
```
1. Check: load.status === 'building' ✅
2. Another user marks load as 'ready'
3. Delete executes → Corrupts timers and instructor availability
```

**Fix Required**: Use transaction to validate state hasn't changed.

---

### 7. No Rollback on Partial Failure ⚠️⚠️
**Problem**: If 2 of 5 students added to queue, then error occurs:
- 2 students in queue
- 3 students still on load
- Load not deleted
- **Result**: Inconsistent state

**Fix Required**: Atomic batch operations (all or nothing).

---

### 8. Dead Code ⚠️
**Location**: `LoadBuilderCard.tsx:946-975`

**Problem**: Return-to-queue logic exists but is unreachable due to safety check at line 927-934.

**Fix Required**: This becomes reachable when safety check is removed.

---

## Important Issues (Should Fix)

1. **No instructor assignment cleanup** - Instructors may reference deleted load
2. **Group integrity not verified** - Grouped students could be split
3. **No logging/audit trail** - Impossible to debug when issues occur
4. **Test mode loads not handled** - Could mix test and production data
5. **Fun jumpers ignored** - What happens to fun jumpers on deleted load?
6. **Multi-aircraft not considered** - Could affect per-aircraft load numbering

---

## Recommended Implementation

### Phase 1: Implement Atomic Batch Delete

**File**: `src/services/firebase.ts`

Add new method:
```typescript
async deleteLoadWithStudents(
  loadId: string,
  studentsToReturn: Array<{assignment: LoadAssignment, preservedTimestamp: string}>
): Promise<void> {
  // Build batch update
  const updates: Record<string, any> = {}

  // Add all queue updates
  for (const {assignment, preservedTimestamp} of studentsToReturn) {
    const queueId = this.generateId()
    updates[`queue/${queueId}`] = {
      id: queueId,
      studentAccountId: assignment.studentId,
      name: assignment.studentName,
      weight: assignment.studentWeight,
      jumpType: assignment.jumpType,
      timestamp: preservedTimestamp,
      isRequest: assignment.isRequest,
      groupId: assignment.groupId ?? null,
      tandemWeightTax: assignment.tandemWeightTax ?? null,
      tandemHandcam: assignment.tandemHandcam ?? null,
      outsideVideo: assignment.hasOutsideVideo ?? null,
      affLevel: assignment.affLevel ?? null,
    }
  }

  // Add load deletion
  updates[`loads/${loadId}`] = null

  // Execute atomically
  await update(ref(this.db, '/'), updates)
}
```

---

### Phase 2: Update handleDelete in LoadBuilderCard

**File**: `src/components/LoadBuilderCard.tsx`

Replace lines 915-985 with:
```typescript
const handleDelete = async () => {
  // Status check
  if (load.status !== 'building') {
    toast.error('Only building loads can be deleted')
    return
  }

  try {
    // Build student return data
    const studentsToReturn = loadAssignments.map(assignment => {
      let timestamp = assignment.originalQueueTimestamp

      // Validate timestamp
      if (!timestamp || new Date(timestamp).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000) {
        console.warn(`${assignment.studentName} queue position could not be preserved`)
        timestamp = new Date().toISOString()
      }

      return { assignment, preservedTimestamp: timestamp }
    })

    // Log operation
    console.log('🗑️ DELETE LOAD', {
      loadId: load.id,
      position: load.position,
      studentCount: loadAssignments.length,
      students: loadAssignments.map(a => a.studentName)
    })

    // Execute atomic deletion
    await db.deleteLoadWithStudents(load.id, studentsToReturn)

    toast.success(`Load deleted. ${loadAssignments.length} students returned to queue.`)
    setShowDeleteConfirm(false)

  } catch (error) {
    console.error('Failed to delete load:', error)
    toast.error('Failed to delete load - no changes made')
  }
}
```

---

### Phase 3: Remove Safety Check

**File**: `src/components/LoadBuilderCard.tsx`

**Remove lines 927-934**:
```typescript
// ❌ DELETE THIS:
if (loadAssignments.length > 0) {
  toast.error('Cannot delete load with students assigned.')
  return
}
```

---

### Phase 4: Enhance Confirmation Modal

**File**: `src/components/LoadModals.tsx`

Update `DeleteConfirmModal` to show:
- Student count
- Student names
- Warning about irreversibility

---

## Testing Checklist

### Unit Tests
- [ ] Delete load with 1 student → returns to queue
- [ ] Delete load with 5 students → all return to queue
- [ ] Delete load with grouped students → group preserved
- [ ] Student with `tandemWeightTax: 0` → preserved correctly
- [ ] Student with `tandemHandcam: false` → preserved correctly
- [ ] Student with missing timestamp → uses current time
- [ ] Try delete ready load → blocked
- [ ] Try delete departed load → blocked
- [ ] Try delete completed load → blocked

### Integration Tests
- [ ] Concurrent deletion by two users → no duplicates
- [ ] Student added to queue while deletion processing → no duplicates
- [ ] Partial failure scenario → rollback works
- [ ] Load state changes during deletion → blocked

### Manual Testing
- [ ] Delete load, verify students in correct queue position
- [ ] Delete load with groups, verify group intact
- [ ] Verify no duplicated students in queue
- [ ] Verify no orphaned load references
- [ ] Test in production and test mode separately

---

## Alternative Approaches

### Option 1: Keep Safety Check (Recommended for now)
- **Pros**: Zero risk, proven pattern
- **Cons**: Requires manual student removal first
- **Recommendation**: Safest option until all fixes implemented

### Option 2: Soft Delete
- Mark load as `isDeleted: true` instead of removing
- Students stay on load
- Can be undeleted
- Requires cleanup job

### Option 3: Cancelled Status
- Add new status: `'cancelled'`
- Return students to queue
- Keep load for audit trail
- Reversible

---

## Estimated Implementation Effort

- **Phase 1** (Atomic batch delete): 2 hours
- **Phase 2** (Update handleDelete): 1 hour
- **Phase 3** (Remove safety check): 5 minutes
- **Phase 4** (Enhance modal): 1 hour
- **Testing**: 3-4 hours
- **Total**: ~8 hours development + testing

---

## Current Recommendation

**DO NOT IMPLEMENT** until all 8 critical issues are fixed.

**If must proceed**:
1. Implement all critical fixes
2. Add comprehensive testing
3. Deploy behind feature flag
4. Monitor closely for data issues
5. Have rollback plan ready

---

## Files to Modify

1. `src/services/firebase.ts` - Add atomic batch delete method
2. `src/components/LoadBuilderCard.tsx` - Update handleDelete, remove safety check
3. `src/components/LoadModals.tsx` - Enhance confirmation modal
4. `src/types/index.ts` - No changes needed

---

## Related Code

- **Existing removeFromLoad**: `LoadBuilderCard.tsx:473-514` (similar logic, works well)
- **Load deletion**: `firebase.ts:477-480`
- **Queue operations**: `firebase.ts:625-646`
- **Safety checks**: `LoadBuilderCard.tsx:915-934`

---

## Notes

- Firebase Realtime Database doesn't support true multi-path transactions
- Using multi-location update provides pseudo-atomic behavior
- All updates succeed or all fail (no partial state)
- Race conditions still possible with concurrent users
- Optimistic concurrency control recommended for production

---

**Document created**: 2025-11-05
**Status**: Planning - awaiting implementation decision
**Risk level**: HIGH without fixes, MEDIUM with all fixes implemented
