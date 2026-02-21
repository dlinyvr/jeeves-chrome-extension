'use strict';

// ─── AI Chat view ─────────────────────────────────────────────────────────────

const chatState = {
  messages: [], // [{ role: 'user'|'assistant', content: string }]
  isLoading: false,
  webSearch: false,
};

// ── Entry ─────────────────────────────────────────────────────────────────────

function renderChat() {
  const hasKey = !!state.data.settings.openaiKey;
  document.getElementById('chat-no-key').style.display    = hasKey ? 'none' : 'flex';
  document.getElementById('chat-interface').style.display = hasKey ? 'flex' : 'none';

  if (!hasKey) return;

  // Restore model
  const sel = document.getElementById('chatModelSelect');
  const savedModel = ui.chatModel ?? state.data.settings.chatModel ?? 'gpt-4o';
  const opt = sel.querySelector(`option[value="${CSS.escape(savedModel)}"]`);
  if (opt) sel.value = savedModel;
  chatState.model = sel.value;

  // Restore web search toggle
  chatState.webSearch = ui.chatWebSearch ?? false;
  document.getElementById('chatWebToggle').classList.toggle('active', chatState.webSearch);

  // Restore messages (only if not already populated this session)
  if (chatState.messages.length === 0 && ui.chatMessages?.length) {
    chatState.messages = ui.chatMessages;
    _rebuildMessages();
  }

  // Restore draft input
  const input = document.getElementById('chatInput');
  if (input && !input.value && ui.chatDraft) {
    input.value = ui.chatDraft;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
}

function _rebuildMessages() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  chatState.messages.forEach(({ role, content }) => _appendMessage(role, content));
}

// "Go to Settings" from no-key banner
document.getElementById('chatGoToSettings').addEventListener('click', () => switchTab('settings'));

// ── Web search toggle ─────────────────────────────────────────────────────────

document.getElementById('chatWebToggle').addEventListener('click', () => {
  chatState.webSearch = !chatState.webSearch;
  document.getElementById('chatWebToggle').classList.toggle('active', chatState.webSearch);
  ui.chatWebSearch = chatState.webSearch;
  saveUiState();
});

// ── Model change ──────────────────────────────────────────────────────────────

document.getElementById('chatModelSelect').addEventListener('change', function () {
  ui.chatModel = this.value;
  saveUiState();
});

// ── Send message ──────────────────────────────────────────────────────────────

document.getElementById('chatSend').addEventListener('click', _handleSend);

document.getElementById('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    _handleSend();
  }
});

// Auto-grow textarea + persist draft
document.getElementById('chatInput').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  ui.chatDraft = this.value;
  saveUiState();
});

async function _handleSend() {
  if (chatState.isLoading) return;
  const input   = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content) return;

  input.value   = '';
  input.style.height = 'auto';
  ui.chatDraft = '';
  saveUiState();

  const model = document.getElementById('chatModelSelect').value;
  ui.chatModel = model;
  saveUiState();

  // Add user message
  chatState.messages.push({ role: 'user', content });
  _removeWelcome();
  _appendMessage('user', content);

  chatState.isLoading = true;
  document.getElementById('chatSend').disabled = true;
  const typingEl = _appendTyping();

  try {
    if (chatState.webSearch) {
      // Non-streaming path for web search models
      const searchModel = model === 'gpt-4o-mini' ? 'gpt-4o-mini-search-preview' : 'gpt-4o-search-preview';
      const { text, citations } = await _fetchCompletion(searchModel, chatState.messages);
      typingEl.remove();
      chatState.messages.push({ role: 'assistant', content: text });
      _appendMessage('assistant', text, citations);
      ui.chatMessages = chatState.messages.slice(-60);
      saveUiState();
    } else {
      // Streaming path
      const fullReply = await _streamCompletion(model, chatState.messages, (chunk) => {
        typingEl.dataset.content = (typingEl.dataset.content ?? '') + chunk;
        typingEl.querySelector('.chat-bubble').innerHTML = _renderMarkdown(typingEl.dataset.content);
        _scrollToBottom();
      });
      typingEl.remove();
      chatState.messages.push({ role: 'assistant', content: fullReply });
      _appendMessage('assistant', fullReply);
      ui.chatMessages = chatState.messages.slice(-60);
      saveUiState();
    }
  } catch (err) {
    typingEl.remove();
    _appendError(err.message);
  } finally {
    chatState.isLoading = false;
    document.getElementById('chatSend').disabled = false;
    _scrollToBottom();
    input.focus();
  }
}

// ── Streaming ─────────────────────────────────────────────────────────────────

