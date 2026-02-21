'use strict';

// ─── City → timezone data ──────────────────────────────────────────────────────

const CITY_TZ = [
  { city: 'New York',        cc: 'US', tz: 'America/New_York' },
  { city: 'Los Angeles',     cc: 'US', tz: 'America/Los_Angeles' },
  { city: 'Chicago',         cc: 'US', tz: 'America/Chicago' },
  { city: 'Denver',          cc: 'US', tz: 'America/Denver' },
  { city: 'Phoenix',         cc: 'US', tz: 'America/Phoenix' },
  { city: 'Seattle',         cc: 'US', tz: 'America/Los_Angeles' },
  { city: 'San Francisco',   cc: 'US', tz: 'America/Los_Angeles' },
  { city: 'Boston',          cc: 'US', tz: 'America/New_York' },
  { city: 'Miami',           cc: 'US', tz: 'America/New_York' },
  { city: 'Austin',          cc: 'US', tz: 'America/Chicago' },
  { city: 'Dallas',          cc: 'US', tz: 'America/Chicago' },
  { city: 'Atlanta',         cc: 'US', tz: 'America/New_York' },
  { city: 'Honolulu',        cc: 'US', tz: 'Pacific/Honolulu' },
  { city: 'Anchorage',       cc: 'US', tz: 'America/Anchorage' },
  { city: 'Toronto',         cc: 'CA', tz: 'America/Toronto' },
  { city: 'Vancouver',       cc: 'CA', tz: 'America/Vancouver' },
  { city: 'Montreal',        cc: 'CA', tz: 'America/Toronto' },
  { city: 'Calgary',         cc: 'CA', tz: 'America/Edmonton' },
  { city: 'Mexico City',     cc: 'MX', tz: 'America/Mexico_City' },
  { city: 'São Paulo',       cc: 'BR', tz: 'America/Sao_Paulo' },
  { city: 'Rio de Janeiro',  cc: 'BR', tz: 'America/Sao_Paulo' },
  { city: 'Buenos Aires',    cc: 'AR', tz: 'America/Argentina/Buenos_Aires' },
  { city: 'Santiago',        cc: 'CL', tz: 'America/Santiago' },
  { city: 'Bogotá',          cc: 'CO', tz: 'America/Bogota' },
  { city: 'Lima',            cc: 'PE', tz: 'America/Lima' },
  { city: 'London',          cc: 'GB', tz: 'Europe/London' },
  { city: 'Dublin',          cc: 'IE', tz: 'Europe/Dublin' },
  { city: 'Lisbon',          cc: 'PT', tz: 'Europe/Lisbon' },
  { city: 'Paris',           cc: 'FR', tz: 'Europe/Paris' },
  { city: 'Berlin',          cc: 'DE', tz: 'Europe/Berlin' },
  { city: 'Amsterdam',       cc: 'NL', tz: 'Europe/Amsterdam' },
  { city: 'Brussels',        cc: 'BE', tz: 'Europe/Brussels' },
  { city: 'Madrid',          cc: 'ES', tz: 'Europe/Madrid' },
  { city: 'Barcelona',       cc: 'ES', tz: 'Europe/Madrid' },
  { city: 'Rome',            cc: 'IT', tz: 'Europe/Rome' },
  { city: 'Milan',           cc: 'IT', tz: 'Europe/Rome' },
  { city: 'Vienna',          cc: 'AT', tz: 'Europe/Vienna' },
  { city: 'Zurich',          cc: 'CH', tz: 'Europe/Zurich' },
  { city: 'Stockholm',       cc: 'SE', tz: 'Europe/Stockholm' },
  { city: 'Oslo',            cc: 'NO', tz: 'Europe/Oslo' },
  { city: 'Copenhagen',      cc: 'DK', tz: 'Europe/Copenhagen' },
  { city: 'Helsinki',        cc: 'FI', tz: 'Europe/Helsinki' },
  { city: 'Warsaw',          cc: 'PL', tz: 'Europe/Warsaw' },
  { city: 'Prague',          cc: 'CZ', tz: 'Europe/Prague' },
  { city: 'Budapest',        cc: 'HU', tz: 'Europe/Budapest' },
  { city: 'Bucharest',       cc: 'RO', tz: 'Europe/Bucharest' },
  { city: 'Athens',          cc: 'GR', tz: 'Europe/Athens' },
  { city: 'Istanbul',        cc: 'TR', tz: 'Europe/Istanbul' },
  { city: 'Moscow',          cc: 'RU', tz: 'Europe/Moscow' },
  { city: 'Kiev',            cc: 'UA', tz: 'Europe/Kiev' },
  { city: 'Cairo',           cc: 'EG', tz: 'Africa/Cairo' },
  { city: 'Lagos',           cc: 'NG', tz: 'Africa/Lagos' },
  { city: 'Nairobi',         cc: 'KE', tz: 'Africa/Nairobi' },
  { city: 'Johannesburg',    cc: 'ZA', tz: 'Africa/Johannesburg' },
  { city: 'Casablanca',      cc: 'MA', tz: 'Africa/Casablanca' },
  { city: 'Accra',           cc: 'GH', tz: 'Africa/Accra' },
  { city: 'Dubai',           cc: 'AE', tz: 'Asia/Dubai' },
  { city: 'Riyadh',          cc: 'SA', tz: 'Asia/Riyadh' },
  { city: 'Tel Aviv',        cc: 'IL', tz: 'Asia/Jerusalem' },
  { city: 'Doha',            cc: 'QA', tz: 'Asia/Qatar' },
  { city: 'Kuwait City',     cc: 'KW', tz: 'Asia/Kuwait' },
  { city: 'Tehran',          cc: 'IR', tz: 'Asia/Tehran' },
  { city: 'Karachi',         cc: 'PK', tz: 'Asia/Karachi' },
  { city: 'Lahore',          cc: 'PK', tz: 'Asia/Karachi' },
  { city: 'Mumbai',          cc: 'IN', tz: 'Asia/Kolkata' },
  { city: 'Delhi',           cc: 'IN', tz: 'Asia/Kolkata' },
  { city: 'Bangalore',       cc: 'IN', tz: 'Asia/Kolkata' },
  { city: 'Chennai',         cc: 'IN', tz: 'Asia/Kolkata' },
  { city: 'Kolkata',         cc: 'IN', tz: 'Asia/Kolkata' },
  { city: 'Dhaka',           cc: 'BD', tz: 'Asia/Dhaka' },
  { city: 'Kathmandu',       cc: 'NP', tz: 'Asia/Kathmandu' },
  { city: 'Colombo',         cc: 'LK', tz: 'Asia/Colombo' },
  { city: 'Bangkok',         cc: 'TH', tz: 'Asia/Bangkok' },
  { city: 'Ho Chi Minh City',cc: 'VN', tz: 'Asia/Ho_Chi_Minh' },
  { city: 'Hanoi',           cc: 'VN', tz: 'Asia/Bangkok' },
  { city: 'Jakarta',         cc: 'ID', tz: 'Asia/Jakarta' },
  { city: 'Singapore',       cc: 'SG', tz: 'Asia/Singapore' },
  { city: 'Kuala Lumpur',    cc: 'MY', tz: 'Asia/Kuala_Lumpur' },
  { city: 'Manila',          cc: 'PH', tz: 'Asia/Manila' },
  { city: 'Hong Kong',       cc: 'HK', tz: 'Asia/Hong_Kong' },
  { city: 'Shanghai',        cc: 'CN', tz: 'Asia/Shanghai' },
  { city: 'Beijing',         cc: 'CN', tz: 'Asia/Shanghai' },
  { city: 'Shenzhen',        cc: 'CN', tz: 'Asia/Shanghai' },
  { city: 'Taipei',          cc: 'TW', tz: 'Asia/Taipei' },
  { city: 'Seoul',           cc: 'KR', tz: 'Asia/Seoul' },
  { city: 'Tokyo',           cc: 'JP', tz: 'Asia/Tokyo' },
  { city: 'Osaka',           cc: 'JP', tz: 'Asia/Tokyo' },
  { city: 'Sydney',          cc: 'AU', tz: 'Australia/Sydney' },
  { city: 'Melbourne',       cc: 'AU', tz: 'Australia/Melbourne' },
  { city: 'Brisbane',        cc: 'AU', tz: 'Australia/Brisbane' },
  { city: 'Perth',           cc: 'AU', tz: 'Australia/Perth' },
  { city: 'Adelaide',        cc: 'AU', tz: 'Australia/Adelaide' },
  { city: 'Auckland',        cc: 'NZ', tz: 'Pacific/Auckland' },
];

