// Low-level network tests. Every test resolves to:
// { id, label, status: 'pass'|'warn'|'fail'|'skip', summary, data, ms }
// Tests never throw; failures are reported as results.
const os = require('os');
const net = require('net');
const dns = require('dns');
const fs = require('fs');
const { execFile } = require('child_process');

const HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9.\-:]{0,251})$/; // blocks shell/option injection (no leading '-')
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const round = (n, d = 1) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const now = () => Number(process.hrtime.bigint() / 1000000n);

function run(cmd, args, timeout) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout, stderr) =>
      resolve({ err, out: String(stdout || '') + String(stderr || '') }));
  });
}

// ---------- ping (ICMP via the OS ping command) ----------
function parsePing(out, sent) {
  let loss = null;
  const lm = out.match(/(\d+(?:\.\d+)?)%\s*(?:packet\s*)?loss/i);
  if (lm) loss = parseFloat(lm[1]);
  let min = null, avg = null, max = null, jitter = null;
  let m = out.match(/=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)\s*ms/); // linux/mac
  if (m) { min = +m[1]; avg = +m[2]; max = +m[3]; jitter = +m[4]; }
  else {
    m = out.match(/Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms,\s*Average\s*=\s*(\d+)ms/i); // windows
    if (m) { min = +m[1]; max = +m[2]; avg = +m[3]; jitter = max - min; }
  }
  if (loss == null) return null; // unparseable output
  return { sent, loss, min, avg, max, jitter };
}

async function icmpPing(host, count = 5) {
  if (!HOST_RE.test(host)) return { ok: false, reason: 'invalid-host' };
  const args = isWin ? ['-n', String(count), '-w', '2000', host]
    : isMac ? ['-c', String(count), '-i', '0.3', '-W', '2000', host]
      : ['-c', String(count), '-i', '0.3', '-W', '2', host];
  const { err, out } = await run('ping', args, 4000 + count * 2500);
  if (err && err.code === 'ENOENT') return { ok: false, reason: 'no-ping-command' };
  if (/operation not permitted|permission denied/i.test(out)) return { ok: false, reason: 'ping-not-permitted' };
  const stats = parsePing(out, count);
  if (!stats) return { ok: false, reason: 'unparseable' };
  // Windows reports "Destination host unreachable" replies as received; treat those as loss.
  if (isWin) {
    const replies = (out.match(/Reply from [^\r\n]*time[=<]\d+ms/gi) || []).length;
    stats.loss = round(((count - replies) / count) * 100, 0);
  }
  return { ok: true, method: 'icmp', ...stats };
}

// ---------- TCP probe (fallback when ICMP is unavailable) ----------
function tcpOnce(host, port, timeout) {
  return new Promise((resolve) => {
    const start = now();
    const s = net.connect({ host, port });
    const done = (ok) => { s.destroy(); resolve(ok ? now() - start : null); };
    s.setTimeout(timeout);
    s.once('connect', () => done(true));
    s.once('timeout', () => done(false));
    s.once('error', () => done(false));
  });
}
async function tcpProbe(host, port, count = 5) {
  const times = [];
  for (let i = 0; i < count; i++) times.push(await tcpOnce(host, port, 2000));
  const ok = times.filter((t) => t != null);
  const avg = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
  return {
    ok: true, method: 'tcp', sent: count,
    loss: round(((count - ok.length) / count) * 100, 0),
    min: ok.length ? Math.min(...ok) : null,
    avg: round(avg), max: ok.length ? Math.max(...ok) : null,
    jitter: ok.length > 1 ? round(Math.max(...ok) - Math.min(...ok)) : 0,
  };
}

// Reach an internet host: ICMP first, TCP/443 fallback.
async function reach(host, count) {
  const p = await icmpPing(host, count);
  if (p.ok) return p;
  const t = await tcpProbe(host, 443, count);
  t.fallbackReason = p.reason;
  return t;
}

// ---------- individual tests ----------
async function timed(id, label, fn) {
  const start = now();
  try {
    const r = await fn();
    return { id, label, ms: now() - start, ...r };
  } catch (e) {
    return { id, label, ms: now() - start, status: 'fail', summary: 'Test could not complete: ' + e.message, data: { error: e.message } };
  }
}

