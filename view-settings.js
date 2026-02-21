'use strict';

// ─── Settings view ────────────────────────────────────────────────────────────

function renderSettings() {
  const { settings } = state.data;

  document.getElementById('openaiKey').value      = settings.openaiKey      ?? '';
  document.getElementById('openaiModel').value    = settings.openaiModel    ?? 'gpt-4o';
  document.getElementById('linearKey').value      = settings.linearKey      ?? '';
  document.getElementById('portManagerUrl').value = settings.portManagerUrl ?? 'http://localhost:3007';

  _updateOpenaiStatus();
  _updateLinearStatus();
  _renderLinearTeamSelect();
}

function _updateOpenaiStatus() {
  const dot = document.getElementById('openaiStatus');
  // Green only after a successful test (key saved via test button or previously verified)
  dot.classList.toggle('connected', !!state.data.settings.openaiKey);
}

function _updateLinearStatus() {
  const dot    = document.getElementById('linearStatus');
  const hasKey = !!state.data.settings.linearKey;
  const hasData = state.data.linearCache.teams.length > 0;
  dot.classList.toggle('connected', hasKey && hasData);
  dot.classList.toggle('error',     hasKey && !hasData);
}

function _renderLinearTeamSelect() {
  const wrap   = document.getElementById('linearTeamWrap');
  const select = document.getElementById('linearTeam');
  const teams  = state.data.linearCache.teams;

  if (!teams.length) { wrap.style.display = 'none'; return; }

  // Default to first team if nothing saved yet
  if (!state.data.settings.linearTeamId && teams.length) {
    state.data.settings.linearTeamId = teams[0].id;
  }

  wrap.style.display = 'block';
  select.innerHTML = teams
    .map((t) => `<option value="${esc(t.id)}" ${t.id === state.data.settings.linearTeamId ? 'selected' : ''}>${esc(t.name)}</option>`)
    .join('');

  // Auto-save on change so user doesn't need to click Save Settings
  select.onchange = async function () {
    state.data.settings.linearTeamId = this.value;
    await saveData();
    showToast('Team saved');
  };
}

// ── Show/hide key fields ──────────────────────────────────────────────────────

document.querySelectorAll('.btn-eye').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

// ── Save settings ─────────────────────────────────────────────────────────────

document.getElementById('btnSaveSettings').addEventListener('click', async () => {
  state.data.settings.openaiKey      = document.getElementById('openaiKey').value.trim();
  state.data.settings.openaiModel    = document.getElementById('openaiModel').value;
  state.data.settings.linearKey      = document.getElementById('linearKey').value.trim();
  state.data.settings.portManagerUrl = document.getElementById('portManagerUrl').value.trim() || 'http://localhost:3007';

  const teamSelect = document.getElementById('linearTeam');
  if (teamSelect.value) state.data.settings.linearTeamId = teamSelect.value; // also persisted on change

  await saveData();
  _updateOpenaiStatus();
  _updateLinearStatus();
  showToast('Settings saved');
});

// ── Test OpenAI connection ────────────────────────────────────────────────────

document.getElementById('btnTestOpenai').addEventListener('click', async () => {
  const key = document.getElementById('openaiKey').value.trim();
  if (!key) { _setOpenaiTestResult('Enter your OpenAI API key first', 'err'); return; }

  const btn = document.getElementById('btnTestOpenai');
  btn.textContent = 'Testing…';
  btn.disabled = true;
  _setOpenaiTestResult('', '');

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) throw new Error('Invalid API key');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const count = json.data?.length ?? '?';
    state.data.settings.openaiKey = key;
    await saveData();
    _setOpenaiTestResult(`Connected — ${count} models available`, 'ok');
    _updateOpenaiStatus();
  } catch (err) {
    _setOpenaiTestResult(`Failed: ${err.message}`, 'err');
  } finally {
    btn.textContent = 'Test connection';
    btn.disabled = false;
  }
});

function _setOpenaiTestResult(msg, cls) {
  const el = document.getElementById('openaiTestResult');
  el.textContent = msg;
  el.className   = 'test-result' + (cls ? ` ${cls}` : '');
}

