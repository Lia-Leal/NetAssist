(async () => {
  const user = await NA.init({ active: 'analytics', require: true }); if (!user) return;
  const root = NA.$('#an'), sel = NA.$('#days');
  async function load() {
    try {
      const d = await NA.api('GET', '/api/analytics?days=' + sel.value);
      if (!d.total) { root.innerHTML = `<div class="card empty">${NA.icon('chart')}<p><b>No data in this period yet.</b><br>Run a few diagnostics and your trends will appear here.</p><a class="btn btn-primary" href="/diagnose">Run a test</a></div>`; return; }
      const data = Object.keys(NA.PROBLEM_NAMES).map((k, i) => ({ label: NA.PROBLEM_SHORT[k], value: d.byProblem[k] || 0, color: NA.COLORS[i] })).filter((x) => x.value > 0);
      const line = NA.lineChart(d.series);
      const ba = d.beforeAfter ? [NA.pairBars('Latency', ' ms', d.beforeAfter.before.latency, d.beforeAfter.after.latency), NA.pairBars('Packet loss', '%', d.beforeAfter.before.loss, d.beforeAfter.after.loss), NA.pairBars('DNS lookup', ' ms', d.beforeAfter.before.dns, d.beforeAfter.after.dns)].join('') : '';
      root.innerHTML = `<div class="split wide">
        <div class="card"><h3>Issues by type</h3><div class="donut-wrap">${NA.donut(data)}${NA.legend(data)}</div></div>
        <div class="card"><h3>Response time</h3>${line || '<div class="empty">Run a latency, slow-internet, or no-connection test to see response times here.</div>'}<p class="muted" style="font-size:.82rem;margin:8px 0 0">Average round-trip time to the internet per day, from your saved tests.</p></div></div>
        <div class="card" style="margin-top:16px"><h3>Before / after comparison</h3>${ba.trim() ? `<p class="muted" style="font-size:.9rem">Your latest re-test (${NA.esc(NA.PROBLEM_NAMES[d.beforeAfter.problem] || '')}, ${NA.esc(NA.when(d.beforeAfter.when))}). Lower is better.</p><div class="ba">${ba}</div>` : '<div class="empty">Re-test after applying a fix to see a before and after comparison here.</div>'}</div>`;
    } catch (e) { root.innerHTML = `<div class="alert bad">${NA.esc(e.message)}</div>`; }
  }
  sel.onchange = load; load();

  // ---- Download a chart card as a PNG picture (useful for reports and slides) ----
  const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor'];
  function svgToImage(svg) {
    const r = svg.getBoundingClientRect(), clone = svg.cloneNode(true);
    const a = [svg, ...svg.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
    a.forEach((el, k) => { const cs = getComputedStyle(el); PROPS.forEach((pr) => { const v = cs.getPropertyValue(pr); if (v) b[k].style.setProperty(pr, v); }); });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', r.width); clone.setAttribute('height', r.height);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    return new Promise((ok, no) => { const im = new Image(); im.onload = () => ok({ im, w: r.width, h: r.height }); im.onerror = no; im.src = url; });
  }
  async function downloadCard(card, name) {
    const cs = getComputedStyle(card), ink = getComputedStyle(document.body).color, muted = '#6b7a99';
    const title = (card.querySelector('h3') || {}).textContent || 'Chart';
    const imgs = await Promise.all([...card.querySelectorAll('svg.donut, svg.chart')].map(svgToImage));
    const legend = [...card.querySelectorAll('.legend > div')].map((d) => ({ c: d.querySelector('i').style.background, t: d.querySelector('span').textContent, v: d.querySelector('b').textContent }));
    const pad = 24, gap = 16, maxW = 760; let x = pad, y = pad + 36, rowH = 0, W = 360;
    const place = imgs.map((o) => { if (x + o.w > maxW && x > pad) { x = pad; y += rowH + gap; rowH = 0; } const p = { o, x, y }; x += o.w + gap; rowH = Math.max(rowH, o.h); W = Math.max(W, x); return p; });
    let H = y + rowH + pad; const legendY = H; if (legend.length) H += legend.length * 24 + 10;
    H += 24; const k = 2, cv = document.createElement('canvas'); cv.width = W * k; cv.height = H * k; const g = cv.getContext('2d'); g.scale(k, k);
    g.fillStyle = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = ink; g.font = '700 18px Arial, sans-serif'; g.fillText(title, pad, pad + 14);
    place.forEach((p) => g.drawImage(p.o.im, p.x, p.y, p.o.w, p.o.h));
    g.font = '14px Arial, sans-serif'; legend.forEach((l, n) => { const yy = legendY + n * 24 + 14; g.fillStyle = l.c; g.fillRect(pad, yy - 10, 12, 12); g.fillStyle = ink; g.fillText(`${l.t}  ${l.v}`, pad + 20, yy); });
    g.fillStyle = muted; g.font = '12px Arial, sans-serif'; g.fillText('NetAssist · ' + new Date().toLocaleDateString(), pad, H - 10);
    const a = document.createElement('a'); a.download = name + '.png'; a.href = cv.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove();
  }
  function addButtons() {
    root.querySelectorAll('.card').forEach((card, n) => {
      const h = card.querySelector('h3'); if (!h || !card.querySelector('svg.donut, svg.chart') || card.querySelector('[data-png]')) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost btn-sm'; b.dataset.png = '1'; b.style.cssText = 'float:right;margin-top:-4px'; b.textContent = 'Download PNG'; b.title = 'Download this chart as a PNG picture';
      b.onclick = async () => { b.disabled = true; try { await downloadCard(card, 'netassist-' + h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')); } catch (e) { NA.toast('Could not create the picture.'); } b.disabled = false; };
      h.parentNode.insertBefore(b, h);
    });
  }
  new MutationObserver(addButtons).observe(root, { childList: true });
})();
