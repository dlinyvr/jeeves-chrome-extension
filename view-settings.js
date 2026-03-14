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
  _renderPromptTemplates();
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

// ── Profile email ─────────────────────────────────────────────────────────────

let _profileEmail = '';

(function _loadProfileEmail() {
  if (!chrome?.identity?.getProfileUserInfo) return;
  chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
    if (!info?.email) return;
    _profileEmail = info.email;
    const el = document.getElementById('profileEmail');
    if (el) el.textContent = info.email;
  });
})();

// ── Export / Import ───────────────────────────────────────────────────────────

document.getElementById('btnExport').addEventListener('click', () => {
  const payload = {
    folders:       state.data.folders,
    looseSnippets: state.data.looseSnippets,
    todos:         state.data.todos,
    worldClocks:   state.data.worldClocks,
    settings:      state.data.settings,
    exportedAt:    new Date().toISOString(),
    version:       2,
  };
  const json     = JSON.stringify(payload, null, 2);
  const blob     = new Blob([json], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  const date     = new Date().toISOString().slice(0, 10);
  const prefix   = _profileEmail ? _profileEmail.split('@')[0] + '-' : '';
  a.href         = url;
  a.download     = `${prefix}snippet-box-${date}.json`;
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

// ── Prompt Templates ──────────────────────────────────────────────────────────

function _renderPromptTemplates() {
  const prompts = state.data.chatPrompts ?? [];
  const list    = document.getElementById('promptTemplatesList');

  if (!prompts.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-faint);margin-bottom:10px">No prompts yet.</div>';
    return;
  }

  list.innerHTML = prompts.map((p, i) => `
    <div class="prompt-template-row" data-id="${esc(p.id)}">
      <div class="prompt-template-info">
        <span class="prompt-template-title">${esc(p.title)}</span>
        <span class="prompt-template-model">${esc(p.model)}</span>
      </div>
      <div class="prompt-template-actions">
        <button class="btn-test prompt-edit-btn" data-id="${esc(p.id)}">Edit</button>
        <button class="btn-test prompt-delete-btn" data-id="${esc(p.id)}" style="color:var(--danger)">Delete</button>
      </div>
    </div>
    <div class="prompt-edit-form" id="promptEditForm-${esc(p.id)}" style="display:none">
      <div class="form-field">
        <label class="form-label">Title</label>
        <input type="text" class="form-input prompt-edit-title" data-id="${esc(p.id)}" value="${esc(p.title)}" maxlength="60">
      </div>
      <div class="form-field">
        <label class="form-label">Prompt</label>
        <textarea class="form-textarea prompt-edit-content" data-id="${esc(p.id)}" rows="3">${esc(p.content)}</textarea>
      </div>
      <div class="form-field">
        <label class="form-label">Model</label>
        <select class="form-select prompt-edit-model" data-id="${esc(p.id)}">
          <option value="gpt-4o" ${p.model === 'gpt-4o' ? 'selected' : ''}>⚡ Balanced — gpt-4o</option>
          <option value="gpt-4o-mini" ${p.model === 'gpt-4o-mini' ? 'selected' : ''}>💰 Budget — gpt-4o-mini</option>
          <option value="o3-mini" ${p.model === 'o3-mini' ? 'selected' : ''}>🧠 Deep Think — o3-mini</option>
          <option value="gpt-4-turbo" ${p.model === 'gpt-4-turbo' ? 'selected' : ''}>gpt-4-turbo</option>
          <option value="o1-mini" ${p.model === 'o1-mini' ? 'selected' : ''}>o1-mini</option>
        </select>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn-cancel prompt-edit-cancel-btn" data-id="${esc(p.id)}">Cancel</button>
        <button class="btn-save prompt-edit-save-btn" data-id="${esc(p.id)}">Save</button>
      </div>
    </div>
  `).join('');

  // Edit toggle
  list.querySelectorAll('.prompt-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = document.getElementById(`promptEditForm-${btn.dataset.id}`);
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      btn.textContent = form.style.display === 'none' ? 'Edit' : 'Close';
    });
  });

  // Edit cancel
  list.querySelectorAll('.prompt-edit-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = document.getElementById(`promptEditForm-${btn.dataset.id}`);
      form.style.display = 'none';
      const editBtn = list.querySelector(`.prompt-edit-btn[data-id="${btn.dataset.id}"]`);
      if (editBtn) editBtn.textContent = 'Edit';
    });
  });

  // Edit save
  list.querySelectorAll('.prompt-edit-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id      = btn.dataset.id;
      const prompt  = state.data.chatPrompts.find(p => p.id === id);
      if (!prompt) return;
      const title   = list.querySelector(`.prompt-edit-title[data-id="${id}"]`).value.trim();
      const content = list.querySelector(`.prompt-edit-content[data-id="${id}"]`).value.trim();
      const model   = list.querySelector(`.prompt-edit-model[data-id="${id}"]`).value;
      if (!title) { showToast('Title is required'); return; }
      prompt.title   = title;
      prompt.content = content;
      prompt.model   = model;
      await saveData();
      showToast('Prompt saved');
      _renderPromptTemplates();
    });
  });

  // Delete
  list.querySelectorAll('.prompt-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.data.chatPrompts = state.data.chatPrompts.filter(p => p.id !== btn.dataset.id);
      await saveData();
      showToast('Prompt deleted');
      _renderPromptTemplates();
    });
  });
}

document.getElementById('btnAddPrompt').addEventListener('click', async () => {
  const title   = document.getElementById('promptAddTitle').value.trim();
  const content = document.getElementById('promptAddContent').value.trim();
  const model   = document.getElementById('promptAddModel').value;

  if (!title) { showToast('Title is required'); return; }

  if (!state.data.chatPrompts) state.data.chatPrompts = [];
  state.data.chatPrompts.push({ id: uid(), title, content, model });
  await saveData();
  showToast('Prompt added');

  document.getElementById('promptAddTitle').value   = '';
  document.getElementById('promptAddContent').value = '';
  document.getElementById('promptAddModel').value   = 'gpt-4o';

  _renderPromptTemplates();
});

// Expose for linear view
window._linearGql   = _linearGql;
window._checkGql    = _checkGql;
window._fetchLinearTeams = _fetchLinearTeams;
