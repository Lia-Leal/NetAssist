# NetAssist: A Web-Based Network Troubleshooting and Diagnostic System
IT 314 Final Project, Group 4. Stack: HTML, CSS, JavaScript, Node.js, Express.js, SQLite (better-sqlite3).

## Run it
1. Install Node.js 18 or newer (https://nodejs.org).
2. In this folder run: `npm install`
3. Start the server: `npm start`
4. Open http://localhost:3000

Demo accounts (created automatically on first run):
- User: `demo@netassist.local` / `Demo@123`
- Admin: `admin@netassist.local` / `Admin@123` `ad_net2026`

The SQLite database is created at `data/netassist.db`. Delete that file to reset everything.
Run NetAssist on the computer whose network you want to test: the tests run on the machine hosting the server.

## Pages
Public: Home (with intro video), Login, Register, Contact. After login (sidebar layout): Dashboard, Troubleshooting Wizard,
Network Information, Diagnostic History, Analytics, Settings, Contact, and Admin Panel (admin only).

## Features
- Register, login, logout (scrypt-hashed passwords, server-side sessions in SQLite, login lockout)
- Troubleshooting wizard: choose problem, review, live test progress, results (Next / Back / Cancel)
- 6 problems: No connection, DNS, Unreachable gateway, High latency, Packet loss, Slow internet
- Real tests: adapter/IP, gateway ping, internet ping (ICMP, TCP fallback), packet loss, latency/jitter, system DNS, public DNS, HTTPS, download speed
- Rule-based explanations: cause, plain-language meaning, ordered fixes, limitations
- Per-user history, saved reports, re-test with before/after comparison, save as PDF (browser print)
- Dashboard with stats, Contact page, Admin panel (view, resolve, delete messages)
- Analytics: issues-by-type donut, response-time line chart, before/after comparison (plain SVG, no chart library)
- Network Information page (adapters, gateway, DNS servers, public IP), Settings (profile, password, clear history)
- Responsive on phone, tablet, and desktop (sidebar becomes a slide-in menu), light/dark mode, loading / empty / error states
- Team logo and background video (`public/media/`); the intro video plays once per browser session with a Skip button (add `?nosplash` to the URL to skip)

## Project structure
- `server.js` Express app, API routes, auth, page guards
- `src/db.js` schema, password hashing, prepared queries, demo seed
- `src/tests.js` individual network tests
- `src/rules.js` diagnostic rules (the decision table in code)
- `src/engine.js` runs a plan of tests and exposes live progress
- `public/` public pages, CSS, JS, images, and video; `views/` pages that require login

## Login popup
The login, register and forgot-password popup (design by the team's login form) lives in public/js/authpopup.js and public/css/authpopup.css. /login and /register open it on the home page.

## Database tables
`users`, `sessions`, `diagnostics` (one JSON report per run, linked to a user), `messages`.

## Notes and limits
- Read-only: nothing on the network is changed. Not a replacement for Wireshark or Packet Tracer.
- Cannot see inside the ISP network. Some systems block ping; results then say "skipped" or "inconclusive".
- Gateway detection works on Windows, macOS, and Linux; you can type the router IP if detection fails.
