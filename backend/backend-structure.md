# CSS Portal — Backend Structure
Self-hosted Node.js + PostgreSQL · Designed for SystmOne / EMIS FHIR integration

---

## Folder Structure

```
css-portal/
│
├── backend/                        ← Server (Node.js + Express)
│   │
│   ├── index.js                    ← Entry point — starts the server
│   │
│   ├── config/
│   │   ├── db.js                   ← PostgreSQL connection pool
│   │   └── env.js                  ← Loads .env variables safely
│   │
│   ├── routes/                     ← One file per feature area
│   │   ├── auth.js                 ← Login / logout / session
│   │   ├── users.js                ← Staff, admin, practice accounts
│   │   ├── rota.js                 ← Patterns + one-off shifts + week view
│   │   ├── tasks.js                ← Admin task ledger
│   │   ├── holidays.js             ← Holiday requests + approvals
│   │   ├── training.js             ← Documents / certificates
│   │   ├── announcements.js
│   │   ├── invoices.js             ← Super admin only
│   │   ├── services.js             ← Services + service requests
│   │   ├── contacts.js
│   │   ├── contracts.js
│   │   ├── incidents.js
│   │   └── fhir/                   ← Future clinical integration
│   │       ├── emis.js             ← EMIS Web FHIR R4 connector
│   │       └── systmone.js         ← SystmOne FHIR R4 connector
│   │
│   ├── middleware/
│   │   ├── auth.js                 ← Verify JWT on every request
│   │   ├── rbac.js                 ← Role checks (super / standard / limited / staff / practice)
│   │   └── audit.js                ← Auto-log every request to audit_log table
│   │
│   ├── models/                     ← Database query functions (no raw SQL in routes)
│   │   ├── user.js
│   │   ├── rota.js
│   │   ├── task.js
│   │   ├── holiday.js
│   │   ├── invoice.js
│   │   └── ...
│   │
│   └── db/
│       ├── schema.sql              ← Full database schema (run once to set up)
│       └── seed.sql                ← Demo data matching current localStorage prototype
│
├── client/                         ← Your existing front-end (unchanged to start)
│   ├── index.html
│   ├── admin.html
│   ├── staff.html
│   ├── practice.html
│   ├── css/
│   └── js/
│       ├── data.js                 ← Replace cssLoadDB/cssSaveDB with API calls here
│       ├── admin.js
│       ├── staff.js
│       └── practice.js
│
├── .env                            ← Secrets — NEVER commit to Git
├── .env.example                    ← Safe template to share with team
├── package.json
├── .gitignore
└── README.md
```

---

## API Routes

### Authentication
```
POST   /api/auth/login              → returns JWT token
POST   /api/auth/logout
GET    /api/auth/me                 → returns logged-in user info
```

### Users
```
GET    /api/users                   → list all (super admin only)
POST   /api/users                   → create account
PUT    /api/users/:id               → edit account
DELETE /api/users/:id               → deactivate
```

### Rota
```
GET    /api/rota/week?start=YYYY-MM-DD   → replaces cssRotaForWeek()
GET    /api/rota/patterns
POST   /api/rota/patterns
PUT    /api/rota/patterns/:id
DELETE /api/rota/patterns/:id
GET    /api/rota/one-off
POST   /api/rota/one-off
DELETE /api/rota/one-off/:id
```

### Task Ledger
```
GET    /api/tasks?date=YYYY-MM-DD&assignee=name
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
```

### Holidays, Training, Announcements, Invoices, Services,
### Contacts, Contracts, Incidents — all follow same pattern:
```
GET    /api/<resource>
POST   /api/<resource>
PUT    /api/<resource>/:id
DELETE /api/<resource>/:id
```

### FHIR (future — once partner approval is in place)
```
GET    /api/fhir/emis/appointments?practice=:id&from=YYYY-MM-DD
GET    /api/fhir/emis/prescriptions?practice=:id
GET    /api/fhir/systmone/appointments?practice=:id&from=YYYY-MM-DD
GET    /api/fhir/systmone/referrals?practice=:id
```

---

## Key .env Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/css_portal

# Auth
JWT_SECRET=your-long-random-secret-here
JWT_EXPIRES_IN=8h

# Server
PORT=3000
NODE_ENV=production

# File storage (for training documents)
S3_BUCKET=css-portal-docs
S3_REGION=eu-west-2
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# FHIR (add when ready)
EMIS_FHIR_BASE_URL=https://...
EMIS_CLIENT_ID=...
EMIS_CLIENT_SECRET=...
SYSTMONE_FHIR_BASE_URL=https://...
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | Widely supported, good FHIR libraries |
| Framework | Express.js | Simple, well-documented |
| Database | PostgreSQL 16 | Industry standard, NHS-compatible |
| Auth | JWT (jsonwebtoken) | Stateless, easy to add NHS CIS2 later |
| Passwords | bcrypt | Industry standard hashing |
| File storage | AWS S3 / Cloudflare R2 | Training documents, contracts |
| Hosting | UK VPS (e.g. Hetzner, DigitalOcean LON) | UK data residency |
| FHIR | fhir.js or @medplum/core | Parse FHIR R4 responses |

---

## Migration Path from localStorage

The front-end migration is straightforward — replace two functions:

**Before (localStorage):**
```js
const db = cssLoadDB();
const tasks = db.adminTasks;
cssSaveDB(db);
```

**After (API):**
```js
const tasks = await fetch('/api/tasks').then(r => r.json());
await fetch('/api/tasks', { method: 'POST', body: JSON.stringify(task) });
```

All the display logic, CSS, and HTML stays exactly the same.

---

## Compliance Checklist (before going live with NHS data)

- [ ] DSP Toolkit annual submission
- [ ] Cyber Essentials certification
- [ ] Data Processing Agreements with each PCN / practice
- [ ] Penetration test (basic)
- [ ] Audit log reviewed and retained for minimum 1 year
- [ ] Data encrypted at rest (PostgreSQL + storage)
- [ ] Data encrypted in transit (HTTPS / TLS 1.2+)
- [ ] FHIR partner application submitted to EMIS / TPP
- [ ] NHS CIS2 authentication implemented (for clinical staff login)
- [ ] Clinical safety case (DCB0129) if generating clinical outputs
