// Rule-based interpretation of test results ("predefined troubleshooting rules").
// analyze() returns { verdict, headline, summary, findings[] }
// verdict: 'ok' | 'issue' | 'inconclusive'

const PROBLEMS = {
  no_connection: { title: 'No Internet / Network Connection', icon: 'wifi-off', blurb: 'Devices say "connected" but nothing loads, or there is no connection at all.' },
  dns: { title: 'DNS Problems', icon: 'globe', blurb: 'Websites will not open by name, but some apps or IP addresses still work.' },
  gateway: { title: 'Unreachable Gateway', icon: 'router', blurb: 'Your device cannot reach your router or modem.' },
  latency: { title: 'High Latency', icon: 'timer', blurb: 'Pages and games feel laggy, with long delays before things respond.' },
  packet_loss: { title: 'Packet Loss', icon: 'drops', blurb: 'Video calls break up, games rubber-band, or connections drop randomly.' },
  slow: { title: 'Slow Internet Connection', icon: 'gauge', blurb: 'Downloads, streaming, or page loads are slower than they should be.' },
};

// Which tests run for each problem (see tests.js for the implementations).
const PLANS = {
  no_connection: ['adapter', 'gateway', 'internet', 'dns_system', 'http'],
  dns: ['internet', 'dns_system', 'dns_public', 'http'],
  gateway: ['adapter', 'gateway', 'internet'],
  latency: ['gateway', 'latency', 'http'],
  packet_loss: ['gateway', 'loss'],
  slow: ['gateway', 'latency', 'dns_system', 'speed'],
};

const f = (severity, title, explanation, causes, steps, limitation) =>
  ({ severity, title, explanation, causes, steps, limitation: limitation || null });

const LIM_ISP = 'NetAssist runs from your device, so it cannot see problems inside your Internet Service Provider (ISP) network. If every step fails, contact your ISP.';

