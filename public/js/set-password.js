/* Invitation acceptance and password reset (release 1).
   The emailed link carries a one-time token_hash. We deliberately do NOT
   redeem it on page load: email security scanners (e.g. NHSmail link
   checking) open links automatically and would otherwise use up the token.
   The token is only verified when the person submits their new password. */
(function () {
  const { sb, setMsg } = window.Portal;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  // Keep the token out of browser history / screenshots.
  history.replaceState(null, '', location.pathname);

  function showInvalid(text) {
    $('pwForm').style.display = 'none';
    $('pwInvalid').style.display = 'block';
    if (text) $('pwInvalidText').textContent = text;
  }

  if (!tokenHash || !['invite', 'recovery'].includes(type)) {
    showInvalid();
    return;
  }
  if (type === 'recovery') {
    $('pwTitle').textContent = 'Choose a new password';
    $('pwIntro').textContent = 'Enter a new password for your CSS portal account.';
  }

  const RULES = {
    len: (p) => p.length >= 12,
    lower: (p) => /[a-z]/.test(p),
    upper: (p) => /[A-Z]/.test(p),
    digit: (p) => /\d/.test(p),
  };
  $('newPw').addEventListener('input', () => {
    const p = $('newPw').value;
    document.querySelectorAll('#pwRules li').forEach((li) => li.classList.toggle('ok', RULES[li.dataset.rule](p)));
  });

  let verified = false;

  $('pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg($('pwErr'), '');
    const pw = $('newPw').value;
    if (!Object.values(RULES).every((r) => r(pw))) return setMsg($('pwErr'), 'Your password does not meet all of the requirements.', 'error');
    if (pw !== $('confirmPw').value) return setMsg($('pwErr'), 'The two passwords do not match.', 'error');

    $('pwBtn').disabled = true;
    try {
      if (!verified) {
        const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) return showInvalid('This link has expired or has already been used.');
        verified = true;
      }
      const { data: userData } = await sb.auth.getUser();
      const localPart = (userData?.user?.email || '').split('@')[0].toLowerCase();
      if (localPart.length >= 4 && pw.toLowerCase().includes(localPart)) {
        return setMsg($('pwErr'), 'Your password must not contain your email address.', 'error');
      }

      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) {
        const msg = /same|different from the old/i.test(error.message)
          ? 'Choose a password you have not used for this account before.'
          : /weak|pwned|leaked|known/i.test(error.message)
            ? 'That password is too easy to guess or has appeared in a data breach. Please choose another.'
            : error.message;
        return setMsg($('pwErr'), msg, 'error');
      }
      // Sign out here so the person signs in fresh on whichever device they choose.
      await sb.auth.signOut({ scope: 'local' });
      $('pwForm').style.display = 'none';
      $('pwDone').style.display = 'block';
    } finally {
      $('pwBtn').disabled = false;
    }
  });
})();
