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

  // =====================================================
  // WEATHER & TIME-OF-DAY VISUAL SYSTEM
  // =====================================================
  //
  // State code format: {hour}{letter}
  //   hour = 0-23 (military time)
  //   letter = weather condition:
  //     a = Clear / Sunny
  //     b = Partly Cloudy
  //     c = Cloudy / Overcast
  //     d = Rain
  //     e = Thunderstorm
  //     f = Snow
  //     g = Fog / Mist
  //
  // Examples: "14a" = 2pm clear, "3f" = 3am snow, "20d" = 8pm rain
  //
  // Console API:
  //   window.setWeatherState("14a")  - set specific state
  //   window.getWeatherState()       - get current state code
  //   window.resetWeather()          - return to auto-detected weather
  //   window.weatherHelp()           - print help text
  //

  const WEATHER_CODES = {
    a: 'clear',
    b: 'partly_cloudy',
    c: 'overcast',
    d: 'rain',
    e: 'thunderstorm',
    f: 'snow',
    g: 'fog',
  };

  const WEATHER_LABELS = {
    a: 'Clear',
    b: 'Partly Cloudy',
    c: 'Overcast',
    d: 'Rain',
    e: 'Thunderstorm',
    f: 'Snow',
    g: 'Fog',
  };

  let weatherState = { hour: 0, weather: 'a' }; // current active state
  let weatherOverride = null; // manual override from console, or null for auto
  let detectedWeather = 'a'; // what the API detected
  let userLat = null;
  let userLon = null;

  // --- Weather detection via free APIs ---
  async function detectLocationAndWeather() {
    try {
      // Step 1: Get user's approximate location via ip-api.com (free, no key)
      const geoRes = await fetch('http://ip-api.com/json/?fields=lat,lon,city,regionName');
      if (!geoRes.ok) throw new Error('Geo lookup failed');
      const geo = await geoRes.json();
      userLat = geo.lat;
      userLon = geo.lon;

      // Step 2: Get current weather via Open-Meteo (free, no key)
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${userLat}&longitude=${userLon}&current=weather_code,temperature_2m&timezone=auto`;
      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) throw new Error('Weather lookup failed');
      const weatherData = await weatherRes.json();

      const wmoCode = weatherData.current.weather_code;
      detectedWeather = wmoToWeatherLetter(wmoCode);

      console.log(`[Weather] Location: ${geo.city}, ${geo.regionName} | WMO code: ${wmoCode} | Mapped to: ${detectedWeather} (${WEATHER_LABELS[detectedWeather]})`);
    } catch (err) {
      console.warn('[Weather] Could not detect weather, defaulting to clear:', err.message);
      detectedWeather = 'a';
    }
    applyWeatherState();
  }

  // Map WMO weather codes to our letter system
  function wmoToWeatherLetter(code) {
    // WMO weather interpretation codes:
    // 0: Clear sky
    // 1-3: Mainly clear, partly cloudy, overcast
    // 45, 48: Fog
    // 51-57: Drizzle
    // 61-67: Rain
    // 71-77: Snow
    // 80-82: Rain showers
    // 85-86: Snow showers
    // 95, 96, 99: Thunderstorm
    if (code === 0) return 'a';
    if (code <= 2) return 'b';
    if (code === 3) return 'c';
    if (code === 45 || code === 48) return 'g';
    if (code >= 51 && code <= 57) return 'd';
    if (code >= 61 && code <= 67) return 'd';
    if (code >= 71 && code <= 77) return 'f';
    if (code >= 80 && code <= 82) return 'd';
    if (code >= 85 && code <= 86) return 'f';
    if (code >= 95) return 'e';
    return 'a';
  }

  // --- Console API ---
  window.setWeatherState = function(code) {
    const parsed = parseStateCode(code);
    if (!parsed) {
      console.error('[Weather] Invalid code. Format: {hour}{letter}, e.g. "14a", "3f", "20d"');
      console.log('[Weather] Letters: a=Clear, b=Partly Cloudy, c=Overcast, d=Rain, e=Thunderstorm, f=Snow, g=Fog');
      return;
    }
    weatherOverride = parsed;
    console.log(`[Weather] Override set: hour=${parsed.hour}, weather=${parsed.weather} (${WEATHER_LABELS[parsed.weather]})`);
    applyWeatherState();
    return `State set to ${code}`;
  };

  window.getWeatherState = function() {
    const s = weatherOverride || weatherState;
    const code = `${s.hour}${s.weather}`;
    console.log(`[Weather] Current state: ${code} (hour=${s.hour}, weather=${WEATHER_LABELS[s.weather]})${weatherOverride ? ' [MANUAL OVERRIDE]' : ' [AUTO]'}`);
    return code;
  };

  window.resetWeather = function() {
    weatherOverride = null;
    console.log('[Weather] Override cleared, returning to auto-detected weather.');
    applyWeatherState();
    return 'Reset to auto';
  };

  window.weatherHelp = function() {
    console.log(`
╔══════════════════════════════════════════════════════╗
║           WEATHER SYSTEM CONSOLE API                 ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  State code format: {hour}{letter}                   ║
║    hour = 0-23 (military time)                       ║
║    letter = weather type (see below)                 ║
║                                                      ║
║  Weather letters:                                    ║
║    a = Clear / Sunny                                 ║
║    b = Partly Cloudy                                 ║
║    c = Cloudy / Overcast                             ║
║    d = Rain                                          ║
║    e = Thunderstorm                                  ║
║    f = Snow                                          ║
║    g = Fog / Mist                                    ║
║                                                      ║
║  Commands:                                           ║
║    setWeatherState("14a")  Set to 2pm clear          ║
║    setWeatherState("3f")   Set to 3am snow           ║
║    setWeatherState("20d")  Set to 8pm rain           ║
║    getWeatherState()       Show current state         ║
║    resetWeather()          Return to auto-detect      ║
║    weatherHelp()           Show this help              ║
║                                                      ║
║  Examples to try:                                    ║
║    setWeatherState("12a")  Noon, sunny               ║
║    setWeatherState("22f")  10pm, snow                ║
║    setWeatherState("6e")   6am, thunderstorm         ║
║    setWeatherState("15g")  3pm, fog                  ║
║    setWeatherState("0a")   Midnight, clear           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
    `);
    return 'See console for help';
  };

  function parseStateCode(code) {
    if (typeof code !== 'string') return null;
    const match = code.match(/^(\d{1,2})([a-g])$/i);
    if (!match) return null;
    const hour = parseInt(match[1], 10);
    const letter = match[2].toLowerCase();
    if (hour < 0 || hour > 23) return null;
    if (!WEATHER_CODES[letter]) return null;
    return { hour, weather: letter };
  }

  // --- Apply the visual state ---
  function applyWeatherState() {
    const now = new Date();
    const autoHour = now.getHours() + now.getMinutes() / 60;

    if (weatherOverride) {
      weatherState = { hour: weatherOverride.hour, weather: weatherOverride.weather };
    } else {
      weatherState = { hour: Math.floor(autoHour), weather: detectedWeather };
    }

    const h = weatherOverride ? weatherOverride.hour + 0.5 : autoHour; // use .5 for override to land mid-hour
    const w = weatherState.weather;

    // Update sky (override hour if manual)
    updateSkyForHour(h, w);

    // Update gloom overlay (grey wash for bad weather)
    updateGloom(h, w);

    // Update celestial bodies
    updateCelestials(h, w);

    // Update clouds
    updateClouds(h, w);

    // Update precipitation
    updatePrecipitation(w);

    // Update fog
    updateFog(w);

    // Update stars visibility
    updateStarsForHour(h, w);

    // Update weather badge
    updateWeatherBadge();

    // Update footer color to match weather/time
    updateFooter(h, w);
  }

  // --- Sky system (refactored to accept hour param) ---
  const skyPhases = [
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

  // Desaturate and darken a hex color toward grey
  function desaturate(hex, amount) {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0,2), 16);
    const g = parseInt(c.slice(2,4), 16);
    const b = parseInt(c.slice(4,6), 16);
    // Luminance-weighted grey
    const grey = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    // Blend toward a dark grey (not pure grey — slightly cool-toned)
    const targetR = Math.round(grey * 0.85);
    const targetG = Math.round(grey * 0.87);
    const targetB = Math.round(grey * 0.92);
    const nr = Math.round(r + (targetR - r) * amount);
    const ng = Math.round(g + (targetG - g) * amount);
    const nb = Math.round(b + (targetB - b) * amount);
    return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
  }

  function updateSkyForHour(hour, w) {
    const idx = getPhaseIndex(hour);
    const next = Math.min(idx + 1, skyPhases.length - 1);
    const phase = skyPhases[idx];
    const nextPhase = skyPhases[next];

    const range = nextPhase.h - phase.h;
    const t = range > 0 ? Math.min((hour - phase.h) / range, 1) : 0;

    let bgColor = lerpColor(phase.bg, nextPhase.bg, t);

    // Desaturate the base background for gloomy weather
    // This makes the sky itself grey rather than letting bright blue show through
    if (w === 'e') bgColor = desaturate(bgColor, 0.85);       // thunderstorm: very grey/dark
    else if (w === 'd') bgColor = desaturate(bgColor, 0.75);   // rain: quite grey
    else if (w === 'c') bgColor = desaturate(bgColor, 0.7);    // overcast: grey
    else if (w === 'g') bgColor = desaturate(bgColor, 0.65);   // fog: muted grey
    else if (w === 'f') bgColor = desaturate(bgColor, 0.2);    // snow: slightly muted, still bright-ish

    const body = document.body;
    body.style.background = bgColor;

    const beforeGrad = t < 0.5 ? phase.grad : nextPhase.grad;
    const afterGrad = t < 0.5 ? phase.accent : nextPhase.accent;
    body.style.setProperty('--sky-gradient', beforeGrad);
    body.style.setProperty('--sky-accent', afterGrad);

    // Dim the gradient overlays during bad weather so grey base shows through
    let gradOpacity = 1;
    let accentOpacity = 0.4;
    if (w === 'e') { gradOpacity = 0.08; accentOpacity = 0.05; }       // thunderstorm: almost no color
    else if (w === 'd') { gradOpacity = 0.12; accentOpacity = 0.06; }   // rain: very dim
    else if (w === 'c') { gradOpacity = 0.15; accentOpacity = 0.08; }   // overcast: dim
    else if (w === 'g') { gradOpacity = 0.1; accentOpacity = 0.05; }    // fog: very dim
    else if (w === 'f') { gradOpacity = 0.5; accentOpacity = 0.2; }     // snow: somewhat present
    else if (w === 'b') { gradOpacity = 0.7; accentOpacity = 0.3; }     // partly cloudy: slight dim
    body.style.setProperty('--sky-grad-opacity', gradOpacity);
    body.style.setProperty('--sky-accent-opacity', accentOpacity);
  }

  // --- Gloom overlay: washes the sky grey for bad weather ---
  function updateGloom(hour, w) {
    const gloom = document.getElementById('weather-gloom');
    const isDaytime = hour >= 6.5 && hour <= 18;

    // Different gloom colors for day vs night
    if (w === 'e') {
      // Thunderstorm: very dark, oppressive
      gloom.style.background = isDaytime
        ? 'linear-gradient(to bottom, rgba(40,42,50,0.85) 0%, rgba(50,52,60,0.75) 40%, rgba(55,55,65,0.7) 100%)'
        : 'linear-gradient(to bottom, rgba(15,15,22,0.8) 0%, rgba(20,20,28,0.7) 100%)';
      gloom.style.opacity = 1;
    } else if (w === 'd') {
      // Rain: dark grey, gloomy
      gloom.style.background = isDaytime
        ? 'linear-gradient(to bottom, rgba(80,82,92,0.75) 0%, rgba(90,92,100,0.65) 40%, rgba(95,98,105,0.55) 100%)'
        : 'linear-gradient(to bottom, rgba(20,22,30,0.7) 0%, rgba(25,27,35,0.6) 100%)';
      gloom.style.opacity = 1;
    } else if (w === 'c') {
      // Overcast: medium grey, flat
      gloom.style.background = isDaytime
        ? 'linear-gradient(to bottom, rgba(110,112,120,0.7) 0%, rgba(120,122,130,0.6) 40%, rgba(130,132,140,0.5) 100%)'
        : 'linear-gradient(to bottom, rgba(30,32,40,0.6) 0%, rgba(35,37,45,0.5) 100%)';
      gloom.style.opacity = 1;
    } else if (w === 'g') {
      // Fog: grey-white wash, soft
      gloom.style.background = isDaytime
        ? 'linear-gradient(to bottom, rgba(150,155,165,0.6) 0%, rgba(140,145,155,0.5) 50%, rgba(130,135,145,0.4) 100%)'
        : 'linear-gradient(to bottom, rgba(40,42,52,0.5) 0%, rgba(35,37,47,0.4) 100%)';
      gloom.style.opacity = 1;
    } else if (w === 'f') {
      // Snow: very light grey wash — snow days are bright but flat
      gloom.style.background = isDaytime
        ? 'linear-gradient(to bottom, rgba(170,175,185,0.3) 0%, rgba(180,185,195,0.2) 100%)'
        : 'linear-gradient(to bottom, rgba(30,32,42,0.25) 0%, rgba(25,27,37,0.2) 100%)';
      gloom.style.opacity = 1;
    } else {
      // Clear / partly cloudy: no gloom
      gloom.style.opacity = 0;
    }
  }

  // Legacy updateSky function - now delegates to applyWeatherState
  function updateSky() {
    if (!weatherOverride) {
      applyWeatherState();
    }
  }

  function updateStarsForHour(hour, w) {
    const starsCanvas = document.getElementById('stars-canvas');
    let starOpacity = 0;
    if (hour < 5) starOpacity = 1;
    else if (hour < 7) starOpacity = 1 - (hour - 5) / 2;
    else if (hour < 18.5) starOpacity = 0;
    else if (hour < 20.5) starOpacity = (hour - 18.5) / 2;
    else starOpacity = 1;

    // Reduce star visibility in cloudy/foggy weather
    if (w === 'c' || w === 'd' || w === 'e' || w === 'g') {
      starOpacity *= 0.15;
    } else if (w === 'b') {
      starOpacity *= 0.6;
    } else if (w === 'f') {
      starOpacity *= 0.3;
    }

    starsCanvas.style.opacity = starOpacity;
  }

  // --- Celestial bodies (sun & moon) ---
  function updateCelestials(hour, w) {
    const sun = document.getElementById('weather-sun');
    const moon = document.getElementById('weather-moon');
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Sun arc: rises ~6, peaks ~12, sets ~18
    const sunRise = 6, sunSet = 18.5;
    const isDaytime = hour >= sunRise && hour <= sunSet;

    if (isDaytime) {
      const progress = (hour - sunRise) / (sunSet - sunRise); // 0 to 1
      const sunX = vw * (0.15 + progress * 0.7);
      // Parabolic arc: highest at progress=0.5
      const arcHeight = -4 * (progress - 0.5) * (progress - 0.5) + 1; // 0 at edges, 1 at peak
      const sunY = vh * (0.85 - arcHeight * 0.7);

      sun.style.left = sunX - 40 + 'px';
      sun.style.top = sunY - 40 + 'px';

      // Opacity: fade in at sunrise, fade out at sunset
      let sunOpacity = 1;
      if (hour < 6.5) sunOpacity = (hour - 6) * 2;
      else if (hour > 17.5) sunOpacity = (18.5 - hour) * 2;
      sunOpacity = Math.max(0, Math.min(1, sunOpacity));

      // Dim or hide sun behind clouds
      if (w === 'e') sunOpacity = 0;              // thunderstorm: sun completely hidden
      else if (w === 'd') sunOpacity *= 0.08;     // rain: barely visible
      else if (w === 'c') sunOpacity *= 0.15;     // overcast: faint glow
      else if (w === 'g') sunOpacity *= 0.1;      // fog: barely there
      else if (w === 'f') sunOpacity *= 0.4;      // snow: dimmed but visible
      else if (w === 'b') sunOpacity *= 0.7;      // partly cloudy: slightly dimmed

      sun.style.opacity = sunOpacity;
      sun.style.transform = `scale(${0.7 + arcHeight * 0.3})`;
    } else {
      sun.style.opacity = 0;
    }

    // Moon arc: rises ~19, peaks ~0, sets ~6
    const isNight = hour >= 19 || hour <= 6;
    if (isNight) {
      let moonProgress;
      if (hour >= 19) moonProgress = (hour - 19) / 11; // 19 to 30(6)
      else moonProgress = (hour + 5) / 11;

      const moonX = vw * (0.1 + moonProgress * 0.8);
      const arcH = -4 * (moonProgress - 0.5) * (moonProgress - 0.5) + 1;
      const moonY = vh * (0.8 - arcH * 0.6);

      moon.style.left = moonX - 30 + 'px';
      moon.style.top = moonY - 30 + 'px';

      let moonOpacity = 0.85;
      if (hour >= 19 && hour < 20) moonOpacity = (hour - 19) * 0.85;
      else if (hour > 5 && hour <= 6) moonOpacity = (6 - hour) * 0.85;
      moonOpacity = Math.max(0, Math.min(0.85, moonOpacity));

      if (w === 'c' || w === 'd' || w === 'e') moonOpacity *= 0.1;
      else if (w === 'b') moonOpacity *= 0.5;
      else if (w === 'g') moonOpacity *= 0.2;
      else if (w === 'f') moonOpacity *= 0.3;

      moon.style.opacity = moonOpacity;
    } else {
      moon.style.opacity = 0;
    }
  }

  // --- Cloud system ---
  let cloudElements = [];
  let currentCloudStyle = null;

  function updateClouds(hour, w) {
    const container = document.getElementById('weather-clouds');
    const isDaytime = hour >= 6.5 && hour <= 18;
    const isNight = !isDaytime;

    // Determine cloud count and style
    let cloudCount = 0;
    let cloudClass = '';

    if (w === 'a') {
      cloudCount = 0;
    } else if (w === 'b') {
      cloudCount = 4;
      cloudClass = isNight ? 'night' : '';
    } else if (w === 'c') {
      cloudCount = 8;
      cloudClass = 'overcast';
    } else if (w === 'd') {
      cloudCount = 7;
      cloudClass = 'storm';
    } else if (w === 'e') {
      cloudCount = 10;
      cloudClass = 'storm';
    } else if (w === 'f') {
      cloudCount = 6;
      cloudClass = isNight ? 'night' : 'overcast';
    } else if (w === 'g') {
      cloudCount = 3;
      cloudClass = isNight ? 'night' : '';
    }

    // Only rebuild if style changed
    const styleKey = `${cloudCount}-${cloudClass}`;
    if (styleKey !== currentCloudStyle) {
      currentCloudStyle = styleKey;
      container.innerHTML = '';
      cloudElements = [];

      for (let i = 0; i < cloudCount; i++) {
        const cloud = document.createElement('div');
        cloud.className = `cloud ${cloudClass}`;

        const size = 80 + Math.random() * 120;
        const topPos = 5 + Math.random() * 35;
        const duration = 40 + Math.random() * 60;
        const delay = -(Math.random() * duration);

        cloud.style.width = size + 'px';
        cloud.style.height = size * 0.45 + 'px';
        cloud.style.top = topPos + '%';
        cloud.style.animationDuration = duration + 's';
        cloud.style.animationDelay = delay + 's';
        cloud.style.opacity = 0.5 + Math.random() * 0.4;

        container.appendChild(cloud);
        cloudElements.push(cloud);
      }
    }

    container.style.opacity = cloudCount > 0 ? 1 : 0;
  }

  // --- Precipitation system (rain + snow via canvas) ---
  let precipAnimFrame = null;
  let currentPrecipType = null;
  let precipParticles = [];

  function updatePrecipitation(w) {
    const canvas = document.getElementById('weather-canvas');
    const ctx = canvas.getContext('2d');

    const needsPrecip = (w === 'd' || w === 'e' || w === 'f');
    const precipType = w === 'f' ? 'snow' : (w === 'd' || w === 'e') ? 'rain' : null;

    if (!needsPrecip) {
      if (precipAnimFrame) {
        cancelAnimationFrame(precipAnimFrame);
        precipAnimFrame = null;
      }
      currentPrecipType = null;
      precipParticles = [];
      canvas.style.opacity = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Stop lightning
      stopLightning();
      return;
    }

    // Rebuild particles if type changed
    if (precipType !== currentPrecipType) {
      currentPrecipType = precipType;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.opacity = 1;
      precipParticles = [];

      const count = precipType === 'snow' ? 150 : 200;

      for (let i = 0; i < count; i++) {
        if (precipType === 'rain') {
          precipParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: 8 + Math.random() * 12,
            length: 15 + Math.random() * 20,
            opacity: 0.2 + Math.random() * 0.4,
            wind: 1.5 + Math.random() * 1,
          });
        } else {
          precipParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: 0.5 + Math.random() * 1.5,
            radius: 1.5 + Math.random() * 3,
            opacity: 0.4 + Math.random() * 0.5,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.02 + Math.random() * 0.03,
            wind: 0.3 + Math.random() * 0.5,
          });
        }
      }

      if (!precipAnimFrame) {
        drawPrecipitation(ctx, canvas);
      }
    }

    // Handle lightning for thunderstorms
    if (w === 'e') {
      startLightning();
    } else {
      stopLightning();
    }
  }

  function drawPrecipitation(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of precipParticles) {
      if (currentPrecipType === 'rain') {
        p.y += p.speed;
        p.x += p.wind;

        if (p.y > canvas.height) {
          p.y = -p.length;
          p.x = Math.random() * canvas.width;
        }
        if (p.x > canvas.width) p.x = 0;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.wind * 0.5, p.y + p.length);
        ctx.strokeStyle = `rgba(180, 200, 230, ${p.opacity})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Snow
        p.y += p.speed;
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble) * 0.8 + p.wind;

        if (p.y > canvas.height) {
          p.y = -p.radius * 2;
          p.x = Math.random() * canvas.width;
        }
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      }
    }

    precipAnimFrame = requestAnimationFrame(() => drawPrecipitation(ctx, canvas));
  }

  // --- Lightning system ---
  let lightningInterval = null;

  function startLightning() {
    if (lightningInterval) return;
    const flash = document.getElementById('weather-lightning');
    lightningInterval = setInterval(() => {
      if (Math.random() < 0.4) {
        flash.style.opacity = 0.15 + Math.random() * 0.3;
        setTimeout(() => {
          flash.style.opacity = 0;
          // Double flash
          if (Math.random() < 0.5) {
            setTimeout(() => {
              flash.style.opacity = 0.1 + Math.random() * 0.2;
              setTimeout(() => { flash.style.opacity = 0; }, 80);
            }, 100);
          }
        }, 80);
      }
    }, 2000 + Math.random() * 3000);
  }

  function stopLightning() {
    if (lightningInterval) {
      clearInterval(lightningInterval);
      lightningInterval = null;
      const flash = document.getElementById('weather-lightning');
      if (flash) flash.style.opacity = 0;
    }
  }

  // --- Fog overlay ---
  function updateFog(w) {
    const fog = document.getElementById('weather-fog');
    if (w === 'g') {
      fog.style.opacity = 1; // full fog
    } else if (w === 'f') {
      fog.style.opacity = 0.25; // light ground haze with snow
    } else {
      fog.style.opacity = 0;
    }
  }

  // --- Weather badge ---
  function updateWeatherBadge() {
    const badge = document.getElementById('weather-badge');
    if (!badge) return;
    if (weatherOverride) {
      const code = `${weatherOverride.hour}${weatherOverride.weather}`;
      badge.textContent = `${code} [override]`;
      badge.style.opacity = '1';
    } else {
      badge.textContent = '';
      badge.style.opacity = '0';
    }
  }

  // --- Footer theming: legible color that matches the weather/time ---
  function updateFooter(hour, w) {
    const link = document.getElementById('footer-link');
    if (!link) return;

    const isDaytime = hour >= 6.5 && hour <= 18;
    const isDawn = hour >= 5.5 && hour < 8;
    const isDusk = hour >= 17 && hour < 20;

    // Pick a color that's legible against the current sky
    let color;
    if (w === 'e') {
      // Thunderstorm: pale yellow stands out against dark grey
      color = 'rgba(220, 210, 170, 0.85)';
    } else if (w === 'd') {
      // Rain: muted blue-white
      color = 'rgba(200, 210, 225, 0.8)';
    } else if (w === 'c') {
      // Overcast: warm off-white
      color = 'rgba(215, 210, 200, 0.8)';
    } else if (w === 'g') {
      // Fog: dark text for the light fog overlay
      color = isDaytime ? 'rgba(70, 75, 85, 0.8)' : 'rgba(200, 205, 215, 0.75)';
    } else if (w === 'f') {
      // Snow: dark text during day (bright snowy sky), light at night
      color = isDaytime ? 'rgba(80, 85, 100, 0.8)' : 'rgba(210, 215, 225, 0.8)';
    } else if (isDaytime && !isDawn && !isDusk) {
      // Clear/partly cloudy daytime: dark text against bright sky
      color = 'rgba(30, 50, 80, 0.7)';
    } else if (isDawn || isDusk) {
      // Warm tones during golden hour
      color = 'rgba(255, 230, 200, 0.8)';
    } else {
      // Night: soft white
      color = 'rgba(200, 200, 220, 0.7)';
    }

    link.style.color = color;
  }

  // --- Apply CSS custom properties for pseudo-elements ---
  function injectSkyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .animated-bg::before {
        background: var(--sky-gradient) !important;
        background-size: 200% 200% !important;
        opacity: var(--sky-grad-opacity, 1) !important;
        transition: opacity 2s ease !important;
      }
      .animated-bg::after {
        background: var(--sky-accent) !important;
        background-size: 200% 200% !important;
        opacity: var(--sky-accent-opacity, 0.4) !important;
        transition: opacity 2s ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  // --- Stars ---
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
          driftX: (Math.random() - 0.5) * 0.15,
          driftY: (Math.random() - 0.5) * 0.08,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() / 1000;
      for (const s of stars) {
        s.x += s.driftX;
        s.y += s.driftY;

        if (s.x < -5) s.x = canvas.width + 5;
        if (s.x > canvas.width + 5) s.x = -5;
        if (s.y < -5) s.y = canvas.height + 5;
        if (s.y > canvas.height + 5) s.y = -5;

        const flicker = Math.sin(time * s.twinkleSpeed * 10 + s.twinkleOffset) * 0.4 + 0.6;
        const pulse = Math.sin(time * s.twinkleSpeed * 3 + s.twinkleOffset * 2) * 0.15 + 0.85;
        const alpha = s.brightness * flicker * pulse;
        const radius = s.r * (0.9 + Math.sin(time * s.twinkleSpeed * 5 + s.twinkleOffset) * 0.1);

        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 240, ${alpha})`;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
  }

  // --- Handle canvas resize for weather too ---
  window.addEventListener('resize', () => {
    const canvas = document.getElementById('weather-canvas');
    if (canvas && currentPrecipType) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });

  // --- Init ---
  function init() {
    const localTz = DateTime.local().zoneName;
    localTzSpan.textContent = localTz;

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

    const lowerQuery = query.toLowerCase();
    if (TZ_ABBREVIATIONS[lowerQuery]) {
      const iana = TZ_ABBREVIATIONS[lowerQuery];
      const abbr = getTimezoneAbbrev(iana);
      showConfirm(`Timezone: ${query.toUpperCase()} (${iana})`, iana, abbr);
      setSearchLoading(false);
      hideStatus();
      return;
    }

    if (isValidIANA(query)) {
      const abbr = getTimezoneAbbrev(query);
      showConfirm(`Timezone: ${abbr} (${query})`, query, abbr);
      setSearchLoading(false);
      hideStatus();
      return;
    }

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

  async function geocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' }
    });
    if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
    return res.json();
  }

  async function getTimezoneFromCoords(lat, lng) {
    const url = `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lng}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TimeAPI error: ${res.status}`);
    const data = await res.json();
    return data.timeZone || null;
  }

  function isValidIANA(tz) {
    try {
      const dt = DateTime.now().setZone(tz);
      return dt.isValid && dt.zone.name !== 'UTC';
    } catch {
      return false;
    }
  }

  function getTimezoneAbbrev(ianaTz) {
    const dt = referenceTimeUTC.setZone(ianaTz);
    return dt.toFormat('ZZZZ');
  }

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

  // --- Start everything ---
  injectSkyStyles();
  initStars();
  applyWeatherState(); // initial render with defaults
  setInterval(updateSky, 30000); // refresh every 30s
  detectLocationAndWeather(); // async — updates when ready

  // --- Footer year ---
  document.getElementById("footer-year").innerText = new Date().getFullYear();

  // --- Start app ---
  init();
})();
