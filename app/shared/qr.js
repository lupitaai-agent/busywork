/* QR codes without a library: byte mode, error correction level M, versions 1–13.
   Enough for SEPA scan-to-pay codes (which must stay at version 13 or lower) and web addresses.
   Follows ISO/IEC 18004; the structure mirrors Project Nayuki's reference implementation. */
(function () {
  'use strict';
  const BW = window.BW;

  // Level M per version: [error-correction codewords per block, blocks in group 1, data codewords per group-1 block, blocks in group 2]
  // Group-2 blocks hold one more data codeword than group-1 blocks.
  const M = [null, [10, 1, 16, 0], [16, 1, 28, 0], [26, 1, 44, 0], [18, 2, 32, 0], [24, 2, 43, 0], [16, 4, 27, 0], [18, 4, 31, 0],
    [22, 2, 38, 2], [22, 3, 36, 2], [26, 4, 43, 1], [30, 1, 50, 4], [22, 6, 36, 2], [22, 8, 37, 1]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62]];

  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  function rsMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDivisor(degree) {
    const r = new Array(degree - 1).fill(0).concat([1]);
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < r.length; j++) { r[j] = rsMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = rsMul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= rsMul(c, f); }); }
    return r;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let ver = 1;
    for (; ver <= 13; ver++) {
      const [, b1, d1, b2] = M[ver];
      const cap = (b1 * d1 + b2 * (d1 + 1)) * 8;
      if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= cap) break;
    }
    if (ver > 13) throw new Error('That is too much text for a QR code.');
    const [ecLen, b1, d1, b2] = M[ver];
    const dataLen = b1 * d1 + b2 * (d1 + 1);

    // Bit stream: mode, length, bytes, terminator, padding.
    const bits = [];
    const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    push(4, 4); push(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => push(b, 8));
    push(0, Math.min(4, dataLen * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let p = 0xEC; bits.length < dataLen * 8; p ^= 0xEC ^ 0x11) push(p, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

    // Split into blocks, add error correction, interleave.
    const div = rsDivisor(ecLen), blocks = [];
    let k = 0;
    for (let i = 0; i < b1 + b2; i++) {
      const len = i < b1 ? d1 : d1 + 1;
      const d = data.slice(k, k + len); k += len;
      blocks.push({ d, e: rsRemainder(d, div) });
    }
    const out = [];
    for (let i = 0; i <= d1; i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]); });
    for (let i = 0; i < ecLen; i++) blocks.forEach((b) => out.push(b.e[i]));

    // Function patterns.
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = ALIGN[ver], last = al.length - 1;
    al.forEach((ax, i) => al.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const formatBits = (mask) => {
      const d = (0 << 3) | mask; // level M = 00
      let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
      set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
      set(8, size - 8, true);
    };
    formatBits(0);
    if (ver >= 7) {
      let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bit(b, i)); set(c, a, bit(b, i)); }
    }

    // Data in a zigzag from the bottom-right corner.
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!fn[y][x] && i < out.length * 8) { mod[y][x] = bit(out[i >>> 3], 7 - (i & 7)); i++; }
      }
    }

    // Try all eight masks; keep the one that scanners find easiest.
    const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const apply = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && masks[m](x, y)) mod[y][x] = !mod[y][x]; };
    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      apply(m); formatBits(m);
      const s = penalty(mod, size);
      if (s < bestScore) { bestScore = s; best = m; }
      apply(m);
    }
    apply(best); formatBits(best);
    return mod;
  }

  function penalty(m, n) {
    let score = 0;
    const lines = [];
    for (let i = 0; i < n; i++) { lines.push(m[i]); lines.push(m.map((r) => r[i])); }
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && line[i] === line[i - 1]) run++;
        else { if (run >= 5) score += 3 + run - 5; run = 1; }
      }
      const s = line.map((d) => (d ? 1 : 0)).join('');
      for (const p of ['10111010000', '00001011101']) { let at = s.indexOf(p); while (at >= 0) { score += 40; at = s.indexOf(p, at + 1); } }
    }
    let dark = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
    score += Math.max(0, Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
    return score;
  }

  BW.qr = {
    encode,
    // An SVG string, for showing a code on screen.
    svg(text, px = 4) {
      const m = encode(text), n = m.length, q = 4, s = (n + q * 2) * px;
      let d = '';
      m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${(x + q) * px},${(y + q) * px}h${px}v${px}h-${px}z`; }));
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
    },
    // Draws the code into a BW.pdf.Doc at x, y (top-left), size in points. Joins dark runs to keep the file small.
    pdf(doc, text, x, y, size) {
      const m = encode(text), n = m.length, u = size / n;
      doc.rect(x - u * 2, y - u * 2, size + u * 4, size + u * 4, { fill: '#FFFFFF' });
      m.forEach((row, ry) => {
        for (let cx = 0; cx < n; cx++) {
          if (!row[cx]) continue;
          let end = cx; while (end + 1 < n && row[end + 1]) end++;
          doc.rect(x + cx * u, y + ry * u, (end - cx + 1) * u + 0.05, u + 0.05, { fill: '#000000' });
          cx = end;
        }
      });
    },
    // SEPA credit transfer ("EPC QR", "GiroCode"): banking apps fill in name, IBAN, amount and reference.
    epc({ name, iban, bic, amount, text }) {
      return ['BCD', '002', '1', 'SCT', (bic || '').replace(/\s/g, ''), String(name || '').slice(0, 70), String(iban || '').replace(/\s/g, '').toUpperCase(),
        'EUR' + Number(amount).toFixed(2), '', '', String(text || '').slice(0, 140)].join('\n');
    },
  };
})();
