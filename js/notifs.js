/* CSS Portal — shared notification bell utility
   Each portal calls cssRenderBell(portalKey, notifsArray) where each notif is:
   { id, icon, title, text, section }
   Seen state is persisted per-portal in localStorage.
*/
(function () {
  const SEEN_PREFIX = 'css_seen_notifs_';

  window.cssGetSeenNotifs = function (portalKey) {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_PREFIX + portalKey) || '[]')); }
    catch (e) { return new Set(); }
  };

  window.cssMarkSeenNotif = function (portalKey, id) {
    const s = cssGetSeenNotifs(portalKey);
    s.add(id);
    localStorage.setItem(SEEN_PREFIX + portalKey, JSON.stringify([...s]));
  };

  window.cssClearAllNotifs = function (portalKey, notifs) {
    const s = cssGetSeenNotifs(portalKey);
    notifs.forEach(n => s.add(n.id));
    localStorage.setItem(SEEN_PREFIX + portalKey, JSON.stringify([...s]));
    if (window._bellRefresh) window._bellRefresh();
  };

  window.cssRenderBell = function (portalKey, notifs) {
    const seen   = cssGetSeenNotifs(portalKey);
    const unseen = notifs.filter(n => !seen.has(n.id));

    const badge = document.getElementById('bellBadge');
    const btn   = document.getElementById('bellBtn');
    const list  = document.getElementById('bellList');
    const clearBtn = document.getElementById('bellClearAll');
    if (!badge || !btn || !list) return;

    // Store notifs on window so clear-all can reference them
    window._bellNotifs    = notifs;
    window._bellPortalKey = portalKey;

    // Badge count
    if (unseen.length > 0) {
      badge.textContent    = unseen.length > 99 ? '99+' : String(unseen.length);
      badge.style.display  = 'flex';
      btn.classList.add('has-notifs');
    } else {
      badge.style.display  = 'none';
      btn.classList.remove('has-notifs');
    }

    // Dropdown items — newest first
    if (!unseen.length) {
      list.innerHTML = '<div class="bell-empty">You\'re all caught up! 🎉</div>';
    } else {
      list.innerHTML = [...unseen].reverse().map(n => `
        <div class="bell-notif-item"
             onclick="cssHandleNotif('${portalKey}','${CSS.escape ? n.id : n.id}','${n.section}')">
          <span class="bell-notif-icon">${n.icon}</span>
          <span class="bell-notif-text"><strong>${n.title}</strong>${n.text ? '<span class="bell-notif-sub">' + n.text + '</span>' : ''}</span>
        </div>`).join('');
    }

    // Clear-all button
    if (clearBtn) clearBtn.onclick = () => cssClearAllNotifs(portalKey, notifs);
  };

  window.cssHandleNotif = function (portalKey, id, section) {
    cssMarkSeenNotif(portalKey, id);
    const dd = document.getElementById('bellDropdown');
    if (dd) dd.style.display = 'none';
    if (window.showSection) window.showSection(section);
    if (window._bellRefresh) window._bellRefresh();
  };

  window.toggleBellDropdown = function () {
    const dd = document.getElementById('bellDropdown');
    if (!dd) return;
    const isOpen = dd.style.display === 'block';
    dd.style.display = isOpen ? 'none' : 'block';
    // Mark everything as seen the moment the dropdown is opened
    if (!isOpen && window._bellNotifs && window._bellPortalKey) {
      const s = cssGetSeenNotifs(window._bellPortalKey);
      window._bellNotifs.forEach(n => s.add(n.id));
      localStorage.setItem(SEEN_PREFIX + window._bellPortalKey, JSON.stringify([...s]));
      // Clear the badge immediately without closing the dropdown
      const badge = document.getElementById('bellBadge');
      const btn   = document.getElementById('bellBtn');
      if (badge) badge.style.display = 'none';
      if (btn)   btn.classList.remove('has-notifs');
    }
  };

  // Close on outside click
  document.addEventListener('click', function (e) {
    const wrap = document.getElementById('bellWrap');
    const dd   = document.getElementById('bellDropdown');
    if (wrap && dd && !wrap.contains(e.target)) {
      dd.style.display = 'none';
    }
  });
})();
