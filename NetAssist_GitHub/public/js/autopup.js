// Login / Register / Forgot-password popup. Opens from any "Log in" / "Sign up" link and from ?auth=login|register|forgot.
(function () {
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  const params = new URLSearchParams(location.search);
  const safeNext = () => { const n = params.get('next'); return n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard'; };
  const field = (id, type, label, icon, extra) => `<div class="ap-input"><input id="${id}" name="${id.replace(/^[a-z]+-/, '')}" type="${type}" placeholder=" " required ${extra || ''}><label for="${id}">${label}</label>${icon}</div>`;
  const ico = (n) => `<span class="ico">${NA.icon(n)}</span>`;
  const eye = '<button type="button" class="ico" data-eye aria-label="Show password"></button>';

  const root = document.createElement('div'); root.className = 'ap-overlay'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Sign in to NetAssist');
  root.innerHTML = `<div class="ap-box" data-view="login"><button class="ap-close" type="button" aria-label="Close">${NA.icon('x')}</button>
  <form class="ap-form login" id="ap-login" novalidate><h2>Login</h2><div class="ap-err" hidden role="alert"></div>
    ${field('l-email', 'email', 'Email', ico('mail'), 'autocomplete="email"')}${field('l-password', 'password', 'Password', eye, 'autocomplete="current-password"')}
    <div class="ap-row"><label><input type="checkbox" id="l-remember" checked> Remember me</label><a href="#" data-go="forgot">Forgot Password?</a></div>
    <button class="ap-submit" type="submit">Login</button>
    <p class="ap-switch">Don't have an account? <a href="#" data-go="register"><b>Register</b></a></p>
    <div class="ap-demo">Demo: <b>demo@netassist.local</b> / <b>Demo@123</b><button type="button" id="ap-fill">Fill in</button></div></form>
  <form class="ap-form register" id="ap-register" novalidate><h2>Registration</h2><div class="ap-err" hidden role="alert"></div>
    ${field('r-name', 'text', 'Username', ico('user'), 'autocomplete="name"')}${field('r-email', 'email', 'Email', ico('mail'), 'autocomplete="email"')}${field('r-password', 'password', 'Password', eye, 'autocomplete="new-password"')}
    <div class="ap-hint">At least 8 characters, with a letter and a number.</div>
    <div class="ap-row" style="display:grid;gap:8px"><label><input type="checkbox" id="r-remember" checked> Remember me on this device</label><label><input type="checkbox" id="r-terms"> I agree to the terms &amp; conditions</label></div>
    <button class="ap-submit" type="submit">Register</button>
    <p class="ap-switch">Already have an account? <a href="#" data-go="login"><b>Login</b></a></p></form>
  <form class="ap-form forgot" id="ap-forgot" novalidate><h2>Forgot Password</h2><div class="ap-err" hidden role="alert"></div><div class="ap-ok" hidden role="status"></div>
    <p class="ap-note">Enter your email and we will send a password reset request to the NetAssist admin.</p>
    ${field('f-email', 'email', 'Email', ico('mail'), 'autocomplete="email"')}
    <button class="ap-submit" type="submit">Send Reset Request</button>
    <p class="ap-switch"><a href="#" data-go="login">Back to Login</a></p></form></div>`;
  document.body.appendChild(root);
  const box = root.querySelector('.ap-box');
  root.querySelectorAll('[data-eye]').forEach((b) => { b.innerHTML = NA.icon('eye'); b.onclick = () => { const i = b.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); }; });

  let lastFocus = null;
  function show(view) {
    box.dataset.view = view;
    root.querySelectorAll('.ap-err,.ap-ok').forEach((e) => { e.hidden = true; });
    root.querySelectorAll('.ap-input.bad').forEach((e) => e.classList.remove('bad'));
    const f = box.querySelector('.ap-form.' + view + ' input'); if (f) setTimeout(() => f.focus(), 60);
  }
  function open(view) {
    lastFocus = document.activeElement; root.classList.add('open'); document.body.style.overflow = 'hidden'; show(view || 'login');
  }
  function close() { root.classList.remove('open'); document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  root.querySelector('.ap-close').onclick = close;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) close(); });
  root.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); show(a.dataset.go); }));

  // Any "Log in" / "Sign up" link on this page opens the popup instead of leaving the page.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    const m = /^\/(login|register)(\?|$)/.exec(a.getAttribute('href')); if (!m) return;
    e.preventDefault(); open(m[1]);
    if (/demo=1/.test(a.getAttribute('href'))) fill();
  });

  const fail = (form, msg, id) => { const b = form.querySelector('.ap-err'); b.textContent = msg; b.hidden = false; if (id) { const i = form.querySelector('#' + id); if (i) { i.parentElement.classList.add('bad'); i.focus(); } } };
  const reset = (form) => { form.querySelector('.ap-err').hidden = true; form.querySelectorAll('.ap-input.bad').forEach((e) => e.classList.remove('bad')); };
  const busy = (form, on, label) => { const b = form.querySelector('.ap-submit'); b.disabled = on; b.textContent = on ? '…' : label; };
  const FIELD_ID = { name: 'r-name', email: 'r-email', password: 'r-password' };

  // Remember me: only the email is kept in this browser; the server stores a hashed token in the database.
  const lf = root.querySelector('#ap-login');
  if (LS.get('na-remember-email')) lf.querySelector('#l-email').value = LS.get('na-remember-email');
  if (LS.get('na-remember-off') === '1') lf.querySelector('#l-remember').checked = false;
  function fill() { lf.querySelector('#l-email').value = 'demo@netassist.local'; lf.querySelector('#l-password').value = 'Demo@123'; }
  root.querySelector('#ap-fill').onclick = fill;

  lf.addEventListener('submit', async (e) => {
    e.preventDefault(); reset(lf);
    const email = lf.querySelector('#l-email').value.trim(), password = lf.querySelector('#l-password').value, keep = lf.querySelector('#l-remember').checked;
    if (!email) return fail(lf, 'Enter your email.', 'l-email');
    if (!password) return fail(lf, 'Enter your password.', 'l-password');
    busy(lf, true, 'Login');
    try {
      await NA.api('POST', '/api/auth/login', { email, password, remember: keep });
      LS.set('na-remember-email', keep ? email.toLowerCase() : null); LS.set('na-remember-off', keep ? null : '1');
      location.href = safeNext();
    } catch (ex) { fail(lf, ex.message); busy(lf, false, 'Login'); }
  });

  const rf = root.querySelector('#ap-register');
  rf.addEventListener('submit', async (e) => {
    e.preventDefault(); reset(rf);
    const v = { name: rf.querySelector('#r-name').value.trim(), email: rf.querySelector('#r-email').value.trim(), password: rf.querySelector('#r-password').value, remember: rf.querySelector('#r-remember').checked };
    if (v.name.length < 2) return fail(rf, 'Please enter your name.', 'r-name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return fail(rf, 'Enter a valid email address.', 'r-email');
    if (v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) return fail(rf, 'Password needs at least 8 characters with a letter and a number.', 'r-password');
    if (!rf.querySelector('#r-terms').checked) return fail(rf, 'Please agree to the terms & conditions.');
    busy(rf, true, 'Register');
    try {
      await NA.api('POST', '/api/auth/register', v);
      LS.set('na-remember-email', v.remember ? v.email.toLowerCase() : null); LS.set('na-remember-off', v.remember ? null : '1');
      location.href = safeNext();
    } catch (ex) { fail(rf, ex.message, ex.field && FIELD_ID[ex.field]); busy(rf, false, 'Register'); }
  });

  const ff = root.querySelector('#ap-forgot');
  ff.addEventListener('submit', async (e) => {
    e.preventDefault(); reset(ff); ff.querySelector('.ap-ok').hidden = true;
    const email = ff.querySelector('#f-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(ff, 'Enter a valid email address.', 'f-email');
    busy(ff, true, 'Send Reset Request');
    try {
      await NA.api('POST', '/api/auth/forgot', { email });
      const ok = ff.querySelector('.ap-ok'); ok.textContent = 'Request sent. The admin will set a new password for your account and send it to you.'; ok.hidden = false; ff.querySelector('#f-email').value = '';
    } catch (ex) { fail(ff, ex.message); }
    busy(ff, false, 'Send Reset Request');
  });

  // Auto-open from the URL (used when a protected page sends a visitor to log in)
  const want = params.get('auth');
  if (['login', 'register', 'forgot'].includes(want)) {
    const go = () => { if (window.NA && NA.user) return; open(want); if (params.get('demo')) fill(); };
    setTimeout(go, 400);
  }
})();
