// Creates (or promotes) a CSS portal admin and emails them an invitation
// link to set their password. Run on the server, never in the browser:
//
//   npm run create-admin -- --email someone@nhs.net --name "Full Name"
//
// Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and APP_URL in ../.env
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config.js';
import { createServiceClient } from '../src/supabase.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' } },
});
const email = (values.email || '').trim().toLowerCase();
const fullName = (values.name || '').trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !fullName) {
  console.error('Usage: npm run create-admin -- --email someone@nhs.net --name "Full Name"');
  process.exit(1);
}

const config = loadConfig();
const service = createServiceClient(config);

const { data: existing, error: exErr } = await service.from('profiles').select('id, role').eq('email', email).maybeSingle();
if (exErr) throw exErr;

if (existing) {
  const { error } = await service.from('profiles').update({ role: 'admin', active: true, full_name: fullName }).eq('id', existing.id);
  if (error) throw error;
  await service.auth.admin.updateUserById(existing.id, { ban_duration: 'none' });
  await service.from('audit_log').insert({ action: 'promote_admin', resource: 'profiles', resource_id: existing.id, details: { email, via: 'create-admin script' } });
  console.log(`✔ ${email} already had an account and is now an admin.`);
  process.exit(0);
}

const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${config.appUrl}/set-password.html`,
  data: { full_name: fullName },
});
if (error) {
  console.error(`✘ Could not invite ${email}: ${error.message}`);
  process.exit(1);
}
const { error: pErr } = await service.from('profiles').insert({
  id: data.user.id, email, full_name: fullName, role: 'admin', invited_at: new Date().toISOString(),
});
if (pErr) {
  await service.auth.admin.deleteUser(data.user.id).catch(() => {});
  console.error(`✘ Could not create the admin profile: ${pErr.message}`);
  process.exit(1);
}
await service.from('audit_log').insert({ action: 'create_admin', resource: 'profiles', resource_id: data.user.id, details: { email, via: 'create-admin script' } });
console.log(`✔ Invitation sent to ${email}. They must open the email link to set a password, then sign in at ${config.appUrl}`);
