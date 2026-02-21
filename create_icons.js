#!/usr/bin/env node
/**
 * Generates PNG icons for the Snippet Box Chrome extension.
 * Run once: node create_icons.js
 * No external dependencies — uses Node's built-in zlib.
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// Accent colour: #2C5F41 (forest green)
const BG = [0x2C, 0x5F, 0x41];
const FG = [255, 255, 255]; // white lines

// ─── CRC32 ───────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── PNG chunk ───────────────────────────────────────────────────────────────

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return out;
}

// ─── Icon pixel logic ────────────────────────────────────────────────────────
// Draws a rounded-rect with three horizontal white lines (snippet lines)

function pixelColor(x, y, size) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const hw = size * 0.44; // half-width
  const hh = size * 0.44; // half-height
  const cr = size * 0.18; // corner radius

  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);

  // Outside bounding box → transparent
  if (dx > hw || dy > hh) return null;

  // Corner rounding
  if (dx > hw - cr && dy > hh - cr) {
    const ex = dx - (hw - cr);
    const ey = dy - (hh - cr);
    if (Math.sqrt(ex * ex + ey * ey) > cr) return null;
  }

  // Relative coordinates inside the icon (0→1)
  const rx = (x - (cx - hw)) / (hw * 2);
  const ry = (y - (cy - hh)) / (hh * 2);

  // Margins for the "paper" lines
  const lx0 = 0.18;
  const lx1 = 0.82;
  const inX = rx >= lx0 && rx <= lx1;

  // Three lines at fixed vertical positions
  const lineThickness = Math.max(0.055, 1.4 / size);
  const lines = [0.28, 0.47, 0.66];
  const shortLine = 0.62; // last line is shorter (typical document look)

  for (let i = 0; i < lines.length; i++) {
    const ly = lines[i];
    const x1 = i === lines.length - 1 ? shortLine : lx1;
    if (Math.abs(ry - ly) < lineThickness && rx >= lx0 && rx <= x1) {
      return FG;
    }
  }

  return BG;
}

// ─── Build PNG ───────────────────────────────────────────────────────────────

function buildPNG(size) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: RGBA
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // bytes 10-12: compression, filter, interlace = 0

  // Raw scanline data
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte: None
    for (let x = 0; x < size; x++) {
      const color = pixelColor(x, y, size);
      if (color === null) {
        row.push(0, 0, 0, 0); // transparent
      } else {
        row.push(color[0], color[1], color[2], 255);
      }
    }
    rows.push(Buffer.from(row));
  }

  const raw = Buffer.concat(rows);
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Write files ─────────────────────────────────────────────────────────────

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

for (const size of [16, 48, 128]) {
  const png = buildPNG(size);
  const dest = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`✓ icons/icon${size}.png  (${png.length} bytes)`);
}

console.log('\nDone! Load the extension in Chrome:');
console.log('  chrome://extensions → Load unpacked → select this folder');
