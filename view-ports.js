'use strict';

// ─── Port Manager view ────────────────────────────────────────────────────────

const portsState = {
  ports:            [],
  isLoading:        false,
  autoRefresh:      false,
  autoRefreshTimer: null,
  serverUrl:        null,
  pendingKillRow:   null, // the <tr> currently in "confirm?" state
};

// ── Entry ─────────────────────────────────────────────────────────────────────

function renderPorts() {
  portsState.serverUrl = state.data.settings.portManagerUrl ?? 'http://localhost:3007';
  _loadPorts();

  // Resume auto-refresh if it was active
  if (portsState.autoRefresh) _startAutoRefresh();
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function _loadPorts() {
  if (portsState.isLoading) return;
  portsState.isLoading = true;
  _showLoading(true);

  try {
    const res = await fetch(`${portsState.serverUrl}/api/ports`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    portsState.ports = json.ports ?? [];
    _showInterface();
    _renderTable(portsState.ports);
  } catch (_err) {
    _showServerDown();
    _stopAutoRefresh();
  } finally {
    portsState.isLoading = false;
    _showLoading(false);
  }
}

// ── Table rendering ───────────────────────────────────────────────────────────

function _renderTable(ports) {
  const tbody  = document.getElementById('portsTableBody');
  const empty  = document.getElementById('portsEmpty');
  const table  = document.getElementById('portsTable');
  const count  = document.getElementById('portsCount');

  count.textContent = `${ports.length} port${ports.length !== 1 ? 's' : ''}`;

  if (!ports.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  table.style.display = 'table';

  tbody.innerHTML = ports.map((p) => {
    const project = _shortenPath(p.cwd ?? '');
    return `
      <tr data-pid="${esc(String(p.pid))}">
        <td><a class="port-link" href="http://localhost:${esc(String(p.port))}" target="_blank" rel="noopener">${esc(String(p.port))}</a></td>
        <td><span class="port-project" title="${esc(p.cwd ?? '')}">${esc(project)}</span></td>
        <td style="text-align:right; width:32px; padding-right:10px">
          <button class="port-kill-btn" data-pid="${esc(String(p.pid))}" title="Kill process">
            <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
              <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.port-kill-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _handleKillClick(btn.dataset.pid, btn.closest('tr'));
    });
  });

  // Click outside to cancel any pending kill
  document.addEventListener('click', _cancelPendingKill, { once: false });
}

function _shortenPath(cwd) {
  if (!cwd) return '—';
  const home = cwd.replace(/^\/Users\/[^/]+/, '~');
  // Show last 2 path segments
  const parts = home.split('/').filter(Boolean);
  if (parts.length <= 2) return home;
  return '…/' + parts.slice(-2).join('/');
}

// ── Kill flow ─────────────────────────────────────────────────────────────────

function _handleKillClick(pid, rowEl) {
  // If this row is already in confirm state, execute the kill
  if (portsState.pendingKillRow === rowEl) {
    _killProcess(pid, rowEl);
    return;
  }

  // Cancel any other pending kill first
  _cancelPendingKill();

  // Enter confirm state
  portsState.pendingKillRow = rowEl;
  rowEl.classList.add('killing');

  const btn = rowEl.querySelector('.port-kill-btn');
  btn.outerHTML = `<button class="port-kill-confirm" data-pid="${esc(pid)}">Confirm?</button>`;

  rowEl.querySelector('.port-kill-confirm').addEventListener('click', (e) => {
    e.stopPropagation();
    _killProcess(pid, rowEl);
  });
}

function _cancelPendingKill() {
  const rowEl = portsState.pendingKillRow;
  if (!rowEl || !rowEl.isConnected) { portsState.pendingKillRow = null; return; }

  rowEl.classList.remove('killing');

  const confirmBtn = rowEl.querySelector('.port-kill-confirm');
  if (confirmBtn) {
    confirmBtn.outerHTML = `
      <button class="port-kill-btn" data-pid="${esc(confirmBtn.dataset.pid)}" title="Kill process">
        <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
          <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>`;

    rowEl.querySelector('.port-kill-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      _handleKillClick(confirmBtn.dataset.pid, rowEl);
    });
  }

  portsState.pendingKillRow = null;
}

async function _killProcess(pid, rowEl) {
  portsState.pendingKillRow = null;
  document.removeEventListener('click', _cancelPendingKill);

  try {
    const res = await fetch(`${portsState.serverUrl}/api/kill/${encodeURIComponent(pid)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Fade out and remove row
    rowEl.style.transition = 'opacity 200ms, background 200ms';
    rowEl.style.opacity    = '0';
    setTimeout(() => {
      rowEl.remove();
      portsState.ports = portsState.ports.filter((p) => String(p.pid) !== String(pid));
      const count = document.getElementById('portsCount');
      if (count) count.textContent = `${portsState.ports.length} port${portsState.ports.length !== 1 ? 's' : ''}`;
      if (!portsState.ports.length) {
        document.getElementById('portsTable').style.display = 'none';
        document.getElementById('portsEmpty').style.display = 'block';
      }
    }, 210);
  } catch (err) {
    rowEl.classList.remove('killing');
    showToast(`Kill failed: ${err.message}`);
    _cancelPendingKill();
  }
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────

function _startAutoRefresh() {
  _stopAutoRefresh();
  portsState.autoRefresh      = true;
  portsState.autoRefreshTimer = setInterval(_loadPorts, 5000);
  document.getElementById('portsAutoToggle')?.classList.add('active');
}

function _stopAutoRefresh() {
  clearInterval(portsState.autoRefreshTimer);
  portsState.autoRefresh      = false;
  portsState.autoRefreshTimer = null;
  document.getElementById('portsAutoToggle')?.classList.remove('active');
}

// ── View state helpers ────────────────────────────────────────────────────────

function _showServerDown() {
  document.getElementById('ports-server-down').style.display = '';
  document.getElementById('ports-interface').style.display   = 'none';
}

function _showInterface() {
  document.getElementById('ports-server-down').style.display = 'none';
  document.getElementById('ports-interface').style.display   = 'flex';
}

function _showLoading(show) {
  const el = document.getElementById('portsLoading');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ── Controls ──────────────────────────────────────────────────────────────────

document.getElementById('portsRefresh').addEventListener('click', _loadPorts);

document.getElementById('portsAutoToggle').addEventListener('click', () => {
  if (portsState.autoRefresh) _stopAutoRefresh();
  else _startAutoRefresh();
});

document.getElementById('portsRetry').addEventListener('click', _loadPorts);

// Stop auto-refresh when leaving the Ports tab
document.getElementById('app').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (btn && btn.dataset.tab !== 'ports') {
    _stopAutoRefresh();
  }
});
