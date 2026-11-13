// NetAssist: Express server (API + pages)
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const dns = require('dns');
const { q, verifyPassword, hashPassword, createUser, listDiagnostics, createRememberToken, useRememberToken, logActivity, saveDiagnostic, resultsFor } = require('./src/db');
const { findGateway } = require('./src/tests');
const { PROBLEMS } = require('./src/rules');
const { startRun, getRun, planFor } = require('./src/engine');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE = 'na_sid';
const RT_COOKIE = 'na_rt'; // remember-me cookie (id.secret); DB stores only a hash of the secret
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

// ---------- security headers ----------
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'",
  });
  next();
});

// ---------- sessions (stored in SQLite) ----------
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function startSession(res, userId, remember = true) {
  const id = crypto.randomBytes(32).toString('hex');
  const ttl = remember ? SESSION_MS : 12 * 60 * 60 * 1000; // not remembered: browser-session cookie, 12h server limit
  q.insertSession.run(id, userId, Date.now() + ttl);
  const opts = { httpOnly: true, sameSite: 'lax', path: '/' };
  if (remember) opts.maxAge = SESSION_MS;
  res.cookie(COOKIE, id, opts);
}
// Remember me: store a hashed token in the DB and give the browser the matching cookie (30 days).
function issueRemember(req, res, userId) {
  const t = createRememberToken(userId, req.get('user-agent'));
  res.cookie(RT_COOKIE, t.value, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: t.maxAge });
}
const isPage = (req) => req.method === 'GET' && !req.path.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(req.path);
app.use((req, res, next) => {
  req.user = null;
  const cookies = parseCookies(req);
  const sid = cookies[COOKIE];
  if (sid) {
    const s = q.sessionById.get(sid);
    if (s && s.expires_at > Date.now()) { req.user = q.userById.get(s.user_id) || null; req.sid = sid; }
    else if (s) q.deleteSession.run(sid);
  }
  // No valid session but a remember-me cookie: sign the user back in automatically (token rotates each use).
  if (!req.user && cookies[RT_COOKIE] && (isPage(req) || req.path.startsWith('/api/'))) {
    const uid = useRememberToken(cookies[RT_COOKIE]);
    const u = uid && q.userById.get(uid);
    if (u) {
      startSession(res, u.id, true); issueRemember(req, res, u.id);
      q.touchLogin.run(u.id); logActivity(req, u.id, u.email, 'auto_login', 'Signed in with remember me');
      req.user = q.userById.get(u.id);
    } else res.clearCookie(RT_COOKIE, { path: '/' });
  }
  next();
});
setInterval(() => { q.purgeSessions.run(Date.now()); q.purgeTokens.run(Date.now()); }, 60 * 60 * 1000).unref();

// CSRF defense: state-changing API calls must carry a custom header (cannot be sent cross-site without CORS).
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'netassist') return res.status(403).json({ error: 'Blocked request.' });
  next();
});

