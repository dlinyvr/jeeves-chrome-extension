'use strict';

// ─── Linear view ──────────────────────────────────────────────────────────────

let _recognition   = null; // Web Speech API instance
let _activeTemplate = 'bug'; // 'bug' | 'raw' | 'story'

const TEMPLATES = {
  bug: {
    placeholder: 'e.g. The login button doesn\'t work on Safari when the user has already logged out once. Clicking it shows a spinner that never resolves…',
    generateLabel: 'Generate bug report draft',
    system: `You are a senior QA engineer writing defect reports for Linear. Convert the user's informal description into a well-structured bug report following industry best practices.

Return ONLY valid JSON with these exact keys:
{
  "priority": "urgent" | "high" | "medium" | "low" | "none",
  "title": "[Component] Short, specific description of the defect — max 80 chars. Start with the affected area in brackets.",
  "description": "Markdown bug report with these sections:\\n\\n## Summary\\nOne-sentence description of the defect.\\n\\n## Steps to Reproduce\\n1. Numbered steps\\n2. Be specific\\n\\n## Expected Behavior\\nWhat should happen.\\n\\n## Actual Behavior\\nWhat actually happens. Include any error messages verbatim if mentioned.\\n\\n## Impact\\nWho is affected and how severely.\\n\\n## Environment\\nBrowser, OS, version — infer from context or leave as TBD.\\n\\n## Additional Context\\nAny other relevant details, workarounds, or related issues."
}

Infer priority from severity: crashes/data loss = urgent, broken core features = high, degraded UX = medium, cosmetic = low.`,
  },
  story: {
    placeholder: 'e.g. Users need to be able to filter search results by price range and category so they can find products faster without scrolling through everything…',
    generateLabel: 'Generate user story draft',
    system: `You are a product manager writing user stories for Linear. Convert the user's informal description into a well-structured user story following Agile best practices.

Return ONLY valid JSON with these exact keys:
{
  "priority": "urgent" | "high" | "medium" | "low" | "none",
  "title": "As a [user type], I want to [action] — max 80 chars",
  "description": "Markdown user story with these sections:\\n\\n## User Story\\nAs a **[type of user]**, I want **[some goal]** so that **[some reason/value]**.\\n\\n## Problem Statement\\nThe current pain point or gap this story addresses.\\n\\n## Acceptance Criteria\\n- [ ] Criterion 1 — specific and testable\\n- [ ] Criterion 2\\n- [ ] Criterion 3\\n\\n## Out of Scope\\nWhat this story explicitly does NOT cover.\\n\\n## Dependencies\\nAny other tickets, systems, or teams this depends on (or 'None').\\n\\n## Notes\\nAdditional context, design considerations, or open questions."
}

Infer priority from business value and user impact.`,
  },
  raw: {
    placeholder: 'Type or dictate exactly what you want — no AI rewriting, submitted as-is…',
    generateLabel: 'Create draft',
    system: null, // no LLM
  },
};

function renderLinear() {
  const hasOpenai = !!state.data.settings.openaiKey;
  const hasLinear = !!state.data.settings.linearKey;

  // Restore template from UI state
  _activeTemplate = ui.linearTemplate ?? 'bug';
  document.querySelectorAll('.template-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.template === _activeTemplate);
  });

  // Raw mode doesn't need OpenAI
  const canProceed = hasLinear && (_activeTemplate === 'raw' || hasOpenai);
  _showLinearView(canProceed ? 'input' : 'no-keys');

  if (canProceed) {
    _applyTemplate(_activeTemplate);
    _populateProjectsAndAssignees();

    // Restore draft text
    const textarea = document.getElementById('linearUserInput');
    if (textarea && ui.linearInput) textarea.value = ui.linearInput;
  }
}

function _applyTemplate(name) {
  const tpl = TEMPLATES[name];
  const textarea = document.getElementById('linearUserInput');
  const genBtn   = document.getElementById('btnGenerate');
  if (textarea) textarea.placeholder = tpl.placeholder;
  if (genBtn)   genBtn.textContent   = tpl.generateLabel;
}

// Save linear input as user types
document.getElementById('linearUserInput').addEventListener('input', (e) => {
  ui.linearInput = e.target.value;
  saveUiState();
});

// Template selector buttons
document.querySelectorAll('.template-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    _activeTemplate = btn.dataset.template;
    ui.linearTemplate = _activeTemplate;
    saveUiState();
    document.querySelectorAll('.template-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    _applyTemplate(_activeTemplate);
    // Re-evaluate no-keys warning (raw doesn't need OpenAI)
    const hasLinear = !!state.data.settings.linearKey;
    const hasOpenai = !!state.data.settings.openaiKey;
    const canProceed = hasLinear && (_activeTemplate === 'raw' || hasOpenai);
    if (canProceed) {
      _showLinearView('input');
      _populateProjectsAndAssignees();
    } else {
      _showLinearView('no-keys');
    }
  });
});

function _showLinearView(name) {
  // name: 'input' | 'loading' | 'preview' | 'success' | 'no-keys'
  const ids = ['input', 'loading', 'preview', 'success', 'no-keys'];
  ids.forEach((id) => {
    const el = document.getElementById(`linear-${id}-view`);
    if (el) el.style.display = id === name ? '' : 'none';
  });
}

// ── Populate project / assignee dropdowns from cached Linear data ─────────────

function _populateProjectsAndAssignees() {
  const teamId = state.data.settings.linearTeamId;
  const teams  = state.data.linearCache.teams;
  const team   = teams.find((t) => t.id === teamId) ?? teams[0];
  if (!team) return;

  const projectSel  = document.getElementById('previewProject');
  const assigneeSel = document.getElementById('previewAssignee');

  projectSel.innerHTML =
    `<option value="">— None —</option>` +
    team.projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');

  assigneeSel.innerHTML =
    `<option value="">— Unassigned —</option>` +
    team.members.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
}

