/* Sign-in and password-reset request (release 1). */
(function () {
  const { sb, api, setMsg } = window.Portal;
  const $ = (id) => document.getElementById(id);

  function switchTab(which) {
    $('tabSignIn').classList.toggle('active', which === 'signin');
    $('tabReset').classList.toggle('active', which === 'reset');
    $('signInPane').style.display = which === 'signin' ? 'block' : 'none';
    $('resetPane').style.display = which === 'reset' ? 'block' : 'none';
    if (which === 'reset' && $('email').value) $('resetEmail').value = $('email').value;
  }
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  const params = new URLSearchParams(location.search);
  if (params.get('password_set')) setMsg($('signInInfo'), 'Your password has been set. You can now sign in.', 'ok');
  if (params.get('expired')) setMsg($('signInErr'), 'Your session has ended. Please sign in again.', 'error');
  if (params.get('inactive')) setMsg($('signInErr'), 'Your account is not active. Please contact the CSS office.', 'error');
  if (params.get('reset')) switchTab('reset');
  if ([...params.keys()].length) history.replaceState(null, '', location.pathname);

  async function goToPortal() {
    const me = await api('/api/me');
    window.location.replace(me.role === 'admin' ? 'admin.html' : 'staff.html');
  }

  // Already signed in on this device? Go straight to the right portal.
  sb.auth.getSession().then(({ data }) => {
    if (data.session) goToPortal().catch(() => sb.auth.signOut({ scope: 'local' }));
  });

  $('signInPane').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg($('signInErr'), '');
    setMsg($('signInInfo'), '');
    const email = $('email').value.trim().toLowerCase();
    const password = $('password').value;
    if (!email || !password) return setMsg($('signInErr'), 'Enter your email address and password.', 'error');

    $('signInBtn').disabled = true;
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = /banned/i.test(error.message)
          ? 'Your account is not active. Please contact the CSS office.'
          : /rate limit|too many/i.test(error.message)
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : 'Email address or password not recognised.';
        return setMsg($('signInErr'), msg, 'error');
      }
      try {
        await goToPortal();
      } catch (err) {
        await sb.auth.signOut({ scope: 'local' });
        setMsg($('signInErr'), err.message || 'Your account is not active. Please contact the CSS office.', 'error');
      }
    } finally {
      $('signInBtn').disabled = false;
    }
  });

  $('resetPane').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('resetEmail').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg($('resetMsg'), 'Enter a valid email address.', 'error');
    $('resetBtn').disabled = true;
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/set-password.html` });
      if (error && /rate limit|seconds/i.test(error.message)) {
        return setMsg($('resetMsg'), 'Please wait a minute before requesting another link.', 'error');
      }
      // Same message whether or not the account exists, to avoid revealing who has one.
      setMsg($('resetMsg'), 'If that email address has a portal account, a reset link is on its way. Check your inbox (and junk folder).', 'ok');
    } finally {
      $('resetBtn').disabled = false;
    }
  });
})();