// ─── Stopwatch state ──────────────────────────────────────────────────────────

const timerState = {
  running:   false,
  startedAt: 0,
  elapsed:   0,
  laps:      [],
  rafId:     null,
};

// ─── Entry ────────────────────────────────────────────────────────────────────

function renderTimer() {
  _updateDisplay(timerState.elapsed);
  _renderLaps();
  _syncButtons();
  _renderClocks();
}

// ── Stopwatch controls ────────────────────────────────────────────────────────

document.getElementById('timerStartStop').addEventListener('click', () => {
  timerState.running ? _pause() : _start();
});

document.getElementById('timerLap').addEventListener('click', () => {
  if (!timerState.running) return;
  const total = timerState.elapsed + (Date.now() - timerState.startedAt);
  const prev  = timerState.laps.length ? timerState.laps[timerState.laps.length - 1].total : 0;
  timerState.laps.push({ n: timerState.laps.length + 1, total, split: total - prev });
  _renderLaps();
});

document.getElementById('timerReset').addEventListener('click', () => {
  _pause();
  timerState.elapsed = 0;
  timerState.laps    = [];
  _updateDisplay(0);
  document.getElementById('timerLapCurrent').textContent = '';
  _renderLaps();
  _syncButtons();
});

function _start() {
  timerState.running   = true;
  timerState.startedAt = Date.now();
  _tick();
  _syncButtons();
}

