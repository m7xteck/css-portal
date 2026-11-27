import { createClient } from '@supabase/supabase-js';

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// Service-role client: bypasses RLS. Used ONLY for privileged operations
// (inviting users, creating profiles, banning accounts, writing the audit
// log) after the caller has been verified as an active admin.
export function createServiceClient(config) {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: noSession });
}

// Per-request client acting as the signed-in user, so every read and
// rota write is also checked by the database's row level security.
export function createUserClient(config, accessToken) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
