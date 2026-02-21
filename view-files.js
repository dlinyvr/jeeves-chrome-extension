'use strict';

// ─── File Creator view ────────────────────────────────────────────────────────

let customDirHandle = null; // FileSystemDirectoryHandle from showDirectoryPicker()

const FILE_ICONS = {
  js: '🟨', ts: '🟦', jsx: '🟨', tsx: '🟦',
  py: '🐍', rb: '💎', go: '🔵', rs: '🦀',
  html: '🌐', css: '🎨', json: '📋', xml: '📄',
  md: '📝', txt: '📄', csv: '📊', sql: '🗄️',
  sh: '⚙️', yaml: '⚙️', yml: '⚙️', env: '🔑',
  pdf: '📕', zip: '🗜️',
};

function renderFiles() {
  _setResult('', '');

  // Restore persisted field values
  const nameEl   = document.getElementById('fileName');
  const destEl   = document.getElementById('fileDestination');
  const customEl = document.getElementById('fileCustomFolder');
  const contentEl= document.getElementById('fileContent');

  if (ui.filesName)        nameEl.value    = ui.filesName;
  if (ui.filesDestination) destEl.value    = ui.filesDestination;
  // Custom folder display is not persisted (handle lost on popup close)
  if (ui.filesContent)     contentEl.value = ui.filesContent;

  // Trigger hint update for restored filename
  if (ui.filesName) nameEl.dispatchEvent(new Event('input'));
}

function _persistFiles() {
  ui.filesName         = document.getElementById('fileName').value;
  ui.filesDestination  = document.getElementById('fileDestination').value;
  ui.filesContent      = document.getElementById('fileContent').value;
  saveUiState();
}

// ── File name validation hint ─────────────────────────────────────────────────

['fileName','fileContent'].forEach((id) => {
  document.getElementById(id).addEventListener('input', _persistFiles);
});
document.getElementById('fileDestination').addEventListener('change', _persistFiles);

document.getElementById('fileName').addEventListener('input', function () {
  const val = this.value.trim();
  const hint = document.getElementById('fileNameHint');

  if (!val) { hint.textContent = ''; hint.className = 'filename-hint'; return; }

  const dotIdx = val.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === val.length - 1) {
    hint.textContent = 'Add a file extension, e.g. .txt or .js';
    hint.className = 'filename-hint invalid';
    return;
  }

  const ext  = val.slice(dotIdx + 1).toLowerCase();
  const icon = FILE_ICONS[ext] ?? '📄';
  hint.textContent = `${icon} ${ext.toUpperCase()} file`;
  hint.className = 'filename-hint valid';
});

// ── Custom folder picker ──────────────────────────────────────────────────────

document.getElementById('fileDestination').addEventListener('change', async function () {
  const customDisplay = document.getElementById('fileCustomFolder');
  const folderName    = document.getElementById('fileCustomFolderName');

  if (this.value !== '__custom__') {
    customDirHandle = null;
    customDisplay.style.display = 'none';
    return;
  }

  // Open native folder picker
  const prevValue = this.dataset.prevValue || '';
  try {
    customDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    folderName.textContent = customDirHandle.name;
    customDisplay.style.display = 'block';
    this.dataset.prevValue = '__custom__';
  } catch (_e) {
    // User cancelled — reset select to previous value
    this.value = prevValue;
    customDirHandle = null;
    customDisplay.style.display = 'none';
  }
});

// Track non-custom selections so we can revert on cancel
document.getElementById('fileDestination').addEventListener('change', function () {
  if (this.value !== '__custom__') this.dataset.prevValue = this.value;
}, true);

// ── Save file ─────────────────────────────────────────────────────────────────

document.getElementById('btnCreateFile').addEventListener('click', async () => {
  const name    = document.getElementById('fileName').value.trim();
  const content = document.getElementById('fileContent').value;
  const destSel = document.getElementById('fileDestination').value;

  // Validate
  if (!name) { _setResult('Enter a file name', 'err'); return; }
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === name.length - 1) {
    _setResult('File name needs an extension (e.g. notes.txt)', 'err');
    return;
  }
  if (!content) { _setResult('Content is empty', 'err'); return; }
  if (destSel === '__custom__' && !customDirHandle) {
    _setResult('Pick a custom folder first', 'err'); return;
  }

  // Sanitise filename (no path traversal)
  const safeName = name.replace(/[/\\]/g, '_');

  try {
    if (destSel === '__custom__' && customDirHandle) {
      // Write directly to the picked folder via File System Access API
      const fileHandle = await customDirHandle.getFileHandle(safeName, { create: true });
      const writable   = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      _setResult(`✓ Saved to ${customDirHandle.name}/${safeName}`, 'ok');
    } else {
      // Save to Downloads (with optional subfolder)
      const folder   = destSel; // '' | 'Documents' | 'Code' | 'Projects'
      const filename = folder ? `${folder}/${safeName}` : safeName;
      const ext  = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
      const mime = _mimeFor(ext);
      const blob = new Blob([content], { type: mime });
      const url  = URL.createObjectURL(blob);

      if (typeof chrome !== 'undefined' && chrome.downloads) {
        await new Promise((resolve, reject) => {
          chrome.downloads.download({ url, filename, saveAs: false }, (id) => {
            URL.revokeObjectURL(url);
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(id);
          });
        });
        const dest = folder ? `Downloads/${folder}/` : 'Downloads/';
        _setResult(`✓ Saved to ${dest}${safeName}`, 'ok');
      } else {
        // Fallback for dev: plain anchor download
        const a = document.createElement('a');
        a.href = url; a.download = safeName; a.click();
        URL.revokeObjectURL(url);
        _setResult(`✓ ${safeName} downloaded`, 'ok');
      }
    }

    // Clear content after successful save
    document.getElementById('fileContent').value = '';
    ui.filesContent = '';
    saveUiState();
  } catch (err) {
    _setResult(`Failed: ${err.message}`, 'err');
  }
});

function _setResult(msg, cls) {
  const el = document.getElementById('filesResult');
  el.textContent = msg;
  el.className = 'files-result' + (cls ? ` ${cls}` : '');
}

function _mimeFor(ext) {
  const map = {
    txt: 'text/plain', md: 'text/markdown', html: 'text/html',
    css: 'text/css', js: 'text/javascript', ts: 'text/typescript',
    jsx: 'text/javascript', tsx: 'text/javascript',
    json: 'application/json', xml: 'application/xml',
    csv: 'text/csv', svg: 'image/svg+xml',
    py: 'text/x-python', rb: 'text/x-ruby', sh: 'text/x-shellscript',
    sql: 'application/sql', yaml: 'text/yaml', yml: 'text/yaml',
  };
  return map[ext] ?? 'text/plain';
}
