# System Design Document — RapidResQ AI

## 1. Overview
RapidResQ AI is a backend system that ingests emergency requests, classifies
their urgency using an AI model (with a deterministic fallback), queues them
by priority, and coordinates responder assignment with real-time
notifications.

## 2. Architecture

```
Client
  |
  v
Express Routes
  |
  v
Validation Middleware (express-validator)
  |
  v
Controller
  |
  v
Service Layer
  |
  +--------------+--------------+--------------+
  |              |              |              |
  v              v              v              v
PostgreSQL     Redis        Gemini AI      Socket.IO
(Prisma)   (queue/cache/lock) (classify)   (real-time)
  |              |              |              |
  +--------------+--------------+--------------+
                 |
                 v
              Logger (Winston)
                 |
                 v
              Response
```

## 3. Database Schema (ER Diagram, textual)

```
User (1) ----< (many) EmergencyRequest
Responder (1) --< (many) EmergencyRequest   [assignedResponderId, denormalized]
Responder (1) --< (many) DispatchHistory
EmergencyRequest (1) --< (many) DispatchHistory
```

**User**: id, name, phone, email, createdAt
**Responder**: id, name, phone, vehicleType, status (AVAILABLE/BUSY/OFFLINE), latitude, longitude, createdAt
**EmergencyRequest**: id, userId, assignedResponderId, location, latitude, longitude, description, priority (LOW/MEDIUM/HIGH/CRITICAL), status (PENDING/ASSIGNED/ON_THE_WAY/RESOLVED), createdAt, updatedAt
**DispatchHistory**: id, requestId, responderId, assignedTime, completedTime

`assignedResponderId` is stored directly on `EmergencyRequest` to avoid an
expensive join for the "Get Active Requests" query; `DispatchHistory` remains
the append-only audit trail of every assignment.

**Indexes**: `status`, `priority`, `assignedResponderId`, `createdAt` on
EmergencyRequest, and `status` on Responder — supports the common query
patterns (pending/active lookups, priority sort) without full table scans.

## 4. Redis Design

| Key | Type | Purpose | TTL |
|-----|------|---------|-----|
| `pending_requests` | Sorted Set | Priority queue, scored LOW=1 … CRITICAL=4 | none (removed on assign) |
| `active_requests` | String (JSON) | Cache-aside for active requests list | 60s |
| `lock:responder:<id>` | String | Mutex preventing double-assignment | 30s |

Example: `ZADD pending_requests 4 18` inserts request 18 as CRITICAL priority.
`ZRANGE pending_requests 0 -1 REV` returns IDs from highest to lowest priority.

**Failure mode**: if Redis is unreachable, requests still persist to
PostgreSQL and the error is logged — the queue/cache/lock features degrade
rather than causing the API to fail.

## 5. AI Integration
`description` is sent to Gemini with a constrained prompt asking for exactly
one of LOW/MEDIUM/HIGH/CRITICAL. The call has a 2-second timeout. On timeout,
invalid response, or missing API key, a keyword-based rule engine takes over
(e.g. "fire", "unconscious" → CRITICAL). The response always reports which
path was used (`source: "gemini"` or `"fallback"`), so the system is
observable and demoable even without network access to Gemini.

## 6. Event Flow

```
Create Request
   |
   v
AI Priority Classification (Gemini or fallback)
   |
   v
Save to PostgreSQL --> Push to Redis Queue --> emit "status_updated"
   |
   v
Dispatcher calls Assign Responder
   |
   v
Acquire Redis Lock --> Validate --> DB Transaction (update request,
responder, dispatch history) --> Remove from Redis Queue
   |
   v
emit "dispatch_assigned"
   |
   v
Update Status (Assigned -> On The Way -> Resolved)
   |
   v
emit "status_updated" on every change; on Resolved, responder -> AVAILABLE
```

## 7. Sequence Diagram — Create + Assign (textual)

```
Client -> API: POST /emergency (create request)
API -> Gemini: classify(description)
Gemini -> API: priority | timeout -> API applies fallback rules
API -> PostgreSQL: INSERT emergency_request
API -> Redis: ZADD pending_requests
API -> Socket.IO: emit status_updated
API -> Client: 201 Created

Client -> API: POST /emergency/assign
API -> Redis: SET lock:responder:<id> NX EX 30
API -> PostgreSQL: validate request + responder
API -> PostgreSQL: transaction (update request, update responder, insert dispatch history)
API -> Redis: ZREM pending_requests
API -> Socket.IO: emit dispatch_assigned
API -> Redis: DEL lock:responder:<id>
API -> Client: 200 OK
```

## 8. Logging & Error Handling
Winston logs every request at `INFO`, AI fallback events and failures at
`ERROR`/`WARN`, written both to console and `logs/combined.log` /
`logs/error.log`. A single global Express error-handling middleware
normalizes all thrown errors into a consistent JSON response with the
correct HTTP status code (400/404/409/500).

## 9. Edge Cases Handled
- Invalid user / responder → 404
- Responder busy or already assigned → 409
- Request already resolved → 400, update rejected
- Concurrent assignment attempts → rejected via Redis lock
- AI timeout or missing key → automatic rule-based fallback
- Redis unavailable → request still saved to DB, error logged, queue/cache degrade gracefully
- Socket.IO unavailable → logged only, API response unaffected
