# API Documentation — RapidResQ AI
### Intelligent Emergency Request & Dispatch Management Backend

Base URL: `http://localhost:5000/api`

All responses follow a standardized envelope:
{ "success": true | false, "message": "human readable message", "data": { ... } | null }

---

## 1. Create Emergency Request

| | |
|---|---|
| **Method** | POST |
| **Endpoint** | `/emergency` |
| **Purpose** | Logs a new emergency, classifies its urgency, and queues it for dispatch |

**Request Body**
{
  "user_id": 1,
  "location": "NH66, Mangaluru",
  "latitude": 12.9141,
  "longitude": 74.8560,
  "description": "Major accident, two people unconscious"
}

| Field | Type | Required | Validation |
|---|---|---|---|
| user_id | integer | Yes | must be a positive integer, must exist |
| location | string | Yes | non-empty |
| latitude | float | No | -90 to 90 |
| longitude | float | No | -180 to 180 |
| description | string | Yes | 5–500 characters |

**Backend Flow**
1. Validate input
2. Check for a duplicate (same user, same location, same description, within 60 seconds, not yet resolved)
3. Classify priority via Gemini AI (falls back to keyword rules on timeout/failure)
4. Insert into PostgreSQL
5. Push to Redis priority queue (`pending_requests` sorted set)
6. Emit `status_updated` Socket.IO event

**Success Response — 201 Created**
{
  "success": true,
  "message": "Emergency request created",
  "data": {
    "id": 1,
    "userId": 1,
    "location": "NH66, Mangaluru",
    "description": "Major accident, two people unconscious",
    "priority": "CRITICAL",
    "status": "PENDING",
    "prioritySource": "gemini"
  }
}

**Duplicate Detected — 409 Conflict**
{ "success": false, "message": "Duplicate Emergency Request", "data": null }

**Errors**
| Status | Cause |
|---|---|
| 400 | Missing/invalid field (see validation table above) |
| 404 | user_id does not exist |
| 409 | Duplicate request detected |

---

## 2. Get Pending Requests

| | |
|---|---|
| **Method** | GET |
| **Endpoint** | `/emergency/pending` |
| **Purpose** | Returns all pending requests ordered by priority (highest first) |

**Request Body:** none

**Backend Flow:** reads directly from the Redis sorted set `pending_requests` (scored CRITICAL=4 → LOW=1), then fetches matching records from PostgreSQL and returns them in that order.

**Success Response — 200 OK**
{
  "success": true,
  "message": "Pending requests retrieved",
  "data": [
    { "id": 3, "priority": "HIGH", "status": "PENDING" },
    { "id": 2, "priority": "MEDIUM", "status": "PENDING" }
  ]
}

If the queue is empty:
{ "success": true, "message": "No pending requests", "data": [] }

---

## 3. Assign Responder

| | |
|---|---|
| **Method** | POST |
| **Endpoint** | `/emergency/assign` |
| **Purpose** | Assigns an available responder to a pending emergency |

**Request Body**
{ "request_id": 1, "responder_id": 1 }

| Field | Type | Required |
|---|---|---|
| request_id | integer | Yes |
| responder_id | integer | Yes |

**Backend Flow**
1. Acquire a Redis lock on the responder (`lock:responder:<id>`, 30s TTL) — prevents two dispatchers assigning the same responder simultaneously
2. Validate the request exists, isn't resolved, isn't already assigned
3. Validate the responder exists and isn't already BUSY
4. Run a single database transaction: update request status → ASSIGNED, set responder status → BUSY, insert a Dispatch History record
5. Remove the request from the Redis priority queue
6. Emit `dispatch_assigned` Socket.IO event
7. Release the Redis lock

**Success Response — 200 OK**
{
  "success": true,
  "message": "Responder assigned successfully",
  "data": { "id": 1, "status": "ASSIGNED", "assignedResponderId": 1 }
}

**Errors**
| Status | Cause |
|---|---|
| 404 | request_id or responder_id not found |
| 409 | Responder is busy / request already resolved / request already assigned / lock currently held (concurrent assignment attempt) |

---

## 4. Update Request Status

| | |
|---|---|
| **Method** | PATCH |
| **Endpoint** | `/emergency/status` |
| **Purpose** | Moves a request through its lifecycle |

