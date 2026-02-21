# Jeeves Bot

A Chrome extension built as a personal dev assistant. Lives in the browser toolbar and handles the small recurring tasks that add up — snippets, todos, Linear tickets, port monitoring, timers, and more.

---

## Features

**Snippets** — Save and instantly copy text snippets. Organize them in folders (manually ordered, draggable) or keep them loose (auto alpha-sorted). Drag loose snippets into folders. Full-text search across all content.

**To-Do** — Lightweight task list. Paste a URL and it auto-fetches the page title. Reorder tasks with up/down buttons. Pin any task to a floating always-on-top desktop window. Clear completed items in one click.

**Linear** — Describe a ticket in plain English (or by voice), and OpenAI drafts the title, description, priority, and project assignment. Preview before creating. Requires OpenAI + Linear API keys.

**Chat** — Quick AI chat backed by OpenAI, inline in the popup.

**Ports** — Monitors local dev servers. Configurable list of ports; shows which are live.

**Timer** — Simple countdown/stopwatch.

**Files** — Quick access to local file references.

---

## Setup

1. Clone the repo
2. Go to `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the repo folder
4. Open the extension and go to **Settings** to add your API keys:
   - OpenAI key (for Linear ticket generation and Chat)
   - Linear API key (for ticket creation)
5. In Linear settings, click **Test connection** to fetch and cache your teams

---

## Data & Privacy

All data is stored locally in `chrome.storage.sync` — nothing is sent anywhere except:
- OpenAI API (when using Linear ticket generation or Chat)
- Linear API (when creating tickets)
- YouTube oEmbed / page HTML (when fetching titles for pasted URLs in To-Do)

No analytics, no tracking, no backend.

---

## Generating Icons

If you need to regenerate the icons:

```
node create_icons.js
```

---

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves snippets, todos, settings locally |
| `clipboardWrite` | Copies snippets to clipboard on click |
| `downloads` | File tab functionality |
| `windows` | Opens pinned floating todo windows |
| `host_permissions: <all_urls>` | Fetches page titles when a URL is pasted into To-Do |
| `api.openai.com`, `api.linear.app` | AI and Linear integrations |
| `localhost/*` | Monitors local dev server ports |

---

## Stack

Vanilla JS, HTML, CSS — no build step, no frameworks. Chrome Extension Manifest V3.

Fonts: [Lora](https://fonts.google.com/specimen/Lora), [DM Sans](https://fonts.google.com/specimen/DM+Sans), [DM Mono](https://fonts.google.com/specimen/DM+Mono)
