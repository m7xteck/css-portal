// Loads and validates environment configuration. Fails fast on boot if a
// required value is missing so a misconfigured deploy never serves traffic.

const REQUIRED = ['APP_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k] || env[k].includes('REPLACE_ME'));
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  const appUrl = env.APP_URL.replace(/\/+$/, '');
  if (env.NODE_ENV === 'production' && !appUrl.startsWith('https://')) {
    throw new Error('APP_URL must use https:// in production');
  }
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 3000),
    host: env.HOST || '127.0.0.1',
    appUrl,
    supabaseUrl: env.SUPABASE_URL.replace(/\/+$/, ''),
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    allowedEmailDomain: (env.ALLOWED_EMAIL_DOMAIN || 'nhs.net').toLowerCase(),
    trustProxy: Number(env.TRUST_PROXY || 0),
  };
}
