# Plan: Port Manager Tab — Chrome Extension Integration

## What we're building

Add a **Ports** tab to the Snippet Box Chrome extension that replicates the port-manager web UI directly in the popup. The extension calls the existing `port-manager` Express server (running locally at `localhost:3007`) via fetch — no shell access needed from the extension side.

## Architecture decision

Chrome extensions run in a sandboxed context — they cannot exec `lsof` or `kill` directly. Two options:

| Option | Complexity | Tradeoff |
|--------|-----------|---------|
| **Call local Express server** (chosen) | Low | User must have `node server.js` running |
| Native Messaging Host | High | No separate server needed, but requires installing a native app manifest |

**We go with option 1.** The port-manager server already exists and the user already runs it. The extension detects if it's unreachable and shows a clear "Start the server" message.

---

## Files to create / modify

| File | Change |
|------|--------|
| `popup.html` | Add Ports tab button + panel HTML |
| `view-ports.js` | New file — all Ports tab logic |
| `popup.css` | Styles for the Ports tab |
| `manifest.json` | Add `http://localhost/*` to `host_permissions` if not already present |

The port-manager server itself is **unchanged**.

---

## UI Design

### Tab bar
Add a "Ports" tab button between Files and AI:
```
Snippets | ▲ Linear | □ Files | ⬡ Ports | AI | Settings
```
Icon: a small plug/network SVG. Accent color: `#E8A838` (amber — distinct from green/purple).

### Ports panel layout
```
┌─────────────────────────────────────────┐
│  ⬡ Ports          [↺ Refresh] [⏱ Auto] │  ← header bar
├─────────────────────────────────────────┤
│  PORT   PID    PROCESS   PROJECT        │  ← column headers
├─────────────────────────────────────────┤
│  3000   12345  node      ~/my-app    [×]│
│  5173   23456  vite      ~/other    [×] │
│  8080   34567  python    ~/scripts  [×] │
└─────────────────────────────────────────┘
```

- **PORT** — clickable link → opens `http://localhost:<port>` in new tab
- **PID** — small muted text
- **PROCESS** — command name (node, python, etc.)
- **PROJECT** — working directory, truncated with `~`
- **[×]** — kill button, requires confirmation toast/inline confirm
- Empty state: "No ports listening"
- Error state (server down): "Port Manager server isn't running. Start it with: `node server.js`"
- Loading state: spinner

### Settings integration
Add a **Port Manager** section to the Settings tab:
- Server URL field (default: `http://localhost:3007`)
- Saved to `state.data.settings.portManagerUrl`

---

## Data model additions

```js
// state.data.settings (additions)
{
  portManagerUrl: 'http://localhost:3007'  // configurable
}
```

No persistent port data — always fetched live from the server.

---

## `view-ports.js` — key functions

```
renderPorts()               — entry point, called by tab router
_loadPorts()                — fetch /api/ports, update UI
_renderTable(ports)         — build rows DOM
_killProcess(pid, rowEl)    — POST /api/kill/:pid, inline confirm
_startAutoRefresh()         — setInterval every 5s
_stopAutoRefresh()          — clearInterval, update toggle state
```

### State shape
```js
const portsState = {
  ports: [],
  isLoading: false,
  autoRefresh: false,
  autoRefreshTimer: null,
  serverUrl: null,  // pulled from state.data.settings on render
};
```

### API calls
```js
// List ports
GET  {serverUrl}/api/ports
→ { ports: [{ port, pid, command, user, address, cwd, fullCommand }] }

// Kill process
POST {serverUrl}/api/kill/{pid}
→ { success: true, message: "..." }
```

### Kill UX flow
1. User clicks [×] on a row
2. Row highlights in red, button changes to "Confirm?"
3. User clicks "Confirm?" → POST kill → row fades out, removed
4. User clicks anywhere else → row returns to normal (cancel)