**Request Body**
{ "request_id": 1, "status": "ON_THE_WAY" }

Valid `status` values: PENDING, ASSIGNED, ON_THE_WAY, RESOLVED

**Backend Flow**
1. Validate request exists and is not already resolved
2. Update status in PostgreSQL
3. If status becomes RESOLVED: free the assigned responder back to AVAILABLE, and stamp completedTime on the Dispatch History record
4. Emit `status_updated` Socket.IO event

**Success Response — 200 OK**
{
  "success": true,
  "message": "Status updated successfully",
  "data": { "id": 1, "status": "ON_THE_WAY" }
}

**Errors**
| Status | Cause |
|---|---|
| 400 | Invalid status value / request already resolved |
| 404 | request_id not found |

---

## 5. Get Active Requests

| | |
|---|---|
| **Method** | GET |
| **Endpoint** | `/emergency/active` |
| **Purpose** | Returns all requests not yet resolved (for a dispatcher dashboard) |

**Request Body:** none

**Backend Flow:** cache-aside pattern — checks Redis (`active_requests`, 60s TTL) first; on a cache miss, queries PostgreSQL for status != RESOLVED, then populates the cache.

**Success Response — 200 OK**
{
  "success": true,
  "message": "Active requests retrieved (cache)",
  "data": [ { "id": 2, "status": "PENDING" }, { "id": 3, "status": "ASSIGNED" } ]
}

message says (db) on a cache miss and (cache) on a cache hit — useful to point out live in a demo.

---

## 6. Dispatch Notification

| | |
|---|---|
| **Method** | POST |
| **Endpoint** | `/emergency/notify` |
| **Purpose** | Manually (re-)triggers a real-time notification for a request — the event-driven requirement |

**Request Body**
{ "request_id": 1 }

**Backend Flow:** looks up the request's assigned responder and emits a `dispatch_assigned` Socket.IO event. In production this event would push to a responder's device; here it's demoed via server console log / a Socket.IO client.

**Success Response — 200 OK**
{ "success": true, "message": "Notification emitted", "data": null }

**Errors**
| Status | Cause |
|---|---|
| 404 | request_id not found |

---

## 7. AI Priority Classification

| | |
|---|---|
| **Method** | POST |
| **Endpoint** | `/emergency/classify` |
| **Purpose** | Standalone urgency classification, independent of creating a request |

**Request Body**
{ "description": "Building on fire" }

**Backend Flow:** sends the description to Gemini (gemini-flash-latest) with a 2-second timeout, constrained to return exactly one of LOW/MEDIUM/HIGH/CRITICAL. On timeout, invalid response, or missing API key, falls back to keyword-based rules.

**Success Response — 200 OK**
{
  "success": true,
  "message": "Priority classified",
  "data": { "priority": "CRITICAL", "source": "gemini" }
}

source is "gemini" when the AI call succeeds, "fallback" when the rule engine was used instead.

**Errors**
| Status | Cause |
|---|---|
| 400 | description missing / not 5–500 characters |

---

## Supporting Endpoint

| | |
|---|---|
| **Method** | GET |
| **Endpoint** | `/responders` (not under `/emergency`) |
| **Purpose** | Lists all responders — used to pick a valid responder_id for testing |

**Success Response — 200 OK**
{
  "success": true,
  "message": "Responders retrieved",
  "data": [ { "id": 1, "name": "Ambulance Unit 1", "status": "AVAILABLE" } ]
}

---

## Socket.IO Events (Real-Time / Event-Driven Requirement)

| Event | Emitted When | Payload |
|---|---|---|
| status_updated | A request is created or its status changes | { requestId, status, priority? } |
| dispatch_assigned | A responder is assigned to a request | { requestId, responderId, message } |

---

## Global Error Format

Every error, regardless of source, returns the same shape:
{ "success": false, "message": "<description of what went wrong>", "data": null }

| Status | Meaning |
|---|---|
| 400 | Bad request — validation failure or invalid state transition |
| 404 | Referenced resource not found |
| 409 | Conflict — duplicate request, busy responder, concurrent assignment |
| 500 | Unexpected server error |