const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Please log in.' }));
const requireAdmin = (req, res, next) =>
  (req.user && req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only.' }));

// ---------- helpers ----------
const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map(); // login rate limit: key -> {n, until}
function tooMany(key) { const a = attempts.get(key); return a && a.n >= 5 && a.until > Date.now(); }
function fail(key) {
  const a = attempts.get(key);
  if (!a || a.until < Date.now()) attempts.set(key, { n: 1, until: Date.now() + 10 * 60 * 1000 });
  else a.n++;
}

// ---------- auth API ----------
app.post('/api/auth/register', (req, res) => {
  const name = clean(req.body.name, 60), email = clean(req.body.email, 120).toLowerCase(), password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.', field: 'name' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return res.status(400).json({ error: 'Password needs at least 8 characters with a letter and a number.', field: 'password' });
  if (q.userByEmail.get(email)) return res.status(409).json({ error: 'That email is already registered.', field: 'email' });
  const id = createUser(name, email, password);
  const remember = req.body.remember !== false;
  startSession(res, id, remember);
  if (remember) issueRemember(req, res, id);
  q.touchLogin.run(id);
  logActivity(req, id, email, 'register', 'New account created' + (remember ? ' (remember me on)' : ''));
  res.status(201).json({ user: q.userById.get(id) });
});

app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase(), password = String(req.body.password || '');
  const key = req.ip + '|' + email;
  if (tooMany(key)) { logActivity(req, null, email, 'login_blocked', 'Too many failed attempts'); return res.status(429).json({ error: 'Too many failed attempts. Try again in 10 minutes.' }); }
  const u = q.userByEmail.get(email);
  if (!u || !verifyPassword(password, u.password_hash)) {
    fail(key);
    logActivity(req, u ? u.id : null, email, 'login_failed', u ? 'Wrong password' : 'Unknown email');
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  attempts.delete(key);
  const remember = req.body.remember !== false;
  startSession(res, u.id, remember);
  if (remember) issueRemember(req, res, u.id); else res.clearCookie(RT_COOKIE, { path: '/' });
  q.touchLogin.run(u.id);
  logActivity(req, u.id, u.email, 'login', remember ? 'Signed in (remember me on)' : 'Signed in');
  res.json({ user: q.userById.get(u.id) });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.sid) q.deleteSession.run(req.sid);
  const rt = parseCookies(req)[RT_COOKIE];
  if (rt) q.deleteToken.run(String(rt).split('.')[0]);
  if (req.user) logActivity(req, req.user.id, req.user.email, 'logout', null);
  res.clearCookie(COOKIE, { path: '/' });
  res.clearCookie(RT_COOKIE, { path: '/' });
  res.json({ ok: true });
});
app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));
app.patch('/api/auth/profile', requireAuth, (req, res) => {
  const name = clean(req.body.name, 60);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.', field: 'name' });
  q.setName.run(name, req.user.id);
  logActivity(req, req.user.id, req.user.email, 'profile_update', 'Name changed');
  res.json({ user: q.userById.get(req.user.id) });
});
app.post('/api/auth/password', requireAuth, (req, res) => {
  const cur = String(req.body.current || ''), next = String(req.body.next || '');
  const u = q.userFull.get(req.user.id);
  if (!verifyPassword(cur, u.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.', field: 'current' });
  if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return res.status(400).json({ error: 'New password needs at least 8 characters with a letter and a number.', field: 'next' });
  q.setPassword.run(hashPassword(next), req.user.id);
  q.otherSessions.run(req.user.id, req.sid); // sign out other devices
  q.deleteUserTokens.run(req.user.id); // forget remembered devices
  res.clearCookie(RT_COOKIE, { path: '/' });
  logActivity(req, req.user.id, req.user.email, 'password_change', 'Password changed; other devices signed out');
  res.json({ ok: true });
});

// ---------- diagnostics API ----------
app.get('/api/problems', (req, res) => {
  const out = {};
  for (const [k, v] of Object.entries(PROBLEMS)) out[k] = { ...v, tests: planFor(k) };
  res.json({ problems: out });
});

app.post('/api/diagnostics', requireAuth, (req, res) => {
  const problem = clean(req.body.problem, 40);
  if (!PROBLEMS[problem]) return res.status(400).json({ error: 'Unknown problem type.' });
  let gateway = clean(req.body.gateway, 45);
  if (gateway && !/^(\d{1,3}\.){3}\d{1,3}$/.test(gateway)) return res.status(400).json({ error: 'Router IP must look like 192.168.1.1.' });
  let retestOf = null;
  if (req.body.retestOf) {
    const prev = q.diagById.get(Number(req.body.retestOf), req.user.id);
    if (prev) retestOf = prev.id;
  }
  const run = startRun({
    userId: req.user.id, problem, gateway: gateway || null, retestOf,
    onDone: (st) => {
      st.historyId = saveDiagnostic({ userId: st.userId, problem: st.problem, report: st.report, retestOf: st.retestOf, gateway: gateway || null, durationMs: Date.now() - st.startedAt });
      logActivity(req, st.userId, req.user.email, 'test_run', `${PROBLEMS[st.problem].title}: ${st.report.verdict} (#${st.historyId}${st.retestOf ? ', re-test' : ''})`);
    },
  });
  res.status(202).json({ runId: run.id });
});

app.get('/api/diagnostics/:runId', requireAuth, (req, res) => {
  const run = getRun(req.params.runId);
  if (!run || run.userId !== req.user.id) return res.status(404).json({ error: 'Run not found.' });
  res.json({ state: run.state, problem: run.problem, steps: run.steps.map(({ id, label, status, summary }) => ({ id, label, status, summary })), historyId: run.historyId || null, error: run.error || null });
});

// ---------- history (always scoped to the logged-in user) ----------
app.get('/api/history', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1), size = 8;
  const text = clean(req.query.q, 60), days = Math.min(365, Math.max(0, parseInt(req.query.days, 10) || 0));
  const keys = text ? Object.entries(PROBLEMS).filter(([, v]) => v.title.toLowerCase().includes(text.toLowerCase())).map(([k]) => k) : [];
  const { total, items } = listDiagnostics(req.user.id, { keys, text, days, limit: size, offset: (page - 1) * size });
  res.json({ items, page, pages: Math.max(1, Math.ceil(total / size)), total });
});
app.get('/api/history/:id', requireAuth, (req, res) => {
  const row = q.diagById.get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Report not found.' });
  const report = JSON.parse(row.report_json);
  let previous = null;
  if (row.retest_of) {
    const p = q.diagById.get(row.retest_of, req.user.id);
    if (p) previous = { id: p.id, created_at: p.created_at, report: JSON.parse(p.report_json) };
  }
  res.json({ id: row.id, problem: row.problem, created_at: row.created_at, retest_of: row.retest_of, report, previous, meta: { duration_ms: row.duration_ms, tests_total: row.tests_total, tests_passed: row.tests_passed, tests_failed: row.tests_failed, gateway: row.gateway_input }, results: resultsFor(row.id, req.user.id) });
});
app.delete('/api/history/:id', requireAuth, (req, res) => {
  const r = q.diagDelete.run(Number(req.params.id), req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Report not found.' });
  logActivity(req, req.user.id, req.user.email, 'delete_report', `Report #${Number(req.params.id)}`);
  res.json({ ok: true });
});
app.delete('/api/history', requireAuth, (req, res) => { q.diagClear.run(req.user.id); logActivity(req, req.user.id, req.user.email, 'clear_history', 'All reports deleted'); res.json({ ok: true }); });

app.get('/api/stats', requireAuth, (req, res) => {
  const verdicts = Object.fromEntries(q.diagStats.all(req.user.id).map((r) => [r.verdict, r.n]));
  const byProblem = Object.fromEntries(q.diagByProblem.all(req.user.id).map((r) => [r.problem, r.n]));
  const recent2 = listDiagnostics(req.user.id, { limit: 5 }).items;
  const resolved = listDiagnostics(req.user.id, { limit: 1000 }).items.filter((r) => r.verdict === 'issue' && r.resolved).length;
  res.json({ total: q.diagCount.get(req.user.id).n, verdicts, byProblem, recent: recent2, resolved });
});

// ---------- analytics ----------
const stepData = (rep, ...ids) => { for (const id of ids) { const st = (rep.steps || []).find((x) => x.id === id && x.data); if (st) return st.data; } return null; };
function metrics(rep) {
  const lat = stepData(rep, 'latency', 'internet'), loss = stepData(rep, 'loss', 'latency', 'internet'), dnsd = stepData(rep, 'dns_system');
  return { latency: lat && lat.avg != null ? lat.avg : null, loss: loss && loss.loss != null ? loss.loss : null, dns: dnsd && dnsd.avg != null ? dnsd.avg : null };
}
app.get('/api/analytics', requireAuth, (req, res) => {
  const days = [7, 30, 90].includes(parseInt(req.query.days, 10)) ? parseInt(req.query.days, 10) : 7;
  const rows = q.diagForAnalytics.all(req.user.id, `-${days} days`);
  const byProblem = {}, perDay = {};
  for (const r of rows) {
    byProblem[r.problem] = (byProblem[r.problem] || 0) + 1;
    const m = metrics(JSON.parse(r.report_json));
    if (m.latency != null) { const d = r.created_at.slice(0, 10); (perDay[d] = perDay[d] || []).push(m.latency); }
  }
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const v = perDay[d]; series.push({ date: d, avg: v ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null });
  }
  let beforeAfter = null;
  const rt = q.diagLatestRetest.get(req.user.id);
  if (rt) {
    const prev = q.diagById.get(rt.retest_of, req.user.id);
    if (prev) beforeAfter = { before: metrics(JSON.parse(prev.report_json)), after: metrics(JSON.parse(rt.report_json)), problem: prev.problem, when: rt.created_at };
  }
  res.json({ days, total: rows.length, byProblem, series, beforeAfter });
});

