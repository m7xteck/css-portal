# CSS Portal — Release 1 setup and deployment

This release does one workflow end to end: a manager invites a staff member and assigns shifts; the staff member sets a password from a one-time email link, signs in, and sees only their own shifts. They can also reset a forgotten password.

What gets deployed: `server/` (Node.js API and static file server) and `public/` (the release pages). The prototype files in the project root (`index.html`, `admin.html`, `staff.html`, `practice.html`, `js/`, `css/`) are **not** deployed and haven't been changed.

Replace these placeholders throughout:

| Placeholder | Example |
|---|---|
| `portal.REPLACE_ME.co.uk` | `portal.cssolutions.co.uk`: the new subdomain |
| `VPS_IP` | your Hostinger VPS IPv4 address |
| `PROJECT_REF` | the Supabase project reference (from its URL) |

---

## Part A — Supabase (do this first)

### A1. Create the project
1. At supabase.com, create a new project. **Region: West EU (London) `eu-west-2`** (keeps data in the UK).
2. Save the database password in your password manager.

### A2. Apply the database migrations (from your Mac, in this folder)
```bash
supabase login
supabase link --project-ref PROJECT_REF
supabase db push          # applies supabase/migrations/* — does NOT run seed.sql
```
Do **not** run `supabase db reset --linked` or `seed.sql` against production. The seed file holds local test sites only.

### A3. Add your real sites
In Supabase, open **SQL Editor** and run this with your own sites. `site_key` must be lowercase letters, digits and hyphens.
```sql
insert into public.sites (site_key, name) values
  ('riverside', 'Riverside PCN'),
  ('eastgate',  'Eastgate PCN'),
  ('westfield', 'Westfield PCN');
```
(The keys `riverside`, `eastgate` and `westfield` keep the existing coloured rota borders. Other keys work but show a neutral border.)

### A4. Authentication settings
**Authentication → Sign In / Providers**
- **Allow new users to sign up: OFF.** Accounts are created only by admin invitation.
- **Email** provider: **enabled.** Turning the Email provider off also stops password sign-in.
- Confirm email: on. Secure email change: on.
- **Email OTP expiration: `86400`** seconds (24 hours). This setting covers both invitation and reset links, and the email wording says 24 hours.
- **Minimum password length: 12**. **Password requirements: lowercase, uppercase letters and digits.**
- If your plan offers **Prevent use of leaked passwords**, turn it on.

**Authentication → URL Configuration**
- **Site URL:** `https://portal.REPLACE_ME.co.uk`
- **Redirect URLs:** add `https://portal.REPLACE_ME.co.uk/set-password.html` and `https://portal.REPLACE_ME.co.uk/index.html`

**Authentication → Emails → Templates**
- **Invite user**: subject `Set up your CSS Staff Portal account`. Body: paste the full contents of `supabase/templates/invite.html`.
- **Reset password**: subject `Reset your CSS Staff Portal password`. Body: paste `supabase/templates/recovery.html`.

Both templates link to `{{ .SiteURL }}/set-password.html?token_hash={{ .TokenHash }}&type=…`. Don't swap this for the default `{{ .ConfirmationURL }}`. The default link uses up the one-time token as soon as anything opens it, and NHSmail's link scanning opens links before the person does. With this template, the token is used only when the person submits their new password.

**Authentication → Rate Limits** (after custom SMTP is set up)
- Emails sent per hour: about `30`
- Minimum interval between emails to the same user: `60` seconds

### A5. Email sender (custom SMTP) — required
Supabase's built-in mailer is for testing only. It sends very few emails and may only deliver to your own team's addresses. You need your own SMTP sender:

1. Choose a sender:
   - **Recommended:** a transactional email service with UK/EU sending, such as Amazon SES in `eu-west-2`, Postmark, Brevo or Resend. These deliver more reliably to NHSmail.
   - **Or** a Hostinger email mailbox (hPanel → Emails), e.g. `no-reply@yourdomain`. SMTP host `smtp.hostinger.com`, port `465` (SSL), with the mailbox address and password.
2. In your domain's DNS (hPanel → Domains → DNS / Nameservers), add the records your provider gives you:
   - **SPF** (TXT on the sending domain). If an SPF record already exists, merge into it; never have two.
   - **DKIM** (CNAME or TXT records from the provider)
   - **DMARC** (TXT on `_dmarc`), e.g. `v=DMARC1; p=quarantine; rua=mailto:you@yourdomain`
   NHSmail is strict, and mail that fails SPF/DKIM/DMARC alignment is likely to be junked or rejected.
3. Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP:
   - Sender email: `no-reply@yourdomain` (must match the verified domain)
   - Sender name: `Clinical Support Solutions`
   - Host / Port / Username / Password: from your provider
4. Send yourself a password reset (Part D) to check delivery.

### A6. Copy the keys you need
**Project Settings → API Keys** (or **API**):
- Project URL → `SUPABASE_URL`
- `anon` / publishable key → `SUPABASE_ANON_KEY` (public)
- `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (**secret — VPS `.env` only**)

---

## Part B — Hostinger VPS on a new subdomain

Your current website is left alone. You only **add** one DNS record for the new subdomain and set up a separate server.

### B1. DNS
In **hPanel → Domains → (your domain) → DNS / Nameservers → DNS records**, add:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `portal` | `VPS_IP` | 3600 |
| AAAA *(only if the VPS has IPv6)* | `portal` | VPS IPv6 | 3600 |

Don't edit the existing `@`, `www` or MX records. If your domain's DNS is managed somewhere other than Hostinger, add the record there instead. Check with `dig +short portal.REPLACE_ME.co.uk`; it should return `VPS_IP`.

### B2. Prepare the VPS (Ubuntu 22.04/24.04 template, as root)
```bash
ssh root@VPS_IP
apt update && apt -y upgrade
apt -y install nginx certbot python3-certbot-nginx ufw rsync
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt -y install nodejs            # Node 22 LTS
node -v                          # must be v20 or newer

