# 🚨 RapidResQ AI
### Intelligent Emergency Request & Dispatch Management Backend

> AI-powered backend that classifies emergency urgency in real time, queues requests by priority, and dispatches responders with concurrency-safe assignment — built for high-stakes, low-latency operations.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socket.io&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_API-8E75B2?logo=googlegemini&logoColor=white)

---

## 💡 The Problem

A real accident report doesn't wait in line. When someone sends:

> *"Major accident near NH66. Two people unconscious."*

...it needs to jump straight to the top of the queue, get a responder locked in without conflict, and notify that responder instantly — not sit behind five "minor bruise" reports submitted a minute earlier.

**RapidResQ AI** solves exactly that.

---

## ⚙️ How It Works

```
Client
  │
  ▼
Routes → Validation → Controller → Service Layer
                                        │
        ┌───────────────┬──────────────┼──────────────┐
        ▼               ▼              ▼              ▼
   PostgreSQL         Redis        Gemini AI      Socket.IO
  (persistence)  (queue/cache/lock) (classify)   (real-time)
        │               │              │              │
        └───────────────┴──────────────┴──────────────┘
                         │
                         ▼
                   Winston Logger
                         │
                         ▼
                      Response
```


## 🧠 What Makes This Not-Just-CRUD

| Feature | Why it matters |
|---|---|
| 🚦 **Redis Priority Queue** | Sorted-set scoring (CRITICAL=4 → LOW=1) means the most urgent case is always served first, regardless of arrival order |
| 🔒 **Distributed Lock on Assignment** | `SET NX EX` in Redis stops two dispatchers assigning the *same responder* to two different emergencies at once |
| 🤖 **AI Classification + Rule Fallback** | Gemini classifies urgency from raw text; if it times out or fails, keyword rules take over automatically — the API never breaks |
| ⚡ **Real-Time Dispatch** | Socket.IO pushes `dispatch_assigned` the instant a responder is locked in — no polling |
| 🧭 **Cache-Aside Reads** | Active requests are cached in Redis for 60s, cutting repeat load on Postgres for a dashboard-style endpoint |
| 🛡️ **Duplicate Detection** | Same user + same location + same description within 60s → rejected as a duplicate, so panic re-submits don't dispatch five ambulances for one incident |
| 📝 **Standardized Responses** | Every endpoint — success or error — returns the same `{ success, message, data }` envelope |

---

## 🧰 Tech Stack

`Node.js` · `Express.js` · `PostgreSQL` · `Prisma ORM` · `Redis` · `Socket.IO` · `Google Gemini API` · `Winston` · `express-validator` · `dotenv`

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (local, or a free hosted instance — Neon / Supabase / Railway)
- Redis (local, or a free hosted instance — Upstash / Redis Cloud)
- A free Gemini API key → [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# edit .env → DATABASE_URL, REDIS_URL, GEMINI_API_KEY

# 3. Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev --name init

# 4. Seed dummy users & responders
npm run seed

# 5. Launch
npm run dev
```

Server boots at **`http://localhost:5000`** 🎉

---

## 📁 Project Structure

src/
├── config/ # db, redis, socket.io connections
├── controllers/ # request handlers
├── routes/ # express routes + validation chains
├── middlewares/ # validation & global error handling
├── services/ # AI classification, Redis queue, dispatch logic
├── utils/ # logger, standardized response helper
├── app.js
└── server.js
prisma/
├── schema.prisma
└── seed.js
docs/
├── API_DOCUMENTATION.md
└── SYSTEM_DESIGN.md


---

## 📡 API Overview

Full request/response contracts in [`docs/API_DOCUMENTATION.md`](./docs/API_DOCUMENTATION.md).

| # | Method | Endpoint | What it does |
|---|--------|----------|----------------|
| 1 | `POST` | `/api/emergency` | Create emergency request → AI-classified & queued |
| 2 | `GET` | `/api/emergency/pending` | Priority-ordered pending requests |
| 3 | `POST` | `/api/emergency/assign` | Lock-safe responder assignment |
| 4 | `PATCH` | `/api/emergency/status` | Move request through its lifecycle |
| 5 | `GET` | `/api/emergency/active` | Active requests (cache-aside) |
| 6 | `POST` | `/api/emergency/notify` | Trigger real-time dispatch event |
| 7 | `POST` | `/api/emergency/classify` | Standalone AI urgency check |
| — | `GET` | `/api/responders` | List responders |

---

## 🎬 Demo Walkthrough
<img width="1906" height="988" alt="image" src="https://github.com/user-attachments/assets/d41c881c-d6be-4be8-9759-c5b3adf56103" />


1. **Create** a request → watch Gemini assign `CRITICAL`
2. **Check the queue** → it's already sorted, no manual sorting needed
3. **Assign a responder** → try assigning the *same* responder again → watch the lock reject it with `409`
4. **Watch the event fire** → `dispatch_assigned` in the console/Socket.IO client
5. **Progress the lifecycle** → `ON_THE_WAY` → `RESOLVED` → responder auto-frees to `AVAILABLE`
6. **Hit `/classify` directly** → same AI engine, standalone
   
   https://drive.google.com/file/d/1W03nt8puUDVBR7cwcvi8NdgODu-xmhSX/view?usp=sharing

---

## 🩹 Resilience by Design

| If this fails... | ...this happens |
|---|---|
| Gemini API times out / key missing | Falls back to keyword-based classification automatically |
| Redis is down | Request still saves to PostgreSQL; queue/cache degrade gracefully, error logged |
| Socket.IO unavailable | Logged only — API response is unaffected |
| Same responder assigned twice, simultaneously | Rejected via atomic Redis lock |

---

## 📄 License
Built for academic submission — Advanced Backend System Design & AI-driven Data Systems Assignment.
