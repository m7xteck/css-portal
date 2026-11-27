/* CSS Admin Portal logic — full control over rota, approvals, training,
   renewals oversight, announcements, documents, invoices, service requests
   and practice contracts. Front-end prototype only — all changes are written
   straight back to the shared localStorage DB that staff.js / practice.js read. */

(function () {
  const session = cssGetSession();
  if (!session || session.kind !== 'admin') {
    window.location.href = 'index.html';
    return;
  }

  const adminTier = session.tier || 'super';

  // Which sections each tier can access (null = all)
  const TIER_SECTIONS = {
    super:    null,
    standard: ['dashboard','rota','holiday','training','renewals','announcements','documents','requests','services','contacts','contracts','incidents','ledger'],
    limited:  ['dashboard','contacts','ledger']
  };

  function applyTierRestrictions() {
    const allowed = TIER_SECTIONS[adminTier];
    if (!allowed) return; // super admin sees everything
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
      if (!allowed.includes(btn.dataset.section)) btn.style.display = 'none';
    });
  }

  const todayIso = toLocalIso(new Date());

  /* ===================== EmailJS welcome emails ===================== */
  const EJS_KEY = 'css_emailjs_config';

  function getEmailConfig() {
    try { return JSON.parse(localStorage.getItem(EJS_KEY)) || {}; } catch (e) { return {}; }
  }

  function refreshEmailStatusLabel() {
    const cfg = getEmailConfig();
    const el  = document.getElementById('emailStatusLabel');
    if (!el) return;
    if (cfg.serviceId && cfg.templateId && cfg.publicKey) {
      el.innerHTML = '<span class="pill green" style="font-size:0.75rem;">Configured</span>';
    } else {
      el.innerHTML = '<span class="pill amber" style="font-size:0.75rem;">Not configured — welcome emails will not be sent</span>';
    }
  }

  window.openEmailSetup = function () {
    const panel = document.getElementById('emailSetupPanel');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      const cfg = getEmailConfig();
      document.getElementById('ejsServiceId').value  = cfg.serviceId  || '';
      document.getElementById('ejsTemplateId').value = cfg.templateId || '';
      document.getElementById('ejsPublicKey').value  = cfg.publicKey  || '';
    }
  };

  window.saveEmailConfig = function () {
    const serviceId  = document.getElementById('ejsServiceId').value.trim();
    const templateId = document.getElementById('ejsTemplateId').value.trim();
    const publicKey  = document.getElementById('ejsPublicKey').value.trim();
    const msg        = document.getElementById('ejsMsg');
    if (!serviceId || !templateId || !publicKey) {
      msg.style.color = 'var(--css-red)'; msg.textContent = 'All three fields are required.'; return;
    }
    localStorage.setItem(EJS_KEY, JSON.stringify({ serviceId, templateId, publicKey }));
    msg.style.color = 'var(--css-green)'; msg.textContent = 'Saved.';
    refreshEmailStatusLabel();
    setTimeout(() => msg.textContent = '', 3000);
  };

  window.testWelcomeEmail = async function () {
    const msg = document.getElementById('ejsMsg');
    const cfg = getEmailConfig();
    if (!cfg.serviceId) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Save your EmailJS settings first.'; return; }
    msg.style.color = 'var(--css-muted)'; msg.textContent = 'Sending test…';
    await sendWelcomeEmail(
      prompt('Email address to send test to:') || '',
      'Test User', 'test.user', 'TestPass123', 'Staff Portal'
    );
    msg.style.color = 'var(--css-green)'; msg.textContent = 'Test sent — check the inbox.';
    setTimeout(() => msg.textContent = '', 5000);
  };

  async function sendWelcomeEmail(toEmail, toName, username, password, portalType) {
    if (!toEmail) return;
    const cfg = getEmailConfig();
    if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) return; // silently skip if not configured
    try {
      await emailjs.send(cfg.serviceId, cfg.templateId, {
        to_email:    toEmail,
        to_name:     toName,
        username:    username,
        password:    password,
        portal_type: portalType,
        portal_url:  window.location.origin + window.location.pathname.replace('admin.html', '')
      }, cfg.publicKey);
    } catch (err) {
      console.warn('EmailJS send failed:', err);
      alert(`Welcome email could not be sent to ${toEmail}.\n\nError: ${err.text || err.message || 'Unknown error'}\n\nPlease check your EmailJS configuration.`);
    }
  }

  refreshEmailStatusLabel();

  const TIER_LABELS = { super: '🔑 Super admin', standard: '⚙️ Standard admin', limited: '🔒 Limited admin' };
  document.getElementById('whoBox').innerHTML =
    `<strong>${session.name}</strong>${session.role || 'Administrator'}<span class="role-tier-badge tier-${adminTier}">${TIER_LABELS[adminTier] || adminTier}</span>`;
  applyTierRestrictions();
  document.getElementById('welcomeLine').textContent = `${session.name} — here's what's happening across the CSS portal today.`;

  function daysUntil(iso) {
    return Math.round((new Date(iso + 'T00:00:00') - new Date(todayIso + 'T00:00:00')) / (24 * 60 * 60 * 1000));
  }
  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function dayLabel(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function statusPill(s) {
    const map = { Pending: 'amber', Approved: 'green', Declined: 'red', Cancelled: 'grey', Submitted: 'teal', Paid: 'green', Draft: 'grey', 'In progress': 'teal', Scheduled: 'teal', Completed: 'green', Overdue: 'red' };
    return `<span class="pill ${map[s] || 'grey'}">${s}</span>`;
  }
  function weekStartIso(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1));
    return toLocalIso(d);
  }
  function weekEndIso(iso) {
    const d = new Date(weekStartIso(iso) + 'T00:00:00');
    d.setDate(d.getDate() + 4);
    return toLocalIso(d);
  }

  function staffNames(db) { return db.users.staff.map(s => s.name); }
  function orgList(db) { return db.users.practice.map(p => p.org); }

  /* ===================== Dashboard ===================== */
  function renderDashboard() {
    const db = cssLoadDB();
    const pendingHoliday = db.holidayRequests.filter(h => h.status === 'Pending');
    const pendingSwaps = [];
    const invoicesDue = db.invoices.filter(i => i.status === 'Submitted' || i.status === 'Draft');
    const openRequests = db.serviceRequests.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled');
    const trainingOutstanding = db.trainingItems.filter(t => t.status !== 'Completed');
    const renewalsDue = db.renewals.filter(r => daysUntil(r.renewalDate) <= 30);

    document.getElementById('statPendingHoliday').textContent = pendingHoliday.length;
    document.getElementById('statInvoicesDue').textContent = invoicesDue.length;
    document.getElementById('statOpenRequests').textContent = openRequests.length;
    document.getElementById('statTrainingOverdue').textContent = trainingOutstanding.length;
    document.getElementById('statRenewalsDue').textContent = renewalsDue.length;

    refreshNavBadges(db);

    const attention = document.getElementById('dashAttention');
    attention.innerHTML = '';
    const pendingDocs = (db.staffCertificates || []).filter(c => c.status === 'Pending');
    const thirtyDaysIso = toLocalIso(new Date(Date.now() + 30 * 86400000));
    const expiringDocs = (db.staffCertificates || []).filter(c =>
      c.status === 'Approved' && c.dueDate && c.dueDate <= thirtyDaysIso && !c.cleared
    );

    const newIncidents = (db.incidentReports || []).filter(r => r.status === 'Submitted');

    const items = [];
    newIncidents.forEach(r => {
      const incDate = r.incidentDate ? formatDate(r.incidentDate) : 'unknown date';
      items.push({ dot: 'red', text: `Incident report — ${r.staffName}: ${r.briefDescription || r.practice} (${incDate})`, go: 'incidents' });
    });
    pendingHoliday.forEach(h => items.push({ dot: 'amber', text: `Holiday request — ${h.name}, ${formatDate(h.from)}–${formatDate(h.to)}`, go: 'holiday' }));
    pendingDocs.forEach(c => items.push({ dot: 'red', text: `Document awaiting approval — ${c.staffName}: ${c.title}`, go: 'training' }));
    expiringDocs.forEach(c => {
      const overdue = c.dueDate < todayIso;
      items.push({ dot: overdue ? 'red' : 'amber', text: overdue ? `Document expired — ${c.staffName}: ${c.title} (${formatDate(c.dueDate)})` : `Document expiring soon — ${c.staffName}: ${c.title} (${formatDate(c.dueDate)})`, go: 'renewals' });
    });
    invoicesDue.forEach(i => items.push({ dot: 'teal', text: `Invoice ${i.id} — ${i.name}, ${i.status}`, go: 'invoices' }));
    openRequests.forEach(r => items.push({ dot: 'teal', text: `Service request ${r.id} — ${r.org}, ${r.status}`, go: 'requests' }));
    renewalsDue.filter(r => daysUntil(r.renewalDate) < 0).forEach(r => items.push({ dot: 'amber', text: `Overdue renewal — ${r.name}, ${r.title}`, go: 'renewals' }));

    if (!items.length) { attention.innerHTML = '<li class="empty-msg">Nothing needs attention right now.</li>'; }
    else items.slice(0, 8).forEach(it => {
      const li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.innerHTML = `<span class="notif-dot ${it.dot}"></span><div>${it.text}</div>`;
      li.onclick = () => showSectionAndScroll(it.go);
      attention.appendChild(li);
    });

    const rotaWeek = document.getElementById('dashRotaWeek');
    rotaWeek.innerHTML = '';
    const weekShifts = cssRotaForWeek(weekStartIso(todayIso), db.rotaPattern, db.oneOffShifts)
      .filter(r => r.date >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));
    if (!weekShifts.length) rotaWeek.innerHTML = '<li class="empty-msg">No remaining shifts published this week.</li>';
    else weekShifts.slice(0, 6).forEach(r => {
      const li = document.createElement('li');
      const oneOffTag = r.isOneOff ? ' <span class="pill amber" style="font-size:0.7rem;">One-off</span>' : '';
      li.innerHTML = `<span class="rota-dot site-${r.siteKey}"></span><div><div><strong>${r.staff}</strong> · ${dayLabel(r.date)}${oneOffTag}</div><div class="notif-meta">${r.site} · ${r.shift}${r.lunchMins ? ' · lunch ' + r.lunchMins + 'm' : ''}</div></div>`;
      rotaWeek.appendChild(li);
    });
  }

  function showSectionAndScroll(name) {
    window.showSection(name);
  }

  function refreshNavBadges(db) {
    setBadge('holidayNavBadge', db.holidayRequests.filter(h => h.status === 'Pending').length);
    setBadge('requestsNavBadge', db.serviceRequests.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled').length);
    if (window._bellRefresh) window._bellRefresh();
  }
  function setBadge(id, count) {
    const el = document.getElementById(id);
    if (count > 0) { el.textContent = count; el.style.display = 'inline-block'; }
    else { el.style.display = 'none'; }
  }

  /* ===================== Rota & lunch ===================== */
  const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const SITES = [
    { label: 'Riverside PCN', value: 'Riverside PCN|riverside' },
    { label: 'Eastgate PCN',  value: 'Eastgate PCN|eastgate'  },
    { label: 'Westfield PCN', value: 'Westfield PCN|westfield' }
  ];

  let activeRotaStaff = null;
  let editingRotaId = null;

  function initRotaTabs() {
    const db = cssLoadDB();
    const sel = document.getElementById('rotaStaffSelect');
    sel.innerHTML = '';
    const names = staffNames(db);
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    if (names.length) showRotaStaff(names[0]);
  }

  window.showRotaStaff = function (name) {
    activeRotaStaff = name;
    editingRotaId = null;
    const sel = document.getElementById('rotaStaffSelect');
    if (sel && sel.value !== name) sel.value = name;
    renderRotaForStaff(name);
  };

  // Calculate net working minutes from shift string + lunch
  function shiftNetMins(shift, lunchMins) {
    const [from, to] = (shift || '').split('–').map(t => t.trim());
    if (!from || !to) return null;
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    if ([fh, fm, th, tm].some(isNaN)) return null;
    return (th * 60 + tm) - (fh * 60 + fm) - (lunchMins || 0);
  }
  function formatNetHours(mins) {
    if (!mins || mins <= 0) return '';
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function renderRotaForStaff(name) {
    const db = cssLoadDB();
    const rows = db.rotaPattern.filter(p => p.staff === name).sort((a, b) => a.weekday - b.weekday);
    const firstName = name.split(' ')[0];

    // Left: current shifts list
    let shiftRows = '';
    if (!rows.length) {
      shiftRows = `<p style="color:var(--css-muted); font-size:0.9rem; margin:0;">No shifts set up for ${firstName} yet — add one using the form.</p>`;
    } else {
      rows.forEach(p => {
        const lunchChip = p.lunchMins
          ? `<span class="pill teal" style="font-size:0.72rem; margin-left:6px;">🍽️ ${p.lunchMins}m lunch</span>`
          : `<span class="pill grey" style="font-size:0.72rem; margin-left:6px;">No lunch</span>`;
        const net = shiftNetMins(p.shift, p.lunchMins);
        const netChip = net ? `<span class="pill grey" style="font-size:0.72rem; margin-left:4px;">⏱ ${formatNetHours(net)} net</span>` : '';
        const dateRange = p.startDate
          ? `from ${formatDate(p.startDate)}${p.endDate ? ` · until ${formatDate(p.endDate)}` : ' (ongoing)'}`
          : '(ongoing)';
        const endedClass = p.endDate && p.endDate < todayIso ? ' style="opacity:0.55;"' : '';
        shiftRows += `
          <div class="rota-admin-row"${endedClass}>
            <div class="rota-admin-day">${DAY_NAMES[p.weekday]}</div>
            <div class="rota-admin-detail">
              <div class="rota-shift-time">${p.shift} ${lunchChip}${netChip}</div>
              <div class="rota-shift-note" style="margin-top:3px;">${p.site}${p.note ? ' · ' + p.note : ''}</div>
              <div class="notif-meta" style="margin-top:2px;">📅 ${dateRange}</div>
            </div>
            <div class="rota-admin-actions">
              <button class="btn small secondary" onclick="editRotaRow(${p.id})">Edit</button>
              <button class="btn small secondary" onclick="deleteRotaRow(${p.id})">Remove</button>
            </div>
          </div>`;
      });
    }

    // Site options
    const siteOpts = SITES.map(s => `<option value="${s.value}">${s.label}</option>`).join('');

    document.getElementById('rotaStaffContent').innerHTML = `
      <div class="two-col">
        <div class="panel">
          <h3>${firstName}'s recurring shifts</h3>
          <div id="rotaShiftsList">${shiftRows}</div>
        </div>
        <div class="panel">
          <h3 id="rotaFormTitle">Add a shift for ${firstName}</h3>
          <label for="rotaWeekday">Day</label>
          <select id="rotaWeekday">
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
          </select>
          <label for="rotaSite">Site</label>
          <select id="rotaSite">${siteOpts}</select>
          <div class="form-row" style="margin-top:12px;">
            <div><label for="rotaFrom">Shift start</label><input type="time" id="rotaFrom" value="09:00"></div>
            <div><label for="rotaTo">Shift end</label><input type="time" id="rotaTo" value="17:00"></div>
          </div>
          <label for="rotaLunch">Lunch break (minutes)</label>
          <input type="number" id="rotaLunch" value="30" min="0" step="5">
          <div class="form-row" style="margin-top:12px;">
            <div><label for="rotaStartDate">Pattern starts</label><input type="date" id="rotaStartDate" value="${todayIso}"></div>
            <div><label for="rotaEndDate">Pattern ends <span style="font-weight:400; color:var(--css-muted);">(optional)</span></label><input type="date" id="rotaEndDate"></div>
          </div>
          <label for="rotaNote">Note (optional)</label>
          <input type="text" id="rotaNote" placeholder="e.g. Clinic A">
          <div class="form-actions">
            <button class="btn" id="rotaSaveBtn" onclick="saveRotaRow()">Add shift</button>
            <button class="btn small secondary" id="rotaCancelBtn" onclick="cancelRotaEdit()" style="display:none;">Cancel</button>
            <span class="form-msg" id="rotaMsg"></span>
          </div>
        </div>
      </div>`;
  }

  window.saveRotaRow = function () {
    const msg = document.getElementById('rotaMsg');
    const weekday = parseInt(document.getElementById('rotaWeekday').value, 10);
    const siteVal = document.getElementById('rotaSite').value;
    const [site, siteKey] = siteVal.split('|');
    const from = document.getElementById('rotaFrom').value;
    const to = document.getElementById('rotaTo').value;
    const lunchMins = parseInt(document.getElementById('rotaLunch').value, 10) || 0;
    const note = document.getElementById('rotaNote').value.trim();
    const startDate = document.getElementById('rotaStartDate').value || todayIso;
    const endDate   = document.getElementById('rotaEndDate').value || null;
    const staff = activeRotaStaff;

    if (!from || !to) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Set a shift start and end time.'; return; }
    if (endDate && endDate <= startDate) { msg.style.color = 'var(--css-red)'; msg.textContent = 'End date must be after start date.'; return; }

    const shift = `${from}–${to}`;
    const db = cssLoadDB();

    if (editingRotaId) {
      const row = db.rotaPattern.find(p => p.id === editingRotaId);
      if (row) Object.assign(row, { staff, weekday, site, siteKey, shift, lunchMins, note, startDate, endDate });
    } else {
      const nextId = (db.rotaPattern.reduce((m, p) => Math.max(m, p.id), 0)) + 1;
      db.rotaPattern.push({ id: nextId, staff, weekday, site, siteKey, shift, lunchMins, note, startDate, endDate });
    }
    cssSaveDB(db);
    editingRotaId = null;
    renderRotaForStaff(staff);
    const newMsg = document.getElementById('rotaMsg');
    if (newMsg) { newMsg.style.color = 'var(--css-green)'; newMsg.textContent = editingRotaId ? 'Shift updated.' : 'Shift added.'; setTimeout(() => newMsg.textContent = '', 4000); }
    renderDashboard();
  };

  window.editRotaRow = function (id) {
    const db = cssLoadDB();
    const row = db.rotaPattern.find(p => p.id === id);
    if (!row) return;
    editingRotaId = id;
    document.getElementById('rotaWeekday').value = row.weekday;
    const siteSel = document.getElementById('rotaSite');
    const match = Array.from(siteSel.options).find(o => o.value.startsWith(row.site + '|'));
    if (match) siteSel.value = match.value;
    const [from, to] = row.shift.split('–').map(t => t.trim());
    document.getElementById('rotaFrom').value = from;
    document.getElementById('rotaTo').value = to;
    document.getElementById('rotaLunch').value = row.lunchMins || 0;
    document.getElementById('rotaStartDate').value = row.startDate || todayIso;
    document.getElementById('rotaEndDate').value = row.endDate || '';
    document.getElementById('rotaNote').value = row.note || '';
    document.getElementById('rotaFormTitle').textContent =
      `Editing ${DAY_NAMES[row.weekday]} shift`;
    document.getElementById('rotaSaveBtn').textContent = 'Save changes';
    document.getElementById('rotaCancelBtn').style.display = 'inline-block';
    document.getElementById('rotaStaffContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.cancelRotaEdit = function () {
    if (!activeRotaStaff) return;
    editingRotaId = null;
    renderRotaForStaff(activeRotaStaff);
  };

  window.deleteRotaRow = function (id) {
    if (!confirm('Remove this recurring shift? It will no longer appear on any future week.')) return;
    const db = cssLoadDB();
    db.rotaPattern = db.rotaPattern.filter(p => p.id !== id);
    cssSaveDB(db);
    renderRotaForStaff(activeRotaStaff);
    renderDashboard();
  };

  /* ===================== Weekly rota calendar ===================== */
  let adminRotaCurrentWeek = weekStartIso(todayIso);

  function onHolidayAdmin(staffName, dateIso, shiftStr) {
    const db = cssLoadDB();
    const approved = (db.holidayRequests || []).filter(h => h.name === staffName && h.status === 'Approved');
    for (const h of approved) {
      if (h.shiftsOff && h.shiftsOff.length) {
        if (h.shiftsOff.some(s => s.date === dateIso && s.shift === shiftStr)) return h;
      } else {
        if (dateIso >= h.from && dateIso <= h.to) return h;
      }
    }
    return null;
  }

  window.renderAdminWeekCalendar = function renderAdminWeekCalendar() {
    const db = cssLoadDB();
    const calEl = document.getElementById('adminWeekCalendar');
    const labelEl = document.getElementById('adminRotaWeekLabel');
    const filterSel = document.getElementById('calStaffFilter');
    if (!calEl || !labelEl) return;

    // Populate staff dropdown (keep current selection)
    if (filterSel) {
      const selected = filterSel.value;
      const names = staffNames(db);
      filterSel.innerHTML = '<option value="">All staff</option>' +
        names.map(n => `<option value="${n}" ${n === selected ? 'selected' : ''}>${n}</option>`).join('');
    }
    const staffFilter = filterSel ? filterSel.value : '';

    const isThisWeek = adminRotaCurrentWeek === weekStartIso(todayIso);
    labelEl.textContent = `Week of ${dayLabel(adminRotaCurrentWeek)}${isThisWeek ? ' (this week)' : ''}${staffFilter ? ' · ' + staffFilter.split(' ')[0] : ''}`;

    let allShifts = cssRotaForWeek(adminRotaCurrentWeek, db.rotaPattern, db.oneOffShifts);
    if (staffFilter) allShifts = allShifts.filter(r => r.staff === staffFilter);

    // Group by date
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(adminRotaCurrentWeek + 'T00:00:00');
      d.setDate(d.getDate() + i);
      days.push(toLocalIso(d));
    }

    let html = `<div style="display:grid; grid-template-columns:repeat(5,1fr); gap:10px;">`;
    days.forEach(iso => {
      const dayShifts = allShifts.filter(r => r.date === iso).sort((a, b) => a.shift.localeCompare(b.shift));
      const isToday = iso === todayIso;
      html += `<div style="background:var(--css-bg); border:1px solid var(--css-border); border-radius:8px; padding:10px; ${isToday ? 'border-color:var(--css-teal);' : ''}">
        <div style="font-weight:700; font-size:0.85rem; margin-bottom:8px; color:${isToday ? 'var(--css-teal)' : 'var(--css-text)'};">${dayLabel(iso)}${isToday ? ' <span class="pill teal" style="font-size:0.68rem;">Today</span>' : ''}</div>`;
      if (!dayShifts.length) {
        html += `<div style="color:var(--css-muted); font-size:0.8rem; font-style:italic;">No shifts</div>`;
      } else {
        dayShifts.forEach(r => {
          const hol = onHolidayAdmin(r.staff, iso, r.shift);
          if (hol) {
            html += `<div style="background:rgba(var(--css-teal-rgb,20,184,166),0.08); border-left:3px solid var(--css-teal); border-radius:4px; padding:6px 8px; margin-bottom:6px;">
              <div style="font-size:0.78rem; font-weight:600;">🌴 ${r.staff.split(' ')[0]}</div>
              <div style="font-size:0.75rem; color:var(--css-muted);">Annual leave</div>
              <div style="font-size:0.72rem; color:var(--css-muted);">${r.site} · ${r.shift}</div>
            </div>`;
          } else {
            html += `<div style="background:var(--css-surface); border-left:3px solid var(--css-border); border-radius:4px; padding:6px 8px; margin-bottom:6px;${r.isOneOff ? ' border-left-color:var(--css-amber);' : ''}">
              <div style="font-size:0.78rem; font-weight:600;">${r.staff.split(' ')[0]}${r.isOneOff ? ' <span class="pill amber" style="font-size:0.65rem;">One-off</span>' : ''}</div>
              <div style="font-size:0.75rem; color:var(--css-muted);">${r.site}</div>
              <div style="font-size:0.72rem; color:var(--css-muted);">${r.shift}</div>
            </div>`;
          }
        });
      }
      html += `</div>`;
    });
    html += `</div>`;
    calEl.innerHTML = html;
  }

  window.adminRotaPrevWeek = function () {
    const d = new Date(adminRotaCurrentWeek + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    adminRotaCurrentWeek = toLocalIso(d);
    renderAdminWeekCalendar();
  };

  window.adminRotaNextWeek = function () {
    const d = new Date(adminRotaCurrentWeek + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    adminRotaCurrentWeek = toLocalIso(d);
    renderAdminWeekCalendar();
  };

  /* ===================== One-off shifts / Overtime ===================== */
  function populateOneOffStaffSelect() {
    const db = cssLoadDB();
    const sel = document.getElementById('ooStaff');
    if (!sel) return;
    sel.innerHTML = staffNames(db).map(n => `<option value="${n}">${n}</option>`).join('');
  }

  function renderOneOffShifts() {
    const db = cssLoadDB();
    const el = document.getElementById('oneOffShiftsList');
    if (!el) return;
    const today = todayIso;
    const upcoming = (db.oneOffShifts || [])
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!upcoming.length) {
      el.innerHTML = '<p style="color:var(--css-muted); font-size:0.88rem;">No one-off shifts added yet.</p>';
      return;
    }

    el.innerHTML = '<table><thead><tr><th>Staff</th><th>Date</th><th>Shift</th><th>Site</th><th>Note</th><th></th></tr></thead><tbody>' +
      upcoming.map(s => {
        const isPast = s.date < today;
        return `<tr style="${isPast ? 'opacity:0.55;' : ''}">
          <td>${s.staff}</td>
          <td>${formatDate(s.date)}${isPast ? ' <span class="pill grey" style="font-size:0.7rem;">Past</span>' : ''}</td>
          <td>${s.shift}</td>
          <td>${s.site}</td>
          <td>${s.note || '—'}</td>
          <td><button class="btn small secondary" onclick="deleteOneOffShift(${s.id})">Remove</button></td>
        </tr>`;
      }).join('') + '</tbody></table>';
  }

  window.saveOneOffShift = function () {
    const msg    = document.getElementById('ooMsg');
    const staff  = document.getElementById('ooStaff').value;
    const date   = document.getElementById('ooDate').value;
    const siteVal = document.getElementById('ooSite').value;
    const from   = document.getElementById('ooFrom').value;
    const to     = document.getElementById('ooTo').value;
    const lunch  = parseInt(document.getElementById('ooLunch').value, 10) || 0;
    const note   = document.getElementById('ooNote').value.trim();

    if (!staff) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Select a staff member.'; return; }
    if (!date)  { msg.style.color = 'var(--css-red)'; msg.textContent = 'Pick a date.'; return; }
    if (!from || !to) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Set a start and end time.'; return; }

    const [site, siteKey] = siteVal.split('|');
    const shift = `${from}–${to}`;

    const db = cssLoadDB();
    if (!db.oneOffShifts) db.oneOffShifts = [];
    const nextId = (db.oneOffShifts.reduce((m, s) => Math.max(m, s.id), 0)) + 1;
    db.oneOffShifts.push({ id: nextId, staff, date, site, siteKey, shift, lunchMins: lunch, note });
    cssSaveDB(db);

    msg.style.color = 'var(--css-green)';
    msg.textContent = `One-off shift added for ${staff} on ${formatDate(date)}.`;
    document.getElementById('ooDate').value = '';
    document.getElementById('ooNote').value = '';
    renderOneOffShifts();
    renderDashboard();
    setTimeout(() => msg.textContent = '', 5000);
  };

  window.deleteOneOffShift = function (id) {
    if (!confirm('Remove this one-off shift?')) return;
    const db = cssLoadDB();
    db.oneOffShifts = (db.oneOffShifts || []).filter(s => s.id !== id);
    cssSaveDB(db);
    renderOneOffShifts();
    renderDashboard();
  };

  /* ===================== Holiday approvals ===================== */
  function parseShiftHours(shiftStr) {
    // e.g. "08:30–16:30" or "08:30-16:30" — returns gross hours as a number
    const parts = (shiftStr || '').split(/[–\-]/);
    if (parts.length < 2) return 0;
    const [h1, m1] = parts[0].trim().split(':').map(Number);
    const [h2, m2] = parts[1].trim().split(':').map(Number);
    if ([h1, m1, h2, m2].some(isNaN)) return 0;
    return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  }

  function renderAdminHoliday() {
    const db = cssLoadDB();
    const tbody = document.getElementById('adminHolidayTable');
    tbody.innerHTML = '';
    // Hide declined requests more than 3 months (90 days) old — records stay in DB forever
    const ninetyDaysAgo = toLocalIso(new Date(Date.now() - 90 * 86400000));
    const rows = [...db.holidayRequests]
      .filter(h => !(h.status === 'Declined' && h.declinedAt && h.declinedAt < ninetyDaysAgo))
      .sort((a, b) => (a.status === 'Pending' ? -1 : 1) - (b.status === 'Pending' ? -1 : 1) || a.from.localeCompare(b.from));
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">No holiday requests yet.</td></tr>'; return; }
    rows.forEach(h => {
      // Look up this staff member's role and primary site
      const staffUser = (db.users.staff || []).find(u => u.name === h.name);
      const role = staffUser ? staffUser.role : '—';
      const primarySite = staffUser ? staffUser.site : '—';

      let shiftsCell;
      if (h.shiftsOff && h.shiftsOff.length) {
        const totalHrs = h.shiftsOff.reduce((sum, s) => sum + parseShiftHours(s.shift), 0);
        const hrsLabel = totalHrs > 0 ? ` <span class="pill teal">${totalHrs % 1 === 0 ? totalHrs : totalHrs.toFixed(1)}h cover needed</span>` : '';
        const lines = h.shiftsOff.map(s =>
          `<span style="display:block;">${dayLabel(s.date)} · <strong>${s.shift}</strong> · <span class="notif-meta">${s.site}</span></span>`
        ).join('');
        shiftsCell = `${hrsLabel}<div style="margin-top:4px;">${lines}</div>`;
      } else {
        shiftsCell = `<span style="color:var(--css-muted);">No specific shifts flagged</span><br><span class="notif-meta">Primary site: ${primarySite}</span>`;
      }

      const actions = h.status === 'Pending'
        ? `<button class="btn small" onclick="actOnHoliday(${h.id},'Approved')">Approve</button>
           <button class="btn small secondary" onclick="actOnHoliday(${h.id},'Declined')">Decline</button>`
        : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${h.name}</td><td><span class="notif-meta">${role}</span></td><td>${formatDate(h.from)}</td><td>${formatDate(h.to)}</td><td>${shiftsCell}</td><td>${h.note || '—'}</td><td>${statusPill(h.status)}</td><td>${actions}</td>`;
      tbody.appendChild(tr);
    });
  }

  window.actOnHoliday = function (id, status) {
    const db = cssLoadDB();
    const h = db.holidayRequests.find(x => x.id === id);
    if (!h) return;
    h.status = status;
    if (status === 'Declined') h.declinedAt = todayIso; // stamp so we can age it off after 3 months
    cssSaveDB(db);
    renderAdminHoliday();
    renderDashboard();
    renderAdminWeekCalendar(); // refresh rota calendar to show/hide annual leave
  };


  /* ===================== Training ===================== */
  function populateTrainStaffSelect() {
    const db = cssLoadDB();
    const sel = document.getElementById('trainStaff');
    sel.innerHTML = '<option value="__all__">All staff</option>' + staffNames(db).map(n => `<option value="${n}">${n}</option>`).join('');
  }

  /* ===================== Staff Documents & Certificates ===================== */
  let approvingDocId = null;

  window.adminDocTab = function (tab) {
    document.querySelectorAll('#adminDocTabs .doc-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`#adminDocTabs .doc-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('adminDocPendingPanel').style.display = tab === 'pending' ? 'block' : 'none';
    document.getElementById('adminDocAllPanel').style.display     = tab === 'all'     ? 'block' : 'none';
    document.getElementById('approveDocPanel').style.display      = 'none';
    if (tab === 'all') renderAllDocs();
    else renderPendingDocs();
  };

  function renderPendingDocs() {
    const db = cssLoadDB();
    const pending = (db.staffCertificates || []).filter(c => c.status === 'Pending');
    const el = document.getElementById('pendingDocsList');
    const badge = document.getElementById('pendingDocsBadge');
    const navBadge = document.getElementById('docsNavBadge');

    // badges
    if (pending.length) {
      badge.textContent = pending.length; badge.style.display = 'inline-block';
      navBadge.textContent = pending.length; navBadge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none'; navBadge.style.display = 'none';
    }

    if (!pending.length) { el.innerHTML = '<p style="color:var(--css-muted); padding:12px 0;">No documents awaiting approval.</p>'; return; }
    el.innerHTML = `<table><thead><tr><th>Staff</th><th>Document</th><th>Category</th><th>File</th><th>Uploaded</th><th></th></tr></thead><tbody>` +
      pending.map(c => `<tr>
        <td>${c.staffName}</td>
        <td><strong>${c.title}</strong></td>
        <td>${c.category}</td>
        <td>${c.fileData
          ? `<button class="btn small secondary" onclick="adminViewCertFile(${c.id})">📎 View file</button>`
          : `<span class="notif-meta">📎 ${c.fileName || '—'}</span>`}</td>
        <td>${formatDate(c.uploadDate)}</td>
        <td style="white-space:nowrap;">
          <button class="btn small" onclick="openApproveDoc(${c.id})">Approve</button>
          <button class="btn small secondary" onclick="rejectDoc(${c.id})" style="margin-left:4px;">Reject</button>
        </td>
      </tr>`).join('') + `</tbody></table>`;
  }

  window.renderAllDocs = function () {
    const db = cssLoadDB();
    const staffFilter   = document.getElementById('docFilterStaff').value;
    const statusFilter  = document.getElementById('docFilterStatus').value;
    let certs = (db.staffCertificates || []);
    if (staffFilter)  certs = certs.filter(c => c.username === staffFilter);
    if (statusFilter) certs = certs.filter(c => c.status === statusFilter);
    certs = [...certs].sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));

    // Populate staff filter dropdown
    const sel = document.getElementById('docFilterStaff');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All staff</option>' + (db.users.staff || []).map(u =>
      `<option value="${u.username}" ${u.username === cur ? 'selected' : ''}>${u.name}</option>`).join('');

    const tbody = document.getElementById('allDocsTable');
    if (!certs.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No documents found.</td></tr>'; return; }
    tbody.innerHTML = certs.map(c => {
      const d = c.dueDate ? daysUntil(c.dueDate) : null;
      const dueTxt = !c.dueDate ? '—'
        : d < 0  ? `<span style="color:var(--css-red)">Overdue (${formatDate(c.dueDate)})</span>`
        : d <= 30 ? `<span style="color:var(--css-amber)">Due in ${d}d (${formatDate(c.dueDate)})</span>`
        : formatDate(c.dueDate);
      const pill = c.status === 'Approved' ? 'Approved' : c.status === 'Rejected' ? 'Declined' : 'Pending';
      return `<tr>
        <td>${c.staffName}</td>
        <td>${c.title}</td>
        <td>${c.category}</td>
        <td>${formatDate(c.uploadDate)}</td>
        <td>${dueTxt}</td>
        <td>${statusPill(pill)}</td>
        <td style="white-space:nowrap;">
          ${c.fileData ? `<button class="btn small secondary" onclick="adminViewCertFile(${c.id})">📎 View</button>` : ''}
          ${c.status === 'Pending' ? `<button class="btn small" onclick="openApproveDoc(${c.id})" style="margin-left:4px;">Approve</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  };

  window.adminViewCertFile = function (id) {
    const db = cssLoadDB();
    const cert = (db.staffCertificates || []).find(c => c.id === id);
    if (!cert || !cert.fileData) return;
    const link = document.createElement('a');
    link.href = cert.fileData;
    link.download = cert.fileName;
    link.click();
  };

  window.openApproveDoc = function (id) {
    approvingDocId = id;
    const db = cssLoadDB();
    const cert = (db.staffCertificates || []).find(c => c.id === id);
    if (!cert) return;
    document.getElementById('approveDocTitle').textContent = `Approve: ${cert.title} — ${cert.staffName}`;
    document.getElementById('approveDocDate').value  = '';
    document.getElementById('approveDocNotes').value = cert.adminNotes || '';
    document.getElementById('approveDocMsg').textContent = '';
    document.getElementById('approveDocPanel').style.display = 'block';
    document.getElementById('approveDocPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.cancelApproveDoc = function () {
    approvingDocId = null;
    document.getElementById('approveDocPanel').style.display = 'none';
  };

  window.confirmApproveDoc = function () {
    const msg    = document.getElementById('approveDocMsg');
    const dueDate = document.getElementById('approveDocDate').value || null;
    const notes  = document.getElementById('approveDocNotes').value.trim();
    const db = cssLoadDB();
    const cert = (db.staffCertificates || []).find(c => c.id === approvingDocId);
    if (!cert) return;
    cert.status = 'Approved'; cert.dueDate = dueDate || null; cert.adminNotes = notes;
    cssSaveDB(db);
    document.getElementById('approveDocPanel').style.display = 'none';
    approvingDocId = null;
    renderPendingDocs();
    renderAdminRenewals();
    refreshNavBadges(db);
    msg.style.color = 'var(--css-green)'; msg.textContent = 'Approved.';
  };

  window.rejectDoc = function (id) {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    const db = cssLoadDB();
    const cert = (db.staffCertificates || []).find(c => c.id === id);
    if (!cert) return;
    cert.status = 'Rejected'; cert.adminNotes = reason;
    cssSaveDB(db);
    renderPendingDocs();
    refreshNavBadges(db);
  };

  /* ===================== Renewals overview ===================== */
  function renderAdminTraining() { renderPendingDocs(); } // alias for init call

  function renderAdminRenewals() {
    const db = cssLoadDB();
    const tbody = document.getElementById('adminRenewalsTable');
    if (!tbody) return;
    const certs = (db.staffCertificates || [])
      .filter(c => c.status === 'Approved' && c.dueDate && !c.cleared)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (!certs.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No approved documents with due dates yet.</td></tr>'; return; }
    tbody.innerHTML = certs.map(c => {
      const d = daysUntil(c.dueDate);
      const label = d < 0 ? 'Overdue' : d <= 30 ? `Due in ${d} day${d === 1 ? '' : 's'}` : 'Active';
      const pill  = d < 0 ? 'Overdue' : d <= 30 ? 'Pending' : 'Approved';
      // Show "Mark renewed" only when overdue or due within 30 days
      const action = d <= 30
        ? `<button class="btn small secondary" onclick="clearRenewal(${c.id})">✓ Mark renewed</button>`
        : '';
      return `<tr>
        <td>${c.staffName}</td>
        <td>${c.title}</td>
        <td>${c.category}</td>
        <td>${formatDate(c.dueDate)}</td>
        <td>${statusPill(pill)} <span class="notif-meta">${label}</span></td>
        <td>${action}</td>
      </tr>`;
    }).join('');
  }

  window.clearRenewal = function (id) {
    if (!confirm('Mark this renewal as cleared? It will be removed from the overdue list and notifications.')) return;
    const db = cssLoadDB();
    const cert = (db.staffCertificates || []).find(c => c.id === id);
    if (!cert) return;
    cert.cleared = true;
    cert.clearedAt = todayIso;
    cssSaveDB(db);
    renderAdminRenewals();
    refreshBell();
    renderDashboard();
  };

  /* ===================== Announcements ===================== */
  function renderAdminAnnouncements() {
    const db = cssLoadDB();
    const list = document.getElementById('adminAnnList');
    list.innerHTML = '';
    const rows = [...db.announcements].sort((a, b) => b.date.localeCompare(a.date));
    if (!rows.length) { list.innerHTML = '<li class="empty-msg">No announcements published yet.</li>'; return; }

    const staffList = db.users.staff || [];

    rows.forEach(a => {
      const seenBy = a.seenBy || [];
      const relevant = a.audience === 'staff'
        ? staffList
        : []; // practice users not tracked yet
      const seenNames   = seenBy.map(u => { const s = staffList.find(x => x.username === u); return s ? s.name : u; });
      const unseenNames = relevant.filter(s => !seenBy.includes(s.username)).map(s => s.name);
      const total = relevant.length;
      const seenCount = Math.min(seenNames.length, total);

      // Build recipient summary label
      const rStaff = a.recipientStaff;
      const rPrac  = a.recipientPractices;
      const recipParts = [];
      if (rStaff === 'all') recipParts.push('All staff');
      else if (Array.isArray(rStaff) && rStaff.length) {
        recipParts.push(rStaff.map(u => { const s = staffList.find(x => x.username === u); return s ? s.name : u; }).join(', '));
      }
      if (rPrac === 'all') recipParts.push('All practices');
      else if (Array.isArray(rPrac) && rPrac.length) {
        const db2 = cssLoadDB();
        recipParts.push(rPrac.map(u => { const p = (db2.users.practice || []).find(x => x.username === u); return p ? p.org : u; }).join(', '));
      }
      if (!recipParts.length) {
        // legacy: fall back to audience field
        recipParts.push(a.audience === 'staff' ? 'CSS Staff' : a.audience === 'practice' ? 'PCN / Practices' : 'Staff & Practices');
      }
      const recipLabel = recipParts.join(' · ');
      const showSeen = rStaff || a.audience === 'staff';

      const li = document.createElement('li');
      li.style.display = 'block';
      li.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:12px;">
          <span class="notif-dot ${a.priority === 'green' ? 'green' : a.priority === 'red' ? 'amber' : 'teal'}" style="margin-top:4px;"></span>
          <div style="flex:1;">
            <div><strong>${a.title}</strong> ${a.type === 'mhra' ? '<span class="pill red" style="font-size:0.72rem;">MHRA</span> ' : ''}<span class="pill ${a.priority}" title="${recipLabel}">→ ${recipLabel}</span></div>
            <div class="notif-meta">${formatDate(a.date)}</div>
            <div style="margin-top:6px; font-size:0.88rem;">${a.body}</div>
            ${showSeen ? `
            <button class="ann-seen-toggle" onclick="toggleAnnSeen(${a.id})">
              👁 Seen by ${seenCount} of ${total} staff
            </button>
            <div class="ann-seen-panel" id="annSeen${a.id}" style="display:none;">
              <div class="ann-seen-col">
                <strong>✅ Seen (${seenNames.length})</strong>
                ${seenNames.length ? '<ul>' + seenNames.map(n => `<li>${n}</li>`).join('') + '</ul>' : '<p class="ann-seen-empty">Nobody yet</p>'}
              </div>
              <div class="ann-seen-col">
                <strong>⏳ Not yet seen (${unseenNames.length})</strong>
                ${unseenNames.length ? '<ul>' + unseenNames.map(n => `<li>${n}</li>`).join('') + '</ul>' : '<p class="ann-seen-empty">All staff have seen this</p>'}
              </div>
            </div>` : ''}
          </div>
          <button class="btn small secondary" onclick="deleteAnnouncement(${a.id})">Delete</button>
        </div>`;
      list.appendChild(li);
    });
  }

  window.toggleAnnSeen = function (id) {
    const panel = document.getElementById('annSeen' + id);
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
  };

  // Populate recipient checkboxes from current DB
  function populateAnnRecipients() {
    const db = cssLoadDB();
    const staffList = db.listEl = document.getElementById('annStaffList');
    const practiceList = document.getElementById('annPracticeList');
    if (!staffList || !practiceList) return;
    staffList.innerHTML = (db.users.staff || []).map(u =>
      `<label class="hr-check"><input type="checkbox" class="ann-staff-cb" value="${u.username}"> ${u.name}</label>`
    ).join('');
    practiceList.innerHTML = (db.users.practice || []).map(u =>
      `<label class="hr-check"><input type="checkbox" class="ann-practice-cb" value="${u.username}"> ${u.org}</label>`
    ).join('');
  }

  window.annToggleAll = function (group, checked) {
    const cls = group === 'staff' ? '.ann-staff-cb' : '.ann-practice-cb';
    document.querySelectorAll(cls).forEach(cb => cb.checked = checked);
  };

  window.addAnnouncement = function () {
    const msg = document.getElementById('annMsg');
    const priority = document.getElementById('annPriority').value;
    const title = document.getElementById('annTitle').value.trim();
    const body = document.getElementById('annBody').value.trim();
    if (!title || !body) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Please add a title and body.'; return; }

    // Collect selected recipients
    const allStaff    = document.getElementById('annAllStaff').checked;
    const allPractice = document.getElementById('annAllPractice').checked;
    const selStaff    = [...document.querySelectorAll('.ann-staff-cb:checked')].map(cb => cb.value);
    const selPractice = [...document.querySelectorAll('.ann-practice-cb:checked')].map(cb => cb.value);

    const recipientStaff    = allStaff    ? 'all' : selStaff.length    ? selStaff    : null;
    const recipientPractices = allPractice ? 'all' : selPractice.length ? selPractice : null;

    if (!recipientStaff && !recipientPractices) {
      msg.style.color = 'var(--css-red)'; msg.textContent = 'Select at least one recipient.'; return;
    }

    // Derive legacy audience field for backward-compat filters
    const audience = recipientStaff && recipientPractices ? 'both'
                   : recipientStaff ? 'staff' : 'practice';

    const type = document.getElementById('annType').value;
    const db = cssLoadDB();
    const nextId = (db.announcements.reduce((m, a) => Math.max(m, a.id), 0)) + 1;
    db.announcements.unshift({ id: nextId, audience, type, title, body, date: todayIso, priority, recipientStaff, recipientPractices, seenBy: [] });
    cssSaveDB(db);
    msg.style.color = 'var(--css-green)';
    msg.textContent = 'Announcement published.';
    document.getElementById('annTitle').value = '';
    document.getElementById('annBody').value = '';
    document.getElementById('annAllStaff').checked = false;
    document.getElementById('annAllPractice').checked = false;
    document.querySelectorAll('.ann-staff-cb, .ann-practice-cb').forEach(cb => cb.checked = false);
    renderAdminAnnouncements();
    setTimeout(() => msg.textContent = '', 4000);
  };

  window.deleteAnnouncement = function (id) {
    if (!confirm('Delete this announcement?')) return;
    const db = cssLoadDB();
    db.announcements = db.announcements.filter(a => a.id !== id);
    cssSaveDB(db);
    renderAdminAnnouncements();
  };

  /* ===================== Documents — Staff ===================== */
  let activeStaffDocFilter = 'all';

  function adminInitStaffDocDropdowns() {
    const db      = cssLoadDB();
    const viewSel = document.getElementById('docStaffSelect');
    const addSel  = document.getElementById('sDocStaff');

    viewSel.innerHTML = '<option value="all">All staff</option>';
    addSel.innerHTML  = '<option value="all">All staff</option>';

    (db.users.staff || []).forEach(u => {
      viewSel.innerHTML += `<option value="${u.username}">${u.name}</option>`;
      addSel.innerHTML  += `<option value="${u.username}">${u.name}</option>`;
    });

    renderStaffDocSummary();
    renderAdminStaffDocs(activeStaffDocFilter);
  }

  window.adminDocStaffFilter = function (filter) {
    activeStaffDocFilter = filter;
    const viewSel = document.getElementById('docStaffSelect');
    if (viewSel) viewSel.value = filter;
    renderAdminStaffDocs(filter);
  };

  function staffLabelForDoc(doc, db) {
    const s = doc.staffMembers;
    if (!s || s === 'all') return '<span class="pill grey" style="font-size:0.72rem;">All staff</span>';
    if (Array.isArray(s)) {
      return s.map(u => {
        const st = (db.users.staff || []).find(x => x.username === u);
        return `<span class="pill teal" style="font-size:0.72rem;">${st ? st.name : u}</span>`;
      }).join(' ');
    }
    return '';
  }

  function renderAdminStaffDocs(filter) {
    filter = filter || 'all';
    const db  = cssLoadDB();
    const el  = document.getElementById('adminStaffDocList');
    el.innerHTML = '';

    let docs = db.staffDocs;
    if (filter !== 'all') {
      // Show only docs explicitly assigned to this staff member (not "all staff" docs)
      docs = docs.filter(d => {
        const s = d.staffMembers;
        return Array.isArray(s) && s.includes(filter);
      });
    }
    // "All staff" view shows everything

    if (!docs.length) {
      el.innerHTML = filter === 'all'
        ? '<p style="color:var(--css-muted); padding:12px 0;">No staff documents added yet.</p>'
        : '<p style="color:var(--css-muted); padding:12px 0;">No documents specifically assigned to this staff member. Documents set to <strong>All staff</strong> are available to them but appear under the All staff view.</p>';
      return;
    }

    // Group by category
    const groups = {};
    docs.forEach(d => {
      const key = d.category || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ doc: d, origIdx: db.staffDocs.indexOf(d) });
    });

    const catIcons = { 'SOP / Policy': '📋', 'HR': '👤', 'Training': '🎓', 'Rota': '🗓️', 'Finance': '💷' };

    el.innerHTML = '<table><thead><tr><th>Document</th><th>Category</th><th>Visible to</th><th>Updated</th><th></th></tr></thead><tbody id="staffDocTableBody"></tbody></table>';
    const tbody = el.querySelector('#staffDocTableBody');

    Object.entries(groups).forEach(([cat, items]) => {
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = `<td colspan="5" style="background:var(--css-bg); color:var(--css-muted); font-size:0.78rem; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:10px 12px 6px;">${catIcons[cat] || '📄'} ${cat} <span style="font-weight:400;">(${items.length})</span></td>`;
      tbody.appendChild(headerRow);

      items.forEach(({ doc: d, origIdx }) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${d.name}</strong></td>
          <td><span class="notif-meta">${d.category}</span></td>
          <td>${staffLabelForDoc(d, db)}</td>
          <td><span class="notif-meta">${formatDate(d.updated)}</span></td>
          <td><button class="btn small secondary" onclick="deleteStaffDoc(${origIdx})">Delete</button></td>`;
        tbody.appendChild(tr);
      });
    });
  }

  function renderStaffDocSummary() {
    const db  = cssLoadDB();
    const el  = document.getElementById('staffDocSummary');
    if (!el) return;
    const total    = db.staffDocs.length;
    const allCount = db.staffDocs.filter(d => !d.staffMembers || d.staffMembers === 'all').length;

    let html = `<div style="margin-bottom:10px;"><strong>${total}</strong> <span class="notif-meta">total documents</span></div>`;
    html += `<div class="notif-meta" style="margin-bottom:8px;">📄 <strong>${allCount}</strong> visible to all staff</div>`;
    (db.users.staff || []).forEach(u => {
      const count = db.staffDocs.filter(d => {
        const s = d.staffMembers;
        if (!s || s === 'all') return true;
        return Array.isArray(s) && s.includes(u.username);
      }).length;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--css-border); cursor:pointer;" onclick="adminDocStaffFilter('${u.username}')">
        <span>${u.name}</span>
        <span class="pill teal" style="font-size:0.75rem;">${count} docs</span>
      </div>`;
    });
    el.innerHTML = html;
  }

  window.addStaffDoc = function () {
    const msg        = document.getElementById('sDocMsg');
    const name       = document.getElementById('sDocName').value.trim();
    const category   = document.getElementById('sDocCategory').value;
    const staffVal   = document.getElementById('sDocStaff').value;
    const staffMembers = staffVal === 'all' ? 'all' : [staffVal];

    if (!name) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Enter a document name.'; return; }
    const db = cssLoadDB();
    db.staffDocs.unshift({ name, category, updated: todayIso, staffMembers });
    cssSaveDB(db);
    msg.style.color = 'var(--css-green)';
    msg.textContent = 'Document added.';
    document.getElementById('sDocName').value = '';
    renderAdminStaffDocs(activeStaffDocFilter);
    renderStaffDocSummary();
    setTimeout(() => msg.textContent = '', 4000);
  };

  window.deleteStaffDoc = function (index) {
    if (!confirm('Remove this document?')) return;
    const db = cssLoadDB();
    db.staffDocs.splice(index, 1);
    cssSaveDB(db);
    renderAdminStaffDocs(activeStaffDocFilter);
    renderStaffDocSummary();
  };

  /* ===================== Documents — main tab switcher ===================== */
  window.adminDocMainTab = function (tab) {
    document.querySelectorAll('#docMainTabs .doc-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`#docMainTabs .doc-tab[data-maintab="${tab}"]`).classList.add('active');
    document.getElementById('docStaffPanel').style.display    = tab === 'staff'    ? 'block' : 'none';
    document.getElementById('docPracticePanel').style.display = tab === 'practice' ? 'block' : 'none';
  };

  /* ===================== Practice document tabs ===================== */
  let activePracticeDocTab = 'all';

  function adminInitPracticeTabs() {
    const db  = cssLoadDB();
    const viewSel = document.getElementById('docPracticeSelect');
    const addSel  = document.getElementById('pDocPractice');

    viewSel.innerHTML = '<option value="all">All practices</option>';
    addSel.innerHTML  = '<option value="all">All practices</option>';

    (db.users.practice || []).forEach(p => {
      viewSel.innerHTML += `<option value="${p.username}">${p.org}</option>`;
      addSel.innerHTML  += `<option value="${p.username}">${p.org}</option>`;
    });

    renderPracticeDocSummary();
    renderAdminPracticeDocs(activePracticeDocTab);
  }

  window.adminDocPracticeTab = function (filter) {
    activePracticeDocTab = filter;
    // Keep the view dropdown in sync (e.g. when called from summary panel click)
    const viewSel = document.getElementById('docPracticeSelect');
    if (viewSel) viewSel.value = filter;
    renderAdminPracticeDocs(filter);
  };

  function practiceForDoc(doc, db) {
    // Returns a display label for which practice(s) a doc is visible to
    const p = doc.practices;
    if (!p || p === 'all') return '<span class="pill grey" style="font-size:0.72rem;">All practices</span>';
    if (Array.isArray(p)) {
      return p.map(u => {
        const pr = (db.users.practice || []).find(x => x.username === u);
        return `<span class="pill teal" style="font-size:0.72rem;">${pr ? pr.org : u}</span>`;
      }).join(' ');
    }
    return '';
  }

  function renderAdminPracticeDocs(filter) {
    filter = filter || 'all';
    const db = cssLoadDB();
    const el = document.getElementById('adminPracticeDocList');
    el.innerHTML = '';

    let docs = db.practiceDocs;
    if (filter !== 'all') {
      // Show only docs explicitly assigned to this practice (not "all practices" docs)
      docs = docs.filter(d => {
        const p = d.practices;
        return Array.isArray(p) && p.includes(filter);
      });
    }
    // "All practices" view shows everything

    if (!docs.length) {
      el.innerHTML = filter === 'all'
        ? '<p style="color:var(--css-muted); padding:12px 0;">No practice documents added yet.</p>'
        : '<p style="color:var(--css-muted); padding:12px 0;">No documents specifically assigned to this practice. Documents set to <strong>All practices</strong> are available to them but appear under the All practices view.</p>';
      return;
    }

    // Group by folder
    const groups = {};
    docs.forEach((d, origIdx) => {
      const key = d.folder || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ doc: d, origIdx: db.practiceDocs.indexOf(d) });
    });

    const folderIcons = {
      'Referral Forms': '📋', 'Contracts and MOU': '📝',
      'Reports & supervisions': '📊', 'CQC Support': '🏛️',
      'Policies & Procedures': '🛡️'
    };

    el.innerHTML = '<table><thead><tr><th>Document</th><th>Folder</th><th>Visible to</th><th>Updated</th><th></th></tr></thead><tbody id="practiceDocTableBody"></tbody></table>';
    const tbody = el.querySelector('#practiceDocTableBody');

    // Render with folder group headers
    Object.entries(groups).forEach(([folder, items]) => {
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = `<td colspan="5" style="background:var(--css-bg); color:var(--css-muted); font-size:0.78rem; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:10px 12px 6px;">${folderIcons[folder] || '📁'} ${folder} <span style="font-weight:400;">(${items.length})</span></td>`;
      tbody.appendChild(headerRow);

      items.forEach(({ doc: d, origIdx }) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${d.name}</strong></td>
          <td><span class="notif-meta">${d.folder}</span></td>
          <td>${practiceForDoc(d, db)}</td>
          <td><span class="notif-meta">${formatDate(d.updated)}</span></td>
          <td><button class="btn small secondary" onclick="deletePracticeDoc(${origIdx})">Delete</button></td>`;
        tbody.appendChild(tr);
      });
    });
  }

  function renderPracticeDocSummary() {
    const db = cssLoadDB();
    const el = document.getElementById('practiceDocSummary');
    if (!el) return;
    const total = db.practiceDocs.length;
    const allCount = db.practiceDocs.filter(d => !d.practices || d.practices === 'all').length;

    let html = `<div style="margin-bottom:10px;"><strong>${total}</strong> <span class="notif-meta">total documents</span></div>`;
    html += `<div class="notif-meta" style="margin-bottom:8px;">📄 <strong>${allCount}</strong> visible to all practices</div>`;
    (db.users.practice || []).forEach(p => {
      const count = db.practiceDocs.filter(d => {
        const pr = d.practices;
        if (!pr || pr === 'all') return true;
        return Array.isArray(pr) && pr.includes(p.username);
      }).length;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--css-border); cursor:pointer;" onclick="adminDocPracticeTab('${p.username}')">
        <span>${p.org}</span>
        <span class="pill teal" style="font-size:0.75rem;">${count} docs</span>
      </div>`;
    });
    el.innerHTML = html;
  }

  window.addPracticeDoc = function () {
    const msg      = document.getElementById('pDocMsg');
    const name     = document.getElementById('pDocName').value.trim();
    const folder   = document.getElementById('pDocFolder').value;
    const practVal = document.getElementById('pDocPractice').value;
    const practices = practVal === 'all' ? 'all' : [practVal];

    if (!name) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Enter a document name.'; return; }
    const db = cssLoadDB();
    db.practiceDocs.unshift({ name, folder, updated: todayIso, practices });
    cssSaveDB(db);
    msg.style.color = 'var(--css-green)';
    msg.textContent = 'Document added.';
    document.getElementById('pDocName').value = '';
    renderAdminPracticeDocs(activePracticeDocTab);
    renderPracticeDocSummary();
    setTimeout(() => msg.textContent = '', 4000);
  };

  window.deletePracticeDoc = function (index) {
    if (!confirm('Remove this document?')) return;
    const db = cssLoadDB();
    db.practiceDocs.splice(index, 1);
    cssSaveDB(db);
    renderAdminPracticeDocs(activePracticeDocTab);
    renderPracticeDocSummary();
  };

  /* ===================== Invoices ===================== */
  function renderAdminInvoices() {
    const db = cssLoadDB();
    const tbody = document.getElementById('adminInvoiceTable');
    tbody.innerHTML = '';
    if (!db.invoices.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">No invoices yet.</td></tr>'; return; }
    db.invoices.forEach(i => {
      const canAct = i.status === 'Submitted';
      const actions = canAct
        ? `<button class="btn small" onclick="actOnInvoice('${i.id}','Paid')">Mark paid</button>
           <button class="btn small secondary" onclick="actOnInvoice('${i.id}','Declined')">Decline</button>
           <button class="btn small secondary" onclick="checkInvoiceWithAI('${i.id}')" title="Check with AI for over-claiming" style="margin-top:4px;">🤖 AI check</button>`
        : (i.status === 'Draft' ? '<span class="notif-meta">Awaiting staff submission</span>' : '');
      const shifts = i.shifts ? i.shifts.length : '—';
      const hrs    = i.totalHours != null ? (i.totalHours % 1 === 0 ? i.totalHours : Number(i.totalHours).toFixed(1)) + 'h' : '—';
      const extraPill = i.extraCost > 0
        ? `<span class="pill amber">⚠️ +${cssFmtMoney(i.extraCost)} extra</span><div style="font-size:0.78rem; color:var(--css-amber); margin-top:3px;">${i.extraDesc || ''}</div>`
        : '';
      const amountCell = i.extraCost > 0
        ? `${cssFmtMoney(i.amount)}<br>${extraPill}<div style="font-size:0.78rem; color:var(--css-muted); margin-top:2px; font-weight:600;">Grand total: ${cssFmtMoney((i.amount||0)+(i.extraCost||0))}</div>`
        : cssFmtMoney(i.amount);
      const grandTotal = '';
      const tr = document.createElement('tr');
      if (i.extraCost > 0) tr.style.background = 'rgba(245,158,11,0.06)';
      // Clicking the row (but not action buttons) opens the full invoice view
      tr.style.cursor = 'pointer';
      tr.onclick = (e) => { if (!e.target.closest('button')) viewInvoice(i.id); };
      tr.innerHTML = `<td>${i.id}</td><td>${i.name}</td><td>${i.period}</td><td>${shifts}</td><td>${hrs}</td><td>${amountCell}</td><td>${statusPill(i.status)}</td><td>${actions}</td>`;
      tbody.appendChild(tr);
    });
  }

  window.actOnInvoice = function (id, status) {
    const db = cssLoadDB();
    const i = db.invoices.find(x => x.id === id);
    if (!i) return;
    i.status = status;
    cssSaveDB(db);
    renderAdminInvoices();
    renderDashboard();
  };

  window.viewInvoice = function(id) {
    const db = cssLoadDB();
    const inv = (db.invoices || []).find(i => i.id === id);
    if (!inv) return;
    const staffUser = (db.users.staff || []).find(u => u.name === inv.name);
    const hrp = staffUser ? (db.hrProfiles || {})[staffUser.username] : null;
    document.getElementById('invModalContent').innerHTML = cssRenderInvoiceFull(inv, hrp);
    document.getElementById('invModalBackdrop').style.display = 'block';
    document.getElementById('invModal').style.display = 'flex';
  };
  window.closeInvoiceModal = function() {
    document.getElementById('invModalBackdrop').style.display = 'none';
    document.getElementById('invModal').style.display = 'none';
  };

  window.setAiApiKey = function () {
    const current = localStorage.getItem('css_ai_api_key') ? '(key saved — enter new to replace)' : '(none set)';
    const key = prompt(`Anthropic API key ${current}\n\nPaste your key below:`);
    if (key && key.trim()) {
      localStorage.setItem('css_ai_api_key', key.trim());
      alert('API key saved.');
    }
  };

  window.checkInvoiceWithAI = async function (id) {
    const apiKey = localStorage.getItem('css_ai_api_key');
    if (!apiKey) {
      const key = prompt('No API key found.\n\nPaste your Anthropic API key to enable AI invoice checking:');
      if (!key || !key.trim()) return;
      localStorage.setItem('css_ai_api_key', key.trim());
    }

    const panel  = document.getElementById('aiCheckPanel');
    const title  = document.getElementById('aiCheckTitle');
    const body   = document.getElementById('aiCheckBody');
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    title.textContent = `AI check — ${id}`;
    body.innerHTML = '<p style="color:var(--css-muted);">⏳ Analysing invoice against rota records…</p>';

    const db      = cssLoadDB();
    const invoice = db.invoices.find(i => i.id === id);
    if (!invoice) { body.innerHTML = '<p style="color:var(--css-red);">Invoice not found.</p>'; return; }

    // Reconstruct the scheduled rota for the claimed month
    let scheduledShifts = [];
    const monthKey = invoice.monthKey;
    if (monthKey) {
      const [yr, mo] = monthKey.split('-').map(Number);
      const firstDay  = `${monthKey}-01`;
      const lastDay   = toLocalIso(new Date(yr, mo, 0));
      const wStart    = weekStartIso(firstDay);
      const spanMs    = new Date(lastDay + 'T00:00:00') - new Date(wStart + 'T00:00:00');
      const spanWeeks = Math.ceil(spanMs / (7 * 86400000)) + 2;
      scheduledShifts = cssRotaForWeeks(wStart, spanWeeks, db.rotaPattern, db.oneOffShifts)
        .filter(r => r.staff === invoice.name && r.date >= firstDay && r.date <= lastDay)
        .map(r => ({ date: r.date, shift: r.shift, site: r.site }));
    }

    // Approved holidays in that period
    const holidays = (db.holidayRequests || [])
      .filter(h => h.name === invoice.name && h.status === 'Approved')
      .map(h => ({ from: h.from, to: h.to, shiftsOff: h.shiftsOff || [] }));

    // Bank holidays in that month
    const bankHols = monthKey
      ? [...UK_BANK_HOLIDAYS].filter(d => d.startsWith(monthKey))
      : [];

    const context = {
      invoice: {
        reference:    invoice.id,
        staff:        invoice.name,
        period:       invoice.period,
        claimedShifts:  invoice.shifts || [],
        claimedHours:   invoice.totalHours,
        claimedAmount:  invoice.amount
      },
      rotaRecord: {
        scheduledShifts,
        approvedHolidays: holidays,
        bankHolidays:     bankHols
      }
    };

    const prompt = `You are a payroll auditor for Clinical Support Solutions (CSS), a clinical pharmacy staffing service in England.

Your job is to verify this staff invoice against the rota records. Check for:
1. Shifts claimed that are NOT in the scheduled rota (possible fabrication or error)
2. Shifts claimed that fall on an approved holiday date or approved shift off (should be unclaimed)
3. Shifts claimed that fall on a UK bank holiday (should be unclaimed, unless there is a specific bank holiday working arrangement — flag for review if so)
4. Any mismatch between claimed hours and the scheduled shift times
5. Any other anomalies that could indicate over-claiming

Verdict: start with either ✅ PASS or 🚩 FLAG, then give a concise bullet-point breakdown. Keep it under 200 words and be direct.

Invoice and rota data:
${JSON.stringify(context, null, 2)}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key':    localStorage.getItem('css_ai_api_key'),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages:   [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) localStorage.removeItem('css_ai_api_key');
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data   = await res.json();
      const result = data.content?.[0]?.text || 'No response returned.';
      const isPass = result.trim().startsWith('✅');
      const colour = isPass ? 'var(--css-green)' : 'var(--css-amber)';

      body.innerHTML = `
        <div style="border-left:4px solid ${colour}; padding:12px 16px; background:var(--css-surface); border-radius:6px; white-space:pre-wrap; font-size:0.88rem; line-height:1.6;">
${result}
        </div>
        <p style="color:var(--css-muted); font-size:0.78rem; margin-top:10px;">Generated by Claude AI · ${new Date().toLocaleString('en-GB')} · Always use human judgement before acting on AI output.</p>`;
    } catch (e) {
      body.innerHTML = `<p style="color:var(--css-red);">❌ AI check failed: ${e.message}</p>
        <p style="color:var(--css-muted); font-size:0.85rem;">Check your API key is correct (click "Set API key" above) and that you have an active Anthropic account.</p>`;
    }
  };

  /* ===================== Service requests ===================== */
  const REQUEST_STATUSES = ['Submitted', 'Received', 'Scheduled', 'In progress', 'Completed', 'Cancelled'];

  function formatTs(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function renderRequestThread(r) {
    const msgs = r.messages || [];
    const bubbles = msgs.length ? msgs.map(m => {
      const isAdmin = m.from === 'admin';
      return `<div style="display:flex; flex-direction:column; align-items:${isAdmin ? 'flex-end' : 'flex-start'}; margin-bottom:8px;">
        <div style="max-width:75%; background:${isAdmin ? 'var(--css-teal)' : 'var(--css-bg)'}; color:${isAdmin ? '#fff' : 'inherit'}; border:1px solid ${isAdmin ? 'var(--css-teal)' : 'var(--css-border)'}; border-radius:12px; padding:8px 12px; font-size:0.88rem;">
          ${m.text}
        </div>
        <div style="font-size:0.75rem; color:var(--css-muted); margin-top:3px;">${m.author} · ${formatTs(m.ts)}</div>
      </div>`;
    }).join('') : '<div style="color:var(--css-muted); font-size:0.85rem; margin-bottom:10px;">No messages yet — send the first reply below.</div>';

    return `<td colspan="8" style="padding:0;">
      <div style="border-top:2px solid var(--css-teal); background:var(--css-surface); padding:16px 20px;">
        <div style="max-height:280px; overflow-y:auto; margin-bottom:12px;" id="thread-msgs-${r.id}">${bubbles}</div>
        <div style="display:flex; gap:8px; align-items:flex-end;">
          <textarea id="thread-input-${r.id}" rows="2" placeholder="Type your reply to ${r.org}…"
            style="flex:1; resize:vertical; min-height:48px; padding:8px 10px; border:1px solid var(--css-border); border-radius:6px; font-size:0.88rem; font-family:inherit; background:var(--css-bg);"></textarea>
          <button class="btn small" onclick="adminReplyRequest('${r.id}')">Send</button>
        </div>
        ${r.note ? `<div style="margin-top:10px; font-size:0.82rem; color:var(--css-muted);">📝 <strong>Original note:</strong> ${r.note}</div>` : ''}
      </div>
    </td>`;
  }

  function renderAdminRequests() {
    const db = cssLoadDB();
    const tbody = document.getElementById('adminRequestsTable');
    tbody.innerHTML = '';
    if (!db.serviceRequests.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">No service requests yet.</td></tr>'; return;
    }
    db.serviceRequests.forEach(r => {
      const opts = REQUEST_STATUSES.map(s => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('');
      const msgs = r.messages || [];
      const practiceReplies = msgs.filter(m => m.from === 'practice').length;
      const seen = cssGetSeenNotifs('admin');
      const unreadCount = msgs.filter(m => m.from === 'practice' && !seen.has(`admin-msg-${r.id}-${m.ts}`)).length;
      const badge = unreadCount ? `<span style="display:inline-flex;align-items:center;justify-content:center;background:var(--css-amber);color:#fff;border-radius:50%;width:18px;height:18px;font-size:0.7rem;font-weight:700;margin-left:4px;">${unreadCount}</span>` : '';
      const threadCount = msgs.length ? `<span class="notif-meta">(${msgs.length})</span>` : '';

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.org}</td>
        <td>${r.service || '—'}</td>
        <td>${r.patients || '—'}</td>
        <td>${formatDate(r.submitted)}</td>
        <td>${statusPill(r.status)}</td>
        <td><select onclick="event.stopPropagation()" onchange="updateRequestStatus('${r.id}', this.value)">${opts}</select></td>
        <td>
          <button class="btn small" onclick="event.stopPropagation(); toggleRequestThread('${r.id}')">
            💬 ${threadCount}${badge}
          </button>
        </td>`;
      tr.addEventListener('click', () => toggleRequestThread(r.id));

      const detailTr = document.createElement('tr');
      detailTr.id = `req-detail-${r.id}`;
      detailTr.style.display = 'none';
      detailTr.innerHTML = renderRequestThread(r);

      tbody.appendChild(tr);
      tbody.appendChild(detailTr);
    });
  }

  window.toggleRequestThread = function (id) {
    // Mark practice messages as seen when thread is opened
    const db = cssLoadDB();
    const r = db.serviceRequests.find(x => x.id === id);
    if (r) {
      (r.messages || []).filter(m => m.from === 'practice').forEach(m => cssMarkSeenNotif('admin', `admin-msg-${id}-${m.ts}`));
    }
    const row = document.getElementById(`req-detail-${id}`);
    if (!row) return;
    const isOpen = row.style.display !== 'none';
    // Close all others
    document.querySelectorAll('[id^="req-detail-"]').forEach(el => el.style.display = 'none');
    if (!isOpen) {
      row.style.display = '';
      // Scroll to bottom of thread
      const msgsDiv = row.querySelector(`#thread-msgs-${id}`);
      if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
    }
    refreshBell();
  };

  window.adminReplyRequest = function (id) {
    const input = document.getElementById(`thread-input-${id}`);
    const text = (input ? input.value : '').trim();
    if (!text) return;

    const db = cssLoadDB();
    const r = db.serviceRequests.find(x => x.id === id);
    if (!r) return;
    if (!r.messages) r.messages = [];

    const ts = new Date().toISOString();
    r.messages.push({ from: 'admin', author: 'CSS Admin', text, ts });
    cssSaveDB(db);

    // Re-render the request table and reopen thread
    renderAdminRequests();
    // Reopen the thread
    const row = document.getElementById(`req-detail-${id}`);
    if (row) {
      row.style.display = '';
      const msgsDiv = row.querySelector(`#thread-msgs-${id}`);
      if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
    }
    refreshBell();
  };

  window.updateRequestStatus = function (id, status) {
    const db = cssLoadDB();
    const r = db.serviceRequests.find(x => x.id === id);
    if (!r) return;
    r.status = status;
    cssSaveDB(db);
    renderAdminRequests();
    renderDashboard();
    refreshBell();
  };

  /* ===================== Practice / PCN accounts ===================== */
  let editingPracticeUsername = null;

  function renderPracticeAccounts() {
    const db   = cssLoadDB();
    const list = document.getElementById('practiceAccountList');
    if (!list) return;
    list.innerHTML = '';
    if (!db.users.practice.length) {
      list.innerHTML = '<li class="empty-msg">No practice accounts yet.</li>';
      return;
    }
    db.users.practice.forEach(p => {
      const typeColour = p.type === 'PCN' ? 'teal' : 'grey';
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="notif-dot green"></span>
        <div style="flex:1;">
          <div><strong>${p.org}</strong> <span class="pill ${typeColour}" style="font-size:0.72rem;">${p.type || 'GP Practice'}</span></div>
          <div class="notif-meta">Contact: ${p.name} · @${p.username}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn small secondary" onclick="editPracticeAccount('${p.username}')">Edit</button>
          <button class="btn small secondary" onclick="deletePracticeAccount('${p.username}')">Remove</button>
        </div>`;
      list.appendChild(li);
    });
  }

  window.pmSuggestUsername = function () {
    if (editingPracticeUsername) return;
    const org = document.getElementById('pmOrgName').value.trim();
    if (org) {
      document.getElementById('pmUsername').value =
        org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
  };

  window.savePracticeAccount = async function () {
    const msg      = document.getElementById('pmMsg');
    const orgName  = document.getElementById('pmOrgName').value.trim();
    const type     = document.getElementById('pmType').value;
    const contact  = document.getElementById('pmContactName').value.trim();
    const email    = document.getElementById('pmEmail').value.trim();
    const username = document.getElementById('pmUsername').value.trim().toLowerCase();
    const password = document.getElementById('pmPassword').value.trim();

    if (!orgName)  { msg.style.color = 'var(--css-red)'; msg.textContent = 'Organisation name is required.'; return; }
    if (!username) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Username is required.'; return; }
    if (!password && !editingPracticeUsername) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Password is required.'; return; }

    const db = cssLoadDB();
    const existing = db.users.practice.find(p => p.username === username);

    if (editingPracticeUsername) {
      // Editing
      const p = db.users.practice.find(p => p.username === editingPracticeUsername);
      if (!p) return;
      p.org  = orgName;
      p.type = type;
      p.name = contact;
      if (password) p.password = password;
      msg.style.color = 'var(--css-green)';
      msg.textContent = 'Account updated.';
    } else {
      if (existing) { msg.style.color = 'var(--css-red)'; msg.textContent = 'That username is already taken.'; return; }
      const allUsers = [...db.users.admin, ...db.users.staff, ...db.users.practice];
      if (allUsers.find(u => u.username === username)) {
        msg.style.color = 'var(--css-red)'; msg.textContent = 'Username already in use.'; return;
      }
      db.users.practice.push({ username, password, name: contact, org: orgName, type, email, contract: {} });
      msg.style.color = 'var(--css-green)';
      msg.textContent = `Account created — username: ${username}`;
      if (email) {
        msg.textContent += ' Sending welcome email…';
        await sendWelcomeEmail(email, contact || orgName, username, password, 'Practice Portal');
        msg.textContent = `Account created. Welcome email sent to ${email}.`;
      }
    }

    cssSaveDB(db);
    renderPracticeAccounts();
    populateContractOrgSelect();
    populateSmSiteDropdown();

    // Reset form
    editingPracticeUsername = null;
    document.getElementById('pmFormTitle').textContent = 'Add new practice / PCN';
    document.getElementById('pmSaveBtn').textContent   = 'Create account';
    document.getElementById('pmCancelBtn').style.display = 'none';
    document.getElementById('pmOrgName').value     = '';
    document.getElementById('pmContactName').value = '';
    document.getElementById('pmEmail').value       = '';
    document.getElementById('pmUsername').value    = '';
    document.getElementById('pmPassword').value    = '';
    setTimeout(() => msg.textContent = '', 6000);
  };

  window.editPracticeAccount = function (username) {
    const db = cssLoadDB();
    const p = db.users.practice.find(x => x.username === username);
    if (!p) return;
    editingPracticeUsername = username;
    document.getElementById('pmFormTitle').textContent   = `Edit — ${p.org}`;
    document.getElementById('pmSaveBtn').textContent     = 'Save changes';
    document.getElementById('pmCancelBtn').style.display = 'inline-flex';
    document.getElementById('pmOrgName').value     = p.org;
    document.getElementById('pmType').value        = p.type || 'GP Practice';
    document.getElementById('pmContactName').value = p.name || '';
    document.getElementById('pmUsername').value    = p.username;
    document.getElementById('pmPassword').value    = '';
    document.getElementById('pmMsg').textContent   = '';
    document.getElementById('pmOrgName').focus();
  };

  window.cancelPracticeEdit = function () {
    editingPracticeUsername = null;
    document.getElementById('pmFormTitle').textContent   = 'Add new practice / PCN';
    document.getElementById('pmSaveBtn').textContent     = 'Create account';
    document.getElementById('pmCancelBtn').style.display = 'none';
    document.getElementById('pmOrgName').value     = '';
    document.getElementById('pmContactName').value = '';
    document.getElementById('pmUsername').value    = '';
    document.getElementById('pmPassword').value    = '';
    document.getElementById('pmMsg').textContent   = '';
  };

  window.deletePracticeAccount = function (username) {
    const db = cssLoadDB();
    const p = db.users.practice.find(x => x.username === username);
    if (!p) return;
    if (!confirm(`Remove ${p.org}'s account? They will no longer be able to sign in to the practice portal.`)) return;
    db.users.practice = db.users.practice.filter(x => x.username !== username);
    cssSaveDB(db);
    renderPracticeAccounts();
    populateContractOrgSelect();
    populateSmSiteDropdown();
  };

  window.switchAcctTab = function (tab) {
    const staffTab    = document.getElementById('acctStaffTab');
    const practiceTab = document.getElementById('acctPracticeTab');
    const adminTab    = document.getElementById('acctAdminTab');
    const btnStaff    = document.getElementById('acctTabStaff');
    const btnPractice = document.getElementById('acctTabPractice');
    const btnAdmin    = document.getElementById('acctTabAdmin');
    staffTab.style.display    = tab === 'staff'    ? '' : 'none';
    practiceTab.style.display = tab === 'practice' ? '' : 'none';
    if (adminTab) adminTab.style.display = tab === 'admin' ? '' : 'none';
    btnStaff.classList.toggle('secondary',    tab !== 'staff');
    btnPractice.classList.toggle('secondary', tab !== 'practice');
    if (btnAdmin) btnAdmin.classList.toggle('secondary', tab !== 'admin');
    if (tab === 'admin') renderAdminAccounts();
  };

  renderPracticeAccounts();

  /* ===================== Practice contracts ===================== */
  function populateContractOrgSelect() {
    const db = cssLoadDB();
    const sel = document.getElementById('contractOrgSelect');
    sel.innerHTML = '<option value="">Choose…</option>' + db.users.practice.map(p => `<option value="${p.username}">${p.org}</option>`).join('');
  }

  window.loadContractForm = function () {
    const db = cssLoadDB();
    const username = document.getElementById('contractOrgSelect').value;
    const panel = document.getElementById('contractEditPanel');
    if (!username) { panel.style.display = 'none'; return; }
    const p = db.users.practice.find(x => x.username === username);
    if (!p) { panel.style.display = 'none'; return; }
    const c = p.contract || {};
    document.getElementById('cPharmacists').value = c.pharmacists || 0;
    document.getElementById('cTechs').value = c.techs || 0;
    document.getElementById('cHours').value = c.hoursPerWeek || 0;
    document.getElementById('cSessions').value = c.sessionsPerWeek || 0;
    document.getElementById('cFrom').value = c.validFrom || '';
    document.getElementById('cTo').value = c.validTo || '';
    document.getElementById('cFunding').value = c.fundingModel || '';
    document.getElementById('cNotes').value = c.notes || '';
    panel.style.display = 'block';
  };

  window.saveContract = function () {
    const msg = document.getElementById('contractMsg');
    const username = document.getElementById('contractOrgSelect').value;
    if (!username) return;
    const db = cssLoadDB();
    const p = db.users.practice.find(x => x.username === username);
    if (!p) return;
    p.contract = {
      pharmacists: parseInt(document.getElementById('cPharmacists').value, 10) || 0,
      techs: parseInt(document.getElementById('cTechs').value, 10) || 0,
      hoursPerWeek: parseInt(document.getElementById('cHours').value, 10) || 0,
      sessionsPerWeek: parseInt(document.getElementById('cSessions').value, 10) || 0,
      validFrom: document.getElementById('cFrom').value,
      validTo: document.getElementById('cTo').value,
      fundingModel: document.getElementById('cFunding').value.trim(),
      notes: document.getElementById('cNotes').value.trim()
    };
    cssSaveDB(db);
    msg.style.color = 'var(--css-green)';
    msg.textContent = `Contract updated for ${p.org}.`;
    setTimeout(() => msg.textContent = '', 4000);
  };

  /* ===================== Staff accounts ===================== */
  let editingStaffUsername = null;

  function populateSmSiteDropdown() {
    const db  = cssLoadDB();
    const sel = document.getElementById('smSite');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = db.users.practice.map(p => `<option value="${p.org}">${p.org}</option>`).join('');
    if (current) sel.value = current;
  }
  populateSmSiteDropdown();

  function renderStaffAccounts() {
    const db = cssLoadDB();
    const list = document.getElementById('staffAccountList');
    list.innerHTML = '';
    if (!db.users.staff.length) {
      list.innerHTML = '<li class="empty-msg">No staff accounts yet.</li>';
      return;
    }
    db.users.staff.forEach(u => {
      const hasProfile = !!(db.hrProfiles && db.hrProfiles[u.username] && db.hrProfiles[u.username].startDate);
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="notif-dot ${hasProfile ? 'green' : 'amber'}"></span>
        <div style="flex:1;">
          <div><strong>${u.name}</strong> <span class="pill grey" style="font-size:0.72rem;">${u.role}</span> ${hasProfile ? '' : '<span class="pill amber" style="font-size:0.72rem;">HR details needed</span>'}</div>
          <div class="notif-meta">${u.site} · @${u.username}</div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn small" onclick="editHrDetails('${u.username}')">HR details</button>
          <button class="btn small secondary" onclick="editStaffMember('${u.username}')">Edit login</button>
          <button class="btn small secondary" onclick="deleteStaffMember('${u.username}')">Remove</button>
        </div>`;
      list.appendChild(li);
    });
  }

  /* ---- HR details ---- */
  let hrDetailUsername = null;

  window.editHrDetails = function (username) {
    const db = cssLoadDB();
    const u = db.users.staff.find(x => x.username === username);
    if (!u) return;
    hrDetailUsername = username;
    const p = (db.hrProfiles || {})[username] || {};

    document.getElementById('hrPanelTitle').textContent = `HR details — ${u.name}`;
    document.getElementById('hrDob').value            = p.dob || '';
    document.getElementById('hrGender').value         = p.gender || '';
    document.getElementById('hrMobile').value         = p.mobile || '';
    document.getElementById('hrHomeTel').value        = p.homeTelephone || '';
    document.getElementById('hrEmail').value           = p.email || p.personalEmail || p.officeEmail || '';
    document.getElementById('hrAddress').value        = p.homeAddress || '';
    document.getElementById('hrEmgName').value        = p.emergencyName || '';
    document.getElementById('hrEmgRel').value         = p.emergencyRelationship || '';
    document.getElementById('hrEmgPhone').value       = p.emergencyPhone || '';
    document.getElementById('hrStartDate').value      = p.startDate || '';
    document.getElementById('hrReviewDate').value     = p.reviewDate || '';
    document.getElementById('hrLeavingDate').value    = p.leavingDate || '';
    document.getElementById('hrStatus').value         = p.status || 'Active';
    document.getElementById('hrContractType').value   = p.contractType || 'PAYE';
    document.getElementById('hrHours').value          = p.hoursPerWeek || '';
    document.getElementById('hrHourlyRate').value     = p.hourlyRate || '';
    document.getElementById('hrNiNumber').value       = p.niNumber || '';
    document.getElementById('hrEmployeeId').value     = p.employeeId || '';
    // Radio for prescriber type
    const prescriberVal = p.prescriberType || 'Non Prescriber';
    document.querySelectorAll('input[name="hrPrescriberType"]').forEach(r => { r.checked = r.value === prescriberVal; });
    document.getElementById('hrSmartcard').value      = p.smartcardNumber || '';
    document.getElementById('hrSystemOne').checked    = !!p.systemOne;
    document.getElementById('hrEmis').checked         = !!p.emis;
    document.getElementById('hrGphcNumber').value     = p.gphcNumber || '';
    document.getElementById('hrGphcExpiry').value     = p.gphcExpiry || '';
    document.getElementById('hrRtwDoc').value         = p.rightToWorkDoc || 'British passport';
    document.getElementById('hrRtwExpiry').value      = p.rightToWorkExpiry || '';
    document.getElementById('hrDbsCert').value        = p.dbsCertNumber || '';
    document.getElementById('hrDbsDate').value        = p.dbsIssueDate || '';
    document.getElementById('hrAutoDbs').checked      = !!p.autoDbs;
    document.getElementById('hrCompanyName').value      = p.companyName || '';
    document.getElementById('hrCompanyRegNumber').value = p.companyRegNumber || '';
    document.getElementById('hrVatNumber').value        = p.vatNumber || '';
    document.getElementById('hrBankName').value         = p.bankName || '';
    document.getElementById('hrCompanyAddress').value   = p.companyAddress || '';
    document.getElementById('hrSortCode').value         = p.sortCode || '';
    document.getElementById('hrAccountNumber').value    = p.accountNumber || '';
    document.getElementById('hrNotes').value          = p.notes || '';
    document.getElementById('hrMsg').textContent      = '';

    document.getElementById('smHrPanel').style.display = 'block';
    document.getElementById('smHrPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.closeHrPanel = function () {
    hrDetailUsername = null;
    document.getElementById('smHrPanel').style.display = 'none';
  };

  window.saveHrDetails = function () {
    const msg = document.getElementById('hrMsg');
    if (!hrDetailUsername) return;
    const db = cssLoadDB();
    if (!db.hrProfiles) db.hrProfiles = {};
    const prescriberRadio = document.querySelector('input[name="hrPrescriberType"]:checked');
    db.hrProfiles[hrDetailUsername] = {
      dob:                   document.getElementById('hrDob').value,
      gender:                document.getElementById('hrGender').value,
      mobile:                document.getElementById('hrMobile').value.trim(),
      homeTelephone:         document.getElementById('hrHomeTel').value.trim(),
      email:                 document.getElementById('hrEmail').value.trim(),
      homeAddress:           document.getElementById('hrAddress').value.trim(),
      emergencyName:         document.getElementById('hrEmgName').value.trim(),
      emergencyRelationship: document.getElementById('hrEmgRel').value.trim(),
      emergencyPhone:        document.getElementById('hrEmgPhone').value.trim(),
      startDate:             document.getElementById('hrStartDate').value,
      reviewDate:            document.getElementById('hrReviewDate').value,
      leavingDate:           document.getElementById('hrLeavingDate').value,
      status:                document.getElementById('hrStatus').value,
      contractType:          document.getElementById('hrContractType').value,
      hoursPerWeek:          parseFloat(document.getElementById('hrHours').value) || 0,
      hourlyRate:            parseFloat(document.getElementById('hrHourlyRate').value) || 0,
      niNumber:              document.getElementById('hrNiNumber').value.trim(),
      employeeId:            document.getElementById('hrEmployeeId').value.trim(),
      prescriberType:        prescriberRadio ? prescriberRadio.value : 'Non Prescriber',
      smartcardNumber:       document.getElementById('hrSmartcard').value.trim(),
      systemOne:             document.getElementById('hrSystemOne').checked,
      emis:                  document.getElementById('hrEmis').checked,
      gphcNumber:            document.getElementById('hrGphcNumber').value.trim(),
      gphcExpiry:            document.getElementById('hrGphcExpiry').value,
      rightToWorkDoc:        document.getElementById('hrRtwDoc').value,
      rightToWorkExpiry:     document.getElementById('hrRtwExpiry').value,
      dbsCertNumber:         document.getElementById('hrDbsCert').value.trim(),
      dbsIssueDate:          document.getElementById('hrDbsDate').value,
      autoDbs:               document.getElementById('hrAutoDbs').checked,
      companyName:           document.getElementById('hrCompanyName').value.trim(),
      companyRegNumber:      document.getElementById('hrCompanyRegNumber').value.trim(),
      vatNumber:             document.getElementById('hrVatNumber').value.trim(),
      bankName:              document.getElementById('hrBankName').value.trim(),
      companyAddress:        document.getElementById('hrCompanyAddress').value.trim(),
      sortCode:              document.getElementById('hrSortCode').value.trim(),
      accountNumber:         document.getElementById('hrAccountNumber').value.trim(),
      notes:                 document.getElementById('hrNotes').value.trim()
    };
    cssSaveDB(db);
    msg.style.color = 'var(--css-green)';
    msg.textContent = 'HR details saved.';
    renderStaffAccounts();
    setTimeout(() => msg.textContent = '', 5000);
  };

  // Suggest a username from the full name (first initial + surname, lowercase)
  window.smSuggestUsername = function () {
    if (editingStaffUsername) return; // don't override when editing
    const name = document.getElementById('smFullName').value.trim();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      document.getElementById('smUsername').value =
        (parts[0][0] + '.' + parts[parts.length - 1]).toLowerCase().replace(/[^a-z.]/g, '');
    }
  };

  window.saveStaffMember = async function () {
    const msg = document.getElementById('smMsg');
    const name = document.getElementById('smFullName').value.trim();
    const email = document.getElementById('smEmail').value.trim();
    const username = document.getElementById('smUsername').value.trim().toLowerCase();
    const password = document.getElementById('smPassword').value.trim();
    const role = document.getElementById('smRole').value;
    const site = document.getElementById('smSite').value;

    if (!name) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Enter the staff member\'s full name.'; return; }
    if (!username) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Enter a username.'; return; }
    if (!password) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Set a temporary password.'; return; }

    const db = cssLoadDB();

    if (editingStaffUsername) {
      // Update existing
      const existing = db.users.staff.find(u => u.username === editingStaffUsername);
      if (!existing) return;
      // If username changed, check it isn't taken by another user
      if (username !== editingStaffUsername && db.users.staff.some(u => u.username === username)) {
        msg.style.color = 'var(--css-red)'; msg.textContent = 'That username is already taken.'; return;
      }
      Object.assign(existing, { name, username, password, role, site });
      cssSaveDB(db);
      msg.style.color = 'var(--css-green)';
      msg.textContent = `${name}'s account updated.`;
      cancelStaffEdit();
    } else {
      // New account — username must be unique
      if (db.users.staff.some(u => u.username === username)) {
        msg.style.color = 'var(--css-red)'; msg.textContent = 'That username is already taken — try a different one.'; return;
      }
      db.users.staff.push({ username, password, name, role, site });
      cssSaveDB(db);
      msg.style.color = 'var(--css-green)';
      msg.textContent = `Account created. ${name} can now sign in with @${username}.`;
      if (email) {
        msg.textContent += ' Sending welcome email…';
        await sendWelcomeEmail(email, name, username, password, 'Staff Portal');
        msg.textContent = `Account created. ${name} can now sign in with @${username}. Welcome email sent to ${email}.`;
      }
      document.getElementById('smFullName').value = '';
      document.getElementById('smEmail').value    = '';
      document.getElementById('smUsername').value = '';
      document.getElementById('smPassword').value = '';
    }

    renderStaffAccounts();
    // Refresh any staff-dependent dropdowns
    populateTrainStaffSelect();
    initRotaTabs();
    populateOneOffStaffSelect();
    adminInitStaffDocDropdowns();
    setTimeout(() => { const m = document.getElementById('smMsg'); if (m) m.textContent = ''; }, 5000);
  };

  window.editStaffMember = function (username) {
    const db = cssLoadDB();
    const u = db.users.staff.find(x => x.username === username);
    if (!u) return;
    editingStaffUsername = username;
    document.getElementById('smFullName').value = u.name;
    document.getElementById('smUsername').value = u.username;
    document.getElementById('smPassword').value = u.password;
    document.getElementById('smRole').value = u.role;
    document.getElementById('smSite').value = u.site;
    document.getElementById('staffFormTitle').textContent = `Editing ${u.name}`;
    document.getElementById('smSaveBtn').textContent = 'Save changes';
    document.getElementById('smCancelBtn').style.display = 'inline-block';
  };

  window.cancelStaffEdit = function () {
    editingStaffUsername = null;
    document.getElementById('smFullName').value = '';
    document.getElementById('smUsername').value = '';
    document.getElementById('smPassword').value = '';
    document.getElementById('staffFormTitle').textContent = 'Add new staff member';
    document.getElementById('smSaveBtn').textContent = 'Create account';
    document.getElementById('smCancelBtn').style.display = 'none';
  };

  window.deleteStaffMember = function (username) {
    const db = cssLoadDB();
    const u = db.users.staff.find(x => x.username === username);
    if (!u) return;
    if (!confirm(`Remove ${u.name}'s account? They will no longer be able to sign in to the staff portal.`)) return;
    db.users.staff = db.users.staff.filter(x => x.username !== username);
    cssSaveDB(db);
    renderStaffAccounts();
    populateTrainStaffSelect();
    initRotaTabs();
    populateOneOffStaffSelect();
    adminInitStaffDocDropdowns();
  };

  /* ===================== Nav ===================== */
  window.showSection = function (name) {
    const allowed = TIER_SECTIONS[adminTier];
    if (allowed && !allowed.includes(name)) return; // blocked for this tier
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-section]').forEach(b => b.classList.remove('active'));
    const sec = document.getElementById('sec-' + name);
    if (sec) sec.classList.add('active');
    const btn = document.querySelector(`.nav-item[data-section="${name}"]`);
    if (btn) btn.classList.add('active');
    if (name === 'ledger')     renderLedger();
    if (name === 'cqcreports') initCQCReportManager();
  };

  window.logout = function () {
    cssClearSession();
    window.location.href = 'index.html';
  };

  // --- Notification bell ---
  function refreshBell() {
    const fresh = cssLoadDB();
    const today = new Date().toISOString().slice(0, 10);
    const soon  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const notifs = [];

    // Pending holiday requests
    (fresh.holidayRequests || [])
      .filter(h => h.status === 'Pending')
      .forEach(h => notifs.push({
        id:      `admin-holiday-${h.id}`,
        icon:    '🌴',
        title:   'Holiday request pending',
        text:    `${h.name} — ${h.from} to ${h.to}`,
        section: 'holiday'
      }));


    // Submitted invoices
    (fresh.invoices || [])
      .filter(i => i.status === 'Submitted')
      .forEach(i => notifs.push({
        id:      `admin-invoice-${i.id}`,
        icon:    '💷',
        title:   'Invoice awaiting review',
        text:    `${i.id} — ${i.name}`,
        section: 'invoices'
      }));

    // Unread practice replies on service requests
    const seenForMsgs = cssGetSeenNotifs('admin');
    (fresh.serviceRequests || []).forEach(r => {
      (r.messages || []).filter(m => m.from === 'practice').forEach(m => {
        const nid = `admin-msg-${r.id}-${m.ts}`;
        if (!seenForMsgs.has(nid)) {
          notifs.push({
            id:      nid,
            icon:    '💬',
            title:   'Reply from practice',
            text:    `${r.org} · ${r.id}`,
            section: 'requests'
          });
        }
      });
    });

    // Service requests needing attention (anything not completed or cancelled)
    const DONE_STATUSES = ['Completed', 'Cancelled'];
    (fresh.serviceRequests || [])
      .filter(r => !DONE_STATUSES.includes(r.status))
      .forEach(r => {
        const titleMap = {
          'Submitted':   'New service request submitted',
          'Received':    'Service request received',
          'Pending':     'Service request pending',
          'In progress': 'Service request in progress',
          'Scheduled':   'Service request scheduled',
        };
        notifs.push({
          id:      `admin-request-${r.id}`,
          icon:    '📥',
          title:   titleMap[r.status] || 'Service request needs attention',
          text:    `${r.org} — ${r.service || r.type || ''}`,
          section: 'requests'
        });
      });

    // Pending certificate approvals
    (fresh.staffCertificates || [])
      .filter(c => c.status === 'Pending')
      .forEach(c => notifs.push({
        id:      `admin-cert-pending-${c.id}`,
        icon:    '📋',
        title:   'Certificate awaiting approval',
        text:    `${c.staffName} — ${c.title}`,
        section: 'training'
      }));

    // Certificates expiring within 30 days or already overdue — two-stage reminders
    const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const fourteenDays = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    (fresh.staffCertificates || [])
      .filter(c => c.status === 'Approved' && c.dueDate && c.dueDate <= thirtyDays && !c.cleared)
      .forEach(c => {
        const overdue = c.dueDate < today;
        const urgent  = !overdue && c.dueDate <= fourteenDays;
        if (overdue) {
          notifs.push({ id: `admin-cert-expired-${c.id}`, icon: '🔴', title: 'Certificate expired', text: `${c.staffName} — ${c.title}`, section: 'renewals' });
        } else if (urgent) {
          // 14-day reminder (shown in addition to the 30-day one once it reaches that window)
          notifs.push({ id: `admin-cert-due30-${c.id}`, icon: '⚠️', title: 'Certificate expiring within 30 days', text: `${c.staffName} — ${c.title}`, section: 'renewals' });
          notifs.push({ id: `admin-cert-due14-${c.id}`, icon: '🔔', title: 'Reminder: certificate expiring in 14 days', text: `${c.staffName} — ${c.title} — action needed`, section: 'renewals' });
        } else {
          notifs.push({ id: `admin-cert-due30-${c.id}`, icon: '⚠️', title: 'Certificate expiring within 30 days', text: `${c.staffName} — ${c.title}`, section: 'renewals' });
        }
      });

    // Recently added staff documents (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    (fresh.staffDocs || [])
      .filter(d => d.updated && d.updated >= sevenDaysAgo)
      .forEach(d => notifs.push({
        id:      `admin-staffdoc-${d.updated}-${(d.name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30)}`,
        icon:    '📄',
        title:   'Staff document published',
        text:    d.name,
        section: 'documents'
      }));

    // Recently added practice / PCN documents (last 7 days)
    (fresh.practiceDocs || [])
      .filter(d => d.updated && d.updated >= sevenDaysAgo)
      .forEach(d => notifs.push({
        id:      `admin-pracdoc-${d.updated}-${(d.name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30)}`,
        icon:    '📄',
        title:   'Practice document published',
        text:    d.name,
        section: 'documents'
      }));

    // Staff without HR profile
    (fresh.users.staff || []).forEach(u => {
      const p = (fresh.hrProfiles || {})[u.username];
      if (!p || !p.startDate) {
        notifs.push({
          id:      `admin-noprofile-${u.username}`,
          icon:    '👤',
          title:   'HR profile missing',
          text:    u.name,
          section: 'staff-mgmt'
        });
      }
    });

    window._bellRefresh = refreshBell;
    cssRenderBell('admin', notifs);
  }

  /* ===================== Our services ===================== */
  let editingServiceId = null;
  let activeServiceFilter = 'all';

  function adminInitServiceDropdowns() {
    const db = cssLoadDB();
    const viewSel = document.getElementById('svcViewSelect');
    const addSel  = document.getElementById('svcPractice');

    viewSel.innerHTML = '<option value="all">All practices</option>';
    addSel.innerHTML  = '<option value="all">All practices &amp; PCNs</option>';

    (db.users.practice || []).forEach(p => {
      viewSel.innerHTML += `<option value="${p.username}">${p.org}</option>`;
      addSel.innerHTML  += `<option value="${p.username}">${p.org}</option>`;
    });

    renderServiceSummary();
    renderAdminServices(activeServiceFilter);
  }

  window.adminServiceFilter = function(filter) {
    activeServiceFilter = filter;
    const viewSel = document.getElementById('svcViewSelect');
    if (viewSel) viewSel.value = filter;
    renderAdminServices(filter);
  };

  function practicesForService(svc, db) {
    const p = svc.practices;
    if (!p || p === 'all') return '<span class="pill grey" style="font-size:0.72rem;">All practices</span>';
    if (Array.isArray(p)) {
      return p.map(u => {
        const pr = (db.users.practice || []).find(x => x.username === u);
        return `<span class="pill teal" style="font-size:0.72rem;">${pr ? pr.org : u}</span>`;
      }).join(' ');
    }
    return '';
  }

  function renderAdminServices(filter) {
    filter = filter || 'all';
    const db = cssLoadDB();
    const list = document.getElementById('adminServiceList');
    const countEl = document.getElementById('svcCount');
    if (!list) return;

    let services = db.services || [];
    if (filter !== 'all') {
      // Exclusive: only services explicitly assigned to this practice
      services = services.filter(s => {
        const p = s.practices;
        return Array.isArray(p) && p.includes(filter);
      });
    }

    if (countEl) countEl.textContent = filter === 'all'
      ? `${services.length} service${services.length !== 1 ? 's' : ''}`
      : `${services.length} for this practice`;

    if (!services.length) {
      list.innerHTML = filter === 'all'
        ? '<p class="empty-msg">No services yet. Add one using the form.</p>'
        : '<p class="empty-msg">No services specifically assigned to this practice. (Services set to "All practices" always show — select "All practices" above to see them.)</p>';
      return;
    }

    list.innerHTML = services.map(s => `
      <div class="card" style="margin-bottom:10px; display:flex; gap:12px; align-items:flex-start;">
        <div style="font-size:2rem; line-height:1; flex:0 0 auto; padding-top:2px;">${s.icon || '🩺'}</div>
        <div style="flex:1; min-width:0;">
          <strong>${s.name}</strong>
          <div style="margin-top:3px;">${practicesForService(s, db)}</div>
          <div style="color:var(--css-muted); font-size:0.82rem; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${(s.summary || '').split('—')[0].trim()}</div>
        </div>
        <div style="display:flex; gap:6px; flex:0 0 auto;">
          <button class="btn small" onclick="editService(${s.id})">Edit</button>
          <button class="btn small secondary" onclick="deleteService(${s.id})">Delete</button>
        </div>
      </div>`).join('');
  }

  function renderServiceSummary() {
    const db = cssLoadDB();
    const el = document.getElementById('serviceSummary');
    if (!el) return;
    const practices = db.users.practice || [];
    const services  = db.services || [];

    if (!practices.length) { el.innerHTML = '<p class="empty-msg">No practices set up yet.</p>'; return; }

    el.innerHTML = practices.map(p => {
      // Count services visible to this practice (all + specific)
      const count = services.filter(s => {
        const pr = s.practices;
        if (!pr || pr === 'all') return true;
        return Array.isArray(pr) && pr.includes(p.username);
      }).length;
      const specificCount = services.filter(s => {
        const pr = s.practices;
        return Array.isArray(pr) && pr.includes(p.username);
      }).length;
      return `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; margin-bottom:8px; cursor:pointer;"
             onclick="adminServiceFilter('${p.username}')">
          <div>
            <strong>${p.org}</strong>
            <div class="notif-meta">${p.type}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.4rem; font-weight:700; line-height:1; color:var(--css-primary);">${count}</div>
            <div class="notif-meta">${count === 1 ? 'service' : 'services'}${specificCount ? ` · ${specificCount} specific` : ''}</div>
          </div>
        </div>`;
    }).join('') + `
      <div style="margin-top:10px;">
        <button class="btn small secondary" onclick="adminServiceFilter('all')">Show all services</button>
      </div>`;
  }

  window.editService = function(id) {
    const db = cssLoadDB();
    const s = (db.services || []).find(x => x.id === id);
    if (!s) return;
    editingServiceId = id;
    document.getElementById('svcIcon').value = s.icon || '';
    document.getElementById('svcName').value = s.name || '';
    document.getElementById('svcSummary').value = s.summary || '';
    document.getElementById('svcScope').value = Array.isArray(s.scope) ? s.scope.join('\n') : (s.scope || '');
    document.getElementById('svcCriteria').value = Array.isArray(s.criteria) ? s.criteria.join('\n') : (s.criteria || '');
    document.getElementById('svcCapacity').value = s.capacity || '';
    document.getElementById('svcTurnaround').value = s.turnaround || '';
    document.getElementById('svcReferral').value = s.referral || '';
    // Restore practices dropdown
    const pSel = document.getElementById('svcPractice');
    const p = s.practices;
    if (pSel) pSel.value = (Array.isArray(p) && p.length === 1) ? p[0] : 'all';
    document.getElementById('svcFormTitle').textContent = `Edit: ${s.name}`;
    document.getElementById('svcSaveBtn').textContent = 'Save changes';
    document.getElementById('svcCancelBtn').style.display = '';
    document.getElementById('svcIcon').focus();
    // Scroll form into view
    document.getElementById('svcFormTitle').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  window.cancelServiceEdit = function() {
    editingServiceId = null;
    ['svcIcon','svcName','svcSummary','svcScope','svcCriteria','svcCapacity','svcTurnaround','svcReferral'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const pSel = document.getElementById('svcPractice');
    if (pSel) pSel.value = 'all';
    document.getElementById('svcFormTitle').textContent = 'Add a new service';
    document.getElementById('svcSaveBtn').textContent = 'Add service';
    document.getElementById('svcCancelBtn').style.display = 'none';
    document.getElementById('svcMsg').textContent = '';
  };

  window.saveService = function() {
    const name = (document.getElementById('svcName').value || '').trim();
    const msg = document.getElementById('svcMsg');
    if (!name) { msg.textContent = 'Service name is required.'; return; }

    const db = cssLoadDB();
    db.services = db.services || [];

    const practiceVal = document.getElementById('svcPractice').value;
    const practices = practiceVal === 'all' ? 'all' : [practiceVal];

    const payload = {
      icon: (document.getElementById('svcIcon').value || '').trim() || '🩺',
      name,
      summary: (document.getElementById('svcSummary').value || '').trim(),
      scope: (document.getElementById('svcScope').value || '').split('\n').map(l => l.trim()).filter(Boolean),
      criteria: (document.getElementById('svcCriteria').value || '').split('\n').map(l => l.trim()).filter(Boolean),
      capacity: (document.getElementById('svcCapacity').value || '').trim(),
      turnaround: (document.getElementById('svcTurnaround').value || '').trim(),
      referral: (document.getElementById('svcReferral').value || '').trim(),
      practices,
    };

    if (editingServiceId !== null) {
      const idx = db.services.findIndex(s => s.id === editingServiceId);
      if (idx !== -1) db.services[idx] = { ...db.services[idx], ...payload };
      msg.textContent = 'Service updated.';
    } else {
      const maxId = db.services.reduce((m, s) => Math.max(m, s.id || 0), 0);
      db.services.push({ id: maxId + 1, ...payload });
      msg.textContent = 'Service added.';
    }

    cssSaveDB(db);
    renderAdminServices(activeServiceFilter);
    renderServiceSummary();
    cancelServiceEdit();
    setTimeout(() => { const m = document.getElementById('svcMsg'); if (m) m.textContent = ''; }, 3000);
  };

  window.deleteService = function(id) {
    if (!confirm('Delete this service? It will be removed from all practice portals.')) return;
    const db = cssLoadDB();
    db.services = (db.services || []).filter(s => s.id !== id);
    cssSaveDB(db);
    renderAdminServices(activeServiceFilter);
    renderServiceSummary();
  };

  /* ===================== Contacts ===================== */
  let editingContactId = null;
  let activeContactFilter = 'all';

  function adminInitContactDropdowns() {
    const db = cssLoadDB();
    const viewSel = document.getElementById('ctcViewSelect');
    const addSel  = document.getElementById('ctcPractice');
    if (!viewSel || !addSel) return;

    viewSel.innerHTML = '<option value="all">All practices</option>';
    addSel.innerHTML  = '<option value="all">All practices &amp; PCNs</option>';

    (db.users.practice || []).forEach(p => {
      viewSel.innerHTML += `<option value="${p.username}">${p.org}</option>`;
      addSel.innerHTML  += `<option value="${p.username}">${p.org}</option>`;
    });

    renderContactSummary();
    renderAdminContacts(activeContactFilter);
  }

  window.adminContactFilter = function (filter) {
    activeContactFilter = filter;
    const viewSel = document.getElementById('ctcViewSelect');
    if (viewSel) viewSel.value = filter;
    renderAdminContacts(filter);
  };

  function practicesForContact(ctc, db) {
    const p = ctc.practices;
    if (!p || p === 'all') return '<span class="pill grey" style="font-size:0.72rem;">All practices</span>';
    if (Array.isArray(p)) {
      return p.map(u => {
        const pr = (db.users.practice || []).find(x => x.username === u);
        return `<span class="pill teal" style="font-size:0.72rem;">${pr ? pr.org : u}</span>`;
      }).join(' ');
    }
    return '';
  }

  function renderAdminContacts(filter) {
    filter = filter || 'all';
    const db = cssLoadDB();
    const tbody = document.getElementById('adminContactList');
    const countEl = document.getElementById('ctcCount');
    if (!tbody) return;

    let contacts = db.contacts || [];
    if (filter !== 'all') {
      contacts = contacts.filter(c => {
        const p = c.practices;
        return Array.isArray(p) && p.includes(filter);
      });
    }

    if (countEl) countEl.textContent = `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}${filter !== 'all' ? ' for this practice' : ''}`;

    if (!contacts.length) {
      tbody.innerHTML = filter === 'all'
        ? '<tr><td colspan="7" class="empty-msg">No contacts yet. Add one using the form above.</td></tr>'
        : '<tr><td colspan="7" class="empty-msg">No contacts specifically assigned to this practice. Contacts set to "All practices" always show — select "All practices" above to see them.</td></tr>';
      return;
    }

    tbody.innerHTML = contacts.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.role}</td>
        <td><span class="notif-meta">${c.covers || '—'}</span></td>
        <td>${c.email ? `<a href="mailto:${c.email}" style="color:var(--css-teal);">${c.email}</a>` : '—'}</td>
        <td>${c.phone || '—'}</td>
        <td>${practicesForContact(c, db)}</td>
        <td style="white-space:nowrap;">
          <button class="btn small" onclick="editContact(${c.id})">Edit</button>
          <button class="btn small secondary" onclick="deleteContact(${c.id})" style="margin-left:4px;">Delete</button>
        </td>
      </tr>`).join('');
  }

  function renderContactSummary() {
    const db = cssLoadDB();
    const el = document.getElementById('contactSummary');
    if (!el) return;
    const practices = db.users.practice || [];
    const contacts  = db.contacts || [];

    if (!practices.length) { el.innerHTML = '<p class="empty-msg">No practices set up yet.</p>'; return; }

    el.innerHTML = practices.map(p => {
      const total    = contacts.filter(c => { const pr = c.practices; return !pr || pr === 'all' || (Array.isArray(pr) && pr.includes(p.username)); }).length;
      const specific = contacts.filter(c => { const pr = c.practices; return Array.isArray(pr) && pr.includes(p.username); }).length;
      return `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; margin-bottom:8px; cursor:pointer;"
             onclick="adminContactFilter('${p.username}')">
          <div><strong>${p.org}</strong><div class="notif-meta">${p.type}</div></div>
          <div style="text-align:right;">
            <div style="font-size:1.4rem; font-weight:700; line-height:1; color:var(--css-primary);">${total}</div>
            <div class="notif-meta">${total === 1 ? 'contact' : 'contacts'}${specific ? ` · ${specific} specific` : ''}</div>
          </div>
        </div>`;
    }).join('') + `<div style="margin-top:10px;"><button class="btn small secondary" onclick="adminContactFilter('all')">Show all contacts</button></div>`;
  }

  window.editContact = function (id) {
    const db = cssLoadDB();
    const c = (db.contacts || []).find(x => x.id === id);
    if (!c) return;
    editingContactId = id;
    document.getElementById('ctcName').value  = c.name  || '';
    document.getElementById('ctcRole').value  = c.role  || '';
    document.getElementById('ctcEmail').value = c.email || '';
    document.getElementById('ctcPhone').value = c.phone || '';
    document.getElementById('ctcCovers').value= c.covers|| '';
    const pSel = document.getElementById('ctcPractice');
    const p = c.practices;
    if (pSel) pSel.value = (Array.isArray(p) && p.length === 1) ? p[0] : 'all';
    document.getElementById('contactFormTitle').textContent = `Edit: ${c.name}`;
    document.getElementById('ctcSaveBtn').textContent = 'Save changes';
    document.getElementById('ctcCancelBtn').style.display = '';
    document.getElementById('ctcName').focus();
    document.getElementById('contactFormTitle').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  window.cancelContactEdit = function () {
    editingContactId = null;
    ['ctcName','ctcRole','ctcEmail','ctcPhone','ctcCovers'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const pSel = document.getElementById('ctcPractice');
    if (pSel) pSel.value = 'all';
    document.getElementById('contactFormTitle').textContent = 'Add a contact';
    document.getElementById('ctcSaveBtn').textContent = 'Add contact';
    document.getElementById('ctcCancelBtn').style.display = 'none';
    document.getElementById('ctcMsg').textContent = '';
  };

  window.saveContact = function () {
    const name = (document.getElementById('ctcName').value || '').trim();
    const msg  = document.getElementById('ctcMsg');
    if (!name) { msg.textContent = 'Name is required.'; return; }

    const db = cssLoadDB();
    db.contacts = db.contacts || [];

    const practiceVal = document.getElementById('ctcPractice').value;
    const payload = {
      name,
      role:    (document.getElementById('ctcRole').value  || '').trim(),
      email:   (document.getElementById('ctcEmail').value || '').trim(),
      phone:   (document.getElementById('ctcPhone').value || '').trim(),
      covers:  (document.getElementById('ctcCovers').value|| '').trim(),
      practices: practiceVal === 'all' ? 'all' : [practiceVal],
    };

    if (editingContactId !== null) {
      const idx = db.contacts.findIndex(c => c.id === editingContactId);
      if (idx !== -1) db.contacts[idx] = { ...db.contacts[idx], ...payload };
      msg.textContent = 'Contact updated.';
    } else {
      const maxId = db.contacts.reduce((m, c) => Math.max(m, c.id || 0), 0);
      db.contacts.push({ id: maxId + 1, ...payload });
      msg.textContent = 'Contact added.';
    }

    cssSaveDB(db);
    renderAdminContacts(activeContactFilter);
    renderContactSummary();
    cancelContactEdit();
    setTimeout(() => { const m = document.getElementById('ctcMsg'); if (m) m.textContent = ''; }, 3000);
  };

  window.deleteContact = function (id) {
    if (!confirm('Remove this contact from all practice portals?')) return;
    const db = cssLoadDB();
    db.contacts = (db.contacts || []).filter(c => c.id !== id);
    cssSaveDB(db);
    renderAdminContacts(activeContactFilter);
    renderContactSummary();
  };

  /* ===================== Init ===================== */
  initRotaTabs();
  populateOneOffStaffSelect();
  renderOneOffShifts();
  populateContractOrgSelect();

  renderDashboard();
  renderAdminHoliday();
  renderAdminWeekCalendar();
  renderAdminTraining();
  renderAdminRenewals();
  renderAdminAnnouncements();
  populateAnnRecipients();
  adminInitStaffDocDropdowns();
  adminInitPracticeTabs();
  renderAdminInvoices();
  renderAdminRequests();
  adminInitServiceDropdowns();
  adminInitContactDropdowns();
  renderStaffAccounts();
  renderAdminIncidents();
  try { renderLedger(); } catch(e) {
    const el = document.getElementById('ledgerCols');
    if (el) el.innerHTML = '<div style="color:red;padding:16px;font-family:monospace;">Ledger error: ' + e.message + '</div>';
    console.error('renderLedger failed:', e);
  }
  refreshBell();

  /* ===================== Incident reports ===================== */
  function renderAdminIncidents() {
    const db      = cssLoadDB();
    const reports = (db.incidentReports || []).slice().reverse();
    const el      = document.getElementById('adminIncidentList');
    if (!el) return;

    // Update nav badge
    const unreviewed = reports.filter(r => r.status === 'Submitted').length;
    const badge = document.getElementById('incidentsNavBadge');
    if (badge) { badge.textContent = unreviewed || ''; badge.style.display = unreviewed ? 'inline' : 'none'; }

    if (!reports.length) {
      el.innerHTML = '<div class="panel"><p style="color:var(--css-muted);">No incident reports submitted yet.</p></div>';
      return;
    }

    el.innerHTML = reports.map(r => {
      const statusColour = { Submitted: 'amber', Reviewed: 'green', Archived: 'grey' }[r.status] || 'grey';
      const subDate = r.submittedAt ? new Date(r.submittedAt + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const incDate = r.incidentDate ? new Date(r.incidentDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      return `<div class="panel" style="margin-bottom:14px; ${r.status === 'Submitted' ? 'border-left:4px solid var(--css-amber);' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:700; font-size:1rem;">${r.id} — ${r.staffName}</div>
            <div class="notif-meta" style="margin-top:3px;">${r.practice} · Incident: ${incDate} · Submitted: ${subDate}</div>
            <div style="margin-top:6px; font-size:0.87rem; color:#444;">${r.briefDescription || 'No brief description provided.'}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
            <span class="pill ${statusColour}">${r.status}</span>
            <button class="btn small" onclick="adminViewIncident('${r.id}')">Review / View</button>
            ${r.status === 'Submitted' ? `<button class="btn small secondary" onclick="markIncidentReviewed('${r.id}')">✓ Mark reviewed</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  window.adminViewIncident = function (id) {
    const db = cssLoadDB();
    const r  = (db.incidentReports || []).find(x => x.id === id);
    if (!r) return;
    document.getElementById('irViewContent').innerHTML = cssRenderIncidentFull(r);
    // Admin notes + mark reviewed button in toolbar
    const actionsEl = document.getElementById('irAdminActions');
    if (actionsEl) {
      actionsEl.innerHTML = r.status === 'Submitted'
        ? `<button class="btn small" style="margin-left:10px;" onclick="markIncidentReviewed('${r.id}')">✓ Mark reviewed</button>`
        : `<span class="pill green" style="margin-left:12px; font-size:0.78rem;">Reviewed</span>`;
    }
    document.getElementById('irViewBackdrop').style.display = 'block';
    document.getElementById('irViewModal').style.display    = 'flex';
  };

  window.closeIncidentView = function () {
    document.getElementById('irViewBackdrop').style.display = 'none';
    document.getElementById('irViewModal').style.display    = 'none';
  };

  window.markIncidentReviewed = function (id) {
    const db = cssLoadDB();
    const r  = (db.incidentReports || []).find(x => x.id === id);
    if (!r) return;
    r.status = 'Reviewed';
    r.reviewedAt = toLocalIso(new Date());
    cssSaveDB(db);
    renderAdminIncidents();
    // Refresh view if open
    const viewEl = document.getElementById('irViewContent');
    if (viewEl && viewEl.innerHTML) {
      const updated = (cssLoadDB().incidentReports || []).find(x => x.id === id);
      if (updated) viewEl.innerHTML = cssRenderIncidentFull(updated);
      const actionsEl = document.getElementById('irAdminActions');
      if (actionsEl) actionsEl.innerHTML = `<span class="pill green" style="margin-left:12px; font-size:0.78rem;">Reviewed</span>`;
    }
  };

  /* ===================== Task ledger ===================== */

  /* =====================================================================
     TASK LEDGER — SystmOne-style column day view, per-staff
     ===================================================================== */

  const TASK_CATS = {
    general:      { label: '🗒️ General',       bg: '#e8f0fe', border: '#4285f4' },
    phone:        { label: '📞 Phone call',     bg: '#e6f4ea', border: '#34a853' },
    followup:     { label: '📨 Follow-up',      bg: '#fff8e1', border: '#fbbc04' },
    prescription: { label: '💊 Prescription',  bg: '#fce8e6', border: '#ea4335' },
    referral:     { label: '📤 Referral',       bg: '#e8f5e9', border: '#0f9d58' },
    admin:        { label: '🗂️ Admin / filing', bg: '#f3e8ff', border: '#9c27b0' },
    urgent:       { label: '🔴 Urgent',         bg: '#fde8e8', border: '#c62828' },
  };

  const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let ledgerDate      = null;    // "YYYY-MM-DD" — currently viewed day
  let ledgerNewPerson = null;    // pre-set person when opening task form from a column

  function ledgerTodayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function getWorkDays(name) {
    const db  = cssLoadDB();
    const sch = (db.adminWorkSchedules || {})[name];
    return (sch && sch.days && sch.days.length) ? sch.days : ['Mon','Tue','Wed','Thu','Fri'];
  }

  function isWorkingDay(dateStr, name) {
    const dow = DAY_ABBR[ledgerParseDate(dateStr).getDay()];
    return getWorkDays(name).includes(dow);
  }

  function ledgerInitials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Build one task card for the column view
  function taskCard(t, today) {
    const cat     = TASK_CATS[t.category] || TASK_CATS.general;
    const isDone  = t.status === 'done';
    const isOverdue = !isDone && t.dueDate && t.dueDate < today;
    const isUrgent  = t.priority === 'urgent' && !isDone;
    const bg     = isOverdue ? '#fff0f0' : isDone ? '#f6f6f6' : cat.bg;
    const border = isOverdue ? '#c62828' : isDone ? '#ccc'    : cat.border;
    return `<div class="lc-task${isDone ? ' lc-task--done' : ''}${isOverdue ? ' lc-task--overdue' : ''}"
              style="background:${bg}; border-left:3px solid ${border};"
              id="lt-${t.id}">
      <div class="lc-task-top">
        <button class="lc-check${isDone ? ' lc-check--done' : ''}" onclick="toggleTaskDone('${t.id}')" title="${isDone ? 'Mark pending' : 'Mark done'}">${isDone ? '✓' : ''}</button>
        <span class="lc-task-title${isDone ? ' lc-done-text' : ''}">${escHtml(t.title)}</span>
        <div class="lc-task-btns">
          <button class="lc-task-btn" onclick="openTaskForm('${t.id}')" title="Edit">✏️</button>
          <button class="lc-task-btn" onclick="deleteTask('${t.id}')" title="Delete">🗑️</button>
        </div>
      </div>
      ${t.notes ? `<div class="lc-task-notes">${escHtml(t.notes)}</div>` : ''}
      <div class="lc-task-meta">
        <span class="lc-cat-chip">${cat.label}</span>
        ${isUrgent ? '<span class="lc-urgent-chip">Urgent</span>' : ''}
        ${isOverdue ? '<span class="lc-overdue-chip">Overdue</span>' : ''}
      </div>
    </div>`;
  }

  // Safe cross-browser local Date from "YYYY-MM-DD"
  function ledgerParseDate(str) {
    const parts = (str || '').split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    return new Date(); // fallback to now
  }

  // Render the full column ledger for ledgerDate
  function renderLedger() {
    if (!ledgerDate || !/^\d{4}-\d{2}-\d{2}$/.test(ledgerDate)) ledgerDate = ledgerTodayIso();

    const db     = cssLoadDB();
    const admins = db.users.admin || [];
    const today  = ledgerTodayIso();
    const d      = ledgerParseDate(ledgerDate);

    // Date label
    const lbl = document.getElementById('ledgerDateLabel');
    if (lbl) {
      const isToday = ledgerDate === today;
      lbl.textContent = (isToday ? 'Today — ' : '') +
        d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }

    // Nav badge — all overdue pending tasks across all staff
    const allOverdue = (db.adminTasks || []).filter(t => t.status === 'pending' && t.dueDate && t.dueDate < today).length;
    const navBadge = document.getElementById('ledgerNavBadge');
    if (navBadge) { navBadge.textContent = allOverdue || ''; navBadge.style.display = allOverdue ? '' : 'none'; }

    // Show/hide schedule button (super admin only)
    const schedBtn = document.getElementById('ledgerScheduleBtn');
    if (schedBtn) schedBtn.style.display = adminTier === 'super' ? '' : 'none';

    // For limited admin, only show their own column
    // Super admin sees everyone; standard and limited only see their own column
    const visibleAdmins = adminTier === 'super'
      ? admins
      : admins.filter(a => a.name === session.name);

    const wrap = document.getElementById('ledgerCols');
    if (!wrap) return;

    if (!visibleAdmins.length) {
      wrap.innerHTML = '<div style="padding:30px; color:var(--css-muted); text-align:center;">No admin accounts found. Add admin accounts in the Accounts section.</div>';
      return;
    }

    wrap.innerHTML = visibleAdmins.map(u => {
      const working = isWorkingDay(ledgerDate, u.name);
      const tasks   = (db.adminTasks || []).filter(t => t.assignedTo === u.name && t.dueDate === ledgerDate);
      const pending = tasks.filter(t => t.status === 'pending');
      const done    = tasks.filter(t => t.status === 'done');
      const overdue = pending.filter(t => ledgerDate < today);

      const canAdd = adminTier === 'super' || adminTier === 'standard' || u.name === session.name;

      return `<div class="lc-col${working ? '' : ' lc-col--off'}">
        <div class="lc-col-header">
          <div class="lc-col-avatar">${ledgerInitials(u.name)}</div>
          <div class="lc-col-info">
            <div class="lc-col-name">${escHtml(u.name)}</div>
            <div class="lc-col-days">${getWorkDays(u.name).join(' · ')}</div>
          </div>
          ${working && canAdd
            ? `<button class="lc-add-btn" onclick="openTaskFormForPerson('${escHtml(u.name)}')" title="Add task">+</button>`
            : ''}
        </div>
        <div class="lc-col-body">
          ${!working
            ? `<div class="lc-offday-msg">📅 Day off</div>`
            : tasks.length === 0
              ? `<div class="lc-empty-day">No tasks — all clear ✓</div>`
              : `${overdue.length ? `<div class="lc-section-lbl lc-lbl--over">⚠ Overdue (${overdue.length})</div>` : ''}
                 ${pending.filter(t => !(ledgerDate < today)).map(t => taskCard(t, today)).join('')}
                 ${overdue.map(t => taskCard(t, today)).join('')}
                 ${done.length ? `<div class="lc-section-lbl lc-lbl--done">✓ Done (${done.length})</div>${done.map(t => taskCard(t, today)).join('')}` : ''}`
          }
        </div>
      </div>`;
    }).join('');
  }

  window.ledgerPrevDay = function () {
    if (!ledgerDate) ledgerDate = ledgerTodayIso();
    const d = ledgerParseDate(ledgerDate);
    d.setDate(d.getDate() - 1);
    ledgerDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    renderLedger();
  };

  window.ledgerNextDay = function () {
    if (!ledgerDate) ledgerDate = ledgerTodayIso();
    const d = ledgerParseDate(ledgerDate);
    d.setDate(d.getDate() + 1);
    ledgerDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    renderLedger();
  };

  window.ledgerGoToday = function () {
    ledgerDate = ledgerTodayIso();
    renderLedger();
  };

  window.openTaskFormForPerson = function (name) {
    ledgerNewPerson = name;
    openTaskForm(null);
  };

  /* Work schedule modal (super admin) */
  let scheduleModalUser = null;

  window.openScheduleModal = function () {
    scheduleModalUser = null;
    // Show a picker to choose which person's schedule to edit
    const db     = cssLoadDB();
    const admins = db.users.admin || [];
    if (!admins.length) { alert('No admin accounts found.'); return; }

    // Use first admin as default
    scheduleModalUser = admins[0].name;
    const selEl = document.getElementById('schedulePersonSel');
    if (selEl) {
      selEl.innerHTML = admins.map(a => `<option value="${escHtml(a.name)}">${escHtml(a.name)}</option>`).join('');
      selEl.value     = scheduleModalUser;
      selEl.onchange  = () => {
        scheduleModalUser = selEl.value;
        const days = getWorkDays(scheduleModalUser);
        document.querySelectorAll('input[name="schedDay"]').forEach(cb => { cb.checked = days.includes(cb.value); });
      };
    }
    const days = getWorkDays(scheduleModalUser);
    document.querySelectorAll('input[name="schedDay"]').forEach(cb => { cb.checked = days.includes(cb.value); });
    document.getElementById('scheduleBackdrop').style.display = '';
    document.getElementById('scheduleModal').style.display    = '';
  };

  window.closeScheduleModal = function () {
    document.getElementById('scheduleBackdrop').style.display = 'none';
    document.getElementById('scheduleModal').style.display    = 'none';
  };

  window.saveSchedule = function () {
    const days = Array.from(document.querySelectorAll('input[name="schedDay"]:checked')).map(cb => cb.value);
    if (!days.length) { alert('Please select at least one working day.'); return; }
    const db = cssLoadDB();
    if (!db.adminWorkSchedules) db.adminWorkSchedules = {};
    db.adminWorkSchedules[scheduleModalUser] = { days };
    cssSaveDB(db);
    closeScheduleModal();
    renderLedger();
  };

  window.openTaskForm = function (id) {
    const db     = cssLoadDB();
    const task   = id ? (db.adminTasks || []).find(t => t.id === id) : null;
    const admins = db.users.admin || [];

    const sel = document.getElementById('taskAssignedTo');
    sel.innerHTML = '';
    admins.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.name; opt.textContent = a.name;
      sel.appendChild(opt);
    });

    if (task) {
      document.getElementById('taskFormTitle').textContent = 'Edit task';
      document.getElementById('taskEditId').value          = task.id;
      document.getElementById('taskTitle').value           = task.title || '';
      document.getElementById('taskNotes').value           = task.notes || '';
      document.getElementById('taskCategory').value        = task.category || 'general';
      document.getElementById('taskPriority').value        = task.priority || 'routine';
      document.getElementById('taskDueDate').value         = task.dueDate || '';
      document.getElementById('taskAssignedTo').value      = task.assignedTo || (admins[0] ? admins[0].name : '');
    } else {
      document.getElementById('taskFormTitle').textContent = 'Add task';
      document.getElementById('taskEditId').value          = '';
      document.getElementById('taskTitle').value           = '';
      document.getElementById('taskNotes').value           = '';
      document.getElementById('taskCategory').value        = 'general';
      document.getElementById('taskPriority').value        = 'routine';
      document.getElementById('taskDueDate').value         = ledgerDate || ledgerTodayIso();
      document.getElementById('taskAssignedTo').value      = ledgerNewPerson || session.name || (admins[0] ? admins[0].name : '');
      ledgerNewPerson = null;
    }

    document.getElementById('taskFormBackdrop').style.display = '';
    document.getElementById('taskFormModal').style.display    = '';
    document.getElementById('taskTitle').focus();
  };

  window.closeTaskForm = function () {
    document.getElementById('taskFormBackdrop').style.display = 'none';
    document.getElementById('taskFormModal').style.display    = 'none';
  };

  window.saveTask = function () {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) { document.getElementById('taskTitle').focus(); return; }
    const db      = cssLoadDB();
    db.adminTasks = db.adminTasks || [];
    const editId  = document.getElementById('taskEditId').value;
    const payload = {
      title,
      notes:      document.getElementById('taskNotes').value.trim(),
      category:   document.getElementById('taskCategory').value,
      priority:   document.getElementById('taskPriority').value,
      dueDate:    document.getElementById('taskDueDate').value,
      assignedTo: document.getElementById('taskAssignedTo').value,
    };
    if (editId) {
      const idx = db.adminTasks.findIndex(t => t.id === editId);
      if (idx > -1) Object.assign(db.adminTasks[idx], payload);
    } else {
      db.adminTasks.unshift({ id: 'task_' + Date.now(), status: 'pending',
        createdAt: toLocalIso(new Date()), createdBy: session.name || 'Admin', completedAt: null, ...payload });
    }
    // Jump to the day the task was saved on
    if (payload.dueDate) ledgerDate = payload.dueDate;
    cssSaveDB(db);
    closeTaskForm();
    renderLedger();
  };

  window.toggleTaskDone = function (id) {
    const db   = cssLoadDB();
    const task = (db.adminTasks || []).find(t => t.id === id);
    if (!task) return;
    if (task.status === 'done') { task.status = 'pending'; task.completedAt = null; }
    else { task.status = 'done'; task.completedAt = toLocalIso(new Date()); }
    cssSaveDB(db);
    renderLedger();
  };

  window.deleteTask = function (id) {
    if (!confirm('Delete this task?')) return;
    const db = cssLoadDB();
    db.adminTasks = (db.adminTasks || []).filter(t => t.id !== id);
    cssSaveDB(db);
    renderLedger();
  };

  /* ===================== Admin account management ===================== */
  const TIER_LABELS_FULL = {
    super:    { icon: '🔑', label: 'Super admin',    cls: 'tier-super' },
    standard: { icon: '⚙️',  label: 'Standard admin', cls: 'tier-standard' },
    limited:  { icon: '🔒', label: 'Limited admin',  cls: 'tier-limited' }
  };

  function renderAdminAccounts() {
    const db   = cssLoadDB();
    const list = document.getElementById('adminAccountList');
    if (!list) return;
    const admins = db.users.admin || [];
    if (!admins.length) { list.innerHTML = '<li class="empty-msg">No admin accounts found.</li>'; return; }
    list.innerHTML = '';
    admins.forEach(u => {
      const t = TIER_LABELS_FULL[u.tier || 'super'] || TIER_LABELS_FULL.super;
      const isSelf = u.username === session.username;
      const li = document.createElement('li');
      li.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--css-border);';
      li.innerHTML = `
        <div style="flex:1;">
          <div><strong>${escHtml(u.name)}</strong> ${isSelf ? '<span class="pill grey" style="font-size:0.7rem;">You</span>' : ''}
            <span class="role-tier-badge ${t.cls}" style="font-size:0.72rem; margin-left:4px;">${t.icon} ${t.label}</span>
          </div>
          <div class="notif-meta">@${escHtml(u.username)}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn small secondary" onclick="editAdminAccount('${escHtml(u.username)}')">Edit</button>
          ${!isSelf ? `<button class="btn small secondary" onclick="deleteAdminAccount('${escHtml(u.username)}')">Remove</button>` : ''}
        </div>`;
      list.appendChild(li);
    });
  }

  window.editAdminAccount = function (username) {
    const db = cssLoadDB();
    const u  = (db.users.admin || []).find(a => a.username === username);
    if (!u) return;
    document.getElementById('adminAcctFormTitle').textContent = 'Edit admin account';
    document.getElementById('aaFullName').value  = u.name;
    document.getElementById('aaUsername').value  = u.username;
    document.getElementById('aaPassword').value  = u.password;
    document.getElementById('aaTier').value      = u.tier || 'super';
    document.getElementById('aaEditUsername').value = u.username;
    document.getElementById('aaCancelBtn').style.display = '';
    document.getElementById('aaMsg').textContent = '';
  };

  window.cancelAdminAccountEdit = function () {
    document.getElementById('adminAcctFormTitle').textContent = 'Add admin account';
    document.getElementById('aaFullName').value  = '';
    document.getElementById('aaUsername').value  = '';
    document.getElementById('aaPassword').value  = '';
    document.getElementById('aaTier').value      = 'limited';
    document.getElementById('aaEditUsername').value = '';
    document.getElementById('aaCancelBtn').style.display = 'none';
    document.getElementById('aaMsg').textContent = '';
  };

  window.saveAdminAccount = function () {
    const msg      = document.getElementById('aaMsg');
    const name     = document.getElementById('aaFullName').value.trim();
    const username = document.getElementById('aaUsername').value.trim().toLowerCase();
    const password = document.getElementById('aaPassword').value.trim();
    const tier     = document.getElementById('aaTier').value;
    const editUser = document.getElementById('aaEditUsername').value;

    if (!name || !username || !password) {
      msg.style.color = 'var(--css-red)'; msg.textContent = 'All fields are required.'; return;
    }

    const db = cssLoadDB();
    db.users.admin = db.users.admin || [];

    if (editUser) {
      // Editing existing
      const idx = db.users.admin.findIndex(a => a.username === editUser);
      if (idx > -1) {
        db.users.admin[idx] = { ...db.users.admin[idx], name, username, password, tier };
      }
    } else {
      // New account — check duplicate username
      if (db.users.admin.some(a => a.username === username)) {
        msg.style.color = 'var(--css-red)'; msg.textContent = 'Username already exists.'; return;
      }
      db.users.admin.push({ username, password, name, role: 'Administrator', tier });
    }

    cssSaveDB(db);
    msg.style.color = 'var(--css-green)';
    msg.textContent = editUser ? 'Account updated.' : 'Account created. They can now sign in at the admin portal.';
    setTimeout(() => { msg.textContent = ''; }, 4000);
    cancelAdminAccountEdit();
    renderAdminAccounts();
    renderLedger(); // refresh ledger user tabs
  };

  window.deleteAdminAccount = function (username) {
    if (username === session.username) { alert('You cannot remove your own account.'); return; }
    if (!confirm(`Remove admin account "@${username}"? This cannot be undone.`)) return;
    const db = cssLoadDB();
    db.users.admin = (db.users.admin || []).filter(a => a.username !== username);
    cssSaveDB(db);
    renderAdminAccounts();
    renderLedger();
  };

  /* ===================== CQC Report Manager ===================== */

  function initCQCReportManager() {
    const db       = cssLoadDB();
    const pracSel  = document.getElementById('cqcMgrPractice');
    if (!pracSel) return;

    // Populate practice dropdown (only practices that have CQC data or any practice login)
    const practices = (db.users.practice || []);
    const cqcMap    = db.cqcReports || {};

    pracSel.innerHTML = practices.length
      ? practices.map(p => {
          const hasCQC = !!cqcMap[p.username];
          return `<option value="${p.username}">${p.org || p.name || p.username}${hasCQC ? '' : ' (no CQC data yet)'}</option>`;
        }).join('')
      : '<option value="">No practice accounts found</option>';

    renderCQCAdminHistory();
  }

  window.renderCQCAdminHistory = function () {
    const db       = cssLoadDB();
    const pracSel  = document.getElementById('cqcMgrPractice');
    const panel    = document.getElementById('cqcAdminHistoryPanel');
    if (!pracSel || !panel) return;

    const username   = pracSel.value;
    const rawReports = (db.cqcReports || {})[username];
    const reportList = Array.isArray(rawReports) ? rawReports
                     : rawReports ? [rawReports] : [];

    if (!reportList.length) {
      panel.innerHTML = `<div class="panel" style="color:var(--css-muted); text-align:center; padding:28px;">No CQC reports on file for this practice yet. Use "+ Add new report" to create the first one.</div>`;
      return;
    }

    const fmtDate = iso => {
      const d = new Date((iso || '') + 'T12:00:00');
      return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    panel.innerHTML = `
      <div class="panel">
        <h3 style="margin-top:0;">Report history — ${reportList.length} snapshot${reportList.length !== 1 ? 's' : ''}</h3>
        <table>
          <thead><tr><th>Report date</th><th>Practice</th><th>Prepared by</th><th>Indicators</th><th>Action</th></tr></thead>
          <tbody>
            ${reportList.map((r, i) => {
              const total = (r.sections || []).reduce((s, sec) => s + (sec.items || []).length, 0);
              const flags = (r.sections || []).flatMap(sec => (sec.items || [])).filter(it => it.count > 0).length;
              return `<tr>
                <td><strong>${fmtDate(r.reportDate)}</strong>${i === 0 ? ' <span class="pill green" style="font-size:0.7rem; padding:1px 6px;">Latest</span>' : ''}</td>
                <td>${r.practice || '—'}</td>
                <td>${r.preparedBy || '—'}</td>
                <td>${flags} / ${total} flagged</td>
                <td style="white-space:nowrap;">
                  <button class="btn small secondary" onclick="printCQCReportAdmin('${username}', ${i})"
                    style="margin-right:6px;" title="Print / Save PDF">🖨️ Print</button>
                  <button class="btn small secondary" onclick="deleteCQCReport('${username}', ${i})"
                    style="color:#b10e1e; border-color:#b10e1e;" title="Delete this snapshot">🗑 Delete</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  // Shared RAG helper for print (mirrors practice.js logic)
  function cqcRagAdmin(count, notes, denom, urgentIfAny) {
    if (count === 0 || (notes || '').trim().toLowerCase().startsWith('no action'))
      return { colour: '#00703C', bg: '#e6f4ed', label: 'Clear' };
    if (urgentIfAny) return { colour: '#b10e1e', bg: '#fde8e8', label: 'Urgent' };
    const pct = (denom && denom > 0) ? (count / denom) * 100 : null;
    if (pct !== null) {
      if (pct >= 30) return { colour: '#b10e1e', bg: '#fde8e8', label: 'High' };
      if (pct >= 10) return { colour: '#c45000', bg: '#fff3e8', label: 'Medium' };
      return { colour: '#c45000', bg: '#fff8e6', label: 'Low' };
    }
    if (count >= 50) return { colour: '#b10e1e', bg: '#fde8e8', label: 'High' };
    if (count >= 10) return { colour: '#c45000', bg: '#fff3e8', label: 'Medium' };
    return { colour: '#c45000', bg: '#fff8e6', label: 'Low' };
  }

  window.printCQCReportAdmin = function (username, idx) {
    const db         = cssLoadDB();
    const rawReports = (db.cqcReports || {})[username];
    const reportList = Array.isArray(rawReports) ? rawReports : (rawReports ? [rawReports] : []);
    const report     = reportList[idx] || reportList[0];
    if (!report) { alert('Report not found.'); return; }

    const fmtDate = iso => {
      const d = new Date((iso || '') + 'T12:00:00');
      return isNaN(d) ? (iso || '—') : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const sections   = report.sections || [];
    const allItems   = sections.flatMap(s => s.items || []);
    const highCount  = allItems.filter(i => { const r = cqcRagAdmin(i.count, i.notes, i.denom, i.urgentIfAny); return r.label === 'High' || r.label === 'Urgent'; }).length;
    const medCount   = allItems.filter(i => { const r = cqcRagAdmin(i.count, i.notes, i.denom, i.urgentIfAny); return r.label === 'Medium' || r.label === 'Low'; }).length;
    const clearCount = allItems.filter(i => cqcRagAdmin(i.count, i.notes, i.denom, i.urgentIfAny).label === 'Clear').length;
    const totalPts   = allItems.reduce((s, i) => s + (i.count || 0), 0);

    const sectionRows = sections.map(sec => `
      <div class="section-block">
        <div class="section-heading">${sec.icon || ''} ${sec.title}</div>
        <table>
          <thead>
            <tr>
              <th style="width:38%">Clinical indicator</th>
              <th style="width:7%; text-align:center">Patients</th>
              <th style="width:7%; text-align:center">Eligible</th>
              <th style="width:8%; text-align:center">% not met</th>
              <th style="width:8%; text-align:center">Status</th>
              <th>Action / notes</th>
            </tr>
          </thead>
          <tbody>
            ${(sec.items || []).map(item => {
              const r      = cqcRagAdmin(item.count, item.notes, item.denom, item.urgentIfAny);
              const denom  = item.denom || null;
              const pctStr = (denom && denom > 0) ? ((item.count / denom) * 100).toFixed(1) + '%' : 'N/A';
              return `<tr style="background:${r.label === 'Clear' ? '#fff' : r.bg}">
                <td>${item.name}</td>
                <td style="text-align:center; font-weight:${item.count > 0 ? '700' : '400'}">${item.count}</td>
                <td style="text-align:center; color:#555">${denom != null ? denom : 'N/A'}</td>
                <td style="text-align:center; color:${r.colour}; font-weight:600">${pctStr}</td>
                <td style="text-align:center">
                  <span style="display:inline-block; padding:2px 7px; border-radius:12px; font-size:0.72rem; font-weight:700; color:${r.colour}; background:${r.bg}; border:1px solid ${r.colour}33">${r.label}</span>
                </td>
                <td style="font-size:0.8rem; color:#444">${item.notes || ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`).join('');

    const printedOn = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>CQC Clinical Safety Report — ${report.practice || username}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10pt; color:#1a1a2e; background:#fff; padding:20px 28px; }
  .report-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0d6e8a; padding-bottom:14px; margin-bottom:18px; }
  .brand { font-size:11pt; font-weight:700; color:#0d6e8a; }
  .brand small { display:block; font-size:8pt; font-weight:400; color:#666; }
  .report-title { font-size:17pt; font-weight:700; margin-top:10px; }
  .report-subtitle { font-size:10pt; color:#555; margin-bottom:16px; }
  .meta { text-align:right; font-size:8.5pt; color:#555; line-height:1.6; }
  .summary-bar { display:flex; gap:12px; margin-bottom:22px; }
  .stat-box { flex:1; border:1px solid #ddd; border-radius:8px; padding:10px 14px; text-align:center; }
  .stat-box .num { font-size:22pt; font-weight:700; line-height:1.2; }
  .stat-box .lbl { font-size:8pt; color:#666; margin-top:2px; }
  .stat-box.red  { border-color:#b10e1e33; background:#fde8e8; } .stat-box.red .num  { color:#b10e1e; }
  .stat-box.amber{ border-color:#c4500033; background:#fff3e8; } .stat-box.amber .num{ color:#c45000; }
  .stat-box.green{ border-color:#00703c33; background:#e6f4ed; } .stat-box.green .num{ color:#00703c; }
  .stat-box.blue { border-color:#0d6e8a33; background:#e8f4f8; } .stat-box.blue .num { color:#0d6e8a; }
  .section-block { margin-bottom:20px; break-inside:avoid; }
  .section-heading { font-size:11pt; font-weight:700; color:#0d6e8a; margin-bottom:6px; padding-bottom:4px; border-bottom:1.5px solid #0d6e8a44; }
  table { width:100%; border-collapse:collapse; font-size:8.5pt; margin-bottom:6px; }
  th { background:#f0f4f8; padding:5px 6px; text-align:left; border-bottom:1.5px solid #ccc; font-weight:600; color:#333; }
  td { padding:5px 6px; border-bottom:1px solid #e8e8e8; vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  .footer { margin-top:24px; padding-top:10px; border-top:1px solid #ddd; font-size:7.5pt; color:#888; text-align:center; }
  @media print { body { padding:0; } .section-block { break-inside:avoid-page; } @page { margin:15mm 12mm; size:A4; } }
</style></head><body>
<div class="report-header">
  <div>
    <div class="brand">Clinical Support Solutions (CSS)<small>CQC Clinical Safety Report</small></div>
    <div class="report-title">${report.practice || username}</div>
    <div class="report-subtitle">Data extracted: ${fmtDate(report.reportDate)} &nbsp;·&nbsp; Prepared by: ${report.preparedBy || 'CSS'}</div>
  </div>
  <div class="meta">Printed: ${printedOn}<br>Confidential — not for external distribution</div>
</div>
<div class="summary-bar">
  <div class="stat-box blue"><div class="num">${totalPts.toLocaleString()}</div><div class="lbl">Total patients flagged</div></div>
  <div class="stat-box red"><div class="num">${highCount}</div><div class="lbl">High / Urgent indicators</div></div>
  <div class="stat-box amber"><div class="num">${medCount}</div><div class="lbl">Medium / Low indicators</div></div>
  <div class="stat-box green"><div class="num">${clearCount}</div><div class="lbl">Clear indicators</div></div>
</div>
${sectionRows}
<div class="footer">
  Prepared by Clinical Support Solutions (CSS) — ${report.preparedBy || 'CSS'} &nbsp;·&nbsp; Data date: ${fmtDate(report.reportDate)}<br>
  This report is intended for internal clinical governance use only.
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Pop-up blocked — please allow pop-ups and try again.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  window.deleteCQCReport = function (username, idx) {
    if (!confirm('Delete this report snapshot? This cannot be undone.')) return;
    const db = cssLoadDB();
    const list = (db.cqcReports || {})[username];
    if (Array.isArray(list)) {
      list.splice(idx, 1);
      cssSaveDB(db);
      renderCQCAdminHistory();
    }
  };

  window.startAddCQCReport = function () {
    const db      = cssLoadDB();
    const pracSel = document.getElementById('cqcMgrPractice');
    const formEl  = document.getElementById('cqcAdminAddForm');
    if (!pracSel || !formEl) return;

    const username   = pracSel.value;
    if (!username) { alert('Select a practice first.'); return; }

    const rawReports = (db.cqcReports || {})[username];
    const reportList = Array.isArray(rawReports) ? rawReports
                     : rawReports ? [rawReports] : [];
    const template   = reportList[0]; // use latest as template for indicator names

    if (!template) {
      alert('No existing report template for this practice. Please contact the development team to seed the first report.');
      return;
    }

    const practiceInfo = (db.users.practice || []).find(p => p.username === username) || {};

    // Build form sections
    const todayIso2 = new Date().toISOString().slice(0, 10);
    let sectionsHtml = template.sections.map(sec => `
      <div style="margin-bottom:24px;">
        <h4 style="margin:0 0 10px; padding-bottom:6px; border-bottom:2px solid var(--css-border); color:var(--css-dark);">
          ${sec.icon || ''} ${sec.title}
        </h4>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="font-size:0.78rem; color:var(--css-muted);">
              <th style="text-align:left; padding:4px 6px; width:50%;">Indicator</th>
              <th style="text-align:center; padding:4px 6px; width:90px;">Previous count</th>
              <th style="text-align:center; padding:4px 6px; width:110px;">New count ✏️</th>
              <th style="text-align:center; padding:4px 6px; width:90px;">Eligible (denom)</th>
            </tr>
          </thead>
          <tbody>
            ${sec.items.map((item, iIdx) => `
              <tr style="border-top:1px solid var(--css-border); font-size:0.83rem;">
                <td style="padding:6px; vertical-align:top;">${item.name}</td>
                <td style="text-align:center; padding:6px; color:var(--css-muted); vertical-align:top;">${item.count}</td>
                <td style="text-align:center; padding:6px; vertical-align:top;">
                  <input type="number" min="0" step="1" value="${item.count}"
                    id="cqcNewCount_${sec.id}_${iIdx}"
                    style="width:70px; text-align:center; padding:4px; border:1px solid var(--css-border); border-radius:4px; font-size:0.85rem;">
                </td>
                <td style="text-align:center; padding:6px; color:var(--css-muted); vertical-align:top;">${item.denom != null ? item.denom : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    formEl.style.display = 'block';
    formEl.innerHTML = `
      <div class="panel" id="cqcAddFormInner">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="margin:0 0 4px;">New report — ${practiceInfo.org || username}</h3>
            <p style="margin:0; font-size:0.85rem; color:var(--css-muted);">Enter updated patient counts below. Values from the previous report are pre-filled as a starting point.</p>
          </div>
          <button class="btn small secondary" onclick="cancelAddCQCReport()" style="flex-shrink:0;">✕ Cancel</button>
        </div>

        <div style="display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap; margin-bottom:24px; padding:16px; background:var(--css-bg-alt, #f5f7fa); border-radius:8px; border:1px solid var(--css-border);">
          <div>
            <label for="cqcNewDate" style="font-size:0.85rem; font-weight:600;">Data extracted date</label>
            <input type="date" id="cqcNewDate" value="${todayIso2}" style="margin-top:4px; padding:7px 10px; border:1px solid var(--css-border); border-radius:6px; font-size:0.9rem;">
          </div>
          <div style="flex:1; min-width:200px;">
            <label for="cqcNewPreparedBy" style="font-size:0.85rem; font-weight:600;">Prepared by</label>
            <input type="text" id="cqcNewPreparedBy" value="${template.preparedBy || 'Clinical Support Solutions (CSS)'}"
              style="width:100%; box-sizing:border-box; margin-top:4px; padding:7px 10px; border:1px solid var(--css-border); border-radius:6px; font-size:0.9rem;">
          </div>
        </div>

        <div style="max-height:600px; overflow-y:auto; border:1px solid var(--css-border); border-radius:8px; padding:16px; background:#fff; margin-bottom:20px;">
          ${sectionsHtml}
        </div>

        <div style="display:flex; gap:12px; align-items:center;">
          <button class="btn" onclick="saveNewCQCReport('${username}')">💾 Save new report</button>
          <button class="btn secondary" onclick="cancelAddCQCReport()">Cancel</button>
          <span id="cqcSaveMsg" style="font-size:0.85rem;"></span>
        </div>
      </div>`;

    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.cancelAddCQCReport = function () {
    const formEl = document.getElementById('cqcAdminAddForm');
    if (formEl) { formEl.style.display = 'none'; formEl.innerHTML = ''; }
  };

  window.saveNewCQCReport = function (username) {
    const db         = cssLoadDB();
    const rawReports = (db.cqcReports || {})[username];
    const reportList = Array.isArray(rawReports) ? rawReports
                     : rawReports ? [rawReports] : [];
    const template   = reportList[0];
    if (!template) return;

    const newDate      = (document.getElementById('cqcNewDate') || {}).value || new Date().toISOString().slice(0, 10);
    const newPreparedBy= (document.getElementById('cqcNewPreparedBy') || {}).value || template.preparedBy;

    // Validate date not a duplicate
    if (reportList.some(r => r.reportDate === newDate)) {
      const msg = document.getElementById('cqcSaveMsg');
      if (msg) { msg.style.color = '#b10e1e'; msg.textContent = 'A report with this date already exists. Please choose a different date.'; }
      return;
    }

    // Deep-clone the template sections, substituting new counts from inputs
    const newSections = template.sections.map(sec => ({
      ...sec,
      items: sec.items.map((item, iIdx) => {
        const inp = document.getElementById(`cqcNewCount_${sec.id}_${iIdx}`);
        const newCount = inp ? Math.max(0, parseInt(inp.value, 10) || 0) : item.count;
        return { ...item, count: newCount };
      })
    }));

    const newReport = {
      reportDate:  newDate,
      practice:    template.practice,
      preparedBy:  newPreparedBy,
      sections:    newSections
    };

    // Prepend (newest first)
    if (!db.cqcReports) db.cqcReports = {};
    if (!Array.isArray(db.cqcReports[username])) {
      db.cqcReports[username] = db.cqcReports[username] ? [db.cqcReports[username]] : [];
    }
    db.cqcReports[username].unshift(newReport);

    // Sort newest-first by date just in case
    db.cqcReports[username].sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''));

    cssSaveDB(db);

    const msg = document.getElementById('cqcSaveMsg');
    if (msg) { msg.style.color = 'var(--css-green)'; msg.textContent = 'Report saved. Practice portal will now show the new version.'; }
    setTimeout(() => {
      window.cancelAddCQCReport();
      window.renderCQCAdminHistory();
    }, 1800);
  };

})();
