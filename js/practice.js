/* CSS PCN / Practice Portal logic */

(function () {
  const session = cssGetSession();
  if (!session || session.kind !== 'practice') {
    window.location.href = 'index.html';
    return;
  }

  const db = cssLoadDB();

  // --- Sidebar / who box ---
  document.getElementById('whoBox').innerHTML =
    `<strong>${session.org}</strong>${session.name} · ${session.type}`;
  document.getElementById('welcomeLine').textContent =
    `${session.org} (${session.type}). Here's what's happening with your CSS services.`;

  // --- Dashboard stats ---
  const myRequests = db.serviceRequests.filter(r => r.org === session.org);
  const openRequests = myRequests.filter(r => r.status !== 'Completed');
  function practiceCanSee(a) {
    if (a.recipientPractices === 'all') return true;
    if (Array.isArray(a.recipientPractices)) return a.recipientPractices.includes(session.username);
    // legacy
    return a.audience === 'practice' || a.audience === 'both';
  }
  const newAnnouncements = db.announcements.filter(practiceCanSee);

  document.getElementById('statRequests').textContent = openRequests.length;
  document.getElementById('statAnnouncements').textContent = newAnnouncements.length;
  // Filter practice docs to only those visible to this practice
  const myPracticeDocs = db.practiceDocs.filter(d => {
    const p = d.practices;
    if (!p || p === 'all') return true;
    return Array.isArray(p) && p.includes(session.username);
  });
  document.getElementById('statDocs').textContent = myPracticeDocs.length;

  // --- Dashboard previews ---
  const dashAnn = document.getElementById('dashAnnouncements');
  newAnnouncements.slice(0, 3).forEach(a => {
    const li = announcementItem(a);
    // Dashboard click: navigate to Announcements section and open that item
    li.addEventListener('click', () => {
      showSection('announcements');
      // Switch to the right tab first, then open the item
      if (typeof filterAnnouncements === 'function') filterAnnouncements(a.type || 'all');
      setTimeout(() => {
        const target = document.querySelector(`#fullAnnouncements [data-ann-id="${a.id}"]`);
        if (target) { target.classList.add('open'); target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      }, 50);
    });
    dashAnn.appendChild(li);
  });
  if (!newAnnouncements.length) dashAnn.innerHTML = '<li class="empty-msg">No announcements right now.</li>';

  const dashReq = document.getElementById('dashRequests');
  const reqPreview = myRequests.length ? myRequests : db.serviceRequests;
  reqPreview.slice(0, 4).forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="notif-dot teal"></span><div><div><strong>${r.id}</strong> · ${r.service}</div><div class="notif-meta">${r.patients} patients · submitted ${formatDate(r.submitted)} · ${statusPill(r.status)}</div></div>`;
    dashReq.appendChild(li);
  });
  if (!reqPreview.length) dashReq.innerHTML = '<li class="empty-msg">No service requests yet.</li>';

  // --- Full announcements with tab filter ---
  const fullAnn = document.getElementById('fullAnnouncements');

  function renderAnnouncements(filter) {
    fullAnn.innerHTML = '';
    const filtered = newAnnouncements.filter(a => filter === 'all' || a.type === filter);
    if (!filtered.length) {
      fullAnn.innerHTML = `<li class="empty-msg">No ${filter === 'mhra' ? 'MHRA alerts' : filter === 'css' ? 'CSS updates' : 'announcements'} right now.</li>`;
      return;
    }
    filtered.forEach(a => {
      const card = announcementItem(a);
      card.addEventListener('click', () => card.classList.toggle('open'));
      fullAnn.appendChild(card);
    });
  }
  renderAnnouncements('all');

  window.filterAnnouncements = function(filter) {
    ['all','css','mhra'].forEach(f => {
      document.getElementById('annTab' + f.charAt(0).toUpperCase() + f.slice(1)).classList.toggle('active', f === filter);
    });
    renderAnnouncements(filter);
  };

  function announcementItem(a) {
    const isMhra = a.type === 'mhra';
    const icons = { red: '⚠️', amber: '📢', green: '✅', teal: 'ℹ️' };
    const card = document.createElement('div');
    card.className = `ann-card priority-${a.priority}`;
    card.dataset.annId = a.id;
    card.innerHTML = `
      <div class="ann-card-face">
        <div class="ann-card-icon ${isMhra ? 'mhra' : 'css'}">${isMhra ? '🏛️' : icons[a.priority] || 'ℹ️'}</div>
        <div class="ann-card-body-wrap">
          <div class="ann-card-title">${a.title}</div>
          <div class="ann-card-meta">
            <span class="ann-card-date">${formatDate(a.date)}</span>
            ${isMhra ? '<span class="pill red">MHRA</span>' : '<span class="pill teal">CSS</span>'}
            <span class="pill ${a.priority}">${priorityLabel(a.priority)}</span>
          </div>
        </div>
        <span class="ann-card-chevron">▼</span>
      </div>
      <div class="ann-card-detail">
        ${a.body}
        ${isMhra && a.source ? `<div class="ann-card-source">📌 ${a.source}${a.link ? ` · <a href="${a.link}" target="_blank" rel="noopener" onclick="event.stopPropagation()">View on gov.uk ↗</a>` : ''}</div>` : ''}
      </div>`;
    return card;
  }

  function priorityLabel(p) {
    return p === 'red' ? 'Action needed' : p === 'amber' ? 'Important' : p === 'green' ? 'Update' : 'Info';
  }

  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function statusPill(s) {
    const map = { Pending: 'amber', Approved: 'green', Declined: 'red', Submitted: 'teal', 'In progress': 'teal', Scheduled: 'amber', Completed: 'green' };
    return `<span class="pill ${map[s] || 'grey'}">${s}</span>`;
  }

  // --- Services & contract ---
  (function buildServices() {
    // Contract: prefer session copy; fall back to live DB (handles stale sessions)
    const dbUser = db.users.practice.find(u => u.username === session.username);
    const c = session.contract || (dbUser && dbUser.contract) || { pharmacists: '—', techs: '—', hoursPerWeek: '—', sessionsPerWeek: '—', validFrom: '2026-04-01', validTo: '2027-03-31', fundingModel: '—', notes: 'Contract details not available. Please contact the CSS office.' };
    const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    document.getElementById('contractPeriod').textContent =
      `Contract period: ${fmtDate(c.validFrom)} – ${fmtDate(c.validTo)} · ${c.fundingModel}`;

    const today = new Date().toISOString().slice(0, 10);
    const expired = today > c.validTo;
    const statusEl = document.getElementById('contractStatus');
    statusEl.textContent = expired ? 'Expired' : 'Active';
    statusEl.className = `pill ${expired ? 'red' : 'green'}`;

    const stats = [
      { num: c.pharmacists, label: 'Clinical Pharmacists' },
      { num: c.techs, label: 'Pharmacy Technicians' },
      { num: c.hoursPerWeek, label: 'Clinical hours / week' },
      { num: c.sessionsPerWeek, label: 'Sessions / week' }
    ];
    const statsEl = document.getElementById('contractStats');
    stats.forEach(s => {
      statsEl.innerHTML += `<div class="stat-card"><div class="num">${s.num}</div><div class="label">${s.label}</div></div>`;
    });

    document.getElementById('contractNotes').textContent = c.notes;

    const tileGrid = document.getElementById('svcTileGrid');
    const detailPanel = document.getElementById('svcDetailPanel');
    let activeTileId = null;

    const cssServices = (db.services || []).filter(s => {
      const p = s.practices;
      if (!p || p === 'all') return true;
      return Array.isArray(p) && p.includes(session.username);
    });
    if (document.getElementById('statServices')) document.getElementById('statServices').textContent = cssServices.length;
    cssServices.forEach(svc => {
      const tile = document.createElement('a');
      tile.className = 'tool-card';
      tile.id = 'tile-' + svc.id;
      tile.innerHTML = `<div class="ti">${svc.icon}</div><h4>${svc.name}</h4><p>${svc.summary.split('—')[0].trim()}</p>`;
      tile.addEventListener('click', () => {
        if (activeTileId === svc.id) {
          tile.classList.remove('active-tile');
          detailPanel.style.display = 'none';
          detailPanel.innerHTML = '';
          activeTileId = null;
          return;
        }
        if (activeTileId) document.getElementById('tile-' + activeTileId).classList.remove('active-tile');
        tile.classList.add('active-tile');
        activeTileId = svc.id;

        detailPanel.style.display = 'block';
        detailPanel.innerHTML = `
          <div class="panel svc-detail-panel">
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
              <h2 style="margin:0;">${svc.icon} ${svc.name}</h2>
              <button class="btn secondary small" onclick="document.getElementById('tile-${svc.id}').click()">Close ✕</button>
            </div>
            <p class="svc-summary-text">${svc.summary}</p>
            <div class="svc-grid">
              <div>
                <p class="svc-section-label">What's included</p>
                <ul class="svc-list">${svc.scope.map(s => `<li>${s}</li>`).join('')}</ul>
                <p class="svc-section-label">Referral criteria</p>
                <ul class="svc-list criteria">${svc.criteria.map(s => `<li>${s}</li>`).join('')}</ul>
              </div>
              <div>
                <div class="svc-meta-box">
                  <div class="svc-meta-row"><strong>Contracted capacity</strong>${svc.capacity}</div>
                  <div class="svc-meta-row"><strong>Turnaround</strong>${svc.turnaround}</div>
                  <div class="svc-meta-row"><strong>How to refer</strong>${svc.referral}</div>
                </div>
                <div style="margin-top:14px;">
                  <button class="btn small" onclick="showSection('requests')">Raise a request for this service</button>
                </div>
              </div>
            </div>
          </div>`;
        detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      tileGrid.appendChild(tile);
    });
  })();

  // --- Documents (folder view) ---
  (function buildDocFolders() {
    const folderIcons = {
      'Referral Forms':       '📋',
      'Contracts and MOU':    '📝',
      'Reports & supervisions': '📊',
      'CQC Support':          '🏛️',
      'Policies & Procedures':'🛡️',
    };

    // Group docs by folder, preserving order — only docs visible to this practice
    const groups = {};
    myPracticeDocs.forEach(d => {
      const key = d.folder || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    const container = document.getElementById('practiceDocList');
    container.className = 'folder-list';

    Object.entries(groups).forEach(([folderName, docs]) => {
      const item = document.createElement('li');
      item.className = 'folder-item';

      const header = document.createElement('div');
      header.className = 'folder-header';
      header.innerHTML = `
        <span class="folder-icon">${folderIcons[folderName] || '📁'}</span>
        <span class="folder-name">${folderName}</span>
        <span class="folder-count">${docs.length}</span>
        <span class="folder-chevron">▼</span>`;
      header.addEventListener('click', () => {
        const isOpen = item.classList.toggle('open');
        header.classList.toggle('open', isOpen);
      });

      const contents = document.createElement('div');
      contents.className = 'folder-contents';
      const ul = document.createElement('ul');
      ul.className = 'doc-list';

      docs.forEach(d => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div>
            <div class="doc-name">📄 ${d.name}</div>
            <div class="doc-meta">Updated ${formatDate(d.updated)}</div>
          </div>
          <button class="btn small secondary" onclick="alert('In the full version this would download: ${d.name.replace(/'/g, "\\'")}')">Download</button>`;
        ul.appendChild(li);
      });

      contents.appendChild(ul);
      item.appendChild(header);
      item.appendChild(contents);
      container.appendChild(item);
    });
  })();

  // --- Service requests ---
  const CONCERNS_OPTION = 'Concerns or feedback about a pharmacist';
  const reqServiceEl = document.getElementById('reqService');
  const patientsField = document.getElementById('patientsField');

  function togglePatientsField() {
    const isConcern = reqServiceEl.value === CONCERNS_OPTION;
    patientsField.style.display = isConcern ? 'none' : 'block';
    document.getElementById('reqPatients').value = '';
  }
  reqServiceEl.addEventListener('change', togglePatientsField);

  function formatTs(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function renderPracticeThread(r) {
    const msgs = r.messages || [];
    const bubbles = msgs.length ? msgs.map(m => {
      const isAdmin = m.from === 'admin';
      return `<div style="display:flex; flex-direction:column; align-items:${isAdmin ? 'flex-start' : 'flex-end'}; margin-bottom:8px;">
        <div style="max-width:75%; background:${isAdmin ? 'var(--css-teal)' : 'var(--css-bg)'}; color:${isAdmin ? '#fff' : 'inherit'}; border:1px solid ${isAdmin ? 'var(--css-teal)' : 'var(--css-border)'}; border-radius:12px; padding:8px 12px; font-size:0.88rem;">
          ${m.text}
        </div>
        <div style="font-size:0.75rem; color:var(--css-muted); margin-top:3px;">${isAdmin ? 'CSS Admin' : 'You'} · ${formatTs(m.ts)}</div>
      </div>`;
    }).join('') : '<div style="color:var(--css-muted); font-size:0.85rem; margin-bottom:10px;">No messages yet. You can add a note below.</div>';

    const canReply = r.status !== 'Completed' && r.status !== 'Cancelled';
    return `<td colspan="7" style="padding:0;">
      <div style="border-top:2px solid var(--css-teal); background:var(--css-surface); padding:16px 20px;">
        <div style="max-height:260px; overflow-y:auto; margin-bottom:${canReply ? '12px' : '0'};" id="pthread-msgs-${r.id}">${bubbles}</div>
        ${canReply ? `<div style="display:flex; gap:8px; align-items:flex-end;">
          <textarea id="pthread-input-${r.id}" rows="2" placeholder="Add a note or question for the CSS team…"
            style="flex:1; resize:vertical; min-height:48px; padding:8px 10px; border:1px solid var(--css-border); border-radius:6px; font-size:0.88rem; font-family:inherit; background:var(--css-bg);"></textarea>
          <button class="btn small" onclick="practiceReplyRequest('${r.id}')">Send</button>
        </div>` : `<p class="notif-meta" style="margin:0;">This request is ${r.status.toLowerCase()} — no further replies needed.</p>`}
        ${r.note ? `<div style="margin-top:10px; font-size:0.82rem; color:var(--css-muted);">📝 <strong>Original note:</strong> ${r.note}</div>` : ''}
      </div>
    </td>`;
  }

  function renderRequests() {
    const tbody = document.getElementById('requestTable');
    tbody.innerHTML = '';
    const fresh = cssLoadDB();
    const mine = fresh.serviceRequests.filter(r => r.org === session.org);
    if (!mine.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No requests submitted yet.</td></tr>'; return; }
    mine.forEach(r => {
      const msgs = r.messages || [];
      const seen = cssGetSeenNotifs('practice');
      const unreadCount = msgs.filter(m => m.from === 'admin' && !seen.has(`practice-msg-${r.id}-${m.ts}`)).length;
      const badge = unreadCount ? `<span style="display:inline-flex;align-items:center;justify-content:center;background:var(--css-amber);color:#fff;border-radius:50%;width:18px;height:18px;font-size:0.7rem;font-weight:700;margin-left:4px;">${unreadCount}</span>` : '';
      const threadCount = msgs.length ? `<span class="notif-meta">(${msgs.length})</span>` : '';

      const printBtn = r.status === 'Completed'
        ? `<button class="btn small secondary" onclick="event.stopPropagation(); printServiceRequest('${r.id}')" style="margin-left:4px;" title="Print completed request summary">🖨️ Print</button>`
        : '';

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `<td>${r.id}</td><td>${r.service}</td><td>${r.patients || '—'}</td><td>${r.attachment ? '📎' : ''}</td><td>${formatDate(r.submitted)}</td><td>${statusPill(r.status)}</td>
        <td style="white-space:nowrap;">
          <button class="btn small" onclick="event.stopPropagation(); togglePracticeThread('${r.id}')">💬 ${threadCount}${badge}</button>
          ${printBtn}
        </td>`;
      tr.addEventListener('click', () => togglePracticeThread(r.id));

      const detailTr = document.createElement('tr');
      detailTr.id = `preq-detail-${r.id}`;
      detailTr.style.display = 'none';
      detailTr.innerHTML = renderPracticeThread(r);

      tbody.appendChild(tr);
      tbody.appendChild(detailTr);
    });
  }
  renderRequests();

  window.togglePracticeThread = function (id) {
    const db = cssLoadDB();
    const r = db.serviceRequests.find(x => x.id === id);
    if (r) {
      (r.messages || []).filter(m => m.from === 'admin').forEach(m => cssMarkSeenNotif('practice', `practice-msg-${id}-${m.ts}`));
    }
    const row = document.getElementById(`preq-detail-${id}`);
    if (!row) return;
    const isOpen = row.style.display !== 'none';
    document.querySelectorAll('[id^="preq-detail-"]').forEach(el => el.style.display = 'none');
    if (!isOpen) {
      row.style.display = '';
      const msgsDiv = row.querySelector(`#pthread-msgs-${id}`);
      if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
    }
    if (window._bellRefresh) window._bellRefresh();
  };

  window.practiceReplyRequest = function (id) {
    const input = document.getElementById(`pthread-input-${id}`);
    const text = (input ? input.value : '').trim();
    if (!text) return;
    const db = cssLoadDB();
    const r = db.serviceRequests.find(x => x.id === id);
    if (!r) return;
    if (!r.messages) r.messages = [];
    const ts = new Date().toISOString();
    r.messages.push({ from: 'practice', author: session.org, text, ts });
    cssSaveDB(db);
    renderRequests();
    const row = document.getElementById(`preq-detail-${id}`);
    if (row) {
      row.style.display = '';
      const msgsDiv = row.querySelector(`#pthread-msgs-${id}`);
      if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
    }
  };

  window.submitRequest = function () {
    const service = reqServiceEl.value;
    const isConcern = service === CONCERNS_OPTION;
    const patients = isConcern ? null : parseInt(document.getElementById('reqPatients').value, 10);
    const note = document.getElementById('reqNote').value.trim();
    const fileInput = document.getElementById('reqFile');
    const fileName = fileInput.files.length ? fileInput.files[0].name : null;
    const msg = document.getElementById('reqMsg');
    if (!isConcern && (!patients || patients <= 0)) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Please enter the approximate number of patients.'; return; }
    if (isConcern && !note) { msg.style.color = 'var(--css-red)'; msg.textContent = 'Please add some details in the notes field.'; return; }
    const fresh = cssLoadDB();
    const num = fresh.serviceRequests.length + 1043;
    const id = `SR-${num}`;
    const today = new Date().toISOString().slice(0, 10);
    fresh.serviceRequests.unshift({ id, org: session.org, service, patients, submitted: today, status: isConcern ? 'Received' : 'Submitted', note, attachment: fileName, messages: [] });
    cssSaveDB(fresh);
    msg.style.color = 'var(--css-green)';
    msg.textContent = isConcern
      ? `${id} received — the CSS management team will follow up confidentially.`
      : `${id} submitted — the CSS team will be in touch to confirm scheduling.${fileName ? ' Document noted: ' + fileName : ''}`;
    document.getElementById('reqPatients').value = '';
    document.getElementById('reqNote').value = '';
    document.getElementById('reqFile').value = '';
    renderRequests();
    setTimeout(() => msg.textContent = '', 6000);
  };

  // --- Print service request summary ---
  window.printServiceRequest = function (id) {
    const db = cssLoadDB();
    const r = db.serviceRequests.find(x => x.id === id);
    if (!r) return;

    const msgs = r.messages || [];
    const fmtDate = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const fmtTs   = ts  => { if (!ts) return ''; const d = new Date(ts); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
    const printedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const msgHtml = msgs.length ? msgs.map(m => {
      const isAdmin = m.from === 'admin';
      return `<div style="margin-bottom:12px; padding:10px 14px; border-left:4px solid ${isAdmin ? '#00796b' : '#9e9e9e'}; background:${isAdmin ? '#f0f9f7' : '#f7f7f7'};">
        <div style="font-size:0.78rem; color:#666; margin-bottom:4px;"><strong>${isAdmin ? 'CSS Admin' : (m.author || r.org)}</strong> &nbsp;·&nbsp; ${fmtTs(m.ts)}</div>
        <div style="font-size:0.9rem;">${m.text}</div>
      </div>`;
    }).join('') : '<p style="color:#888; font-size:0.9rem;">No messages on this request.</p>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Service Request ${r.id} — CSS Portal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; }
    .page { max-width: 720px; margin: 0 auto; padding: 36px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #00796b; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 1.1rem; font-weight: 700; color: #00796b; line-height: 1.3; }
    .brand small { display: block; font-size: 0.78rem; color: #555; font-weight: 400; margin-top: 3px; }
    .ref { font-size: 1.6rem; font-weight: 700; text-align: right; line-height: 1.1; }
    .status-badge { display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 20px; background: #00796b; color: #fff; font-size: 0.8rem; font-weight: 600; }
    .section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #00796b; margin: 22px 0 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; }
    .detail-item label { display: block; font-size: 0.75rem; color: #888; margin-bottom: 1px; }
    .detail-item .val { font-weight: 600; font-size: 0.92rem; }
    .note-box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; font-size: 0.88rem; line-height: 1.5; }
    .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 0.75rem; color: #999; display: flex; justify-content: space-between; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">Clinical Support Solutions<small>Service Request Summary</small></div>
      <div style="margin-top:8px; font-size:0.82rem; color:#555;">${r.org}</div>
    </div>
    <div>
      <div class="ref">${r.id}</div>
      <div style="text-align:right;"><span class="status-badge">${r.status}</span></div>
    </div>
  </div>

  <div class="section-label">Request details</div>
  <div class="detail-grid">
    <div class="detail-item"><label>Service</label><div class="val">${r.service}</div></div>
    <div class="detail-item"><label>Organisation</label><div class="val">${r.org}</div></div>
    <div class="detail-item"><label>Approx. patients</label><div class="val">${r.patients || '—'}</div></div>
    <div class="detail-item"><label>Date submitted</label><div class="val">${fmtDate(r.submitted)}</div></div>
  </div>

  ${r.note ? `<div class="section-label">Notes submitted with request</div><div class="note-box">${r.note}</div>` : ''}

  <div class="section-label">Correspondence (${msgs.length} message${msgs.length !== 1 ? 's' : ''})</div>
  ${msgHtml}

  <div class="footer">
    <span>Clinical Support Solutions · clinicalsupportsolutions.co.uk</span>
    <span>Printed ${printedAt}</span>
  </div>
</div>
<script>window.onload = function () { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups for this site to print.'); return; }
    win.document.write(html);
    win.document.close();
  };

  // --- Contacts ---
  (function renderContacts() {
    const tbody = document.getElementById('practiceContactList');
    if (!tbody) return;
    const fresh = cssLoadDB();
    const contacts = (fresh.contacts || []).filter(c => {
      const p = c.practices;
      if (!p || p === 'all') return true;
      return Array.isArray(p) && p.includes(session.username);
    });
    if (!contacts.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No contacts have been added yet. Contact the CSS office for assistance.</td></tr>';
      return;
    }
    tbody.innerHTML = contacts.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.role}</td>
        <td><span class="notif-meta">${c.covers || '—'}</span></td>
        <td>${c.email ? `<a href="mailto:${c.email}" style="color:var(--css-teal);">${c.email}</a>` : '—'}</td>
        <td>${c.phone || '—'}</td>
      </tr>`).join('');
  })();

  // ===================== CQC Clinical Safety Report =====================

  let cqcActiveSection = 'all';
  let _cqcVersionIdx   = 0; // index into the practice's report array (0 = latest)

  // RAG thresholds — use % when denom available, otherwise fall back to count
  // urgentIfAny: any count > 0 is immediately High (used for DMARD items)
  function cqcRag(count, notes, denom, urgentIfAny) {
    if (count === 0 || (notes || '').trim().toLowerCase().startsWith('no action')) {
      return { colour: '#00703C', bg: '#e6f4ed', label: 'Clear' };
    }
    if (urgentIfAny) {
      return { colour: '#b10e1e', bg: '#fde8e8', label: 'Urgent' };
    }
    const pct = (denom && denom > 0) ? (count / denom) * 100 : null;
    if (pct !== null) {
      if (pct >= 30) return { colour: '#b10e1e', bg: '#fde8e8', label: 'High' };
      if (pct >= 10) return { colour: '#c45000', bg: '#fff3e8', label: 'Medium' };
      return { colour: '#c45000', bg: '#fff8e6', label: 'Low' };
    }
    // fallback: absolute count
    if (count >= 50) return { colour: '#b10e1e', bg: '#fde8e8', label: 'High' };
    if (count >= 10) return { colour: '#c45000', bg: '#fff3e8', label: 'Medium' };
    return { colour: '#c45000', bg: '#fff8e6', label: 'Low' };
  }


  function renderCQC() {
    const fresh     = cssLoadDB();
    const rawReport = (fresh.cqcReports || {})[session.username];

    // Normalise: support both array (new) and single-object (legacy)
    const reportList = Array.isArray(rawReport) ? rawReport
                     : rawReport ? [rawReport] : [];

    const noReport = `<div class="panel" style="text-align:center; color:var(--css-muted); padding:48px;">
      No CQC clinical safety report on file for ${session.org}.<br>Contact CSS to set this up.
    </div>`;

    if (!reportList.length) {
      document.getElementById('cqcSummaryRow').innerHTML  = noReport;
      document.getElementById('cqcSectionGrid').innerHTML = '';
      document.getElementById('cqcDetailBody').innerHTML  = '';
      document.getElementById('cqcReportMeta').innerHTML  = '';
      const vb = document.getElementById('cqcVersionBar');
      if (vb) vb.style.display = 'none';
      return;
    }

    // --- Version dropdown ---
    const versionBar = document.getElementById('cqcVersionBar');
    const versionSel = document.getElementById('cqcVersionSelect');
    if (versionBar && versionSel) {
      if (reportList.length > 1) {
        versionBar.style.display = 'flex';
        versionSel.innerHTML = reportList.map((r, i) => {
          const d = new Date((r.reportDate || '') + 'T12:00:00');
          const label = !isNaN(d.getTime())
            ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : (r.reportDate || `Report ${i + 1}`);
          return `<option value="${i}">${label}${i === 0 ? ' (latest)' : ''}</option>`;
        }).join('');
        versionSel.value = _cqcVersionIdx;
      } else {
        versionBar.style.display = 'none';
      }
    }

    const report = reportList[_cqcVersionIdx] || reportList[0];

    // Report meta — show upload date with staleness indicator
    (function renderReportMeta() {
      const dateStr = report.reportDate || '';
      let dateFmt = dateStr;
      let ageBadge = '';
      if (dateStr) {
        const d = new Date(dateStr + (dateStr.length === 7 ? '-01' : '') + 'T12:00:00');
        if (!isNaN(d)) {
          dateFmt = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          const ageMs   = Date.now() - d.getTime();
          const ageDays = Math.floor(ageMs / 86400000);
          const ageWeeks = Math.floor(ageDays / 7);
          let ageLabel, ageColour, ageBg;
          if (ageDays <= 30) {
            ageLabel  = ageDays <= 7 ? 'This week' : `${ageWeeks} week${ageWeeks !== 1 ? 's' : ''} ago`;
            ageColour = '#00703C'; ageBg = '#e6f4ed';
          } else if (ageDays <= 90) {
            ageLabel  = `${ageWeeks} weeks ago`;
            ageColour = '#c45000'; ageBg = '#fff3e8';
          } else {
            const ageMonths = Math.floor(ageDays / 30);
            ageLabel  = `${ageMonths} month${ageMonths !== 1 ? 's' : ''} ago — consider refreshing`;
            ageColour = '#b10e1e'; ageBg = '#fde8e8';
          }
          ageBadge = `<span style="display:inline-block; margin-left:6px; padding:2px 8px; border-radius:20px; font-size:0.75rem; font-weight:600; color:${ageColour}; background:${ageBg};">${ageLabel}</span>`;
        }
      }
      document.getElementById('cqcReportMeta').innerHTML =
        `Prepared by ${report.preparedBy}<br>` +
        `<span style="font-weight:600;">Data extracted: ${dateFmt}</span>${ageBadge}`;
    })();

    const sections = report.sections || [];

    // --- Summary stats ---
    const allItems   = sections.flatMap(s => s.items);
    const totalPts   = allItems.reduce((s, i) => s + (i.count || 0), 0);
    const highCount  = allItems.filter(i => { const r = cqcRag(i.count, i.notes, i.denom || null, i.urgentIfAny); return r.label === 'High' || r.label === 'Urgent'; }).length;
    const medCount   = allItems.filter(i => { const r = cqcRag(i.count, i.notes, i.denom || null, i.urgentIfAny); return r.label === 'Medium' || r.label === 'Low'; }).length;
    const clearCount = allItems.filter(i => cqcRag(i.count, i.notes, i.denom || null, i.urgentIfAny).label === 'Clear').length;

    document.getElementById('cqcSummaryRow').innerHTML = `
      <div class="cqc-stat" style="border-top:3px solid #1d70b8;">
        <div class="cqc-stat-num">${allItems.length}</div>
        <div class="cqc-stat-lbl">Total indicators</div>
      </div>
      <div class="cqc-stat" style="border-top:3px solid #505a5f;">
        <div class="cqc-stat-num">${totalPts.toLocaleString()}</div>
        <div class="cqc-stat-lbl">Total patients flagged</div>
      </div>
      <div class="cqc-stat" style="border-top:3px solid #b10e1e;">
        <div class="cqc-stat-num">${highCount}</div>
        <div class="cqc-stat-lbl">🔴 High priority (50+ patients)</div>
      </div>
      <div class="cqc-stat" style="border-top:3px solid #c45000;">
        <div class="cqc-stat-num">${medCount}</div>
        <div class="cqc-stat-lbl">🟡 Needs attention</div>
      </div>
      <div class="cqc-stat" style="border-top:3px solid #00703C;">
        <div class="cqc-stat-num">${clearCount}</div>
        <div class="cqc-stat-lbl">✅ Clear / no action</div>
      </div>`;

    // --- Section cards ---
    document.getElementById('cqcSectionGrid').innerHTML = sections.map(sec => {
      const total   = sec.items.reduce((s, i) => s + (i.count || 0), 0);
      const high    = sec.items.filter(i => { const r = cqcRag(i.count, i.notes, i.denom || null, i.urgentIfAny); return r.label === 'High' || r.label === 'Urgent'; }).length;
      const clear   = sec.items.filter(i => cqcRag(i.count, i.notes, i.denom || null, i.urgentIfAny).label === 'Clear').length;
      const topBorder = high > 0 ? '#b10e1e' : total > 0 ? '#c45000' : '#00703C';
      return `
        <div class="cqc-sec-card" style="border-top:3px solid ${topBorder};" onclick="setCQCSection('${sec.id}')">
          <div class="cqc-sec-icon">${sec.icon}</div>
          <div class="cqc-sec-title">${sec.title}</div>
          <div class="cqc-sec-total">${total.toLocaleString()} <span>patients</span></div>
          <div class="cqc-sec-pills">
            ${high  ? `<span class="cqc-status-chip" style="color:#b10e1e;background:#fde8e8;">${high} high</span>`  : ''}
            ${clear ? `<span class="cqc-status-chip" style="color:#00703C;background:#e6f4ed;">${clear} clear</span>` : ''}
          </div>
          <div class="cqc-sec-link">View details →</div>
        </div>`;
    }).join('');

    // --- Filter tabs ---
    const tabs = document.getElementById('cqcFilterTabs');
    tabs.innerHTML = [{ id: 'all', icon: '📋', title: 'All' }, ...sections].map(s => {
      const active = s.id === cqcActiveSection ? ' cqc-tab--active' : '';
      return `<button class="cqc-tab${active}" onclick="setCQCSection('${s.id}')">${s.icon || '📋'} ${s.title || 'All'}</button>`;
    }).join('');

    renderCQCDetail(sections);
  }

  function renderCQCDetail(sections) {
    const filtered = cqcActiveSection === 'all'
      ? sections
      : sections.filter(s => s.id === cqcActiveSection);

    const title = cqcActiveSection === 'all'
      ? 'All areas'
      : (sections.find(s => s.id === cqcActiveSection) || {}).title || '';
    document.getElementById('cqcDetailTitle').textContent = title;

    const rows = filtered.flatMap(sec =>
      sec.items.map(item => {
        const denom    = item.denom || null;
        const rag      = cqcRag(item.count, item.notes, denom, item.urgentIfAny);
        const noAction = item.count === 0 || item.notes.toLowerCase().startsWith('no action');
        const pctStr   = (denom && denom > 0)
          ? `<span style="font-weight:600; color:${rag.colour};">${((item.count / denom) * 100).toFixed(1)}%</span>`
          : `<span style="color:var(--css-muted);" title="Denominator not available in SystmOne report">N/A</span>`;
        const denomStr = denom ? denom.toLocaleString() : `<span style="color:var(--css-muted);" title="Denominator not available in SystmOne report">N/A</span>`;
        return `<tr style="${noAction ? 'opacity:0.6;' : ''}">
          <td>${item.name}</td>
          <td style="text-align:center;">
            <span class="cqc-count-badge" style="color:${rag.colour}; background:${rag.bg};">${item.count}</span>
          </td>
          <td style="text-align:center; color:var(--css-muted);">${denomStr}</td>
          <td style="text-align:center;">${pctStr}</td>
          <td style="font-size:0.82rem; color:var(--css-muted);">${item.notes}</td>
        </tr>`;
      })
    );

    document.getElementById('cqcDetailBody').innerHTML = rows.join('') ||
      `<tr><td colspan="5" style="text-align:center; color:var(--css-muted); padding:24px;">No items.</td></tr>`;
  }

  window.setCQCSection = function (id) {
    cqcActiveSection = id;
    // Update tab active state
    document.querySelectorAll('#cqcFilterTabs .cqc-tab').forEach(btn => {
      btn.classList.toggle('cqc-tab--active', btn.getAttribute('onclick').includes(`'${id}'`));
    });
    const fresh2    = cssLoadDB();
    const rawRpt2   = (fresh2.cqcReports || {})[session.username];
    const rptList2  = Array.isArray(rawRpt2) ? rawRpt2 : (rawRpt2 ? [rawRpt2] : []);
    const rpt2      = rptList2[_cqcVersionIdx] || rptList2[0];
    if (rpt2) renderCQCDetail(rpt2.sections || []);
    // Scroll to detail table
    document.getElementById('cqcDetailTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- Nav ---
  window.showSection = function (name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-section]').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + name).classList.add('active');
    document.querySelector(`.nav-item[data-section="${name}"]`).classList.add('active');
    if (name === 'cqc') { _cqcVersionIdx = 0; renderCQC(); }
  };

  // Switch CQC report version (called by the version <select> dropdown)
  window.switchCQCVersion = function (idx) {
    _cqcVersionIdx = parseInt(idx, 10) || 0;
    renderCQC();
  };

  // ---- CQC PDF / Print report ----
  window.printCQCReport = function () {
    const fresh      = cssLoadDB();
    const rawReport  = (fresh.cqcReports || {})[session.username];
    const reportList = Array.isArray(rawReport) ? rawReport : (rawReport ? [rawReport] : []);
    if (!reportList.length) { alert('No CQC report on file.'); return; }

    const report  = reportList[_cqcVersionIdx] || reportList[0];
    const sections = report.sections || [];

    const fmtDate = iso => {
      const d = new Date((iso || '') + 'T12:00:00');
      return isNaN(d) ? (iso || '—') : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // RAG inline (mirrors cqcRag)
    const rag = (count, notes, denom, urgentIfAny) => {
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
    };

    const allItems   = sections.flatMap(s => s.items || []);
    const highCount  = allItems.filter(i => { const r = rag(i.count, i.notes, i.denom, i.urgentIfAny); return r.label === 'High' || r.label === 'Urgent'; }).length;
    const medCount   = allItems.filter(i => { const r = rag(i.count, i.notes, i.denom, i.urgentIfAny); return r.label === 'Medium' || r.label === 'Low'; }).length;
    const clearCount = allItems.filter(i => rag(i.count, i.notes, i.denom, i.urgentIfAny).label === 'Clear').length;
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
              const r      = rag(item.count, item.notes, item.denom, item.urgentIfAny);
              const denom  = item.denom || null;
              const pctStr = (denom && denom > 0)
                ? ((item.count / denom) * 100).toFixed(1) + '%'
                : 'N/A';
              const noAct  = r.label === 'Clear';
              return `<tr style="background:${noAct ? '#fff' : r.bg}">
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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CQC Clinical Safety Report — ${report.practice || session.org}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a2e; background: #fff; padding: 20px 28px; }
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0d6e8a; padding-bottom: 14px; margin-bottom: 18px; }
  .report-header .brand { font-size: 11pt; font-weight: 700; color: #0d6e8a; }
  .report-header .brand small { display: block; font-size: 8pt; font-weight: 400; color: #666; }
  .report-header .meta { text-align: right; font-size: 8.5pt; color: #555; line-height: 1.6; }
  .report-title { font-size: 17pt; font-weight: 700; color: #1a1a2e; margin-bottom: 2px; }
  .report-subtitle { font-size: 10pt; color: #555; margin-bottom: 16px; }
  .summary-bar { display: flex; gap: 12px; margin-bottom: 22px; }
  .stat-box { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; text-align: center; }
  .stat-box .num { font-size: 22pt; font-weight: 700; line-height: 1.2; }
  .stat-box .lbl { font-size: 8pt; color: #666; margin-top: 2px; }
  .stat-box.red  { border-color: #b10e1e33; background: #fde8e8; }
  .stat-box.red .num { color: #b10e1e; }
  .stat-box.amber { border-color: #c4500033; background: #fff3e8; }
  .stat-box.amber .num { color: #c45000; }
  .stat-box.green { border-color: #00703c33; background: #e6f4ed; }
  .stat-box.green .num { color: #00703c; }
  .stat-box.blue  { border-color: #0d6e8a33; background: #e8f4f8; }
  .stat-box.blue .num { color: #0d6e8a; }
  .section-block { margin-bottom: 20px; break-inside: avoid; }
  .section-heading { font-size: 11pt; font-weight: 700; color: #0d6e8a; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1.5px solid #0d6e8a44; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 6px; }
  th { background: #f0f4f8; padding: 5px 6px; text-align: left; border-bottom: 1.5px solid #ccc; font-weight: 600; color: #333; }
  td { padding: 5px 6px; border-bottom: 1px solid #e8e8e8; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 7.5pt; color: #888; text-align: center; }
  @media print {
    body { padding: 0; }
    .section-block { break-inside: avoid-page; }
    @page { margin: 15mm 12mm; size: A4; }
  }
</style>
</head>
<body>
<div class="report-header">
  <div>
    <div class="brand">Clinical Support Solutions (CSS)<small>CQC Clinical Safety Report</small></div>
    <div class="report-title" style="margin-top:10px">${report.practice || session.org}</div>
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
  This report was generated from SystmOne CQC Inspection Search data and is intended for internal clinical governance use only.
  Prepared by Clinical Support Solutions (CSS) — ${report.preparedBy || 'CSS'} &nbsp;·&nbsp; Data date: ${fmtDate(report.reportDate)}
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Pop-up blocked — please allow pop-ups for this page and try again.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  window.logout = function () {
    cssClearSession();
    window.location.href = 'index.html';
  };

  // --- Notification bell ---
  function refreshBell() {
    const fresh = cssLoadDB();
    const today = new Date().toISOString().slice(0, 10);
    const notifs = [];
    const myOrg = session.org;

    // Service request status updates (in progress / completed / scheduled)
    (fresh.serviceRequests || [])
      .filter(r => r.org === myOrg && ['In progress', 'Scheduled', 'Completed'].includes(r.status))
      .forEach(r => notifs.push({
        id:      `practice-req-${r.id}-${r.status.replace(/\s/g,'')}`,
        icon:    r.status === 'Completed' ? '✅' : '🔄',
        title:   `Request ${r.status.toLowerCase()}`,
        text:    `${r.service} · ${r.id}`,
        section: 'requests'
      }));

    // Unread replies from CSS admin on service requests
    const seenMsgs = cssGetSeenNotifs('practice');
    (fresh.serviceRequests || [])
      .filter(r => r.org === myOrg)
      .forEach(r => {
        (r.messages || []).filter(m => m.from === 'admin').forEach(m => {
          const nid = `practice-msg-${r.id}-${m.ts}`;
          if (!seenMsgs.has(nid)) {
            notifs.push({
              id:      nid,
              icon:    '💬',
              title:   'Reply from CSS team',
              text:    `${r.id} · ${r.service}`,
              section: 'requests'
            });
          }
        });
      });

    // Announcements for practices
    (fresh.announcements || [])
      .filter(practiceCanSee)
      .forEach(a => notifs.push({
        id:      `practice-announcement-${a.id}`,
        icon:    '📣',
        title:   a.title,
        text:    '',
        section: 'announcements'
      }));

    // New practice documents (added within the last 7 days, visible to this practice)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    (fresh.practiceDocs || [])
      .filter(d => {
        if (!d.updated || d.updated < sevenDaysAgo) return false;
        const p = d.practices;
        return !p || p === 'all' || (Array.isArray(p) && p.includes(session.username));
      })
      .forEach(d => notifs.push({
        id:      `practice-doc-${d.updated}-${d.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30)}`,
        icon:    '📄',
        title:   'New document available',
        text:    d.name,
        section: 'documents'
      }));

    window._bellRefresh = refreshBell;
    cssRenderBell('practice', notifs);
  }
  refreshBell();
})();
