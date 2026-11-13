(async () => {
  const user = await NA.init({ active: 'history', require: true }); if (!user) return;
  let page = 1;
  const list = NA.$('#list'), pager = NA.$('#pager'), clear = NA.$('#clear'), q = NA.$('#q'), days = NA.$('#days');
  NA.$('#sbox').insertAdjacentHTML('afterbegin', NA.icon('search')); clear.innerHTML = NA.icon('trash') + ' Clear all';
  const statusOf = (r) => (r.verdict === 'issue' && r.resolved ? 'resolved' : r.verdict);
  async function load() {
    try {
      const d = await NA.api('GET', `/api/history?page=${page}&days=${days.value}&q=${encodeURIComponent(q.value.trim())}`);
      clear.hidden = d.total === 0 && !q.value && days.value === '0';
      if (!d.items.length) {
        const filtered = q.value || days.value !== '0';
        list.innerHTML = `<div class="empty">${NA.icon(filtered ? 'search' : 'history')}<p><b>${filtered ? 'No reports match your search.' : 'Nothing here yet.'}</b><br>${filtered ? 'Try a different word or date range.' : 'Your saved reports will appear after you run a test.'}</p>${filtered ? '' : '<a class="btn btn-primary" href="/diagnose">Run a test</a>'}</div>`; pager.innerHTML = ''; return;
      }
      list.innerHTML = `<div class="tablewrap"><table class="list cards"><thead><tr><th>Date and time</th><th>Issue</th><th>Result</th><th>Status</th><th>Action</th></tr></thead><tbody>${d.items.map((r) =>
        `<tr><td data-l="When">${NA.esc(NA.when(r.created_at))}</td><td data-l="Issue"><b>${NA.esc(NA.PROBLEM_SHORT[r.problem] || r.problem)}</b>${r.retest_of ? ' <span class="muted">(re-test)</span>' : ''}</td><td data-l="Result" class="muted">${NA.esc(r.headline)}</td><td data-l="Status">${NA.badge(statusOf(r))}</td>
        <td><div class="row" style="flex-wrap:nowrap;gap:6px"><a class="btn btn-ghost btn-sm" href="/report?id=${r.id}">View</a><button class="btn btn-danger btn-sm" data-del="${r.id}" aria-label="Delete report">${NA.icon('trash')}</button></div></td></tr>`).join('')}</tbody></table></div>`;
      let pg = ''; if (d.pages > 1) { pg += `<button class="btn btn-ghost btn-sm" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">&lsaquo;</button>`; for (let i = 1; i <= d.pages; i++) pg += `<button class="btn btn-ghost btn-sm pg" data-p="${i}" ${i === page ? 'aria-current="true"' : ''}>${i}</button>`; pg += `<button class="btn btn-ghost btn-sm" data-p="${page + 1}" ${page >= d.pages ? 'disabled' : ''} aria-label="Next page">&rsaquo;</button>`; }
      pager.innerHTML = pg; pager.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { page = +b.dataset.p; load(); });
      list.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        if (!confirm('Delete this report?')) return;
        try { await NA.api('DELETE', '/api/history/' + b.dataset.del); NA.toast('Report deleted'); if (d.items.length === 1 && page > 1) page--; load(); } catch (e) { NA.toast(e.message); }
      });
    } catch (e) { list.innerHTML = `<div class="alert bad">${NA.esc(e.message)}</div>`; }
  }
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { page = 1; load(); }, 250); }); days.onchange = () => { page = 1; load(); };
  clear.onclick = async () => { if (!confirm('Delete ALL of your saved reports? This cannot be undone.')) return; try { await NA.api('DELETE', '/api/history'); page = 1; NA.toast('History cleared'); load(); } catch (e) { NA.toast(e.message); } };
  load();
})();
