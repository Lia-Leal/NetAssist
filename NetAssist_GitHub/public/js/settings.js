(async () => {
  const user = await NA.init({ active: 'settings', require: true }); if (!user) return;
  const pf = NA.$('#pf'), pw = NA.$('#pw');
  pf.name.value = user.name; pf.email.value = user.email;
  pf.addEventListener('submit', async (e) => {
    e.preventDefault(); FK.clear(pf); NA.$('#ok1').hidden = true; FK.banner(NA.$('#e1'), '');
    try { await NA.api('PATCH', '/api/auth/profile', { name: pf.name.value }); NA.$('#ok1').hidden = false; NA.toast('Profile saved'); }
    catch (ex) { if (!(ex.field && FK.mark(pf, ex.field, ex.message))) FK.banner(NA.$('#e1'), ex.message); }
  });
  pw.addEventListener('submit', async (e) => {
    e.preventDefault(); FK.clear(pw); NA.$('#ok2').hidden = true; FK.banner(NA.$('#e2'), '');
    try { await NA.api('POST', '/api/auth/password', { current: pw.current.value, next: pw.next.value }); pw.reset(); NA.$('#ok2').hidden = false; }
    catch (ex) { if (!(ex.field && FK.mark(pw, ex.field, ex.message))) FK.banner(NA.$('#e2'), ex.message); }
  });
  const t2 = NA.$('#theme2'); const paint = () => { const d = document.documentElement.dataset.theme === 'dark'; t2.innerHTML = NA.icon(d ? 'sun' : 'moon') + (d ? ' Switch to light mode' : ' Switch to dark mode'); }; paint();
  t2.onclick = () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('na-theme', n); } catch (e) { /* ignore */ } paint(); };
  const LABEL = { register: 'Account created', login: 'Signed in', auto_login: 'Signed in (remembered)', login_failed: 'Failed sign-in attempt', login_blocked: 'Sign-in blocked (too many tries)', logout: 'Signed out', test_run: 'Ran a diagnostic', delete_report: 'Deleted a report', clear_history: 'Cleared history', profile_update: 'Updated profile', password_change: 'Changed password', contact_message: 'Sent a message' };
  NA.api('GET', '/api/activity').then((a) => {
    NA.$('#actsum').textContent = `Total sign-ins: ${a.logins || 0}${a.lastLogin ? ' · Last sign-in: ' + NA.when(a.lastLogin) : ''}`;
    NA.$('#acts').innerHTML = a.items.length ? '<ul class="actlist">' + a.items.map((x) => `<li><b>${NA.esc(LABEL[x.action] || x.action)}</b>${x.detail ? ` <span class="muted">· ${NA.esc(x.detail)}</span>` : ''}<span class="muted" style="float:right;font-size:.82rem">${NA.esc(NA.when(x.created_at))}</span></li>`).join('') + '</ul>' : '<p class="muted">No activity yet.</p>';
  }).catch(() => { NA.$('#acts').innerHTML = ''; });
  const c = NA.$('#clear'); c.innerHTML = NA.icon('trash') + ' Clear my history';
  c.onclick = async () => { if (!confirm('Delete ALL of your saved reports? This cannot be undone.')) return; try { await NA.api('DELETE', '/api/history'); NA.toast('History cleared'); } catch (e) { NA.toast(e.message); } };
})();
