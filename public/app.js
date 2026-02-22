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

  // --- Start ---
  init();
})();
