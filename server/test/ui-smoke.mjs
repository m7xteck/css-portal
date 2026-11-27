// Local headless browser test of the release-1 UI (admin + staff sessions).
// Needs: `supabase start`, the app running locally (npm run dev), Google Chrome.
// Run: npm run test:ui     — LOCAL ONLY: creates and deletes test users.
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import os from 'node:os';
import path from 'node:path';
if (!/127\.0\.0\.1|localhost/.test(process.env.SUPABASE_URL)) throw new Error('Refusing to run against non-local Supabase');

const APP = process.env.APP_URL; // http://localhost:3100
const MAILPIT = process.env.MAILPIT_URL;
const svc = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = Date.now().toString(36);
const ADMIN = `ui.admin.${tag}@nhs.net`, STAFF = `ui.staff.${tag}@nhs.net`;
const ADMIN_PW = 'UiAdminPassw0rd', STAFF_PW = 'UiStaffPassw0rd1', STAFF_PW2 = 'UiStaffPassw0rd2';
const users = [];
const errors = [];
const results = [];
const ok = (name) => { results.push(`✔ ${name}`); console.log(`✔ ${name}`); };
const assert = (c, m) => { if (!c) throw new Error(m); };

async function mailLink(to, subj, skip = new Set()) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((x) => x.json());
    const m = (r.messages || []).find((x) => subj.test(x.Subject) && !skip.has(x.ID));
    if (m) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`).then((x) => x.json());
      return { id: m.ID, href: /href="([^"]*set-password[^"]*)"/.exec(full.HTML)[1].replace(/&amp;/g, '&') };
    }
    await new Promise((r2) => setTimeout(r2, 250));
  }
  throw new Error('no email for ' + to);
}
function watch(page, label) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  page.on('dialog', (d) => d.accept());
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`[${label}] HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  // Admin account (created directly — the create-admin script is covered by the e2e suite).
  const { data: a } = await svc.auth.admin.createUser({ email: ADMIN, password: ADMIN_PW, email_confirm: true });
  users.push(a.user.id);
  await svc.from('profiles').insert({ id: a.user.id, email: ADMIN, full_name: 'Ula Admin', role: 'admin' });

  // ---------- Browser session 1: admin ----------
  const adminCtx = await browser.newContext();
  const ap = await adminCtx.newPage(); watch(ap, 'admin');
  await ap.goto(`${APP}/`);
  assert(!(await ap.content()).match(/css2026|admin2026|Demo account/i), 'demo credentials on login page');
  await ap.fill('#email', ADMIN); await ap.fill('#password', ADMIN_PW);
  await ap.click('#signInBtn');
  await ap.waitForURL('**/admin.html');
  await ap.waitForSelector('#whoBox strong');
  ok('admin signs in and lands on admin.html');

  const disabled = await ap.$$eval('.nav-item.is-disabled', (els) => els.length);
  assert(disabled === 13, `expected 13 disabled modules, got ${disabled}`);
  await ap.click('.nav-item.is-disabled >> nth=0', { force: true });
  assert(await ap.isVisible('#sec-dashboard'), 'disabled module should not navigate');
  ok('unfinished modules are disabled (13 greyed out, not clickable)');

  await ap.click('.nav-item[data-section="staff-mgmt"]');
  await ap.fill('#smFullName', 'Gina Gmail'); await ap.fill('#smEmail', `gina.${tag}@gmail.com`);
  await ap.click('#smSaveBtn');
  await ap.waitForFunction(() => /nhs\.net/.test(document.getElementById('smMsg').textContent));
  ok('Add Staff rejects a non-@nhs.net email');

  await ap.fill('#smFullName', 'Sam <b>Staff</b>'); await ap.fill('#smEmail', STAFF);
  await ap.selectOption('#smRole', 'Pharmacy Technician');
  await ap.selectOption('#smSite', { label: 'Test Site B' });
  await ap.click('#smSaveBtn');
  await ap.waitForFunction(() => /Invitation sent/.test(document.getElementById('smMsg').textContent), null, { timeout: 10000 });
  await ap.waitForSelector('#staffAccountList >> text=Invitation pending');
  assert(await ap.$('#staffAccountList b') === null, 'name was rendered as HTML (XSS)');
  ok('Add Staff sends invitation; list shows "Invitation pending"; names are HTML-escaped');
  const { data: sp } = await svc.from('profiles').select('id').eq('email', STAFF).single();
  users.push(sp.id);

  await ap.click('.nav-item[data-section="rota"]');
  await ap.waitForSelector('#rotaStaffSelect option', { state: 'attached' });
  await ap.selectOption('#rotaStaffSelect', sp.id);
  await ap.selectOption('#rotaWeekday', '1');
  await ap.selectOption('#rotaSite', { label: 'Test Site B' });
  await ap.fill('#rotaFrom', '08:30'); await ap.fill('#rotaTo', '16:30'); await ap.fill('#rotaLunch', '45');
  await ap.fill('#rotaStartDate', await ap.evaluate(() => Portal.weekStartIso(Portal.todayIso())));
  await ap.fill('#rotaNote', 'UI clinic');
  await ap.click('#rotaSaveBtn');
  await ap.waitForSelector('#rotaShiftsList >> text=08:30–16:30');
  await ap.waitForSelector('#adminWeekCalendar >> text=08:30–16:30');
  ok('admin assigns a recurring shift; it appears in the list and weekly calendar');

  // One-off shift on Wednesday of this week
  const wed = await ap.evaluate(() => Portal.addDays(Portal.weekStartIso(Portal.todayIso()), 2));
  await ap.selectOption('#ooStaff', sp.id); await ap.fill('#ooDate', wed);
  await ap.fill('#ooFrom', '18:00'); await ap.fill('#ooTo', '20:00'); await ap.fill('#ooLunch', '0');
  await ap.fill('#ooNote', 'UI overtime');
  await ap.click('#ooForm button[type=submit]');
  await ap.waitForFunction(() => /One-off shift added/.test(document.getElementById('ooMsg').textContent));
  ok('admin adds a one-off shift');

  // ---------- Invitation email → separate browser session 2 ----------
  const invite = await mailLink(STAFF, /Set up your CSS Staff Portal account/);
  assert(invite.href.startsWith(`${APP}/set-password.html?token_hash=`), invite.href);
  // Simulate a mail link scanner fetching the URL first.
  await fetch(invite.href);
  const staffCtx = await browser.newContext();
  const sp1 = await staffCtx.newPage(); watch(sp1, 'staff-invite');
  await sp1.goto(invite.href);
  assert(!(sp1.url().includes('token_hash')), 'token not stripped from URL bar');
  await sp1.fill('#newPw', 'tooshort'); await sp1.fill('#confirmPw', 'tooshort');
  await sp1.click('#pwBtn');
  await sp1.waitForFunction(() => /requirements/.test(document.getElementById('pwErr').textContent));
  await sp1.fill('#newPw', STAFF_PW); await sp1.fill('#confirmPw', STAFF_PW);
  await sp1.click('#pwBtn');
  await sp1.waitForSelector('#pwDone', { state: 'visible' });
  ok('staff opens invite (after a scanner fetched it), weak password refused, password set');
  await staffCtx.close();

  // Reusing the invite link fails.
  const reuseCtx = await browser.newContext();
  const rp = await reuseCtx.newPage(); watch(rp, 'reuse');
  await rp.goto(invite.href);
  await rp.fill('#newPw', 'AnotherPassw0rd'); await rp.fill('#confirmPw', 'AnotherPassw0rd');
  await rp.click('#pwBtn');
  await rp.waitForSelector('#pwInvalid', { state: 'visible' });
  ok('invite link cannot be reused');
  await reuseCtx.close();

  // ---------- Browser session 3: staff on "another device" ----------
  const devCtx = await browser.newContext();
  const dp = await devCtx.newPage(); watch(dp, 'staff');
  await dp.goto(`${APP}/`);
  await dp.fill('#email', STAFF); await dp.fill('#password', STAFF_PW);
  await dp.click('#signInBtn');
  await dp.waitForURL('**/staff.html');
  await dp.waitForSelector('#dashRota >> text=08:30–16:30');
  await dp.click('.nav-item[data-section="rota"]');
  await dp.waitForSelector('#rotaDays >> text=UI clinic');
  await dp.waitForSelector('#rotaDays >> text=UI overtime');
  const lunch = await dp.textContent('#rotaDays');
  assert(lunch.includes('Lunch: 45 min'), 'lunch missing');
  const who = await dp.textContent('#whoBox');
  assert(who.includes('Pharmacy Technician') && who.includes('Test Site B'), who);
  ok('staff signs in on a separate session and sees both assigned shifts on their rota');

  // Staff pages cannot open the admin portal.
  await dp.goto(`${APP}/admin.html`);
  await dp.waitForURL('**/staff.html');
  ok('staff visiting admin.html is redirected back to staff.html');
  const apiStatus = await dp.evaluate(async () => (await Portal.api('/api/staff').catch((e) => e)).status);
  assert(apiStatus === 403, `staff /api/staff gave ${apiStatus}`);
  ok('staff browser session gets 403 from admin API');

  // Sign out
  await dp.click('.nav-item[data-action="logout"]');
  await dp.waitForURL(/index\.html|\/$/);
  ok('staff signs out');

  // ---------- Password reset through the UI ----------
  const before = new Set((await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${STAFF}"`)}`).then((x) => x.json())).messages.map((m) => m.ID));
  await dp.click('#tabReset');
  await dp.fill('#resetEmail', STAFF);
  await dp.click('#resetBtn');
  await dp.waitForFunction(() => /reset link is on its way/.test(document.getElementById('resetMsg').textContent));
  const reset = await mailLink(STAFF, /Reset your CSS Staff Portal password/, before);
  await dp.goto(reset.href);
  await dp.waitForFunction(() => document.getElementById('pwTitle').textContent.includes('new password'));
  await dp.fill('#newPw', STAFF_PW2); await dp.fill('#confirmPw', STAFF_PW2);
  await dp.click('#pwBtn');
  await dp.waitForSelector('#pwDone', { state: 'visible' });
  await dp.click('#pwDone a');
  await dp.fill('#email', STAFF); await dp.fill('#password', STAFF_PW);
  await dp.click('#signInBtn');
  await dp.waitForFunction(() => /not recognised/.test(document.getElementById('signInErr').textContent));
  await dp.fill('#password', STAFF_PW2);
  await dp.click('#signInBtn');
  await dp.waitForURL('**/staff.html');
  ok('password reset via UI: old password refused, new password works');

  // Admin sees invitation accepted
  await ap.click('.nav-item[data-section="staff-mgmt"]');
  await ap.reload();
  await ap.click('.nav-item[data-section="staff-mgmt"]');
  await ap.waitForSelector('#staffAccountList >> text=Active');
  ok('admin sees the account as Active after the invite is accepted');

  await ap.screenshot({ path: path.join(os.tmpdir(), 'css-admin-accounts.png'), fullPage: false });
  await dp.click('.nav-item[data-section="rota"]');
  await dp.waitForSelector('#rotaDays >> text=UI clinic');
  await dp.screenshot({ path: path.join(os.tmpdir(), 'css-staff-rota.png'), fullPage: false });
} finally {
  await browser.close();
  for (const id of users) await svc.auth.admin.deleteUser(id).catch(() => {});
  const real = errors.filter((e) => !/Failed to load resource.*(400|401|403)/.test(e));
  console.log(`\n${results.length} UI checks passed. Console/page errors: ${real.length ? '\n' + real.join('\n') : 'none'}`);
  if (real.length) process.exitCode = 1;
}
