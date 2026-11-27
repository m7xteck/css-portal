// End-to-end test of the release-1 workflow against a LOCAL Supabase stack
// (`supabase start`). Emails are captured by the local Mailpit inbox.
// Never point this at production: it creates and deletes users.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { createServiceClient } from '../src/supabase.js';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const MAILPIT = process.env.MAILPIT_URL;

if (!/127\.0\.0\.1|localhost/.test(config.supabaseUrl)) {
  throw new Error(`Refusing to run e2e tests against non-local Supabase: ${config.supabaseUrl}`);
}

const service = createServiceClient(config);
const tag = Date.now().toString(36);
const ADMIN_EMAIL = `e2e.admin.${tag}@nhs.net`;
const STAFF_EMAIL = `e2e.staff.${tag}@nhs.net`;
const STAFF2_EMAIL = `e2e.other.${tag}@nhs.net`;
const ADMIN_PW = 'AdminPassw0rd!x';
const STAFF_PW = 'StaffPassw0rdOne';
const STAFF_PW2 = 'StaffPassw0rdTwo';
const createdUserIds = new Set();

let server, base, siteId, staffId, staff2Id, adminToken, staffToken;

// Each "device" is a separate, isolated Supabase client (own session storage).
function device() {
  const store = new Map();
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    },
  });
}

async function http(method, url, token, body) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

// Waits for an email to `to` whose subject matches, returns {tokenHash, type, href}.
async function emailLink(to, subjectRe, notIds = new Set()) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((x) => x.json());
    const msg = (r.messages || []).find((m) => subjectRe.test(m.Subject) && !notIds.has(m.ID));
    if (msg) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then((x) => x.json());
      const m = /href="([^"]*set-password\.html\?token_hash=([^&"]+)&(?:amp;)?type=(\w+))"/.exec(full.HTML);
      assert.ok(m, `no set-password link in email: ${full.HTML.slice(0, 500)}`);
      return { id: msg.ID, href: m[1].replace(/&amp;/g, '&'), tokenHash: m[2], type: m[3] };
    }
    await new Promise((r2) => setTimeout(r2, 250));
  }
  throw new Error(`No email matching ${subjectRe} for ${to}`);
}

async function signIn(email, password) {
  const c = device();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  return { client: c, token: data?.session?.access_token, error };
}

const week = (() => {
  const d = new Date(); const dow = d.getDay() || 7; d.setDate(d.getDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
})();
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

before(async () => {
  const app = createApp(config, { service });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  const { data: site } = await service.from('sites').select('id').eq('site_key', 'test-site-a').single();
  siteId = site.id;
});

after(async () => {
  for (const id of createdUserIds) await service.auth.admin.deleteUser(id).catch(() => {});
  await new Promise((r) => server.close(r));
});

test('1. first admin is created with the create-admin script and sets a password from the invite', async () => {
  const { stdout } = await run(process.execPath, ['--env-file=../.env', 'scripts/create-admin.js', '--email', ADMIN_EMAIL, '--name', 'E2E Admin'], { cwd: path.resolve(here, '..') });
  assert.match(stdout, /Invitation sent/);
  const { data: prof } = await service.from('profiles').select('id, role').eq('email', ADMIN_EMAIL).single();
  createdUserIds.add(prof.id);
  assert.equal(prof.role, 'admin');

  const link = await emailLink(ADMIN_EMAIL, /Set up your CSS Staff Portal account/);
  assert.equal(link.type, 'invite');
  const dev = device();
  const { error: vErr } = await dev.auth.verifyOtp({ token_hash: link.tokenHash, type: 'invite' });
  assert.ifError(vErr);
  const { error: uErr } = await dev.auth.updateUser({ password: ADMIN_PW });
  assert.ifError(uErr);

  const s = await signIn(ADMIN_EMAIL, ADMIN_PW);
  assert.ifError(s.error);
  adminToken = s.token;
  const me = await http('GET', '/api/me', adminToken);
  assert.equal(me.status, 200);
  assert.equal(me.body.role, 'admin');
});

test('2. admin invites staff — only @nhs.net accepted, duplicates refused', async () => {
  const bad = await http('POST', '/api/staff', adminToken, { fullName: 'Bad Domain', email: `x.${tag}@gmail.com` });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /@nhs\.net/);

  const res = await http('POST', '/api/staff', adminToken, { fullName: 'Erin Tester', email: STAFF_EMAIL, jobTitle: 'Pharmacist', siteId });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.invitationAccepted, false);
  staffId = res.body.id;
  createdUserIds.add(staffId);

  const dup = await http('POST', '/api/staff', adminToken, { fullName: 'Erin Again', email: STAFF_EMAIL.toUpperCase() });
  assert.equal(dup.status, 409);

  const res2 = await http('POST', '/api/staff', adminToken, { fullName: 'Other Person', email: STAFF2_EMAIL, jobTitle: 'Pharmacy Technician', siteId });
  assert.equal(res2.status, 201);
  staff2Id = res2.body.id;
  createdUserIds.add(staff2Id);

  const list = await http('GET', '/api/staff', adminToken);
  assert.equal(list.status, 200);
  assert.ok(list.body.some((a) => a.email === STAFF_EMAIL));
});

