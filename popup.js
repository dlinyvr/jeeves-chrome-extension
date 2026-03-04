'use strict';

// ─── Available tools ───────────────────────────────────────────────────────────

const AVAILABLE_TASKS = [
  {
    id: 'snippets',
    label: 'Snippets',
    icon: `<svg viewBox="0 0 16 16" fill="none" width="13" height="13" style="flex-shrink:0"><rect x="2" y="2" width="12" height="2.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="6.75" width="12" height="2.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="11.5" width="8" height="2.5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>`,
    description: 'Store and copy text snippets',
  },
  {
    id: 'linear',
    label: 'Linear',
    icon: `<img src="icons/linear-logo.png" width="14" height="14" alt="" style="border-radius:3px;flex-shrink:0">`,
    description: 'Create Linear tickets with AI',
  },
  {
    id: 'files',
    label: 'Files',
    icon: `<svg viewBox="0 0 16 16" fill="none" width="13" height="13" style="flex-shrink:0"><path d="M4 2h5.5L12 4.5V14H4V2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 2v3h3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.5 8h3M6.5 10.5h3M6.5 5.5H8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    description: 'Create and download files',
  },
  {
    id: 'chat',
    label: 'AI Chat',
    icon: `<svg viewBox="0 0 16 16" fill="none" width="13" height="13" style="flex-shrink:0"><rect x="1.5" y="1.5" width="13" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 6h.01M8 6h.01M11.5 6h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 11.5l1.5 2.5 1.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    description: 'Chat with AI models',
  },
  {
    id: 'ports',
    label: 'Ports',
    icon: `<svg viewBox="0 0 16 16" fill="none" width="13" height="13" style="flex-shrink:0"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3.5l2 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="2" r="1" fill="currentColor"/></svg>`,
    description: 'View and kill local processes by port',
  },
  {
    id: 'todo',
    label: 'To-Do',
    icon: `<svg viewBox="0 0 16 16" fill="none" width="13" height="13" style="flex-shrink:0"><rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 4.5l1 1 2-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4"/><path d="M9.5 4.5h4M9.5 8h4M9.5 11.5h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    description: 'Simple task list',
  },
  {
    id: 'timer',
    label: 'Timer',
    icon: `<svg viewBox="0 0 16 16" fill="none" width="13" height="13" style="flex-shrink:0"><circle cx="8" cy="9" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 6.5V9l1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 2h4M8 2v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    description: 'Stopwatch with lap times',
  },
];

// ─── Shared state ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'snippetbox_v2';
const UI_KEY      = 'snippetbox_ui_v1';

const state = {
  data: {
    folders:       [],
    looseSnippets: [],
    todos:         [],
    worldClocks:   [],
    settings: {
      openaiKey:      '',
      openaiModel:    'gpt-4o',
      linearKey:      '',
      linearTeamId:   '',
      chatModel:      'gpt-4o',
      portManagerUrl: 'http://localhost:3007',
    },
    linearCache: { teams: [] },
  },
  activeTab: 'snippets',
  snippets: {
    expandedFolders: new Set(),
    searchQuery:     '',
    activeForm:      null,
    showAddFolder:   false,
    showAddLoose:    false,
    showAddGrid:     false,
    showSaveTabs:    false,
    showLoadTabs:    false,
    gridFormState:   null,
  },
};

// UI state — persisted across popup opens via chrome.storage.local
const ui = {
  activeTab:         'snippets',
  pinnedTabs:        ['snippets', 'linear', 'files', 'chat'],
  // Snippets
  expandedFolders:   [],   // serialised Set
  searchQuery:       '',
  // Linear
  linearTemplate:    'bug',
  linearInput:       '',
  // Chat
  chatMessages:      [],   // capped at 60
  chatModel:         'gpt-4o',
  chatWebSearch:     false,
  chatDraft:         '',
  // Files
  filesName:         '',
  filesDestination:  '',
  filesCustomFolder: '',
  filesContent:      '',
};

// ─── Data storage (sync — snippets / settings) ────────────────────────────────

async function loadData() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        if (result[STORAGE_KEY]) {
          _mergeData(result[STORAGE_KEY]);
          resolve();
        } else {
          // One-time migration: pull from sync if local is empty
          chrome.storage.sync.get(STORAGE_KEY, (syncResult) => {
            if (syncResult[STORAGE_KEY]) _mergeData(syncResult[STORAGE_KEY]);
            resolve();
          });
        }
      });
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) _mergeData(JSON.parse(saved));
      resolve();
    }
  });
}

