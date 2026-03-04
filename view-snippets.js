'use strict';

// ─── Snippets view ────────────────────────────────────────────────────────────

const ICON_COPY = `<svg viewBox="0 0 16 16" fill="none"><rect x="5.5" y="1.5" width="7" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 3.5H3.5a1 1 0 00-1 1v9a1 1 0 001 1h7a1 1 0 001-1V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Folders (manually ordered) at top; loose snippets (alpha) below.
// Drag & drop: folders reorder among themselves; loose snippets reorder or
// drop INTO a folder (highlighted with outline).

// ── Render ────────────────────────────────────────────────────────────────────

function renderSnippets() {
  _renderAddFolderBanner();
  _renderAddLooseBanner();
  _renderAddGridBanner();
  _renderSaveTabsBanner();
  _renderLoadTabsBanner();
  _renderContent();
}

function _renderAddFolderBanner() {
  const banner = document.getElementById('addFolderBanner');
  banner.classList.toggle('visible', state.snippets.showAddFolder);
}

function _renderAddLooseBanner() {
  const banner = document.getElementById('addLooseBanner');
  banner.classList.toggle('visible', state.snippets.showAddLoose);
}

function _renderAddGridBanner() {
  const banner = document.getElementById('addGridBanner');
  banner.classList.toggle('visible', state.snippets.showAddGrid);
  if (state.snippets.showAddGrid && state.snippets.gridFormState) {
    _renderGridEditor(state.snippets.gridFormState.headers, state.snippets.gridFormState.rows);
    setTimeout(() => document.getElementById('gridTitle')?.focus(), 30);
  }
}

function _gridEditorHtml(headers, rows) {
  let html = `<table class="grid-editor-table"><thead><tr>`;
  headers.forEach((h, i) => {
    html += `<th><input class="grid-header-input" data-col="${i}" value="${esc(h)}" placeholder="Header ${i + 1}"></th>`;
  });
  html += `</tr></thead><tbody>`;
  rows.forEach((row) => {
    html += `<tr>`;
    row.forEach((cell, ci) => {
      html += `<td><input class="grid-cell-input" data-col="${ci}" value="${esc(cell)}"></td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function _renderGridEditor(headers, rows) {
  const wrap = document.getElementById('gridEditorWrap');
  if (wrap) wrap.innerHTML = _gridEditorHtml(headers, rows);
}

function _scrapeGridEditor() {
  const headers = [...document.querySelectorAll('#gridEditorWrap .grid-header-input')].map((i) => i.value);
  const rows = [...document.querySelectorAll('#gridEditorWrap tbody tr')].map((tr) =>
    [...tr.querySelectorAll('.grid-cell-input')].map((i) => i.value)
  );
  return { headers, rows };
}

function _copyGridAsTSV(grid) {
  const lines = [grid.headers.join('\t'), ...grid.rows.map((r) => r.join('\t'))];
  return lines.join('\n');
}

