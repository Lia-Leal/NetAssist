(async () => {
  const user = await NA.init({ active: 'admin', require: 'admin' }); if (!user) return;
  const box = NA.$('#msgs'), revealed = {}; // passwords just set by the admin (kept in memory only, shown once)
  async function load() {
    try {
      const [s, m] = await Promise.all([NA.api('GET', '/api/admin/summary'), NA.api('GET', '/api/admin/messages')]);
      NA.$('#stats').innerHTML = [['blue', 'users', 'Registered users', s.users], ['green', 'pulse', 'Diagnostics run', s.diagnostics], ['blue', 'check', 'Test results saved', s.testResults], ['orange', 'mail', 'New messages', s.newMessages]].map(([c, i, l, n]) => `<div class="stat ${c}"><span class="si">${NA.icon(i)}</span><div><small>${l}</small><b>${n}</b></div></div>`).join('');
      const needsReset = (x) => x.kind === 'password_reset' && x.account_id && !x.reset_at;
      const resetPart = (x) => {
        if (x.kind !== 'password_reset') return '';
        if (!x.account_id) return '<div class="alert bad" style="margin-top:10px">No account uses this email, so there is no password to reset.</div>';
        const shown = revealed[x.id];
        const done = x.reset_at ? `<div class="alert ok" style="margin-top:10px">Password reset on ${NA.esc(NA.when(x.reset_at))} by ${NA.esc(x.reset_by || 'admin')}.</div>` : '';
        const pw = shown ? `<div class="alert ok" style="margin-top:10px">New password for <b>${NA.esc(shown.email)}</b>: <code style="font-size:1.05rem;font-weight:700">${NA.esc(shown.password)}</code> <button class="btn btn-ghost btn-sm" data-copy="${x.id}" type="button">Copy</button><br><span style="font-size:.85rem">Send it to the user and tell them to change it in Settings. It is shown only once.</span></div>` : '';
        const form = x.reset_at ? '' : `<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><input class="reset-pw" data-pw="${x.id}" type="text" autocomplete="off" placeholder="New password (blank = auto-generate)" maxlength="100" style="flex:1;min-width:200px;padding:9px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font:inherit"><button class="btn btn-primary btn-sm" data-reset="${x.id}" type="button">Reset password</button></div><p class="muted" style="font-size:.82rem;margin:6px 0 0">Reset the password first. "Mark resolved" unlocks after that.</p>`;
        return done + pw + form;
      };
      box.innerHTML = m.items.length ? m.items.map((x) => `<div class="msg ${x.status === 'resolved' ? 'resolved' : ''}">
        <div class="row between"><div><b>${NA.esc(x.subject)}</b> ${x.kind === 'password_reset' ? '<span class="badge fail">Password reset</span> ' : ''}<span class="badge ${x.status === 'new' ? 'inconclusive' : 'ok'}">${x.status}</span></div><span class="muted" style="font-size:.85rem">${NA.esc(NA.when(x.created_at))}</span></div>
        <div class="muted" style="font-size:.9rem">${NA.esc(x.name)} · <a href="mailto:${NA.esc(x.email)}">${NA.esc(x.email)}</a></div><pre>${NA.esc(x.body)}</pre>
        ${resetPart(x)}
        <div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-sm" data-tog="${x.id}" data-to="${x.status === 'new' ? 'resolved' : 'new'}" ${x.status === 'new' && needsReset(x) ? 'disabled title="Reset the password first"' : ''}>${x.status === 'new' ? 'Mark resolved' : 'Reopen'}</button><button class="btn btn-danger btn-sm" data-del="${x.id}">Delete</button></div></div>`).join('')
        : `<div class="empty">${NA.icon('inbox')}<p><b>No messages yet.</b><br>Messages from the Contact page and password-reset requests will show up here.</p></div>`;
      box.querySelectorAll('[data-tog]').forEach((b) => b.onclick = async () => { try { await NA.api('PATCH', '/api/admin/messages/' + b.dataset.tog, { status: b.dataset.to }); delete revealed[b.dataset.tog]; load(); } catch (e) { NA.toast(e.message, 'bad'); } });
      box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (confirm('Delete this message?')) { await NA.api('DELETE', '/api/admin/messages/' + b.dataset.del); load(); } });
      box.querySelectorAll('[data-reset]').forEach((b) => b.onclick = async () => {
        const id = b.dataset.reset, pw = box.querySelector(`[data-pw="${id}"]`).value.trim();
        if (!confirm('Change this user\'s password now? They will be signed out on all devices.')) return;
        b.disabled = true;
        try { const r = await NA.api('POST', `/api/admin/messages/${id}/reset-password`, pw ? { password: pw } : {}); revealed[id] = r; load(); }
        catch (e) { NA.toast(e.message, 'bad'); b.disabled = false; }
      });
      box.querySelectorAll('[data-copy]').forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(revealed[b.dataset.copy].password); NA.toast('Password copied.'); } catch (e) { NA.toast('Select and copy the password manually.', 'bad'); } });
    } catch (e) { box.innerHTML = `<div class="alert bad">${NA.esc(e.message)}</div>`; }
  }
  load();
  const tbl = (head, rows) => `<div class="tbl-wrap"><table class="tbl2"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const loaders = {
    async users() { const d = await NA.api('GET', '/api/admin/users'); NA.$('#users').innerHTML = tbl(['Name', 'Email', 'Role', 'Tests run', 'Sign-ins', 'Last sign-in', 'Registered'], d.items.map((u) => [NA.esc(u.name), NA.esc(u.email), u.role, u.tests_run, u.login_count, NA.esc(u.last_login_at ? NA.when(u.last_login_at) : '-'), NA.esc(NA.when(u.created_at))])); },
    async acts() { const d = await NA.api('GET', '/api/admin/activity'); NA.$('#acts').innerHTML = d.items.length ? tbl(['When', 'User', 'Action', 'Detail', 'IP'], d.items.map((a) => [NA.esc(NA.when(a.created_at)), NA.esc(a.email || '-'), NA.esc(a.action), NA.esc(a.detail || ''), NA.esc(a.ip || '')])) : '<p class="muted">No activity yet.</p>'; },
  };
  NA.$('#tabs').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    NA.$('#tabs').querySelectorAll('button').forEach((x) => { x.className = 'btn btn-sm ' + (x === b ? 'btn-primary' : 'btn-ghost'); });
    for (const id of ['msgs', 'users', 'acts']) NA.$('#' + id).hidden = id !== b.dataset.t;
    if (loaders[b.dataset.t]) { try { await loaders[b.dataset.t](); } catch (ex) { NA.$('#' + b.dataset.t).innerHTML = `<div class="alert bad">${NA.esc(ex.message)}</div>`; } }
  });
})();
