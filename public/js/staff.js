/* CSS Staff Portal — release 1: dashboard and own rota (read only).
   The server and the database both restrict results to the signed-in
   person's own shifts. */
(async function () {
  const P = window.Portal;
  const { api, esc } = P;
  const $ = (id) => document.getElementById(id);

  const me = await P.requireRole('staff');
  $('app').style.visibility = 'visible';

  const today = P.todayIso();
  const thisWeek = P.weekStartIso(today);
  let currentWeek = thisWeek;
  const siteName = me.siteName || '';

  async function fetchShifts(from, to) {
    const data = await api(`/api/rota?from=${from}&to=${to}`);
    return data;
  }

  async function renderDashboard() {
    // Next 4 weeks of shifts.
    const to = P.addDays(thisWeek, 27);
    const data = await fetchShifts(thisWeek, to);
    const all = [];
    for (let i = 0; i < 4; i++) all.push(...P.rotaForWeek(P.addDays(thisWeek, i * 7), data.patterns, data.oneOffs));
    const weekShifts = all.filter((s) => s.date <= P.addDays(thisWeek, 6));
    $('statShifts').textContent = weekShifts.length;
    $('statHours').textContent = P.formatHours(weekShifts.reduce((sum, s) => sum + P.shiftMins(s), 0));
    const upcoming = all.filter((s) => s.date >= today).slice(0, 8);
    $('dashRota').innerHTML = upcoming.length
      ? upcoming.map((s) => `<li><span class="notif-dot teal"></span><div><strong>${P.dayLabel(s.date)}</strong> — ${esc(s.shift)}${s.isOneOff ? ' <span class="pill amber" style="font-size:0.68rem;">One-off</span>' : ''}<div class="notif-meta">${esc(s.site)}${s.note ? ' · ' + esc(s.note) : ''}${s.lunchMins ? ` · ${s.lunchMins} min lunch` : ''}</div></div></li>`).join('')
      : '<li class="empty-msg">You have no shifts in the next four weeks.</li>';
  }

  async function renderRota() {
    const week = currentWeek;
    $('rotaWeekLabel').textContent = `Week of ${P.dayLabel(week)}${week === thisWeek ? ' (this week)' : ''}`;
    let data;
    try { data = await fetchShifts(week, P.addDays(week, 6)); } catch (e) {
      $('rotaDays').innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
      return;
    }
    if (week !== currentWeek) return;
    const shifts = P.rotaForWeek(week, data.patterns, data.oneOffs);
    $('rotaDays').innerHTML = [0, 1, 2, 3, 4].map((i) => {
      const iso = P.addDays(week, i);
      const ds = shifts.filter((s) => s.date === iso);
      const body = ds.length
        ? `<div class="rota-shifts">${ds.map((s) => `
            <div class="rota-shift site-${esc(s.siteKey)} is-mine${s.isOneOff ? ' is-oneoff' : ''}">
              <div class="rota-shift-time">${esc(s.shift)}${s.isOneOff ? ' <span style="font-size:0.7rem; background:var(--css-amber); color:#fff; padding:1px 5px; border-radius:4px; vertical-align:middle;">One-off</span>' : ''}</div>
              <div class="rota-shift-site">${esc(s.site)}</div>
              <div class="rota-shift-note">${esc(s.note || '')}</div>
              <div class="rota-shift-lunch">${s.lunchMins ? `🍽️ Lunch: ${s.lunchMins} min` : '🍽️ No lunch break set'}</div>
            </div>`).join('')}</div>`
        : '<div class="rota-day-empty">No shifts for you</div>';
      return `<div class="rota-day-card${iso === today ? ' is-today' : ''}"><div class="rota-day-head"><span class="rota-day-name">${P.dayLabel(iso)}</span>${iso === today ? '<span class="pill teal">Today</span>' : ''}</div>${body}</div>`;
    }).join('');
    $('rotaStatShifts').textContent = shifts.length;
    $('rotaStatHours').textContent = P.formatHours(shifts.reduce((sum, s) => sum + P.shiftMins(s), 0));
    $('rotaStatSites').textContent = new Set(shifts.map((s) => s.siteId)).size;
  }

  $('rotaPrev').addEventListener('click', () => { currentWeek = P.addDays(currentWeek, -7); renderRota(); });
  $('rotaNext').addEventListener('click', () => { currentWeek = P.addDays(currentWeek, 7); renderRota(); });
  $('rotaThis').addEventListener('click', () => { currentWeek = thisWeek; renderRota(); });

  P.initNav((name) => { if (name === 'rota') renderRota(); });
  document.querySelectorAll('[data-goto]').forEach((el) => el.addEventListener('click', () => P.showSection(el.dataset.goto, () => renderRota())));

  function renderWho() {
    const sub = [me.jobTitle, siteName].filter(Boolean).map(esc).join(' · ');
    $('whoBox').innerHTML = `<strong>${esc(me.fullName)}</strong>${sub}`;
    $('welcomeLine').textContent = `${me.fullName}${me.jobTitle ? ' — ' + me.jobTitle : ''}. Here are your upcoming shifts.`;
  }
  renderWho();
  try {
    await renderDashboard();
    renderRota();
  } catch (e) {
    $('welcomeLine').textContent = `Could not load your shifts: ${e.message}`;
  }
})();
