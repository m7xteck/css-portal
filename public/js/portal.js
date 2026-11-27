/* CSS Portal — shared browser helpers (release 1).
   The browser only ever holds the public Supabase anon key. All data goes
   through the CSS server API, which checks the user's role and forwards
   their token so the database's row level security applies too. */
(function () {
  const cfg = window.CSS_PORTAL_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  async function accessToken() {
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.access_token : null;
  }

  async function api(path, { method = 'GET', body } = {}) {
    const token = await accessToken();
    const res = await fetch(path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      await sb.auth.signOut({ scope: 'local' });
      window.location.replace('index.html?expired=1');
      throw new Error(data.error || 'Please sign in.');
    }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Redirects to sign-in unless the user is signed in with the given role.
  async function requireRole(role) {
    const token = await accessToken();
    // After a redirect, return a promise that never settles so page code stops quietly.
    const halt = () => new Promise(() => {});
    if (!token) { window.location.replace('index.html'); return halt(); }
    let me;
    try { me = await api('/api/me'); } catch (e) {
      await sb.auth.signOut({ scope: 'local' });
      window.location.replace('index.html?inactive=1');
      return halt();
    }
    if (me.role !== role) {
      window.location.replace(me.role === 'admin' ? 'admin.html' : 'staff.html');
      return halt();
    }
    return me;
  }

  async function signOut() {
    await sb.auth.signOut();
    window.location.replace('index.html');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
  }

  // ---- Dates (local time, Mon–Fri weeks) ----
  function toLocalIso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toLocalIso(d);
  }
  function weekStartIso(iso) {
    const d = new Date(iso + 'T00:00:00');
    const dow = d.getDay() || 7; // Mon=1..Sun=7
    d.setDate(d.getDate() - (dow - 1));
    return toLocalIso(d);
  }
  function dayLabel(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const todayIso = () => toLocalIso(new Date());

  function shiftMins(r) {
    const toM = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return Math.max(0, toM(r.endTime) - toM(r.startTime) - (r.lunchMins || 0));
  }
  function formatHours(mins) {
    if (!mins) return '0h';
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  // Expands recurring patterns + one-off shifts into dated entries for the
  // Mon–Fri week starting weekStart (same idea as the prototype's cssRotaForWeek).
  function rotaForWeek(weekStart, patterns, oneOffs) {
    const out = [];
    const weekEnd = addDays(weekStart, 6);
    (patterns || []).forEach((p) => {
      const iso = addDays(weekStart, p.weekday - 1);
      if (iso < p.startDate) return;
      if (p.endDate && iso > p.endDate) return;
      out.push({ ...p, key: `p-${p.id}-${iso}`, date: iso, isOneOff: false });
    });
    (oneOffs || []).forEach((s) => {
      if (s.date < weekStart || s.date > weekEnd) return;
      out.push({ ...s, key: `o-${s.id}`, isOneOff: true });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }

  // Unfinished modules are shown greyed out with a "Soon" label.
  function initNav(onSelect) {
    document.querySelectorAll('.nav-item[data-soon]').forEach((btn) => {
      btn.classList.add('is-disabled');
      btn.setAttribute('aria-disabled', 'true');
      btn.title = 'Not available in this release';
      btn.insertAdjacentHTML('beforeend', '<span class="soon-pill">Soon</span>');
    });
    document.querySelector('.sidebar').addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-item');
      if (!btn || btn.dataset.soon !== undefined) return;
      if (btn.dataset.action === 'logout') return signOut();
      if (btn.dataset.section) showSection(btn.dataset.section, onSelect);
    });
  }
  function showSection(name, onSelect) {
    document.querySelectorAll('.section').forEach((s) => s.classList.toggle('active', s.id === 'sec-' + name));
    document.querySelectorAll('.nav-item[data-section]').forEach((b) => b.classList.toggle('active', b.dataset.section === name));
    if (onSelect) onSelect(name);
  }

  window.Portal = {
    sb, api, requireRole, signOut, esc, setMsg, initNav, showSection,
    toLocalIso, addDays, weekStartIso, dayLabel, formatDate, todayIso, shiftMins, formatHours, rotaForWeek,
    emailDomain: cfg.allowedEmailDomain,
  };
})();