test('3. admin assigns shifts (recurring + one-off), with validation', async () => {
  const p = await http('POST', '/api/rota/patterns', adminToken, {
    staffId, weekday: 2, siteId, startTime: '09:00', endTime: '17:00', lunchMins: 30, startDate: week, note: 'Clinic A',
  });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  assert.equal(p.body.shift, '09:00–17:00');

  const o = await http('POST', '/api/rota/one-off', adminToken, {
    staffId, date: addDays(week, 3), siteId, startTime: '08:00', endTime: '12:00', lunchMins: 0, note: 'Overtime',
  });
  assert.equal(o.status, 201, JSON.stringify(o.body));

  // Another person's shift, which Erin must never see.
  const p2 = await http('POST', '/api/rota/patterns', adminToken, {
    staffId: staff2Id, weekday: 2, siteId, startTime: '10:00', endTime: '14:00', lunchMins: 0, startDate: week, note: 'SECRET-OTHER',
  });
  assert.equal(p2.status, 201);

  const badTimes = await http('POST', '/api/rota/patterns', adminToken, { staffId, weekday: 1, siteId, startTime: '17:00', endTime: '09:00', startDate: week });
  assert.equal(badTimes.status, 400);
  const { data: adminProf } = await service.from('profiles').select('id').eq('email', ADMIN_EMAIL).single();
  const toAdmin = await http('POST', '/api/rota/patterns', adminToken, { staffId: adminProf.id, weekday: 1, siteId, startTime: '09:00', endTime: '10:00', startDate: week });
  assert.equal(toAdmin.status, 400);
  assert.match(toAdmin.body.error, /active staff/);
});

let usedInvite;
test('4. staff accepts the one-time invite and sets a separate password', async () => {
  const link = await emailLink(STAFF_EMAIL, /Set up your CSS Staff Portal account/);
  usedInvite = link;
  assert.equal(link.type, 'invite');
  assert.ok(link.href.startsWith(`${config.appUrl}/set-password.html`), link.href);

  // A link scanner / preview fetching the page must NOT consume the token.
  const page = await fetch(`${base}/set-password.html?token_hash=${link.tokenHash}&type=invite`);
  assert.equal(page.status, 200);

  const phone = device();
  const { error: vErr } = await phone.auth.verifyOtp({ token_hash: link.tokenHash, type: 'invite' });
  assert.ifError(vErr);
  const weak = await phone.auth.updateUser({ password: 'short' });
  assert.ok(weak.error, 'weak password should be rejected by Supabase Auth policy');
  const { error: uErr } = await phone.auth.updateUser({ password: STAFF_PW });
  assert.ifError(uErr);
  await phone.auth.signOut({ scope: 'local' });

  // The link is single use.
  const again = await device().auth.verifyOtp({ token_hash: link.tokenHash, type: 'invite' });
  assert.ok(again.error, 'invite token must not be reusable');

  const list = await http('GET', '/api/staff', adminToken);
  assert.equal(list.body.find((a) => a.id === staffId).invitationAccepted, true);
});