function _gridTableHtml(s) {
  let html = `<table class="grid-table-view"><thead><tr>`;
  s.headers.forEach((h) => { html += `<th>${esc(h) || '&nbsp;'}</th>`; });
  html += `</tr></thead><tbody>`;
  s.rows.slice(0, 3).forEach((row) => {
    html += `<tr>`;
    row.forEach((cell) => { html += `<td>${esc(cell) || '&nbsp;'}</td>`; });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function _renderContent() {
  const el = document.getElementById('snippetsContent');
  const q  = state.snippets.searchQuery.trim().toLowerCase();

  const folders = _filteredFolders(q);
  const loose   = _filteredLoose(q);

  if (!state.data.folders.length && !state.data.looseSnippets.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◈</div>
        <h3>Nothing here yet</h3>
        <p>Add a <strong>Folder</strong> to group snippets,<br>or a loose <strong>Snippet</strong> for quick access.</p>
      </div>`;
    return;
  }

  if (!folders.length && !loose.length && q) {
    el.innerHTML = `<div class="no-results">No results for "<strong>${esc(q)}</strong>"</div>`;
    return;
  }

  let html = '';

  // ── Folders section ──
  if (folders.length) {
    html += `<div id="foldersList">`;
    folders.forEach((folder, idx) => {
      html += _folderHtml(folder, idx, q);
    });
    html += `</div>`;
  }

  // ── Loose snippets section ──
  if (loose.length) {
    html += `<div class="section-label">Loose snippets</div>`;
    html += `<div id="looseList">`;
    loose.forEach((s, idx) => {
      html += _looseSnippetHtml(s, idx, q);
    });
    html += `</div>`;
  }

  el.innerHTML = html;
  _attachDragDrop();
  _focusActiveForm();
}

// ── Folder HTML ───────────────────────────────────────────────────────────────

function _folderHtml(folder, idx, q) {
  const isOpen  = state.snippets.expandedFolders.has(folder.id) || !!q;
  const editingFolder  = state.snippets.activeForm?.type === 'editFolder'  && state.snippets.activeForm.folderId  === folder.id;
  const addingSnippet  = state.snippets.activeForm?.type === 'addSnippet'  && state.snippets.activeForm.folderId  === folder.id;
  const addingGrid     = state.snippets.activeForm?.type === 'addGrid'     && state.snippets.activeForm.folderId  === folder.id;

  let html = `<div class="drop-indicator" data-drop-index="${idx}" data-drop-target="folder"></div>`;
  html += `<div class="folder${isOpen ? ' is-open' : ''}" data-folder-id="${folder.id}" draggable="true">`;

  if (editingFolder) {
    html += `
      <div class="inline-form" style="margin:8px">
        <div class="form-field">
          <label class="form-label">Folder Name</label>
          <input class="form-input" id="editFolderInput" value="${esc(folder.name)}" maxlength="50">
        </div>
        <div class="form-actions">
          <button class="btn-cancel" data-action="cancelForm">Cancel</button>
          <button class="btn-save"   data-action="saveEditFolder" data-folder-id="${folder.id}">Save</button>
        </div>
      </div>`;
  } else {
    html += `
      <div class="folder-header" data-action="toggleFolder" data-folder-id="${folder.id}">
        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
        <svg class="folder-chevron" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="folder-tab"></div>
        <span class="folder-name">${highlight(folder.name, q)}</span>
        <span class="folder-count">${folder.snippets.length}</span>
        <div class="folder-actions">
          <button class="icon-btn" data-action="startAddSnippet"  data-folder-id="${folder.id}" title="Add snippet">+</button>
          <button class="icon-btn" data-action="startEditFolder"  data-folder-id="${folder.id}" title="Rename">✎</button>
          <button class="icon-btn danger" data-action="deleteFolder" data-folder-id="${folder.id}" title="Delete">✕</button>
        </div>
      </div>`;
  }

  html += `<div class="folder-body">`;

  if (folder.snippets.length) {
    html += `<div class="snippet-list">`;
    folder.snippets.forEach((s) => {
      if (s.type === 'grid') {
        const editing = state.snippets.activeForm?.type === 'editGrid' && state.snippets.activeForm.snippetId === s.id;
        html += editing ? _editGridFormHtml(s, folder.id) : _gridSnippetHtml(s, folder.id, q);
      } else {
        const editing = state.snippets.activeForm?.type === 'editSnippet' && state.snippets.activeForm.snippetId === s.id;
        html += editing ? _editSnippetFormHtml(s, folder.id) : _snippetRowHtml(s, folder.id, q);
      }
    });
    html += `</div>`;
  } else if (!addingSnippet && !addingGrid) {
    html += `<div class="snippet-empty">No snippets yet</div>`;
  }

  if (addingSnippet) {
    html += _addSnippetFormHtml(folder.id);
  } else if (addingGrid) {
    html += _addGridFormHtml(folder.id);
  } else if (!q) {
    html += `<button class="add-snippet-btn" data-action="startAddSnippet" data-folder-id="${folder.id}">+ Add snippet</button>`;
    html += `<button class="add-snippet-btn" data-action="startAddGridInFolder" data-folder-id="${folder.id}">+ Add grid</button>`;
  }

  html += `</div></div>`; // .folder-body .folder
  return html;
}

// After last folder
function _folderTrailingIndicator(total) {
  return `<div class="drop-indicator" data-drop-index="${total}" data-drop-target="folder"></div>`;
}

function _looseSnippetHtml(s, idx, q) {
  if (s.type === 'grid') return _looseGridHtml(s, idx, q);
  const preview = s.content.slice(0, 80).replace(/\n/g, ' ');
  const editing = state.snippets.activeForm?.type === 'editLoose' && state.snippets.activeForm.snippetId === s.id;

  let html = `<div class="drop-indicator" data-drop-index="${idx}" data-drop-target="loose"></div>`;

  if (editing) {
    html += `
      <div class="loose-snippet" data-loose-id="${s.id}">
        <div style="flex:1">
          <div class="inline-form" style="margin:0">
            <div class="form-field">
              <label class="form-label">Title</label>
              <input class="form-input" id="editLooseTitle" value="${esc(s.title)}" maxlength="80">
            </div>
            <div class="form-field">
              <label class="form-label">Content</label>
              <textarea class="form-textarea" id="editLooseContent" rows="3">${esc(s.content)}</textarea>
            </div>
            <div class="form-actions">
              <button class="btn-cancel" data-action="cancelForm">Cancel</button>
              <button class="btn-save" data-action="saveEditLoose" data-loose-id="${s.id}">Save</button>
            </div>
          </div>
        </div>
      </div>`;
  } else {
    html += `
      <div class="loose-snippet" data-loose-id="${s.id}" draggable="true">
        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
        <div class="snippet-text">
          <div class="snippet-title">${highlight(s.title, q)}</div>
          <div class="snippet-preview">${highlight(preview, q)}</div>
        </div>
        <div class="snippet-actions">
          <button class="copy-btn" data-action="copyLoose" data-loose-id="${s.id}" title="Copy">${ICON_COPY}</button>
          <button class="icon-btn" data-action="startEditLoose"  data-loose-id="${s.id}" title="Edit">✎</button>
          <button class="icon-btn danger" data-action="deleteLoose" data-loose-id="${s.id}" title="Delete">✕</button>
        </div>
      </div>`;
  }
  return html;
}

function _snippetRowHtml(s, folderId, q) {
  const preview = s.content.slice(0, 80).replace(/\n/g, ' ');
  return `
    <div class="snippet" data-snippet-id="${s.id}" data-folder-id="${folderId}">
      <div class="snippet-text">
        <div class="snippet-title">${highlight(s.title, q)}</div>
        <div class="snippet-preview">${highlight(preview, q)}</div>
      </div>
      <div class="snippet-actions">
        <button class="copy-btn" data-action="copySnippet" data-folder-id="${folderId}" data-snippet-id="${s.id}" title="Copy">${ICON_COPY}</button>
        <button class="icon-btn"        data-action="startEditSnippet"  data-folder-id="${folderId}" data-snippet-id="${s.id}" title="Edit">✎</button>
        <button class="icon-btn danger" data-action="deleteSnippet"     data-folder-id="${folderId}" data-snippet-id="${s.id}" title="Delete">✕</button>
      </div>
    </div>`;
}

function _editSnippetFormHtml(s, folderId) {
  return `
    <div class="inline-form">
      <div class="form-field">
        <label class="form-label">Title</label>
        <input class="form-input" id="editSnippetTitle" value="${esc(s.title)}" maxlength="80">
      </div>
      <div class="form-field">
        <label class="form-label">Content</label>
        <textarea class="form-textarea" id="editSnippetContent" rows="4">${esc(s.content)}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" data-action="cancelForm">Cancel</button>
        <button class="btn-save" data-action="saveEditSnippet" data-folder-id="${folderId}" data-snippet-id="${s.id}">Save</button>
      </div>
    </div>`;
}

function _addSnippetFormHtml(folderId) {
  return `
    <div class="inline-form" style="margin:8px">
      <div class="form-field">
        <label class="form-label">Title</label>
        <input class="form-input" id="newSnippetTitle" placeholder="e.g. Introduction email" maxlength="80">
      </div>
      <div class="form-field">
        <label class="form-label">Content</label>
        <textarea class="form-textarea" id="newSnippetContent" placeholder="Paste your snippet text here…" rows="4"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" data-action="cancelForm">Cancel</button>
        <button class="btn-save" data-action="saveNewSnippet" data-folder-id="${folderId}">Save</button>
      </div>
    </div>`;
}

function _gridSnippetHtml(s, folderId, q) {
  return `
    <div class="snippet" data-snippet-id="${s.id}" data-folder-id="${folderId}">
      <div class="snippet-text">
        <div class="snippet-title">${highlight(s.title, q)}</div>
        <div class="grid-preview">${_gridTableHtml(s)}</div>
      </div>
      <div class="snippet-actions">
        <button class="copy-btn" data-action="copyGrid" data-folder-id="${folderId}" data-snippet-id="${s.id}" title="Copy as TSV">${ICON_COPY}</button>
        <button class="icon-btn" data-action="startEditGrid" data-folder-id="${folderId}" data-snippet-id="${s.id}" title="Edit">✎</button>
        <button class="icon-btn danger" data-action="deleteSnippet" data-folder-id="${folderId}" data-snippet-id="${s.id}" title="Delete">✕</button>
      </div>
    </div>`;
}

function _looseGridHtml(s, idx, q) {
  const editing = state.snippets.activeForm?.type === 'editLooseGrid' && state.snippets.activeForm.snippetId === s.id;
  let html = `<div class="drop-indicator" data-drop-index="${idx}" data-drop-target="loose"></div>`;
  if (editing) {
    html += `
      <div class="loose-snippet" data-loose-id="${s.id}">
        <div style="flex:1">
          <div class="inline-form" style="margin:0">
            <div class="form-field">
              <label class="form-label">Grid Title</label>
              <input class="form-input" id="gridTitle" value="${esc(s.title)}" maxlength="80">
            </div>
            <div class="form-field">
              <label class="form-label">Grid</label>
              <div id="gridEditorWrap">${_gridEditorHtml(state.snippets.gridFormState?.headers ?? s.headers, state.snippets.gridFormState?.rows ?? s.rows)}</div>
            </div>
            <button class="add-row-btn" data-action="addGridRow" data-loose-id="${s.id}">+ Add Row</button>
            <div class="form-actions">
              <button class="btn-cancel" data-action="cancelForm">Cancel</button>
              <button class="btn-save" data-action="saveEditLooseGrid" data-loose-id="${s.id}">Save</button>
            </div>
          </div>
        </div>
      </div>`;
  } else {
    html += `
      <div class="loose-snippet" data-loose-id="${s.id}" draggable="true">
        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
        <div class="snippet-text">
          <div class="snippet-title">${highlight(s.title, q)}</div>
          <div class="grid-preview">${_gridTableHtml(s)}</div>
        </div>
        <div class="snippet-actions">
          <button class="copy-btn" data-action="copyLooseGrid" data-loose-id="${s.id}" title="Copy as TSV">${ICON_COPY}</button>
          <button class="icon-btn" data-action="startEditLooseGrid" data-loose-id="${s.id}" title="Edit">✎</button>
          <button class="icon-btn danger" data-action="deleteLoose" data-loose-id="${s.id}" title="Delete">✕</button>
        </div>
      </div>`;
  }
  return html;
}

function _addGridFormHtml(folderId) {
  const { headers, rows } = state.snippets.gridFormState;
  return `
    <div class="inline-form" style="margin:8px">
      <div class="form-field">
        <label class="form-label">Grid Title</label>
        <input class="form-input" id="gridTitle" placeholder="e.g. Sprint Goals" maxlength="80">
      </div>
      <div class="form-field">
        <label class="form-label">Grid</label>
        <div id="gridEditorWrap">${_gridEditorHtml(headers, rows)}</div>
      </div>
      <button class="add-row-btn" data-action="addGridRow" data-folder-id="${folderId}">+ Add Row</button>
      <div class="form-actions">
        <button class="btn-cancel" data-action="cancelForm">Cancel</button>
        <button class="btn-save" data-action="saveNewGridInFolder" data-folder-id="${folderId}">Save</button>
      </div>
    </div>`;
}

function _editGridFormHtml(s, folderId) {
  return `
    <div class="inline-form">
      <div class="form-field">
        <label class="form-label">Grid Title</label>
        <input class="form-input" id="gridTitle" value="${esc(s.title)}" maxlength="80">
      </div>
      <div class="form-field">
        <label class="form-label">Grid</label>
        <div id="gridEditorWrap">${_gridEditorHtml(state.snippets.gridFormState?.headers ?? s.headers, state.snippets.gridFormState?.rows ?? s.rows)}</div>
      </div>
      <button class="add-row-btn" data-action="addGridRow" data-folder-id="${folderId}" data-snippet-id="${s.id}">+ Add Row</button>
      <div class="form-actions">
        <button class="btn-cancel" data-action="cancelForm">Cancel</button>
        <button class="btn-save" data-action="saveEditGrid" data-folder-id="${folderId}" data-snippet-id="${s.id}">Save</button>
      </div>
    </div>`;
}

function _focusActiveForm() {
  const { activeForm } = state.snippets;
  if (!activeForm) return;
  const map = {
    addSnippet:    'newSnippetTitle',
    editSnippet:   'editSnippetTitle',
    editFolder:    'editFolderInput',
    editLoose:     'editLooseTitle',
    addGrid:       'gridTitle',
    editGrid:      'gridTitle',
    editLooseGrid: 'gridTitle',
  };
  setTimeout(() => {
    const el = document.getElementById(map[activeForm.type]);
    if (!el) return;
    el.focus();
    if (activeForm.type === 'editFolder') el.select();
  }, 30);
}

// ── Filtered data ─────────────────────────────────────────────────────────────

function _filteredFolders(q) {
  const sorted = [...state.data.folders].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!q) return sorted;
  return sorted.map((f) => {
    const nameMatch = f.name.toLowerCase().includes(q);
    const snippets  = f.snippets.filter((s) => {
      if (s.title.toLowerCase().includes(q)) return true;
      if (s.type === 'grid') {
        return s.headers.some((h) => h.toLowerCase().includes(q)) ||
               s.rows.some((r) => r.some((c) => c.toLowerCase().includes(q)));
      }
      return (s.content || '').toLowerCase().includes(q);
    });
    if (nameMatch || snippets.length) return { ...f, snippets: nameMatch ? f.snippets : snippets };
    return null;
  }).filter(Boolean);
}

function _filteredLoose(q) {
  const sorted = [...state.data.looseSnippets].sort((a, b) => a.title.localeCompare(b.title));
  if (!q) return sorted;
  return sorted.filter((s) => {
    if (s.title.toLowerCase().includes(q)) return true;
    if (s.type === 'grid') {
      return s.headers.some((h) => h.toLowerCase().includes(q)) ||
             s.rows.some((r) => r.some((c) => c.toLowerCase().includes(q)));
    }
    return (s.content || '').toLowerCase().includes(q);
  });
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function handleSnippetAction(action, el) {
  const folderId  = el.dataset.folderId;
  const snippetId = el.dataset.snippetId;
  const looseId   = el.dataset.looseId;

  switch (action) {

    case 'toggleFolder': {
      const id = folderId;
      if (state.snippets.expandedFolders.has(id)) {
        state.snippets.expandedFolders.delete(id);
        if (state.snippets.activeForm?.folderId === id) state.snippets.activeForm = null;
      } else {
        state.snippets.expandedFolders.add(id);
      }
      ui.expandedFolders = [...state.snippets.expandedFolders];
      saveUiState();
      _renderContent();
      break;
    }

    case 'copySnippet': {
      const folder  = state.data.folders.find((f) => f.id === folderId);
      const snippet = folder?.snippets.find((s) => s.id === snippetId);
      if (!snippet) break;
      await _copy(snippet.content, el);
      break;
    }

    case 'copyLoose': {
      const s = state.data.looseSnippets.find((x) => x.id === looseId);
      if (!s) break;
      await _copy(s.content, el);
      break;
    }

    case 'startAddSnippet': {
      state.snippets.expandedFolders.add(folderId);
      state.snippets.activeForm = { type: 'addSnippet', folderId };
      _renderContent();
      break;
    }

    case 'saveNewSnippet': {
      const title   = document.getElementById('newSnippetTitle')?.value.trim();
      const content = document.getElementById('newSnippetContent')?.value.trim();
      if (!title || !content) { showToast('Fill in both fields'); return; }
      const folder = state.data.folders.find((f) => f.id === folderId);
      if (folder) {
        folder.snippets.push({ id: uid(), title, content });
        await saveData();
        state.snippets.activeForm = null;
        _renderContent();
        showToast('Snippet saved');
      }
      break;
    }

    case 'startEditSnippet': {
      state.snippets.expandedFolders.add(folderId);
      state.snippets.activeForm = { type: 'editSnippet', folderId, snippetId };
      _renderContent();
      break;
    }

    case 'saveEditSnippet': {
      const title   = document.getElementById('editSnippetTitle')?.value.trim();
      const content = document.getElementById('editSnippetContent')?.value.trim();
      if (!title || !content) { showToast('Fill in both fields'); return; }
      const folder  = state.data.folders.find((f) => f.id === folderId);
      const snippet = folder?.snippets.find((s) => s.id === snippetId);
      if (snippet) {
        snippet.title = title; snippet.content = content;
        await saveData();
        state.snippets.activeForm = null;
        _renderContent();
        showToast('Snippet updated');
      }
      break;
    }

    case 'deleteSnippet': {
      const folder  = state.data.folders.find((f) => f.id === folderId);
      const snippet = folder?.snippets.find((s) => s.id === snippetId);
      if (!snippet || !confirm(`Delete "${snippet.title}"?`)) break;
      folder.snippets = folder.snippets.filter((s) => s.id !== snippetId);
      await saveData();
      if (state.snippets.activeForm?.snippetId === snippetId) state.snippets.activeForm = null;
      _renderContent();
      break;
    }

    case 'startEditFolder': {
      state.snippets.expandedFolders.add(folderId);
      state.snippets.activeForm = { type: 'editFolder', folderId };
      _renderContent();
      break;
    }

    case 'saveEditFolder': {
      const name = document.getElementById('editFolderInput')?.value.trim();
      if (!name) { showToast('Enter a folder name'); return; }
      const folder = state.data.folders.find((f) => f.id === folderId);
      if (folder) { folder.name = name; await saveData(); state.snippets.activeForm = null; _renderContent(); }
      break;
    }

    case 'deleteFolder': {
      const folder = state.data.folders.find((f) => f.id === folderId);
      if (!folder) break;
      const msg = folder.snippets.length
        ? `Delete "${folder.name}" and its ${folder.snippets.length} snippet(s)?`
        : `Delete folder "${folder.name}"?`;
      if (!confirm(msg)) break;
      state.data.folders = state.data.folders.filter((f) => f.id !== folderId);
      state.snippets.expandedFolders.delete(folderId);
      if (state.snippets.activeForm?.folderId === folderId) state.snippets.activeForm = null;
      await saveData();
      _renderContent();
      break;
    }

    case 'startEditLoose': {
      state.snippets.activeForm = { type: 'editLoose', snippetId: looseId };
      _renderContent();
      break;
    }

    case 'saveEditLoose': {
      const title   = document.getElementById('editLooseTitle')?.value.trim();
      const content = document.getElementById('editLooseContent')?.value.trim();
      if (!title || !content) { showToast('Fill in both fields'); return; }
      const s = state.data.looseSnippets.find((x) => x.id === looseId);
      if (s) { s.title = title; s.content = content; await saveData(); state.snippets.activeForm = null; _renderContent(); showToast('Snippet updated'); }
      break;
    }

    case 'deleteLoose': {
      const s = state.data.looseSnippets.find((x) => x.id === looseId);
      if (!s || !confirm(`Delete "${s.title}"?`)) break;
      state.data.looseSnippets = state.data.looseSnippets.filter((x) => x.id !== looseId);
      await saveData();
      if (state.snippets.activeForm?.snippetId === looseId) state.snippets.activeForm = null;
      _renderContent();
      break;
    }

    case 'cancelForm': {
      state.snippets.activeForm = null;
      state.snippets.gridFormState = null;
      _renderContent();
      break;
    }

    case 'addGridRow': {
      const { headers, rows } = _scrapeGridEditor();
      rows.push(new Array(headers.length).fill(''));
      if (state.snippets.gridFormState) {
        state.snippets.gridFormState.headers = headers;
        state.snippets.gridFormState.rows = rows;
      }
      _renderGridEditor(headers, rows);
      break;
    }

    case 'copyGrid': {
      const folder  = state.data.folders.find((f) => f.id === folderId);
      const snippet = folder?.snippets.find((s) => s.id === snippetId);
      if (!snippet) break;
      await _copy(_copyGridAsTSV(snippet), el);
      break;
    }

    case 'copyLooseGrid': {
      const s = state.data.looseSnippets.find((x) => x.id === looseId);
      if (!s) break;
      await _copy(_copyGridAsTSV(s), el);
      break;
    }

    case 'startAddGridInFolder': {
      state.snippets.showAddGrid = false;
      _renderAddGridBanner();
      state.snippets.expandedFolders.add(folderId);
      state.snippets.gridFormState = {
        headers: ['', '', ''],
        rows: [['','',''],['','',''],['','',''],['','',''],['','','']],
      };
      state.snippets.activeForm = { type: 'addGrid', folderId };
      _renderContent();
      break;
    }

    case 'saveNewGridInFolder': {
      const title = document.getElementById('gridTitle')?.value.trim();
      if (!title) { showToast('Enter a grid title'); return; }
      const { headers, rows } = _scrapeGridEditor();
      const folder = state.data.folders.find((f) => f.id === folderId);
      if (folder) {
        folder.snippets.push({ id: uid(), type: 'grid', title, headers, rows });
        await saveData();
        state.snippets.activeForm = null;
        state.snippets.gridFormState = null;
        _renderContent();
        showToast('Grid saved');
      }
      break;
    }

    case 'startEditGrid': {
      const folder  = state.data.folders.find((f) => f.id === folderId);
      const snippet = folder?.snippets.find((s) => s.id === snippetId);
      if (!snippet) break;
      state.snippets.showAddGrid = false;
      _renderAddGridBanner();
      state.snippets.expandedFolders.add(folderId);
      state.snippets.gridFormState = {
        headers: [...snippet.headers],
        rows: snippet.rows.map((r) => [...r]),
      };
      state.snippets.activeForm = { type: 'editGrid', folderId, snippetId };
      _renderContent();
      break;
    }

    case 'saveEditGrid': {
      const title = document.getElementById('gridTitle')?.value.trim();
      if (!title) { showToast('Enter a grid title'); return; }
      const { headers, rows } = _scrapeGridEditor();
      const folder  = state.data.folders.find((f) => f.id === folderId);
      const snippet = folder?.snippets.find((s) => s.id === snippetId);
      if (snippet) {
        snippet.title = title; snippet.headers = headers; snippet.rows = rows;
        state.snippets.gridFormState = { headers, rows };
        await saveData();
        showToast('Saved');
      }
      break;
    }

    case 'startEditLooseGrid': {
      const s = state.data.looseSnippets.find((x) => x.id === looseId);
      if (!s) break;
      state.snippets.showAddGrid = false;
      _renderAddGridBanner();
      state.snippets.gridFormState = {
        headers: [...s.headers],
        rows: s.rows.map((r) => [...r]),
      };
      state.snippets.activeForm = { type: 'editLooseGrid', snippetId: looseId };
      _renderContent();
      break;
    }

    case 'saveEditLooseGrid': {
      const title = document.getElementById('gridTitle')?.value.trim();
      if (!title) { showToast('Enter a grid title'); return; }
      const { headers, rows } = _scrapeGridEditor();
      const s = state.data.looseSnippets.find((x) => x.id === looseId);
      if (s) {
        s.title = title; s.headers = headers; s.rows = rows;
        state.snippets.gridFormState = { headers, rows };
        await saveData();
        showToast('Saved');
      }
      break;
    }
  }
}

async function _copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    btn.innerHTML = ICON_CHECK;
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = ICON_COPY; btn.classList.remove('copied'); }, 1600);
  } catch { showToast('Copy failed — try again'); }
}

// ── Event delegation ──────────────────────────────────────────────────────────

document.getElementById('snippetsContent').addEventListener('click', (e) => {
  if (e.target.matches('input, textarea')) return;
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();
  handleSnippetAction(el.dataset.action, el);
});

document.getElementById('snippetsContent').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.target.matches('textarea')) return;
  if (e.target.id === 'newSnippetTitle')  { document.getElementById('newSnippetContent')?.focus(); e.preventDefault(); }
  if (e.target.id === 'editFolderInput')  { document.querySelector('[data-action="saveEditFolder"]')?.click(); e.preventDefault(); }
  if (e.target.id === 'editLooseTitle')   { document.getElementById('editLooseContent')?.focus(); e.preventDefault(); }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (state.snippets.activeForm) {
    state.snippets.activeForm = null;
    state.snippets.gridFormState = null;
    _renderContent();
  }
  if (state.snippets.showAddGrid) {
    state.snippets.showAddGrid = false;
    state.snippets.gridFormState = null;
    _renderAddGridBanner();
  }
});

// ── Panel header buttons ──────────────────────────────────────────────────────

document.getElementById('btnAddFolder').addEventListener('click', () => {
  state.snippets.showAddFolder = !state.snippets.showAddFolder;
  if (state.snippets.showAddFolder) {
    state.snippets.showAddLoose  = false;
    state.snippets.showAddGrid   = false;
    state.snippets.showSaveTabs  = false;
    state.snippets.showLoadTabs  = false;
    _renderAddLooseBanner();
    _renderAddGridBanner();
    _renderSaveTabsBanner();
    _renderLoadTabsBanner();
  }
  _renderAddFolderBanner();
  if (state.snippets.showAddFolder) {
    document.getElementById('folderNameInput').value = '';
    document.getElementById('folderNameInput').focus();
  }
});

document.getElementById('btnAddLoose').addEventListener('click', () => {
  state.snippets.showAddLoose = !state.snippets.showAddLoose;
  if (state.snippets.showAddLoose) {
    state.snippets.showAddFolder = false;
    state.snippets.showAddGrid   = false;
    state.snippets.showSaveTabs  = false;
    state.snippets.showLoadTabs  = false;
    _renderAddFolderBanner();
    _renderAddGridBanner();
    _renderSaveTabsBanner();
    _renderLoadTabsBanner();
  }
  _renderAddLooseBanner();
  if (state.snippets.showAddLoose) {
    document.getElementById('looseTitle').value = '';
    document.getElementById('looseContent').value = '';
    document.getElementById('looseTitle').focus();
  }
});

document.getElementById('btnSaveFolder').addEventListener('click', async () => {
  const name = document.getElementById('folderNameInput').value.trim();
  if (!name) { showToast('Enter a folder name'); return; }
  const id = uid();
  const order = state.data.folders.length;
  state.data.folders.push({ id, name, order, snippets: [] });
  state.snippets.expandedFolders.add(id);
  await saveData();
  state.snippets.showAddFolder = false;
  _renderAddFolderBanner();
  _renderContent();
  showToast('Folder created');
});

document.getElementById('btnCancelFolder').addEventListener('click', () => {
  state.snippets.showAddFolder = false;
  _renderAddFolderBanner();
});

document.getElementById('folderNameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btnSaveFolder').click();
  if (e.key === 'Escape') document.getElementById('btnCancelFolder').click();
});

document.getElementById('btnSaveLoose').addEventListener('click', async () => {
  const title   = document.getElementById('looseTitle').value.trim();
  const content = document.getElementById('looseContent').value.trim();
  if (!title || !content) { showToast('Fill in both fields'); return; }
  state.data.looseSnippets.push({ id: uid(), title, content });
  await saveData();
  state.snippets.showAddLoose = false;
  _renderAddLooseBanner();
  _renderContent();
  showToast('Snippet saved');
});

document.getElementById('btnCancelLoose').addEventListener('click', () => {
  state.snippets.showAddLoose = false;
  _renderAddLooseBanner();
});

// ── Search ────────────────────────────────────────────────────────────────────

document.getElementById('searchInput').addEventListener('input', (e) => {
  state.snippets.searchQuery = e.target.value;
  ui.searchQuery = e.target.value;
  saveUiState();
  document.getElementById('searchClear').style.display = state.snippets.searchQuery ? 'block' : 'none';
  _renderContent();
});

document.getElementById('searchClear').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  state.snippets.searchQuery = '';
  ui.searchQuery = '';
  saveUiState();
  document.getElementById('searchClear').style.display = 'none';
  _renderContent();
});

// ── Save All Tabs ─────────────────────────────────────────────────────────────

function _renderSaveTabsBanner() {
  const banner = document.getElementById('saveTabsBanner');
  banner.classList.toggle('visible', state.snippets.showSaveTabs);
  if (!state.snippets.showSaveTabs) return;

  // Populate folder dropdown
  const sel = document.getElementById('saveTabsFolder');
  const sorted = [...state.data.folders].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sel.innerHTML = sorted.length
    ? sorted.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')
    : `<option value="">— no folders, will save as loose snippet —</option>`;

  // Pre-fill title with today's date
  const titleEl = document.getElementById('saveTabsTitle');
  if (!titleEl.value) {
    const d = new Date();
    titleEl.value = `Tabs – ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  titleEl.focus();
  titleEl.select();
}

document.getElementById('btnSaveTabs').addEventListener('click', () => {
  state.snippets.showSaveTabs = !state.snippets.showSaveTabs;
  if (state.snippets.showSaveTabs) {
    state.snippets.showAddFolder = false;
    state.snippets.showAddLoose  = false;
    state.snippets.showAddGrid   = false;
    state.snippets.showLoadTabs  = false;
    _renderAddFolderBanner();
    _renderAddLooseBanner();
    _renderAddGridBanner();
    _renderLoadTabsBanner();
  }
  _renderSaveTabsBanner();
});

document.getElementById('btnCancelSaveTabs').addEventListener('click', () => {
  state.snippets.showSaveTabs = false;
  document.getElementById('saveTabsTitle').value = '';
  _renderSaveTabsBanner();
});

document.getElementById('btnConfirmSaveTabs').addEventListener('click', async () => {
  const title = document.getElementById('saveTabsTitle').value.trim();
  if (!title) { showToast('Enter a title'); return; }

  let tabs;
  try {
    tabs = await chrome.tabs.query({ currentWindow: true });
  } catch {
    showToast('Could not read tabs');
    return;
  }

  const content = tabs
    .filter((t) => t.url)
    .map((t) => (t.title ? `${t.title}\n${t.url}` : t.url))
    .join('\n\n');

  if (!content) { showToast('No tabs found'); return; }

  const folderId = document.getElementById('saveTabsFolder').value;
  const folder   = state.data.folders.find((f) => f.id === folderId);

  if (folder) {
    folder.snippets.push({ id: uid(), title, content });
    state.snippets.expandedFolders.add(folder.id);
  } else {
    state.data.looseSnippets.push({ id: uid(), title, content });
  }

  await saveData();
  state.snippets.showSaveTabs = false;
  document.getElementById('saveTabsTitle').value = '';
  _renderSaveTabsBanner();
  _renderContent();
  showToast(`${tabs.length} tabs saved`);
});

// ── Load Tabs ─────────────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s"'<>]+/g;

function _tabSnippets() {
  const results = [];
  for (const folder of state.data.folders) {
    for (const s of folder.snippets) {
      if (s.type !== 'grid' && s.title.toLowerCase().startsWith('tabs')) results.push({ ...s, _source: folder.name });
    }
  }
  for (const s of state.data.looseSnippets) {
    if (s.type !== 'grid' && s.title.toLowerCase().startsWith('tabs')) results.push({ ...s, _source: 'Loose' });
  }
  return results;
}

function _urlsFromContent(content) {
  return [...new Set(content.match(URL_RE) || [])];
}

function _renderLoadTabsBanner() {
  const banner = document.getElementById('loadTabsBanner');
  banner.classList.toggle('visible', state.snippets.showLoadTabs);
  if (!state.snippets.showLoadTabs) return;

  const snippets = _tabSnippets();
  const sel = document.getElementById('loadTabsSnippet');

  if (!snippets.length) {
    sel.innerHTML = `<option value="">— no "Tabs" snippets found —</option>`;
    _updateLoadPreview([]);
    return;
  }

  sel.innerHTML = snippets
    .map((s, i) => `<option value="${i}">${esc(s.title)} (${esc(s._source)})</option>`)
    .join('');

  sel._snippets = snippets;
  _updateLoadPreview(_urlsFromContent(snippets[0].content));
}

function _updateLoadPreview(urls) {
  const el = document.getElementById('loadTabsPreview');
  el.textContent = urls.length ? `${urls.length} URL${urls.length === 1 ? '' : 's'} found` : 'No URLs found';
}

document.getElementById('btnLoadTabs').addEventListener('click', () => {
  state.snippets.showLoadTabs = !state.snippets.showLoadTabs;
  if (state.snippets.showLoadTabs) {
    state.snippets.showAddFolder = false;
    state.snippets.showAddLoose  = false;
    state.snippets.showAddGrid   = false;
    state.snippets.showSaveTabs  = false;
    _renderAddFolderBanner();
    _renderAddLooseBanner();
    _renderAddGridBanner();
    _renderSaveTabsBanner();
  }
  _renderLoadTabsBanner();
});

document.getElementById('loadTabsSnippet').addEventListener('change', (e) => {
  const sel = e.target;
  const idx = parseInt(sel.value, 10);
  const snippets = sel._snippets || [];
  _updateLoadPreview(isNaN(idx) ? [] : _urlsFromContent(snippets[idx]?.content || ''));
});

document.getElementById('btnCancelLoadTabs').addEventListener('click', () => {
  state.snippets.showLoadTabs = false;
  _renderLoadTabsBanner();
});

document.getElementById('btnConfirmLoadTabs').addEventListener('click', async () => {
  const sel = document.getElementById('loadTabsSnippet');
  const idx = parseInt(sel.value, 10);
  const snippets = sel._snippets || [];
  const snippet = snippets[isNaN(idx) ? 0 : idx];

  if (!snippet) { showToast('No snippet selected'); return; }

  const urls = _urlsFromContent(snippet.content);
  if (!urls.length) { showToast('No URLs found in that snippet'); return; }

  for (const url of urls) {
    await chrome.tabs.create({ url, active: false });
  }

  state.snippets.showLoadTabs = false;
  _renderLoadTabsBanner();
  showToast(`Opened ${urls.length} tab${urls.length === 1 ? '' : 's'}`);
});

// ── Add Grid Banner ───────────────────────────────────────────────────────────

document.getElementById('btnAddGrid').addEventListener('click', () => {
  state.snippets.showAddGrid = !state.snippets.showAddGrid;
  if (state.snippets.showAddGrid) {
    state.snippets.showAddFolder = false;
    state.snippets.showAddLoose  = false;
    state.snippets.showSaveTabs  = false;
    state.snippets.showLoadTabs  = false;
    state.snippets.activeForm    = null;
    state.snippets.gridFormState = {
      headers: ['', '', ''],
      rows: [['','',''],['','',''],['','',''],['','',''],['','','']],
    };
    _renderAddFolderBanner();
    _renderAddLooseBanner();
    _renderSaveTabsBanner();
    _renderLoadTabsBanner();
    _renderContent();
    document.getElementById('gridTitle').value = '';
  }
  _renderAddGridBanner();
});

document.getElementById('btnAddGridRow').addEventListener('click', () => {
  const { headers, rows } = _scrapeGridEditor();
  rows.push(new Array(headers.length).fill(''));
  if (state.snippets.gridFormState) {
    state.snippets.gridFormState.headers = headers;
    state.snippets.gridFormState.rows = rows;
  }
  _renderGridEditor(headers, rows);
});

document.getElementById('btnCancelGrid').addEventListener('click', () => {
  state.snippets.showAddGrid = false;
  state.snippets.gridFormState = null;
  _renderAddGridBanner();
});

document.getElementById('btnSaveGrid').addEventListener('click', async () => {
  const title = document.getElementById('gridTitle').value.trim();
  if (!title) { showToast('Enter a grid title'); return; }
  const { headers, rows } = _scrapeGridEditor();
  state.data.looseSnippets.push({ id: uid(), type: 'grid', title, headers, rows });
  await saveData();
  state.snippets.showAddGrid = false;
  state.snippets.gridFormState = null;
  _renderAddGridBanner();
  _renderContent();
  showToast('Grid saved');
});

// ── Drag & Drop ───────────────────────────────────────────────────────────────
// We track the dragged item and use drop-indicator divs between items.

let _drag = null; // { kind: 'folder'|'loose', id, originIndex }

function _attachDragDrop() {
  // Folders
  document.querySelectorAll('#foldersList > .folder[draggable]').forEach((el) => {
    el.addEventListener('dragstart', _onFolderDragStart);
    el.addEventListener('dragend',   _onDragEnd);
  });

  // Loose snippets
  document.querySelectorAll('#looseList > .loose-snippet[draggable]').forEach((el) => {
    el.addEventListener('dragstart', _onLooseDragStart);
    el.addEventListener('dragend',   _onDragEnd);
  });

  // Drop indicators for folders
  document.querySelectorAll('.drop-indicator[data-drop-target="folder"]').forEach((ind) => {
    ind.addEventListener('dragover',   (e) => _onIndicatorOver(e, ind));
    ind.addEventListener('dragleave',  () => _clearIndicator(ind));
    ind.addEventListener('drop',       (e) => _onFolderDrop(e, ind));
  });

  // Drop indicators for loose snippets
  document.querySelectorAll('.drop-indicator[data-drop-target="loose"]').forEach((ind) => {
    ind.addEventListener('dragover',   (e) => _onIndicatorOver(e, ind));
    ind.addEventListener('dragleave',  () => _clearIndicator(ind));
    ind.addEventListener('drop',       (e) => _onLooseIndicatorDrop(e, ind));
  });

  // Folder elements as drop targets (for loose snippets → drop INTO folder)
  document.querySelectorAll('#foldersList > .folder').forEach((folderEl) => {
    folderEl.addEventListener('dragover',  (e) => _onFolderOver(e, folderEl));
    folderEl.addEventListener('dragleave', (e) => _onFolderLeave(e, folderEl));
    folderEl.addEventListener('drop',      (e) => _onDropIntoFolder(e, folderEl));
  });
}

function _onFolderDragStart(e) {
  const el = e.currentTarget;
  _drag = { kind: 'folder', id: el.dataset.folderId };
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => el.classList.add('dragging'), 0);
}

function _onLooseDragStart(e) {
  const el = e.currentTarget;
  _drag = { kind: 'loose', id: el.dataset.looseId };
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => el.classList.add('dragging'), 0);
}

function _onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  // Clear all active indicators
  document.querySelectorAll('.drop-indicator.active').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.folder.drag-over-folder').forEach((el) => el.classList.remove('drag-over-folder'));
}

function _onIndicatorOver(e, ind) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // Only show indicator that matches dragging kind
  const target = ind.dataset.dropTarget;
  if (_drag?.kind === 'folder' && target !== 'folder') return;
  if (_drag?.kind === 'loose'  && target !== 'loose')  return;
  document.querySelectorAll('.drop-indicator.active').forEach((el) => el.classList.remove('active'));
  ind.classList.add('active');
}