This avoids a blocking `confirm()` dialog (which doesn't work well in extensions).

---

## `popup.html` changes

### Tab button (add after Files button)
```html
<button class="tab-btn" data-tab="ports" title="Port Manager">
  <svg ...><!-- plug/network icon --></svg>
  Ports
</button>
```

### Tab panel (add after Files panel)
```html
<div id="tab-ports" class="tab-panel">

  <!-- Server down state -->
  <div id="ports-server-down" class="no-keys-msg" style="display:none">
    <div class="no-keys-icon">⬡</div>
    <p>Port Manager server isn't running.</p>
    <code class="ports-cmd">cd port-manager && node server.js</code>
    <button class="btn-primary" id="portsRetry">Retry</button>
  </div>

  <!-- Main interface -->
  <div id="ports-interface" style="display:none; flex-direction:column; flex:1; overflow:hidden;">

    <!-- Header bar -->
    <div class="ports-header-bar">
      <span class="ports-count" id="portsCount">— ports</span>
      <div style="display:flex; gap:6px">
        <button class="ports-ctrl-btn" id="portsRefresh" title="Refresh">↺</button>
        <button class="ports-ctrl-btn" id="portsAutoToggle" title="Auto-refresh">⏱ Auto</button>
      </div>
    </div>

    <!-- Table -->
    <div class="ports-scroll" id="portsScroll">
      <table class="ports-table">
        <thead>
          <tr>
            <th>Port</th>
            <th>PID</th>
            <th>Process</th>
            <th>Project</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="portsTableBody"></tbody>
      </table>
      <div class="ports-empty" id="portsEmpty" style="display:none">No ports listening</div>
      <div class="ports-loading" id="portsLoading" style="display:none">
        <div class="spinner"></div>
      </div>
    </div>

  </div>
</div>
```

### Settings section (add in settings tab)
```html
<div class="settings-divider"></div>
<section class="settings-section">
  <div class="settings-section-header">
    <span class="settings-icon">⬡</span>
    <div>
      <div class="settings-section-title">Port Manager</div>
      <div class="settings-section-sub">Local server URL</div>
    </div>
  </div>
  <div class="form-field">
    <label class="form-label">Server URL</label>
    <input type="text" class="form-input" id="portManagerUrl" placeholder="http://localhost:3007">
  </div>
</section>
```

---

## `popup.css` changes

New sections to add:

```css
/* ─── Ports tab ─── */

.tab-btn[data-tab="ports"].active { border-bottom-color: var(--ports); }

:root { --ports: #E8A838; --ports-light: #FEF3DC; }

.ports-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.ports-count {
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 500;
}

.ports-ctrl-btn {
  height: 26px;
  padding: 0 9px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 11.5px;
  font-family: var(--font);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 100ms;
}
.ports-ctrl-btn:hover { border-color: var(--ports); color: var(--ports); }
.ports-ctrl-btn.active { background: var(--ports); border-color: var(--ports); color: white; }

.ports-scroll {
  flex: 1;
  overflow-y: auto;
}
.ports-scroll::-webkit-scrollbar { width: 3px; }
.ports-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

.ports-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ports-table thead th {
  padding: 6px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  position: sticky;
  top: 0;
}

.ports-table tbody tr {
  border-bottom: 1px solid var(--border-light);
  transition: background 80ms;
}
.ports-table tbody tr:hover { background: var(--ports-light); }
.ports-table tbody tr.killing { background: var(--danger-light); }

.ports-table td {
  padding: 7px 10px;
  color: var(--text);
  vertical-align: middle;
  max-width: 0;         /* enables text-overflow in table cells */
}

.port-link {
  color: var(--ports);
  font-weight: 600;
  font-family: var(--font-mono);
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
}
.port-link:hover { text-decoration: underline; }

.port-pid {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-faint);
}

.port-process {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.port-project {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.port-kill-btn {
  width: 22px;
  height: 22px;
  background: none;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-faint);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 80ms;
  flex-shrink: 0;
}
.port-kill-btn:hover { border-color: var(--danger); color: var(--danger); background: var(--danger-light); }

/* Inline confirm state */
.port-kill-confirm {
  font-size: 10px;
  font-weight: 600;
  color: var(--danger);
  background: var(--danger-light);
  border: 1px solid var(--danger);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  white-space: nowrap;
}

.ports-empty {
  text-align: center;
  padding: 40px 16px;
  font-size: 12.5px;
  color: var(--text-faint);
}

.ports-loading {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.ports-cmd {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 6px 10px;
  color: var(--text);
  display: block;
  text-align: left;
}
```

---

## `manifest.json` change

Add localhost to `host_permissions` (needed for `fetch()` to `localhost`):
```json
"host_permissions": [
  "https://api.openai.com/*",
  "https://api.linear.app/*",
  "http://localhost/*"
]
```

---

## `view-settings.js` change

Save/load `portManagerUrl` alongside other settings when "Save settings" is clicked.

---

## Tab routing (`popup.js`)

Add `ports` to the tab switch handler:
```js
case 'ports': renderPorts(); break;
```

---

## Verification checklist

1. Load extension → Ports tab appears in nav
2. Without server: error state shows with command
3. Start `node server.js` → click Retry → table populates
4. Click port number → opens `http://localhost:<port>` in new tab
5. Click [×] → row goes red, button becomes "Confirm?"
6. Click "Confirm?" → row removed, process killed
7. Click [×] then click elsewhere → row resets (cancel)
8. Enable Auto → rows refresh every 5 seconds; disable stops it
9. Change server URL in Settings → Ports tab uses new URL
10. Switch away from Ports tab and back → auto-refresh pauses/resumes correctly
