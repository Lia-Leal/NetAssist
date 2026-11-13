(async () => {
  const user = await NA.init({ active: 'network', require: true }); if (!user) return;
  const root = NA.$('#net'), btn = NA.$('#reload'); btn.innerHTML = NA.icon('refresh') + ' Refresh';
  async function load() {
    root.innerHTML = '<div class="skeleton" style="height:220px"></div>'; btn.disabled = true;
    try {
      const n = await NA.api('GET', '/api/netinfo');
      const pub = n.publicIp;
      root.innerHTML = `<div class="grid g2"><div class="card"><h3>Network status</h3><div class="row" style="margin-bottom:10px"><span class="pico">${NA.icon(n.online ? 'wifi' : 'wifi-off')}</span><div><b style="font-size:1.2rem"><span class="dot ${n.online ? 'on' : 'off'}"></span>${n.online ? 'Online' : 'Offline or restricted'}</b><div class="muted" style="font-size:.82rem">Last checked ${NA.esc(NA.when(n.checkedAt))}</div></div></div>
        <dl class="kv"><div><dt>Computer</dt><dd>${NA.esc(n.hostname)}</dd></div><div><dt>Default gateway</dt><dd class="mono">${NA.esc(n.gateway || 'Not detected')}</dd></div><div><dt>DNS servers</dt><dd class="mono">${n.dnsServers.length ? n.dnsServers.map(NA.esc).join(', ') : 'None found'}</dd></div></dl></div>
        <div class="card"><h3>Public IP address</h3><div class="mono" style="font-size:1.7rem;font-weight:700;margin-bottom:8px">${pub ? NA.esc(pub.ip) : 'Unavailable'}</div>
        <dl class="kv"><div><dt>Internet provider</dt><dd>${NA.esc((pub && pub.isp) || 'Unknown')}</dd></div><div><dt>Location (approx.)</dt><dd>${NA.esc(pub ? [pub.city, pub.country].filter(Boolean).join(', ') || 'Unknown' : 'Unknown')}</dd></div></dl>
        ${pub ? '' : '<p class="muted" style="font-size:.85rem;margin:10px 0 0">The lookup service could not be reached, which can mean there is no internet.</p>'}</div></div>
        <div class="card" style="margin-top:16px"><h3>Network adapters</h3>${n.adapters.length ? `<div class="tablewrap"><table class="list cards"><thead><tr><th>Adapter</th><th>IPv4 address</th><th>Subnet mask</th><th>MAC address</th></tr></thead><tbody>${n.adapters.map((a) => `<tr><td data-l="Adapter"><b>${NA.esc(a.name)}</b></td><td data-l="IPv4" class="mono">${NA.esc(a.address)}</td><td data-l="Mask" class="mono">${NA.esc(a.netmask)}</td><td data-l="MAC" class="mono">${NA.esc(a.mac)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No active adapters with an IPv4 address were found.</div>'}</div>
        <p class="muted" style="font-size:.84rem;margin-top:12px">This page describes the computer that is running the NetAssist server. NetAssist does not scan other devices on your network.</p>`;
      // Use NetAssist from other devices (phones, tablets, other laptops) on the same Wi-Fi
      try {
        const l = await NA.api('GET', '/api/lan');
        root.insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:16px"><h3>Open NetAssist on other devices</h3>
          <p class="muted" style="margin-top:0">Phones, tablets and other laptops connected to the <b>same Wi-Fi or LAN</b> can open one of these addresses in their browser. The layout adapts to the screen size.</p>
          ${l.urls.length ? l.urls.map((u) => `<div class="row" style="gap:10px;margin:8px 0;flex-wrap:wrap"><code class="mono" style="font-size:1.05rem;font-weight:700">${NA.esc(u.url)}</code><span class="muted" style="font-size:.85rem">${NA.esc(u.adapter)}</span><button class="btn btn-ghost btn-sm" data-copyurl="${NA.esc(u.url)}" type="button">Copy</button></div>`).join('') : '<div class="alert bad">No local network address was found. Connect this computer to Wi-Fi or a LAN first.</div>'}
          <p class="muted" style="font-size:.85rem;margin-bottom:0">If another device cannot connect: make sure it is on the same Wi-Fi, and when Windows asks, allow <b>Node.js</b> through the firewall on <b>Private networks</b>. Tests always measure the network of this computer.</p></div>`);
        root.querySelectorAll('[data-copyurl]').forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copyurl); NA.toast('Address copied.'); } catch (e) { NA.toast('Select and copy the address manually.'); } });
      } catch (e) { /* the list is optional */ }
    } catch (e) { root.innerHTML = `<div class="alert bad">${NA.esc(e.message)}</div>`; }
    btn.disabled = false;
  }
  btn.onclick = load; load();
})();
