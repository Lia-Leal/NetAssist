// Login / Register / Forgot-password popup. Opens from any "Log in" / "Sign up" link and from ?auth=login|register|forgot.
(function () {
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  const params = new URLSearchParams(location.search);
  const safeNext = () => { const n = params.get('next'); return n && n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard'; };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const field = (id, type, label, icon, extra) => `<div class="ap-input"><input id="${id}" name="${id.replace(/^[a-z]+-/, '')}" type="${type}" placeholder=" " required ${extra || ''}><label for="${id}">${label}</label>${icon}</div>`;
  const ico = (n) => `<span class="ico">${NA.icon(n)}</span>`;
  const eye = '<button type="button" class="ico" data-eye aria-label="Show password"></button>';

  // Terms & conditions text shown in the sign-up popup. Replace it with your real terms when they are final.
  const TERMS_HTML = `
    <h4>1. Acceptance of Terms</h4>
    <p>By creating an account or using NetAssist, you agree to be bound by these Terms &amp; Conditions. If you do not agree to these terms, please do not register or use the service.</p>
    
    <h4>2. Account Security</h4>
    <p>You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. Passwords are securely encrypted; the NetAssist team cannot view or manually set your password. You may reset your password at any time using the Forgot Password feature.</p>
    
    <h4>3. Purpose and Acceptable Use</h4>
    <p>NetAssist is a network diagnostic and troubleshooting platform designed to analyze connectivity, identify potential root causes, and provide guided steps to resolve common network issues.</p>
    
    <h4>Authorized Networks Only: </h4>
    <p>You agree to run diagnostics only on networks and devices that you own or have explicit permission to test.</p>
    
    <h4>Prohibited Actions: </h4>
    <p>You must not use NetAssist to conduct unauthorized network scanning, penetration testing, denial-of-service attacks, or any activity intended to disrupt or harm external systems.</p>
    
    <h4>4. Scope of Diagnostics</h4>
    <p>NetAssist provides automated network analysis and troubleshooting recommendations based on real-time test data. While the platform is built to accurately pinpoint connectivity bottlenecks and guide you toward a resolution, final outcomes depend on factors outside the software’s control—such as physical hardware defects, local device configurations, or Internet Service Provider (ISP) outages. </p>
    
    <h4>5. Data Privacy and Protection (RA 10173 Compliance)</h4>
    <p>NetAssist processes personal data in strict compliance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations, adhering to the principles of transparency, legitimate purpose, and proportionality:</p>
    
    <h4>Information Collected:</h4>
    <p>We collect and store only the minimum data required to operate the platform: your name, email address, saved diagnostic reports, and basic system activity logs.</p>
    
    <h4>Purpose & Retention:</h4>
    <p>Your data is used strictly to manage user login and account access, maintain your troubleshooting history, secure the system, and support academic evaluation. Personal data is retained only for as long as your account remains active or as necessary to fulfill these stated purposes, after which it is securely disposed of. Your information will never be sold or disclosed to unauthorized third parties.</p>
    
    <h4>Rights of the Data Subject:</h4>
    <p>Under RA 10173, you have the right to be informed, to access your personal data and diagnostic records, to rectify inaccurate information, and to request the suspension, withdrawal, or deletion of your account and stored data.</p>
    
    <h4>6. Intellectual Property</h4>
    <p>All software, interface designs, diagnostic workflows, and documentation associated with NetAssist are the intellectual property of the NetAssist development team. You retain ownership of the diagnostic reports generated from your own network tests.
    
    <h4>7. Account Suspension or Termination</h4>
    <p> We reserve the right to suspend or terminate accounts that violate these terms, misuse diagnostic tools on unauthorized networks, or attempt to compromise the security and stability of the platform.</p>
    
    <h4>8. Limitation of Liability</h4>
    <p> NetAssist is provided on an "as is" and "as available" basis. While we strive for accurate diagnostics, the NetAssist team is not liable for network downtime, data loss, or indirect damages resulting from network changes or decisions made based on the platform’s recommendations. </p>
    
    <h4>9. Governing Law and Updates to Terms</h4>
    <p> These Terms & Conditions are governed by and construed in accordance with the laws of the Republic of the Philippines. We may update these terms as NetAssist evolves; continued use of the platform after updates are posted constitutes your acceptance of the revised terms. </p> `;


  const root = document.createElement('div'); root.className = 'ap-overlay'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Sign in to NetAssist');
  root.innerHTML = `<div class="ap-box" data-view="login"><button class="ap-close" type="button" aria-label="Close">${NA.icon('x')}</button>
  <form class="ap-form login" id="ap-login" novalidate><h2>Login</h2><div class="ap-err" hidden role="alert"></div><div class="ap-ok" hidden role="status"></div>
    ${field('l-email', 'email', 'Email', ico('mail'), 'autocomplete="email"')}${field('l-password', 'password', 'Password', eye, 'autocomplete="current-password"')}
    <div class="ap-row"><label><input type="checkbox" id="l-remember" checked> Remember me</label><a href="#" data-go="forgot">Forgot Password?</a></div>
    <button class="ap-submit" type="submit">Login</button>
    <p class="ap-switch">Don't have an account? <a href="#" data-go="register"><b>Register</b></a></p>
    <div class="ap-demo">Demo: <b>demo@netassist.local</b> / <b>Demo@123</b><button type="button" id="ap-fill">Fill in</button></div></form>
  <form class="ap-form register" id="ap-register" novalidate><h2>Registration</h2><div class="ap-err" hidden role="alert"></div>
    ${field('r-name', 'text', 'Username', ico('user'), 'autocomplete="name"')}${field('r-email', 'email', 'Email', ico('mail'), 'autocomplete="email"')}${field('r-password', 'password', 'Password', eye, 'autocomplete="new-password"')}
    <div class="ap-hint">At least 8 characters, with a letter and a number.</div>
    <div class="ap-row"><label><input type="checkbox" id="r-remember" checked> Remember me on this device</label></div>
    <div class="ap-agree locked" id="r-terms-row"><input type="checkbox" id="r-terms" disabled><label for="r-terms">I agree to the <a href="#" id="r-terms-open">Terms &amp; Conditions</a></label></div>
    <button class="ap-submit" type="submit">Register</button>
    <p class="ap-switch">Already have an account? <a href="#" data-go="login"><b>Login</b></a></p>
    </form>
  <form class="ap-form forgot" id="ap-forgot" novalidate><h2>Forgot Password</h2><div class="ap-err" hidden role="alert"></div>
    <p class="ap-note">Enter the email of your account. On the next step you will choose a new password for it.</p>
    ${field('f-email', 'email', 'Email', ico('mail'), 'autocomplete="email"')}
    <button class="ap-submit" type="submit">Continue</button>
    <p class="ap-switch"><a href="#" data-go="login">Back to Login</a></p></form>
  <form class="ap-form newpass" id="ap-newpass" novalidate><h2>New Password</h2><div class="ap-err" hidden role="alert"></div>
    <p class="ap-note">For <b id="np-email"></b></p>
    ${field('n-password', 'password', 'New password', eye, 'autocomplete="new-password"')}
    ${field('n-confirm', 'password', 'Confirm new password', eye, 'autocomplete="new-password"')}
    <div class="ap-hint">At least 8 characters, with a letter and a number.</div>
    <div class="ap-confirm">Please confirm: this will be your new password. Your old password stops working right away, and you will be signed out on other devices.</div>
    <button class="ap-submit" type="submit">Confirm and change password</button>
    <p class="ap-switch"><a href="#" data-go="forgot">Back</a></p></form></div>
  <div class="ap-tm" id="ap-tm" hidden><div class="ap-tm-box" role="dialog" aria-modal="true" aria-labelledby="ap-tm-title">
      <h3 id="ap-tm-title">Terms &amp; Conditions</h3>
      <div class="ap-tm-scroll" id="ap-tm-scroll" tabindex="0">${TERMS_HTML}</div>
      <p class="ap-tm-hint" id="ap-tm-hint">Scroll to the bottom to finish reading.</p>
      <div class="ap-tm-actions"><button type="button" class="ap-tm-btn ghost" id="ap-tm-close">Close</button><button type="button" class="ap-tm-btn" id="ap-tm-done" disabled>I have read the terms</button></div>`;
  document.body.appendChild(root);
  const box = root.querySelector('.ap-box');
  root.querySelectorAll('[data-eye]').forEach((b) => { b.innerHTML = NA.icon('eye'); b.onclick = () => { const i = b.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); }; });

  // Terms & conditions: the link opens the full text. The checkbox is unlocked only after the text was scrolled to the end.
  const tm = root.querySelector('#ap-tm'), tmScroll = root.querySelector('#ap-tm-scroll'), tmDone = root.querySelector('#ap-tm-done'), tmHint = root.querySelector('#ap-tm-hint');
  const termsRow = root.querySelector('#r-terms-row'), termsCb = root.querySelector('#r-terms');
  let termsRead = false;
  function atEnd() { return tmScroll.scrollTop + tmScroll.clientHeight >= tmScroll.scrollHeight - 6; }
  function unlockTerms() {
    if (termsRead) return;
    termsRead = true; termsCb.disabled = false; termsRow.classList.remove('locked');
    tmDone.disabled = false; tmHint.textContent = 'Thank you. You can now click the box to agree.';
  }
  function openTerms(e) {
    if (e) e.preventDefault();
    tm.hidden = false; tmScroll.scrollTop = 0; tmScroll.focus();
    requestAnimationFrame(() => { if (!tmScroll.scrollHeight || tmScroll.scrollHeight <= tmScroll.clientHeight + 6) unlockTerms(); });
  }
  function closeTerms() { tm.hidden = true; }
  root.querySelector('#r-terms-open').addEventListener('click', openTerms);
  tmScroll.addEventListener('scroll', () => { if (atEnd()) unlockTerms(); });
  root.querySelector('#ap-tm-close').onclick = closeTerms;
  tmDone.onclick = () => { closeTerms(); termsCb.focus(); };
  tm.addEventListener('mousedown', (e) => { if (e.target === tm) closeTerms(); });

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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) { if (!tm.hidden) closeTerms(); else close(); } });
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
    const v = { name: rf.querySelector('#r-name').value.trim(), email: rf.querySelector('#r-email').value.trim(), password: rf.querySelector('#r-password').value, remember: rf.querySelector('#r-remember').checked, terms: termsCb.checked };
    if (v.name.length < 2) return fail(rf, 'Please enter your name.', 'r-name');
    if (!EMAIL_RE.test(v.email)) return fail(rf, 'Enter a valid email address.', 'r-email');
    if (v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) return fail(rf, 'Password needs at least 8 characters with a letter and a number.', 'r-password');
    if (!v.terms) return fail(rf, 'Read the terms & conditions first, then click the box to agree.');
    busy(rf, true, 'Register');
    try {
      await NA.api('POST', '/api/auth/register', v);
      LS.set('na-remember-email', v.remember ? v.email.toLowerCase() : null); LS.set('na-remember-off', v.remember ? null : '1');
      location.href = safeNext();
    } catch (ex) { fail(rf, ex.message, ex.field && FIELD_ID[ex.field]); busy(rf, false, 'Register'); }
  });

  // Forgot password, step 1: the user enters the email. Nothing is sent or saved yet.
  const ff = root.querySelector('#ap-forgot'), nf = root.querySelector('#ap-newpass');
  let pendingEmail = '';
  ff.addEventListener('submit', (e) => {
    e.preventDefault(); reset(ff);
    const email = ff.querySelector('#f-email').value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return fail(ff, 'Enter a valid email address.', 'f-email');
    pendingEmail = email;
    root.querySelector('#np-email').textContent = email;
    nf.querySelectorAll('input').forEach((i) => { i.value = ''; });
    show('newpass');
  });

  // Forgot password, step 2: the user confirms the new password, and it is saved right away.
  nf.addEventListener('submit', async (e) => {
    e.preventDefault(); reset(nf);
    const pw = nf.querySelector('#n-password').value, cf = nf.querySelector('#n-confirm').value;
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return fail(nf, 'Password needs at least 8 characters with a letter and a number.', 'n-password');
    if (pw !== cf) return fail(nf, 'The two passwords do not match.', 'n-confirm');
    busy(nf, true, 'Confirm and change password');
    try {
      await NA.api('POST', '/api/auth/reset-password', { email: pendingEmail, password: pw });
      nf.querySelectorAll('input').forEach((i) => { i.value = ''; });
      show('login');
      lf.querySelector('#l-email').value = pendingEmail; lf.querySelector('#l-password').value = '';
      const ok = lf.querySelector('.ap-ok'); ok.textContent = 'Your password has been changed. Log in with your new password.'; ok.hidden = false;
      lf.querySelector('#l-password').focus();
    } catch (ex) {
      fail(nf, ex.message, ex.field === 'password' ? 'n-password' : undefined);
    }
    busy(nf, false, 'Confirm and change password');
  });

  // Auto-open from the URL (used when a protected page sends a visitor to log in)
  const want = params.get('auth');
  if (['login', 'register', 'forgot'].includes(want)) {
    const go = () => { if (window.NA && NA.user) return; open(want); if (params.get('demo')) fill(); };
    setTimeout(go, 400);
  }
})();