function _mergeData(saved) {
  state.data.folders       = saved.folders       ?? [];
  state.data.looseSnippets = saved.looseSnippets ?? [];
  state.data.todos         = saved.todos         ?? [];
  state.data.worldClocks   = saved.worldClocks   ?? [];
  state.data.settings      = { ...state.data.settings, ...(saved.settings ?? {}) };
  state.data.linearCache   = { teams: saved.linearCache?.teams ?? [] };
}

async function saveData() {
  return new Promise((resolve) => {
    const payload = {
      folders:       state.data.folders,
      looseSnippets: state.data.looseSnippets,
      todos:         state.data.todos,
      worldClocks:   state.data.worldClocks,
      settings:      state.data.settings,
      linearCache:   state.data.linearCache,
    };
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => {
        if (chrome.runtime.lastError) {
          console.error('Save failed:', chrome.runtime.lastError);
          showToast('Save failed — storage full');
        }
        resolve();
      });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      resolve();
    }
  });
}

// ─── UI state storage (local — ephemeral UI state) ────────────────────────────

async function loadUiState() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(UI_KEY, (result) => {
        if (result[UI_KEY]) Object.assign(ui, result[UI_KEY]);
        resolve();
      });
    } else {
      const saved = localStorage.getItem(UI_KEY);
      if (saved) Object.assign(ui, JSON.parse(saved));
      resolve();
    }
  });
}

