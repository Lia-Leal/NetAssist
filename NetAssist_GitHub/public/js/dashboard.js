(async () => {
  const user = await NA.init({ active: 'dashboard', require: true }); if (!user) return;
  NA.$('#hello').textContent = 'Hello, ' + user.name.split(' ')[0] + '!';
  NA.$('#run').innerHTML = NA.icon('play') + ' Run diagnostics';
  NA.$('#quick').innerHTML = Object.entries(NA.PROBLEM_NAMES).map(([k, n]) =>
    `<a class="row problem card" style="text-decoration:none;color:inherit;flex-wrap:nowrap;padding:14px" href="/diagnose?problem=${k}"><span class="pico">${NA.icon(NA.PROBLEM_ICON[k])}</span><b style="font-size:.92rem;line-height:1.3">${NA.esc(n)}</b></a>`).join('');
  const countUp = (el, to) => { const t0 = performance.now(); const f = (t) => { const p = Math.min(1, (t - t0) / 700); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };
  try {
    const s = await NA.api('GET', '/api/stats'); const v = s.verdicts;
    const tiles = [['blue', 'pulse', 'Total sessions', s.total], ['green', 'check', 'All clear', v.ok || 0], ['orange', 'alert', 'Issues found', v.issue || 0], ['violet', 'shield', 'Resolved', s.resolved || 0]];
    NA.$('#stats').innerHTML = tiles.map(([c, i, l]) => `<div class="stat ${c}"><span class="si">${NA.icon(i)}</span><div><small>${l}</small><b data-n>0</b></div></div>`).join('');
    NA.$('#stats').querySelectorAll('[data-n]').forEach((el, i) => countUp(el, tiles[i][3]));
    const data = Object.keys(NA.PROBLEM_NAMES).map((k, i) => ({ label: NA.PROBLEM_SHORT[k], value: s.byProblem[k] || 0, color: NA.COLORS[i] })).filter((d) => d.value > 0);
    NA.$('#common').innerHTML = s.total ? `<div class="donut-wrap">${NA.donut(data)}${NA.legend(data)}</div>` : '<div class="empty">Your most common issues will show up here after your first test.</div>';
    NA.$('#recent').innerHTML = s.recent.length ? `<ul class="activity">${s.recent.map((r) => {
      const st = r.verdict === 'issue' && r.resolved ? 'ok' : r.verdict; const ic = { ok: 'check', issue: 'alert', inconclusive: 'info' }[st];
      return `<li><a href="/report?id=${r.id}"><span class="ai ${st}">${NA.icon(ic)}</span><span><b>${NA.esc(r.headline)}</b><small>${NA.esc(NA.PROBLEM_NAMES[r.problem] || '')} · ${NA.esc(NA.when(r.created_at))}${r.verdict === 'issue' && r.resolved ? ' · resolved' : ''}</small></span></a></li>`; }).join('')}</ul>`
      : `<div class="empty">${NA.icon('history')}<p><b>No reports yet.</b><br>Run your first test and it will appear here.</p><a class="btn btn-primary" href="/diagnose">Run a test</a></div>`;
  } catch (e) {
    NA.$('#stats').innerHTML = `<div class="alert bad" style="grid-column:1/-1">${NA.esc(e.message)}</div>`; NA.$('#common').innerHTML = ''; NA.$('#recent').innerHTML = '';
  }
})();
