'use strict';

// ─── To-Do view ───────────────────────────────────────────────────────────────

let _expandedTodoId = null;
let _focusMode = false;

function renderTodo() {
  _renderList();
}

// ── Render ────────────────────────────────────────────────────────────────────

function _renderList() {
  const allTodos = state.data.todos ?? [];
  const todos    = _focusMode ? allTodos.filter((t) => t.focus) : allTodos;
  const list     = document.getElementById('todoList');
  const footer   = document.getElementById('todoFooter');
  const stats    = document.getElementById('todoStats');

  // Sync focus button state
  const focusBtn = document.getElementById('todoFocusBtn');
  if (focusBtn) focusBtn.classList.toggle('is-active', _focusMode);

  const total   = todos.length;
  const done    = todos.filter((t) => t.done).length;
  const pending = total - done;

  if (!total) {
    list.innerHTML = `
      <div class="todo-empty">
        <div class="todo-empty-icon">✓</div>
        Nothing here yet — add a task above
      </div>`;
    footer.style.display = 'none';
    return;
  }

  list.innerHTML = todos.map((todo, idx) => {
    const isFirst    = idx === 0;
    const isLast     = idx === todos.length - 1;
    const isExpanded = _expandedTodoId === todo.id;
    const urls       = _getUrls(todo);
    const hasContext = todo.notes || urls.length > 0;

    const linkUrl = urls[0] || (_isUrl(todo.text) ? todo.text : null);
    const label   = linkUrl
      ? `<a class="todo-link" href="${esc(linkUrl)}" target="_blank" rel="noopener">${esc(todo.text)}</a>`
      : `<span class="todo-text">${esc(todo.text)}</span>`;

    const urlRows = (urls.length ? urls : ['']).map((u) => `
      <div class="todo-url-row">
        <input class="todo-detail-url" type="url" placeholder="https://link…" value="${esc(u)}">
        <button class="todo-url-remove-btn" type="button" title="Remove link">×</button>
      </div>`).join('');

    const detailPanel = isExpanded ? `
      <div class="todo-detail">
        <textarea class="todo-detail-notes" placeholder="Notes, context…">${esc(todo.notes || '')}</textarea>
        <div class="todo-url-list">${urlRows}</div>
        <button class="todo-url-add-btn" type="button">+ add link</button>
        <div class="todo-detail-actions">
          <button class="btn-cancel todo-detail-cancel" data-id="${esc(todo.id)}">Cancel</button>
          <button class="btn-save todo-detail-save" data-id="${esc(todo.id)}">Save</button>
        </div>
      </div>` : '';

    return `
    <div class="todo-item${todo.done ? ' done' : ''}${isExpanded ? ' is-expanded' : ''}" data-id="${esc(todo.id)}">
      <div class="todo-row">
        <div class="todo-check" data-id="${esc(todo.id)}" title="${todo.done ? 'Mark incomplete' : 'Mark done'}">
          <svg class="todo-check-mark" viewBox="0 0 10 10" fill="none" width="9" height="9">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        ${label}
        <div class="todo-reorder-btns">
          <button class="todo-reorder-btn" data-id="${esc(todo.id)}" data-dir="up" title="Move up"${isFirst ? ' disabled' : ''}>
            <svg viewBox="0 0 10 10" fill="none" width="8" height="8">
              <path d="M2 6.5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="todo-reorder-btn" data-id="${esc(todo.id)}" data-dir="down" title="Move down"${isLast ? ' disabled' : ''}>
            <svg viewBox="0 0 10 10" fill="none" width="8" height="8">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <button class="todo-focus-mark${todo.focus ? ' is-focused' : ''}" data-id="${esc(todo.id)}" title="${todo.focus ? 'Remove from focus' : 'Add to focus'}">
          <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="6" cy="6" r="1.8" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="6" cy="6" r="0.7" fill="currentColor"/>
          </svg>
        </button>
        <button class="todo-expand-btn${isExpanded ? ' is-open' : ''}${hasContext ? ' has-context' : ''}" data-id="${esc(todo.id)}" title="Add context">
          <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
            <path d="M2 4.5h8M2 7.5h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="10" cy="7.5" r="1.5" fill="currentColor"/>
          </svg>
        </button>
        <button class="todo-delete-btn" data-id="${esc(todo.id)}" title="Delete">
          <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      ${detailPanel}
    </div>`;
  }).join('');

  // Toggle done
  list.querySelectorAll('.todo-check').forEach((el) => {
    el.addEventListener('click', () => _toggleDone(el.dataset.id));
  });

  // Double-click to rename
  list.querySelectorAll('.todo-text, .todo-link').forEach((el) => {
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const id   = el.closest('.todo-item').dataset.id;
      const todo = state.data.todos.find((t) => t.id === id);
      if (!todo) return;

      const input = document.createElement('input');
      input.className = 'todo-rename-input';
      input.value = todo.text;
      el.replaceWith(input);
      input.focus();
      input.select();

      let committed = false;

      const commit = async () => {
        if (committed) return;
        committed = true;
        const val = input.value.trim();
        if (val && val !== todo.text) {
          todo.text = val;
          await saveData();
        }
        _renderList();
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { committed = true; _renderList(); }
      });
      input.addEventListener('blur', commit);
    });
  });

  // Reorder
  list.querySelectorAll('.todo-reorder-btn').forEach((btn) => {
    btn.addEventListener('click', () => _moveTodo(btn.dataset.id, btn.dataset.dir));
  });

  // Focus mark
  list.querySelectorAll('.todo-focus-mark').forEach((btn) => {
    btn.addEventListener('click', () => _toggleFocusMark(btn.dataset.id));
  });

  // Expand/collapse detail
  list.querySelectorAll('.todo-expand-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      _expandedTodoId = _expandedTodoId === btn.dataset.id ? null : btn.dataset.id;
      _renderList();
    });
  });

  // Auto-expand notes textarea
  list.querySelectorAll('.todo-detail-notes').forEach((ta) => {
    const resize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    resize();
    ta.addEventListener('input', resize);
  });

  // Add link row
  list.querySelectorAll('.todo-url-add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'todo-url-row';
      row.innerHTML = `<input class="todo-detail-url" type="url" placeholder="https://link…"><button class="todo-url-remove-btn" type="button" title="Remove link">×</button>`;
      btn.previousElementSibling.appendChild(row);
      row.querySelector('input').focus();
      row.querySelector('.todo-url-remove-btn').addEventListener('click', () => row.remove());
    });
  });

  // Remove link row
  list.querySelectorAll('.todo-url-remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.todo-url-row').remove());
  });

  // Detail save
  list.querySelectorAll('.todo-detail-save').forEach((btn) => {
    btn.addEventListener('click', () => _saveDetail(btn.dataset.id));
  });

  // Detail cancel
  list.querySelectorAll('.todo-detail-cancel').forEach((btn) => {
    btn.addEventListener('click', () => {
      _expandedTodoId = null;
      _renderList();
    });
  });

  // Delete
  list.querySelectorAll('.todo-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => _deleteTodo(btn.dataset.id));
  });

  // Footer
  footer.style.display = done > 0 ? 'flex' : 'none';
  stats.textContent = pending
    ? `${pending} remaining${done ? `, ${done} done` : ''}`
    : `All ${done} done!`;
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function _addTodo(text, url = null) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const todo = { id: uid(), text: trimmed, done: false, createdAt: Date.now() };
  if (url) todo.urls = [url];
  state.data.todos.push(todo);
  await saveData();
  _renderList();
}