function _clearIndicator(ind) {
  ind.classList.remove('active');
}

function _onFolderOver(e, folderEl) {
  if (_drag?.kind !== 'loose') return; // only loose → folder
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.folder.drag-over-folder').forEach((el) => el.classList.remove('drag-over-folder'));
  folderEl.classList.add('drag-over-folder');
}

function _onFolderLeave(e, folderEl) {
  if (!folderEl.contains(e.relatedTarget)) {
    folderEl.classList.remove('drag-over-folder');
  }
}

async function _onFolderDrop(e, ind) {
  e.preventDefault();
  ind.classList.remove('active');
  if (!_drag || _drag.kind !== 'folder') return;

  const toIndex = parseInt(ind.dataset.dropIndex, 10);
  const folders = [...state.data.folders].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const fromIndex = folders.findIndex((f) => f.id === _drag.id);
  if (fromIndex === -1) return;

  // Move
  const [moved] = folders.splice(fromIndex, 1);
  const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
  folders.splice(insertAt, 0, moved);

  // Reassign order
  folders.forEach((f, i) => { f.order = i; });
  state.data.folders = folders;
  await saveData();
  _renderContent();
}

async function _onLooseIndicatorDrop(e, ind) {
  e.preventDefault();
  ind.classList.remove('active');
  if (!_drag || _drag.kind !== 'loose') return;

  // Loose snippets are alpha-sorted on render, but we can't reorder alpha list
  // by drag — so this is a no-op visually (they stay alpha).
  // Instead we move it; since they're always alpha-sorted, drag between them
  // has no persistent effect, so just show a toast.
  showToast('Loose snippets stay alphabetical — drag into a folder to move');
}

async function _onDropIntoFolder(e, folderEl) {
  e.preventDefault();
  folderEl.classList.remove('drag-over-folder');
  if (!_drag || _drag.kind !== 'loose') return;

  const folderId = folderEl.dataset.folderId;
  const folder   = state.data.folders.find((f) => f.id === folderId);
  const s        = state.data.looseSnippets.find((x) => x.id === _drag.id);
  if (!folder || !s) return;

  if (s.type === 'grid') {
    folder.snippets.push({ id: s.id, type: 'grid', title: s.title, headers: s.headers, rows: s.rows });
  } else {
    folder.snippets.push({ id: s.id, title: s.title, content: s.content });
  }
  state.data.looseSnippets = state.data.looseSnippets.filter((x) => x.id !== s.id);
  state.snippets.expandedFolders.add(folderId);
  await saveData();
  _renderContent();
  showToast(`Moved to "${folder.name}"`);
}
