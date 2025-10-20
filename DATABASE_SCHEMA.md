# Fun Jumper System - Database Schema Documentation

## Overview

This document describes the Firebase Realtime Database schema for the Fun Jumper request system.

---

## Database Structure

```
firebase-realtime-database/
├── users/                      # User profiles with roles
├── funJumperRequests/          # Jump requests (NEW)
├── funJumperGroups/            # Group requests (NEW - future)
├── loads/                      # Enhanced with funJumpers
├── instructors/                # Existing
├── assignments/                # Existing
├── studentQueue/               # Existing
├── studentAccounts/            # Existing
├── groups/                     # Existing
├── clockEvents/                # Existing
└── periods/                    # Existing
```

---

## New Tables

### `users/{uid}`
Enhanced user profile with authentication and roles.

**Structure:**
```json
{
  "uid": "string",
  "email": "string",
  "displayName": "string",
  "role": "admin | manifest | instructor | fun_jumper",
  "jumprunId": "string?",
  "phoneNumber": "string?",
  "fcmToken": "string?",
  "fcmTokenUpdatedAt": number,
  "platform": "ios | android",

  "notificationsEnabled": boolean,
  "smsNotificationsEnabled": boolean,
  "emailNotificationsEnabled": boolean,

  "createdAt": number,
  "lastLogin": number,
  "isActive": boolean
}
```

**Example:**
```json
{
  "users": {
    "abc123uid": {
      "uid": "abc123uid",
      "email": "john@example.com",
      "displayName": "John Doe",
      "role": "fun_jumper",
      "jumprunId": "JR001",
      "phoneNumber": "+1234567890",
      "fcmToken": "device_token_here",
      "notificationsEnabled": true,
      "smsNotificationsEnabled": true,
      "emailNotificationsEnabled": true,
      "createdAt": 1704067200000,
      "lastLogin": 1704153600000,
      "isActive": true
    }
  }
}
```

**Indexes:**
- `email` - for login lookup
- `role` - for filtering by role
- `jumprunId` - for matching with jump records

---

### `funJumperRequests/{requestId}`
Jump requests submitted by fun jumpers.

**Structure:**
```json
{
  "id": "string",
  "userId": "string",
  "userName": "string",
  "userEmail": "string",
  "jumprunId": "string",

  "requestedLoadIds": ["string"],
  "skyDiveType": "hop_n_pop | team_pass | full_altitude | high_pull | wingsuit",
  "groupId": "string?",
  "notes": "string?",

  "status": "pending | approved | denied | cancelled | completed",
  "assignedLoadId": "string?",
  "autoResolvedLoadIds": ["string"]?,

  "approvedAt": number?,
  "approvedBy": "string?",
  "approvedByName": "string?",
  "approvalNote": "string?",

  "deniedAt": number?,
  "deniedBy": "string?",
  "deniedByName": "string?",
  "denialReason": "string?",

  "cancellationRequested": boolean,
  "cancellationRequestedAt": number?,
  "cancellationNotes": "string?",
  "cancelledAt": number?,
  "cancelledBy": "string?",
  "cancelledByName": "string?",
  "cancellationReason": "string?",

  "completedAt": number?,

  "createdAt": number,
  "updatedAt": number,
  "history": [
    {
      "action": "created | approved | denied | cancelled | auto_resolved",
      "timestamp": number,
      "actorId": "string?",
      "actorName": "string?",
      "note": "string?",
      "oldStatus": "string?",
      "newStatus": "string?"
    }
  ]
}
```

**Example:**
```json
{
  "funJumperRequests": {
    "req_abc123": {
      "id": "req_abc123",
      "userId": "abc123uid",
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "jumprunId": "JR001",

      "requestedLoadIds": ["load_1", "load_2", "load_3"],
      "skyDiveType": "full_altitude",
      "notes": "First jump of the day",

      "status": "approved",
      "assignedLoadId": "load_1",
      "autoResolvedLoadIds": ["load_2", "load_3"],

      "approvedAt": 1704153700000,
      "approvedBy": "xyz789uid",
      "approvedByName": "Manifest Jane",
      "approvalNote": "Assigned to first load",

      "cancellationRequested": false,

      "createdAt": 1704153600000,
      "updatedAt": 1704153700000,
      "history": [
        {
          "action": "created",
          "timestamp": 1704153600000,
          "actorId": "abc123uid",
          "actorName": "John Doe",
          "newStatus": "pending"
        },
        {
          "action": "approved",
          "timestamp": 1704153700000,
          "actorId": "xyz789uid",
          "actorName": "Manifest Jane",
          "oldStatus": "pending",
          "newStatus": "approved",
          "note": "Assigned to first load"
        }
      ]
    }
  }
}
```

**Indexes:**
- `userId` - for querying user's requests
- `status` - for filtering by status
- `assignedLoadId` - for finding requests for a specific load
- `createdAt` - for chronological ordering

---

### `funJumperGroups/{groupId}` (FUTURE FEATURE)
Groups of fun jumpers who want to jump together.

**Structure:**
```json
{
  "id": "string",
  "name": "string",
  "creatorId": "string",
  "creatorName": "string",
  "memberIds": ["string"],
  "createdAt": number
}
```

---

## Enhanced Tables

### `loads/{loadId}` - ENHANCED
Added `funJumpers` array to track fun jumpers on the load.

**New Field:**
```json
{
  "funJumpers": [
    {
      "userId": "string",
      "userName": "string",
      "jumprunId": "string",
      "skyDiveType": "hop_n_pop | team_pass | full_altitude | high_pull | wingsuit",
      "requestId": "string",
      "addedAt": number,
      "addedBy": "string?",
      "addedByName": "string?"
    }
  ]
}
```