function _getUrls(todo) {
  if (todo.urls?.length) return todo.urls;
  if (todo.url) return [todo.url];
  return [];
}

async function _saveDetail(id) {
  const todo = state.data.todos.find((t) => t.id === id);
  if (!todo) return;

  const item  = document.querySelector(`.todo-item[data-id="${id}"]`);
  const notes = item?.querySelector('.todo-detail-notes')?.value.trim() ?? '';
  const urls  = [...(item?.querySelectorAll('.todo-detail-url') ?? [])]
    .map((i) => i.value.trim()).filter(Boolean);

  todo.notes = notes || undefined;
  todo.urls  = urls.length ? urls : undefined;
  delete todo.url; // migrate legacy field

  await saveData();
  showToast('Saved');
}

async function _toggleDone(id) {
  const todo = state.data.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.done = !todo.done;
  await saveData();
  _renderList();
}

async function _deleteTodo(id) {
  state.data.todos = state.data.todos.filter((t) => t.id !== id);
  await saveData();
  _renderList();
}

async function _moveTodo(id, dir) {
  const todos = state.data.todos;
  const idx   = todos.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const swap  = dir === 'up' ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= todos.length) return;
  [todos[idx], todos[swap]] = [todos[swap], todos[idx]];
  await saveData();
  _renderList();
}

async function _clearDone() {
  state.data.todos = state.data.todos.filter((t) => !t.done);
  await saveData();
  _renderList();
}

async function _toggleFocusMark(id) {
  const todo = state.data.todos.find((t) => t.id === id);
  if (!todo) return;
  if (todo.focus) { delete todo.focus; } else { todo.focus = true; }
  await saveData();
  _renderList();
}

// ── Input handlers ────────────────────────────────────────────────────────────

// Tracks the URL behind the current input value (set on paste, cleared on submit)
let _pendingUrl = null;

function _submitInput() {
  const input = document.getElementById('todoInput');
  _addTodo(input.value, _pendingUrl);
  input.value  = '';
  _pendingUrl  = null;
  input.focus();
}

document.getElementById('todoAddBtn').addEventListener('click', _submitInput);

document.getElementById('todoInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') _submitInput();
});

document.getElementById('todoInput').addEventListener('input', () => {
  // Clear the stored URL if the user edits the field manually
  _pendingUrl = null;
});

document.getElementById('todoInput').addEventListener('paste', async (e) => {
  const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
  if (!_isUrl(pasted)) return;

  await new Promise((r) => setTimeout(r, 0));
  const input = document.getElementById('todoInput');
  if (input.value.trim() !== pasted) return; // user had other text — don't override

  input.disabled    = true;
  input.value       = '';
  input.placeholder = 'Fetching title…';

  try {
    const title = await _fetchPageTitle(pasted);
    input.value = title || pasted;
    _pendingUrl = pasted; // remember the source URL
  } catch {
    input.value = pasted;
  }

  input.disabled    = false;
  input.placeholder = 'Add a task…';
  input.focus();
});

document.getElementById('todoClearDone').addEventListener('click', _clearDone);

document.getElementById('todoFocusBtn').addEventListener('click', () => {
  _focusMode = !_focusMode;
  _renderList();
});

// ── URL title fetching ────────────────────────────────────────────────────────

function _isUrl(str) {
  try { return ['http:', 'https:'].includes(new URL(str).protocol); } catch { return false; }
}

async function _fetchPageTitle(url) {
  // YouTube: use oEmbed for clean titles
  if (/youtube\.com|youtu\.be/.test(url)) {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (res.ok) {
      const data = await res.json();
      return data.title ?? null;
    }
  }

  // General: fetch HTML and extract <title>
  const res = await fetch(url);
  if (!res.ok) return null;
  const html  = await res.text();
  const match = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  if (!match) return null;
  return match[1]
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"') || null;
}