adduser --system --group --home /opt/css-portal cssportal
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```
If this VPS **already hosts another site with nginx**, skip nothing, but be careful in B5: you add a new server block, and you don't touch the existing ones.

### B3. Upload the code (from your Mac, in this folder)
```bash
rsync -av --delete \
  --exclude node_modules --exclude '.env' --exclude test \
  server public deploy root@VPS_IP:/opt/css-portal/
```
Then on the VPS:
```bash
cd /opt/css-portal/server
npm ci --omit=dev
chown -R cssportal:cssportal /opt/css-portal
```

### B4. Environment file (on the VPS)
```bash
nano /opt/css-portal/.env        # paste .env.example, then fill in the real values
chown cssportal:cssportal /opt/css-portal/.env
chmod 600 /opt/css-portal/.env
```
Set `APP_URL=https://portal.REPLACE_ME.co.uk`, `NODE_ENV=production`, `PORT=3100`, `TRUST_PROXY=1`, and the three Supabase values.

### B5. Run the app as a service
```bash
cp /opt/css-portal/deploy/css-portal.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now css-portal
systemctl status css-portal --no-pager
curl -s http://127.0.0.1:3100/api/health      # → {"ok":true}
```
If it fails to start: `journalctl -u css-portal -n 50`. A missing `.env` value is reported by name.

### B6. nginx and HTTPS
```bash
cp /opt/css-portal/deploy/nginx-css-portal.conf /etc/nginx/sites-available/css-portal
sed -i 's/portal.REPLACE_ME.co.uk/portal.yourdomain.co.uk/' /etc/nginx/sites-available/css-portal
ln -s /etc/nginx/sites-available/css-portal /etc/nginx/sites-enabled/css-portal
nginx -t && systemctl reload nginx
certbot --nginx -d portal.yourdomain.co.uk --redirect -m you@yourdomain --agree-tos -n
systemctl list-timers | grep certbot    # auto-renewal is installed
```
Check by opening `https://portal.yourdomain.co.uk`. You should see the sign-in page with no demo accounts.

### B7. Updating later
```bash
# from your Mac
rsync -av --delete --exclude node_modules --exclude '.env' --exclude test server public deploy root@VPS_IP:/opt/css-portal/
# on the VPS
cd /opt/css-portal/server && npm ci --omit=dev && chown -R cssportal:cssportal /opt/css-portal && systemctl restart css-portal
# new database migrations, from your Mac:
supabase db push
```

---

## Part C — Create the first admin

Run this on the VPS after Parts A and B, with a real mailbox you can open:
```bash
cd /opt/css-portal/server
sudo -u cssportal node --env-file=/opt/css-portal/.env scripts/create-admin.js \
  --email your.name@nhs.net --name "Your Name"
```
This creates the admin profile and emails an invitation. Open the email, select **Set up my account**, choose a password, then sign in at `https://portal.yourdomain.co.uk`.

- Running the script for an address that already has an account promotes it to admin.
- Admins don't have to be on `@nhs.net`. Staff do; this is enforced by the server and by a database constraint.
- To add more admins later, run the same command again.

---

## Part D — Go-live check (about 10 minutes)
1. Admin signs in → **Accounts** → add a test staff member with a real `@nhs.net` address → **Send invitation**.
2. **Rota & lunch** → choose them → add a recurring shift and a one-off shift.
3. On the NHSmail inbox, open the invitation and set a password. Use one that is **not** the NHSmail password.
4. On a different device or browser, sign in as that person → **Rota** shows only their shifts.
5. Sign out → **Forgotten password** → reset → sign in with the new password.
6. Admin → **Accounts** shows the person as **Active**. Deactivate them, then confirm they can no longer sign in.

## Running locally (developers)
```bash
supabase start                         # local stack on ports 553xx
cp .env.example .env                   # then fill from `supabase status -o env` (see README)
cd server && npm install
npm run dev                            # http://localhost:3100
npm test                               # unit tests
npm run test:e2e                       # full workflow against local Supabase + Mailpit
npm run test:ui                        # headless Chrome UI test (app must be running)
```
Local emails appear in Mailpit at http://127.0.0.1:55324.

## Security model (summary)
- **Browser**: holds only the public anon key. It signs in with Supabase Auth and calls the CSS API with the user's access token.
- **Server**: verifies every token with Supabase Auth, loads the caller's profile, refuses inactive accounts, and checks the admin role on admin routes. Reads and rota writes use the *caller's* token, so database RLS applies as well. The service-role key is used only for inviting users, creating profiles, banning deactivated accounts and writing the audit log.
- **Database (RLS)**: staff can select only their own profile and shifts. Only active admins can insert, update or delete shifts or update profiles. Profile inserts and audit log writes can't come from browsers at all. Shifts can be assigned only to active staff (trigger). Staff emails must be `@nhs.net` (check constraint).
- Deactivating someone bans them in Supabase Auth and blocks their existing token at once (the server and RLS both check `active`).
- Admin actions are recorded in `public.audit_log`.
