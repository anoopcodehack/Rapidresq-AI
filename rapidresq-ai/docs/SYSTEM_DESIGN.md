# System Design Document — RapidResQ AI

## 1. Overview

RapidResQ AI is an intelligent backend system designed to manage emergency
requests efficiently. The system receives emergency reports, classifies their
urgency using Google Gemini AI (with a rule-based fallback), stores them in
PostgreSQL, maintains a Redis priority queue for dispatching, and sends
real-time notifications using Socket.IO.

The system follows the MVC architecture and demonstrates modern backend
concepts including AI-assisted decision making, caching, distributed locking,
event-driven communication, logging, and fault tolerance.

---

## 2. Architecture

```
                        Client
                   (Postman / Frontend)
                            |
                            |
                      HTTP REST APIs
                            |
                            v
                   Express.js Application
                            |
      +---------------------+---------------------+
      |                     |                     |
      v                     v                     v
 Validation          Controllers            Logger (Winston)
 Middleware               |
                            |
                            v
                     Service Layer
      +---------------------+-------------------------+----------------------+
      |                     |                         |                      |
      v                     v                         v                      v
 PostgreSQL             Redis                  Google Gemini           Socket.IO
 (Prisma ORM)     Queue / Cache / Lock        AI Classification      Real-Time Events
      |                     |                         |                      |
      +---------------------+-------------------------+----------------------+
                            |
                            v
                     Standard JSON Response
```

The Express application acts as the central coordinator. Business logic is
implemented inside the service layer, while PostgreSQL stores persistent data,
Redis manages queueing and caching, Gemini performs AI classification, and
Socket.IO delivers real-time notifications.

---

## 3. Database Schema (ER Diagram)

```
                 User
                  |
                  | 1
                  |
                  | N
        +----------------------+
        | EmergencyRequest     |
        +----------------------+
                  |
        assignedResponderId
                  |
                  |
                  N
                  |
                  1
             Responder
                  |
                  |
                  N
                  |
                  1
        +----------------------+
        | DispatchHistory      |
        +----------------------+
```

### User

- id
- name
- phone
- email
- createdAt

### Responder

- id
- name
- phone
- vehicleType
- latitude
- longitude
- status (AVAILABLE, BUSY, OFFLINE)
- createdAt

### EmergencyRequest

- id
- userId
- assignedResponderId
- location
- latitude
- longitude
- description
- priority (LOW, MEDIUM, HIGH, CRITICAL)
- status (PENDING, ASSIGNED, ON_THE_WAY, RESOLVED)
- createdAt
- updatedAt

### DispatchHistory

- id
- requestId
- responderId
- assignedTime
- completedTime

### Database Design Notes

- User → EmergencyRequest is One-to-Many.
- Responder → DispatchHistory is One-to-Many.
- EmergencyRequest → DispatchHistory is One-to-Many.
- assignedResponderId is stored directly inside EmergencyRequest to reduce
  joins while retrieving active requests.

Recommended indexes include:

- EmergencyRequest.status
- EmergencyRequest.priority
- EmergencyRequest.createdAt
- EmergencyRequest.assignedResponderId
- Responder.status

These indexes optimize active request lookup, priority sorting, and responder
availability checks.

---

## 4. Redis Usage

Redis is used for three different purposes.

| Redis Key | Data Type | Purpose | TTL |
|------------|-----------|---------|-----|
| pending_requests | Sorted Set (ZSET) | Priority Queue | Until assigned |
| active_requests | String (JSON) | Cache active requests | 60 seconds |
| lock:responder:<id> | String | Distributed Lock | 30 seconds |

### Priority Queue

Emergency requests are inserted into the Redis Sorted Set.

```
ZADD pending_requests 4 18
```

Priority Scores

```
LOW       = 1
MEDIUM    = 2
HIGH      = 3
CRITICAL  = 4
```

Fetching pending requests

```
ZREVRANGE pending_requests 0 -1
```

returns requests ordered from highest priority to lowest.

---

### Cache

Redis stores active requests for 60 seconds using the Cache-Aside pattern.

Flow