async function _streamCompletion(model, messages, onChunk) {
  const { openaiKey } = state.data.settings;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: model.startsWith('o') ? 1 : 0.7, // reasoning models don't take temp <1
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';
  let full      = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return full;
      try {
        const json  = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content ?? '';
        if (delta) { full += delta; onChunk(delta); }
      } catch { /* ignore malformed chunks */ }
    }
  }
  return full;
}

// ── Non-streaming (web search) ─────────────────────────────────────────────────

async function _fetchCompletion(model, messages) {
  const { openaiKey } = state.data.settings;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }

  const json    = await res.json();
  const message = json.choices?.[0]?.message ?? {};
  const text    = message.content ?? '';

  // Extract unique URL citations from annotations
  const seen = new Set();
  const citations = (message.annotations ?? [])
    .filter(a => a.type === 'url_citation')
    .map(a => ({ url: a.url_citation?.url, title: a.url_citation?.title }))
    .filter(c => c.url && !seen.has(c.url) && seen.add(c.url));

  return { text, citations };
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function _removeWelcome() {
  document.querySelector('.chat-welcome')?.remove();
}

function _appendMessage(role, content, citations = []) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  const copyBtn = role === 'assistant'
    ? `<button class="chat-copy-btn" title="Copy response">
        <svg viewBox="0 0 16 16" fill="none" width="11" height="11"><rect x="5.5" y="1.5" width="7" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 3.5H3.5a1 1 0 00-1 1v9a1 1 0 001 1h7a1 1 0 001-1V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>`
    : '';

  const sourcesHtml = citations.length
    ? `<div class="chat-sources">
        <div class="chat-sources-label">Sources</div>
        ${citations.map(c =>
          `<a class="chat-source-link" href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.url)}">${esc(c.title || c.url)}</a>`
        ).join('')}
      </div>`
    : '';

  div.innerHTML = `
    <div class="chat-msg-meta">
      <span class="chat-msg-role">${role === 'user' ? 'You' : 'AI'}</span>
      ${copyBtn}
    </div>
    <div class="chat-bubble">${role === 'assistant' ? _renderMarkdown(content) : esc(content)}${sourcesHtml}</div>`;

  if (role === 'assistant') {
    div.querySelector('.chat-copy-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      await navigator.clipboard.writeText(content).catch(() => {});
      btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" width="11" height="11"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      btn.style.color = 'var(--accent)';
      setTimeout(() => {
        btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" width="11" height="11"><rect x="5.5" y="1.5" width="7" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 3.5H3.5a1 1 0 00-1 1v9a1 1 0 001 1h7a1 1 0 001-1V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
        btn.style.color = '';
      }, 1600);
    });
  }

  container.appendChild(div);
  _scrollToBottom();
  return div;
}

function _appendTyping() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg assistant';
  div.dataset.content = '';
  div.innerHTML = `
    <div class="chat-msg-role">AI</div>
    <div class="chat-bubble">
      <div class="chat-typing"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(div);
  _scrollToBottom();
  return div;
}

function _appendError(msg) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg assistant';
  div.innerHTML = `
    <div class="chat-msg-role">Error</div>
    <div class="chat-bubble" style="border-color:var(--danger);color:var(--danger);">${esc(msg)}</div>`;
  container.appendChild(div);
}

function _scrollToBottom() {
  const el = document.getElementById('chatMessages');
  el.scrollTop = el.scrollHeight;
}

// ── Clear conversation ────────────────────────────────────────────────────────

document.getElementById('chatClear').addEventListener('click', () => {
  if (chatState.isLoading) return;
  chatState.messages = [];
  ui.chatMessages = [];
  saveUiState();
  document.getElementById('chatMessages').innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">✦</div>
      <p>Ask me anything</p>
    </div>`;
});

// ── Minimal markdown renderer ─────────────────────────────────────────────────
// Handles: code blocks, inline code, bold, italic, headers, lists, line breaks

function _renderMarkdown(text) {
  let html = esc(text);

  // Fenced code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${code.trimEnd()}</code></pre>`
  );

  // Markdown links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, linkText, url) =>
    `<a href="${url.replace(/&amp;/g, '&')}" target="_blank" rel="noopener">${linkText}</a>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g,         '<em>$1</em>');

  // Checkboxes
  html = html.replace(/- \[ \] /g, '☐ ');
  html = html.replace(/- \[x\] /gi, '☑ ');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">');

  // Paragraphs / line breaks
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith('<h') || block.startsWith('<pre') || block.startsWith('<ul') || block.startsWith('<hr')) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  return html;
}
