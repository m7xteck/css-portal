// Pure input validation helpers (unit tested in test/unit.test.js).

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function text(value, field, { required = true, max = 200 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text.`);
  const v = value.trim();
  if (v.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer.`);
  return v;
}

export function nhsEmail(value, domain = 'nhs.net') {
  const v = text(value, 'Email address', { max: 254 }).toLowerCase();
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^[a-z0-9._%+'-]+@${escaped}$`);
  if (!re.test(v)) throw new ValidationError(`Enter the staff member's @${domain} email address.`);
  return v;
}

export function uuid(value, field = 'id') {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new ValidationError(`Invalid ${field}.`);
  return value.toLowerCase();
}

export function positiveInt(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`Invalid ${field}.`);
  return n;
}

export function time(value, field) {
  if (typeof value !== 'string' || !TIME_RE.test(value)) throw new ValidationError(`${field} must be a time (HH:MM).`);
  return value;
}

export function date(value, field, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }
  if (typeof value !== 'string' || !DATE_RE.test(value)) throw new ValidationError(`${field} must be a date (YYYY-MM-DD).`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${field} is not a valid date.`);
  }
  return value;
}

export function boolean(value, field) {
  if (typeof value !== 'boolean') throw new ValidationError(`${field} must be true or false.`);
  return value;
}

function minutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Shared shift fields for recurring and one-off shifts.
export function shiftTimes(body) {
  const startTime = time(body.startTime, 'Shift start');
  const endTime = time(body.endTime, 'Shift end');
  if (minutes(endTime) <= minutes(startTime)) throw new ValidationError('Shift end must be after shift start.');
  const lunch = body.lunchMins === undefined || body.lunchMins === '' ? 0 : Number(body.lunchMins);
  if (!Number.isInteger(lunch) || lunch < 0 || lunch > 240) throw new ValidationError('Lunch must be between 0 and 240 minutes.');
  if (lunch >= minutes(endTime) - minutes(startTime)) throw new ValidationError('Lunch must be shorter than the shift.');
  return { start_time: startTime, end_time: endTime, lunch_mins: lunch };
}

export function rotaPattern(body) {
  const weekday = Number(body.weekday);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) throw new ValidationError('Day must be Monday to Friday.');
  const startDate = date(body.startDate, 'Pattern start date');
  const endDate = date(body.endDate, 'Pattern end date', { required: false });
  if (endDate && endDate < startDate) throw new ValidationError('Pattern end date must be on or after the start date.');
  return {
    staff_id: uuid(body.staffId, 'staff member'),
    weekday,
    site_id: positiveInt(body.siteId, 'site'),
    ...shiftTimes(body),
    note: text(body.note, 'Note', { required: false, max: 200 }),
    start_date: startDate,
    end_date: endDate,
  };
}

export function oneOffShift(body) {
  return {
    staff_id: uuid(body.staffId, 'staff member'),
    shift_date: date(body.date, 'Date'),
    site_id: positiveInt(body.siteId, 'site'),
    ...shiftTimes(body),
    note: text(body.note, 'Note', { required: false, max: 200 }),
  };
}

export function dateRange(query) {
  const from = date(query.from, 'from');
  const to = date(query.to, 'to');
  if (to < from) throw new ValidationError('"to" must be on or after "from".');
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (days > 400) throw new ValidationError('Date range is too long (maximum 400 days).');
  return { from, to };
}