function _pause() {
  if (!timerState.running) return;
  timerState.running  = false;
  timerState.elapsed += Date.now() - timerState.startedAt;
  cancelAnimationFrame(timerState.rafId);
  _syncButtons();
}

function _tick() {
  const total = timerState.elapsed + (Date.now() - timerState.startedAt);
  _updateDisplay(total);
  const lastLapTotal = timerState.laps.length
    ? timerState.laps[timerState.laps.length - 1].total : 0;
  const split = total - lastLapTotal;
  document.getElementById('timerLapCurrent').textContent =
    timerState.laps.length ? `+${_fmt(split)}` : '';
  timerState.rafId = requestAnimationFrame(_tick);
}

function _updateDisplay(ms) {
  document.getElementById('timerDisplay').textContent = _fmt(ms);
}

function _fmt(ms) {
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const cc = String(cs).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}.${cc}` : `${mm}:${ss}.${cc}`;
}

function _renderLaps() {
  const el = document.getElementById('timerLaps');
  if (!timerState.laps.length) { el.innerHTML = ''; return; }
  const splits  = timerState.laps.map((l) => l.split);
  const fastest = Math.min(...splits);
  const slowest = Math.max(...splits);
  const multi   = timerState.laps.length > 2;
  el.innerHTML = [...timerState.laps].reverse().map((lap) => {
    const cls = multi
      ? lap.split === fastest ? ' lap-fastest' : lap.split === slowest ? ' lap-slowest' : ''
      : '';
    return `<div class="timer-lap-row${cls}">
      <span class="timer-lap-n">Lap ${lap.n}</span>
      <span class="timer-lap-split">${_fmt(lap.split)}</span>
      <span class="timer-lap-total">${_fmt(lap.total)}</span>
    </div>`;
  }).join('');
}

function _syncButtons() {
  const startStop = document.getElementById('timerStartStop');
  const lapBtn    = document.getElementById('timerLap');
  const resetBtn  = document.getElementById('timerReset');
  startStop.textContent = timerState.running ? 'Pause'
    : timerState.elapsed > 0 ? 'Resume' : 'Start';
  startStop.classList.toggle('timer-btn-running', timerState.running);
  lapBtn.disabled   = !timerState.running;
  resetBtn.disabled = timerState.running || timerState.elapsed === 0;
}

// ── World clocks ──────────────────────────────────────────────────────────────

let _clockInterval = null;
let _acHighlight   = -1; // autocomplete keyboard index

function _flag(cc) {
  return [...cc.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

function _clockTime(tz) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
  });
  // Day offset relative to local date
  const localDate  = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const remoteDate = now.toLocaleDateString('en-CA', { timeZone: tz });
  const diff = (new Date(remoteDate) - new Date(localDate)) / 86400000;
  const dayTag = diff === 0 ? '' : diff > 0 ? `<span class="clock-day-tag">+${diff}d</span>` : `<span class="clock-day-tag neg">${diff}d</span>`;
  return { timeStr, dayTag };
}

function _utcOffset(tz) {
  const now = new Date();
  const local  = new Date(now.toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  const remote = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const diffH  = (remote - local) / 3600000;
  if (diffH === 0) return 'Same time';
  const sign = diffH > 0 ? '+' : '−';
  const abs  = Math.abs(diffH);
  const h    = Math.floor(abs);
  const m    = Math.round((abs - h) * 60);
  return m ? `${sign}${h}h ${m}m` : `${sign}${h}h`;
}

function _renderClocks() {
  const list   = document.getElementById('clockList');
  const clocks = state.data.worldClocks;

  if (!clocks.length) {
    list.innerHTML = `<div class="clock-empty">No clocks added yet</div>`;
    return;
  }

  list.innerHTML = clocks.map((c, i) => {
    const { timeStr, dayTag } = _clockTime(c.tz);
    const offset = _utcOffset(c.tz);
    return `<div class="clock-card">
      <div class="clock-card-left">
        <span class="clock-flag">${_flag(c.cc)}</span>
        <div class="clock-info">
          <div class="clock-city">${esc(c.city)}</div>
          <div class="clock-offset">${esc(offset)}</div>
        </div>
      </div>
      <div class="clock-card-right">
        <div class="clock-time">${esc(timeStr)}${dayTag}</div>
        <button class="clock-remove-btn" data-index="${i}" title="Remove">×</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.clock-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.data.worldClocks.splice(Number(btn.dataset.index), 1);
      saveData();
      _renderClocks();
    });
  });

  // Refresh every 10s
  clearInterval(_clockInterval);
  _clockInterval = setInterval(_renderClocks, 10000);
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

