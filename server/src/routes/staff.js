import { Router } from 'express';
import { requireAdmin, HttpError } from '../auth.js';
import * as v from '../validation.js';
import { audit, asyncHandler } from '../util.js';

const BAN_FOREVER = '876000h'; // ~100 years

async function authUsersById(service) {
  const map = new Map();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => map.set(u.id, u));
    if (data.users.length < 1000) break;
  }
  return map;
}

function presentProfile(p, authUser) {
  return {
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    jobTitle: p.job_title,
    siteId: p.site_id,
    siteName: p.sites?.name || null,
    active: p.active,
    invitedAt: p.invited_at,
    // Invitation is accepted once the user has verified the emailed link.
    invitationAccepted: !!authUser?.email_confirmed_at,
    lastSignInAt: authUser?.last_sign_in_at || null,
  };
}

export function staffRouter(config, service) {
  const r = Router();
  r.use(requireAdmin);

  // List every account (admins only).
  r.get('/', asyncHandler(async (req, res) => {
    const { data, error } = await req.db
      .from('profiles')
      .select('id, email, full_name, role, job_title, site_id, active, invited_at, sites(name)')
      .order('full_name');
    if (error) throw error;
    const users = await authUsersById(service);
    res.json(data.map((p) => presentProfile(p, users.get(p.id))));
  }));

  // Add a staff member and email them a one-time invitation link.
  r.post('/', asyncHandler(async (req, res) => {
    const email = v.nhsEmail(req.body.email, config.allowedEmailDomain);
    const fullName = v.text(req.body.fullName, 'Full name', { max: 120 });
    const jobTitle = v.text(req.body.jobTitle, 'Role', { required: false, max: 80 });
    const siteId = v.positiveInt(req.body.siteId, 'site', { required: false });

    const { data: existing, error: exErr } = await service.from('profiles').select('id').eq('email', email).maybeSingle();
    if (exErr) throw exErr;
    if (existing) throw new HttpError(409, 'An account with this email address already exists.');

    if (siteId) {
      const { data: site } = await service.from('sites').select('id').eq('id', siteId).eq('active', true).maybeSingle();
      if (!site) throw new v.ValidationError('Choose a valid site.');
    }

    const { data: invited, error: invErr } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${config.appUrl}/set-password.html`,
      data: { full_name: fullName },
    });
    if (invErr) {
      if (/already been registered|already exists/i.test(invErr.message)) {
        throw new HttpError(409, 'An account with this email address already exists.');
      }
      throw new HttpError(502, `The invitation email could not be sent: ${invErr.message}`);
    }

    const userId = invited.user.id;
    const { data: profile, error: pErr } = await service
      .from('profiles')
      .insert({
        id: userId,
        email,
        full_name: fullName,
        role: 'staff',
        job_title: jobTitle,
        site_id: siteId,
        invited_by: req.profile.id,
        invited_at: new Date().toISOString(),
      })
      .select('id, email, full_name, role, job_title, site_id, active, invited_at, sites(name)')
      .single();
    if (pErr) {
      // Roll back the auth user so the admin can retry cleanly.
      await service.auth.admin.deleteUser(userId).catch(() => {});
      throw pErr;
    }

    await audit(service, req.profile.id, 'invite', 'profiles', userId, { email });
    res.status(201).json(presentProfile(profile, invited.user));
  }));

  // Resend an invitation that has not been accepted yet.
  r.post('/:id/resend-invite', asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'staff member');
    const { data: profile } = await req.db.from('profiles').select('id, email, full_name, active').eq('id', id).maybeSingle();
    if (!profile) throw new HttpError(404, 'Account not found.');
    if (!profile.active) throw new HttpError(409, 'Reactivate this account before resending the invitation.');

    const { data: authData, error: uErr } = await service.auth.admin.getUserById(id);
    if (uErr) throw uErr;
    if (authData.user.email_confirmed_at) {
      throw new HttpError(409, 'This person has already set up their account. They can use "Forgotten your password?" on the sign-in page.');
    }
    const { error } = await service.auth.admin.inviteUserByEmail(profile.email, {
      redirectTo: `${config.appUrl}/set-password.html`,
      data: { full_name: profile.full_name },
    });
    if (error) throw new HttpError(502, `The invitation email could not be sent: ${error.message}`);
    await service.from('profiles').update({ invited_at: new Date().toISOString() }).eq('id', id);
    await audit(service, req.profile.id, 'resend_invite', 'profiles', id, { email: profile.email });
    res.json({ ok: true });
  }));

  // Edit name / role / site, or deactivate / reactivate an account.
  r.patch('/:id', asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'staff member');
    const patch = {};
    if ('fullName' in req.body) patch.full_name = v.text(req.body.fullName, 'Full name', { max: 120 });
    if ('jobTitle' in req.body) patch.job_title = v.text(req.body.jobTitle, 'Role', { required: false, max: 80 });
    if ('siteId' in req.body) patch.site_id = v.positiveInt(req.body.siteId, 'site', { required: false });
    if ('active' in req.body) patch.active = v.boolean(req.body.active, 'active');
    if (!Object.keys(patch).length) throw new v.ValidationError('Nothing to update.');
    if (patch.active === false && id === req.profile.id) throw new HttpError(409, 'You cannot deactivate your own account.');

    // Written through the admin's own client, so RLS also has to allow it.
    const { data, error } = await req.db
      .from('profiles')
      .update(patch)
      .eq('id', id)
      .select('id, email, full_name, role, job_title, site_id, active, invited_at, sites(name)')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Account not found.');

    if ('active' in patch) {
      // Block sign-in and token refresh for deactivated accounts.
      const { error: banErr } = await service.auth.admin.updateUserById(id, {
        ban_duration: patch.active ? 'none' : BAN_FOREVER,
      });
      if (banErr) throw banErr;
    }
    await audit(service, req.profile.id, 'update', 'profiles', id, patch);
    const { data: authData } = await service.auth.admin.getUserById(id);
    res.json(presentProfile(data, authData?.user));
  }));

  return r;
}
