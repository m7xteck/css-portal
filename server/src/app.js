import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServiceClient } from './supabase.js';
import { requireUser, HttpError } from './auth.js';
import { staffRouter } from './routes/staff.js';
import { rotaRouter } from './routes/rota.js';
import { asyncHandler } from './util.js';
import { ValidationError } from './validation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(here, '../../public');
const require = createRequire(import.meta.url);
const SUPABASE_UMD = path.join(path.dirname(require.resolve('@supabase/supabase-js/package.json')), 'dist/umd/supabase.js');

// PostgREST / Postgres error codes -> HTTP status and a safe message.
function mapDbError(err) {
  switch (err.code) {
    case '42501': return [403, 'You do not have permission to do this.'];
    case '23514': return [400, err.message?.includes('assigned to active staff') ? 'Shifts can only be assigned to active staff accounts.' : 'Some of the details are not valid.'];
    case '23503': return [400, 'The selected staff member or site does not exist.'];
    case '23505': return [409, 'That record already exists.'];
    case '22P02': case '22007': case '22008': return [400, 'Some of the details are not valid.'];
    case 'PGRST116': return [404, 'Not found.'];
    default: return null;
  }
}

export function createApp(config, { service = createServiceClient(config) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'", config.supabaseUrl],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': config.nodeEnv === 'production' ? [] : null,
      },
    },
    strictTransportSecurity: config.nodeEnv === 'production',
    referrerPolicy: { policy: 'no-referrer' }, // keeps one-time link tokens out of Referer headers
  }));

  // ---- Public, non-secret browser configuration ----
  app.get('/config.js', (_req, res) => {
    res.type('application/javascript').set('Cache-Control', 'no-store').send(
      `window.CSS_PORTAL_CONFIG = ${JSON.stringify({
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey, // public "anon"/publishable key — safe in the browser
        allowedEmailDomain: config.allowedEmailDomain,
      })};`,
    );
  });
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.get('/vendor/supabase.js', (_req, res) => res.sendFile(SUPABASE_UMD, { maxAge: '1d' }));

  // ---- API ----
  const api = express.Router();
  api.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));
  api.use(express.json({ limit: '20kb' }));
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  api.get('/health', (_req, res) => res.json({ ok: true }));

  api.use(requireUser(config, service));

  api.get('/me', (req, res) => {
    const p = req.profile;
    res.json({ id: p.id, email: p.email, fullName: p.full_name, role: p.role, jobTitle: p.job_title, siteId: p.site_id, siteName: p.site?.name || null });
  });

  api.get('/sites', asyncHandler(async (req, res) => {
    const { data, error } = await req.db.from('sites').select('id, name, site_key').eq('active', true).order('name');
    if (error) throw error;
    res.json(data.map((s) => ({ id: s.id, name: s.name, siteKey: s.site_key })));
  }));

  api.use('/staff',
    rateLimit({ windowMs: 60 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }),
    staffRouter(config, service));
  api.use('/rota', rotaRouter(config, service));

  api.use((_req, _res, next) => next(new HttpError(404, 'Not found.')));
  app.use('/api', api);

  // ---- Static front-end ----
  app.use(express.static(PUBLIC_DIR, {
    index: 'index.html',
    setHeaders: (res, file) => {
      if (file.endsWith('.html')) res.set('Cache-Control', 'no-store');
    },
  }));

  // ---- Errors ----
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    let status = err.status || 500;
    let message = err.message;
    if (!(err instanceof HttpError) && !(err instanceof ValidationError)) {
      if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON.'; }
      else if (err.type === 'entity.too.large') { status = 413; message = 'Request too large.'; }
      else {
        const mapped = err.code ? mapDbError(err) : null;
        if (mapped) [status, message] = mapped;
        else { status = 500; message = 'Something went wrong. Please try again.'; }
      }
    }
    if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
    if (req.originalUrl.startsWith('/api')) return res.status(status).json({ error: message });
    res.status(status).type('text').send(message);
  });

  return app;
}
