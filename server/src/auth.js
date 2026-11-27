import { createUserClient } from './supabase.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Verifies the Supabase access token with Supabase Auth (not just locally),
// then loads the caller's profile through RLS. Inactive or profile-less
// accounts are refused.
export function requireUser(config, service) {
  return async (req, _res, next) => {
    try {
      const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(req.get('authorization') || '');
      if (!match) throw new HttpError(401, 'Please sign in.');
      const token = match[1];

      const { data, error } = await service.auth.getUser(token);
      if (error || !data?.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');

      const db = createUserClient(config, token);
      const { data: profile, error: pErr } = await db
        .from('profiles')
        .select('id, email, full_name, role, job_title, site_id, active, site:sites(name)')
        .eq('id', data.user.id)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile || !profile.active) throw new HttpError(403, 'Your account is not active. Please contact the CSS office.');

      req.user = data.user;
      req.profile = profile;
      req.db = db;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAdmin(req, _res, next) {
  if (req.profile?.role !== 'admin') return next(new HttpError(403, 'Only admins can do this.'));
  next();
}
