'use strict';

// ─── To-Do view ───────────────────────────────────────────────────────────────

function renderTodo() {
  _renderList();
}

// ── Render ────────────────────────────────────────────────────────────────────

function _renderList() {
  const todos   = state.data.todos ?? [];
  const list    = document.getElementById('todoList');
  const footer  = document.getElementById('todoFooter');
  const stats   = document.getElementById('todoStats');

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
    const linkUrl = todo.url || (_isUrl(todo.text) ? todo.text : null);
    const label   = linkUrl
      ? `<a class="todo-link" href="${esc(linkUrl)}" target="_blank" rel="noopener">${esc(todo.text)}</a>`
      : `<span class="todo-text">${esc(todo.text)}</span>`;
    const isFirst = idx === 0;
    const isLast  = idx === todos.length - 1;
    return `
    <div class="todo-item${todo.done ? ' done' : ''}" data-id="${esc(todo.id)}">
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
      <button class="todo-pin-btn" data-id="${esc(todo.id)}" title="Float on desktop">
        <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
          <path d="M9 1L11 3L7.5 5.5V8L4.5 5L7 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.5 5L1.5 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="todo-delete-btn" data-id="${esc(todo.id)}" title="Delete">
        <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
          <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>`;
  }).join('');

  // Toggle done
  list.querySelectorAll('.todo-check').forEach((el) => {
    el.addEventListener('click', () => _toggleDone(el.dataset.id));
  });

  // Reorder
  list.querySelectorAll('.todo-reorder-btn').forEach((btn) => {
    btn.addEventListener('click', () => _moveTodo(btn.dataset.id, btn.dataset.dir));
  });

  // Pin to desktop
  list.querySelectorAll('.todo-pin-btn').forEach((btn) => {
    btn.addEventListener('click', () => _pinTodo(btn.dataset.id));
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
  if (url) todo.url = url;
  state.data.todos.push(todo);
  await saveData();
  _renderList();
}

function _pinTodo(id) {
  const todo = state.data.todos.find((t) => t.id === id);
  if (!todo) return;

  const params = new URLSearchParams({ text: todo.text });
  if (todo.url) params.set('href', todo.url);
  const url = chrome.runtime.getURL('pinned.html') + '?' + params.toString();

  chrome.windows.create({
    url,
    type:        'popup',
    alwaysOnTop: true,
    width:       300,
    height:      92,           // includes ~28px Chrome title bar on macOS
    left:        Math.round((screen.width  - 300) / 2),
    top:         Math.round(screen.height * 0.12), // ~12% from top, clear of menu bar
    focused:     false,
  });
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