const _input = document.getElementById('clockCityInput');
const _acBox = document.getElementById('clockAutocomplete');

_input.addEventListener('input', () => {
  const q = _input.value.trim().toLowerCase();
  _acHighlight = -1;
  if (q.length < 1) { _hideAc(); return; }
  const matches = CITY_TZ.filter((c) =>
    c.city.toLowerCase().includes(q)
  ).slice(0, 8);
  if (!matches.length) { _hideAc(); return; }
  _acBox.innerHTML = matches.map((c, i) =>
    `<div class="ac-item" data-index="${i}" data-city="${esc(c.city)}" data-cc="${esc(c.cc)}" data-tz="${esc(c.tz)}">
      <span class="ac-flag">${_flag(c.cc)}</span>
      <span class="ac-city">${esc(c.city)}</span>
      <span class="ac-cc">${esc(c.cc)}</span>
    </div>`
  ).join('');
  _acBox.style.display = 'block';

  _acBox.querySelectorAll('.ac-item').forEach((item) => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      _selectCity({ city: item.dataset.city, cc: item.dataset.cc, tz: item.dataset.tz });
    });
  });
});

_input.addEventListener('keydown', (e) => {
  const items = _acBox.querySelectorAll('.ac-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _acHighlight = Math.min(_acHighlight + 1, items.length - 1);
    _highlightAc(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _acHighlight = Math.max(_acHighlight - 1, 0);
    _highlightAc(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const target = _acHighlight >= 0 ? items[_acHighlight] : items[0];
    if (target) _selectCity({ city: target.dataset.city, cc: target.dataset.cc, tz: target.dataset.tz });
  } else if (e.key === 'Escape') {
    _hideAc();
  }
});

_input.addEventListener('blur', () => setTimeout(_hideAc, 150));

function _highlightAc(items) {
  items.forEach((el, i) => el.classList.toggle('ac-active', i === _acHighlight));
}

function _hideAc() {
  _acBox.style.display = 'none';
  _acBox.innerHTML = '';
  _acHighlight = -1;
}

function _selectCity({ city, cc, tz }) {
  // Avoid duplicates
  if (state.data.worldClocks.some((c) => c.city === city)) {
    showToast(`${city} already added`);
    _input.value = '';
    _hideAc();
    return;
  }
  state.data.worldClocks.push({ city, cc, tz });
  saveData();
  _input.value = '';
  _hideAc();
  _renderClocks();
}
