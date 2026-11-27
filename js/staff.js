/* CSS Staff Portal logic */

(function () {
  const session = cssGetSession();
  if (!session || session.kind !== 'staff') {
    window.location.href = 'index.html';
    return;
  }

  const db = cssLoadDB();

  // --- Sidebar / who box ---
  document.getElementById('whoBox').innerHTML =
    `<strong>${session.name}</strong>${session.role} · ${session.site}`;
  document.getElementById('welcomeLine').textContent =
    `${session.name} — ${session.role}, ${session.site}. Here's what's happening today.`;

  // --- Dashboard stats ---
  const todayIso = toLocalIso(new Date());
  // Shifts are generated from each person's recurring weekly pattern (CSS_ROTA_PATTERN),
  // not stored as individual dated rows — this covers any week, indefinitely.
  const upcomingRota = cssRotaForWeeks(weekStartIso(todayIso), 8, db.rotaPattern, db.oneOffShifts); // 8 weeks ahead is plenty for dashboard/swap use
  const myShifts = upcomingRota.filter(r => r.staff === session.name);
  const myUpcomingShifts = myShifts.filter(r => r.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));
  function staffCanSee(a) {
    if (a.recipientStaff === 'all') return true;
    if (Array.isArray(a.recipientStaff)) return a.recipientStaff.includes(session.username);
    // legacy: no recipientStaff field
    return a.audience === 'staff' || a.audience === 'both';
  }
  const newAnnouncements = db.announcements.filter(staffCanSee);
  const myHolidayPending = db.holidayRequests.filter(h => h.name === session.name && h.status === 'Pending');
  const myInvoicesAction = db.invoices.filter(i => i.name === session.name && i.status !== 'Paid');
  const myRenewalsDue = db.renewals.filter(r => r.name === session.name && daysUntil(r.renewalDate) <= 30);

  document.getElementById('statShifts').textContent = myUpcomingShifts.filter(r => r.date <= weekEndIso(todayIso)).length;
  document.getElementById('statAnnouncements').textContent = newAnnouncements.length;
  document.getElementById('statHoliday').textContent = myHolidayPending.length;
  document.getElementById('statInvoices').textContent = myInvoicesAction.length;
  document.getElementById('statRenewals').textContent = myRenewalsDue.length;
  updateDocsNavBadge(myRenewalsDue.length);

  function daysUntil(iso) {
    return Math.round((new Date(iso + 'T00:00:00') - new Date(todayIso + 'T00:00:00')) / (24 * 60 * 60 * 1000));
  }

  function updateDocsNavBadge(count) {
    const badge = document.getElementById('docsNavBadge');
    if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
    else { badge.style.display = 'none'; }
  }

  function weekEndIso(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + (7 - day));
    return toLocalIso(d);
  }
  function weekStartIso(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1));
    return toLocalIso(d);
  }

  // --- Dashboard: announcements preview ---
  const dashAnn = document.getElementById('dashAnnouncements');
  newAnnouncements.slice(0, 3).forEach(a => dashAnn.appendChild(announcementItem(a)));

  if (!newAnnouncements.length) dashAnn.innerHTML = '<li class="empty-msg">No announcements right now.</li>';

  // --- Dashboard: rota preview ---
  const dashRota = document.getElementById('dashRota');
  const upcoming = myUpcomingShifts;
  upcoming.slice(0, 4).forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="notif-dot teal"></span><div><div><strong>${r.day}</strong> · ${r.site}</div><div class="notif-meta">${r.shift} — ${r.note}${r.staff !== session.name ? ' · ' + r.staff : ''}</div></div>`;
    dashRota.appendChild(li);
  });
  if (!upcoming.length) dashRota.innerHTML = '<li class="empty-msg">No shifts published yet.</li>';

  // --- Full announcements section ---
  const fullAnn = document.getElementById('fullAnnouncements');
  newAnnouncements.forEach(a => fullAnn.appendChild(announcementItem(a)));
  if (!newAnnouncements.length) fullAnn.innerHTML = '<li class="empty-msg">No announcements right now.</li>';

  // Mark announcements as seen when the user visits the section
  function markAnnouncementsSeen() {
    const fresh = cssLoadDB();
    let changed = false;
    fresh.announcements.forEach(a => {
      if (a.audience !== 'staff' && a.audience !== 'all') return;
      if (!a.seenBy) a.seenBy = [];
      if (!a.seenBy.includes(session.username)) {
        a.seenBy.push(session.username);
        changed = true;
      }
    });
    if (changed) cssSaveDB(fresh);
  }

  function announcementItem(a) {
    const li = document.createElement('li');
    li.style.cursor = 'pointer';
    li.title = 'Click to read';
    li.innerHTML = `<span class="notif-dot ${a.priority === 'green' ? 'green' : a.priority === 'red' ? 'amber' : 'teal'}"></span>
      <div style="flex:1;">
        <div><strong>${a.title}</strong> <span class="pill ${a.priority}">${priorityLabel(a.priority)}</span></div>
        <div class="notif-meta">${formatDate(a.date)}</div>
        <div class="ann-preview">${a.body}</div>
      </div>
      <span class="ann-read-more">Read →</span>`;
    li.addEventListener('click', () => openAnnModal(a));
    return li;
  }

  window.openAnnModal = function (a) {
    document.getElementById('annModalPill').className  = `pill ${a.priority} ann-modal-pill`;
    document.getElementById('annModalPill').textContent = priorityLabel(a.priority);
    document.getElementById('annModalDate').textContent = formatDate(a.date);
    document.getElementById('annModalTitle').textContent = a.title;
    document.getElementById('annModalBody').textContent  = a.body;
    document.getElementById('annModalBackdrop').style.display = 'block';
    document.getElementById('annModal').style.display          = 'block';
  };

  window.closeAnnModal = function () {
    document.getElementById('annModalBackdrop').style.display = 'none';
    document.getElementById('annModal').style.display          = 'none';
  };

  // Close on Escape key
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAnnModal(); });

  function priorityLabel(p) {
    return p === 'red' ? 'Action needed' : p === 'amber' ? 'Important' : p === 'green' ? 'Update' : 'Info';
  }

  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // --- Rota (staff only ever see their own shifts) ---
  // Note: lunch breaks are read-only here. Adding/amending them is an admin-side
  // capability and will be wired up once the admin portal exists.
  function shiftSpanHours(shift) {
    const [from, to] = shift.split('–').map(t => t.trim());
    const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return Math.max(0, (toMins(to) - toMins(from)) / 60);
  }
  function workedHours(r) {
    return Math.max(0, shiftSpanHours(r.shift) - (r.lunchMins || 0) / 60);
  }

  function dayLabel(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // Rota week navigation — shifts repeat weekly per CSS_ROTA_PATTERN, so staff
  // can step forward/back through any week rather than picking from a fixed list.
  let currentWeekStart = weekStartIso(todayIso);

  window.rotaPrevWeek = function () {
    const d = new Date(currentWeekStart + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    currentWeekStart = toLocalIso(d);
    renderRota();
  };
  window.rotaNextWeek = function () {
    const d = new Date(currentWeekStart + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    currentWeekStart = toLocalIso(d);
    renderRota();
  };
  window.rotaThisWeek = function () {
    currentWeekStart = weekStartIso(todayIso);
    renderRota();
  };

  window.renderRota = function () {
    const fresh = cssLoadDB();
    const weekStart = currentWeekStart;
    const weekEnd = weekEndIso(weekStart);

    document.getElementById('rotaWeekLabel').textContent =
      `Week of ${dayLabel(weekStart)}` + (weekStart === weekStartIso(todayIso) ? ' (this week)' : '');

    // Generated from the recurring weekly pattern, always scoped to the signed-in
    // staff member — no other staff's shifts are ever loaded into this view
    const myWeekShifts = cssRotaForWeek(weekStart, fresh.rotaPattern, fresh.oneOffShifts).filter(r => r.staff === session.name);

    // Build a lookup of shifts that are covered by an approved holiday, so they
    // can be rendered as "Annual leave" rather than a normal working shift.
    // Uses explicit shiftsOff keys where present, or falls back to the full
    // from–to date range for requests submitted without shift-level granularity.
    const approvedHolidays = fresh.holidayRequests.filter(h => h.name === session.name && h.status === 'Approved');
    const holidayShiftKeys = new Set();
    const holidayDateRanges = [];
    approvedHolidays.forEach(h => {
      if (h.shiftsOff && h.shiftsOff.length) {
        h.shiftsOff.forEach(s => holidayShiftKeys.add(`${s.date}|${s.shift}`));
      } else {
        holidayDateRanges.push({ from: h.from, to: h.to });
      }
    });
    function onHoliday(r) {
      return holidayShiftKeys.has(`${r.date}|${r.shift}`) ||
        holidayDateRanges.some(range => r.date >= range.from && r.date <= range.to);
    }

    // Build 5 weekday cards (Mon–Fri) for the selected week
    const container = document.getElementById('rotaDays');
    container.innerHTML = '';
    const start = new Date(weekStart + 'T00:00:00');
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = toLocalIso(d);
      const dayShifts = myWeekShifts.filter(r => r.date === iso).sort((a, b) => a.shift.localeCompare(b.shift));

      const card = document.createElement('div');
      card.className = 'rota-day-card' + (iso === todayIso ? ' is-today' : '');
      card.innerHTML = `<div class="rota-day-head"><span class="rota-day-name">${dayLabel(iso)}</span>${iso === todayIso ? '<span class="pill teal">Today</span>' : ''}</div>`;

      const body = document.createElement('div');
      if (!dayShifts.length) {
        body.className = 'rota-day-empty';
        body.textContent = 'No shifts for you';
      } else {
        body.className = 'rota-shifts';
        dayShifts.forEach(r => {
          const el = document.createElement('div');
          if (onHoliday(r)) {
            el.className = 'rota-shift is-holiday';
            el.innerHTML = `
              <div class="rota-shift-time">${r.shift}</div>
              <div class="rota-shift-site">🌴 Annual leave</div>
              <div class="rota-shift-note">Holiday approved — ${r.site}</div>`;
          } else {
            el.className = `rota-shift site-${r.siteKey} is-mine${r.isOneOff ? ' is-oneoff' : ''}`;
            el.innerHTML = `
              <div class="rota-shift-time">${r.shift}${r.isOneOff ? ' <span style="font-size:0.7rem; background:var(--css-amber); color:#fff; padding:1px 5px; border-radius:4px; vertical-align:middle;">One-off</span>' : ''}</div>
              <div class="rota-shift-site">${r.site}</div>
              <div class="rota-shift-note">${r.note || ''}</div>
              <div class="rota-shift-lunch">${r.lunchMins ? `🍽️ Lunch: ${r.lunchMins} min` : '🍽️ No lunch break set'}</div>`;
          }
          body.appendChild(el);
        });
      }
      card.appendChild(body);
      container.appendChild(card);
    }

    document.getElementById('rotaStatShifts').textContent = myWeekShifts.length;
    document.getElementById('rotaStatHours').textContent = myWeekShifts.reduce((sum, r) => sum + workedHours(r), 0);
    document.getElementById('rotaStatSites').textContent = new Set(myWeekShifts.map(r => r.site)).size;
  };

  renderRota();

  // --- Documents ---
  function renderDocList() {
    const fresh = cssLoadDB();
    const docList = document.getElementById('staffDocList');
    docList.innerHTML = '';
    // Only show docs visible to this staff member (all staff, or specifically them)
    const myDocs = fresh.staffDocs.filter(d => {
      const s = d.staffMembers;
      if (!s || s === 'all') return true;
      return Array.isArray(s) && s.includes(session.username);
    });
    if (!myDocs.length) { docList.innerHTML = '<li class="empty-msg">No documents published yet.</li>'; return; }
    myDocs.forEach(d => {
      const li = document.createElement('li');
      li.innerHTML = `<div><div class="doc-name">📄 ${d.name}</div><div class="doc-meta">${d.category} · updated ${formatDate(d.updated)}</div></div>
        <button class="btn small secondary" onclick="alert('In the full version this would download: ${d.name.replace(/'/g, "\\'")}')">Download</button>`;
      docList.appendChild(li);
    });
  }

  function renderMyCertificates() {
    const fresh = cssLoadDB();
    const mine = (fresh.staffCertificates || []).filter(c => c.username === session.username)
      .sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));
    const el = document.getElementById('myCertsList');
    if (!mine.length) { el.innerHTML = '<p style="color:var(--css-muted); font-size:0.88rem;">No documents submitted yet. Use the form above to upload your first certificate.</p>'; return; }

    const certPill = c => {
      if (c.status === 'Approved') {
        const d = c.dueDate ? daysUntil(c.dueDate) : null;
        if (d !== null && d < 0)   return `${statusPill('Overdue')} <span class="notif-meta">Expired ${formatDate(c.dueDate)}</span>`;
        if (d !== null && d <= 30) return `${statusPill('Approved')} <span class="notif-meta">⚠️ Due in ${d} day${d === 1 ? '' : 's'} — ${formatDate(c.dueDate)}</span>`;
        return `${statusPill('Approved')} ${c.dueDate ? `<span class="notif-meta">Due ${formatDate(c.dueDate)}</span>` : ''}`;
      }
      if (c.status === 'Rejected') return `${statusPill('Declined')} ${c.adminNotes ? `<span class="notif-meta">${c.adminNotes}</span>` : ''}`;
      return statusPill('Pending') + ' <span class="notif-meta">Awaiting admin review</span>';
    };

    el.innerHTML = `<table><thead><tr><th>Document</th><th>Category</th><th>Uploaded</th><th>Status</th><th></th></tr></thead><tbody>` +
      mine.map(c => `<tr>
        <td><strong>${c.title}</strong><br><span class="notif-meta">📎 ${c.fileName}</span></td>
        <td>${c.category}</td>
        <td>${formatDate(c.uploadDate)}</td>
        <td>${certPill(c)}</td>
        <td>${c.fileData ? `<button class="btn small secondary" onclick="viewCertFile(${c.id})">View file</button>` : ''}</td>
      </tr>`).join('') + `</tbody></table>`;

    // Update dashboard renewal stat
    const dueCount = mine.filter(c => c.status === 'Approved' && c.dueDate && daysUntil(c.dueDate) <= 30).length;
    document.getElementById('statRenewals').textContent = dueCount;
  }

  window.viewCertFile = function (id) {
    const fresh = cssLoadDB();
    const cert = (fresh.staffCertificates || []).find(c => c.id === id);
    if (!cert || !cert.fileData) return;
    const link = document.createElement('a');
    link.href = cert.fileData;
    link.download = cert.fileName;
    link.click();
  };

  window.filterDocs = function (cat) {
    document.querySelectorAll('.doc-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`.doc-tab[data-cat="${cat}"]`).classList.add('active');
    const isCss = cat === 'css';
    document.getElementById('cssdocPanel').style.display  = isCss ? 'block' : 'none';
    document.getElementById('mycertsPanel').style.display = isCss ? 'none'  : 'block';
    if (isCss) renderDocList();
    else renderMyCertificates();
  };

  window.uploadCertificate = function () {
    const msg      = document.getElementById('certMsg');
    const title    = document.getElementById('certTitle').value.trim();
    const category = document.getElementById('certCategory').value;
    const fileInput = document.getElementById('certFile');
    const file      = fileInput.files[0];
    if (!title) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Enter a document name.'; return; }
    if (!file)  { msg.style.color = 'var(--css-red)'; msg.textContent = 'Choose a file to attach.'; return; }
    if (file.size > 5 * 1024 * 1024) { msg.style.color = 'var(--css-red)'; msg.textContent = 'File is too large — maximum 5 MB.'; return; }

    msg.style.color = 'var(--css-muted)';
    msg.textContent = 'Reading file…';

    const reader = new FileReader();
    reader.onload = function (e) {
      const fresh = cssLoadDB();
      if (!fresh.staffCertificates) fresh.staffCertificates = [];
      const nextId = (fresh.staffCertificates.reduce((m, c) => Math.max(m, c.id), 0)) + 1;
      fresh.staffCertificates.push({
        id: nextId, username: session.username, staffName: session.name,
        title, category,
        fileName: file.name,
        fileType: file.type,
        fileData: e.target.result,   // base64 data URL
        uploadDate: todayIso,
        status: 'Pending', dueDate: null, adminNotes: ''
      });
      try {
        cssSaveDB(fresh);
      } catch (err) {
        msg.style.color = 'var(--css-red)';
        msg.textContent = 'File too large to store — try a smaller file.';
        return;
      }
      msg.style.color = 'var(--css-green)';
      msg.textContent = 'Submitted — admin will review shortly.';
      document.getElementById('certTitle').value = '';
      fileInput.value = '';
      renderMyCertificates();
      refreshBell();
      setTimeout(() => msg.textContent = '', 5000);
    };
    reader.onerror = function () {
      msg.style.color = 'var(--css-red)';
      msg.textContent = 'Could not read file — please try again.';
    };
    reader.readAsDataURL(file);
  };

  filterDocs('css');

  // --- Holiday requests ---
  function renderHoliday() {
    const tbody = document.getElementById('holidayTable');
    tbody.innerHTML = '';
    const mine = db.holidayRequests.filter(h => h.name === session.name);
    if (!mine.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No requests submitted yet.</td></tr>'; return; }
    mine.forEach(h => {
      const tr = document.createElement('tr');
      const shiftsOff = (h.shiftsOff && h.shiftsOff.length)
        ? h.shiftsOff.map(s => `${dayLabel(s.date)} ${s.shift}`).join('<br>')
        : '<span style="color:var(--css-muted);">—</span>';
      const canCancel = h.status === 'Pending' || h.status === 'Approved';
      const action = canCancel
        ? `<button class="btn small secondary" onclick="cancelHoliday(${h.id})">Cancel</button>`
        : '';
      tr.innerHTML = `<td>${formatDate(h.from)}</td><td>${formatDate(h.to)}</td><td>${shiftsOff}</td><td>${h.note || '—'}</td><td>${statusPill(h.status)}</td><td>${action}</td>`;
      tbody.appendChild(tr);
    });
  }

  // Staff can withdraw a request while it's still Pending, or call off an
  // already-Approved holiday (e.g. plans changed) — both update the status
  // here rather than deleting the record, so there's a record of what happened.
  window.cancelHoliday = function (id) {
    const fresh = cssLoadDB();
    const req = fresh.holidayRequests.find(h => h.id === id && h.name === session.name);
    if (!req) return;
    if (!(req.status === 'Pending' || req.status === 'Approved')) return;
    const wasApproved = req.status === 'Approved';
    if (!confirm(wasApproved
      ? `Cancel your approved holiday from ${formatDate(req.from)} to ${formatDate(req.to)}? Your manager will be notified.`
      : `Withdraw this pending holiday request?`)) return;
    req.status = 'Cancelled';
    cssSaveDB(fresh);
    db.holidayRequests = fresh.holidayRequests;
    document.getElementById('statHoliday').textContent =
      fresh.holidayRequests.filter(h => h.name === session.name && h.status === 'Pending').length;
    renderHoliday();
  };

  // Shows the staff member's own regular shifts that fall within the chosen
  // holiday date range, generated from their recurring weekly pattern, so
  // they can flag exactly which ones need cover.
  window.renderHolidayShiftPreview = function () {
    const wrap = document.getElementById('hrShiftsWrap');
    const list = document.getElementById('hrShiftsList');
    const from = document.getElementById('hrFrom').value;
    const to = document.getElementById('hrTo').value;
    list.innerHTML = '';

    if (!from || !to || to < from) { wrap.style.display = 'none'; return; }

    const spanWeeks = Math.ceil((new Date(to) - new Date(weekStartIso(from))) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const freshDb2 = cssLoadDB();
    const shifts = cssRotaForWeeks(weekStartIso(from), spanWeeks, freshDb2.rotaPattern, freshDb2.oneOffShifts)
      .filter(r => r.staff === session.name && r.date >= from && r.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));

    if (!shifts.length) {
      wrap.style.display = 'block';
      list.innerHTML = '<li class="empty-msg">No shifts found in this date range — you may not be scheduled to work those days.</li>';
      return;
    }

    wrap.style.display = 'block';
    // "Select all" / "Clear all" controls
    const controls = document.createElement('li');
    controls.style.cssText = 'list-style:none; margin-bottom:6px; display:flex; gap:12px;';
    controls.innerHTML = `
      <button class="btn small secondary" type="button" onclick="document.querySelectorAll('.hr-shift-cb').forEach(cb=>cb.checked=true)">Select all</button>
      <button class="btn small secondary" type="button" onclick="document.querySelectorAll('.hr-shift-cb').forEach(cb=>cb.checked=false)">Clear all</button>`;
    list.appendChild(controls);

    shifts.forEach(s => {
      const li = document.createElement('li');
      li.innerHTML = `<label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <input type="checkbox" class="hr-shift-cb" data-date="${s.date}" data-shift="${s.shift}" data-site="${s.site}" checked style="margin-top:4px;">
          <span><strong>${dayLabel(s.date)}</strong> · ${s.site} · ${s.shift}${s.note ? `<br><span class="notif-meta">${s.note}</span>` : ''}</span>
        </label>`;
      list.appendChild(li);
    });
  };
  function statusPill(s) {
    const map = { Pending: 'amber', Approved: 'green', Declined: 'red', Cancelled: 'grey', Submitted: 'teal', Paid: 'green', Draft: 'grey', 'In progress': 'teal', Scheduled: 'teal', Completed: 'green', Overdue: 'red' };
    return `<span class="pill ${map[s] || 'grey'}">${s}</span>`;
  }
  renderHoliday();

  window.submitHoliday = function () {
    const from = document.getElementById('hrFrom').value;
    const to = document.getElementById('hrTo').value;
    const note = document.getElementById('hrNote').value.trim();
    const msg = document.getElementById('hrMsg');
    if (!from || !to) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Please choose a start and end date.'; return; }
    if (to < from) { msg.style.color = 'var(--css-red)'; msg.textContent = 'End date cannot be before the start date.'; return; }

    const shiftsOff = Array.from(document.querySelectorAll('.hr-shift-cb:checked')).map(cb => ({
      date: cb.dataset.date, shift: cb.dataset.shift, site: cb.dataset.site
    }));

    const fresh = cssLoadDB();
    const nextId = (fresh.holidayRequests.reduce((m, h) => Math.max(m, h.id), 0)) + 1;
    fresh.holidayRequests.push({ id: nextId, name: session.name, from, to, status: 'Pending', note, shiftsOff });
    cssSaveDB(fresh);
    db.holidayRequests = fresh.holidayRequests;
    msg.style.color = 'var(--css-green)';
    msg.textContent = shiftsOff.length
      ? `Request submitted — ${shiftsOff.length} shift${shiftsOff.length > 1 ? 's' : ''} flagged for cover.`
      : 'Request submitted — your manager will review it shortly.';
    document.getElementById('hrFrom').value = '';
    document.getElementById('hrTo').value = '';
    document.getElementById('hrNote').value = '';
    document.getElementById('hrShiftsWrap').style.display = 'none';
    document.getElementById('hrShiftsList').innerHTML = '';
    renderHoliday();
    setTimeout(() => msg.textContent = '', 4000);
  };

  // --- Invoicing ---
  // UK_BANK_HOLIDAYS is defined globally in data.js

  // Populate month dropdown — from 1st of each month staff may claim for the previous month.
  // Show up to 3 months back to allow late submissions.
  (function populateInvMonths() {
    const sel = document.getElementById('invMonth');
    if (!sel) return;
    const today = new Date(todayIso + 'T00:00:00');
    const opts = ['<option value="">— Select a month to claim for —</option>'];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = toLocalIso(d).slice(0, 7); // "YYYY-MM"
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      opts.push(`<option value="${value}">${label}</option>`);
    }
    sel.innerHTML = opts.join('');
  })();

  window.renderInvoiceShifts = function () {
    const monthVal = document.getElementById('invMonth').value;
    const wrap     = document.getElementById('invShiftsWrap');
    const listEl   = document.getElementById('invShiftsList');
    if (!wrap || !listEl) return;
    if (!monthVal) { wrap.style.display = 'none'; return; }

    const [yr, mo] = monthVal.split('-').map(Number);
    const firstDay  = `${monthVal}-01`;
    const lastDay   = toLocalIso(new Date(yr, mo, 0)); // day-0 of next month = last day this month

    const freshDb  = cssLoadDB();
    const wStart   = weekStartIso(firstDay);
    const spanMs   = new Date(lastDay + 'T00:00:00') - new Date(wStart + 'T00:00:00');
    const spanWeeks = Math.ceil(spanMs / (7 * 86400000)) + 2;

    const shifts = cssRotaForWeeks(wStart, spanWeeks, freshDb.rotaPattern, freshDb.oneOffShifts)
      .filter(r => r.staff === session.name && r.date >= firstDay && r.date <= lastDay)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Already submitted for this month?
    const already = (freshDb.invoices || []).find(i => i.name === session.name && i.monthKey === monthVal && i.status !== 'Cancelled');

    // Approved holidays lookup
    const approvedHols = (freshDb.holidayRequests || []).filter(h => h.name === session.name && h.status === 'Approved');
    function isHoliday(s) {
      for (const h of approvedHols) {
        if (h.shiftsOff && h.shiftsOff.length) {
          if (h.shiftsOff.some(x => x.date === s.date && x.shift === s.shift)) return true;
        } else if (s.date >= h.from && s.date <= h.to) return true;
      }
      return false;
    }

    wrap.style.display = 'block';
    listEl.innerHTML = '';

    if (already) {
      listEl.innerHTML = `<li class="empty-msg">You have already submitted an invoice for this month (${already.id}).</li>`;
      document.getElementById('invSummary').innerHTML = '';
      return;
    }
    if (!shifts.length) {
      listEl.innerHTML = '<li class="empty-msg">No shifts found for this month.</li>';
      document.getElementById('invSummary').innerHTML = '';
      return;
    }

    shifts.forEach(s => {
      const bankHol = UK_BANK_HOLIDAYS.has(s.date);
      const onHol   = isHoliday(s);
      const disabled = bankHol || onHol;
      const hours   = shiftSpanHours(s.shift);
      const tag     = bankHol ? '🏦 Bank holiday' : onHol ? '🌴 Annual leave' : '';

      const li = document.createElement('li');
      li.style.opacity = disabled ? '0.45' : '1';
      li.innerHTML = `<label style="display:flex; align-items:flex-start; gap:10px; cursor:${disabled ? 'not-allowed' : 'pointer'};">
        <input type="checkbox" class="inv-shift-cb"
          data-date="${s.date}" data-shift="${s.shift}" data-site="${s.site}" data-hours="${hours}"
          ${disabled ? 'disabled' : 'checked'}
          onchange="updateInvoiceSummary()"
          style="margin-top:4px; flex-shrink:0;">
        <span>
          <strong>${dayLabel(s.date)}</strong> · ${s.site} · <strong>${s.shift}</strong>
          <span class="notif-meta">(${hours % 1 === 0 ? hours : hours.toFixed(1)}h)</span>
          ${tag ? `<span class="pill amber" style="font-size:0.72rem; margin-left:6px;">${tag}</span>` : ''}
          ${s.note ? `<br><span class="notif-meta">${s.note}</span>` : ''}
        </span>
      </label>`;
      listEl.appendChild(li);
    });

    updateInvoiceSummary();
  };

  window.updateInvoiceSummary = function () {
    const el = document.getElementById('invSummary');
    if (!el) return;
    const cbs = Array.from(document.querySelectorAll('.inv-shift-cb:checked:not(:disabled)'));
    const totalHours = cbs.reduce((sum, cb) => sum + parseFloat(cb.dataset.hours || 0), 0);
    const count = cbs.length;

    // Pull hourly rate from HR profile and auto-fill the amount field
    const fresh = cssLoadDB();
    const profile = (fresh.hrProfiles || {})[session.username];
    const rate = profile && profile.hourlyRate ? parseFloat(profile.hourlyRate) : null;
    const totalAmount = rate ? (totalHours * rate) : null;

    if (rate && totalAmount != null) {
      const amountEl = document.getElementById('invAmount');
      if (amountEl) amountEl.value = totalAmount.toFixed(2);
    } else {
      const amountEl = document.getElementById('invAmount');
      if (amountEl) amountEl.value = '';
    }

    el.innerHTML = count
      ? `<div style="background:var(--css-surface); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:0.9rem;">
           <strong>${count} shift${count !== 1 ? 's' : ''} selected</strong> &nbsp;·&nbsp;
           <strong>${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} hours</strong>
           ${rate ? `&nbsp;·&nbsp; <strong>${cssFmtMoney(totalAmount)}</strong> <span class="notif-meta">@ £${rate.toFixed(2)}/hr</span>` : '<br><span class="notif-meta" style="color:var(--css-amber);">⚠️ No hourly rate on your profile — ask admin to add your rate before submitting.</span>'}
         </div>`
      : '<p style="color:var(--css-muted); font-size:0.88rem; margin-bottom:14px;">No shifts selected.</p>';

    updateInvoiceTotal();
  };

  window.updateInvoiceTotal = function () {
    const base     = parseFloat(document.getElementById('invAmount').value) || 0;
    const extra    = parseFloat(document.getElementById('invExtraCost').value) || 0;
    const totalEl  = document.getElementById('invTotalLine');
    if (!totalEl) return;
    if (extra > 0) {
      totalEl.style.display = 'block';
      totalEl.innerHTML = `Base pay: ${cssFmtMoney(base)} &nbsp;+&nbsp; Additional: <strong style="color:var(--css-amber);">${cssFmtMoney(extra)}</strong> &nbsp;=&nbsp; <strong>Grand total: ${cssFmtMoney(base + extra)}</strong>`;
    } else {
      totalEl.style.display = 'none';
    }
  };

  function renderInvoices() {
    const tbody = document.getElementById('invoiceTable');
    tbody.innerHTML = '';
    const mine = (db.invoices || []).filter(i => i.name === session.name).slice().reverse();
    if (!mine.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No invoices submitted yet.</td></tr>'; return; }
    mine.forEach(i => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Click to view full invoice';
      tr.onclick = () => viewInvoice(i.id);
      const shifts = i.shifts ? i.shifts.length : '—';
      const hrs    = i.totalHours != null ? (i.totalHours % 1 === 0 ? i.totalHours : i.totalHours.toFixed(1)) + 'h' : '—';
      const extraBadge = i.extraCost > 0 ? `<span class="pill amber" style="font-size:0.72rem; margin-left:4px;">+extra</span>` : '';
      const grandTotal = (i.amount || 0) + (i.extraCost || 0);
      tr.innerHTML = `<td>${i.id}</td><td>${i.period}</td><td>${shifts}</td><td>${hrs}</td><td>${cssFmtMoney(grandTotal)}${extraBadge}</td><td>${statusPill(i.status)}</td><td style="color:var(--css-muted); font-size:0.8rem;">View ›</td>`;
      tbody.appendChild(tr);
    });
  }

  window.viewInvoice = function(id) {
    const freshDb = cssLoadDB();
    const inv = (freshDb.invoices || []).find(i => i.id === id);
    if (!inv || inv.name !== session.name) return;
    const staffUser = (freshDb.users.staff || []).find(u => u.name === inv.name);
    const hrp = staffUser ? (freshDb.hrProfiles || {})[staffUser.username] : null;
    document.getElementById('invModalContent').innerHTML = cssRenderInvoiceFull(inv, hrp);
    document.getElementById('invModalBackdrop').style.display = 'block';
    document.getElementById('invModal').style.display = 'flex';
  };
  window.closeInvoiceModal = function() {
    document.getElementById('invModalBackdrop').style.display = 'none';
    document.getElementById('invModal').style.display = 'none';
  };
  renderInvoices();

  window.submitInvoice = function () {
    const monthVal  = document.getElementById('invMonth').value;
    const amount    = parseFloat(document.getElementById('invAmount').value);
    const extraCost = parseFloat(document.getElementById('invExtraCost').value) || 0;
    const extraDesc = document.getElementById('invExtraDesc').value.trim();
    const msg       = document.getElementById('invMsg');

    if (!monthVal) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Please select a month.'; return; }
    if (!amount || amount <= 0) { msg.style.color = 'var(--css-red)'; msg.textContent = 'No calculated amount — make sure your hourly rate is set in My details.'; return; }
    if (extraCost > 0 && !extraDesc) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Please describe the additional costs before submitting.'; return; }

    const selectedShifts = Array.from(document.querySelectorAll('.inv-shift-cb:checked:not(:disabled)')).map(cb => ({
      date: cb.dataset.date, shift: cb.dataset.shift, site: cb.dataset.site, hours: parseFloat(cb.dataset.hours)
    }));
    if (!selectedShifts.length) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Please select at least one shift to claim for.'; return; }

    const d      = new Date(monthVal + '-01T00:00:00');
    const period = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const totalHours = parseFloat(selectedShifts.reduce((s, x) => s + x.hours, 0).toFixed(1));

    const fresh = cssLoadDB();
    const already = fresh.invoices.find(i => i.name === session.name && i.monthKey === monthVal && i.status !== 'Cancelled');
    if (already) { msg.style.color = 'var(--css-red)'; msg.textContent = `An invoice for ${period} already exists (${already.id}).`; return; }

    const num = fresh.invoices.length + 14;
    const id  = `INV-${new Date().getFullYear()}-${String(num).padStart(3, '0')}`;
    const invoiceRecord = { id, name: session.name, period, monthKey: monthVal, amount, totalHours, shifts: selectedShifts, status: 'Submitted', submittedAt: toLocalIso(new Date()) };
    if (extraCost > 0) { invoiceRecord.extraCost = extraCost; invoiceRecord.extraDesc = extraDesc; }
    fresh.invoices.push(invoiceRecord);
    cssSaveDB(fresh);
    db.invoices = fresh.invoices;

    msg.style.color = 'var(--css-green)';
    msg.textContent = `Invoice ${id} submitted — ${selectedShifts.length} shifts, ${totalHours}h, ${cssFmtMoney(amount)}.`;
    document.getElementById('invMonth').value = '';
    document.getElementById('invShiftsWrap').style.display = 'none';
    document.getElementById('invAmount').value = '';
    renderInvoices();
    setTimeout(() => msg.textContent = '', 6000);
  };

  // --- My details (HR profile — read-only, maintained by admin) ---
  function renderMyDetails() {
    const fresh = cssLoadDB();
    const p = (fresh.hrProfiles || {})[session.username] || null;
    const el = document.getElementById('myDetailsContent');

    if (!p || !p.startDate) {
      el.innerHTML = `<div class="panel"><p style="color:var(--css-muted);">Your HR profile hasn't been set up yet — the CSS admin team will add your details when your onboarding is complete.</p></div>`;
      return;
    }

    function row(label, val) {
      if (val === '' || val === null || val === undefined) return '';
      return `<div class="profile-row"><span class="profile-label">${label}</span><span class="profile-value">${val}</span></div>`;
    }
    function card(title, rows) {
      const content = rows.filter(Boolean).join('');
      return content ? `<div class="panel"><h3>${title}</h3>${content}</div>` : '';
    }
    function fmtBool(v) { return v ? '✓ Yes' : 'No'; }

    el.innerHTML = `
      <div class="two-col">
        <div>
          ${card('Personal details', [
            row('Full name', session.name),
            row('Date of birth', p.dob ? formatDate(p.dob) : ''),
            row('Gender', p.gender),
            row('Mobile / contact', p.mobile),
            row('Home telephone', p.homeTelephone),
            row('Email', p.email || p.personalEmail || p.officeEmail),
            row('Home address', p.homeAddress)
          ])}
          ${card('Emergency contact', [
            row('Name', p.emergencyName),
            row('Relationship', p.emergencyRelationship),
            row('Phone', p.emergencyPhone)
          ])}
          ${card('Employment', [
            row('Status', p.status),
            row('Start date', p.startDate ? formatDate(p.startDate) : ''),
            row('Review date', p.reviewDate ? formatDate(p.reviewDate) : ''),
            row('Leaving date', p.leavingDate ? formatDate(p.leavingDate) : ''),
            row('Contract type', p.contractType),
            row('Hours / week', p.hoursPerWeek),
            row('Hourly rate', p.hourlyRate ? `£${p.hourlyRate}` : ''),
            row('NI number', p.niNumber),
            row('Employee / ref ID', p.employeeId),
            row('Prescriber type', p.prescriberType)
          ])}
        </div>
        <div>
          ${card('Professional registration', [
            row('GPhC / HCPC number', p.gphcNumber),
            row('Registration expiry', p.gphcExpiry ? formatDate(p.gphcExpiry) : '')
          ])}
          ${card('Clinical systems', [
            row('Smartcard number', p.smartcardNumber),
            row('SystmOne access', p.systemOne !== undefined ? fmtBool(p.systemOne) : ''),
            row('EMIS access', p.emis !== undefined ? fmtBool(p.emis) : '')
          ])}
          ${card('Right to work', [
            row('Document', p.rightToWorkDoc),
            row('Expiry', p.rightToWorkExpiry ? formatDate(p.rightToWorkExpiry) : 'No expiry')
          ])}
          ${card('DBS check', [
            row('Certificate number', p.dbsCertNumber),
            row('Issue date', p.dbsIssueDate ? formatDate(p.dbsIssueDate) : ''),
            row('Auto DBS updates', p.autoDbs !== undefined ? fmtBool(p.autoDbs) : '')
          ])}
          ${card('Limited company &amp; bank details', [
            row('Company name', p.companyName),
            row('Companies House no.', p.companyRegNumber),
            row('VAT number', p.vatNumber),
            row('Registered address', p.companyAddress),
            row('Bank', p.bankName),
            row('Sort code', p.sortCode),
            row('Account number', p.accountNumber)
          ])}
          ${p.notes ? card('Notes', [row('', p.notes)]) : ''}
        </div>
      </div>`;
  }
  renderMyDetails();

  // --- Clinical calculators ---
  window.openCalc = function (tab) {
    document.getElementById('calcBackdrop').style.display = 'block';
    document.getElementById('calcModal').style.display    = 'flex';
    switchCalc(tab || 'egfr');
  };
  window.closeCalc = function () {
    document.getElementById('calcBackdrop').style.display = 'none';
    document.getElementById('calcModal').style.display    = 'none';
  };
  window.switchCalc = function (id) {
    document.querySelectorAll('.calc-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('cpanel-' + id).style.display = '';
    document.getElementById('ctab-'   + id).classList.add('active');
  };

  // Helpers
  function scrMgDl(val, unit) { return unit === 'umol' ? val / 88.42 : val; }
  function calcResult(el, html, cls) {
    el.style.display = '';
    el.className = 'calc-result ' + (cls || 'calc-result--teal');
    el.innerHTML = html;
  }
  function ckdStage(egfr) {
    if (egfr >= 90) return { stage: 'G1',  label: 'Normal or high',                        cls: 'calc-result--green'  };
    if (egfr >= 60) return { stage: 'G2',  label: 'Mildly decreased',                      cls: 'calc-result--teal'   };
    if (egfr >= 45) return { stage: 'G3a', label: 'Mildly to moderately decreased',         cls: 'calc-result--amber'  };
    if (egfr >= 30) return { stage: 'G3b', label: 'Moderately to severely decreased',       cls: 'calc-result--orange' };
    if (egfr >= 15) return { stage: 'G4',  label: 'Severely decreased',                     cls: 'calc-result--red'    };
    return             { stage: 'G5',  label: 'Kidney failure',                          cls: 'calc-result--red'    };
  }

  // eGFR — CKD-EPI 2021
  window.calcEgfr = function () {
    const age  = parseFloat(document.getElementById('egfr-age').value);
    const sex  = document.getElementById('egfr-sex').value;
    const scrRaw = parseFloat(document.getElementById('egfr-scr').value);
    const unit = document.getElementById('egfr-unit').value;
    const el   = document.getElementById('egfr-result');
    if (!age || !sex || !scrRaw) { el.style.display = 'none'; return; }
    const scr = scrMgDl(scrRaw, unit);
    const isFemale = sex === 'female';
    const k = isFemale ? 0.7 : 0.9;
    const a = isFemale ? -0.241 : -0.302;
    const ratio = scr / k;
    const egfr = 142 * Math.pow(Math.min(ratio, 1), a) * Math.pow(Math.max(ratio, 1), -1.200)
                     * Math.pow(0.9938, age) * (isFemale ? 1.012 : 1);
    const e    = Math.round(egfr);
    const ckd  = ckdStage(e);
    const stageMap = { G1: e>=90, G2: e>=60&&e<90, G3a: e>=45&&e<60, G3b: e>=30&&e<45, G4: e>=15&&e<30, G5: e<15 };
    calcResult(el, `
      <div class="calc-res-label">eGFR — CKD-EPI 2021</div>
      <div class="calc-res-main">${e} <span>mL/min/1.73m²</span></div>
      <div class="calc-res-sub">CKD Stage <strong>${ckd.stage}</strong> — ${ckd.label}</div>
      <div class="calc-res-table">
        <div>
          <span${stageMap.G1?' class="current"':''}>G1 ≥ 90</span>
          <span${stageMap.G2?' class="current"':''}>G2 60–89</span>
          <span${stageMap.G3a?' class="current"':''}>G3a 45–59</span>
          <span${stageMap.G3b?' class="current"':''}>G3b 30–44</span>
          <span${stageMap.G4?' class="current"':''}>G4 15–29</span>
          <span${stageMap.G5?' class="current"':''}>G5 &lt;15</span>
        </div>
      </div>`, ckd.cls);
  };

  // Creatinine clearance — Cockcroft-Gault
  window.calcCrcl = function () {
    const age  = parseFloat(document.getElementById('crcl-age').value);
    const sex  = document.getElementById('crcl-sex').value;
    const wt   = parseFloat(document.getElementById('crcl-wt').value);
    const scrRaw = parseFloat(document.getElementById('crcl-scr').value);
    const unit = document.getElementById('crcl-unit').value;
    const el   = document.getElementById('crcl-result');
    if (!age || !sex || !wt || !scrRaw) { el.style.display = 'none'; return; }
    const scr  = scrMgDl(scrRaw, unit);
    const crcl = ((140 - age) * wt * (sex === 'female' ? 0.85 : 1)) / (72 * scr);
    const c    = Math.round(crcl);
    let interp, cls;
    if (c >= 90)       { interp = 'Normal renal function';                                              cls = 'calc-result--green';  }
    else if (c >= 60)  { interp = 'Mild impairment — check individual drug SPC for dose adjustments';  cls = 'calc-result--teal';   }
    else if (c >= 30)  { interp = 'Moderate impairment — dose adjustment likely required';              cls = 'calc-result--amber';  }
    else if (c >= 15)  { interp = 'Severe impairment — significant dose adjustment or avoidance required'; cls = 'calc-result--orange'; }
    else               { interp = 'Very severe / kidney failure — most renally-cleared drugs contraindicated'; cls = 'calc-result--red'; }
    calcResult(el, `
      <div class="calc-res-label">Creatinine Clearance (Cockcroft-Gault)</div>
      <div class="calc-res-main">${c} <span>mL/min</span></div>
      <div class="calc-res-sub">${interp}</div>`, cls);
  };

  // BMI
  window.calcBmi = function () {
    const ht = parseFloat(document.getElementById('bmi-ht').value) / 100;
    const wt = parseFloat(document.getElementById('bmi-wt').value);
    const el = document.getElementById('bmi-result');
    if (!ht || !wt) { el.style.display = 'none'; return; }
    const bmi = wt / (ht * ht);
    const b   = bmi.toFixed(1);
    let cat, cls;
    if (bmi < 18.5)       { cat = 'Underweight';              cls = 'calc-result--purple'; }
    else if (bmi < 25)    { cat = 'Healthy weight';           cls = 'calc-result--green';  }
    else if (bmi < 30)    { cat = 'Overweight';               cls = 'calc-result--amber';  }
    else if (bmi < 35)    { cat = 'Obese class I';            cls = 'calc-result--orange'; }
    else if (bmi < 40)    { cat = 'Obese class II';           cls = 'calc-result--red';    }
    else                  { cat = 'Obese class III (severe)'; cls = 'calc-result--red';    }
    calcResult(el, `
      <div class="calc-res-label">Body Mass Index</div>
      <div class="calc-res-main">${b} <span>kg/m²</span></div>
      <div class="calc-res-sub"><strong>${cat}</strong></div>
      <div class="calc-res-detail">Height: ${(ht*100).toFixed(0)} cm &nbsp;·&nbsp; Weight: ${wt} kg</div>`, cls);
  };

  // IBW / ABW
  window.calcIbw = function () {
    const htCm = parseFloat(document.getElementById('ibw-ht').value);
    const sex  = document.getElementById('ibw-sex').value;
    const wt   = parseFloat(document.getElementById('ibw-wt').value);
    const el   = document.getElementById('ibw-result');
    if (!htCm || !sex) { el.style.display = 'none'; return; }
    const htIn = htCm / 2.54;
    const ibw  = sex === 'male' ? 50 + 2.3 * (htIn - 60) : 45.5 + 2.3 * (htIn - 60);
    const ibwR = Math.max(ibw, 0).toFixed(1);
    let abwHtml = '';
    if (wt && wt > ibw) {
      const abw = ibw + 0.4 * (wt - ibw);
      abwHtml = `<div class="calc-res-detail" style="margin-top:10px;">Adjusted body weight (ABW): <strong>${abw.toFixed(1)} kg</strong> — use for dosing when actual weight &gt; IBW</div>`;
    }
    const dosingWt = (wt && wt > ibw) ? `${(ibw + 0.4*(wt-ibw)).toFixed(1)} kg (ABW)` : `${ibwR} kg (IBW)`;
    calcResult(el, `
      <div class="calc-res-label">Ideal Body Weight (Devine)</div>
      <div class="calc-res-main">${ibwR} <span>kg IBW</span></div>
      <div class="calc-res-sub">Recommended dosing weight: <strong>${dosingWt}</strong></div>
      ${abwHtml}`, 'calc-result--teal');
  };

  // HbA1c converter
  window.calcHba1c = function (from) {
    const pctEl  = document.getElementById('hba1c-pct');
    const mmolEl = document.getElementById('hba1c-mmol');
    const el     = document.getElementById('hba1c-result');
    let pct, mmol;
    if (from === 'pct') {
      pct  = parseFloat(pctEl.value);
      if (!pct) { el.style.display = 'none'; return; }
      mmol = (pct - 2.15) * 10.929;
      mmolEl.value = Math.round(mmol);
    } else {
      mmol = parseFloat(mmolEl.value);
      if (!mmol) { el.style.display = 'none'; return; }
      pct  = mmol / 10.929 + 2.15;
      pctEl.value = pct.toFixed(1);
    }
    let interp, cls;
    if (mmol < 42)       { interp = 'Below diabetes threshold';                                                    cls = 'calc-result--green';  }
    else if (mmol < 48)  { interp = 'Non-diabetic hyperglycaemia (prediabetes) — consider lifestyle intervention'; cls = 'calc-result--amber';  }
    else if (mmol < 58)  { interp = 'Within typical type 2 diabetes treatment target (48–58 mmol/mol)';            cls = 'calc-result--teal';   }
    else if (mmol < 75)  { interp = 'Above target — review management';                                            cls = 'calc-result--orange'; }
    else                 { interp = 'Significantly elevated — urgent review';                                       cls = 'calc-result--red';    }
    calcResult(el, `
      <div class="calc-res-label">HbA1c Conversion</div>
      <div style="display:flex; gap:32px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px;">
        <div>
          <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;opacity:0.7;margin-bottom:2px;">IFCC</div>
          <div class="calc-res-main">${Math.round(mmol)} <span>mmol/mol</span></div>
        </div>
        <div style="font-size:2rem;opacity:0.5;padding-bottom:8px;">⇄</div>
        <div>
          <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;opacity:0.7;margin-bottom:2px;">NGSP</div>
          <div class="calc-res-main">${pct.toFixed(1)} <span>%</span></div>
        </div>
      </div>
      <div class="calc-res-sub">${interp}</div>`, cls);
  };

  // Alcohol units
  window.calcAlc = function () {
    const vol  = parseFloat(document.getElementById('alc-vol').value);
    const abv  = parseFloat(document.getElementById('alc-abv').value);
    const freq = parseInt(document.getElementById('alc-freq').value);
    const el   = document.getElementById('alc-result');
    if (!vol || !abv) { el.style.display = 'none'; return; }
    const units = (vol * abv) / 1000;
    const weekly = units * freq;
    let risk, cls;
    if (weekly <= 14)     { risk = 'Within low-risk guidelines (≤ 14 units/week)';              cls = 'calc-result--green';  }
    else if (weekly <= 21){ risk = 'Increasing risk — above recommended guidelines';              cls = 'calc-result--amber';  }
    else if (weekly <= 35){ risk = 'Higher risk — advise reduction and review medicines';         cls = 'calc-result--orange'; }
    else                  { risk = 'High risk — strongly advise reduction; check for interactions'; cls = 'calc-result--red';  }
    calcResult(el, `
      <div class="calc-res-label">Alcohol Units</div>
      <div class="calc-res-main">${units.toFixed(2)} <span>units per drink</span></div>
      <div class="calc-res-sub"><strong>${weekly.toFixed(1)} units/week</strong> at selected frequency</div>
      <div class="calc-res-detail">${risk}</div>`, cls);
  };

  // --- BP 7-day HBPM ---
  (function initBpTable() {
    const tbody = document.getElementById('bpRows');
    if (!tbody) return;
    for (let d = 1; d <= 7; d++) {
      const tr = document.createElement('tr');
      if (d === 1) tr.className = 'bp-day1';
      const exclude = d === 1 ? '<span class="bp-discard" title="Excluded per NICE NG136">excluded</span>' : '';
      tr.innerHTML = `
        <td class="bp-day-label">Day ${d} ${exclude}</td>
        <td><input class="bp-input" type="number" id="bp${d}-am-s" min="60" max="250" placeholder="mmHg" oninput="calcBp()"></td>
        <td><input class="bp-input" type="number" id="bp${d}-am-d" min="30" max="150" placeholder="mmHg" oninput="calcBp()"></td>
        <td><input class="bp-input bp-pulse" type="number" id="bp${d}-am-p" min="30" max="200" placeholder="bpm" oninput="calcBp()"></td>
        <td><input class="bp-input" type="number" id="bp${d}-pm-s" min="60" max="250" placeholder="mmHg" oninput="calcBp()"></td>
        <td><input class="bp-input" type="number" id="bp${d}-pm-d" min="30" max="150" placeholder="mmHg" oninput="calcBp()"></td>
        <td><input class="bp-input bp-pulse" type="number" id="bp${d}-pm-p" min="30" max="200" placeholder="bpm" oninput="calcBp()"></td>`;
      tbody.appendChild(tr);
    }
  })();

  window.calcBp = function () {
    const el = document.getElementById('bp-result');

    // Colour individual cells
    for (let d = 1; d <= 7; d++) {
      ['am', 'pm'].forEach(ses => {
        const si = document.getElementById(`bp${d}-${ses}-s`);
        const di = document.getElementById(`bp${d}-${ses}-d`);
        [si, di].forEach(inp => {
          if (!inp) return;
          inp.classList.remove('bp-high', 'bp-vhigh', 'bp-low');
          const v = parseFloat(inp.value);
          if (!v) return;
          const isSys = inp.id.endsWith('-s');
          if (isSys) {
            if (v >= 180)      inp.classList.add('bp-vhigh');
            else if (v >= 135) inp.classList.add('bp-high');
            else if (v < 90)   inp.classList.add('bp-low');
          } else {
            if (v >= 110)     inp.classList.add('bp-vhigh');
            else if (v >= 85) inp.classList.add('bp-high');
            else if (v < 60)  inp.classList.add('bp-low');
          }
        });
      });
    }

    // Collect readings — prefer Days 2-7 (NICE protocol); fall back to all if only Day 1 filled
    const d27Sys = [], d27Dia = [], d27Pul = [];
    const allSys = [], allDia = [], allPul = [];
    for (let d = 1; d <= 7; d++) {
      ['am', 'pm'].forEach(ses => {
        const s  = parseFloat(document.getElementById(`bp${d}-${ses}-s`).value);
        const dv = parseFloat(document.getElementById(`bp${d}-${ses}-d`).value);
        const p  = parseFloat(document.getElementById(`bp${d}-${ses}-p`).value);
        if (s && dv) { allSys.push(s); allDia.push(dv); if (d > 1) { d27Sys.push(s); d27Dia.push(dv); } }
        if (p)       { allPul.push(p); if (d > 1) d27Pul.push(p); }
      });
    }
    const niceProtocol  = d27Sys.length > 0;
    const readingsSys   = niceProtocol ? d27Sys  : allSys;
    const readingsDia   = niceProtocol ? d27Dia  : allDia;
    const readingsPulse = niceProtocol ? d27Pul  : allPul;

    // Build tfoot averages row
    const tfoot = document.getElementById('bpFoot');
    if (readingsSys.length === 0) {
      tfoot.innerHTML = '';
      el.style.display = 'none';
      return;
    }

    const avgSys = readingsSys.reduce((a, b) => a + b, 0) / readingsSys.length;
    const avgDia = readingsDia.reduce((a, b) => a + b, 0) / readingsDia.length;
    const avgPul = readingsPulse.length ? readingsPulse.reduce((a, b) => a + b, 0) / readingsPulse.length : null;
    const n = readingsSys.length;

    // NICE NG136 HBPM interpretation
    let category, cls, rec;
    if (avgSys >= 180 || avgDia >= 110) {
      category = 'Severe / accelerated hypertension';
      cls = 'calc-result--red';
      rec = 'Seek same-day urgent clinical assessment. Do not delay — if symptomatic (headache, visual disturbance, chest pain), consider 999.';
    } else if (avgSys >= 150 || avgDia >= 95) {
      category = 'Stage 2 hypertension';
      cls = 'calc-result--orange';
      rec = 'Consistent with clinic BP ≥ 160/100 mmHg. Offer drug treatment regardless of cardiovascular risk. Lifestyle advice alongside.';
    } else if (avgSys >= 135 || avgDia >= 85) {
      category = 'Stage 1 hypertension';
      cls = 'calc-result--amber';
      rec = 'Consistent with clinic BP ≥ 140/90 mmHg. Offer drug treatment if ≥ 10-year CVD risk ≥ 10% or target organ damage. Lifestyle advice in all cases.';
    } else if (avgSys < 90 || avgDia < 60) {
      category = 'Below normal — possible hypotension';
      cls = 'calc-result--purple';
      rec = 'Average reading is below normal range. Review symptoms (dizziness, syncope). Check medications for hypotensive effect.';
    } else {
      category = 'Within normal range (HBPM)';
      cls = 'calc-result--green';
      rec = 'Average HBPM reading is below the Stage 1 threshold. Continue healthy lifestyle. Repeat monitoring if clinically indicated.';
    }

    // Flag helpers
    function sysFlag(v) {
      if (v >= 180) return '<span class="bp-avg-flag red">Severe</span>';
      if (v >= 150) return '<span class="bp-avg-flag red">Stage 2</span>';
      if (v >= 135) return '<span class="bp-avg-flag amber">Stage 1</span>';
      if (v < 90)   return '<span class="bp-avg-flag blue">Low</span>';
      return '<span class="bp-avg-flag green">Normal</span>';
    }
    function diaFlag(v) {
      if (v >= 110) return '<span class="bp-avg-flag red">Severe</span>';
      if (v >= 95)  return '<span class="bp-avg-flag red">Stage 2</span>';
      if (v >= 85)  return '<span class="bp-avg-flag amber">Stage 1</span>';
      if (v < 60)   return '<span class="bp-avg-flag blue">Low</span>';
      return '<span class="bp-avg-flag green">Normal</span>';
    }

    const avgLabel = niceProtocol ? 'Avg (Days 2–7)' : 'Avg (preliminary)';
    tfoot.innerHTML = `
      <tr>
        <td style="text-align:left; padding-left:14px; font-size:0.75rem; color:var(--css-muted);">${avgLabel}<br><span style="font-weight:400;">${n} reading${n!==1?'s':''}</span></td>
        <td class="bp-avg-val">${avgSys.toFixed(0)} ${sysFlag(avgSys)}</td>
        <td class="bp-avg-val">${avgDia.toFixed(0)} ${diaFlag(avgDia)}</td>
        <td style="color:var(--css-muted); font-size:0.82rem;">${avgPul ? avgPul.toFixed(0)+' bpm' : '—'}</td>
        <td>—</td><td>—</td>
        <td style="color:var(--css-muted); font-size:0.82rem;">—</td>
      </tr>`;

    calcResult(el, `
      <div class="calc-res-label">NICE NG136 — Home Blood Pressure Monitoring (HBPM)</div>
      <div style="display:flex; gap:32px; align-items:flex-end; flex-wrap:wrap; margin-bottom:10px;">
        <div>
          <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;opacity:0.7;margin-bottom:2px;">AVG SYSTOLIC</div>
          <div class="calc-res-main">${avgSys.toFixed(0)} <span>mmHg</span></div>
        </div>
        <div style="font-size:2.2rem;opacity:0.45;padding-bottom:10px;">/</div>
        <div>
          <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;opacity:0.7;margin-bottom:2px;">AVG DIASTOLIC</div>
          <div class="calc-res-main">${avgDia.toFixed(0)} <span>mmHg</span></div>
        </div>
        ${avgPul ? `<div style="border-left:1px solid rgba(255,255,255,0.3);padding-left:24px;">
          <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;opacity:0.7;margin-bottom:2px;">AVG PULSE</div>
          <div class="calc-res-main">${avgPul.toFixed(0)} <span>bpm</span></div>
        </div>` : ''}
      </div>
      <div class="calc-res-sub"><strong>${category}</strong></div>
      <div class="calc-res-detail">${rec}</div>
      <div class="calc-res-detail" style="margin-top:6px; opacity:0.7;">${
        niceProtocol
          ? `Based on ${n} reading${n!==1?'s':''} from Days 2–7 (Day 1 excluded per NICE NG136)`
          : `⚠️ Preliminary — based on ${n} reading${n!==1?'s':''} from Day 1 only. Add Days 2–7 for a full NICE-protocol average.`
      }</div>`,
    cls);
  };

  // --- Incident reporting ---
  window.showIncidentForm = function () {
    const fresh = cssLoadDB();
    const p = (fresh.hrProfiles || {})[session.username] || {};
    // Pre-fill read-only fields
    document.getElementById('ir2Name').value     = session.name;
    document.getElementById('ir2Role').value     = p.prescriberType || session.role || '';
    document.getElementById('ir2Gphc').value     = p.gphcNumber || '';
    document.getElementById('ir2StatDate').value = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('ir6Date').value     = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('irFormMsg').textContent = '';
    document.getElementById('irFormBackdrop').style.display = 'block';
    document.getElementById('irFormModal').style.display    = 'flex';
  };

  window.closeIncidentForm = function () {
    document.getElementById('irFormBackdrop').style.display = 'none';
    document.getElementById('irFormModal').style.display    = 'none';
  };

  window.submitIncidentReport = function () {
    const msg = document.getElementById('irFormMsg');
    const sig = document.getElementById('ir6Sig').value.trim();
    if (!document.getElementById('ir1Practice').value.trim()) {
      msg.style.color = 'var(--css-red)'; msg.textContent = 'Please enter the GP Practice / PCN name (Section 1).'; return;
    }
    if (!document.getElementById('ir1Date').value) {
      msg.style.color = 'var(--css-red)'; msg.textContent = 'Please enter the date of the incident (Section 1).'; return;
    }
    if (!document.getElementById('ir31').value.trim()) {
      msg.style.color = 'var(--css-red)'; msg.textContent = 'Please complete Section 3.1 (your involvement in the event).'; return;
    }
    if (!sig) {
      msg.style.color = 'var(--css-red)'; msg.textContent = 'Please type your full name in Section 6 to sign the declaration.'; return;
    }

    const fresh = cssLoadDB();
    const p     = (fresh.hrProfiles || {})[session.username] || {};
    const num   = (fresh.incidentReports || []).length + 1;
    const id    = `IR-${new Date().getFullYear()}-${String(num).padStart(3, '0')}`;
    const today = toLocalIso(new Date());

    const report = {
      id, submittedAt: today, staffName: session.name, staffUsername: session.username,
      role:          p.prescriberType || session.role || '',
      gphcNumber:    p.gphcNumber || '',
      // Section 1
      practice:      document.getElementById('ir1Practice').value.trim(),
      incidentRef:   document.getElementById('ir1Ref').value.trim(),
      incidentDate:  document.getElementById('ir1Date').value,
      briefDescription: document.getElementById('ir1Brief').value.trim(),
      formIssuedDate:   document.getElementById('ir1Issued').value,
      // Section 3
      s31: document.getElementById('ir31').value.trim(),
      s32: document.getElementById('ir32').value.trim(),
      s33: document.getElementById('ir33').value.trim(),
      // Section 4
      s41: document.getElementById('ir41').value.trim(),
      s42: document.getElementById('ir42').value.trim(),
      s43: document.getElementById('ir43').value.trim(),
      s44: document.getElementById('ir44').value.trim(),
      s45: document.getElementById('ir45').value.trim(),
      // Section 5
      s51: document.getElementById('ir51').value.trim(),
      // Section 6
      signatureName: sig, signatureDate: today,
      status: 'Submitted', adminNotes: '', reviewedAt: ''
    };

    if (!fresh.incidentReports) fresh.incidentReports = [];
    fresh.incidentReports.push(report);
    cssSaveDB(fresh);

    // Show the submitted report as PDF preview
    closeIncidentForm();
    document.getElementById('irViewContent').innerHTML = cssRenderIncidentFull(report);
    document.getElementById('irViewBackdrop').style.display = 'block';
    document.getElementById('irViewModal').style.display    = 'flex';
  };

  window.closeIncidentView = function () {
    document.getElementById('irViewBackdrop').style.display = 'none';
    document.getElementById('irViewModal').style.display    = 'none';
  };

  // --- Nav ---
  window.showSection = function (name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-section]').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + name).classList.add('active');
    document.querySelector(`.nav-item[data-section="${name}"]`).classList.add('active');
    if (name === 'announcements') markAnnouncementsSeen();
  };

  // --- Notification bell ---
  function refreshBell() {
    const fresh = cssLoadDB();
    const today = new Date().toISOString().slice(0, 10);
    const soon  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const fourteenDays = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const notifs = [];

    // Holiday request status changes (approved / declined)
    (fresh.holidayRequests || [])
      .filter(h => h.name === session.name && (h.status === 'Approved' || h.status === 'Declined'))
      .forEach(h => notifs.push({
        id:      `holiday-${h.id}-${h.status}`,
        icon:    h.status === 'Approved' ? '✅' : '❌',
        title:   `Holiday ${h.status}`,
        text:    `${h.from} to ${h.to}`,
        section: 'holiday'
      }));

    // Certificate status changes (approved / rejected)
    (fresh.staffCertificates || [])
      .filter(c => c.username === session.username && (c.status === 'Approved' || c.status === 'Rejected'))
      .forEach(c => notifs.push({
        id:      `cert-${c.id}-${c.status}`,
        icon:    c.status === 'Approved' ? '✅' : '❌',
        title:   `Certificate ${c.status.toLowerCase()}`,
        text:    c.title,
        section: 'documents'
      }));

    // Certificates due soon or overdue
    (fresh.staffCertificates || [])
      .filter(c => c.username === session.username && c.status === 'Approved' && c.dueDate && !c.cleared)
      .forEach(c => {
        if (c.dueDate < today) {
          notifs.push({ id: `cert-expired-${c.id}`, icon: '🔴', title: 'Certificate expired', text: `${c.title} — expired ${formatDate(c.dueDate)}. Please upload a new copy.`, section: 'documents' });
        } else if (c.dueDate <= fourteenDays) {
          // Both reminders show once inside the 14-day window
          notifs.push({ id: `cert-due30-${c.id}`, icon: '⚠️', title: 'Certificate expiring within 30 days', text: `${c.title} — expires ${formatDate(c.dueDate)}.`, section: 'documents' });
          notifs.push({ id: `cert-due14-${c.id}`, icon: '🔔', title: 'Reminder: certificate expiring in 14 days', text: `${c.title} — please renew now.`, section: 'documents' });
        } else if (c.dueDate <= soon) {
          notifs.push({ id: `cert-due30-${c.id}`, icon: '⚠️', title: 'Certificate expiring within 30 days', text: `${c.title} — expires ${formatDate(c.dueDate)}.`, section: 'documents' });
        }
      });

    // Invoice updates (paid or declined)
    (fresh.invoices || [])
      .filter(i => i.name === session.name && (i.status === 'Paid' || i.status === 'Declined'))
      .forEach(i => notifs.push({
        id:      `invoice-${i.id}-${i.status}`,
        icon:    i.status === 'Paid' ? '💰' : '🚫',
        title:   `Invoice ${i.status}`,
        text:    i.id,
        section: 'invoicing'
      }));

    // Announcements (staff)
    (fresh.announcements || [])
      .filter(staffCanSee)
      .forEach(a => notifs.push({
        id:      `announcement-${a.id}`,
        icon:    '📣',
        title:   a.title,
        text:    '',
        section: 'announcements'
      }));

    // New staff documents (added within the last 7 days, visible to this staff member)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    (fresh.staffDocs || [])
      .filter(d => {
        if (!d.updated || d.updated < sevenDaysAgo) return false;
        const s = d.staffMembers;
        return !s || s === 'all' || (Array.isArray(s) && s.includes(session.username));
      })
      .forEach(d => notifs.push({
        id:      `staff-doc-${d.updated}-${d.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30)}`,
        icon:    '📄',
        title:   'New document available',
        text:    d.name,
        section: 'documents'
      }));

    window._bellRefresh = refreshBell;
    cssRenderBell('staff', notifs);
  }
  refreshBell();

  window.logout = function () {
    cssClearSession();
    window.location.href = 'index.html';
  };
})();
