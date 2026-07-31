# 🚨RapidResQ AI — Intelligent Emergency Request & Dispatch Management Backend

A backend system that accepts emergency requests, classifies urgency using
Google Gemini (with a rule-based fallback), queues requests by priority in
Redis, and dispatches responders in real time via Socket.IO.

## Tech Stack
Node.js, Express.js, PostgreSQL, Prisma ORM, Redis, Socket.IO, Google Gemini API, Winston, express-validator

## Prerequisites
- Node.js 18+
- PostgreSQL running locally or a hosted instance (Neon, Supabase, Railway, etc.)
- Redis running locally or a hosted instance (Upstash, Redis Cloud, etc.)
- A Google Gemini API key (free tier at https://aistudio.google.com/app/apikey)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env with your DATABASE_URL, REDIS_URL, GEMINI_API_KEY

# 3. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# 4. Seed dummy users and responders
npm run seed

# 5. Start the server
npm run dev
# server runs on http://localhost:5000
```

## Project Structure
```
src/
  config/       -> db, redis, socket.io connections
  controllers/  -> request handlers
  routes/       -> express route definitions + validation
  middlewares/  -> validation & error handling
  services/     -> business logic (AI classification, Redis queue, dispatch)
  utils/        -> logger
  app.js        -> express app setup
  server.js     -> entry point
prisma/
  schema.prisma -> database schema
  seed.js       -> dummy data
docs/
  API_DOCUMENTATION.md
  SYSTEM_DESIGN.md
```

## API Overview
See `docs/API_DOCUMENTATION.md` for full request/response details.

| # | Method | Endpoint | Description |
|---|--------|----------|--------------|
| 1 | POST | /api/emergency | Create emergency request |
| 2 | GET  | /api/emergency/pending | Get pending requests (priority order) |
| 3 | POST | /api/emergency/assign | Assign responder |
| 4 | PATCH | /api/emergency/status | Update request status |
| 5 | GET  | /api/emergency/active | Get active requests |
| 6 | POST | /api/emergency/notify | Trigger dispatch notification |
| 7 | POST | /api/emergency/classify | AI priority classification (standalone) |

## Demo Flow
1. Create an emergency request → watch AI assign a priority
2. Check `/api/emergency/pending` → request appears in priority order
3. Assign a responder → try assigning the same responder again to see the Redis lock reject it
4. Watch the `dispatch_assigned` Socket.IO event fire (use a simple socket.io-client script or the browser console)
5. Update status to `ON_THE_WAY`, then `RESOLVED` → responder becomes `AVAILABLE` again
6. Call `/api/emergency/classify` directly with a new description

## Notes
- If Redis is down, requests still save to PostgreSQL; only the queue/cache features degrade gracefully (see logs).
- If Gemini times out or the API key is missing, priority falls back to keyword-based rules automatically.