const testAdapter = () => timed('adapter', 'Network adapter and IP address', async () => {
  const ifs = os.networkInterfaces();
  const found = [];
  for (const [name, list] of Object.entries(ifs)) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) found.push({ name, address: a.address });
    }
  }
  const real = found.filter((f) => !f.address.startsWith('169.254.'));
  if (real.length) return { status: 'pass', summary: `Connected adapter found (${real[0].name}: ${real[0].address}).`, data: { adapters: real } };
  if (found.length) return { status: 'fail', summary: 'Adapter only has a self-assigned (169.254.x.x) address, so it did not get an IP from the router.', data: { adapters: found, selfAssigned: true } };
  return { status: 'fail', summary: 'No active network adapter with an IP address was found.', data: { adapters: [] } };
});

async function findGateway() {
  try {
    if (isWin) {
      const { out } = await run('ipconfig', [], 5000);
      const m = out.match(/Default Gateway[ .]*:\s*((?:\d{1,3}\.){3}\d{1,3})/i);
      return m ? m[1] : null;
    }
    if (isMac) {
      const { out } = await run('route', ['-n', 'get', 'default'], 5000);
      const m = out.match(/gateway:\s*((?:\d{1,3}\.){3}\d{1,3})/);
      return m ? m[1] : null;
    }
    const { out } = await run('ip', ['route', 'show', 'default'], 5000);
    const m = out.match(/default via ((?:\d{1,3}\.){3}\d{1,3})/);
    if (m) return m[1];
    const rt = fs.readFileSync('/proc/net/route', 'utf8').split('\n').slice(1);
    for (const line of rt) {
      const c = line.trim().split(/\s+/);
      if (c[1] === '00000000' && c[2]) {
        const h = c[2].match(/../g).reverse().map((x) => parseInt(x, 16));
        return h.join('.');
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

const testGateway = (override) => timed('gateway', 'Router / default gateway', async () => {
  const gw = override || (await findGateway());
  if (!gw) return { status: 'skip', summary: 'Could not detect the default gateway automatically. You can enter your router IP (for example 192.168.1.1) and re-run.', data: { gateway: null } };
  const p = await icmpPing(gw, 5);
  if (!p.ok) return { status: 'skip', summary: `Gateway ${gw} found, but this system does not allow ICMP ping (${p.reason}), so reachability is unknown.`, data: { gateway: gw, reason: p.reason } };
  const status = p.loss >= 100 ? 'fail' : p.loss > 0 || p.avg > 20 ? 'warn' : 'pass';
  const summary = p.loss >= 100 ? `Router ${gw} did not respond (100% packet loss).`
    : `Router ${gw}: ${p.loss}% loss, average ${p.avg ?? '?'} ms.`;
  return { status, summary, data: { gateway: gw, ...p } };
});

const testInternetIp = (count = 5, id = 'internet', label = 'Internet reachability (by IP address)') =>
  timed(id, label, async () => {
    let p = await reach('1.1.1.1', count);
    let host = '1.1.1.1';
    if (p.loss >= 100) { p = await reach('8.8.8.8', count); host = '8.8.8.8'; }
    const via = p.method === 'icmp' ? 'ping' : 'TCP connection';
    const status = p.loss >= 100 ? 'fail' : p.loss > 0 || p.avg > 100 ? 'warn' : 'pass';
    const summary = p.loss >= 100 ? `No response from public servers (1.1.1.1 and 8.8.8.8) using ${via}.`
      : `${host}: ${p.loss}% loss, average ${p.avg ?? '?'} ms (${via}).`;
    return { status, summary, data: { host, ...p } };
  });

const testLatency = (count = 8) => testInternetIp(count, 'latency', 'Latency and jitter to the internet');
const testLoss = (count = 20) => testInternetIp(count, 'loss', `Packet loss (${count} packets to the internet)`);

const testDnsSystem = () => timed('dns_system', 'DNS lookup using your current DNS settings', async () => {
  const names = ['www.google.com', 'www.cloudflare.com', 'www.wikipedia.org'];
  const results = [];
  for (const n of names) {
    const s = now();
    try {
      const r = await dns.promises.lookup(n, { family: 4 });
      results.push({ name: n, ok: true, ms: now() - s, address: r.address });
    } catch (e) {
      results.push({ name: n, ok: false, ms: now() - s, error: e.code || e.message });
    }
  }
  const okc = results.filter((r) => r.ok);
  const avg = okc.length ? round(okc.reduce((a, r) => a + r.ms, 0) / okc.length, 0) : null;
  const servers = dns.getServers();
  const status = okc.length === 0 ? 'fail' : okc.length < names.length ? 'warn' : avg > 300 ? 'warn' : 'pass';
  const summary = okc.length === 0 ? 'Your DNS settings could not resolve any website names.'
    : `${okc.length} of ${names.length} names resolved, average ${avg} ms.`;
  return { status, summary, data: { results, avg, servers, resolved: okc.length, total: names.length } };
});

const testDnsPublic = () => timed('dns_public', 'DNS lookup using a public DNS server (1.1.1.1)', async () => {
  const r = new dns.promises.Resolver({ timeout: 2500, tries: 1 });
  r.setServers(['1.1.1.1']);
  const s = now();
  try {
    const a = await r.resolve4('www.google.com');
    return { status: 'pass', summary: `Public DNS answered in ${now() - s} ms.`, data: { ok: true, ms: now() - s, address: a[0] } };
  } catch (e) {
    const r2 = new dns.promises.Resolver({ timeout: 2500, tries: 1 });
    r2.setServers(['8.8.8.8']);
    try {
      const a = await r2.resolve4('www.google.com');
      return { status: 'pass', summary: 'Public DNS (8.8.8.8) answered.', data: { ok: true, ms: now() - s, address: a[0], server: '8.8.8.8' } };
    } catch (e2) {
      return { status: 'fail', summary: 'Public DNS servers (1.1.1.1 / 8.8.8.8) did not answer either.', data: { ok: false, error: e2.code || e2.message } };
    }
  }
});

async function fetchTimed(url, timeoutMs, readBytes) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const start = now();
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'manual', headers: { 'user-agent': 'NetAssist/1.0' } });
    let bytes = 0;
    if (readBytes) {
      const reader = res.body.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; }
    } else { await res.arrayBuffer().catch(() => {}); }
    return { ok: true, status: res.status, ms: now() - start, bytes };
  } catch (e) {
    return { ok: false, ms: now() - start, error: e.name === 'AbortError' ? 'timeout' : (e.cause && e.cause.code) || e.message };
  } finally { clearTimeout(timer); }
}