// ---------- network information (read-only, about the machine running NetAssist) ----------
app.get('/api/netinfo', requireAuth, async (req, res) => {
  const adapters = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) adapters.push({ name, address: a.address, mac: a.mac, netmask: a.netmask });
  }
  const gateway = await findGateway();
  let pub = null;
  for (const u of ['https://ipinfo.io/json', 'https://api.ipify.org?format=json']) {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
      const r = await fetch(u, { signal: ac.signal }); clearTimeout(t);
      const j = await r.json(); if (j && j.ip) { pub = { ip: j.ip, isp: j.org || null, city: j.city || null, country: j.country || null }; break; }
    } catch (e) { /* try next */ }
  }
  res.json({ online: !!pub, hostname: os.hostname(), platform: process.platform, adapters, gateway, dnsServers: dns.getServers(), publicIp: pub, checkedAt: new Date().toISOString() });
});

// ---------- contact + admin ----------
app.post('/api/contact', (req, res) => {
  const name = clean(req.body.name, 60), email = clean(req.body.email, 120), subject = clean(req.body.subject, 100), body = clean(req.body.message, 2000);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.', field: 'name' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  if (subject.length < 3) return res.status(400).json({ error: 'Add a short subject.', field: 'subject' });
  if (body.length < 10) return res.status(400).json({ error: 'Message is too short.', field: 'message' });
  q.insertMsg.run(req.user ? req.user.id : null, name, email, subject, body);
  logActivity(req, req.user ? req.user.id : null, email, 'contact_message', subject);
  res.status(201).json({ ok: true });
});
// "Forgot password" from the login popup: creates a password-reset request for the admin.
app.post('/api/auth/forgot', (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  const key = 'forgot|' + req.ip;
  if (tooMany(key)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  fail(key);
  const u = q.userByEmail.get(email);
  // Same answer whether or not the account exists, so this cannot be used to find registered emails.
  if (!q.openReset.get(email)) {
    q.insertReset.run(u ? u.id : null, u ? u.name : 'Unknown account', email, u ? `Please reset the password for ${email}.` : `Password reset requested for ${email}, but no account uses this email.`);
    logActivity(req, u ? u.id : null, email, 'password_reset_request', u ? 'Requested a password reset' : 'Requested a reset for an unknown email');
  }
  res.status(201).json({ ok: true });
});
app.get('/api/admin/summary', requireAuth, requireAdmin, (req, res) => res.json(q.adminStats.get()));
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => res.json({ items: q.adminUsers.all() }));
app.get('/api/admin/activity', requireAuth, requireAdmin, (req, res) => res.json({ items: q.allActivity.all(300) }));
app.get('/api/activity', requireAuth, (req, res) => res.json({ items: q.myActivity.all(req.user.id, 15), lastLogin: req.user.last_login_at, logins: req.user.login_count }));
app.get('/api/admin/messages', requireAuth, requireAdmin, (req, res) => res.json({ items: q.msgList.all() }));
app.patch('/api/admin/messages/:id', requireAuth, requireAdmin, (req, res) => {
  const status = req.body.status === 'resolved' ? 'resolved' : 'new';
  const m = q.msgById.get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Message not found.' });
  // A password-reset request can only be resolved after the admin really changed that user's password.
  if (status === 'resolved' && m.kind === 'password_reset' && m.account_id && !m.reset_at) {
    return res.status(409).json({ error: "Reset this user's password first, then mark the request as resolved." });
  }
  q.msgStatus.run(status, m.id);
  logActivity(req, req.user.id, req.user.email, 'message_' + status, `${m.subject} (#${m.id})`);
  res.json({ ok: true });
});
app.post('/api/admin/messages/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
  const m = q.msgById.get(Number(req.params.id));
  if (!m || m.kind !== 'password_reset') return res.status(404).json({ error: 'Password-reset request not found.' });
  if (!m.account_id) return res.status(409).json({ error: 'No account uses this email, so there is no password to reset.' });
  let pw = String(req.body.password || '');
  if (!pw) { // generate a temporary password: 10 chars, always has a letter and a number
    const A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', N = '23456789';
    pw = Array.from(crypto.randomBytes(8), (b) => A[b % A.length]).join('') + N[crypto.randomBytes(1)[0] % N.length] + N[crypto.randomBytes(1)[0] % N.length];
  }
  if (pw.length < 8 || pw.length > 100 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return res.status(400).json({ error: 'Password needs at least 8 characters with a letter and a number.' });
  q.setPassword.run(hashPassword(pw), m.account_id);
  q.deleteUserSessions.run(m.account_id);   // sign the user out everywhere
  q.deleteUserTokens.run(m.account_id);     // forget remembered devices
  q.markReset.run(req.user.email, m.id);
  logActivity(req, req.user.id, req.user.email, 'admin_password_reset', `Reset the password of ${m.email} (request #${m.id})`);
  res.json({ ok: true, email: m.email, password: pw });
});
// Addresses other devices on the same Wi-Fi/LAN can use to open this server.
app.get('/api/lan', requireAuth, (req, res) => {
  const urls = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) urls.push({ adapter: name, url: `http://${a.address}:${PORT}` });
  res.json({ port: PORT, urls });
});
app.delete('/api/admin/messages/:id', requireAuth, requireAdmin, (req, res) => { q.msgDelete.run(Number(req.params.id)); res.json({ ok: true }); });

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------- pages ----------
const view = (name) => path.join(__dirname, 'views', name + '.html');
for (const p of ['dashboard', 'diagnose', 'history', 'report', 'analytics', 'network', 'settings']) {
  app.get('/' + p, (req, res) => (req.user ? res.sendFile(view(p)) : res.redirect('/login?next=/' + p)));
}
app.get('/admin', (req, res) => {
  if (!req.user) return res.redirect('/login?next=/admin');
  if (req.user.role !== 'admin') return res.redirect('/dashboard');
  res.sendFile(view('admin'));
});
// Login and register now open as a popup on the home page (public/js/authpopup.js).
for (const p of ['login', 'register']) {
  app.get('/' + p, (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    const qs = new URLSearchParams({ auth: p });
    const next = String(req.query.next || ''); if (next.startsWith('/') && !next.startsWith('//')) qs.set('next', next);
    if (req.query.demo) qs.set('demo', '1');
    res.redirect('/?' + qs.toString());
  });
}
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request body.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NetAssist running at http://localhost:${PORT}`);
    const urls = [];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) urls.push(`http://${a.address}:${PORT}`);
    }
    if (urls.length) console.log('Other devices on the same Wi-Fi can open: ' + urls.join('  or  '));
  });
}
module.exports = app;
