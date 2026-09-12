# 🧊 Antarctica Digital Twin — Mission Control

**A real-time remote-operations platform for India's Antarctic research stations (Bharati & Maitri).**

Built for **Smart India Hackathon 2026** — Problem Statement **#26060**: *"Digital Platform for Efficient Remote Management of Indian Antarctic Research Stations"* (Theme: Smart Automation).

Mission Control gives station administrators and visiting scientists a live, single-pane-of-glass view of station telemetry (environmental, seismic, logistics) with a controlled, auditable workflow for requesting and approving changes to station operating conditions — including a dedicated emergency-override path for time-critical situations.

---

## ✨ Key Features

- **Live telemetry streaming** over WebSockets — no polling, updates push to connected clients the instant a metric changes.
- **Role-based access control** — `admin` (full network oversight) vs `visiting_scientist` (scoped to their assigned station).
- **Controlled change workflow** — scientists *propose* changes to operating parameters; admins *review, approve, or reject* them, with every action logged.
- **Emergency override** — a fast-path for critical situations, with mandatory admin rollback/resolution tracking.
- **Station logistics tracking** — inventory levels, reorder thresholds, and supply status per station.
- **Full audit trail** — every sensitive action (logins, overrides, approvals, user management) is written to an immutable audit log with actor, IP, and JSON detail payload.
- **Secure auth** — JWT sessions backed by a server-side session table (so tokens can be revoked instantly), bcrypt password hashing, security-question-based recovery, and forced password rotation for new accounts.
- **Station seismic observatory view** and simulated environmental data feed for demoing realistic station conditions without live hardware.

---

## 🏗️ Architecture

```
                        ┌─────────────────────────┐
                        │   React Frontend (Vite) │
                        │  Login · Dashboard ·    │
                        │  Seismic Observatory ·  │
                        │  Station Map (Leaflet)  │
                        └────────────┬────────────┘
                                     │ REST (JWT)         │ WebSocket
                                     │ /api/*             │ /ws/telemetry
                                     ▼                    ▼
                        ┌─────────────────────────────────────────┐
                        │            Express API Server           │
                        │  ┌───────────┐ ┌────────────┐ ┌───────┐ │
                        │  │authController│adminController│twinController│
                        │  └───────────┘ └────────────┘ └───────┘ │
                        │  Middleware: helmet · cors · rate-limit │
                        │  auth (JWT verify, role guard, forced   │
                        │  password-change gate) · audit logger   │
                        │  Raw ws.Server for live telemetry push  │
                        └────────────┬─────────────┬──────────────┘
                                     │              │
                       LISTEN/NOTIFY │              │ SQL (pg pool)
                          (pub/sub)  ▼              ▼
                        ┌─────────────────────────────────────────┐
                        │        PostgreSQL (schema.sql)          │
                        │ stations · users · sessions ·           │
                        │ telemetry_metrics · simulation_profiles │
                        │ station_logistics · condition_requests  │
                        │ emergency_events · audit_logs           │
                        └─────────────────────────────────────────┘
                                     ▲
                                     │ updates telemetry_metrics,
                                     │ fires NOTIFY telemetry_update
                        ┌─────────────────────────────────────────┐
                        │   simulator.js / seismicSimulator.js     │
                        │   (standalone Node process — generates   │
                        │   realistic environmental & seismic data)│
                        └─────────────────────────────────────────┘
```

**How live updates flow:** the simulator writes new readings into `telemetry_metrics` and fires a Postgres `NOTIFY telemetry_update`. The API server keeps a persistent `LISTEN` connection open; on notification it looks up the affected metric and pushes a `TELEMETRY_UPDATE` message to every authenticated WebSocket client subscribed to that station (or to `ALL`, for admins). This keeps the dashboard live without any client-side polling.

**Authorization model:** every API route (except `/api/auth/*` and `/api/health`) requires a valid JWT *and* a live, non-revoked row in the `sessions` table — so logging out or an admin-triggered credential reset invalidates a token immediately, even before it expires. Scientists are hard-scoped to their `station_id`; admins can act network-wide.

---

## 🛠️ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express 5 |
| Real-time | `ws` (native WebSocket server) |
| Database | PostgreSQL (`pg` driver, connection pooling) |
| Auth | JSON Web Tokens (`jsonwebtoken`) + `bcrypt` password hashing |
| Security | `helmet` (HTTP headers), `cors`, `express-rate-limit` (login/recovery throttling) |
| Config | `dotenv` |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite |
| Mapping | Leaflet + React-Leaflet (station geolocation) |
| Styling | Plain CSS (`styles.css`) |
| API layer | Custom `api.js` client wrapping `fetch` + WebSocket connection |

### Database
- **PostgreSQL**, using native `ENUM` types (`user_role`, `request_status`), `JSONB` for audit detail payloads, `TIMESTAMPTZ` throughout, and Postgres `LISTEN/NOTIFY` as a lightweight pub/sub layer for real-time push — no external message broker needed.