const testHttp = () => timed('http', 'Website (HTTPS) connection', async () => {
  const targets = ['https://www.gstatic.com/generate_204', 'https://www.cloudflare.com/cdn-cgi/trace'];
  const results = [];
  for (const t of targets) results.push({ url: t, ...(await fetchTimed(t, 7000)) });
  const okc = results.filter((r) => r.ok && r.status < 400);
  const redirected = results.some((r) => r.ok && r.status >= 300 && r.status < 400);
  const avg = okc.length ? round(okc.reduce((a, r) => a + r.ms, 0) / okc.length, 0) : null;
  const status = redirected ? 'warn' : okc.length === 0 ? 'fail' : okc.length < targets.length || avg > 2500 ? 'warn' : 'pass';
  const summary = redirected ? 'Websites were redirected, which usually means a login (captive) page such as public Wi-Fi.'
    : okc.length === 0 ? 'Could not load test websites over HTTPS.'
      : `${okc.length} of ${targets.length} test websites loaded, average ${avg} ms.`;
  return { status, summary, data: { results, avg, redirected } };
});

const testSpeed = () => timed('speed', 'Download speed', async () => {
  const r = await fetchTimed('https://speed.cloudflare.com/__down?bytes=6000000', 20000, true);
  if (!r.ok || !r.bytes) return { status: 'fail', summary: 'Download speed test could not complete (' + (r.error || 'no data') + ').', data: { error: r.error } };
  const mbps = round((r.bytes * 8) / (r.ms / 1000) / 1e6, 1);
  const status = mbps < 3 ? 'fail' : mbps < 10 ? 'warn' : 'pass';
  return { status, summary: `Downloaded ${(r.bytes / 1e6).toFixed(1)} MB in ${(r.ms / 1000).toFixed(1)} s, about ${mbps} Mbps.`, data: { mbps, bytes: r.bytes, ms: r.ms } };
});

module.exports = {
  testAdapter, testGateway, testInternetIp, testLatency, testLoss,
  testDnsSystem, testDnsPublic, testHttp, testSpeed, parsePing, HOST_RE, findGateway, fetchTimed,
};
