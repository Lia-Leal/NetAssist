(async () => {
  const user = await NA.init({ active: 'diagnose', require: true }); if (!user) return;
  const stage = NA.$('#stage'), stepper = NA.$('#stepper'), sub = NA.$('#sub');
  const params = new URLSearchParams(location.search);
  let problems = {}, chosen = null, gateway = '', retestOf = params.get('retest') || null, step = 1, timer = null;
  const STEPS = ['Select issue', 'Run tests', 'View results'];
  const go = (n) => { step = n; stepper.innerHTML = STEPS.map((s, i) => `<li class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}"${i + 1 === step ? ' aria-current="step"' : ''}><b>${i + 1 < step ? '✓' : i + 1}</b>${s}</li>`).join(''); window.scrollTo({ top: 0 }); };

  function viewChoose() {
    go(1); sub.textContent = 'Select a network problem and we will guide you through the diagnostic process.';
    const p = chosen && problems[chosen];
    const needsGw = p && p.tests.some((t) => /gateway/i.test(t));
    stage.innerHTML = `<div class="card"><h3>What network problem are you experiencing?</h3>
      ${retestOf ? '<div class="alert info">This is a re-test. You will see a before and after comparison with your earlier report.</div>' : ''}
      <div class="choices" role="radiogroup" aria-label="Network problem">${Object.entries(problems).map(([k, v]) =>
        `<button class="choice" type="button" role="radio" data-k="${k}" aria-checked="${chosen === k}"><span class="radio"></span><span class="pico">${NA.icon(v.icon)}</span><span><h3>${NA.esc(v.title)}</h3><p>${NA.esc(v.blurb)}</p></span></button>`).join('')}</div>
      ${p ? `<div style="margin-top:18px;padding:14px 16px;background:var(--surface-2);border-radius:14px"><b style="font-size:.9rem">These tests will run (about 10 to 40 seconds):</b><ul style="margin:6px 0 0;padding-left:20px;font-size:.9rem" class="muted">${p.tests.map((t) => `<li>${NA.esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${needsGw ? `<div class="field" style="max-width:380px;margin-top:16px"><label for="gw">Router IP address <span class="muted">(optional)</span></label><input id="gw" inputmode="decimal" placeholder="e.g. 192.168.1.1" value="${NA.esc(gateway)}"><div class="hint">Leave blank to detect it automatically.</div><div class="err"></div></div>` : ''}
    </div>
    <div class="wiz-actions"><a class="btn btn-ghost" href="/dashboard">Cancel</a><button class="btn btn-primary" id="next" ${chosen ? '' : 'disabled'}>${retestOf ? 'Run test again' : 'Next'} ${NA.icon('play')}</button></div>`;
    stage.querySelectorAll('.choice').forEach((b) => b.onclick = () => { const g = NA.$('#gw'); if (g) gateway = g.value; chosen = b.dataset.k; viewChoose(); stage.querySelector(`[data-k="${chosen}"]`).focus(); });
    NA.$('#next').onclick = start;
  }

  async function start() {
    const gwEl = NA.$('#gw'); gateway = gwEl ? gwEl.value.trim() : gateway;
    if (gwEl && gateway && !/^(\d{1,3}\.){3}\d{1,3}$/.test(gateway)) { const f = gwEl.closest('.field'); f.classList.add('invalid'); f.querySelector('.err').textContent = 'Use the format 192.168.1.1'; gwEl.focus(); return; }
    const btn = NA.$('#next'); btn.disabled = true;
    try { const r = await NA.api('POST', '/api/diagnostics', { problem: chosen, gateway, retestOf }); viewRunning(r.runId); }
    catch (e) { btn.disabled = false; NA.toast(e.message); }
  }

  function consoleHtml(steps) {
    const L = ['<span class="dim">$ netassist run --problem ' + NA.esc(chosen) + '</span>'];
    for (const s of steps) {
      if (s.status === 'pending') continue;
      L.push('&gt; ' + NA.esc(s.label) + (s.status === 'running' ? ' …' : ''));
      if (s.status !== 'running') L.push(`<span class="${s.status === 'pass' ? 'ok' : s.status === 'fail' ? 'bad' : 'dim'}">  ${NA.esc(s.summary || s.status)}</span>`);
    }
    return L.join('<br>');
  }

  function viewRunning(runId) {
    go(2); sub.textContent = 'Running tests for: ' + problems[chosen].title;
    stage.innerHTML = `<div class="run-grid"><div class="card"><div class="row" style="margin-bottom:14px"><span class="radar"><img src="/img/logo-icon.png" alt=""></span><div><h3 style="margin:0">Network diagnostics</h3><span class="muted" style="font-size:.88rem">Please keep this page open.</span></div></div><div id="steps"></div></div>
      <div class="card"><h3>Test progress</h3><div class="row between" style="font-size:.85rem"><span class="muted" id="plabel">Starting…</span><b id="pct">0%</b></div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="pbar"><i id="bar"></i></div>
        <div class="console" id="con" aria-live="off" style="margin-top:14px"></div></div></div>
      <div class="wiz-actions"><button class="btn btn-ghost" id="cancel">Cancel</button><span></span></div>`;
    NA.$('#cancel').onclick = () => { clearTimeout(timer); location.href = '/dashboard'; };
    let misses = 0;
    const poll = async () => {
      try {
        const s = await NA.api('GET', '/api/diagnostics/' + runId); misses = 0;
        const done = s.steps.filter((x) => !['pending', 'running'].includes(x.status)).length, pct = Math.round((done / s.steps.length) * 100);
        NA.$('#bar').style.width = pct + '%'; NA.$('#pct').textContent = pct + '%'; NA.$('#pbar').setAttribute('aria-valuenow', pct); NA.$('#plabel').textContent = `${done}/${s.steps.length} tests complete`;
        NA.$('#steps').innerHTML = NA.stepsHtml(s.steps);
        const con = NA.$('#con'); con.innerHTML = consoleHtml(s.steps) + (s.state === 'running' ? '<br><span class="dim">running…</span>' : ''); con.scrollTop = con.scrollHeight;
        if (s.state === 'done' && s.historyId) return viewResults(s.historyId);
        if (s.state === 'error') return viewError(s.error || 'The test run failed.');
      } catch (e) { if (e.status === 404 || e.status === 401) return viewError(e.message); if (++misses > 5) return viewError(e.message); }
      timer = setTimeout(poll, 700);
    };
    poll();
  }
  function viewError(msg) {
    go(2); stage.innerHTML = `<div class="card"><div class="alert bad">${NA.esc(msg)}</div><div class="row"><button class="btn btn-primary" id="again">Try again</button><a class="btn btn-ghost" href="/dashboard">Back to dashboard</a></div></div>`;
    NA.$('#again').onclick = viewChoose;
  }
  async function viewResults(id) {
    go(3); sub.textContent = 'Here is what we found.';
    try {
      const d = await NA.api('GET', '/api/history/' + id);
      stage.innerHTML = '<div id="rep"></div><div class="wiz-actions no-print"><a class="btn btn-ghost" href="/dashboard">Done</a><span></span></div>';
      const actions = `<span class="row no-print"><button class="btn btn-ghost btn-sm" id="print">${NA.icon('print')} Save as PDF</button><a class="btn btn-primary btn-sm" href="/diagnose?problem=${encodeURIComponent(d.problem)}&retest=${d.id}">${NA.icon('refresh')} Run test again</a></span>`;
      NA.renderReport(NA.$('#rep'), d.report, { date: NA.when(d.created_at), previous: d.previous, id: d.id, created: d.created_at, actions });
      NA.$('#print').onclick = () => window.print();
      stepper.querySelectorAll('li').forEach((li) => li.classList.add('done'));
    } catch (e) { viewError(e.message); }
  }
  try { problems = (await NA.api('GET', '/api/problems')).problems; } catch (e) { stage.innerHTML = `<div class="alert bad">${NA.esc(e.message)}</div>`; return; }
  const pre = params.get('problem'); if (pre && problems[pre]) chosen = pre;
  viewChoose();
})();