// ── Generate ticket via OpenAI ────────────────────────────────────────────────

document.getElementById('btnGenerate').addEventListener('click', async () => {
  const userInput = document.getElementById('linearUserInput').value.trim();
  if (!userInput) {
    document.getElementById('linearInputError').textContent = 'Please describe the issue first.';
    return;
  }
  document.getElementById('linearInputError').textContent = '';

  // Raw mode — skip LLM, go straight to preview
  if (_activeTemplate === 'raw') {
    const firstLine = userInput.split('\n')[0].slice(0, 80);
    _populatePreview({ priority: 3, title: firstLine, description: userInput });
    _showLinearView('preview');
    return;
  }

  _showLinearView('loading');

  try {
    const ticket = await _generateTicket(userInput, _activeTemplate);
    _populatePreview(ticket);
    _showLinearView('preview');
  } catch (err) {
    _showLinearView('input');
    document.getElementById('linearInputError').textContent = `Generation failed: ${err.message}`;
  }
});

async function _generateTicket(userInput, template = 'bug') {
  const { openaiKey, openaiModel } = state.data.settings;
  const systemPrompt = TEMPLATES[template].system;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model:       openaiModel ?? 'gpt-4o',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userInput },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }

  const json   = await res.json();
  const raw    = json.choices?.[0]?.message?.content ?? '{}';
  const ticket = JSON.parse(raw);

  return {
    priority:    _priorityToInt(ticket.priority ?? 'medium'),
    title:       ticket.title       ?? '',
    description: ticket.description ?? '',
  };
}

function _priorityToInt(str) {
  return { urgent: 1, high: 2, medium: 3, low: 4, none: 0 }[str.toLowerCase()] ?? 3;
}

function _populatePreview(ticket) {
  document.getElementById('previewPriority').value    = String(ticket.priority);
  document.getElementById('previewTitle').value       = ticket.title;
  document.getElementById('previewDescription').value = ticket.description;
  document.getElementById('linearPreviewError').textContent = '';
}

// ── Back button ───────────────────────────────────────────────────────────────

document.getElementById('btnPreviewBack').addEventListener('click', () => {
  _showLinearView('input');
});

// ── Create ticket ─────────────────────────────────────────────────────────────

document.getElementById('btnCreateTicket').addEventListener('click', async () => {
  const btn = document.getElementById('btnCreateTicket');
  btn.disabled  = true;
  btn.textContent = 'Creating…';
  document.getElementById('linearPreviewError').textContent = '';

  try {
    const teamId = state.data.settings.linearTeamId
      || state.data.linearCache.teams[0]?.id;

    if (!teamId) throw new Error('No Linear team found. Test connection in Settings.');

    const vars = {
      teamId,
      title:      document.getElementById('previewTitle').value.trim(),
      description:document.getElementById('previewDescription').value.trim(),
      priority:   parseInt(document.getElementById('previewPriority').value, 10),
      projectId:  document.getElementById('previewProject').value  || null,
      assigneeId: document.getElementById('previewAssignee').value || null,
    };

    if (!vars.title) throw new Error('Title is required.');

    const mutation = `
      mutation CreateIssue(
        $teamId: String!, $title: String!, $description: String,
        $priority: Int, $projectId: String, $assigneeId: String
      ) {
        issueCreate(input: {
          teamId: $teamId, title: $title, description: $description,
          priority: $priority, projectId: $projectId, assigneeId: $assigneeId
        }) {
          success
          issue { id title url }
        }
      }`;

    const res  = await _linearGql(mutation, vars);
    const data = await _checkGql(res);

    if (!data.issueCreate.success) throw new Error('Linear returned success: false');

    const issue = data.issueCreate.issue;
    document.getElementById('linearTicketUrl').href        = issue.url;
    document.getElementById('linearTicketUrl').textContent = `${issue.title} →`;
    // Clear the saved draft now that it's been submitted
    ui.linearInput = '';
    saveUiState();
    _showLinearView('success');

  } catch (err) {
    document.getElementById('linearPreviewError').textContent = err.message;
  } finally {
    btn.disabled  = false;
    btn.textContent = 'Create ticket';
  }
});

// ── Reset ─────────────────────────────────────────────────────────────────────

document.getElementById('btnLinearReset').addEventListener('click', () => {
  document.getElementById('linearUserInput').value = '';
  document.getElementById('linearInputError').textContent = '';
  ui.linearInput = '';
  saveUiState();
  _applyTemplate(_activeTemplate);
  _showLinearView('input');
});

// ── Voice input (Web Speech API) ──────────────────────────────────────────────

document.getElementById('btnMic').addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { showToast('Voice input not supported in this browser'); return; }

  const btn = document.getElementById('btnMic');

  if (_recognition) {
    _recognition.stop();
    return;
  }

  _recognition = new SpeechRecognition();
  _recognition.continuous    = true;
  _recognition.interimResults = true;
  _recognition.lang          = 'en-US';

  const textarea = document.getElementById('linearUserInput');
  const base     = textarea.value;

  _recognition.onstart = () => {
    btn.classList.add('recording');
    btn.title = 'Stop recording';
  };

  _recognition.onresult = (e) => {
    let transcript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    textarea.value = base + (base ? ' ' : '') + transcript;
  };

  _recognition.onerror = (e) => {
    showToast(`Mic error: ${e.error}`);
    _stopRecognition(btn);
  };

  _recognition.onend = () => _stopRecognition(btn);

  _recognition.start();
});

function _stopRecognition(btn) {
  _recognition = null;
  btn.classList.remove('recording');
  btn.title = 'Dictate';
}