### Tooling / Ops
- `nodemon`-free dev loop — `npm start` / `npm run simulator` / `npm run seed` scripts
- `.env`-based configuration (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_ORIGIN`, `DB_SSL`)

---

## 📁 Project Structure

```
DigitalTwin/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # Postgres pool + query helper
│   │   │   └── seed.js            # Seeds demo stations, users, telemetry, logistics
│   │   ├── controllers/
│   │   │   ├── authController.js  # login, logout, recovery, password change
│   │   │   ├── adminController.js # user & station management, audit log access
│   │   │   └── twinController.js  # telemetry, logistics, requests, emergency ops
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT verify, session check, role guard
│   │   │   └── error.js           # 404 + centralized error handler
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   └── twinRoutes.js
│   │   ├── utils/
│   │   │   └── audit.js           # writes to audit_logs
│   │   └── app.js                 # Express app assembly (middleware + routes)
│   ├── server.js                  # HTTP + WebSocket server, LISTEN/NOTIFY bridge
│   ├── simulator.js                # environmental telemetry generator
│   ├── seismicSimulator.js         # seismic data generator
│   └── package.json
├── database/
│   └── schema.sql                  # full Postgres schema (structure only, no data)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── SeismicObservatory.jsx
│   │   ├── App.jsx                 # Login, dashboard, routing state
│   │   ├── main.jsx                # React entry point
│   │   ├── api.js                  # REST + WebSocket client
│   │   └── styles.css
│   ├── public/stations/            # station imagery (Bharati, Maitri, NCPOR)
│   ├── index.html
│   └── package.json
└── .gitignore
```

---

## 🗃️ Data Model (PostgreSQL)

| Table | Purpose |
|---|---|
| `stations` | Master list of Antarctic stations (Bharati, Maitri, …) |
| `users` | Admins and visiting scientists, scoped to a station, with security-question recovery |
| `sessions` | Server-side JWT session registry — enables instant token revocation |
| `telemetry_metrics` | Current live value per metric per station (env/seismic/etc.) |
| `simulation_profiles` | Bounds/step size the simulator uses to generate realistic readings |
| `station_logistics` | Inventory items, quantities, reorder thresholds, supply status |
| `condition_requests` | Scientist-proposed changes to operating parameters, with admin review state |
| `emergency_events` | Emergency overrides — trigger, reason, resolution, rollback |
| `audit_logs` | Immutable log of every sensitive action across the platform |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (with `pgcrypto` extension available)

### 1. Clone the repo
```bash
git clone https://github.com/Krishna09-Gupta/DigitalTwin.git
cd DigitalTwin
```

### 2. Configure environment variables
Create a `.env` file in the project root (read by both `backend/server.js` and `backend/src/config/db.js`):
```env
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>
DB_SSL=false
JWT_SECRET=your_jwt_secret_here
FRONTEND_ORIGIN=http://localhost:5173
```

### 3. Set up the database
```bash
psql -d <database> -f database/schema.sql
```

### 4. Install & run the backend
```bash
cd backend
npm install
npm run seed     # creates demo stations, accounts, telemetry profiles, logistics
npm start        # starts the API + WebSocket server on $PORT
```

Optionally, in a separate terminal, run the live data simulator(s):
```bash
npm run simulator
node seismicSimulator.js
```

### 5. Install & run the frontend
```bash
cd ../frontend
npm install
npm run dev       # starts Vite dev server on http://localhost:5173
```

The frontend expects the API at the URL configured in `src/api.js`, and connects to telemetry over `ws://<host>/ws/telemetry`.

---

## 🔐 Roles & Workflow

| Role | Capabilities |
|---|---|
| **Admin** | Network-wide telemetry view, override/release station parameters directly, review & resolve scientist requests, manage users & stations, view audit logs, resolve emergency events |
| **Visiting Scientist** | View their station's telemetry & logistics, propose parameter changes (pending admin approval), trigger emergency overrides, view their own request history |

**Typical flow:** a scientist notices an out-of-range condition → submits a `condition_request` with justification → request appears in the admin's pending queue → admin approves/rejects → outcome and actor are recorded in `audit_logs`. For genuinely urgent situations, either role can fire an `emergency_override`, which immediately flags an `emergency_events` row for admin review and rollback.

---

## 📌 Roadmap / Future Scope
- Hardware/sensor integration to replace the simulator with live station feeds
- Push notifications / alerting for out-of-threshold telemetry
- Historical trend charts and export for research use
- Offline-first support for intermittent Antarctic connectivity

---

## 👥 Team

**Brainstorm Brigade** — Smart India Hackathon 2026, Problem Statement #26060.

---

## 📄 License

*Add a license of your choice (e.g. MIT) here.*