function analyze(problem, R) {
  const findings = [];
  const g = R.gateway, net = R.internet, ad = R.adapter;
  const st = (t) => (t ? t.status : null);
  const gwUnknown = !g || g.status === 'skip';
  const gwDown = g && g.status === 'fail';
  const inet = net || R.loss || R.latency;
  const netDown = inet && inet.status === 'fail';
  const dnsDown = R.dns_system && R.dns_system.status === 'fail';
  const pubDnsUp = R.dns_public && R.dns_public.status === 'pass';
  const httpDown = R.http && R.http.status === 'fail';

  // ---- shared building blocks ----
  const adapterRule = () => {
    if (ad && ad.status === 'fail') {
      findings.push(f('critical', 'This device is not properly connected to a network',
        ad.data && ad.data.selfAssigned
          ? 'Your device has a self-assigned address (169.254.x.x). That means it connected to the network but never received an IP address from the router (DHCP).'
          : 'No active network adapter with an IP address was found, so your device is not on any network.',
        ['Wi-Fi is turned off or Airplane mode is on', 'Ethernet cable is unplugged or damaged', 'Router DHCP is not handing out addresses', 'Network adapter is disabled or its driver has a problem'],
        ['Turn Wi-Fi on and make sure Airplane mode is off, or re-plug the Ethernet cable.', 'Forget the Wi-Fi network and reconnect with the password.', 'Restart your computer or toggle the adapter off and on (Network settings).', 'Restart the router to restore DHCP, then run this test again.'],
        'NetAssist can only detect that an address is missing; it cannot repair adapter drivers for you.'));
      return true;
    }
    return false;
  };

  const gatewayRule = () => {
    if (gwDown) {
      findings.push(f('critical', 'Your router (gateway) is not responding',
        'Your device has an address but cannot reach the router at ' + (g.data.gateway || 'the gateway') + '. Nothing can go further than your own network until this is fixed.',
        ['Router or modem is off, frozen, or still starting up', 'Weak Wi-Fi signal or you are too far from the router', 'Loose or faulty Ethernet cable / port', 'Wrong gateway entered, or the router blocks ping requests'],
        ['Check that the router is powered on and its lights look normal.', 'Move closer to the router, or connect with an Ethernet cable to test.', 'Unplug the router for 30 seconds, plug it back in, and wait 2 minutes.', 'Try another device on the same network. If it also fails, the router needs attention.'],
        'Some routers do not answer ping on purpose. If your internet works, ignore a failed gateway ping.'));
      return true;
    }
    if (g && g.status === 'warn') {
      const lossy = g.data.loss > 0;
      findings.push(f('warning', lossy ? 'Unstable link to your router' : 'Slow response from your router',
        lossy ? `${g.data.loss}% of packets to your router were lost. Problems are inside your local network (Wi-Fi or cable), not the internet.`
          : `Your router answered in ${g.data.avg} ms. Anything above about 20 ms to a router on the same network is unusually slow, which is common with weak Wi-Fi.`,
        ['Weak Wi-Fi signal, walls, or distance', 'Wi-Fi interference from neighbors or appliances', 'Too many devices on the network', 'Damaged Ethernet cable'],
        ['Move closer to the router or switch to the 5 GHz band.', 'Try an Ethernet cable to compare results.', 'Change the Wi-Fi channel in your router settings.', 'Disconnect devices you are not using.']));
      return false;
    }
    return false;
  };

  const internetRule = () => {
    if (netDown && !gwDown) {
      findings.push(f('critical', 'Router is reachable, but the internet is not',
        gwUnknown ? 'Public internet servers did not respond. NetAssist could not check the router directly, so the problem is either your router/modem or your ISP.'
          : 'Your router responds, but traffic is not getting past it to the internet. The problem is between your router/modem and your ISP.',
        ['Internet service outage from the ISP', 'Modem has lost its connection (WAN/Internet light off or red)', 'Unpaid or suspended subscription', 'Router needs a restart'],
        ['Look at the modem lights, especially the Internet/WAN/PON light. Red or off means the line is down.', 'Restart the modem and router: unplug both for 30 seconds, plug in the modem first, then the router.', 'Check your ISP status page or social media for outages in your area.', 'If it is still down after a restart, call your ISP and tell them your router works but there is no internet.'],
        LIM_ISP));
      return true;
    }
    return false;
  };

  const dnsRule = () => {
    if (dnsDown && !netDown) {
      const proven = pubDnsUp;
      findings.push(f('critical', 'DNS is not working',
        (proven ? 'Public DNS (1.1.1.1) works but your current DNS settings do not' : 'Internet is reachable by IP address, but website names cannot be translated into addresses') +
        '. DNS is the "phone book" of the internet: without it, websites will not open by name even though the connection itself is fine.',
        ['The DNS server from your ISP or router is down or slow', 'Wrong or outdated DNS settings on your device', 'Router DNS cache is stuck', 'Security software or VPN is interfering'],
        ['Change your DNS to a public one: set DNS to 1.1.1.1 and 8.8.8.8 in your network adapter or router settings.', 'Flush the DNS cache. Windows: run "ipconfig /flushdns" in Command Prompt. macOS: "sudo dscacheutil -flushcache". Linux: "resolvectl flush-caches".', 'Restart the router.', 'Turn off any VPN temporarily and test again.'],
        'This test checks a few popular websites. A single blocked site can still have its own DNS problem.'));
      return true;
    }
    if (R.dns_system && R.dns_system.status === 'warn' && !dnsDown) {
      const d = R.dns_system.data;
      const slow = d.avg > 300;
      findings.push(f('warning', slow ? 'DNS lookups are slow' : 'Some DNS lookups failed',
        slow ? `Name lookups took ${d.avg} ms on average. Slow DNS makes every first page load feel sluggish.` : `Only ${d.resolved} of ${d.total} names resolved. DNS is unreliable.`,
        ['Overloaded DNS server from your ISP', 'Poor connection to the DNS server'],
        ['Switch DNS to 1.1.1.1 / 8.8.8.8 and repeat the test.', 'Restart your router.']));
    }
    return false;
  };

  const lossRule = (test) => {
    const data = test && test.data;
    if (!data || data.loss == null) return;
    if (data.loss >= 100) return;
    if (data.loss > 0) {
      const sev = data.loss > 5 ? 'critical' : 'warning';
      const nearby = g && g.data && g.data.loss > 0;
      findings.push(f(sev, `Packet loss detected (${data.loss}%)`,
        `${data.loss}% of packets sent to the internet never came back. Even 1-2% disrupts calls and games; above 5% it is serious. ` +
        (nearby ? 'Loss also appears on the link to your router, so the cause is most likely your Wi-Fi or cable, not the internet.'
          : gwUnknown ? 'NetAssist could not test your router separately, so the loss could be local or from the ISP.'
            : 'Your link to the router is clean, so the loss is happening beyond your router (modem, ISP line, or the wider internet).'),
        nearby ? ['Weak Wi-Fi signal or interference', 'Faulty Ethernet cable or port', 'Router overheating or overloaded']
          : ['Damaged or noisy phone/fiber line', 'Congestion on the ISP network', 'Modem or router fault', 'A busy download or upload saturating the connection'],
        nearby ? ['Use an Ethernet cable and repeat the test. If loss disappears, it is the Wi-Fi.', 'Move closer to the router or change the Wi-Fi channel.', 'Replace the cable if loss continues over Ethernet.']
          : ['Pause large downloads, streams, and cloud backups, then retest.', 'Restart your modem and router.', 'Check cables and splitters on the modem line.', 'If loss continues, ask your ISP to check line quality and give them these results.'],
        LIM_ISP));
    }
  };

  const latencyRule = (test) => {
    const data = test && test.data;
    if (!data || data.avg == null) return;
    const a = data.avg;
    if (a > 100) {
      findings.push(f(a > 250 ? 'critical' : 'warning', `High latency (${a} ms average)`,
        `Round-trip time to the internet averaged ${a} ms (below 50 ms is great, 50-100 ms is fine for most uses). ` +
        ((g && g.data && g.data.avg > 20) ? 'Your router itself is slow to answer, so the delay starts in your local network.' : 'The delay is not in your local network, so it comes from further along the path.'),
        ['Wi-Fi congestion or weak signal', 'Someone is using lots of bandwidth (streaming, downloads)', 'Long distance or congested ISP route', 'Old or overloaded router'],
        ['Close bandwidth-heavy apps and pause downloads.', 'Use Ethernet or move closer to the router.', 'Restart the router.', 'Try again at another time of day; if it is always slow at the same hours it is likely ISP congestion.'],
        LIM_ISP));
    } else if (data.jitter != null && data.jitter > 60 && a > 30) {
      findings.push(f('warning', `Unstable latency (jitter ${data.jitter} ms)`,
        'Response times jump around a lot. That is noticeable in video calls and online games even when the average looks fine.',
        ['Wi-Fi interference', 'Bandwidth competition from other devices'],
        ['Use Ethernet if possible.', 'Reduce other traffic on the network.']));
    }
  };

  const speedRule = () => {
    const s = R.speed;
    if (!s) return;
    if (s.status === 'fail' && s.data && s.data.mbps == null) {
      findings.push(f('warning', 'Speed test could not finish',
        'The download test failed, so speed could not be measured. This can happen when the connection is almost down or the test server is blocked.',
        ['Very poor connection', 'Firewall, school, or office network blocking the test server'],
        ['Check the other results in this report.', 'Try again, or use a different network if this one blocks speed tests.']));
    } else if (s.data && s.data.mbps != null && s.data.mbps < 10) {
      findings.push(f(s.data.mbps < 3 ? 'critical' : 'warning', `Low download speed (${s.data.mbps} Mbps)`,
        `Your measured download speed is ${s.data.mbps} Mbps. About 5 Mbps is needed for HD video, 25 Mbps for 4K or several people at once. Compare this number with the plan you pay for.`,
        ['Other devices using bandwidth', 'Weak Wi-Fi limiting speed below your plan', 'Plan speed is lower than what you need', 'ISP congestion or throttling'],
        ['Pause other downloads/streams and test again.', 'Test next to the router or by Ethernet to rule out Wi-Fi.', 'Compare with your plan. If it is much lower on Ethernet, contact your ISP.', 'Check for background updates or cloud syncing.'],
        'The test measures one connection to one server, so results vary between runs. Repeat 2-3 times for a fair picture.'));
    }
  };

  const httpRule = () => {
    if (R.http && R.http.data && R.http.data.redirected) {
      findings.push(f('warning', 'A login page may be blocking internet access',
        'Websites were redirected instead of loading normally. This usually means a captive portal, the "accept terms" or login page of public or school Wi-Fi.',
        ['Public/school/hotel Wi-Fi requiring sign-in'],
        ['Open any plain http:// website (for example http://neverssl.com) to trigger the login page.', 'Sign in or accept the terms, then re-run the test.']));
    } else if (R.http && R.http.status === 'fail' && !netDown && !dnsDown && !gwDown) {
      findings.push(f('warning', 'Websites do not load even though the connection works',
        'Basic connectivity and DNS are fine but HTTPS connections failed. Something is filtering or breaking web traffic.',
        ['Firewall, antivirus, or proxy blocking web traffic', 'Incorrect date/time on this device', 'Network restrictions (school/work)'],
        ['Check that your date and time are correct.', 'Turn off VPN/proxy temporarily.', 'Check firewall or antivirus web-protection settings.']));
    }
  };

  // ---- per-problem logic ----
  switch (problem) {
    case 'no_connection': {
      if (adapterRule()) break;
      if (gatewayRule()) break;
      if (internetRule()) break;
      dnsRule(); httpRule();
      break;
    }
    case 'gateway': {
      if (adapterRule()) break;
      if (!gatewayRule() && gwUnknown && !(g && g.data && g.data.pingBlocked)) {
        findings.push(f('info', 'Router could not be checked directly',
          g ? g.summary : 'The gateway test did not run.',
          ['This system blocks ping, or the gateway was not detected'], ['Enter your router IP (commonly 192.168.1.1 or 192.168.0.1) in the box below and run again.'],
          'Some operating systems and networks block ping, which makes this test inconclusive.'));
      }
      internetRule();
      break;
    }
    case 'dns': {
      if (netDown) { internetRule(); break; }
      dnsRule(); httpRule();
      break;
    }
    case 'latency': {
      if (!gatewayRule() && internetRule()) break;
      latencyRule(R.latency); lossRule(R.latency); httpRule();
      break;
    }
    case 'packet_loss': {
      if (!gatewayRule() && internetRule()) break;
      lossRule(R.loss);
      break;
    }
    case 'slow': {
      if (!gatewayRule() && internetRule()) break;
      latencyRule(R.latency); lossRule(R.latency); dnsRule(); speedRule();
      break;
    }
  }

  const critical = findings.some((x) => x.severity === 'critical');
  const warn = findings.some((x) => x.severity === 'warning');
  const onlyInfo = findings.length > 0 && findings.every((x) => x.severity === 'info');
  const testedAnything = Object.values(R).some((t) => t && t.status !== 'skip');
  const allFailedOrSkipped = Object.values(R).every((t) => !t || t.status === 'skip' || t.status === 'fail');

  let verdict, headline, summary;
  if (critical || warn) {
    verdict = 'issue';
    headline = findings[0].title;
    summary = findings[0].explanation;
  } else if (onlyInfo || !testedAnything) {
    verdict = 'inconclusive';
    headline = 'Results were inconclusive';
    summary = 'NetAssist could not collect enough information to point to a cause. See the notes below.';
  } else if (allFailedOrSkipped) {
    verdict = 'inconclusive';
    headline = 'Tests failed but the cause is unclear';
    summary = 'Several tests failed, but none of the rules matched clearly. Try the "No Internet / Network Connection" check for a broader look.';
    findings.push(f('info', 'Try a broader test', summary, [], ['Run the "No Internet / Network Connection" check.', 'Restart your router and run this test again.']));
  } else {
    verdict = 'ok';
    headline = 'No problem found';
    summary = 'All tests for this problem passed. If the issue happens only sometimes, run the test again when it is happening, or try a different check.';
  }
  const rank = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { verdict, headline, summary, findings };
}

module.exports = { PROBLEMS, PLANS, analyze };
