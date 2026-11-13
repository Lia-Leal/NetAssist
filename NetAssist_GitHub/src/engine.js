// Runs the planned tests for a problem step by step, exposing live progress.
const T = require('./tests');
const { PLANS, analyze } = require('./rules');

const STEP_DEFS = {
  adapter: { label: 'Network adapter and IP address', run: () => T.testAdapter() },
  gateway: { label: 'Router / default gateway', run: (o) => T.testGateway(o.gateway) },
  internet: { label: 'Internet reachability (by IP address)', run: () => T.testInternetIp(5) },
  latency: { label: 'Latency and jitter to the internet', run: () => T.testLatency(8) },
  loss: { label: 'Packet loss (20 packets to the internet)', run: () => T.testLoss(20) },
  dns_system: { label: 'DNS lookup using your current DNS settings', run: () => T.testDnsSystem() },
  dns_public: { label: 'DNS lookup using a public DNS server (1.1.1.1)', run: () => T.testDnsPublic() },
  http: { label: 'Website (HTTPS) connection', run: () => T.testHttp() },
  speed: { label: 'Download speed', run: () => T.testSpeed() },
};

const runs = new Map(); // runId -> live state
let nextId = 1;

function startRun({ userId, problem, gateway, retestOf, onDone }) {
  const id = String(nextId++) + '-' + Math.random().toString(36).slice(2, 8);
  const ids = PLANS[problem];
  const state = {
    id, userId, problem, retestOf: retestOf || null, state: 'running', startedAt: Date.now(),
    steps: ids.map((k) => ({ id: k, label: STEP_DEFS[k].label, status: 'pending' })),
    report: null,
  };
  runs.set(id, state);
  setTimeout(() => runs.delete(id), 30 * 60 * 1000).unref();

  (async () => {
    const results = {};
    for (let i = 0; i < ids.length; i++) {
      const step = state.steps[i];
      step.status = 'running';
      const r = await STEP_DEFS[ids[i]].run({ gateway });
      results[ids[i]] = r;
      Object.assign(step, { status: r.status, summary: r.summary, ms: r.ms, data: r.data });
    }
    // A router that ignores ping is common. If the internet clearly works, a failed gateway ping is not a real fault.
    const g = results.gateway;
    const inetUp = ['internet', 'latency', 'loss'].some((k) => results[k] && results[k].data && results[k].data.loss != null && results[k].data.loss < 100)
      || ['speed', 'http', 'dns_system'].some((k) => results[k] && results[k].status === 'pass');
    if (g && g.status === 'fail' && inetUp) {
      const ip = (g.data && g.data.gateway) || 'The router';
      g.status = 'skip';
      g.summary = `${ip} did not answer ping, but the internet works, so your router most likely just ignores ping requests (this is common).`;
      g.data = { ...g.data, pingBlocked: true };
      const step = state.steps.find((x) => x.id === 'gateway');
      if (step) { step.status = 'skip'; step.summary = g.summary; step.data = g.data; }
    }
    const analysis = analyze(problem, results);
    state.report = { problem, finishedAt: new Date().toISOString(), steps: state.steps, ...analysis };
    state.state = 'done';
    if (onDone) onDone(state);
  })().catch((e) => { state.state = 'error'; state.error = e.message; });

  return state;
}

const getRun = (id) => runs.get(id);
const planFor = (problem) => PLANS[problem].map((k) => STEP_DEFS[k].label);
module.exports = { startRun, getRun, planFor };
