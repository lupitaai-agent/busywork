/* Readable text from the files people keep in Busy, for search (and later for Ivy): PDF, Word (.docx),
   PowerPoint (.pptx), Excel (.xlsx), OpenDocument (.odt, .odp, .ods) and RTF. Runs in the browser
   with no library and no network: Office files are zip files of XML, and PDFs are read with a small
   parser that follows the fonts' own maps to Unicode. Good enough for finding a file again; not a
   page renderer. Anything it can't read (scans, protected PDFs, old .doc) simply has no text. */
(function () {
  'use strict';
  const BW = (window.BW = window.BW || {});
  const FT = (BW.fileText = {});
  const MAX = 20000; // characters kept per file

  // Inflate with the browser's own decompressor. PDF streams sometimes carry junk after the data:
  // keep what came out before the decompressor gave up.
  async function inflate(bytes, format) {
    const ds = new DecompressionStream(format), w = ds.writable.getWriter();
    w.write(bytes).catch(() => {}); w.close().catch(() => {});
    const r = ds.readable.getReader(), parts = [];
    let n = 0;
    try { for (;;) { const { done, value } = await r.read(); if (done) break; parts.push(value); n += value.length; } } catch (e) { /* partial output */ }
    const out = new Uint8Array(n); let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
  }
  const latin1 = (b) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return s; };
  const tidy = (s) => s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX);

  // ---------- zip (Office and OpenDocument files) ----------
  FT.unzip = async (bytes, want) => {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return {};
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const out = {}, dec = new TextDecoder();
    for (let k = 0; k < count && v.getUint32(p, true) === 0x02014b50; k++) {
      const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
      const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true), name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extra + comment;
      if (!want(name)) continue;
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const raw = bytes.subarray(start, start + size);
      const data = method === 0 ? raw : method === 8 ? await inflate(raw, 'deflate-raw') : null;
      if (data) out[name] = dec.decode(data);
    }
    return out;
  };
  const xmlText = (xml) => xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
  // Word: <w:t> runs, a new line per paragraph, tabs and breaks kept.
  const docxText = (xml) => xmlText(xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n')
    .replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, '\u0001$1\u0002').replace(/<[^>]+>/g, '').replace(/\u0002[^\u0001\n\t]*/g, '').replace(/\u0001/g, ''));
  const tagText = (xml, tag) => xmlText((xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'g')) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(' '));
  const order = (names) => names.sort((a, b) => (Number((a.match(/(\d+)\.xml$/) || [])[1]) || 0) - (Number((b.match(/(\d+)\.xml$/) || [])[1]) || 0));

  FT.office = async (name, bytes) => {
    const ext = (name.match(/\.([a-z]+)$/i) || [, ''])[1].toLowerCase();
    if (ext === 'docx') { const f = await FT.unzip(bytes, (n) => /^word\/(document|footnotes|endnotes)\.xml$/.test(n)); return tidy(['word/document.xml', 'word/footnotes.xml', 'word/endnotes.xml'].map((n) => f[n] ? docxText(f[n]) : '').join('\n')); }
    if (ext === 'pptx') { const f = await FT.unzip(bytes, (n) => /^ppt\/(slides|notesSlides)\/\w+\d+\.xml$/.test(n)); return tidy(order(Object.keys(f)).map((n) => tagText(f[n].replace(/<\/a:p>/g, '\n</a:p>'), 'a:t')).join('\n')); }
    if (ext === 'xlsx') { const f = await FT.unzip(bytes, (n) => n === 'xl/sharedStrings.xml'); return tidy(f['xl/sharedStrings.xml'] ? tagText(f['xl/sharedStrings.xml'], 't').replace(/ (?=\S)/g, ' ') : ''); }
    if (/^od[tps]$/.test(ext)) { const f = await FT.unzip(bytes, (n) => n === 'content.xml'); return tidy(f['content.xml'] ? xmlText(f['content.xml'].replace(/<\/text:(p|h)>/g, '\n').replace(/<text:tab\/>/g, '\t').replace(/<text:s[^>]*\/>/g, ' ').replace(/<[^>]+>/g, '')) : ''); }
    return '';
  };
  // RTF: skip the groups that hold no text (fonts, colours, styles, pictures), then the control words.
  const RTF_SKIP = /^\{\\(\*|fonttbl|colortbl|stylesheet|info|pict|header|footer)/;
  FT.rtf = (src) => {
    const s = String(src).replace(/\\\\/g, '\u0003').replace(/\\\{/g, '\u0001').replace(/\\\}/g, '\u0002');
    let out = '';
    for (let i = 0; i < s.length;) {
      if (s[i] === '{' && RTF_SKIP.test(s.slice(i, i + 14))) {
        let depth = 0;
        for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}' && --depth === 0) { i++; break; } }
        continue;
      }
      out += s[i++];
    }
    return tidy(out.replace(/\\\r?\n/g, '\n').replace(/\\(par|line)\b ?/g, '\n').replace(/\\tab\b ?/g, '\t')
      .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\u(-?\d+) ?\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
      .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\u0001/g, '{').replace(/\u0002/g, '}').replace(/\u0003/g, '\\'));
  };

  // ---------- PDF ----------
  // A tiny reader for PDF syntax: values, then objects, then the text operators in page content.
  function lexer(s, at = 0) {
    const ws = /[\s\0]/;
    const skip = () => { for (;;) { while (at < s.length && ws.test(s[at])) at++; if (s[at] === '%') { while (at < s.length && s[at] !== '\n' && s[at] !== '\r') at++; } else break; } };
    function value() {
      skip();
      const c = s[at];
      if (c === undefined) return undefined;
      if (c === '<' && s[at + 1] === '<') {
        at += 2; const d = {};
        for (;;) { skip(); if (s[at] === '>' && s[at + 1] === '>') { at += 2; return d; } if (at >= s.length) return d; const k = value(); if (k === undefined) return d; d[typeof k === 'object' && k.name ? k.name : String(k)] = value(); }
      }
      if (c === '<') { const end = s.indexOf('>', at); const h = s.slice(at + 1, end).replace(/\s/g, ''); at = end + 1; return { hex: h.length % 2 ? h + '0' : h }; }
      if (c === '[') { at++; const a = []; for (;;) { skip(); if (s[at] === ']') { at++; return a; } if (at >= s.length) return a; const x = value(); if (x === undefined) return a; a.push(x); } }
      if (c === '(') { // literal string, with escapes and nested brackets
        at++; let depth = 1, out = '';
        while (at < s.length) {
          const ch = s[at++];
          if (ch === '\\') {
            const n = s[at++];
            const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
            if (map[n] !== undefined) out += map[n];
            else if (/[0-7]/.test(n)) { let o = n; while (o.length < 3 && /[0-7]/.test(s[at])) o += s[at++]; out += String.fromCharCode(parseInt(o, 8) & 255); }
            else if (n === '\r') { if (s[at] === '\n') at++; } else if (n !== '\n') out += n;
          } else if (ch === '(') { depth++; out += ch; } else if (ch === ')') { if (--depth === 0) break; out += ch; } else out += ch;
        }
        return { str: out };
      }
      if (c === '/') { let e = at + 1; while (e < s.length && !/[\s\0/\[\]<>(){}%]/.test(s[e])) e++; const n = s.slice(at + 1, e).replace(/#([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))); at = e; return { name: n }; }
      if (c === ']' || c === '>' || c === ')' || c === '{' || c === '}') { at++; return { op: c }; }
      let e = at; while (e < s.length && !/[\s\0/\[\]<>(){}%]/.test(s[e])) e++;
      const w = s.slice(at, e); at = e;
      if (/^\d+$/.test(w)) { const r = /^\s+\d+\s+R(?![A-Za-z0-9])/.exec(s.slice(at, at + 24)); if (r) { at += r[0].length; return { ref: Number(w) }; } } // "12 0 R"
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) return Number(w);
      return w === 'true' ? true : w === 'false' ? false : w === 'null' ? null : { op: w };
    }
    return { value, get at() { return at; }, set at(v) { at = v; }, skip };
  }

  async function pdfObjects(bytes) {
    const s = latin1(bytes), objs = new Map();
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m;
    while ((m = re.exec(s))) {
      const lx = lexer(s, re.lastIndex), dict = lx.value();
      lx.skip();
      let stream = null;
      if (s.startsWith('stream', lx.at)) {
        let st = lx.at + 6; if (s[st] === '\r') st++; if (s[st] === '\n') st++;
        const len = dict && typeof dict.Length === 'number' ? dict.Length : -1;
        // Trust /Length when "endstream" follows it; otherwise look for "endstream".
        let end = len >= 0 && /^\s*endstream/.test(s.slice(st + len, st + len + 14)) ? st + len : s.indexOf('endstream', st);
        if (end < 0) end = s.length;
        stream = bytes.subarray(st, end);
        re.lastIndex = end;
      }
      objs.set(Number(m[1]), { dict, stream });
    }
    // Objects packed into object streams (PDF 1.5 and later).
    for (const o of [...objs.values()]) {
      if (!o.dict || !o.dict.Type || o.dict.Type.name !== 'ObjStm' || !o.stream) continue;
      const data = latin1(await decode(o));
      const first = Number(o.dict.First) || 0, head = data.slice(0, first).trim().split(/\s+/).map(Number);
      for (let i = 0; i + 1 < head.length; i += 2) if (!objs.has(head[i])) objs.set(head[i], { dict: lexer(data, first + head[i + 1]).value(), stream: null });
    }
    return objs;
  }
  async function decode(o) {
    const f = o.dict && o.dict.Filter, filters = Array.isArray(f) ? f : f ? [f] : [];
    let data = o.stream;
    for (const x of filters) {
      if (x.name === 'FlateDecode' || x.name === 'Fl') data = await inflate(data, 'deflate');
      else return new Uint8Array(0); // images and rare filters: no text
    }
    return data;
  }

  // Maps from a font's codes to Unicode, from its ToUnicode CMap.
  function parseCMap(src) {
    const map = new Map(); let bytes = 1;
    const cs = /begincodespacerange([\s\S]*?)endcodespacerange/g.exec(src);
    if (cs) { const h = /<([0-9a-f]+)>/i.exec(cs[1]); if (h) bytes = h[1].length / 2; }
    const u16 = (h) => { let out = ''; for (let i = 0; i + 3 < h.length; i += 4) out += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return out.length ? out : String.fromCharCode(parseInt(h, 16)); };
    for (const blk of src.match(/beginbfchar[\s\S]*?endbfchar/g) || []) for (const m of blk.matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(m[1], 16), u16(m[2]));
    for (const blk of src.match(/beginbfrange[\s\S]*?endbfrange/g) || []) {
      for (const m of blk.matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(<([0-9a-f]+)>|\[([^\]]*)\])/gi)) {
        const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
        if (m[4]) { const base = parseInt(m[4], 16); for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, m[4].length > 4 ? u16(m[4].slice(0, -4) + (parseInt(m[4].slice(-4), 16) + c - lo).toString(16).padStart(4, '0')) : String.fromCharCode(base + c - lo)); }
        else { const list = [...m[5].matchAll(/<([0-9a-f]+)>/gi)].map((x) => u16(x[1])); list.forEach((u, i) => map.set(lo + i, u)); }
      }
    }
    return { map, bytes };
  }
  // A few glyph names for fonts that list their own /Differences (letters and digits are their own names).
  const GLYPHS = { space: ' ', period: '.', comma: ',', hyphen: '-', colon: ':', semicolon: ';', quoteright: '’', quoteleft: '‘', quotedbl: '"', quotesingle: "'", exclam: '!', question: '?', parenleft: '(', parenright: ')', slash: '/', ampersand: '&', at: '@', percent: '%', endash: '–', emdash: '—', bullet: '•', fi: 'fi', fl: 'fl', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', eacute: 'é', egrave: 'è', ediaeresis: 'ë', adieresis: 'ä', odieresis: 'ö', udieresis: 'ü', ccedilla: 'ç' };
  const WIN = { 0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™' };
  // Mac fonts (/MacRomanEncoding) put accented letters at other codes than Windows does.
  const MAC = "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xa0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\uf8ffÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"; // codes 128 to 255

  async function fontDecoder(ref, objs) {
    const get = (v) => (v && v.ref != null ? (objs.get(v.ref) || {}).dict : v);
    const font = get(ref) || {};
    const tu = font.ToUnicode && objs.get(font.ToUnicode.ref);
    const cmap = tu && tu.stream ? parseCMap(latin1(await decode(tu))) : null;
    const two = !cmap && font.Subtype && font.Subtype.name === 'Type0';
    const enc = get(font.Encoding), diff = new Map();
    const encName = enc && enc.name ? enc.name : enc && enc.BaseEncoding && enc.BaseEncoding.name;
    const mac = encName === 'MacRomanEncoding';
    if (enc && Array.isArray(enc.Differences)) { let code = 0; for (const d of enc.Differences) { if (typeof d === 'number') code = d; else if (d && d.name) diff.set(code++, GLYPHS[d.name] || (d.name.length === 1 ? d.name : '')); } }
    return (str) => {
      let out = '';
      const step = cmap ? cmap.bytes : two ? 2 : 1;
      for (let i = 0; i < str.length; i += step) {
        let code = 0; for (let k = 0; k < step; k++) code = code * 256 + (str.charCodeAt(i + k) || 0);
        if (cmap) { const u = cmap.map.get(code); out += u == null ? '' : u; }
        else if (two) out += '';
        else if (diff.has(code)) out += diff.get(code);
        else if (mac && code >= 128) out += MAC[code - 128];
        else out += WIN[code] || (code >= 32 && (code < 127 || code >= 160) ? String.fromCharCode(code) : '');
      }
      return out;
    };
  }

  // The text of one content stream: strings shown with Tj, TJ, ' and ", lines from the moves between them.
  function showText(content, fonts) {
    const lx = lexer(content); let out = '', ops = [], dec = (s) => s, lastY = null;
    const strOf = (v) => (v && v.str != null ? v.str : v && v.hex != null ? v.hex.replace(/../g, (h) => String.fromCharCode(parseInt(h, 16))) : '');
    for (let guard = 0; guard < 2e6; guard++) {
      const v = lx.value();
      if (v === undefined) break;
      if (!(v && v.op && /^[A-Za-z'"*]+$/.test(v.op))) { ops.push(v); continue; }
      const op = v.op;
      if (op === 'BI') { const ei = content.indexOf('EI', lx.at); lx.at = ei < 0 ? content.length : ei + 2; ops = []; continue; }
      if (op === 'Tf') dec = fonts[(ops[0] && ops[0].name) || ''] || ((s) => s);
      else if (op === 'Tj') out += dec(strOf(ops[0]));
      else if (op === "'" || op === '"') out += '\n' + dec(strOf(ops[ops.length - 1]));
      else if (op === 'TJ') for (const x of ops[0] || []) { if (typeof x === 'number') { if (x < -180) out += ' '; } else out += dec(strOf(x)); }
      else if (op === 'Td' || op === 'TD') { const y = Number(ops[1]) || 0; out += y !== 0 ? '\n' : ' '; }
      else if (op === 'T*') out += '\n';
      else if (op === 'Tm') { const y = Number(ops[5]); out += lastY == null || Math.abs(y - lastY) > 1 ? '\n' : ' '; lastY = y; }
      else if (op === 'ET') out += ' ';
      ops = [];
    }
    return out;
  }

  FT.pdf = async (bytes) => {
    if (latin1(bytes.subarray(0, 5)) !== '%PDF-') return '';
    const objs = await pdfObjects(bytes);
    if ([...objs.values()].some((o) => o.dict && o.dict.Filter && o.dict.Filter.name === 'Standard') || /\/Encrypt\s/.test(latin1(bytes.subarray(Math.max(0, bytes.length - 4096))))) return ''; // protected
    const get = (v) => (v && v.ref != null ? (objs.get(v.ref) || {}).dict : v);
    const pages = [...objs.entries()].filter(([, o]) => o.dict && o.dict.Type && o.dict.Type.name === 'Page').map(([n, o]) => [n, o.dict]).sort((a, b) => a[0] - b[0]);
    const cache = new Map();
    let text = '';
    for (const [, page] of pages) {
      let res = get(page.Resources), node = page;
      while (!res && node && node.Parent) { node = get(node.Parent); res = node && get(node.Resources); }
      const fontDict = get(res && res.Font) || {}, fonts = {};
      for (const [name, ref] of Object.entries(fontDict)) {
        const key = ref && ref.ref != null ? ref.ref : name;
        if (!cache.has(key)) cache.set(key, await fontDecoder(ref, objs));
        fonts[name] = cache.get(key);
      }
      const contents = Array.isArray(get(page.Contents)) ? get(page.Contents) : page.Contents ? [page.Contents] : [];
      let src = '';
      for (const c of contents) { const o = c && c.ref != null ? objs.get(c.ref) : null; if (o && o.stream) src += latin1(await decode(o)) + '\n'; }
      text += showText(src, fonts) + '\n\n';
      if (text.length > MAX * 2) break;
    }
    return tidy(text);
  };

  // ---------- one entry point ----------
  FT.CAN = /\.(pdf|docx|pptx|xlsx|odt|odp|ods|rtf)$/i;
  FT.read = async (name, blob) => {
    try {
      if (/\.pdf$/i.test(name)) return await FT.pdf(new Uint8Array(await blob.arrayBuffer()));
      if (/\.rtf$/i.test(name)) return FT.rtf(await blob.text());
      if (FT.CAN.test(name)) return await FT.office(name, new Uint8Array(await blob.arrayBuffer()));
    } catch (e) { console.warn('No text from', name, e); }
    return '';
  };
})();
