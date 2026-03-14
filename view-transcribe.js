'use strict';

// ─── Transcribe view ──────────────────────────────────────────────────────────

let _transcribeAudioFile = null;

function renderTranscribe() {
  const hasKey = !!state.data.settings.openaiKey;
  document.getElementById('transcribeNoKeyMsg').style.display = hasKey ? 'none' : 'flex';
}

// ── Source toggle ─────────────────────────────────────────────────────────────

document.querySelectorAll('.transcribe-source-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.transcribe-source-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const isYoutube = btn.dataset.source === 'youtube';
    document.getElementById('transcribe-youtube-section').style.display = isYoutube ? 'block' : 'none';
    document.getElementById('transcribe-audio-section').style.display   = isYoutube ? 'none' : 'block';
    _setStatus('', false);
  });
});

// ── File picker ───────────────────────────────────────────────────────────────

document.getElementById('transcribeFileDrop').addEventListener('click', () => {
  document.getElementById('transcribeAudioInput').click();
});

document.getElementById('transcribeFileDrop').addEventListener('dragover', (e) => {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
});
document.getElementById('transcribeFileDrop').addEventListener('dragleave', (e) => {
  e.currentTarget.classList.remove('drag-over');
});
document.getElementById('transcribeFileDrop').addEventListener('drop', (e) => {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) _setAudioFile(file);
});

document.getElementById('transcribeAudioInput').addEventListener('change', function () {
  if (this.files[0]) _setAudioFile(this.files[0]);
});

function _setAudioFile(file) {
  _transcribeAudioFile = file;
  document.getElementById('transcribeFileName').textContent = file.name;
}

// ── YouTube transcript ────────────────────────────────────────────────────────

document.getElementById('btnTranscribeYoutube').addEventListener('click', async () => {
  const url = document.getElementById('transcribeYoutubeUrl').value.trim();
  if (!url) { _setStatus('Paste a YouTube URL first.', true); return; }

  const videoId = _extractYouTubeId(url);
  if (!videoId) { _setStatus('Could not find a video ID in that URL.', true); return; }

  _setStatus('Fetching transcript…', false);
  _setLoading(true, 'btnTranscribeYoutube', 'Fetching…');

  try {
    const transcript = await _fetchYouTubeTranscript(videoId);
    _showOutput(transcript);
    _setStatus('', false);
  } catch (err) {
    _setStatus(err.message, true);
  } finally {
    _setLoading(false, 'btnTranscribeYoutube', 'Fetch Transcript');
  }
});

function _extractYouTubeId(url) {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function _fetchYouTubeTranscript(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!res.ok) throw new Error(`Could not load video page (HTTP ${res.status}).`);

  const html = await res.text();

  // Extract ytInitialPlayerResponse by balancing braces from the key
  const jsonStr = _extractJson(html, 'ytInitialPlayerResponse');
  if (!jsonStr) throw new Error('Could not parse the YouTube page. Try again or check the URL.');

  let playerResponse;
  try { playerResponse = JSON.parse(jsonStr); } catch {
    throw new Error('Failed to parse YouTube player data.');
  }

  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) throw new Error('No captions available for this video.');

  // Prefer English (manual first, then auto-generated)
  const track =
    tracks.find((t) => t.languageCode?.startsWith('en') && t.kind !== 'asr') ??
    tracks.find((t) => t.languageCode?.startsWith('en')) ??
    tracks[0];

  const captionRes = await fetch(track.baseUrl);
  if (!captionRes.ok) throw new Error('Failed to fetch caption data.');

  const xml = await captionRes.text();
  return _parseYouTubeCaptionXml(xml);
}

function _extractJson(html, key) {
  const marker = `${key} = `;
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const brace = html.indexOf('{', start + marker.length);
  if (brace === -1) return null;

  let depth = 0;
  let inStr  = false;
  let esc    = false;

  for (let i = brace; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return html.slice(brace, i + 1); }
  }
  return null;
}

function _parseYouTubeCaptionXml(xml) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xml, 'text/xml');
  const texts  = Array.from(doc.querySelectorAll('text'));
  return texts
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .join('\n');
}

// ── Audio transcription (OpenAI Whisper) ──────────────────────────────────────

document.getElementById('transcribeGoSettings').addEventListener('click', () => switchTab('settings'));

document.getElementById('btnTranscribeAudio').addEventListener('click', async () => {
  const hasKey = !!state.data.settings.openaiKey;
  if (!hasKey) { _setStatus('Add your OpenAI API key in Settings first.', true); return; }
  if (!_transcribeAudioFile) { _setStatus('Select an audio file first.', true); return; }

  _setStatus('Uploading and transcribing…', false);
  _setLoading(true, 'btnTranscribeAudio', 'Transcribing…');

  try {
    const transcript = await _whisperTranscribe(_transcribeAudioFile);
    _showOutput(transcript);
    _setStatus('', false);
  } catch (err) {
    _setStatus(err.message, true);
  } finally {
    _setLoading(false, 'btnTranscribeAudio', 'Transcribe');
  }
});

async function _whisperTranscribe(file) {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${state.data.settings.openaiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }

  return await res.text();
}

// ── Output actions ────────────────────────────────────────────────────────────

document.getElementById('btnTranscribeCopy').addEventListener('click', async () => {
  const text = document.getElementById('transcribeOutput').value;
  await navigator.clipboard.writeText(text).catch(() => {});
  const btn = document.getElementById('btnTranscribeCopy');
  const orig = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = orig; }, 1500);
});

document.getElementById('btnTranscribeSnippet').addEventListener('click', async () => {
  const text = document.getElementById('transcribeOutput').value;
  if (!text) return;

  const url   = document.getElementById('transcribeYoutubeUrl').value.trim();
  const title = url ? `Transcript — ${url.slice(0, 50)}` : `Transcript — ${_transcribeAudioFile?.name ?? 'audio'}`;

  state.data.looseSnippets.push({ id: uid(), title, content: text });
  await saveData();
  showToast('Saved as snippet');
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function _showOutput(text) {
  const out = document.getElementById('transcribeOutput');
  out.value = text;
  document.getElementById('transcribeOutputSection').style.display = 'block';
}

function _setStatus(msg, isError) {
  const el = document.getElementById('transcribeStatus');
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent  = msg;
  el.style.display = 'block';
  el.className = 'transcribe-status' + (isError ? ' error' : '');
}

function _setLoading(loading, btnId, label) {
  const btn = document.getElementById(btnId);
  btn.textContent = label;
  btn.disabled    = loading;
}