test('5. staff signs in on a separate device and sees only their own shifts', async () => {
  const laptop = await signIn(STAFF_EMAIL, STAFF_PW);
  assert.ifError(laptop.error);
  staffToken = laptop.token;

  const me = await http('GET', '/api/me', staffToken);
  assert.equal(me.status, 200);
  assert.equal(me.body.role, 'staff');
  assert.equal(me.body.siteName, 'Test Site A');

  const rota = await http('GET', `/api/rota?from=${week}&to=${addDays(week, 6)}`, staffToken);
  assert.equal(rota.status, 200);
  assert.equal(rota.body.patterns.length, 1);
  assert.equal(rota.body.oneOffs.length, 1);
  assert.ok([...rota.body.patterns, ...rota.body.oneOffs].every((s) => s.staffId === staffId));
  assert.ok(!JSON.stringify(rota.body).includes('SECRET-OTHER'));

  // Trying to ask for someone else's rota is ignored.
  const sneaky = await http('GET', `/api/rota?from=${week}&to=${addDays(week, 6)}&staffId=${staff2Id}`, staffToken);
  assert.ok(sneaky.body.patterns.every((s) => s.staffId === staffId));
  assert.ok(!JSON.stringify(sneaky.body).includes('SECRET-OTHER'));
});

test('6. staff cannot use admin actions (server)', async () => {
  const checks = [
    ['GET', '/api/staff'],
    ['POST', '/api/staff', { fullName: 'Hacker', email: `h.${tag}@nhs.net` }],
    ['PATCH', `/api/staff/${staff2Id}`, { active: false }],
    ['POST', `/api/staff/${staff2Id}/resend-invite`],
    ['GET', `/api/rota/patterns?staffId=${staff2Id}`],
    ['POST', '/api/rota/patterns', { staffId, weekday: 1, siteId, startTime: '09:00', endTime: '17:00', startDate: week }],
    ['POST', '/api/rota/one-off', { staffId, date: week, siteId, startTime: '09:00', endTime: '17:00' }],
    ['GET', '/api/rota/one-off'],
  ];
  for (const [m, url, body] of checks) {
    const r = await http(m, url, staffToken, body);
    assert.equal(r.status, 403, `${m} ${url} returned ${r.status}`);
  }
  const anon = await http('GET', `/api/rota?from=${week}&to=${week}`, null);
  assert.equal(anon.status, 401);
});

test('7. database RLS blocks staff even when calling Supabase directly', async () => {
  const { client } = await signIn(STAFF_EMAIL, STAFF_PW);

  const { data: pats } = await client.from('rota_patterns').select('staff_id, note');
  assert.ok(pats.length >= 1 && pats.every((r) => r.staff_id === staffId), 'staff sees only own patterns');

  const { data: profs } = await client.from('profiles').select('id');
  assert.deepEqual(profs.map((p) => p.id), [staffId], 'staff sees only own profile');

  const ins = await client.from('rota_patterns').insert({ staff_id: staffId, weekday: 1, site_id: siteId, start_time: '09:00', end_time: '10:00' });
  assert.ok(ins.error, 'staff insert must fail');

  const up = await client.from('profiles').update({ role: 'admin' }).eq('id', staffId).select();
  assert.ok(up.error || up.data.length === 0, 'staff must not self-promote');
  const { data: still } = await service.from('profiles').select('role').eq('id', staffId).single();
  assert.equal(still.role, 'staff');

  const del = await client.from('one_off_shifts').delete().eq('staff_id', staffId).select();
  assert.ok(del.error || del.data.length === 0, 'staff must not delete shifts');

  const audit = await client.from('audit_log').select('id');
  assert.ok(audit.error || audit.data.length === 0, 'staff must not read the audit log');

  const anon = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: false } });
  const a1 = await anon.from('rota_patterns').select('id');
  assert.ok(a1.error || a1.data.length === 0, 'anon must not read shifts');
  const a2 = await anon.from('profiles').select('id');
  assert.ok(a2.error || a2.data.length === 0, 'anon must not read profiles');

  // Public sign-up is disabled — accounts only come from admin invitations.
  const su = await device().auth.signUp({ email: `self.${tag}@nhs.net`, password: 'SelfSignup123A' });
  assert.ok(su.error, 'public sign-up must be disabled');
});

