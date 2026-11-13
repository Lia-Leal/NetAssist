# NetAssist — Code Guide (bawat file, ano ang ginagawa)

## Paano dumadaloy ang app
Browser (HTML/CSS/JS sa `public/` at `views/`) → `fetch('/api/...')` → **server.js** (Express) → **src/db.js** (SQLite) at **src/engine.js** (tests) → sagot na JSON → ipinapakita ng JS sa page.

## Backend
| File | Ano ang laman |
|---|---|
| `server.js` | Lahat ng routes. Security headers, sessions, **remember-me auto-login**, register/login/logout, diagnostics, history, analytics, admin, at ang mga page guards (kapag hindi naka-login → redirect sa /login). |
| `src/db.js` | Pagbukas ng SQLite, paggawa ng tables, **migration** ng lumang DB, password hashing (scrypt), mga prepared queries, `saveDiagnostic()`, `createRememberToken()/useRememberToken()`, `logActivity()`. |
| `src/engine.js` | Pinapatakbo ang mga test step-by-step at nag-uulat ng progress (live polling). |
| `src/tests.js` | Ang totoong network tests: adapter, gateway, ping (ICMP→TCP fallback), DNS, HTTPS, speed. |
| `src/rules.js` | Ang "utak": binabasa ang results at gumagawa ng verdict + dahilan + hakbang na ayusin. |

## Database tables (`data/netassist.db`)
- **users** — name, email, password_hash, role, `last_login_at`, `login_count`.
- **sessions** — server-side login session (cookie `na_sid`).
- **remember_tokens** — para sa *Remember me*. Cookie `na_rt` = `id.secret`; sa DB ay **hash lang** ng secret ang naka-save (hindi ang password). 30 araw; napapalitan ng bago tuwing gagamitin.
- **diagnostic_sessions** — isang row bawat test run: problem, verdict, headline, gateway, duration, ilan ang pumasa/bumagsak, report_json.
- **diagnostic_results** — isang row bawat *individual test* sa loob ng run (adapter, gateway, latency…): status, detalye, oras.
- **activity_log** — sino, ano, kailan, saan (register, login, failed login, logout, test_run, delete, password change, contact…). Binubura pagkalipas ng 180 araw.
- **messages** — mula sa Contact page.

## Remember me — paano gumagana
1. Naka-check ang Remember me sa login/register → gumagawa ang server ng random token, sine-save ang **hash** sa `remember_tokens`, at nagse-set ng cookie `na_rt`.
2. Kapag nag-expire ang session (hal. isinara ang browser), nakikita ng server ang `na_rt`, hinahanap sa DB, at **awtomatikong ila-login ka**, sabay palit ng token (rotation).
3. Sa login page, naka-prefill ang email (naka-save sa browser) — password ay hindi kailanman sine-save.
4. Logout o pagpalit ng password → binubura ang token.

## Frontend (`public/js`)
`app.js` (shared helpers: api, nav/sidebar, charts, report) · `formkit.js` (form errors) · `theme.js` (light/dark) · `login.js` / `register.js` (forms + remember me) · `dashboard.js`, `diagnose.js` (wizard), `history.js`, `report.js`, `analytics.js`, `network.js` · `settings.js` (profile, password, **login/activity history**) · `admin.js` (Messages / **Users** / **Activity log** tabs).
Pages: `public/*.html` (public pages) at `views/*.html` (kailangan naka-login). Design sa `public/css/style.css`.

## Paano makita ang laman ng database
VS Code → Extensions → "SQLite Viewer" → i-click ang `data/netassist.db`. O sa Admin Panel ng app (Users, Activity log).
