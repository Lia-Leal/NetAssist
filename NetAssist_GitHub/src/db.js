// SQLite database layer. Uses better-sqlite3 (the course stack). If it is not
// installed, falls back to Node's built-in node:sqlite so the logic can still run.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  ({ DatabaseSync: Database } = require('node:sqlite'));
}

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(process.env.NETASSIST_DB || path.join(dataDir, 'netassist.db'));

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
// ---------- schema ----------
const hasTable = (n) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(n);
const hasCol = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c);
const addCol = (t, c, def) => { if (!hasCol(t, c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };

// Older versions called the table "diagnostics": rename it (data is kept).
if (hasTable('diagnostics') && !hasTable('diagnostic_sessions')) {
  db.exec('DROP INDEX IF EXISTS idx_diag_user; ALTER TABLE diagnostics RENAME TO diagnostic_sessions;');
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
-- One row per diagnostic run (the "what test did the user run" table)
CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem     TEXT NOT NULL,
  verdict     TEXT NOT NULL,
  headline    TEXT NOT NULL,
  report_json TEXT NOT NULL,
  retest_of   INTEGER REFERENCES diagnostic_sessions(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Remembered logins: only a SHA-256 hash of the token is stored, never the password.
CREATE TABLE IF NOT EXISTS remember_tokens (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// New columns (added safely to databases created by older versions)
addCol('users', 'last_login_at', 'TEXT');
addCol('users', 'login_count', 'INTEGER NOT NULL DEFAULT 0');
addCol('diagnostic_sessions', 'gateway_input', 'TEXT');
addCol('diagnostic_sessions', 'duration_ms', 'INTEGER');
addCol('diagnostic_sessions', 'tests_total', 'INTEGER NOT NULL DEFAULT 0');
addCol('diagnostic_sessions', 'tests_passed', 'INTEGER NOT NULL DEFAULT 0');
addCol('diagnostic_sessions', 'tests_failed', 'INTEGER NOT NULL DEFAULT 0');
addCol('diagnostic_sessions', 'findings_count', 'INTEGER NOT NULL DEFAULT 0');

db.exec(`
CREATE INDEX IF NOT EXISTS idx_diag_user ON diagnostic_sessions(user_id, created_at DESC);
-- One row per individual test inside a run (adapter, gateway, latency, DNS ...)
CREATE TABLE IF NOT EXISTS diagnostic_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL,
  test_id       TEXT NOT NULL,
  test_name     TEXT NOT NULL,
  result_status TEXT NOT NULL,
  result_details TEXT,
  result_data   TEXT,
  duration_ms   INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_res_session ON diagnostic_results(session_id);
-- Audit trail: who did what, when, from where
CREATE TABLE IF NOT EXISTS activity_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email      TEXT,
  action     TEXT NOT NULL,
  detail     TEXT,
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_act_user ON activity_log(user_id, id DESC);
`);

// Old rows (saved before per-test rows existed): rebuild the detail rows from report_json.
function backfillResults() {
  const rows = db.prepare(`SELECT s.id, s.user_id, s.report_json, s.created_at FROM diagnostic_sessions s
    WHERE NOT EXISTS (SELECT 1 FROM diagnostic_results r WHERE r.session_id = s.id)`).all();
  if (!rows.length) return;
  const ins = db.prepare(`INSERT INTO diagnostic_results (session_id,user_id,step_order,test_id,test_name,result_status,result_details,result_data,duration_ms,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const upd = db.prepare('UPDATE diagnostic_sessions SET tests_total=?, tests_passed=?, tests_failed=?, findings_count=? WHERE id=?');
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      let rep; try { rep = JSON.parse(r.report_json); } catch (e) { continue; }
      const steps = rep.steps || [];
      steps.forEach((st, i) => ins.run(r.id, r.user_id, i + 1, st.id, st.label || st.id, st.status || 'skip', st.summary || null, st.data ? JSON.stringify(st.data) : null, st.ms == null ? null : Math.round(st.ms), r.created_at));
      upd.run(steps.length, steps.filter((x) => x.status === 'pass').length, steps.filter((x) => x.status === 'fail').length, (rep.findings || []).length, r.id);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
// Password-reset requests: the admin must reset the user's password before the request can be resolved.
addCol('messages', 'kind', "TEXT NOT NULL DEFAULT 'contact'");
addCol('messages', 'reset_at', 'TEXT');
addCol('messages', 'reset_by', 'TEXT');
db.exec("UPDATE messages SET kind = 'password_reset' WHERE kind = 'contact' AND subject = 'Password reset request'");
backfillResults();
db.prepare("DELETE FROM activity_log WHERE created_at < datetime('now','-180 days')").run();

// ---- password hashing (scrypt, built into Node, salted) ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

// ---- users ----
const q = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT id, name, email, role, created_at, last_login_at, login_count FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'),
  insertSession: db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'),
  otherSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?'),
  userFull: db.prepare('SELECT * FROM users WHERE id = ?'),
  setName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
  setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  diagForAnalytics: db.prepare("SELECT id, problem, verdict, retest_of, created_at, report_json FROM diagnostic_sessions WHERE user_id = ? AND created_at >= datetime('now', ?) ORDER BY id ASC LIMIT 500"),
  diagLatestRetest: db.prepare('SELECT id, retest_of, report_json, created_at FROM diagnostic_sessions WHERE user_id = ? AND retest_of IS NOT NULL ORDER BY id DESC LIMIT 1'),
  sessionById: db.prepare('SELECT * FROM sessions WHERE id = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
  purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  insertDiag: db.prepare('INSERT INTO diagnostic_sessions (user_id, problem, verdict, headline, report_json, retest_of) VALUES (?, ?, ?, ?, ?, ?)'),
  diagById: db.prepare('SELECT * FROM diagnostic_sessions WHERE id = ? AND user_id = ?'),
  diagList: db.prepare('SELECT id, problem, verdict, headline, retest_of, created_at FROM diagnostic_sessions WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'),
  diagCount: db.prepare('SELECT COUNT(*) AS n FROM diagnostic_sessions WHERE user_id = ?'),
  diagDelete: db.prepare('DELETE FROM diagnostic_sessions WHERE id = ? AND user_id = ?'),
  diagClear: db.prepare('DELETE FROM diagnostic_sessions WHERE user_id = ?'),
  diagStats: db.prepare("SELECT verdict, COUNT(*) AS n FROM diagnostic_sessions WHERE user_id = ? GROUP BY verdict"),
  diagByProblem: db.prepare('SELECT problem, COUNT(*) AS n FROM diagnostic_sessions WHERE user_id = ? GROUP BY problem'),
  touchLogin: db.prepare("UPDATE users SET last_login_at = datetime('now'), login_count = login_count + 1 WHERE id = ?"),
  insertToken: db.prepare('INSERT INTO remember_tokens (id, user_id, token_hash, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)'),
  tokenById: db.prepare('SELECT * FROM remember_tokens WHERE id = ?'),
  deleteToken: db.prepare('DELETE FROM remember_tokens WHERE id = ?'),
  deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  deleteUserTokens: db.prepare('DELETE FROM remember_tokens WHERE user_id = ?'),
  purgeTokens: db.prepare('DELETE FROM remember_tokens WHERE expires_at < ?'),
  insertActivity: db.prepare('INSERT INTO activity_log (user_id, email, action, detail, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'),
  myActivity: db.prepare('SELECT id, action, detail, created_at FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT ?'),
  allActivity: db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?'),
  adminUsers: db.prepare(`SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login_at, u.login_count,
      (SELECT COUNT(*) FROM diagnostic_sessions d WHERE d.user_id = u.id) AS tests_run,
      (SELECT MAX(d.created_at) FROM diagnostic_sessions d WHERE d.user_id = u.id) AS last_test_at
      FROM users u ORDER BY u.id DESC LIMIT 500`),
  insertMsg: db.prepare('INSERT INTO messages (user_id, name, email, subject, body) VALUES (?, ?, ?, ?, ?)'),
  msgList: db.prepare(`SELECT m.*, (SELECT u.id FROM users u WHERE u.email = lower(m.email)) AS account_id FROM messages m ORDER BY m.id DESC LIMIT 200`),
  msgById: db.prepare('SELECT m.*, (SELECT u.id FROM users u WHERE u.email = lower(m.email)) AS account_id FROM messages m WHERE m.id = ?'),
  insertReset: db.prepare("INSERT INTO messages (user_id, name, email, subject, body, kind) VALUES (?, ?, ?, 'Password reset request', ?, 'password_reset')"),
  openReset: db.prepare("SELECT id FROM messages WHERE kind = 'password_reset' AND status = 'new' AND email = ?"),
  markReset: db.prepare("UPDATE messages SET reset_at = datetime('now'), reset_by = ? WHERE id = ?"),
  userIdByEmail: db.prepare('SELECT id, name, email FROM users WHERE email = ?'),
  msgStatus: db.prepare('UPDATE messages SET status = ? WHERE id = ?'),
  msgDelete: db.prepare('DELETE FROM messages WHERE id = ?'),
  adminStats: db.prepare("SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM diagnostic_sessions) AS diagnostics, (SELECT COUNT(*) FROM messages WHERE status='new') AS newMessages, (SELECT COUNT(*) FROM diagnostic_results) AS testResults"),
};

function createUser(name, email, password, role = 'user') {
  const info = q.insertUser.run(name, email.toLowerCase(), hashPassword(password), role);
  return Number(info.lastInsertRowid);
}

// Seed demo accounts (documented in the README) on first run.
function seed() {
  if (!q.userByEmail.get('admin@netassist.local')) createUser('Administrator', 'admin@netassist.local', 'Admin@123', 'admin');
  if (!q.userByEmail.get('demo@netassist.local')) createUser('Demo User', 'demo@netassist.local', 'Demo@123', 'user');
}
seed();

// History list with optional search text, date range, and "resolved" flag
// (an issue is resolved when a later re-test of it came back clean).
function listDiagnostics(userId, { keys = [], text = '', days = 0, limit = 10, offset = 0 }) {
  const where = ['d.user_id = ?']; const args = [userId];
  if (days > 0) { where.push("d.created_at >= datetime('now', ?)"); args.push(`-${days} days`); }
  if (text) {
    const like = '%' + text.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    const parts = ["d.headline LIKE ? ESCAPE '\\'"]; args.push(like);
    if (keys.length) { parts.push(`d.problem IN (${keys.map(() => '?').join(',')})`); args.push(...keys); }
    where.push('(' + parts.join(' OR ') + ')');
  }
  const base = `FROM diagnostic_sessions d WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(...args).n;
  const items = db.prepare(`SELECT d.id, d.problem, d.verdict, d.headline, d.retest_of, d.created_at,
      EXISTS(SELECT 1 FROM diagnostic_sessions r WHERE r.retest_of = d.id AND r.user_id = d.user_id AND r.verdict = 'ok') AS resolved
      ${base} ORDER BY d.id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  return { total, items };
}


// ---- remember-me tokens: cookie holds "id.secret"; DB holds only sha256(secret) ----
const TOKEN_MS = 30 * 24 * 60 * 60 * 1000;
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
function createRememberToken(userId, userAgent) {
  const id = crypto.randomBytes(9).toString('hex'), secret = crypto.randomBytes(32).toString('hex');
  q.insertToken.run(id, userId, sha(secret), Date.now() + TOKEN_MS, String(userAgent || '').slice(0, 200));
  return { value: `${id}.${secret}`, maxAge: TOKEN_MS };
}
// Returns the user id if the cookie value is valid. A used token is deleted (the caller issues a new one).
function useRememberToken(value) {
  const [id, secret] = String(value || '').split('.');
  if (!id || !secret) return null;
  const row = q.tokenById.get(id);
  if (!row) return null;
  q.deleteToken.run(id);
  const a = Buffer.from(row.token_hash, 'hex'), b = Buffer.from(sha(secret), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b) || row.expires_at < Date.now()) return null;
  return row.user_id;
}

// ---- activity log ----
function logActivity(req, userId, email, action, detail) {
  try {
    q.insertActivity.run(userId || null, email || null, action, detail ? String(detail).slice(0, 300) : null,
      req && req.ip ? String(req.ip).slice(0, 60) : null, req && req.get ? String(req.get('user-agent') || '').slice(0, 200) : null);
  } catch (e) { /* logging must never break a request */ }
}

// ---- save one finished diagnostic: session row + one row per test, atomically ----
function saveDiagnostic({ userId, problem, report, retestOf, gateway, durationMs }) {
  const steps = report.steps || [];
  db.exec('BEGIN');
  try {
    const info = q.insertDiag.run(userId, problem, report.verdict, report.headline, JSON.stringify(report), retestOf || null);
    const id = Number(info.lastInsertRowid);
    const ins = db.prepare(`INSERT INTO diagnostic_results (session_id,user_id,step_order,test_id,test_name,result_status,result_details,result_data,duration_ms)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    steps.forEach((st, i) => ins.run(id, userId, i + 1, st.id, st.label || st.id, st.status || 'skip', st.summary || null, st.data ? JSON.stringify(st.data) : null, st.ms == null ? null : Math.round(st.ms)));
    db.prepare('UPDATE diagnostic_sessions SET gateway_input=?, duration_ms=?, tests_total=?, tests_passed=?, tests_failed=?, findings_count=? WHERE id=?')
      .run(gateway || null, durationMs == null ? null : Math.round(durationMs), steps.length, steps.filter((x) => x.status === 'pass').length, steps.filter((x) => x.status === 'fail').length, (report.findings || []).length, id);
    db.exec('COMMIT');
    return id;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function resultsFor(sessionId, userId) {
  return db.prepare('SELECT step_order, test_id, test_name, result_status, result_details, duration_ms FROM diagnostic_results WHERE session_id = ? AND user_id = ? ORDER BY step_order').all(sessionId, userId);
}

module.exports = { db, q, hashPassword, verifyPassword, createUser, listDiagnostics, createRememberToken, useRememberToken, logActivity, saveDiagnostic, resultsFor };