**Complete Load Structure:**
```json
{
  "loads": {
    "load_abc123": {
      "id": "load_abc123",
      "name": "Load 1",
      "position": 0,
      "capacity": 18,
      "status": "building",
      "assignments": [...],
      "funJumpers": [
        {
          "userId": "abc123uid",
          "userName": "John Doe",
          "jumprunId": "JR001",
          "skyDiveType": "full_altitude",
          "requestId": "req_abc123",
          "addedAt": 1704153700000,
          "addedBy": "xyz789uid",
          "addedByName": "Manifest Jane"
        }
      ],
      "createdAt": "2024-01-01T10:00:00.000Z",
      "countdownStartTime": "2024-01-01T10:05:00.000Z"
    }
  }
}
```

**Impact on Capacity:**
- Each fun jumper counts as **1 slot** toward total capacity
- Total people = assignments.length + funJumpers.length
- Available slots = capacity - total people

---

## Query Patterns

### Get User's Requests
```javascript
const requestsRef = ref(database, 'funJumperRequests')
const userRequestsQuery = query(
  requestsRef,
  orderByChild('userId'),
  equalTo(userId)
)
const snapshot = await get(userRequestsQuery)
```

### Get Pending Requests (Manifest View)
```javascript
const requestsRef = ref(database, 'funJumperRequests')
const pendingQuery = query(
  requestsRef,
  orderByChild('status'),
  equalTo('pending')
)
const snapshot = await get(pendingQuery)
```

### Get Requests for Specific Load
```javascript
const requestsRef = ref(database, 'funJumperRequests')
const loadRequestsQuery = query(
  requestsRef,
  orderByChild('assignedLoadId'),
  equalTo(loadId)
)
const snapshot = await get(loadRequestsQuery)
```

### Real-time Subscription
```javascript
const requestsRef = ref(database, `funJumperRequests`)
const unsubscribe = onValue(requestsRef, (snapshot) => {
  const requests = []
  snapshot.forEach((child) => {
    requests.push(child.val())
  })
  // Update UI
})
```

---

## Firebase Security Rules

```json
{
  "rules": {
    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid"
      }
    },

    "funJumperRequests": {
      ".read": "auth != null",
      ".indexOn": ["userId", "status", "assignedLoadId", "createdAt"],

      "$requestId": {
        ".write": "auth != null && (
          // User can create their own requests
          (!data.exists() && newData.child('userId').val() === auth.uid) ||

          // User can cancel their own pending requests
          (data.child('userId').val() === auth.uid &&
           data.child('status').val() === 'pending' &&
           newData.child('status').val() === 'cancelled') ||

          // Manifest/Admin can approve/deny/cancel
          (root.child('users').child(auth.uid).child('role').val() === 'admin' ||
           root.child('users').child(auth.uid).child('role').val() === 'manifest')
        )"
      }
    },

    "loads": {
      ".read": "auth != null",
      ".indexOn": ["status", "position"],

      "$loadId": {
        ".write": "auth != null && (
          root.child('users').child(auth.uid).child('role').val() === 'admin' ||
          root.child('users').child(auth.uid).child('role').val() === 'manifest' ||
          root.child('users').child(auth.uid).child('role').val() === 'instructor'
        )",

        "funJumpers": {
          ".write": "auth != null && (
            root.child('users').child(auth.uid).child('role').val() === 'admin' ||
            root.child('users').child(auth.uid).child('role').val() === 'manifest'
          )"
        }
      }
    }
  }
}
```

---

## Data Migration Notes

### Existing Loads
- No migration needed - `funJumpers` is optional
- Existing loads will have `funJumpers: undefined` or `funJumpers: []`
- No impact on existing capacity calculations until fun jumpers are added

### Existing Users (if any)
- If auth is being added to existing system:
  1. Create admin account first
  2. Manually add existing users to `users` table
  3. Assign appropriate roles
  4. Update Firebase security rules in stages

---

## Capacity Calculation Logic

### Before (Existing):
```typescript
const totalPeople = (load.assignments || []).length
const availableSlots = (load.capacity || 0) - totalPeople
```

### After (With Fun Jumpers):
```typescript
const totalPeople = (load.assignments || []).length + (load.funJumpers || []).length
const availableSlots = (load.capacity || 0) - totalPeople
```

---

## Notification Tracking (Optional)

If you want to track notification delivery for debugging:

```json
{
  "notificationLogs": {
    "$logId": {
      "userId": "string",
      "type": "request_approved | request_denied | request_cancelled",
      "requestId": "string",
      "channels": {
        "push": true,
        "sms": false,
        "email": true
      },
      "timestamp": number
    }
  }
}
```

---

## Backup & Recovery

### Important Data to Backup
1. `funJumperRequests` - Complete request history
2. `users` - User profiles and roles
3. `loads` with `funJumpers` - Load assignments

### Recovery Scenarios
- **Lost Request**: Check request history for audit trail
- **Incorrect Assignment**: Use `history` array to trace approval
- **Deleted Load**: Requests have `assignedLoadId` reference

---

## Performance Considerations

### Indexes
- Add composite indexes for complex queries
- Monitor query performance in Firebase console

### Cleanup
- Archive completed requests older than 30 days
- Move to `funJumperRequestsArchive` table
- Keep history for audit purposes

### Optimization
- Denormalize frequently accessed data (userName, loadNumber)
- Cache user profiles locally (mobile app)
- Use pagination for large request lists

---

## Schema Version

**Current Version**: 1.0.0
**Last Updated**: 2024-01-01
**Next Review**: After Phase 6 completion