// ── Test Linear connection ────────────────────────────────────────────────────

document.getElementById('btnTestLinear').addEventListener('click', async () => {
  const key = document.getElementById('linearKey').value.trim();
  if (!key) { _setTestResult('Enter your Linear API key first', 'err'); return; }

  const btn = document.getElementById('btnTestLinear');
  btn.textContent = 'Testing…';
  btn.disabled = true;
  _setTestResult('', '');

  try {
    const teams = await _fetchLinearTeams(key);
    state.data.settings.linearKey = key;
    state.data.linearCache.teams  = teams;
    await saveData();

    _setTestResult(`Connected — ${teams.length} team(s) found`, 'ok');
    _updateLinearStatus();
    _renderLinearTeamSelect();
  } catch (err) {
    _setTestResult(`Failed: ${err.message}`, 'err');
    _updateLinearStatus();
  } finally {
    btn.textContent = 'Test connection';
    btn.disabled = false;
  }
});

function _setTestResult(msg, cls) {
  const el = document.getElementById('linearTestResult');
  el.textContent = msg;
  el.className   = 'test-result' + (cls ? ` ${cls}` : '');
}

// ── Linear API helpers (shared) ───────────────────────────────────────────────

async function _fetchLinearTeams(apiKey) {
  const query = `
    query {
      teams {
        nodes {
          id name
          projects { nodes { id name } }
          members  { nodes { id name displayName } }
        }
      }
    }`;

  const res  = await _linearGql(query, {}, apiKey);
  const data = await _checkGql(res);
  return data.teams.nodes.map((t) => ({
    id:       t.id,
    name:     t.name,
    projects: t.projects.nodes,
    members:  t.members.nodes.map((m) => ({ id: m.id, name: m.displayName || m.name })),
  }));
}

async function _linearGql(query, variables = {}, apiKey) {
  const key = apiKey ?? state.data.settings.linearKey;
  return fetch('https://api.linear.app/graphql', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: key },
    body:    JSON.stringify({ query, variables }),
  });
}

async function _checkGql(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// ── Export / Import ───────────────────────────────────────────────────────────

document.getElementById('btnExport').addEventListener('click', () => {
  const payload = {
    folders:       state.data.folders,
    looseSnippets: state.data.looseSnippets,
    settings:      state.data.settings,
    exportedAt:    new Date().toISOString(),
    version:       2,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `snippet-box-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported — load this file in your other profile');
});

document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = ''; // reset so re-importing same file works

  try {
    const text   = await file.text();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed.folders)) throw new Error('Not a valid Snippet Box backup file.');

    // Merge snippets (union by id, incoming wins on conflict)
    const existingFolderIds = new Set(state.data.folders.map((f) => f.id));
    for (const incoming of parsed.folders) {
      if (existingFolderIds.has(incoming.id)) {
        // Merge snippets inside the folder
        const existing = state.data.folders.find((f) => f.id === incoming.id);
        const existingSnippetIds = new Set(existing.snippets.map((s) => s.id));
        for (const s of incoming.snippets) {
          if (!existingSnippetIds.has(s.id)) existing.snippets.push(s);
        }
      } else {
        state.data.folders.push(incoming);
      }
    }

    // Merge loose snippets
    const existingLooseIds = new Set(state.data.looseSnippets.map((s) => s.id));
    for (const s of (parsed.looseSnippets ?? [])) {
      if (!existingLooseIds.has(s.id)) state.data.looseSnippets.push(s);
    }

    // Overwrite settings
    if (parsed.settings) {
      state.data.settings = { ...state.data.settings, ...parsed.settings };
    }

    await saveData();
    renderSettings();
    showToast('Import successful');
  } catch (err) {
    showToast(`Import failed: ${err.message}`);
  }
});

// Expose for linear view
window._linearGql   = _linearGql;
window._checkGql    = _checkGql;
window._fetchLinearTeams = _fetchLinearTeams;
