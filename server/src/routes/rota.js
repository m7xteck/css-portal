import { Router } from 'express';
import { requireAdmin, HttpError } from '../auth.js';
import * as v from '../validation.js';
import { audit, asyncHandler } from '../util.js';

const PATTERN_COLS =
  'id, staff_id, weekday, site_id, start_time, end_time, lunch_mins, note, start_date, end_date, ' +
  'staff:profiles!rota_patterns_staff_id_fkey(full_name), site:sites(name, site_key)';
const ONE_OFF_COLS =
  'id, staff_id, shift_date, site_id, start_time, end_time, lunch_mins, note, ' +
  'staff:profiles!one_off_shifts_staff_id_fkey(full_name), site:sites(name, site_key)';

const hhmm = (t) => (t || '').slice(0, 5);

function presentPattern(p) {
  return {
    id: p.id,
    staffId: p.staff_id,
    staff: p.staff?.full_name || '',
    weekday: p.weekday,
    siteId: p.site_id,
    site: p.site?.name || '',
    siteKey: p.site?.site_key || '',
    startTime: hhmm(p.start_time),
    endTime: hhmm(p.end_time),
    shift: `${hhmm(p.start_time)}–${hhmm(p.end_time)}`,
    lunchMins: p.lunch_mins,
    note: p.note,
    startDate: p.start_date,
    endDate: p.end_date,
  };
}

function presentOneOff(s) {
  return {
    id: s.id,
    staffId: s.staff_id,
    staff: s.staff?.full_name || '',
    date: s.shift_date,
    siteId: s.site_id,
    site: s.site?.name || '',
    siteKey: s.site?.site_key || '',
    startTime: hhmm(s.start_time),
    endTime: hhmm(s.end_time),
    shift: `${hhmm(s.start_time)}–${hhmm(s.end_time)}`,
    lunchMins: s.lunch_mins,
    note: s.note,
  };
}

export function rotaRouter(_config, service) {
  const r = Router();

  // Shifts overlapping a date range. Staff always get only their own
  // shifts (enforced here AND by RLS); admins may see all or filter.
  r.get('/', asyncHandler(async (req, res) => {
    const { from, to } = v.dateRange(req.query);
    let staffId = null;
    if (req.profile.role === 'admin') {
      if (req.query.staffId) staffId = v.uuid(req.query.staffId, 'staff member');
    } else {
      staffId = req.profile.id;
    }

    let pq = req.db.from('rota_patterns').select(PATTERN_COLS)
      .lte('start_date', to)
      .or(`end_date.is.null,end_date.gte.${from}`)
      .order('weekday').order('start_time');
    let oq = req.db.from('one_off_shifts').select(ONE_OFF_COLS)
      .gte('shift_date', from).lte('shift_date', to)
      .order('shift_date').order('start_time');
    if (staffId) { pq = pq.eq('staff_id', staffId); oq = oq.eq('staff_id', staffId); }

    const [patterns, oneOffs] = await Promise.all([pq, oq]);
    if (patterns.error) throw patterns.error;
    if (oneOffs.error) throw oneOffs.error;
    res.json({ patterns: patterns.data.map(presentPattern), oneOffs: oneOffs.data.map(presentOneOff) });
  }));

  // ---- Admin-only rota editing (also enforced by RLS policies) ----
  r.get('/patterns', requireAdmin, asyncHandler(async (req, res) => {
    const staffId = v.uuid(req.query.staffId, 'staff member');
    const { data, error } = await req.db.from('rota_patterns').select(PATTERN_COLS)
      .eq('staff_id', staffId).order('weekday').order('start_time');
    if (error) throw error;
    res.json(data.map(presentPattern));
  }));

  r.post('/patterns', requireAdmin, asyncHandler(async (req, res) => {
    const row = { ...v.rotaPattern(req.body), created_by: req.profile.id };
    const { data, error } = await req.db.from('rota_patterns').insert(row).select(PATTERN_COLS).single();
    if (error) throw error;
    await audit(service, req.profile.id, 'create', 'rota_patterns', data.id, row);
    res.status(201).json(presentPattern(data));
  }));

  r.put('/patterns/:id', requireAdmin, asyncHandler(async (req, res) => {
    const id = v.positiveInt(req.params.id, 'shift');
    const row = v.rotaPattern(req.body);
    const { data, error } = await req.db.from('rota_patterns').update(row).eq('id', id).select(PATTERN_COLS).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Shift not found.');
    await audit(service, req.profile.id, 'update', 'rota_patterns', id, row);
    res.json(presentPattern(data));
  }));

  r.delete('/patterns/:id', requireAdmin, asyncHandler(async (req, res) => {
    const id = v.positiveInt(req.params.id, 'shift');
    const { data, error } = await req.db.from('rota_patterns').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Shift not found.');
    await audit(service, req.profile.id, 'delete', 'rota_patterns', id, null);
    res.status(204).end();
  }));

  r.get('/one-off', requireAdmin, asyncHandler(async (req, res) => {
    const from = v.date(req.query.from, 'from', { required: false });
    let q = req.db.from('one_off_shifts').select(ONE_OFF_COLS).order('shift_date').order('start_time');
    if (from) q = q.gte('shift_date', from);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data.map(presentOneOff));
  }));

  r.post('/one-off', requireAdmin, asyncHandler(async (req, res) => {
    const row = { ...v.oneOffShift(req.body), created_by: req.profile.id };
    const { data, error } = await req.db.from('one_off_shifts').insert(row).select(ONE_OFF_COLS).single();
    if (error) throw error;
    await audit(service, req.profile.id, 'create', 'one_off_shifts', data.id, row);
    res.status(201).json(presentOneOff(data));
  }));

  r.delete('/one-off/:id', requireAdmin, asyncHandler(async (req, res) => {
    const id = v.positiveInt(req.params.id, 'shift');
    const { data, error } = await req.db.from('one_off_shifts').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Shift not found.');
    await audit(service, req.profile.id, 'delete', 'one_off_shifts', id, null);
    res.status(204).end();
  }));

  return r;
}
