import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../src/validation.js';
import { loadConfig } from '../src/config.js';

test('nhsEmail accepts @nhs.net and normalises case', () => {
  assert.equal(v.nhsEmail('  Priya.Patel@NHS.net '), 'priya.patel@nhs.net');
  assert.equal(v.nhsEmail("o'brien.j@nhs.net"), "o'brien.j@nhs.net");
});

test('nhsEmail rejects other domains and look-alikes', () => {
  for (const bad of ['a@gmail.com', 'a@nhs.uk', 'a@nhs.net.evil.com', 'a@evilnhs.net', 'a@sub.nhs.net', '@nhs.net', 'a b@nhs.net', '']) {
    assert.throws(() => v.nhsEmail(bad), v.ValidationError, bad);
  }
});

test('shiftTimes validates order and lunch', () => {
  assert.deepEqual(v.shiftTimes({ startTime: '09:00', endTime: '17:00', lunchMins: 30 }), { start_time: '09:00', end_time: '17:00', lunch_mins: 30 });
  assert.throws(() => v.shiftTimes({ startTime: '17:00', endTime: '09:00' }), /after/);
  assert.throws(() => v.shiftTimes({ startTime: '09:00', endTime: '10:00', lunchMins: 60 }), /shorter/);
  assert.throws(() => v.shiftTimes({ startTime: '9am', endTime: '17:00' }), /HH:MM/);
  assert.throws(() => v.shiftTimes({ startTime: '09:00', endTime: '17:00', lunchMins: -5 }), /Lunch/);
});

test('rotaPattern validates weekday, dates and ids', () => {
  const ok = {
    staffId: '11111111-2222-3333-4444-555555555555', weekday: 3, siteId: 1,
    startTime: '08:30', endTime: '16:30', lunchMins: 30, startDate: '2026-12-01', endDate: null, note: ' Clinic A ',
  };
  const row = v.rotaPattern(ok);
  assert.equal(row.weekday, 3);
  assert.equal(row.note, 'Clinic A');
  assert.throws(() => v.rotaPattern({ ...ok, weekday: 6 }), /Monday to Friday/);
  assert.throws(() => v.rotaPattern({ ...ok, staffId: 'not-a-uuid' }), /staff member/);
  assert.throws(() => v.rotaPattern({ ...ok, startDate: '2026-02-30' }), /valid date/);
  assert.throws(() => v.rotaPattern({ ...ok, endDate: '2026-11-01' }), /on or after/);
  assert.throws(() => v.rotaPattern({ ...ok, note: 'x'.repeat(201) }), /200/);
});

test('dateRange rejects reversed and huge ranges', () => {
  assert.deepEqual(v.dateRange({ from: '2026-01-05', to: '2026-01-11' }), { from: '2026-01-05', to: '2026-01-11' });
  assert.throws(() => v.dateRange({ from: '2026-01-11', to: '2026-01-05' }));
  assert.throws(() => v.dateRange({ from: '2020-01-01', to: '2026-01-01' }), /too long/);
});

test('loadConfig requires secrets and https in production', () => {
  const base = { APP_URL: 'https://portal.example.co.uk/', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' };
  assert.equal(loadConfig(base).appUrl, 'https://portal.example.co.uk');
  assert.throws(() => loadConfig({ ...base, SUPABASE_SERVICE_ROLE_KEY: '' }), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(() => loadConfig({ ...base, SUPABASE_ANON_KEY: 'REPLACE_ME' }), /SUPABASE_ANON_KEY/);
  assert.throws(() => loadConfig({ ...base, NODE_ENV: 'production', APP_URL: 'http://portal.example.co.uk' }), /https/);
});