let _uiSaveTimer;
function saveUiState() {
  clearTimeout(_uiSaveTimer);
  _uiSaveTimer = setTimeout(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [UI_KEY]: ui });
    } else {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    }
  }, 350); // debounce — don't hammer on every keystroke
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlight(text, query) {
  if (!query) return esc(text);
  const safe = esc(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
}

let toastTimer;
function showToast(msg, duration = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ─── Tab bar rendering ────────────────────────────────────────────────────────

function renderTabBar() {
  const bar    = document.getElementById('tabBar');
  const pinned = ui.pinnedTabs ?? ['snippets', 'linear', 'files', 'chat'];
  const active = state.activeTab;

  const pinnedHtml = pinned.map((taskId) => {
    const task = AVAILABLE_TASKS.find((t) => t.id === taskId);
    if (!task) return '';
    const isActive = active === taskId;
    return `<button class="tab-btn${isActive ? ' active' : ''}" data-tab="${task.id}">${task.icon} ${task.label}</button>`;
  }).join('');

  const tasksActive   = active === 'tasks'   ? ' active' : '';
  const settingsActive = active === 'settings' ? ' active' : '';

  bar.innerHTML = pinnedHtml + `
    <button class="tab-btn tab-btn-tasks${tasksActive}" data-tab="tasks" title="All Tools">
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.3" stroke="currentColor" stroke-width="1.4"/>
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.3" stroke="currentColor" stroke-width="1.4"/>
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.3" stroke="currentColor" stroke-width="1.4"/>
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.3" stroke="currentColor" stroke-width="1.4"/>
      </svg>
    </button>
    <button class="tab-btn tab-btn-settings${settingsActive}" data-tab="settings" title="Settings">
      <svg viewBox="0 0 16 16" fill="none" width="13" height="13">
        <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="5" cy="4" r="1.6" fill="var(--bg)" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="11" cy="8" r="1.6" fill="var(--bg)" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="6" cy="12" r="1.6" fill="var(--bg)" stroke="currentColor" stroke-width="1.4"/>
      </svg>
    </button>`;

  bar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ─── Tab routing ──────────────────────────────────────────────────────────────

function switchTab(tab) {
  state.activeTab = tab;
  ui.activeTab    = tab;
  saveUiState();

  // Update active state in tab bar (re-render buttons)
  renderTabBar();

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });

  if (tab === 'snippets') renderSnippets();
  if (tab === 'settings') renderSettings();
  if (tab === 'linear')   renderLinear();
  if (tab === 'files')    renderFiles();
  if (tab === 'chat')     renderChat();
  if (tab === 'tasks')    renderTasks();
  if (tab === 'ports')    renderPorts();
  if (tab === 'todo')     renderTodo();
  if (tab === 'timer')    renderTimer();
}

document.getElementById('app').addEventListener('click', (e) => {
  if (e.target.id === 'btnGoToSettings') switchTab('settings');
});

// ─── Tasks panel ──────────────────────────────────────────────────────────────

const PIN_ICON   = `<svg viewBox="0 0 16 16" fill="none" width="11" height="11"><path d="M9.5 2L14 6.5l-2.5 1L10.5 11 8.5 9 5.5 12 4 10.5l3-3L5.5 6l4-4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 16 16" fill="none" width="11" height="11"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let _selectedPinnedId = null;

function renderTasks() {
  const pinned    = ui.pinnedTabs ?? ['snippets', 'linear', 'files', 'chat'];
  const container = document.getElementById('tasksGrid');

  const pinnedTasks   = pinned.map((id) => AVAILABLE_TASKS.find((t) => t.id === id)).filter(Boolean);
  const unpinnedTasks = AVAILABLE_TASKS.filter((t) => !pinned.includes(t.id));

  // Keep selection valid
  if (_selectedPinnedId && !pinned.includes(_selectedPinnedId)) _selectedPinnedId = null;

  const makeCard = (task, isPinned) => {
    const selected = isPinned && task.id === _selectedPinnedId ? ' is-selected' : '';
    return `
      <div class="task-card${isPinned ? ' is-pinned' : ''}${selected}" data-task="${task.id}">
        <div class="task-card-icon">${task.icon}</div>
        <div class="task-card-info">
          <div class="task-card-name">${task.label}</div>
          <div class="task-card-desc">${task.description}</div>
        </div>
        <button class="task-pin-btn${isPinned ? ' pinned' : ''}" data-task="${task.id}" title="${isPinned ? 'Unpin from bar' : 'Pin to bar'}">
          ${isPinned ? CHECK_ICON : PIN_ICON}
        </button>
      </div>`;
  };

  container.innerHTML =
    pinnedTasks.map((t) => makeCard(t, true)).join('') +
    (unpinnedTasks.length ? `<div class="tasks-section-label">Available</div>` : '') +
    unpinnedTasks.map((t) => makeCard(t, false)).join('');

  // Click pinned card body → select it; click unpinned → navigate
  container.querySelectorAll('.task-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.task-pin-btn')) return;
      if (card.classList.contains('is-pinned')) {
        _selectedPinnedId = card.dataset.task;
        renderTasks();
      } else {
        switchTab(card.dataset.task);
      }
    });
  });

  // Pin/unpin buttons
  container.querySelectorAll('.task-pin-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePin(btn.dataset.task);
    });
  });

  // Up/Down buttons
  _updateMoveBtns(pinned);
}

function _updateMoveBtns(pinned) {
  const upBtn   = document.getElementById('tasksMoveUp');
  const downBtn = document.getElementById('tasksMoveDown');
  if (!upBtn || !downBtn) return;

  const idx = _selectedPinnedId ? pinned.indexOf(_selectedPinnedId) : -1;
  const hasSelection = idx >= 0;

  upBtn.disabled   = !hasSelection || idx === 0;
  downBtn.disabled = !hasSelection || idx === pinned.length - 1;
}

document.getElementById('tasksMoveUp').addEventListener('click', () => _moveSelected(-1));
document.getElementById('tasksMoveDown').addEventListener('click', () => _moveSelected(1));

function _moveSelected(dir) {
  if (!_selectedPinnedId) return;
  const pinned = [...(ui.pinnedTabs ?? [])];
  const idx    = pinned.indexOf(_selectedPinnedId);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= pinned.length) return;
  pinned.splice(idx, 1);
  pinned.splice(newIdx, 0, _selectedPinnedId);
  ui.pinnedTabs = pinned;
  saveUiState();
  renderTabBar();
  renderTasks();
}

function togglePin(taskId) {
  const pinned = [...(ui.pinnedTabs ?? ['snippets', 'linear', 'files', 'chat'])];
  const idx    = pinned.indexOf(taskId);

  if (idx >= 0) {
    pinned.splice(idx, 1);
  } else {
    if (pinned.length >= 5) {
      showToast('Max 5 pinned — unpin one first');
      return;
    }
    pinned.push(taskId);
  }

  ui.pinnedTabs = pinned;
  saveUiState();
  renderTabBar();
  renderTasks();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

(async () => {
  await Promise.all([loadData(), loadUiState()]);

  // Restore snippets UI state
  state.snippets.expandedFolders = new Set(ui.expandedFolders ?? []);
  state.snippets.searchQuery     = ui.searchQuery ?? '';

  // Build tab bar, then restore last tab (default to snippets if not set)
  renderTabBar();
  switchTab(ui.activeTab ?? 'snippets');

  // Restore search input text
  const searchEl = document.getElementById('searchInput');
  if (searchEl && ui.searchQuery) {
    searchEl.value = ui.searchQuery;
    document.getElementById('searchClear').style.display = 'block';
  }
})();
