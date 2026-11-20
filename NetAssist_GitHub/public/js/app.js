// Shared helpers: API calls, app shell, icons, charts, report rendering.
const NA = (() => {
  const P = {
    'wifi-off': '<path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.7M14.8 10.3A10 10 0 0 1 19 12.9"/><circle cx="12" cy="20" r="1" fill="currentColor"/>',
    wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    router: '<rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 17h.01M11 17h.01M8 14V9M16 14V9M5.5 6.5a4 4 0 0 1 5 0M13.5 6.5a4 4 0 0 1 5 0"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    drops: '<path d="M7 3c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9zM17 10c2 2.6 3.5 4.3 3.5 6.2a3.5 3.5 0 0 1-7 0c0-1.9 1.5-3.6 3.5-6.2z"/>',
    gauge: '<path d="M4 17a9 9 0 1 1 16 0"/><path d="M12 14l4-5"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>', play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>', print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>', loader: '<path d="M12 3a9 9 0 1 0 9 9"/>', dot: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5"/>',
    dashboard: '<rect x="3" y="3" width="8" height="9" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="12" width="8" height="9" rx="2"/><rect x="3" y="16" width="8" height="5" rx="2"/>',
    wizard: '<path d="M4 20L15 9M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5l-6 5.5M12 11.5l6 5.5"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6"/>',
    pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  };
  const icon = (n, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${P[n] || ''}</svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);

  async function api(method, url, body) {
    const opt = { method, headers: { 'X-Requested-With': 'netassist' }, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opt); } catch (e) { const er = new Error('Cannot reach the NetAssist server. Is it running?'); er.network = true; throw er; }
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) { const er = new Error(data.error || 'Request failed.'); er.status = res.status; er.field = data.field; throw er; }
    return data;
  }
  function toast(msg) {
    let box = $('.toast-box');
    if (!box) { box = document.createElement('div'); box.className = 'toast-box'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }
  const when = (s) => { if (!s) return ''; const d = new Date(String(s).includes('T') ? s : s.replace(' ', 'T') + 'Z'); return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); };
  const VERDICT = { ok: 'All clear', issue: 'Issue found', inconclusive: 'Inconclusive', resolved: 'Resolved' };
  const PROBLEM_NAMES = { no_connection: 'No Internet / Network Connection', dns: 'DNS Problems', gateway: 'Unreachable Gateway', latency: 'High Latency', packet_loss: 'Packet Loss', slow: 'Slow Internet Connection' };
  const PROBLEM_SHORT = { no_connection: 'No Internet', dns: 'DNS', gateway: 'Gateway', latency: 'High Latency', packet_loss: 'Packet Loss', slow: 'Slow Internet' };
  const PROBLEM_ICON = { no_connection: 'wifi-off', dns: 'globe', gateway: 'router', latency: 'timer', packet_loss: 'drops', slow: 'gauge' };
  const badge = (v) => `<span class="badge ${esc(v)}">${esc(VERDICT[v] || v)}</span>`;
  const sessionId = (id, created) => 'NS-' + String(created || '').slice(0, 10).replace(/-/g, '') + '-' + String(id).padStart(3, '0');

  // ---------- shell ----------
  let user = null;
  const NAV = [['dashboard', '/dashboard', 'Dashboard', 'dashboard'], ['diagnose', '/diagnose', 'Troubleshooting Wizard', 'wizard'], ['network', '/network', 'Network Information', 'network'], ['history', '/history', 'Diagnostic History', 'history'], ['analytics', '/analytics', 'Analytics', 'chart']];
  const TITLES = { dashboard: 'Dashboard', diagnose: 'Troubleshooting Wizard', network: 'Network Information', history: 'Diagnostic History', analytics: 'Analytics', settings: 'Settings', admin: 'Admin Panel', contact: 'Contact' };

  async function init({ active, require, pub } = {}) {
    try { user = (await api('GET', '/api/auth/me')).user; } catch (e) { user = null; }
    if (require && !user) { location.href = '/login?next=' + encodeURIComponent(location.pathname); return null; }
    if (require === 'admin' && user.role !== 'admin') { location.href = '/dashboard'; return null; }
    if (user && !pub) buildShell(active); else buildPublic(active, pub);
    document.querySelectorAll('[data-i]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.i)));
    return user;
  }

  function themeToggle(id) {
    return `<button class="icon-btn" id="${id}" aria-label="Toggle dark mode"></button>`;
  }
  function wireTheme(id) {
    const btn = $('#' + id); if (!btn) return;
    const paint = () => { btn.innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'); };
    paint();
    btn.onclick = () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('na-theme', n); } catch (e) { /* ignore */ } paint(); };
  }
  async function logout() { try { await api('POST', '/api/auth/logout'); } catch (e) { /* ignore */ } location.href = '/'; }

  function buildShell(active) {
    document.body.classList.add('has-shell');
    const nav = $('#nav'), main = $('main'), foot = $('#footer');
    const items = NAV.map(([k, href, label, ic]) => `<a class="item" href="${href}"${active === k ? ' aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')
      + (user.role === 'admin' ? `<a class="item" href="/admin"${active === 'admin' ? ' aria-current="page"' : ''}>${icon('inbox')}Admin Panel</a>` : '');
    const shell = document.createElement('div'); shell.className = 'shell';
    shell.innerHTML = `<aside class="side" id="side" aria-label="Sidebar"><a class="brand" href="/dashboard"><img src="/img/logo-icon.png" alt="">NetAssist</a>
      <nav aria-label="Main">${items}</nav><div class="spacer"></div>
      <div class="foot"><a class="item" href="/settings"${active === 'settings' ? ' aria-current="page"' : ''}>${icon('settings')}Settings</a><a class="item" href="/contact"${active === 'contact' ? ' aria-current="page"' : ''}>${icon('mail')}Contact</a><button class="item" id="logout">${icon('logout')}Logout</button></div></aside>
      <div class="scrim" id="scrim"></div>
      <div class="content"><header class="topbar"><button class="icon-btn menu-btn" id="menu" aria-label="Open menu" aria-controls="side">${icon('menu')}</button><span class="ttl">${esc(TITLES[active] || '')}</span><span class="sp"></span>
        <span class="date" id="clock"></span>${themeToggle('theme')}<a class="whoami" href="/settings" style="text-decoration:none;color:inherit"><span class="avatar">${esc(initials(user.name))}</span><div><b>${esc(user.name)}</b><small>${user.role === 'admin' ? 'Administrator' : 'Member'}</small></div></a></header></div>`;
    const content = $('.content', shell);
    nav.remove(); main.parentNode.insertBefore(shell, main); content.appendChild(main); if (foot) content.appendChild(foot);
    wireTheme('theme'); renderFooter();
    $('#logout').onclick = logout;
    const close = () => shell.classList.remove('open');
    $('#menu').onclick = () => shell.classList.toggle('open'); $('#scrim').onclick = close;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    const tick = () => { const c = $('#clock'); if (c) c.textContent = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }; tick(); setInterval(tick, 30000);
  }
  const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

  function buildPublic(active, pub) {
    const nav = $('#nav'); if (!nav) return;
    if (pub === 'none') { nav.remove(); const f = $('#footer'); if (f) f.remove(); return; }
    const overVideo = pub === 'hero';
    nav.className = 'pubnav' + (overVideo ? '' : ' solid');
    const right = user ? `<a class="btn btn-grad btn-sm" href="/dashboard">Open dashboard</a>` : `<a class="btn ${overVideo ? 'btn-glass' : 'btn-ghost'} btn-sm" href="/login">Log in</a><a class="btn btn-grad btn-sm" href="/register">Sign up</a>`;
    nav.innerHTML = `<div class="wrap"><a class="brand" href="/"><img src="/img/logo-icon.png" alt="">NetAssist</a>
      <nav class="links" id="pub-links" aria-label="Main">
      <a href="/">Home</a>
      <a href="/#problems">What it checks</a>
      <a href="/#how">How it works</a>
      <a href="/#team">Our team</a>
      
      <a href="/contact">Contact</a>
      ${user ? '' : '<a class="m-only" href="/login">Log in</a>'}
    </nav>
      <div class="right">${right}${themeToggle('theme')}<button class="icon-btn pub-menu-btn" id="pub-menu" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="pub-links">${icon('menu')}</button></div></div>`;
      // Sticky navbar scroll effect
      const updateNavbar = () => {
          if (window.scrollY > 40) {
              nav.classList.add('solid');
          } else if (overVideo) {
              nav.classList.remove('solid');
          }
      };

      updateNavbar();

      window.addEventListener('scroll', updateNavbar, {
          passive: true
      });
      wireTheme('theme'); renderFooter();
    
    // Mobile menu: the links become a dropdown panel at 900px and below.
    const pubMenu = $('#pub-menu');
    const setMenuOpen = (open) => { nav.classList.toggle('open', open); pubMenu.setAttribute('aria-expanded', String(open)); };
    pubMenu.onclick = () => setMenuOpen(!nav.classList.contains('open'));
    nav.querySelectorAll('.links a').forEach((a) => a.addEventListener('click', () => setMenuOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenuOpen(false); });
    
    window.addEventListener('resize', () => { if (window.innerWidth > 900) setMenuOpen(false); });
    // Header turns solid once the page is scrolled, so it stays readable over content.
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  function renderFooter() {
    const el = $('#footer'); if (!el) return;
    el.className = 'footer';
    el.innerHTML = '<div class="wrap"><span>NetAssist: A Web-Based Network Troubleshooting and Diagnostic System · IT 314 Final Project, Group 4</span><span>Safe, read-only checks. Nothing on your network is changed.</span></div>';
  }

  // ---------- charts (plain SVG, no libraries) ----------
  const COLORS = ['#7c4dff', '#3b82f6', '#22d3ee', '#f59e0b', '#ef4444', '#22c55e'];
  function donut(data, size = 170) {
    const total = data.reduce((a, d) => a + d.value, 0);
    const r = 62, c = 2 * Math.PI * r; let off = 0;
    const segs = total ? data.filter((d) => d.value > 0).map((d) => {
      const len = (d.value / total) * c; const s = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${d.color}" stroke-width="22" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"><title>${esc(d.label)}: ${d.value}</title></circle>`; off += len; return s;
    }).join('') : `<circle cx="80" cy="80" r="${r}" fill="none" stroke="var(--line)" stroke-width="22"/>`;
    return `<svg class="donut" viewBox="0 0 160 160" width="${size}" height="${size}" role="img" aria-label="Donut chart, ${total} total">${segs}<text x="80" y="78" text-anchor="middle" font-size="24" font-weight="700">${total}</text><text x="80" y="96" text-anchor="middle" font-size="10" style="fill:var(--muted)">total</text></svg>`;
  }
  function legend(data) {
    const total = data.reduce((a, d) => a + d.value, 0) || 1;
    return `<div class="legend">${data.map((d) => `<div><i style="background:${d.color}"></i><span>${esc(d.label)}</span><b>${Math.round((d.value / total) * 100)}%</b></div>`).join('')}</div>`;
  }
  function lineChart(series, unit = 'ms') {
    const W = 560, H = 230, L = 42, R = 12, T = 12, B = 30;
    const vals = series.map((s) => s.avg).filter((v) => v != null);
    if (!vals.length) return '';
    const max = Math.max(50, Math.ceil(Math.max(...vals) / 50) * 50);
    const x = (i) => L + (series.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (series.length - 1));
    const y = (v) => T + (1 - v / max) * (H - T - B);
    let g = ''; for (let i = 0; i <= 4; i++) { const v = (max / 4) * i; g += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
    const step = Math.ceil(series.length / 7); let xl = '';
    series.forEach((s, i) => { if (i % step === 0 || i === series.length - 1) xl += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${s.date.slice(5).replace('-', '/')}</text>`; });
    let path = '', seg = []; const segs = [];
    series.forEach((s, i) => { if (s.avg == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push([x(i), y(s.avg)]); }); if (seg.length) segs.push(seg);
    path = segs.filter((s) => s.length > 1).map((s) => `<path d="M${s.map((p) => p.join(',')).join(' L')}" fill="none" stroke="url(#lg)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    const pts = series.map((s, i) => s.avg == null ? '' : `<circle cx="${x(i)}" cy="${y(s.avg)}" r="4.5" fill="var(--surface)" stroke="#3b82f6" stroke-width="2.5"><title>${s.date}: ${s.avg} ${unit}</title></circle>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average response time per day in ${unit}"><defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#7c4dff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>${g}${xl}${path}${pts}<text x="${L}" y="9" style="font-weight:600">${unit}</text></svg>`;
  }
  function pairBars(label, unit, before, after) {
    if (before == null && after == null) return '';
    const max = Math.max(before || 0, after || 0, 1), H = 110;
    const h = (v) => Math.max(3, ((v || 0) / max) * H);
    const b = (v, x, col, name) => v == null ? '' : `<rect x="${x}" y="${130 - h(v)}" width="34" height="${h(v)}" rx="6" fill="${col}"><title>${name}: ${v}${unit}</title></rect><text x="${x + 17}" y="${126 - h(v)}" text-anchor="middle" style="font-weight:600;fill:var(--ink)">${v}${unit}</text>`;
    return `<figure><svg class="chart" viewBox="0 0 120 142" role="img" aria-label="${esc(label)} before ${before}${unit}, after ${after}${unit}"><line class="axis-l" x1="8" x2="112" y1="130" y2="130"/>${b(before, 20, '#f59e0b', 'Before')}${b(after, 66, '#22c55e', 'After')}<text x="37" y="141">Before</text><text x="83" y="141">After</text></svg><figcaption>${esc(label)}</figcaption></figure>`;
  }

  // ---------- diagnostic report ----------
  const SEV = { critical: ['issue', 'Needs attention'], warning: ['inconclusive', 'Worth checking'], info: ['skip', 'Note'] };
  const STEP_ICON = { pass: 'check', fail: 'x', warn: 'alert', skip: 'info', pending: 'dot', running: 'loader' };
  const STATUS_WORD = { pass: 'Passed', fail: 'Failed', warn: 'Warning', skip: 'Skipped' };
  function stepsHtml(steps) {
    return `<ul class="tests">${steps.map((s) => `<li class="${esc(s.status)}"><span class="ti">${icon(STEP_ICON[s.status] || 'dot', s.status === 'running' ? 'spin' : '')}</span>
      <div><div class="t">${esc(s.label)}</div>${s.summary ? `<div class="s">${esc(s.summary)}</div>` : ''}</div>
      ${STATUS_WORD[s.status] ? `<span class="badge ${esc(s.status)}">${STATUS_WORD[s.status]}</span>` : ''}</li>`).join('')}</ul>`;
  }
  function compareHtml(prev, cur) {
    const pm = Object.fromEntries(prev.report.steps.map((s) => [s.id, s]));
    const rows = cur.steps.map((s) => { const p = pm[s.id];
      return `<tr><td>${esc(s.label)}</td><td>${p ? `<span class="badge ${esc(p.status)}">${esc(STATUS_WORD[p.status] || p.status)}</span>` : '<span class="muted">not run</span>'}</td><td><span class="badge ${esc(s.status)}">${esc(STATUS_WORD[s.status] || s.status)}</span></td></tr>`; }).join('');
    const improved = prev.report.verdict === 'issue' && cur.verdict === 'ok';
    return `<div class="card" style="margin-top:16px"><h3>Before and after</h3><p class="muted">${improved ? 'The problem found earlier is no longer showing up. Nice work.' : 'Compared with your earlier test on ' + esc(when(prev.created_at)) + '.'}</p>
      <div class="tablewrap"><table class="compare"><thead><tr><th>Test</th><th>Earlier</th><th>Now</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  function renderReport(root, rep, opts = {}) {
    const vi = { ok: 'check', issue: 'alert', inconclusive: 'info' }[rep.verdict] || 'info';
    const title = rep.verdict === 'issue' ? rep.headline : rep.verdict === 'ok' ? 'No issue detected' : rep.headline;
    const findings = rep.findings.map((f) => { const [cls, label] = SEV[f.severity] || SEV.info;
      return `<article class="card finding"><div class="head"><span class="badge ${cls}">${label}</span><h3>${esc(f.title)}</h3></div><p>${esc(f.explanation)}</p>
        ${f.causes && f.causes.length ? `<h4>Possible causes</h4><ul>${f.causes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${f.steps && f.steps.length ? `<h4>Recommended steps</h4><ol>${f.steps.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>` : ''}
        ${f.limitation ? `<div class="limit"><b>Good to know:</b> ${esc(f.limitation)}</div>` : ''}</article>`; }).join('')
      || `<article class="card"><h3>${esc(rep.headline)}</h3><p class="muted" style="margin:0">${esc(rep.summary)}</p></article>`;
    root.innerHTML = `<div class="verdict ${esc(rep.verdict)}"><span class="vi">${icon(vi)}</span><div class="vtxt"><h2>${esc(title)}</h2>
        <p>${esc(PROBLEM_NAMES[rep.problem] || '')}${opts.id ? ' · Session ID <b class="mono">#' + esc(sessionId(opts.id, opts.created)) + '</b>' : ''}${opts.date ? ' · ' + esc(opts.date) : ''}</p></div>${opts.actions || ''}</div>
      <div class="split" style="margin-top:16px"><div class="card"><h3>Test results</h3>${stepsHtml(rep.steps)}</div><div>${findings}</div></div>
      ${opts.previous ? compareHtml(opts.previous, rep) : ''}`;
  }

  return { icon, esc, $, api, toast, when, badge, init, renderReport, stepsHtml, donut, legend, lineChart, pairBars, sessionId, COLORS, PROBLEM_NAMES, PROBLEM_SHORT, PROBLEM_ICON, VERDICT, get user() { return user; } };
})();