test('8. staff can reset a forgotten password', async () => {
  const before8 = new Set();
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${STAFF_EMAIL}"`)}`).then((x) => x.json());
  (r.messages || []).forEach((m) => before8.add(m.ID));

  const { error } = await device().auth.resetPasswordForEmail(STAFF_EMAIL, { redirectTo: `${config.appUrl}/set-password.html` });
  assert.ifError(error);
  const link = await emailLink(STAFF_EMAIL, /Reset your CSS Staff Portal password/, before8);
  assert.equal(link.type, 'recovery');

  const dev = device();
  const { error: vErr } = await dev.auth.verifyOtp({ token_hash: link.tokenHash, type: 'recovery' });
  assert.ifError(vErr);
  const { error: uErr } = await dev.auth.updateUser({ password: STAFF_PW2 });
  assert.ifError(uErr);

  assert.ok((await signIn(STAFF_EMAIL, STAFF_PW)).error, 'old password must stop working');
  const ok = await signIn(STAFF_EMAIL, STAFF_PW2);
  assert.ifError(ok.error);
  staffToken = ok.token;

  // Reset for an unknown address gives no error (no account enumeration) and sends nothing.
  const unknown = await device().auth.resetPasswordForEmail(`nobody.${tag}@nhs.net`);
  assert.ifError(unknown.error);
});

test('9. resend invite only for pending accounts', async () => {
  const pending = await http('POST', `/api/staff/${staff2Id}/resend-invite`, adminToken);
  assert.equal(pending.status, 200, JSON.stringify(pending.body));
  const accepted = await http('POST', `/api/staff/${staffId}/resend-invite`, adminToken);
  assert.equal(accepted.status, 409);
});

test('10. deactivated staff lose access immediately', async () => {
  const off = await http('PATCH', `/api/staff/${staffId}`, adminToken, { active: false });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.equal(off.body.active, false);

  const r = await http('GET', `/api/rota?from=${week}&to=${week}`, staffToken);
  assert.ok([401, 403].includes(r.status), `old token got ${r.status}`);
  assert.ok((await signIn(STAFF_EMAIL, STAFF_PW2)).error, 'deactivated user cannot sign in');

  const self = await http('PATCH', `/api/staff/${(await http('GET', '/api/me', adminToken)).body.id}`, adminToken, { active: false });
  assert.equal(self.status, 409, 'admin cannot deactivate themself');

  const on = await http('PATCH', `/api/staff/${staffId}`, adminToken, { active: true });
  assert.equal(on.status, 200);
  assert.ifError((await signIn(STAFF_EMAIL, STAFF_PW2)).error);
});

test('11. admin actions are audited; static pages carry no demo credentials', async () => {
  const { data } = await service.from('audit_log').select('action, resource').in('resource', ['profiles', 'rota_patterns', 'one_off_shifts']);
  const actions = new Set(data.map((d) => `${d.action}:${d.resource}`));
  for (const a of ['invite:profiles', 'create:rota_patterns', 'create:one_off_shifts', 'update:profiles']) assert.ok(actions.has(a), a);

  for (const page of ['/', '/admin.html', '/staff.html', '/set-password.html', '/js/portal.js', '/js/login.js', '/js/admin.js']) {
    const text = await (await fetch(base + page)).text();
    assert.ok(!/css2026|admin2026|practice2026|j\.amin|demo account/i.test(text), `${page} contains demo credentials`);
    assert.ok(!text.includes(config.supabaseServiceRoleKey), `${page} leaks the service role key`);
  }
  const cfg = await (await fetch(base + '/config.js')).text();
  assert.ok(!cfg.includes(config.supabaseServiceRoleKey));
  const csp = (await fetch(base + '/')).headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
});
