/* CSS Admin Portal — release 1: dashboard, rota & lunch, staff accounts. */
(async function () {
  const P = window.Portal;
  const { api, esc, setMsg } = P;
  const $ = (id) => document.getElementById(id);

  const me = await P.requireRole('admin');
  $('app').style.visibility = 'visible';
  $('whoBox').innerHTML = `<strong>${esc(me.fullName)}</strong>Administrator`;
  $('welcomeLine').textContent = `Signed in as ${me.fullName}.`;

  const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const state = {
    accounts: [],
    sites: [],
    rotaStaffId: null,
    patterns: [],
    editingRotaId: null,
    editingStaffId: null,
    calWeek: P.weekStartIso(P.todayIso()),
  };
  const activeStaff = () => state.accounts.filter((a) => a.role === 'staff' && a.active);

  function fail(el, err) { setMsg(el, err.message || 'Something went wrong.', 'error'); }
  function flash(el, text) { setMsg(el, text, 'ok'); setTimeout(() => { if (el.textContent === text) setMsg(el, ''); }, 5000); }

  /* ===================== Loading ===================== */
  async function loadAccounts() {
    state.accounts = await api('/api/staff');
    renderAccounts();
    populateStaffSelects();
  }
  async function loadSites() {
    state.sites = await api('/api/sites');
    const opts = state.sites.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    document.querySelectorAll('.site-select').forEach((sel) => { sel.innerHTML = opts; });
    $('smSite').innerHTML = '<option value="">— Not set —</option>' + opts;
  }

  function populateStaffSelects() {
    const staff = activeStaff();
    const opts = staff.map((s) => `<option value="${s.id}">${esc(s.fullName)}</option>`).join('');
    $('ooStaff').innerHTML = opts;
    const calSel = $('calStaffFilter');
    const keep = calSel.value;
    calSel.innerHTML = '<option value="">All staff</option>' + opts;
    if (staff.some((s) => s.id === keep)) calSel.value = keep;

    const rotaSel = $('rotaStaffSelect');
    rotaSel.innerHTML = opts;
    if (!staff.length) {
      state.rotaStaffId = null;
      $('rotaListTitle').textContent = 'Recurring shifts';
      $('rotaShiftsList').innerHTML = '<p class="empty-msg">No active staff yet — add a staff member under Accounts first.</p>';
      return;
    }
    if (!staff.some((s) => s.id === state.rotaStaffId)) state.rotaStaffId = staff[0].id;
    rotaSel.value = state.rotaStaffId;
    loadPatterns();
  }

  /* ===================== Dashboard ===================== */
  async function renderDashboard() {
    const staff = state.accounts.filter((a) => a.role === 'staff');
    const pending = staff.filter((a) => a.active && !a.invitationAccepted);
    $('statActiveStaff').textContent = staff.filter((a) => a.active).length;
    $('statPendingInvites').textContent = pending.length;
    $('dashAttention').innerHTML = pending.length
      ? pending.map((a) => `<li><span class="notif-dot amber"></span><div><strong>${esc(a.fullName)}</strong> hasn't accepted their invitation yet<div class="notif-meta">Invited ${a.invitedAt ? P.formatDate(a.invitedAt.slice(0, 10)) : ''} · ${esc(a.email)}</div></div></li>`).join('')
      : '<li class="empty-msg">Nothing needs your attention.</li>';

    const week = P.weekStartIso(P.todayIso());
    const data = await api(`/api/rota?from=${week}&to=${P.addDays(week, 6)}`);
    const shifts = P.rotaForWeek(week, data.patterns, data.oneOffs);
    $('statShiftsWeek').textContent = shifts.length;
    const days = [0, 1, 2, 3, 4].map((i) => P.addDays(week, i));
    $('dashRotaWeek').innerHTML = days.map((iso) => {
      const ds = shifts.filter((s) => s.date === iso);
      const who = ds.map((s) => `${esc(s.staff.split(' ')[0])} (${esc(s.site)})`).join(', ');
      return `<li><span class="notif-dot ${ds.length ? 'teal' : ''}"></span><div><strong>${P.dayLabel(iso)}</strong> — ${ds.length} shift${ds.length === 1 ? '' : 's'}<div class="notif-meta">${who || 'No shifts'}</div></div></li>`;
    }).join('');
  }

  /* ===================== Recurring shifts ===================== */
  async function loadPatterns() {
    if (!state.rotaStaffId) return;
    const staffId = state.rotaStaffId;
    const person = state.accounts.find((a) => a.id === staffId);
    const first = person ? person.fullName.split(' ')[0] : '';
    $('rotaListTitle').textContent = `${first}'s recurring shifts`;
    if (!state.editingRotaId) $('rotaFormTitle').textContent = `Add a shift for ${first}`;
    try {
      state.patterns = await api(`/api/rota/patterns?staffId=${encodeURIComponent(staffId)}`);
    } catch (e) {
      $('rotaShiftsList').innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
      return;
    }
    if (staffId !== state.rotaStaffId) return; // selection changed meanwhile
    renderPatterns(first);
  }

  function renderPatterns(first) {
    const today = P.todayIso();
    if (!state.patterns.length) {
      $('rotaShiftsList').innerHTML = `<p style="color:var(--css-muted); font-size:0.9rem; margin:0;">No shifts set up for ${esc(first)} yet — add one using the form.</p>`;
      return;
    }
    $('rotaShiftsList').innerHTML = state.patterns.map((p) => {
      const lunchChip = p.lunchMins
        ? `<span class="pill teal" style="font-size:0.72rem; margin-left:6px;">🍽️ ${p.lunchMins}m lunch</span>`
        : '<span class="pill grey" style="font-size:0.72rem; margin-left:6px;">No lunch</span>';
      const net = P.shiftMins(p);
      const range = `from ${P.formatDate(p.startDate)}${p.endDate ? ` · until ${P.formatDate(p.endDate)}` : ' (ongoing)'}`;
      const ended = p.endDate && p.endDate < today ? ' style="opacity:0.55;"' : '';
      return `
        <div class="rota-admin-row"${ended}>
          <div class="rota-admin-day">${DAY_NAMES[p.weekday]}</div>
          <div class="rota-admin-detail">
            <div class="rota-shift-time">${esc(p.shift)} ${lunchChip}<span class="pill grey" style="font-size:0.72rem; margin-left:4px;">⏱ ${P.formatHours(net)} net</span></div>
            <div class="rota-shift-note" style="margin-top:3px;">${esc(p.site)}${p.note ? ' · ' + esc(p.note) : ''}</div>
            <div class="notif-meta" style="margin-top:2px;">📅 ${range}</div>
          </div>
          <div class="rota-admin-actions">
            <button class="btn small secondary" type="button" data-edit-pattern="${p.id}">Edit</button>
            <button class="btn small secondary" type="button" data-delete-pattern="${p.id}">Remove</button>
          </div>
        </div>`;
    }).join('');
  }

  function resetRotaForm() {
    state.editingRotaId = null;
    $('rotaForm').reset();
    $('rotaStartDate').value = P.todayIso();
    $('rotaSaveBtn').textContent = 'Add shift';
    $('rotaCancelBtn').style.display = 'none';
    const person = state.accounts.find((a) => a.id === state.rotaStaffId);
    $('rotaFormTitle').textContent = `Add a shift for ${person ? person.fullName.split(' ')[0] : ''}`;
  }

  $('rotaStaffSelect').addEventListener('change', (e) => {
    state.rotaStaffId = e.target.value;
    resetRotaForm();
    loadPatterns();
  });
  $('rotaCancelBtn').addEventListener('click', resetRotaForm);

  $('rotaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('rotaMsg');
    if (!state.rotaStaffId) return setMsg(msg, 'Add a staff member first.', 'error');
    const body = {
      staffId: state.rotaStaffId,
      weekday: Number($('rotaWeekday').value),
      siteId: Number($('rotaSite').value),
      startTime: $('rotaFrom').value,
      endTime: $('rotaTo').value,
      lunchMins: Number($('rotaLunch').value || 0),
      startDate: $('rotaStartDate').value || P.todayIso(),
      endDate: $('rotaEndDate').value || null,
      note: $('rotaNote').value.trim() || null,
    };
    const wasEditing = !!state.editingRotaId;
    try {
      if (wasEditing) await api(`/api/rota/patterns/${state.editingRotaId}`, { method: 'PUT', body });
      else await api('/api/rota/patterns', { method: 'POST', body });
    } catch (err) { return fail(msg, err); }
    resetRotaForm();
    flash(msg, wasEditing ? 'Shift updated.' : 'Shift added.');
    await loadPatterns();
    renderCalendar();
    renderDashboard().catch(() => {});
  });

  $('rotaShiftsList').addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit-pattern]')?.dataset.editPattern;
    const delId = e.target.closest('[data-delete-pattern]')?.dataset.deletePattern;
    if (editId) {
      const p = state.patterns.find((x) => String(x.id) === editId);
      if (!p) return;
      state.editingRotaId = p.id;
      $('rotaWeekday').value = p.weekday;
      $('rotaSite').value = p.siteId;
      $('rotaFrom').value = p.startTime;
      $('rotaTo').value = p.endTime;
      $('rotaLunch').value = p.lunchMins || 0;
      $('rotaStartDate').value = p.startDate;
      $('rotaEndDate').value = p.endDate || '';
      $('rotaNote').value = p.note || '';
      $('rotaFormTitle').textContent = `Editing ${DAY_NAMES[p.weekday]} shift`;
      $('rotaSaveBtn').textContent = 'Save changes';
      $('rotaCancelBtn').style.display = 'inline-block';
      $('rotaForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (delId) {
      if (!confirm('Remove this recurring shift? It will no longer appear on any week.')) return;
      try { await api(`/api/rota/patterns/${delId}`, { method: 'DELETE' }); } catch (err) { return fail($('rotaMsg'), err); }
      if (String(state.editingRotaId) === delId) resetRotaForm();
      await loadPatterns();
      renderCalendar();
      renderDashboard().catch(() => {});
    }
  });

  /* ===================== Weekly calendar ===================== */
  async function renderCalendar() {
    const week = state.calWeek;
    const staffId = $('calStaffFilter').value;
    const isThisWeek = week === P.weekStartIso(P.todayIso());
    const filterName = staffId ? (state.accounts.find((a) => a.id === staffId)?.fullName || '').split(' ')[0] : '';
    $('adminRotaWeekLabel').textContent = `Week of ${P.dayLabel(week)}${isThisWeek ? ' (this week)' : ''}${filterName ? ' · ' + filterName : ''}`;
    let data;
    try {
      data = await api(`/api/rota?from=${week}&to=${P.addDays(week, 6)}${staffId ? `&staffId=${encodeURIComponent(staffId)}` : ''}`);
    } catch (e) {
      $('adminWeekCalendar').innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
      return;
    }
    if (week !== state.calWeek) return;
    const shifts = P.rotaForWeek(week, data.patterns, data.oneOffs);
    const today = P.todayIso();
    $('adminWeekCalendar').innerHTML = '<div class="week-grid">' + [0, 1, 2, 3, 4].map((i) => {
      const iso = P.addDays(week, i);
      const ds = shifts.filter((s) => s.date === iso);
      const body = ds.length
        ? ds.map((s) => `<div class="week-shift${s.isOneOff ? ' is-oneoff' : ''}"><strong>${esc(s.staff.split(' ')[0])}${s.isOneOff ? ' <span class="pill amber" style="font-size:0.65rem;">One-off</span>' : ''}</strong>${esc(s.site)}<br>${esc(s.shift)}</div>`).join('')
        : '<div style="color:var(--css-muted); font-size:0.8rem; font-style:italic;">No shifts</div>';
      return `<div class="week-day${iso === today ? ' is-today' : ''}"><div class="week-day-head">${P.dayLabel(iso)}${iso === today ? ' <span class="pill teal" style="font-size:0.68rem;">Today</span>' : ''}</div>${body}</div>`;
    }).join('') + '</div>';
  }
  $('calPrev').addEventListener('click', () => { state.calWeek = P.addDays(state.calWeek, -7); renderCalendar(); });
  $('calNext').addEventListener('click', () => { state.calWeek = P.addDays(state.calWeek, 7); renderCalendar(); });
  $('calStaffFilter').addEventListener('change', renderCalendar);

  /* ===================== One-off shifts ===================== */
  async function renderOneOffs() {
    const el = $('oneOffShiftsList');
    let list;
    try { list = await api(`/api/rota/one-off?from=${P.todayIso()}`); } catch (e) {
      el.innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
      return;
    }
    if (!list.length) { el.innerHTML = '<p style="color:var(--css-muted); font-size:0.88rem;">No upcoming one-off shifts.</p>'; return; }
    el.innerHTML = '<table><thead><tr><th>Staff</th><th>Date</th><th>Shift</th><th>Site</th><th>Note</th><th></th></tr></thead><tbody>' +
      list.map((s) => `<tr>
        <td>${esc(s.staff)}</td><td>${P.formatDate(s.date)}</td><td>${esc(s.shift)}</td><td>${esc(s.site)}</td><td>${esc(s.note || '—')}</td>
        <td><button class="btn small secondary" type="button" data-delete-oneoff="${s.id}">Remove</button></td>
      </tr>`).join('') + '</tbody></table>';
  }
  $('oneOffShiftsList').addEventListener('click', async (e) => {
    const id = e.target.closest('[data-delete-oneoff]')?.dataset.deleteOneoff;
    if (!id || !confirm('Remove this one-off shift?')) return;
    try { await api(`/api/rota/one-off/${id}`, { method: 'DELETE' }); } catch (err) { return fail($('ooMsg'), err); }
    renderOneOffs(); renderCalendar(); renderDashboard().catch(() => {});
  });
  $('ooForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('ooMsg');
    const body = {
      staffId: $('ooStaff').value,
      date: $('ooDate').value,
      siteId: Number($('ooSite').value),
      startTime: $('ooFrom').value,
      endTime: $('ooTo').value,
      lunchMins: Number($('ooLunch').value || 0),
      note: $('ooNote').value.trim() || null,
    };
    if (!body.staffId) return setMsg(msg, 'Select a staff member.', 'error');
    if (!body.date) return setMsg(msg, 'Pick a date.', 'error');
    let saved;
    try { saved = await api('/api/rota/one-off', { method: 'POST', body }); } catch (err) { return fail(msg, err); }
    flash(msg, `One-off shift added for ${saved.staff} on ${P.formatDate(saved.date)}.`);
    $('ooDate').value = '';
    $('ooNote').value = '';
    renderOneOffs(); renderCalendar(); renderDashboard().catch(() => {});
  });

  /* ===================== Accounts ===================== */
  function renderAccounts() {
    const list = $('staffAccountList');
    if (!state.accounts.length) { list.innerHTML = '<li class="empty-msg">No accounts yet.</li>'; return; }
    list.innerHTML = state.accounts.map((a) => {
      const status = !a.active
        ? '<span class="pill red" style="font-size:0.72rem;">Deactivated</span>'
        : a.invitationAccepted
          ? '<span class="pill green" style="font-size:0.72rem;">Active</span>'
          : '<span class="pill amber" style="font-size:0.72rem;">Invitation pending</span>';
      const dot = !a.active ? 'grey' : a.invitationAccepted ? 'green' : 'amber';
      const isSelf = a.id === me.id;
      const buttons = a.role === 'admin' ? '' : `
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn small secondary" type="button" data-edit-staff="${a.id}">Edit</button>
          ${a.active && !a.invitationAccepted ? `<button class="btn small secondary" type="button" data-resend="${a.id}">Resend invite</button>` : ''}
          ${isSelf ? '' : `<button class="btn small secondary" type="button" data-toggle-active="${a.id}">${a.active ? 'Deactivate' : 'Reactivate'}</button>`}
        </div>`;
      return `<li>
        <span class="notif-dot ${dot}"></span>
        <div style="flex:1;">
          <div><strong>${esc(a.fullName)}</strong> <span class="pill grey" style="font-size:0.72rem;">${a.role === 'admin' ? 'Admin' : esc(a.jobTitle || 'Staff')}</span> ${status}</div>
          <div class="notif-meta">${a.siteName ? esc(a.siteName) + ' · ' : ''}${esc(a.email)}</div>
        </div>${buttons}
      </li>`;
    }).join('');
  }

  function resetStaffForm() {
    state.editingStaffId = null;
    $('staffForm').reset();
    $('smEmail').disabled = false;
    $('staffFormTitle').textContent = 'Add new staff member';
    $('smSaveBtn').textContent = 'Send invitation';
    $('smCancelBtn').style.display = 'none';
  }
  $('smCancelBtn').addEventListener('click', resetStaffForm);

  $('staffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('smMsg');
    const fullName = $('smFullName').value.trim();
    const email = $('smEmail').value.trim().toLowerCase();
    const jobTitle = $('smRole').value;
    const siteId = $('smSite').value ? Number($('smSite').value) : null;
    if (!fullName) return setMsg(msg, "Enter the staff member's full name.", 'error');

    $('smSaveBtn').disabled = true;
    try {
      if (state.editingStaffId) {
        await api(`/api/staff/${state.editingStaffId}`, { method: 'PATCH', body: { fullName, jobTitle, siteId } });
        flash(msg, `${fullName}'s details updated.`);
        resetStaffForm();
      } else {
        const domain = P.emailDomain;
        if (!email.endsWith('@' + domain)) return setMsg(msg, `Enter the staff member's @${domain} email address.`, 'error');
        setMsg(msg, 'Sending invitation…');
        await api('/api/staff', { method: 'POST', body: { fullName, email, jobTitle, siteId } });
        flash(msg, `Invitation sent to ${email}. ${fullName} can now be assigned shifts.`);
        resetStaffForm();
      }
      await loadAccounts();
      renderDashboard().catch(() => {});
    } catch (err) {
      fail(msg, err);
    } finally {
      $('smSaveBtn').disabled = false;
    }
  });

  $('staffAccountList').addEventListener('click', async (e) => {
    const msg = $('smMsg');
    const editId = e.target.closest('[data-edit-staff]')?.dataset.editStaff;
    const resendId = e.target.closest('[data-resend]')?.dataset.resend;
    const toggleId = e.target.closest('[data-toggle-active]')?.dataset.toggleActive;
    if (editId) {
      const a = state.accounts.find((x) => x.id === editId);
      state.editingStaffId = a.id;
      $('smFullName').value = a.fullName;
      $('smEmail').value = a.email;
      $('smEmail').disabled = true;
      if (a.jobTitle) $('smRole').value = a.jobTitle;
      $('smSite').value = a.siteId || '';
      $('staffFormTitle').textContent = `Editing ${a.fullName}`;
      $('smSaveBtn').textContent = 'Save changes';
      $('smCancelBtn').style.display = 'inline-block';
    }
    if (resendId) {
      const a = state.accounts.find((x) => x.id === resendId);
      try {
        await api(`/api/staff/${resendId}/resend-invite`, { method: 'POST' });
        flash(msg, `A new invitation has been sent to ${a.email}.`);
        await loadAccounts();
      } catch (err) { fail(msg, err); }
    }
    if (toggleId) {
      const a = state.accounts.find((x) => x.id === toggleId);
      const q = a.active
        ? `Deactivate ${a.fullName}'s account? They will no longer be able to sign in or see their shifts.`
        : `Reactivate ${a.fullName}'s account?`;
      if (!confirm(q)) return;
      try {
        await api(`/api/staff/${toggleId}`, { method: 'PATCH', body: { active: !a.active } });
        flash(msg, `${a.fullName}'s account has been ${a.active ? 'deactivated' : 'reactivated'}.`);
        await loadAccounts();
        renderCalendar();
        renderDashboard().catch(() => {});
      } catch (err) { fail(msg, err); }
    }
  });

  /* ===================== Navigation & start-up ===================== */
  P.initNav((name) => {
    if (name === 'rota') { loadPatterns(); renderCalendar(); renderOneOffs(); }
    if (name === 'dashboard') renderDashboard().catch(() => {});
  });
  document.querySelectorAll('[data-goto]').forEach((el) => el.addEventListener('click', () => P.showSection(el.dataset.goto, (n) => {
    if (n === 'rota') { loadPatterns(); renderCalendar(); renderOneOffs(); }
  })));

  $('rotaStartDate').value = P.todayIso();
  try {
    await loadSites();
    await loadAccounts();
    await renderDashboard();
    renderCalendar();
    renderOneOffs();
  } catch (err) {
    $('welcomeLine').textContent = `Could not load portal data: ${err.message}`;
  }
})();
