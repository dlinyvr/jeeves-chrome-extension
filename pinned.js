'use strict';

const params = new URLSearchParams(location.search);
const text   = params.get('text') || '';
const href   = params.get('href')  || '';

const pinText  = document.getElementById('pinText');
const pinClose = document.getElementById('pinClose');

// Render content
if (href) {
  const a = document.createElement('a');
  a.href   = href;
  a.target = '_blank';
  a.rel    = 'noopener';
  a.textContent = text || href;
  pinText.appendChild(a);
} else {
  pinText.textContent = text;
}

// Close button
pinClose.addEventListener('click', () => window.close());

// Fade on hover — use JS so opacity doesn't kill child elements
let _fadeTimer = null;
document.addEventListener('mouseover', () => {
  clearTimeout(_fadeTimer);
  _fadeTimer = setTimeout(() => document.body.classList.add('faded'), 600);
});
document.addEventListener('mouseout', (e) => {
  if (e.relatedTarget) return; // still inside window
  clearTimeout(_fadeTimer);
  document.body.classList.remove('faded');
});

// Resize window to fit content after render.
// Chrome popup windows on macOS have a ~28px title bar that counts against
// the window height, so we add it back so content isn't clipped.
requestAnimationFrame(() => {
  const wrap        = document.getElementById('pinWrap');
  const contentH    = Math.max(52, Math.min(wrap.scrollHeight + 4, 140));
  const titleBarH   = window.outerHeight - window.innerHeight; // actual chrome overhead
  const totalHeight = contentH + Math.max(titleBarH, 28);
  if (typeof chrome !== 'undefined' && chrome.windows) {
    chrome.windows.getCurrent((win) => {
      chrome.windows.update(win.id, { height: totalHeight });
    });
  }
});
