(() => {
  const { DateTime } = luxon;

  // --- State ---
  let referenceTimeUTC = DateTime.utc(); // stored in UTC
  let destinationTZ = null;              // IANA timezone string
  let destinationLabel = null;           // display label like "MST"

  // --- DOM ---
  const datetimeInput = document.getElementById('datetime-input');
  const localTzSpan = document.getElementById('local-tz');
  const locationInput = document.getElementById('location-input');
  const searchBtn = document.getElementById('search-btn');
  const statusMsg = document.getElementById('status-msg');
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmText = document.getElementById('confirm-text');
  const confirmYes = document.getElementById('confirm-yes');
  const confirmNo = document.getElementById('confirm-no');
  const selectedTzBadge = document.getElementById('selected-tz-badge');
  const selectedTzText = document.getElementById('selected-tz-text');
  const clearTzBtn = document.getElementById('clear-tz');
  const output = document.getElementById('output');
  const copyBtn = document.getElementById('copy-btn');

  // --- Timezone abbreviation map ---
  const TZ_ABBREVIATIONS = {
    'gmt': 'Etc/GMT',
    'utc': 'Etc/UTC',
    'est': 'America/New_York',
    'edt': 'America/New_York',
    'cst': 'America/Chicago',
    'cdt': 'America/Chicago',
    'mst': 'America/Denver',
    'mdt': 'America/Denver',
    'pst': 'America/Los_Angeles',
    'pdt': 'America/Los_Angeles',
    'akst': 'America/Anchorage',
    'akdt': 'America/Anchorage',
    'hst': 'Pacific/Honolulu',
    'ast': 'America/Puerto_Rico',
    'nst': 'America/St_Johns',
    'ndt': 'America/St_Johns',
    'gmt+0': 'Etc/GMT',
    'gmt-0': 'Etc/GMT',
    'bst': 'Europe/London',
    'cet': 'Europe/Paris',
    'cest': 'Europe/Paris',
    'eet': 'Europe/Helsinki',
    'eest': 'Europe/Helsinki',
    'wet': 'Europe/Lisbon',
    'west': 'Europe/Lisbon',
    'ist': 'Asia/Kolkata',
    'jst': 'Asia/Tokyo',
    'kst': 'Asia/Seoul',
    'cst_china': 'Asia/Shanghai',
    'hkt': 'Asia/Hong_Kong',
    'sgt': 'Asia/Singapore',
    'aest': 'Australia/Sydney',
    'aedt': 'Australia/Sydney',
    'acst': 'Australia/Adelaide',
    'acdt': 'Australia/Adelaide',
    'awst': 'Australia/Perth',
    'nzst': 'Pacific/Auckland',
    'nzdt': 'Pacific/Auckland',
    'ict': 'Asia/Bangkok',
    'wib': 'Asia/Jakarta',
    'wit': 'Asia/Jayapura',
    'wita': 'Asia/Makassar',
    'pht': 'Asia/Manila',
    'msk': 'Europe/Moscow',
    'cat': 'Africa/Harare',
    'eat': 'Africa/Nairobi',
    'wat': 'Africa/Lagos',
    'sast': 'Africa/Johannesburg',
    'art': 'America/Argentina/Buenos_Aires',
    'brt': 'America/Sao_Paulo',
    'clt': 'America/Santiago',
    'pet': 'America/Lima',
    'vet': 'America/Caracas',
    'cot': 'America/Bogota',
    'ect': 'America/Guayaquil',
    'gulf': 'Asia/Dubai',
    'gst': 'Asia/Dubai',
    'pkt': 'Asia/Karachi',
    'aft': 'Asia/Kabul',
    'irt': 'Asia/Tehran',
    'trt': 'Europe/Istanbul',
  };

  // --- Init ---
  function init() {
    const localTz = DateTime.local().zoneName;
    localTzSpan.textContent = localTz;

    // Set datetime input to current local time
    const now = DateTime.local();
    datetimeInput.value = now.toFormat("yyyy-MM-dd'T'HH:mm");
    referenceTimeUTC = now.toUTC();

    datetimeInput.addEventListener('change', onDatetimeChange);
    searchBtn.addEventListener('click', onSearch);
    locationInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onSearch();
    });
    confirmYes.addEventListener('click', onConfirm);
    confirmNo.addEventListener('click', onCancel);
    clearTzBtn.addEventListener('click', onClearTz);
    copyBtn.addEventListener('click', onCopy);
  }

  // --- Subsection 1: Handle datetime change ---
  function onDatetimeChange() {
    const localTz = DateTime.local().zoneName;
    const dt = DateTime.fromISO(datetimeInput.value, { zone: localTz });
    if (dt.isValid) {
      referenceTimeUTC = dt.toUTC();
      updateOutput();
    }
  }

  // --- Subsection 2: Search logic ---
  async function onSearch() {
    const query = locationInput.value.trim();
    if (!query) return;

    hideConfirm();
    showStatus('Searching...');
    setSearchLoading(true);

    // 1. Check for direct timezone abbreviation
    const lowerQuery = query.toLowerCase();
    if (TZ_ABBREVIATIONS[lowerQuery]) {
      const iana = TZ_ABBREVIATIONS[lowerQuery];
      const abbr = getTimezoneAbbrev(iana);
      showConfirm(`Timezone: ${query.toUpperCase()} (${iana})`, iana, abbr);
      setSearchLoading(false);
      hideStatus();
      return;
    }

    // 2. Check if it's a valid IANA timezone directly
    if (isValidIANA(query)) {
      const abbr = getTimezoneAbbrev(query);
      showConfirm(`Timezone: ${abbr} (${query})`, query, abbr);
      setSearchLoading(false);
      hideStatus();
      return;
    }

    // 3. Geocode via Nominatim
    try {
      const results = await geocode(query);
      if (!results || results.length === 0) {
        showStatus('No results found. Try a different search term.');
        setSearchLoading(false);
        return;
      }

      const place = results[0];
      const lat = parseFloat(place.lat);
      const lng = parseFloat(place.lon);
      const displayName = place.display_name;

      // Get timezone from coordinates
      const tzInfo = await getTimezoneFromCoords(lat, lng);
      if (!tzInfo) {
        showStatus('Could not determine timezone for this location.');
        setSearchLoading(false);
        return;
      }

      const shortName = shortenDisplayName(displayName);
      const abbr = getTimezoneAbbrev(tzInfo);
      showConfirm(
        `${shortName} — Timezone: ${abbr} (${tzInfo})`,
        tzInfo,
        abbr
      );
      hideStatus();
    } catch (err) {
      showStatus('Search failed. Please try again.');
      console.error(err);
    }
    setSearchLoading(false);
  }

  // Geocode via Nominatim
  async function geocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' }
    });
    if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
    return res.json();
  }

  // Get timezone from lat/lng via timeapi.io
  async function getTimezoneFromCoords(lat, lng) {
    const url = `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lng}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TimeAPI error: ${res.status}`);
    const data = await res.json();
    return data.timeZone || null;
  }

  // Check if string is a valid IANA timezone
  function isValidIANA(tz) {
    try {
      const dt = DateTime.now().setZone(tz);
      return dt.isValid && dt.zone.name !== 'UTC'; // avoid false positives
    } catch {
      return false;
    }
  }

  // Get abbreviation for a timezone at the reference time
  function getTimezoneAbbrev(ianaTz) {
    const dt = referenceTimeUTC.setZone(ianaTz);
    return dt.toFormat('ZZZZ');
  }

  // Shorten Nominatim display name to first 2-3 components
  function shortenDisplayName(name) {
    const parts = name.split(', ');
    if (parts.length <= 3) return name;
    return parts.slice(0, 3).join(', ');
  }

  // --- Confirm dialog ---
  let pendingTZ = null;
  let pendingAbbr = null;

  function showConfirm(text, iana, abbr) {
    pendingTZ = iana;
    pendingAbbr = abbr;
    confirmText.textContent = text;
    confirmDialog.classList.remove('hidden');
  }

  function hideConfirm() {
    confirmDialog.classList.add('hidden');
    pendingTZ = null;
    pendingAbbr = null;
  }

  function onConfirm() {
    if (pendingTZ) {
      destinationTZ = pendingTZ;
      destinationLabel = pendingAbbr;
      selectedTzText.textContent = `${destinationLabel} (${destinationTZ})`;
      selectedTzBadge.classList.remove('hidden');
      hideConfirm();
      updateOutput();
    }
  }

  function onCancel() {
    hideConfirm();
  }

  function onClearTz() {
    destinationTZ = null;
    destinationLabel = null;
    selectedTzBadge.classList.add('hidden');
    updateOutput();
  }

  // --- Status message ---
  function showStatus(msg) {
    statusMsg.textContent = msg;
    statusMsg.classList.remove('hidden');
  }

  function hideStatus() {
    statusMsg.classList.add('hidden');
  }

  function setSearchLoading(loading) {
    searchBtn.disabled = loading;
    if (loading) {
      searchBtn.innerHTML = '<span class="spinner"></span>';
    } else {
      searchBtn.textContent = 'Search';
    }
  }

  // --- Copy to clipboard ---
  function onCopy() {
    const text = output.textContent;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 1500);
    });
  }

  // --- Subsection 3: Output formatting ---
  function updateOutput() {
    if (!destinationTZ) {
      output.innerHTML = '<span class="text-slate-500">Select a destination</span>';
      copyBtn.classList.add('hidden');
      return;
    }

    const converted = referenceTimeUTC.setZone(destinationTZ);
    const time = converted.toFormat('HH:mm');
    const abbr = converted.toFormat('ZZZZ');
    const weekday = converted.toFormat('EEEE');
    const month = converted.toFormat('MMMM');
    const day = converted.day;
    const ordinal = getOrdinalSuffix(day);

    output.textContent = `${time} ${abbr}, ${weekday} ${month} ${day}${ordinal}`;
    copyBtn.classList.remove('hidden');
  }

  function getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  // --- Dynamic Sky Background ---
  const skyPhases = [
    // hour, bg,                  gradient (::before),                                                                      accent (::after)
    { h: 0,   bg: '#05050f', grad: 'radial-gradient(ellipse at 50% 100%, #0a0a2e 0%, #050510 50%, #020208 100%)',           accent: 'radial-gradient(circle at 30% 70%, rgba(40,20,80,0.3) 0%, transparent 60%)' },
    { h: 3,   bg: '#06061a', grad: 'radial-gradient(ellipse at 50% 100%, #0d0d35 0%, #060618 50%, #030310 100%)',           accent: 'radial-gradient(circle at 70% 80%, rgba(30,15,60,0.3) 0%, transparent 60%)' },
    { h: 4.5, bg: '#0f0a1e', grad: 'linear-gradient(to top, #1a0a2e 0%, #150824 30%, #0d0618 60%, #08040f 100%)',          accent: 'radial-gradient(circle at 50% 95%, rgba(80,20,60,0.25) 0%, transparent 50%)' },
    { h: 5.5, bg: '#1a0e28', grad: 'linear-gradient(to top, #4a1942 0%, #2d1040 20%, #1a0830 50%, #0d0520 100%)',          accent: 'radial-gradient(circle at 50% 90%, rgba(180,60,100,0.3) 0%, transparent 45%)' },
    { h: 6,   bg: '#2a1535', grad: 'linear-gradient(to top, #c2485b 0%, #8b2a5e 15%, #4a1848 35%, #1e0d30 65%, #0d0820 100%)', accent: 'radial-gradient(circle at 50% 95%, rgba(255,120,80,0.35) 0%, transparent 40%)' },
    { h: 6.5, bg: '#3a1a3a', grad: 'linear-gradient(to top, #e8825a 0%, #d4587a 12%, #a23a6a 28%, #5a2050 50%, #1e1040 80%, #0f0a28 100%)', accent: 'radial-gradient(circle at 40% 90%, rgba(255,160,80,0.4) 0%, transparent 45%)' },
    { h: 7,   bg: '#4a2040', grad: 'linear-gradient(to top, #f0a848 0%, #e87858 10%, #c85070 22%, #8a3468 40%, #4a2555 60%, #1e1545 85%, #101035 100%)', accent: 'radial-gradient(circle at 55% 85%, rgba(255,200,100,0.35) 0%, transparent 50%)' },
    { h: 7.5, bg: '#3a3050', grad: 'linear-gradient(to top, #fcc870 0%, #f0a050 8%, #d87860 18%, #a05878 32%, #604070 52%, #303868 75%, #182050 100%)', accent: 'radial-gradient(circle at 50% 80%, rgba(255,220,140,0.3) 0%, transparent 50%)' },
    { h: 8.5, bg: '#2a4070', grad: 'linear-gradient(to top, #f8e8a0 0%, #88c8e8 20%, #5090c0 40%, #3868a0 60%, #284880 80%, #1e3060 100%)',   accent: 'radial-gradient(circle at 50% 70%, rgba(255,240,200,0.2) 0%, transparent 50%)' },
    { h: 10,  bg: '#1a5a90', grad: 'linear-gradient(to top, #a8ddf0 0%, #60b8e0 25%, #3898d0 50%, #2070b0 75%, #185090 100%)',               accent: 'radial-gradient(circle at 60% 30%, rgba(255,255,255,0.1) 0%, transparent 50%)' },
    { h: 12,  bg: '#1868a8', grad: 'linear-gradient(to top, #b8e8f8 0%, #68c8e8 20%, #38a8d8 45%, #2080c0 70%, #1868a8 100%)',               accent: 'radial-gradient(circle at 50% 20%, rgba(255,255,240,0.15) 0%, transparent 45%)' },
    { h: 14,  bg: '#1860a0', grad: 'linear-gradient(to top, #b0e0f0 0%, #60b8e0 25%, #3898c8 50%, #2078b0 75%, #185898 100%)',               accent: 'radial-gradient(circle at 40% 25%, rgba(255,255,230,0.12) 0%, transparent 50%)' },
    { h: 16,  bg: '#2a5088', grad: 'linear-gradient(to top, #e8d8a0 0%, #90b8d0 20%, #5898c0 40%, #3878a8 60%, #285888 80%, #1e4068 100%)',   accent: 'radial-gradient(circle at 60% 70%, rgba(255,200,120,0.2) 0%, transparent 50%)' },
    { h: 17,  bg: '#3a4878', grad: 'linear-gradient(to top, #f0b868 0%, #d89060 12%, #b07068 25%, #785878 42%, #4a4878 62%, #2a3868 82%, #1a2858 100%)', accent: 'radial-gradient(circle at 45% 85%, rgba(255,180,80,0.35) 0%, transparent 45%)' },
    { h: 17.75, bg: '#3a3058', grad: 'linear-gradient(to top, #e89048 0%, #d06858 10%, #a84870 24%, #7a3878 40%, #4a2868 58%, #2a2058 78%, #151840 100%)', accent: 'radial-gradient(circle at 50% 90%, rgba(255,140,60,0.4) 0%, transparent 42%)' },
    { h: 18.5, bg: '#2a1e48', grad: 'linear-gradient(to top, #c05060 0%, #903868 15%, #5a2868 35%, #2e1850 58%, #181238 80%, #0d0a25 100%)',   accent: 'radial-gradient(circle at 55% 92%, rgba(220,80,80,0.3) 0%, transparent 40%)' },
    { h: 19.25, bg: '#18122e', grad: 'linear-gradient(to top, #6a2858 0%, #3a1848 20%, #201038 45%, #120a28 70%, #08061a 100%)',               accent: 'radial-gradient(circle at 50% 95%, rgba(120,40,80,0.25) 0%, transparent 45%)' },
    { h: 20,  bg: '#0d0a1e', grad: 'radial-gradient(ellipse at 50% 100%, #1a1035 0%, #0d0820 40%, #080515 70%, #04030a 100%)',                accent: 'radial-gradient(circle at 40% 80%, rgba(60,20,80,0.2) 0%, transparent 55%)' },
    { h: 21.5, bg: '#080814', grad: 'radial-gradient(ellipse at 50% 100%, #0f0a28 0%, #080618 50%, #040310 100%)',                            accent: 'radial-gradient(circle at 60% 70%, rgba(40,15,60,0.2) 0%, transparent 60%)' },
    { h: 24,  bg: '#05050f', grad: 'radial-gradient(ellipse at 50% 100%, #0a0a2e 0%, #050510 50%, #020208 100%)',                             accent: 'radial-gradient(circle at 30% 70%, rgba(40,20,80,0.3) 0%, transparent 60%)' },
  ];

  function lerpColor(a, b, t) {
    const parse = (hex) => {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
    };
    const ca = parse(a), cb = parse(b);
    const r = Math.round(ca[0] + (cb[0]-ca[0]) * t);
    const g = Math.round(ca[1] + (cb[1]-ca[1]) * t);
    const bl = Math.round(ca[2] + (cb[2]-ca[2]) * t);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`;
  }

  function getPhaseIndex(hour) {
    for (let i = skyPhases.length - 1; i >= 0; i--) {
      if (hour >= skyPhases[i].h) return i;
    }
    return 0;
  }

  function updateSky() {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const idx = getPhaseIndex(hour);
    const next = Math.min(idx + 1, skyPhases.length - 1);
    const phase = skyPhases[idx];
    const nextPhase = skyPhases[next];

    const range = nextPhase.h - phase.h;
    const t = range > 0 ? Math.min((hour - phase.h) / range, 1) : 0;

    const body = document.body;
    body.style.background = lerpColor(phase.bg, nextPhase.bg, t);

    const beforeGrad = t < 0.5 ? phase.grad : nextPhase.grad;
    const afterGrad = t < 0.5 ? phase.accent : nextPhase.accent;
    body.style.setProperty('--sky-gradient', beforeGrad);
    body.style.setProperty('--sky-accent', afterGrad);

    // Stars visibility: fade in at dusk, full at night, fade out at dawn
    const starsCanvas = document.getElementById('stars-canvas');
    let starOpacity = 0;
    if (hour < 5) starOpacity = 1;
    else if (hour < 7) starOpacity = 1 - (hour - 5) / 2;
    else if (hour < 18.5) starOpacity = 0;
    else if (hour < 20.5) starOpacity = (hour - 18.5) / 2;
    else starOpacity = 1;
    starsCanvas.style.opacity = starOpacity;
  }

  // Apply CSS custom properties for pseudo-elements
  function injectSkyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .animated-bg::before { background: var(--sky-gradient) !important; background-size: 200% 200% !important; }
      .animated-bg::after { background: var(--sky-accent) !important; background-size: 200% 200% !important; }
    `;
    document.head.appendChild(style);
  }

  // Stars
  function initStars() {
    const canvas = document.getElementById('stars-canvas');
    const ctx = canvas.getContext('2d');
    let stars = [];
    const STAR_COUNT = 120;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      generateStars();
    }

    function generateStars() {
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.5 + 0.3,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinkleOffset: Math.random() * Math.PI * 2,
          brightness: Math.random() * 0.5 + 0.5,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() / 1000;
      for (const s of stars) {
        const flicker = Math.sin(time * s.twinkleSpeed * 10 + s.twinkleOffset) * 0.3 + 0.7;
        const alpha = s.brightness * flicker;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 240, ${alpha})`;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
  }

  // Start sky system
  injectSkyStyles();
  initStars();
  updateSky();
  setInterval(updateSky, 30000); // update every 30s

  // --- Start ---
  init();
})();