```
Client

↓

Redis Cache

↓

Cache Hit

↓

Return Response

OR

Cache Miss

↓

PostgreSQL

↓

Update Redis Cache

↓

Return Response
```

---

### Distributed Lock

Before assigning a responder

```
lock:responder:<id>
```

is created using Redis.

This prevents two dispatchers from assigning the same responder at the same
time.

---

### Failure Handling

If Redis becomes unavailable,

- Requests are still saved in PostgreSQL.
- Queue, cache, and lock features are skipped.
- Errors are logged.
- API continues to work without crashing.

---

## 5. AI Integration

RapidResQ AI uses Google Gemini API to classify emergency descriptions into
one of four priority levels.

- LOW
- MEDIUM
- HIGH
- CRITICAL

The AI request uses a strict prompt requesting only one valid priority.

A timeout of 2 seconds is applied.

If Gemini fails due to

- timeout,
- invalid response,
- missing API key,
- quota exceeded,

the system automatically switches to a keyword-based rule engine.

Example

```
"Fire in building"
↓

CRITICAL

"Minor leg injury"

↓

MEDIUM
```

The API also returns

```
source = gemini
```

or

```
source = fallback
```

making the decision process transparent.

---

## 6. Event Flow

```
Client

↓

POST /api/emergency

↓

Validation

↓

Duplicate Detection

↓

Gemini AI Classification
      │
      │ (Failure)
      ▼
Rule-Based Classification

↓

Save to PostgreSQL

↓

Push Request to Redis Queue

↓

Emit Socket.IO Event

status_updated

↓

Dispatcher Assigns Responder

↓

Acquire Redis Lock

↓

Database Transaction

↓

Remove Request from Redis Queue

↓

Emit Socket.IO Event

dispatch_assigned

↓

Update Status

↓

ON_THE_WAY

↓

RESOLVED

↓

Responder becomes AVAILABLE
```

---

## 7. Sequence Diagram

```
Client
   |
POST /api/emergency
   |
   v
Express API
   |
Validate Request
   |
Gemini AI
   |
Priority
   |
PostgreSQL
INSERT Request
   |
Redis
ZADD pending_requests
   |
Socket.IO
status_updated
   |
Client receives response

-----------------------------------------

Dispatcher

POST /assign

↓

Redis Lock

↓

Validate Request

↓

Database Transaction

↓

Update Request

↓

Update Responder

↓

Insert Dispatch History

↓

Redis

ZREM pending_requests

↓

Socket.IO

dispatch_assigned

↓

Release Lock

↓

200 OK
```

---

## 8. Logging & Error Handling

The project uses Winston Logger.

Logs include

- Incoming API requests
- Database operations
- Redis events
- AI classification
- Socket.IO events
- Errors

Separate log files are maintained

```
logs/combined.log

logs/error.log
```

A global Express Error Handler ensures every error returns a consistent JSON
response.

Common HTTP Status Codes

- 200 OK
- 201 Created
- 400 Bad Request
- 404 Not Found
- 409 Conflict
- 500 Internal Server Error

---

## 9. Edge Cases Handled

The system safely handles the following scenarios.

- Invalid User ID → 404 Not Found
- Invalid Responder ID → 404 Not Found
- Duplicate Emergency Request → 409 Conflict
- Request Already Assigned → 409 Conflict
- Request Already Resolved → 400 Bad Request
- Busy Responder → 409 Conflict
- Concurrent Assignment → Prevented using Redis Distributed Lock
- AI Timeout → Rule-Based Classification
- Missing API Key → Rule-Based Classification
- Gemini API Failure → Rule-Based Classification
- Redis Failure → PostgreSQL continues normally
- Socket.IO Failure → Logged without affecting API response

---

## 10. Conclusion

RapidResQ AI demonstrates a scalable and fault-tolerant backend architecture
for emergency response management. By combining PostgreSQL, Redis,
Socket.IO, Google Gemini AI, and RESTful APIs, the system efficiently
prioritizes emergency requests, dispatches responders, and provides real-time
updates. The use of caching, distributed locking, AI fallback mechanisms, and
centralized logging ensures both reliability and high performance under
real-world conditions.