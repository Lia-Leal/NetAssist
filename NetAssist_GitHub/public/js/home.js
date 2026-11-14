// ==========================================
// NETASSIST - HOMEPAGE
// Intro splash, problem cards, and live search
// ==========================================


// SPLASH INTRO (once per browser session)
(function splash() {
  let seen = false;

  try {
    seen = sessionStorage.getItem('na-splash') === '1';
  } catch (e) {}

  const reduce = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (
    seen ||
    reduce ||
    new URLSearchParams(location.search).has('nosplash')
  ) return;

  const el = document.createElement('div');

  el.className = 'splash';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'NetAssist intro');

  el.innerHTML = `
    <video muted playsinline autoplay preload="auto"
      poster="/media/bg-poster.jpg">
      <source src="/media/bg.webm" type="video/webm">
      <source src="/media/bg.mp4" type="video/mp4">
    </video>

    <button class="btn btn-glass btn-sm" type="button">
      Skip intro
    </button>
  `;

  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';

  let done = false;

  const end = () => {
    if (done) return;

    done = true;

    try {
      sessionStorage.setItem('na-splash', '1');
    } catch (e) {}

    el.classList.add('out');
    document.body.style.overflow = '';

    setTimeout(() => el.remove(), 700);
  };

  const video = el.querySelector('video');

  video.addEventListener('ended', end);
  video.addEventListener('error', end);

  el.querySelector('button').onclick = end;

  // Allow keyboard users to skip the intro.
  const handleEscape = (event) => {
    if (event.key === 'Escape' && !done) {
      end();
    }
  };

  document.addEventListener('keydown', handleEscape);

  setTimeout(end, 7500);

  const play = video.play();

  if (play && play.catch) {
    play.catch(end);
  }
})();


// HOMEPAGE INITIALIZATION
NA.init({
  active: 'home',
  pub: 'hero'
}).then((user) => {

  // SIX NETWORK PROBLEMS
  // keywords = extra words the search should match (synonyms, spelling variants)
  const problems = [
    [
      'wifi-off',
      'No Internet / Network Connection',
      'Devices say "connected" but nothing loads, or there is no connection at all.',
      'wifi wi-fi wireless offline disconnected no internet network'
    ],
    [
      'globe',
      'DNS Problems',
      'Websites will not open by name, but some apps still work.',
      'dns domain name resolve resolution website name'
    ],
    [
      'router',
      'Unreachable Gateway',
      'Your device cannot reach your router or modem.',
      'gateway router modem ping unreachable default gateway'
    ],
    [
      'timer',
      'High Latency',
      'Everything feels laggy, with long delays before things respond.',
      'latency lag lagging ping delay delays response slow'
    ],
    [
      'drops',
      'Packet Loss',
      'Video calls break up and connections drop randomly.',
      'packet loss drop drops video call calls jitter disconnect'
    ],
    [
      'gauge',
      'Slow Internet Connection',
      'Downloads, streaming, or page loads are slower than they should be.',
      'slow speed download upload streaming bandwidth page load'
    ]
  ];

  const problemGrid = NA.$('#problem-grid');

  // DISPLAY PROBLEM CARDS
  problemGrid.innerHTML = problems.map(
    ([icon, title, description, keywords]) => `
      <div class="card problem" data-keywords="${keywords}">
        <span class="pico">${NA.icon(icon)}</span>
        <h3>${title}</h3>
        <p class="muted" style="margin:0">
          ${description}
        </p>
      </div>
    `
  ).join('');


  // HOMEPAGE TAG
  NA.$('#tag').innerHTML =
    NA.icon('zap') + ' Guided network diagnostics';

  NA.$('#tag svg').style.cssText =
    'width:15px;height:15px';


  // LOGIN-BASED HERO BUTTONS
  if (user) {
    NA.$('.hero .cta').innerHTML = `
      <a class="btn btn-grad" href="/diagnose">
        Run a test
      </a>

      <a class="btn btn-glass" href="/dashboard">
        Go to dashboard
      </a>
    `;
  }


  // ==========================================
  // SEARCH NETWORK PROBLEMS
  // ==========================================

  const searchContainer = document.createElement('div');

  searchContainer.className = 'field';
  searchContainer.style.cssText =
    'max-width:460px;margin:0 0 20px';

  searchContainer.innerHTML = `
    <label for="problem-search">
      Find a network problem
    </label>

    <div class="row" style="gap:8px">
      <div class="input" style="flex:1;min-width:0">
        <input
          type="search"
          id="problem-search"
          placeholder="Search Wi-Fi, DNS, latency..."
          autocomplete="off"
          aria-controls="problem-grid"
        >
      </div>

      <button
        type="button"
        class="btn btn-ghost"
        id="clear-problem-search"
      >
        Clear
      </button>
    </div>
  `;

  problemGrid.parentNode.insertBefore(
    searchContainer,
    problemGrid
  );


  const searchInput = document.getElementById(
    'problem-search'
  );

  const clearButton = document.getElementById(
    'clear-problem-search'
  );

  // Lowercase, then remove spaces and punctuation,
  // so "Wi-Fi", "wi fi" and "wifi" all match each other.
  const squash = (text) =>
    String(text).toLowerCase().replace(/[^a-z0-9]/g, '');

  // LIVE SEARCH
  // Every word typed must appear in the card (title, text, or keywords).
  function filterProblems() {
    const words = searchInput.value
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(squash)
      .filter(Boolean);

    const cards = problemGrid.querySelectorAll('.problem');

    let visibleCount = 0;

    cards.forEach((card) => {
      const haystack = squash(
        card.textContent + ' ' + (card.dataset.keywords || '')
      );

      const matches = words.every(
        (word) => haystack.includes(word)
      );

      card.hidden = !matches;

      if (matches) {
        visibleCount++;
      }
    });

    let emptyMessage = document.getElementById(
      'no-problem-results'
    );

    if (visibleCount === 0) {
      if (!emptyMessage) {
        emptyMessage = document.createElement('p');

        emptyMessage.id = 'no-problem-results';
        emptyMessage.className = 'muted';

        emptyMessage.style.cssText =
          'grid-column:1/-1;text-align:center;padding:24px';

        emptyMessage.textContent =
          'No matching network problem found. Try another keyword.';

        problemGrid.appendChild(emptyMessage);
      }
    } else if (emptyMessage) {
      emptyMessage.remove();
    }
  }

  searchInput.addEventListener(
    'input',
    filterProblems
  );

  clearButton.addEventListener('click', () => {
    searchInput.value = '';

    filterProblems();

    searchInput.focus();
  });

});
