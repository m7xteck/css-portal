# CSS Portal

## Release 1 (live build)

Release 1 is a real, server-backed portal for one workflow: **admin invites staff (@nhs.net) → assigns shifts → staff set their own password from a one-time link → staff sign in and see only their own shifts (with password reset).** Unfinished modules are shown greyed out as "Soon".

```
public/                Release front end (login, set-password, admin, staff) — reuses css/styles.css
server/                Node.js + Express API; serves public/; holds the Supabase service-role key
  src/                 app, auth middleware, staff + rota routes, validation
  scripts/create-admin.js   creates the first admin (sends an invite email)
  test/                unit, end-to-end (local Supabase + Mailpit) and headless-Chrome UI tests
supabase/
  migrations/          PostgreSQL schema + row level security
  templates/           invitation and password-reset emails
  seed.sql             LOCAL test sites only
deploy/
  DEPLOY.md            Supabase setup, email sender, first admin, Hostinger VPS steps
  css-portal.service   systemd unit
  nginx-css-portal.conf
.env.example           configuration template (no secrets)
```

**Setup and deployment:** see [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

The files below (root `index.html`, `admin.html`, `staff.html`, `practice.html`, `js/`, `css/`, `backend/`) are the original prototype. They are unchanged, are not deployed, and still contain demo logins — don't upload them to the new subdomain.

---

## Original prototype

A working front-end prototype of a portal for Clinical Support Solutions (CSS), with two areas:

- **CSS Staff** — for pharmacists and pharmacy technicians: dashboard, rota, announcements, SOPs & documents, holiday requests, invoicing, and a tools hub.
- **PCN / Practice** — for the PCNs and practices CSS provides services to: dashboard, service info, service requests, announcements, documents & forms, and contacts.

## Try it

Open `index.html` in a browser. Demo logins:

**CSS Staff** (password `css2026`)
- `j.amin` — Jamila Amin, Pharmacist, Riverside PCN
- `t.brown` — Tom Brown, Pharmacy Technician, Eastgate PCN
- `s.khan` — Sara Khan, Pharmacist, Westfield PCN

**PCN / Practice** (password `practice2026`)
- `riverside` — Riverside Medical Centre
- `eastgate-pcn` — Eastgate PCN
- `westfield` — Westfield Surgery

## What this is — and isn't

This is a **front-end prototype**: all data (announcements, rota, documents, holiday requests, invoices, service requests) is sample data held in your browser's local storage. Logging in checks against a hard-coded demo list — there is **no real server, database, or security** behind it. Don't put real staff, patient, or financial data into it.

To turn this into something CSS can actually run day to day, you'd need:

1. **A real backend & database** — to store users, rota, documents, requests, invoices etc. centrally rather than per-browser.
2. **Proper authentication** — secure login (e.g. NHS-compliant identity provider, multi-factor authentication), with separate roles for staff vs. practice/PCN users and admin/management users.
3. **Hosting** — a server or cloud platform to run the backend and serve the site (with HTTPS).
4. **Data protection compliance** — given this will hold staff and organisational data (and potentially patient-related activity data), it should be reviewed against your information governance / DSP Toolkit requirements before go-live.
5. **Admin tools** — for CSS office staff to publish announcements/rota, approve holiday and invoices, manage documents, and respond to service requests (this prototype only shows the staff/practice-facing side).
6. **File storage** — for real document upload/download (SOPs, claim forms, reports).

## File structure

```
index.html        Login page (staff / practice tabs)
staff.html        CSS staff portal
practice.html     PCN / practice portal
css/styles.css    Shared styling
js/data.js        Shared mock data & local-storage helpers
js/staff.js       Staff portal logic
js/practice.js    Practice portal logic
```
