-- ============================================================
--  CSS Portal — PostgreSQL Database Schema
--  Self-hosted Node.js + PostgreSQL backend
--  Designed for future SystmOne / EMIS FHIR integration
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
--  USERS
--  Replaces db.users.staff + db.users.admin + db.users.practice
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,              -- bcrypt, never plain text
  name            TEXT NOT NULL,
  email           TEXT,
  role            TEXT NOT NULL,              -- 'Pharmacist' | 'Technician' | 'Administrator' | 'Practice Manager' etc.
  user_type       TEXT NOT NULL,              -- 'staff' | 'admin' | 'practice'
  tier            TEXT,                       -- 'super' | 'standard' | 'limited'  (admin only)
  site            TEXT,                       -- primary site (staff)
  org             TEXT,                       -- organisation name (practice)
  org_type        TEXT,                       -- 'PCN' | 'Practice' (practice)
  contract_type   TEXT,                       -- 'PAYE' | 'Locum' | 'Ltd' (staff)
  hours_per_week  NUMERIC(5,2),
  hourly_rate     NUMERIC(8,2),
  nhs_email       TEXT,                       -- for future NHS CIS2 auth
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  ROTA PATTERNS  (recurring weekly shifts)
-- ============================================================
CREATE TABLE rota_patterns (
  id          SERIAL PRIMARY KEY,
  staff_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_name  TEXT NOT NULL,                  -- denormalised for display speed
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 5),  -- 1=Mon .. 5=Fri
  site        TEXT NOT NULL,
  site_key    TEXT NOT NULL,
  shift       TEXT NOT NULL,                  -- '09:00–17:00'
  lunch_mins  INTEGER DEFAULT 0,
  note        TEXT,
  start_date  DATE,
  end_date    DATE,                           -- NULL = ongoing
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  ONE-OFF SHIFTS  (overtime, bank holiday cover)
-- ============================================================
CREATE TABLE one_off_shifts (
  id          SERIAL PRIMARY KEY,
  staff_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  staff_name  TEXT NOT NULL,
  date        DATE NOT NULL,
  site        TEXT NOT NULL,
  site_key    TEXT NOT NULL,
  shift       TEXT NOT NULL,
  lunch_mins  INTEGER DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  ADMIN TASKS  (task ledger)
-- ============================================================
CREATE TABLE admin_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  assigned_to TEXT NOT NULL,                  -- admin name
  due_date    DATE NOT NULL,
  category    TEXT DEFAULT 'general',         -- general | phone | followup | prescription | referral | admin | urgent
  priority    TEXT DEFAULT 'normal',          -- normal | urgent
  status      TEXT DEFAULT 'pending',         -- pending | done
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  ADMIN WORK SCHEDULES  (ledger column days)
-- ============================================================
CREATE TABLE admin_work_schedules (
  id          SERIAL PRIMARY KEY,
  admin_name  TEXT NOT NULL UNIQUE,
  days        TEXT[] NOT NULL               -- e.g. ARRAY['Mon','Tue','Wed','Thu','Fri']
);


-- ============================================================
--  HOLIDAY REQUESTS
-- ============================================================
CREATE TABLE holiday_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_name    TEXT NOT NULL,
  role          TEXT,
  date_from     DATE NOT NULL,
  date_to       DATE NOT NULL,
  note          TEXT,
  status        TEXT DEFAULT 'Pending',      -- Pending | Approved | Declined
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  TRAINING / STAFF DOCUMENTS & CERTIFICATES
-- ============================================================
CREATE TABLE training_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_name    TEXT NOT NULL,
  title         TEXT NOT NULL,
  doc_type      TEXT,                        -- 'GPhC' | 'DBS' | 'Training' | 'Indemnity' etc.
  file_url      TEXT,                        -- path in object storage (S3 / Cloudflare R2)
  expiry_date   DATE,
  status        TEXT DEFAULT 'Pending',      -- Pending | Approved | Rejected
  reviewed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  uploaded_at   TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  ANNOUNCEMENTS
-- ============================================================
CREATE TABLE announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  audience    TEXT DEFAULT 'all',            -- 'all' | 'staff' | 'admin' | 'practice'
  pinned      BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  INVOICES
-- ============================================================
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT UNIQUE NOT NULL,
  practice_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  practice_name   TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  vat             NUMERIC(10,2) DEFAULT 0,
  status          TEXT DEFAULT 'Draft',      -- Draft | Sent | Paid | Overdue
  issue_date      DATE,
  due_date        DATE,
  paid_date       DATE,
  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  SERVICES  (what CSS offers)
-- ============================================================
CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  active      BOOLEAN DEFAULT true
);


-- ============================================================
--  SERVICE REQUESTS  (from practices)
-- ============================================================
CREATE TABLE service_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  practice_name TEXT NOT NULL,
  service_id    UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name  TEXT NOT NULL,
  details       TEXT,
  status        TEXT DEFAULT 'Pending',      -- Pending | In Progress | Complete | Declined
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  CONTACTS
-- ============================================================
CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  role          TEXT,
  organisation  TEXT,
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  CONTRACTS
-- ============================================================
CREATE TABLE contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  practice_name TEXT NOT NULL,
  contract_type TEXT,
  start_date    DATE,
  end_date      DATE,
  value         NUMERIC(10,2),
  status        TEXT DEFAULT 'Active',       -- Active | Expired | Terminated
  notes         TEXT,
  file_url      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  INCIDENT REPORTS
-- ============================================================
CREATE TABLE incident_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  severity      TEXT,                        -- Low | Medium | High | Critical
  reported_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_name TEXT,
  site          TEXT,
  status        TEXT DEFAULT 'Open',         -- Open | Under Review | Closed
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  AUDIT LOG  (mandatory for NHS data access)
--  Every read, create, update and delete is recorded here.
-- ============================================================
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name   TEXT,
  user_type   TEXT,
  action      TEXT NOT NULL,                 -- 'READ' | 'CREATE' | 'UPDATE' | 'DELETE'
  resource    TEXT NOT NULL,                 -- table name  e.g. 'admin_tasks'
  resource_id TEXT,                          -- the record's id
  before_data JSONB,                         -- snapshot before change
  after_data  JSONB,                         -- snapshot after change
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast audit queries by user or date
CREATE INDEX audit_log_user_idx     ON audit_log (user_id, created_at DESC);
CREATE INDEX audit_log_resource_idx ON audit_log (resource, resource_id);


-- ============================================================
--  FHIR INTEGRATION  (future — SystmOne / EMIS)
--  Stores references to clinical data pulled via FHIR R4 API.
--  Never stores raw patient data — only links and cached summaries.
-- ============================================================
CREATE TABLE fhir_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,                 -- 'emis' | 'systmone'
  base_url    TEXT NOT NULL,                 -- FHIR server endpoint
  access_token_encrypted TEXT,              -- encrypted OAuth token
  token_expires_at TIMESTAMPTZ,
  active      BOOLEAN DEFAULT true,
  linked_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fhir_report_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,             -- 'emis' | 'systmone'
  report_type     TEXT NOT NULL,             -- 'appointments' | 'prescriptions' | 'referrals'
  date_from       DATE,
  date_to         DATE,
  data            JSONB NOT NULL,            -- cached FHIR response (de-identified)
  fetched_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ               -- stale after this — re-fetch on next request
);
