# API Documentation — RapidResQ AI

Base URL: `http://localhost:5000/api`

---

## 1. Create Emergency Request
`POST /emergency`

**Request Body**
```json
{
  "user_id": 1,
  "location": "NH66, Mangaluru",
  "latitude": 12.9141,
  "longitude": 74.8560,
  "description": "Major accident, two people unconscious"
}
```

**Response — 201**
```json
{
  "success": true,
  "data": {
    "id": 18,
    "userId": 1,
    "location": "NH66, Mangaluru",
    "priority": "CRITICAL",
    "status": "PENDING",
    "prioritySource": "gemini"
  }
}
```

**Errors**: `400` invalid input, `404` invalid user_id

---

## 2. Get Pending Requests
`GET /emergency/pending`

**Response — 200**
```json
{
  "success": true,
  "data": [
    { "id": 18, "priority": "CRITICAL", "status": "PENDING" },
    { "id": 15, "priority": "HIGH", "status": "PENDING" }
  ]
}
```

---

## 3. Assign Responder
`POST /emergency/assign`

**Request Body**
```json
{ "request_id": 18, "responder_id": 2 }
```

**Response — 200**
```json
{
  "success": true,
  "data": { "id": 18, "status": "ASSIGNED", "assignedResponderId": 2 }
}
```

**Errors**: `404` invalid request/responder, `409` responder busy / already assigned / lock held

---

## 4. Update Request Status
`PATCH /emergency/status`

**Request Body**
```json
{ "request_id": 18, "status": "ON_THE_WAY" }
```
Valid status values: `PENDING`, `ASSIGNED`, `ON_THE_WAY`, `RESOLVED`

**Response — 200**
```json
{ "success": true, "data": { "id": 18, "status": "ON_THE_WAY" } }
```

**Errors**: `400` invalid status / already resolved, `404` request not found

---

## 5. Get Active Requests
`GET /emergency/active`

**Response — 200**
```json
{
  "success": true,
  "source": "cache",
  "data": [ { "id": 18, "status": "ASSIGNED" } ]
}
```

---

## 6. Dispatch Notification
`POST /emergency/notify`

**Request Body**
```json
{ "request_id": 18 }
```

**Response — 200**
```json
{ "success": true, "message": "Notification emitted" }
```
Emits Socket.IO event `dispatch_assigned`.

---

## 7. AI Priority Classification
`POST /emergency/classify`

**Request Body**
```json
{ "description": "Building on fire" }
```

**Response — 200**
```json
{
  "success": true,
  "data": { "priority": "CRITICAL", "source": "gemini" }
}
```
`source` is `"gemini"` when the AI call succeeds, or `"fallback"` when it times out / errors and the keyword rules are used instead.

---

## Socket.IO Events

| Event | Emitted when |
|-------|--------------|
| `status_updated` | Request created or its status changes |
| `dispatch_assigned` | A responder is assigned to a request |

## Supporting Endpoint

`GET /responders` — lists all responders (for picking a `responder_id` during demo/testing).
