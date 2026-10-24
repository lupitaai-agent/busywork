/* Busywork core: storage, business details, onboarding and the shared UI bits.
   A plain script rather than a module, because module scripts refuse to load
   when a page is opened straight from disk (file://). */
(function () {
  'use strict';
  const BW = (window.BW = window.BW || {});

  BW.brand = { name: 'Busywork', tagline: 'Boring business stuff, made fun.' };
  // The website. build.py puts the real address in the copies it publishes and zips.
  BW.siteUrl = 'https://busywork.example';

  // Every tool in the suite. `ready: false` tools show as "coming soon" on the home screen.
  // Every tool in the suite. `ready: false` tools show on the home screen as "on the workbench".
  BW.apps = [
    { id: 'invoices', name: 'Invoices & Quotes', emoji: '🧾', color: 'tomato', ready: true, tagline: 'Get paid without the paperwork pain.' },
    { id: 'clients', name: 'Client Book', emoji: '📇', color: 'sky', ready: true, tagline: 'Everyone you work with, in one friendly place.' },
    { id: 'time', name: 'Time Tracker', emoji: '⏱️', color: 'mint', ready: true, tagline: 'Tap start, do the work, bill the hours.' },
    { id: 'expenses', name: 'Receipts & Expenses', emoji: '📸', color: 'sun', ready: true, tagline: 'Snap the receipt. Done. Your accountant will love you.' },
    { id: 'money', name: 'Money Dashboard', emoji: '📈', color: 'grape', ready: true, tagline: 'What came in, what went out, what to set aside.' },
    { id: 'board', name: 'Project Board', emoji: '🗂️', color: 'teal', ready: true, tagline: 'Drag your to-dos from "ugh" to "done".' },
    { id: 'docs', name: 'Document Maker', emoji: '📝', color: 'sky', ready: true, tagline: 'Letters, reminders and agreements, filled in for you.' },
    { id: 'brand', name: 'Brand Kit', emoji: '🎨', color: 'pink', ready: true, tagline: 'Your colours, an email signature and business cards.' },
    { id: 'subscriptions', name: 'Subscriptions', emoji: '🔁', color: 'grape', ready: true, tagline: 'Every monthly bill, and when it renews.' },
    { id: 'trips', name: 'Trip Log', emoji: '🚗', color: 'mint', ready: true, tagline: 'Log business kilometres for the taxman.' },
    { id: 'stock', name: 'Stock Keeper', emoji: '📦', color: 'sun', ready: true, tagline: 'Know what is on the shelf before it runs out.' },
    { id: 'marketing', name: 'Marketing Studio', emoji: '📣', color: 'pink', ready: true, tagline: 'Do your own marketing, the way brands really grow.' },
    { id: 'olaf', name: 'Olaf', emoji: '🧭', color: 'grape', ready: true, tagline: 'Your AI marketing expert: a plan, a weekly check-in, and the work done with you.', addon: true },
    { id: 'projects', name: 'Project Planner', emoji: '🧭', color: 'teal', ready: false, tagline: 'Timelines, milestones and a shared plan for your team.' },
    { id: 'payments', name: 'Get Paid Faster', emoji: '💳', color: 'mint', ready: false, tagline: 'Pay-now links and QR codes right on your invoices.' },
    { id: 'assistant', name: 'AI Helper', emoji: '🤖', color: 'grape', ready: false, tagline: 'Plug in your own Claude key and let it draft the boring bits.' },
  ];

  const DEFAULTS = {
    businessName: '', ownerName: '', email: '', phone: '', website: '',
    address: '', postcode: '', city: '', country: '',
    vatNumber: '', regNumber: '', iban: '', bic: '',
    currency: 'EUR', vatRates: '21, 9, 0', paymentDays: 14, quoteDays: 30, docLang: 'en',
    brandColor: '#FF6B4A', logo: '', logoW: 0, logoH: 0,
  };

  // ---------- small helpers ----------
  BW.$ = (s, el) => (el || document).querySelector(s);
  BW.$$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  BW.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  BW.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  BW.html = (str) => { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content.firstElementChild; };
  BW.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  BW.root = '';

  const isoDate = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  BW.today = () => isoDate(new Date());
  BW.addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return isoDate(new Date(y, m - 1, d + Number(n))); };
  // lang ('en' or 'nl') overrides the business default, e.g. for a Dutch client's invoice.
  BW.locale = (lang) => ((lang || (BW.settings && BW.settings.docLang)) === 'nl' ? 'nl-NL' : 'en-GB');
  BW.fmtDate = (iso, opts, lang) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(BW.locale(lang), opts || { day: 'numeric', month: 'short', year: 'numeric' });
  };
  BW.money = (v, cur, lang) => {
    cur = cur || (BW.settings && BW.settings.currency) || 'EUR';
    try { return new Intl.NumberFormat(BW.locale(lang), { style: 'currency', currency: cur }).format(v || 0); }
    catch (e) { return cur + ' ' + (Number(v) || 0).toFixed(2); }
  };
  // Accepts "1.234,56", "1,234.56", "12,5" and "12.5".
  BW.num = (s) => {
    if (typeof s === 'number') return s;
    s = String(s || '').replace(/[\s€$£]/g, '');
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  BW.initials = (name) => String(name || '').split(/\s+/).map((w) => (w.match(/[\p{L}\d]/u) || [''])[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  const AV = ['var(--tomato)', 'var(--sun)', 'var(--mint)', 'var(--sky)', 'var(--grape)', 'var(--pink)', 'var(--teal)'];
  BW.colorFor = (s) => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
  BW.fileSafe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  BW.vatRates = () => String((BW.settings && BW.settings.vatRates) || '').split(/[,;\s]+/).map(BW.num).filter((n, i, a) => n >= 0 && a.indexOf(n) === i);
  BW.download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  // Invoices count up per year: 2026-001, 2026-002; quotes get a Q in front, credit notes a C.
  BW.nextNumber = (list, kind, year) => {
    const prefix = { quote: 'Q', credit: 'C' }[kind] || '';
    const re = new RegExp('^' + prefix + year + '-(\\d+)$');
    let max = 0;
    for (const i of list) if (i.kind === kind) { const m = re.exec(i.number || ''); if (m) max = Math.max(max, Number(m[1])); }
    return `${prefix}${year}-${String(max + 1).padStart(3, '0')}`;
  };

  // Money is summed in cents so totals never drift by a cent.
  // lines = before discount, subtotal = after discount (the real revenue), total = with VAT.
  BW.invoiceTotals = (inv) => {
    const byRate = {}; let lines = 0;
    const keep = 1 - Math.min(100, Math.max(0, BW.num(inv.discount))) / 100;
    for (const it of inv.items || []) {
      const line = Math.round(BW.num(it.qty) * BW.num(it.price) * 100);
      lines += line;
      const r = inv.reverseCharge ? 0 : BW.num(it.vat);
      byRate[r] = (byRate[r] || 0) + line;
    }
    let sub = 0;
    Object.keys(byRate).forEach((r) => { byRate[r] = Math.round(byRate[r] * keep); sub += byRate[r]; });
    const vat = Object.keys(byRate).map(Number).filter((r) => r > 0).sort((a, b) => b - a)
      .map((r) => ({ rate: r, base: byRate[r] / 100, cents: Math.round(byRate[r] * r / 100) }));
    const vatCents = vat.reduce((a, v) => a + v.cents, 0);
    return { lines: lines / 100, discount: (lines - sub) / 100, subtotal: sub / 100, vat: vat.map((v) => ({ rate: v.rate, base: v.base, amount: v.cents / 100 })), vatTotal: vatCents / 100, total: (sub + vatCents) / 100 };
  };
  // Money actually received for an invoice: recorded part-payments, or one payment when simply marked paid.
  BW.paymentsOf = (inv) => {
    if (inv.payments && inv.payments.length) return inv.payments;
    return inv.status === 'paid' ? [{ date: inv.paidAt || inv.issueDate, amount: BW.invoiceTotals(inv).total }] : [];
  };
  BW.balanceOf = (inv) => Math.round((BW.invoiceTotals(inv).total - BW.paymentsOf(inv).reduce((a, p) => a + BW.num(p.amount), 0)) * 100) / 100;

  BW.csv = {
    parse(text) {
      text = text.replace(/^﻿/, '');
      const first = text.split(/\r?\n/)[0] || '';
      const delim = [';', ',', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
      const rows = []; let row = [], cell = '', q = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
          if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
          else cell += c;
        } else if (c === '"') q = true;
        else if (c === delim) { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += c;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      return rows.filter((r) => r.some((c) => c.trim()));
    },
    stringify(rows) {
      return rows.map((r) => r.map((c) => { c = String(c == null ? '' : c); return /[",\n;]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n');
    },
  };

  BW.exportCsv = (filename, headers, rows) => {
    BW.download(new Blob(['\uFEFF' + BW.csv.stringify([headers, ...rows])], { type: 'text/csv' }), filename);
    BW.toast('Your spreadsheet is downloading', '📄');
  };

  // ---------- tiny persistence for the app itself (not business data) ----------
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  // Folder handles cannot go in localStorage, so they live in IndexedDB.
  const kv = {
    db: null,
    open() {
      if (!this.db) this.db = new Promise((res, rej) => {
        const r = indexedDB.open('busywork', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      return this.db;
    },
    async get(k) {
      try { const db = await this.open(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
      catch (e) { return undefined; }
    },
    async set(k, v) {
      try { const db = await this.open(); await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
      catch (e) { /* the folder will be asked for again next time */ }
    },
  };

  // ---------- storage drivers ----------
  // Both drivers store each collection as one JSON file, so the folder stays readable by humans.
  BW.canUseFolders = typeof window.showDirectoryPicker === 'function';

  function FolderDriver(root) {
    async function dir(path) {
      let d = root;
      for (const part of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(part, { create: true });
      return d;
    }
    return {
      kind: 'folder',
      label: root.name,
      handle: root,
      async readJSON(name, fallback) {
        let text;
        try {
          const fh = await (await dir('data')).getFileHandle(name + '.json');
          text = await (await fh.getFile()).text();
        } catch (e) {
          if (e.name === 'NotFoundError') return fallback;
          throw e;
        }
        if (!text.trim()) return fallback;
        try { return JSON.parse(text); }
        // Never overwrite a file we could not read: that would wipe the user's data.
        catch (e) { throw new Error(`data/${name}.json in your folder is damaged, so nothing was changed. Restore it from a backup or fix it in a text editor.`); }
      },
      async writeJSON(name, val) {
        const fh = await (await dir('data')).getFileHandle(name + '.json', { create: true });
        const w = await fh.createWritable(); await w.write(JSON.stringify(val, null, 2)); await w.close();
      },
      async list() {
        const names = [];
        try { for await (const [n, h] of (await dir('data')).entries()) if (h.kind === 'file' && n.endsWith('.json')) names.push(n.slice(0, -5)); } catch (e) { /* no data yet */ }
        return names;
      },
      async readFile(path) {
        try {
          let d = root; const parts = path.split('/'); const fname = parts.pop();
          for (const part of parts.filter(Boolean)) d = await d.getDirectoryHandle(part);
          return await (await d.getFileHandle(fname)).getFile();
        } catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
      },
      async writeFile(path, blob) {
        const parts = path.split('/'); const fname = parts.pop();
        const fh = await (await dir(parts.join('/'))).getFileHandle(fname, { create: true });
        const w = await fh.createWritable(); await w.write(blob); await w.close();
        return { saved: true, where: root.name + '/' + path };
      },
    };
  }

  function BrowserDriver() {
    return {
      kind: 'browser',
      label: 'this browser',
      async readJSON(name, fallback) {
        const raw = ls.get('bw.data.' + name);
        return raw ? JSON.parse(raw) : fallback;
      },
      async writeJSON(name, val) {
        try { localStorage.setItem('bw.data.' + name, JSON.stringify(val)); }
        catch (e) { throw new Error('This browser would not save any more. Switch to a folder to keep going (click the storage button at the top).'); }
      },
      async list() {
        const names = [];
        for (let n = 0; n < localStorage.length; n++) { const k = localStorage.key(n); if (k.startsWith('bw.data.')) names.push(k.slice(8)); }
        return names;
      },
      async readFile() { return null; },
      async writeFile(path, blob, opts) {
        if (opts && opts.download === false) return { saved: false };
        BW.download(blob, path.split('/').pop());
        return { saved: false, where: 'your Downloads' };
      },
    };
  }

  let drv = null;
  let queue = Promise.resolve();
  // Saves run one at a time in this tab, and hold a browser-wide lock per collection so two
  // open tabs can never interleave a read-modify-write and lose a change.
  const serial = (fn, name) => {
    const run = () => (navigator.locks && name ? navigator.locks.request('busywork:' + name, fn) : fn());
    const p = queue.then(run, run); queue = p.catch(() => {}); return p;
  };

  let channel = null;
  try { channel = new BroadcastChannel('busywork'); } catch (e) { /* older browser */ }
  const listeners = [];
  BW.onChange = (fn) => listeners.push(fn);
  const notify = (name) => { if (channel) channel.postMessage({ name }); };
  if (channel) channel.onmessage = (e) => listeners.forEach((fn) => fn(e.data.name));
  // Files may change underneath us (Google Drive sync, another device), so re-read on focus.
  window.addEventListener('focus', () => { if (drv) listeners.forEach((fn) => fn('*')); });

  BW.store = {
    get kind() { return drv && drv.kind; },
    get where() { return drv ? drv.label : ''; },
    all: (name) => drv.readJSON(name, []),
    async get(name, id) { return (await drv.readJSON(name, [])).find((r) => r.id === id) || null; },
    // Read-modify-write per save, so two open apps do not overwrite each other's records.
    put: (name, rec) => serial(async () => {
      const list = await drv.readJSON(name, []);
      const now = new Date().toISOString();
      if (!rec.id) { rec.id = BW.uid(); rec.createdAt = now; }
      rec.updatedAt = now;
      const i = list.findIndex((r) => r.id === rec.id);
      if (i >= 0) list[i] = rec; else list.push(rec);
      await drv.writeJSON(name, list);
      notify(name);
      return rec;
    }, name),
    putMany: (name, recs) => serial(async () => {
      const list = await drv.readJSON(name, []);
      const now = new Date().toISOString();
      for (const rec of recs) {
        if (!rec.id) { rec.id = BW.uid(); rec.createdAt = now; }
        rec.updatedAt = now;
        const i = list.findIndex((r) => r.id === rec.id);
        if (i >= 0) list[i] = rec; else list.push(rec);
      }
      await drv.writeJSON(name, list);
      notify(name);
    }, name),
    remove: (name, id) => serial(async () => {
      const list = await drv.readJSON(name, []);
      await drv.writeJSON(name, list.filter((r) => r.id !== id));
      notify(name);
    }, name),
    removeWhere: (name, test) => serial(async () => {
      const list = await drv.readJSON(name, []);
      const keep = list.filter((r) => !test(r));
      if (keep.length !== list.length) { await drv.writeJSON(name, keep); notify(name); }
      return list.length - keep.length;
    }, name),
    replaceAll: (name, list) => serial(async () => { await drv.writeJSON(name, list); notify(name); }, name),
    collections: () => drv.list(),
    async settings() { return Object.assign({}, DEFAULTS, await drv.readJSON('settings', {})); },
    saveSettings: (s) => serial(async () => {
      await drv.writeJSON('settings', s);
      BW.settings = Object.assign({}, DEFAULTS, s);
      notify('settings');
    }, 'settings'),
    writeFile: (path, blob, opts) => drv.writeFile(path, blob, opts),
    readFile: (path) => drv.readFile(path),
  };

  // ---------- UI: toast, confetti, modal, drawer ----------
  // action: { label, run } adds a button, used for "Undo".
  BW.toast = (msg, emoji, action) => {
    let box = BW.$('.toasts');
    if (!box) { box = BW.html('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.append(box); }
    const t = BW.html(`<div class="toast">${emoji ? `<span class="emo">${emoji}</span>` : ''}<span>${msg}</span>${action ? `<button type="button">${action.label}</button>` : ''}</div>`);
    box.append(t);
    const gone = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
    if (action) BW.$('button', t).onclick = () => { gone(); action.run(); };
    setTimeout(gone, action ? 7000 : 3200);
  };
  // Deletes with a seven-second Undo, like Gmail and Linear.
  BW.removeWithUndo = async (collection, rec, label, after) => {
    try { await BW.store.remove(collection, rec.id); } catch (e) { return BW.error(e); }
    if (after) after();
    BW.toast(`${label} deleted`, '🗑️', { label: 'Undo', run: async () => {
      try { await BW.store.put(collection, rec); BW.toast('Back again!', '↩️'); if (after) after(rec); } catch (e) { BW.error(e); }
    } });
  };
  BW.error = (e) => { console.error(e); BW.toast(BW.esc(e && e.message ? e.message : String(e)), '😬'); };

  BW.confetti = (opts) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:300';
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    document.body.append(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const colors = ['#FF6B4A', '#FFC93C', '#2FD18C', '#4DA3FF', '#9B6BFF', '#FF7AC6', '#22C3C3'];
    const ox = (opts && opts.x) || innerWidth / 2, oy = (opts && opts.y) || innerHeight / 3;
    const ps = Array.from({ length: 140 }, () => ({
      x: ox, y: oy, vx: (Math.random() - .5) * 16, vy: Math.random() * -14 - 4, r: Math.random() * 6 + 4,
      c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * Math.PI, va: (Math.random() - .5) * .4, s: Math.random() < .5,
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        if (p.s) ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2.4, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      if (t - t0 < 2600) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  };

  BW.countUp = (el, value, fmt) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(value); return; }
    const t0 = performance.now(), dur = 700;
    (function frame(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(value * e);
      if (k < 1) requestAnimationFrame(frame);
    })(t0);
  };

  // Keeps Tab inside the topmost dialog, closes it on Escape, and puts focus back where it was.
  function trapClose(wrap, close) {
    const before = document.activeElement;
    const top = () => { const all = BW.$$('.modal-wrap, .drawer-wrap, .palette-wrap'); return all[all.length - 1] === wrap; };
    const onKey = (e) => {
      if (!top()) return;
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = BW.$$('a[href], button:not([disabled]), input:not([type=hidden]):not([hidden]), select, textarea, [tabindex="0"]', wrap).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    return () => { document.removeEventListener('keydown', onKey, true); if (before && before.focus && document.contains(before)) before.focus(); };
  }

  // actions: [{ label, kind: 'primary'|'ghost'|..., onClick(close) }]; returning false keeps it open.
  BW.modal = ({ title, body, actions = [], wide, onClose }) => {
    const wrap = BW.html(`<div class="modal-wrap"><div class="modal card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="modal-body"></div><div class="modal-foot"></div></div></div>`);
    const bodyEl = BW.$('.modal-body', wrap);
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
    let untrap;
    const close = () => { untrap(); wrap.remove(); if (onClose) onClose(); };
    untrap = trapClose(wrap, close);
    BW.$('[data-close]', wrap).onclick = close;
    const foot = BW.$('.modal-foot', wrap);
    for (const a of actions) {
      const b = BW.html(`<button class="btn ${a.kind ? 'btn-' + a.kind : ''}">${a.label}</button>`);
      b.onclick = async () => { const keep = a.onClick ? await a.onClick(close) : undefined; if (keep !== false) close(); };
      foot.append(b);
    }
    document.body.append(wrap);
    const f = BW.$('input, textarea, select', bodyEl) || BW.$('.btn-primary', foot);
    if (f) setTimeout(() => f.focus(), 50);
    return { el: wrap, body: bodyEl, close };
  };

  BW.confirm = (msg, { ok = 'Yes, do it', title = 'Are you sure?', danger } = {}) => new Promise((res) => {
    let answered = false;
    BW.modal({
      title, body: `<p>${msg}</p>`,
      onClose: () => { if (!answered) res(false); },
      actions: [
        { label: 'Never mind', kind: 'ghost' },
        { label: ok, kind: danger ? 'danger' : 'primary', onClick: () => { answered = true; res(true); } },
      ],
    });
  });

  BW.drawer = ({ title, body, onClose }) => {
    const wrap = BW.html(`<div class="drawer-wrap"><div class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head"><h2 style="flex:1">${title}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="drawer-body"></div></div></div>`);
    const bodyEl = BW.$('.drawer-body', wrap);
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
    let untrap;
    const close = () => { untrap(); wrap.remove(); if (onClose) onClose(); };
    untrap = trapClose(wrap, close);
    BW.$('[data-close]', wrap).onclick = close;
    document.body.append(wrap);
    return { el: wrap, body: bodyEl, head: BW.$('.drawer-head h2', wrap), close };
  };

  // One record in a drawer that saves as you type. Most tools edit their records this way.
  //   top(rec) / bottom(rec) return extra HTML; bind(box, rec, save) wires it up.
  //   isComplete(rec) says when there is enough to save (default: the first field is filled).
  //   Deleting offers Undo; pass confirmDelete (a message) instead when a delete takes other things with it.
  BW.recordDrawer = ({ collection, rec, fields, title, newTitle, top, bottom, bind, isComplete, onSaved, onClose, deleteLabel = 'Delete', confirmDelete }) => {
    const r = Object.assign({}, rec || {});
    const complete = isComplete || ((x) => !!String(x[fields[0].k] || '').trim());
    const box = document.createElement('div');
    let pending = false;
    const flush = async () => {
      if (!pending) return;
      pending = false;
      BW.readFields(BW.$('[data-form]', box), r);
      if (!complete(r)) return;
      const isNew = !r.id;
      try { await BW.store.put(collection, r); } catch (e) { pending = true; return BW.error(e); }
      const st = BW.$('[data-state]', box); if (st) st.textContent = 'All changes saved ✓';
      if (onSaved) onSaved(r, isNew);
      if (isNew) { d.head.textContent = title; redraw(); }
    };
    const d = BW.drawer({ title: r.id ? title : newTitle || title, body: box, onClose: async () => { await flush(); if (onClose) onClose(r); } });
    const later = BW.debounce(flush, 500);
    const save = () => { pending = true; const st = BW.$('[data-state]', box); if (st) st.textContent = 'Saving…'; later(); };
    const draw = () => {
      box.innerHTML = `${top ? top(r) : ''}
        <div class="save-state" data-state style="margin-bottom:12px">${r.id ? 'All changes saved' : 'Saves by itself as you type'}</div>
        <form data-form>${BW.fieldsHtml(fields, r)}</form>
        ${bottom ? bottom(r) : ''}
        ${r.id ? `<div style="margin-top:28px"><button type="button" class="btn btn-ghost btn-danger" data-del>🗑️ ${deleteLabel}</button></div>` : ''}`;
      const form = BW.$('[data-form]', box);
      BW.bindChips(form);
      form.addEventListener('input', save);
      form.addEventListener('change', save);
      form.addEventListener('click', (e) => { if (e.target.closest('.choice-chips button')) save(); });
      form.onsubmit = (e) => { e.preventDefault(); flush(); };
      const del = BW.$('[data-del]', box);
      if (del) del.onclick = async () => {
        if (confirmDelete && !(await BW.confirm(confirmDelete, { ok: deleteLabel, danger: true, title: `${deleteLabel}?` }))) return;
        pending = false;
        const copy = Object.assign({}, r);
        r.deleted = true;
        if (confirmDelete) {
          try { await BW.store.remove(collection, r.id); } catch (e) { return BW.error(e); }
          d.close(); BW.toast('Gone!', '🗑️'); return;
        }
        await BW.removeWithUndo(collection, copy, title, (restored) => { if (restored && onClose) onClose(restored); });
        d.close();
      };
      if (bind) bind(box, r, save);
      if (!r.id) { const f = BW.$('input, textarea', form); if (f) f.focus(); }
    };
    // After the first save the drawer gains buttons; keep the cursor where the user was typing.
    const redraw = () => {
      const a = document.activeElement, name = a && box.contains(a) ? a.name : null;
      let pos = null; try { pos = a.selectionStart; } catch (e) { /* no caret on this input */ }
      draw();
      const el = name && BW.$(`[name="${name}"]`, box);
      if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
    };
    draw();
    return { drawer: d, rec: r, redraw: draw };
  };

  // ---------- the sponsor slot ----------
  // Shown under every tool, never inside an invoice, PDF or anything a user makes.
  // Google AdSense is not allowed inside downloadable software (AdSense programme policies), so the
  // tools show our own cards plus any sponsors we sign directly. Nothing is loaded from the internet.
  // Real AdSense runs on the public website only (website/assets/site.js).
  BW.sponsors = [
    // { emoji: '🏦', title: 'Sponsor name', text: 'One line about the offer.', cta: 'Learn more', href: 'https://…' },
  ];
  BW.houseAds = () => BW.apps.filter((a) => a.ready).map((a) => ({
    id: a.id, emoji: a.emoji, title: `Try ${a.name}`, text: a.tagline, cta: 'Open it', href: `${BW.root}apps/${a.id}/index.html`, color: a.color,
  })).concat(BW.apps.filter((a) => !a.ready).map((a) => ({
    id: a.id, emoji: a.emoji, title: `Coming soon: ${a.name}`, text: a.tagline, color: a.color,
  })));
  BW.adSlot = (here) => {
    const pool = BW.sponsors.length ? BW.sponsors.map((s) => Object.assign({ sponsored: true }, s)) : BW.houseAds().filter((h) => h.id !== here);
    const ad = pool[Math.floor(Math.random() * pool.length)];
    if (!ad) return null;
    return BW.html(`<aside class="ad-band wrap" aria-label="${ad.sponsored ? 'Sponsored' : 'Tip'}">
      <div class="ad-card" style="--c:var(--${ad.color || 'sun'})">
        <span class="ad-tag">${ad.sponsored ? 'Sponsored' : 'Psst'}</span>
        <span class="ad-emo">${ad.emoji}</span>
        <div class="ad-copy"><b>${BW.esc(ad.title)}</b><small>${BW.esc(ad.text)}</small></div>
        ${ad.href ? `<a class="btn" href="${BW.esc(ad.href)}" ${ad.sponsored ? 'target="_blank" rel="sponsored noopener"' : ad.external ? 'target="_blank" rel="noopener"' : ''}>${BW.esc(ad.cta || 'Have a look')} →</a>` : '<span class="chip chip-grape">Soon</span>'}
      </div></aside>`);
  };

  // ---------- business details (wizard + settings form share these fields) ----------
  const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CAD', 'AUD'];
  const STEPS = [
    { emoji: '👋', title: "First things first: what's your business called?", sub: 'This goes at the top of every invoice and quote.', fields: [
      { k: 'businessName', label: 'Business name', ph: 'e.g. Sunny Side Studio', required: true },
      { k: 'ownerName', label: 'Your name', ph: 'e.g. Sam Jansen', hint: 'We use it to sign your emails.' },
    ] },
    { emoji: '🎨', title: 'Make it look like you', sub: 'Your logo and colour show up on everything you send.', custom: 'look' },
    { emoji: '📬', title: 'Where can clients reach you?', sub: 'Shown on your documents, so clients know who sent them.', fields: [
      { k: 'email', label: 'Email', type: 'email', ph: 'hello@yourbusiness.com' },
      { k: 'phone', label: 'Phone', ph: '+31 6 1234 5678' },
      { k: 'address', label: 'Street and number', ph: 'Keizersgracht 1', span: 2 },
      { k: 'postcode', label: 'Postcode', ph: '1015 AA' },
      { k: 'city', label: 'City', ph: 'Amsterdam' },
      { k: 'country', label: 'Country', ph: 'Netherlands' },
      { k: 'website', label: 'Website', ph: 'yourbusiness.com' },
    ] },
    { emoji: '🏛️', title: 'The official bits', sub: "Invoices need these to be valid. Skip anything you don't have yet.", fields: [
      { k: 'vatNumber', label: 'VAT number', ph: 'NL001234567B01' },
      { k: 'regNumber', label: 'Company registration no.', ph: 'e.g. KvK 12345678' },
      { k: 'iban', label: 'Bank account (IBAN)', ph: 'NL00 BANK 0123 4567 89', hint: 'Clients pay you here.' },
      { k: 'bic', label: 'BIC', ph: 'Only needed for clients abroad' },
    ] },
    { emoji: '💶', title: 'How do you like to get paid?', sub: 'These are just the defaults. You can change them on any invoice.', fields: [
      { k: 'currency', label: 'Currency', type: 'select', options: CURRENCIES.map((c) => [c, c]) },
      { k: 'vatRates', label: 'VAT rates you use (%)', ph: '21, 9, 0', hint: 'The first one is your default.' },
      { k: 'paymentDays', label: 'Clients pay within', type: 'chips', options: [[7, '7 days'], [14, '14 days'], [30, '30 days']] },
      { k: 'docLang', label: 'Invoice language', type: 'chips', options: [['en', '🇬🇧 English'], ['nl', '🇳🇱 Nederlands']] },
    ] },
  ];
  const COLORS = ['#FF6B4A', '#F5A623', '#2FD18C', '#22C3C3', '#4DA3FF', '#9B6BFF', '#FF7AC6', '#1E1B2E'];

  function fieldsHtml(fields, data) {
    return `<div class="grid-2">${fields.map((f) => {
      const v = data[f.k] == null ? '' : data[f.k];
      let input;
      if (f.type === 'select') input = `<select class="in" name="${f.k}">${f.options.map(([val, l]) => `<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      else if (f.type === 'chips') input = `<div class="choice-chips" data-name="${f.k}">${f.options.map(([val, l]) => `<button type="button" data-v="${val}" aria-pressed="${String(val) === String(v)}">${l}</button>`).join('')}</div>`;
      else if (f.type === 'textarea') input = `<textarea class="in" name="${f.k}" placeholder="${BW.esc(f.ph || '')}">${BW.esc(v)}</textarea>`;
      else if (f.type === 'money' || f.type === 'number') input = `<input class="in" name="${f.k}" inputmode="decimal" placeholder="${BW.esc(f.ph || '')}" value="${BW.esc(v)}" autocomplete="off">`;
      else input = `<input class="in" name="${f.k}" type="${f.type || 'text'}" placeholder="${BW.esc(f.ph || '')}" value="${BW.esc(v)}" ${f.required ? 'required' : ''} autocomplete="off">`;
      return `<label class="field ${f.span || f.type === 'chips' ? 'span-2' : ''}"><span>${f.label}</span>${input}${f.hint ? `<em>${f.hint}</em>` : ''}</label>`;
    }).join('')}</div>`;
  }
  function bindChips(root) {
    BW.$$('.choice-chips', root).forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      BW.$$('button', g).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
  }
  function readFields(root, data) {
    BW.$$('[name]', root).forEach((el) => { data[el.name] = el.value.trim(); });
    BW.$$('.choice-chips', root).forEach((g) => {
      const on = BW.$('[aria-pressed="true"]', g);
      if (on) data[g.dataset.name] = /^\d+$/.test(on.dataset.v) ? Number(on.dataset.v) : on.dataset.v;
    });
    return data;
  }

  BW.fieldsHtml = fieldsHtml;
  BW.readFields = readFields;
  BW.bindChips = bindChips;

  // Client fields live here because the Client Book and the invoice maker both edit clients.
  // Where new customers come from. Asked once per client; the marketing dashboard counts them.
  const SOURCES = ['Recommendation', 'Google search', 'Google Maps', 'Walked past', 'Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'Our website', 'An ad', 'Newsletter', 'Event or market', 'Partner', 'Came back', 'Other'];
  BW.clientSources = SOURCES;
  BW.clientFields = [
    { k: 'name', label: 'Company or client name', ph: 'e.g. Bakery De Gouden Korst', span: 2, required: true },
    { k: 'contact', label: 'Contact person', ph: 'e.g. Anna de Vries' },
    { k: 'email', label: 'Email', type: 'email', ph: 'anna@goudenkorst.nl' },
    { k: 'phone', label: 'Phone', ph: '+31 20 123 4567' },
    { k: 'vat', label: 'VAT number', ph: 'Only for businesses' },
    { k: 'address', label: 'Street and number', ph: 'Bakkerstraat 12', span: 2 },
    { k: 'postcode', label: 'Postcode', ph: '3511 AA' },
    { k: 'city', label: 'City', ph: 'Utrecht' },
    { k: 'country', label: 'Country', ph: 'Netherlands' },
    { k: 'paymentDays', label: 'Pays within', type: 'select', options: [['', 'My usual terms'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['60', '60 days']] },
    { k: 'lang', label: 'Invoice language', type: 'select', options: [['', 'My usual language'], ['en', '🇬🇧 English'], ['nl', '🇳🇱 Nederlands']] },
    { k: 'rate', label: 'Hourly rate for them', type: 'money', ph: 'My usual rate', hint: 'The Time Tracker bills their hours at this rate.' },
    { k: 'source', label: 'How did they find you?', type: 'select', options: [['', 'Not sure']].concat(SOURCES.map((s) => [s, s])), hint: 'Shows which marketing brings new customers.' },
    { k: 'notes', label: 'Notes', type: 'textarea', span: 2, ph: 'Anything worth remembering: what they like, their dog’s name…' },
  ];

  function lookHtml(data) {
    return `<div class="stack" style="--gap:18px">
      <div class="dropzone" data-logo tabindex="0" role="button" aria-label="Upload your logo">
        ${data.logo ? `<img src="${data.logo}" alt="Your logo">` : `<div><div style="font-size:2rem">🖼️</div><b>Drop your logo here</b><br><small>or click to pick a file. PNG, JPG or SVG.</small></div>`}
      </div>
      ${data.logo ? '<button type="button" class="link" data-logo-remove>Remove logo</button>' : ''}
      <input type="file" accept="image/*" hidden data-logo-input>
      <div><div class="field"><span>Your colour</span></div>
        <div class="swatches">${COLORS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-c="${c}" aria-label="Colour ${c}" aria-pressed="${data.brandColor.toLowerCase() === c.toLowerCase()}"></button>`).join('')}
          <label class="swatch swatch-custom" title="Pick any colour"><input type="color" value="${data.brandColor}" data-custom-color aria-label="Pick any colour"></label>
        </div></div>
    </div>`;
  }
  // Logos are flattened onto white JPEG: small enough to keep in settings, and a PDF can embed JPEG as-is.
  function readLogo(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 600 / img.width, 300 / img.height);
        const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        res({ logo: cv.toDataURL('image/jpeg', 0.9), logoW: w, logoH: h });
      };
      img.onerror = () => rej(new Error("That file doesn't look like an image."));
      img.src = url;
    });
  }
  function bindLook(root, data, rerender) {
    const zone = BW.$('[data-logo]', root), input = BW.$('[data-logo-input]', root);
    const take = async (file) => { try { Object.assign(data, await readLogo(file)); rerender(); } catch (e) { BW.error(e); } };
    zone.onclick = () => input.click();
    zone.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    input.onchange = () => input.files[0] && take(input.files[0]);
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('over'); };
    zone.ondragleave = () => zone.classList.remove('over');
    zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) take(f); };
    const rm = BW.$('[data-logo-remove]', root);
    if (rm) rm.onclick = () => { data.logo = ''; data.logoW = data.logoH = 0; rerender(); };
    BW.$$('.swatch[data-c]', root).forEach((s) => s.onclick = () => { data.brandColor = s.dataset.c; rerender(); });
    BW.$('[data-custom-color]', root).oninput = (e) => { data.brandColor = e.target.value; BW.$$('.swatch[data-c]', root).forEach((s) => s.setAttribute('aria-pressed', 'false')); };
  }

  function overlay(inner, blobs) {
    const ob = BW.html(`<div class="ob">
      <div class="blob-bg" style="width:340px;height:340px;background:var(--sun);left:-90px;top:-60px"></div>
      <div class="blob-bg" style="width:260px;height:260px;background:var(--sky);right:-70px;bottom:-40px;animation-delay:-5s"></div>
      <div class="blob-bg" style="width:160px;height:160px;background:var(--pink);right:12%;top:8%;animation-delay:-9s"></div>
      ${inner}</div>`);
    if (blobs === false) BW.$$('.blob-bg', ob).forEach((b) => b.remove());
    document.body.append(ob);
    return ob;
  }

  function runWizard() {
    return new Promise((resolve) => {
      const data = Object.assign({}, BW.settings);
      let i = 0;
      const ob = overlay('<div class="ob-card card"></div>');
      const card = BW.$('.ob-card', ob);
      const render = () => {
        const done = i >= STEPS.length;
        const st = STEPS[i] || {};
        card.innerHTML = done
          ? `<div style="text-align:center"><div class="ob-emoji">🎉</div><h1>You're all set, ${BW.esc((data.ownerName || '').split(' ')[0] || data.businessName)}!</h1>
             <p class="sub">Your business details are saved. Change them any time with the ⚙️ button at the top.</p>
             <button class="btn btn-primary btn-big" data-go>Let's go →</button></div>`
          : `<div class="dots">${STEPS.map((_, n) => `<i class="${n === i ? 'on' : n < i ? 'done' : ''}"></i>`).join('')}</div>
             <div class="ob-emoji">${st.emoji}</div><h1>${st.title}</h1><p class="sub">${st.sub}</p>
             <form data-step>${st.custom === 'look' ? lookHtml(data) : fieldsHtml(st.fields, data)}</form>
             <div class="ob-foot">${i > 0 ? '<button class="btn btn-ghost" data-back>← Back</button>' : ''}<div class="spacer"></div>
               ${i > 0 ? '<button class="btn btn-ghost" data-skip>Skip for now</button>' : ''}
               <button class="btn btn-primary btn-big" data-next>${i === STEPS.length - 1 ? 'Finish' : 'Next'} →</button></div>`;
        if (done) {
          BW.confetti();
          BW.$('[data-go]', card).onclick = () => { ob.remove(); resolve(); };
          BW.$('[data-go]', card).focus();
          return;
        }
        const form = BW.$('[data-step]', card);
        bindChips(form);
        if (st.custom === 'look') bindLook(form, data, render);
        const next = async () => {
          readFields(form, data);
          const req = st.fields && st.fields.find((f) => f.required && !data[f.k]);
          if (req) { const el = BW.$(`[name="${req.k}"]`, form); el.classList.add('shake'); el.focus(); setTimeout(() => el.classList.remove('shake'), 500); return; }
          try { await BW.store.saveSettings(data); } catch (e) { BW.error(e); return; }
          i++; render();
        };
        form.onsubmit = (e) => { e.preventDefault(); next(); };
        form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); next(); } });
        BW.$('[data-next]', card).onclick = next;
        const back = BW.$('[data-back]', card); if (back) back.onclick = () => { readFields(form, data); i--; render(); };
        const skip = BW.$('[data-skip]', card); if (skip) skip.onclick = () => { i++; render(); };
        const first = BW.$('input', form); if (first && st.custom !== 'look') first.focus();
      };
      render();
    });
  }

  BW.openSettings = () => {
    const data = Object.assign({}, BW.settings);
    const box = document.createElement('div');
    const render = () => {
      box.innerHTML = STEPS.map((st) => `<h3 class="section-title"><span>${st.emoji}</span>${st.custom === 'look' ? 'Logo and colour' : st.title.replace(/^First things first: /, '').replace(/^./, (c) => c.toUpperCase())}</h3>
        ${st.custom === 'look' ? lookHtml(data) : fieldsHtml(st.fields, data)}`).join('');
      bindChips(box);
      bindLook(box, data, () => { readFields(box, data); render(); });
    };
    render();
    BW.modal({
      title: '⚙️ Business details', body: box, wide: true,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Save', kind: 'primary', onClick: async () => {
          readFields(box, data);
          if (!data.businessName) { BW.toast('Your business needs a name 🙂', '✏️'); return false; }
          try { await BW.store.saveSettings(data); BW.toast('Saved. Looking sharp!', '✨'); listeners.forEach((fn) => fn('settings')); }
          catch (e) { BW.error(e); return false; }
        } },
      ],
    });
  };

  // ---------- connecting storage ----------
  function welcome() {
    return new Promise((resolve) => {
      const ob = overlay(`<div class="ob-card card wide">
        <div class="ob-emoji">👋</div>
        <h1>Hi! Where should your business live?</h1>
        <p class="sub">Everything you make here is saved as normal files. Pick a home for them. You can move them later.</p>
        <div class="options">
          <button class="option" data-folder ${BW.canUseFolders ? '' : 'disabled'}>
            <span class="chip chip-mint tag">Recommended</span>
            <span class="emo">📁</span><b>A folder on my computer</b>
            <p>${BW.canUseFolders
              ? 'Make a new folder like <b>“My Business”</b>. <br>Tip: put it inside Google Drive, Dropbox or OneDrive and it backs up and syncs by itself.'
              : 'Your browser can’t open folders yet. Open this page in <b>Chrome</b> or <b>Edge</b> to use this.'}</p>
          </button>
          <button class="option" data-browser>
            <span class="emo">🧪</span><b>Just try it out</b>
            <p>Saves inside this browser only. Great for a test drive. Move everything to a folder whenever you like.</p>
          </button>
        </div>
        <div class="privacy-note"><span>🔒</span><span><b>Private by design.</b> There's no account and no server, and nothing you type is sent to us. AI features, if you switch them on, send only what you ask about to Anthropic, with your own key.</span></div>
      </div>`);
      BW.$('[data-browser]', ob).onclick = () => { ls.set('bw.mode', 'browser'); drv = BrowserDriver(); ob.remove(); resolve(); };
      BW.$('[data-folder]', ob).onclick = async () => {
        const ok = await pickFolder();
        if (ok) { ob.remove(); resolve(); }
      };
    });
  }

  async function pickFolder() {
    let h;
    try { h = await window.showDirectoryPicker({ id: 'busywork', mode: 'readwrite' }); }
    catch (e) { if (e.name !== 'AbortError') BW.error(e); return false; }
    await kv.set('root', h);
    ls.set('bw.mode', 'folder');
    drv = FolderDriver(h);
    return true;
  }

  function reconnect(h) {
    return new Promise((resolve) => {
      const ob = overlay(`<div class="ob-card card" style="text-align:center">
        <div class="ob-emoji">🔑</div><h1>Welcome back!</h1>
        <p class="sub">Your browser asks you to say “yes” once per visit before we can open <b>${BW.esc(h.name)}</b>.</p>
        <button class="btn btn-primary btn-big" data-open>📁 Open ${BW.esc(h.name)}</button>
        <p style="margin-top:16px"><button class="link" data-other>Use a different folder</button></p></div>`);
      BW.$('[data-open]', ob).onclick = async () => {
        if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') { drv = FolderDriver(h); ob.remove(); resolve(); }
      };
      BW.$('[data-other]', ob).onclick = async () => { if (await pickFolder()) { ob.remove(); resolve(); } };
    });
  }

  async function connect() {
    const mode = ls.get('bw.mode');
    if (mode === 'browser') { drv = BrowserDriver(); return; }
    if (mode === 'folder' && BW.canUseFolders) {
      const h = await kv.get('root');
      if (h) {
        if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') { drv = FolderDriver(h); return; }
        return reconnect(h);
      }
    }
    return welcome();
  }

  // Copies everything kept in this browser into a folder, without overwriting anything already there.
  async function moveToFolder() {
    const names = [];
    for (let n = 0; n < localStorage.length; n++) { const k = localStorage.key(n); if (k.startsWith('bw.data.')) names.push(k.slice(8)); }
    const from = BrowserDriver();
    if (!(await pickFolder())) return;
    let moved = 0;
    for (const name of names) {
      const existing = await drv.readJSON(name, null);
      const mine = await from.readJSON(name, null);
      if (mine == null) continue;
      if (Array.isArray(existing) && Array.isArray(mine)) {
        const ids = new Set(existing.map((r) => r.id));
        await drv.writeJSON(name, existing.concat(mine.filter((r) => !ids.has(r.id))));
      } else if (existing == null) await drv.writeJSON(name, mine);
      moved++;
    }
    BW.toast(`Moved ${moved} collection${moved === 1 ? '' : 's'} into ${BW.esc(drv.label)}`, '📦');
    setTimeout(() => location.reload(), 900);
  }

  // ---------- backups ----------
  async function snapshot() {
    const out = { _busywork: 1, _made: new Date().toISOString() };
    for (const name of new Set(['settings', ...(await drv.list())])) { const v = await drv.readJSON(name, null); if (v != null) out[name] = v; }
    return out;
  }
  async function backup() {
    BW.download(new Blob([JSON.stringify(await snapshot(), null, 2)], { type: 'application/json' }), `busywork-backup-${BW.today()}.json`);
  }
  // Once a day, folder mode keeps a full copy in backups/ and clears out copies older than two weeks.
  async function autoBackup() {
    if (drv.kind !== 'folder') return;
    const name = `busywork-${BW.today()}.json`;
    try {
      if (await drv.readFile('backups/' + name)) return;
      const data = await snapshot();
      if (Object.keys(data).length <= 3) return; // nothing worth keeping yet
      await drv.writeFile('backups/' + name, new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const dir = await drv.handle.getDirectoryHandle('backups');
      const old = [];
      for await (const [n] of dir.entries()) if (/^busywork-\d{4}-\d\d-\d\d\.json$/.test(n)) old.push(n);
      old.sort().slice(0, -14).forEach((n) => dir.removeEntry(n).catch(() => {}));
    } catch (e) { console.warn('Backup skipped', e); }
  }
  function restore() {
    const input = BW.html('<input type="file" accept=".json,application/json" hidden>');
    document.body.append(input);
    input.onchange = async () => {
      const f = input.files[0]; input.remove(); if (!f) return;
      let data;
      try { data = JSON.parse(await f.text()); } catch (e) { return BW.toast('That file isn’t a Busywork backup.', '🤔'); }
      const names = Object.keys(data).filter((k) => !k.startsWith('_'));
      if (!names.length) return BW.toast('That backup is empty.', '🤔');
      if (!(await BW.confirm(`Replace what’s here now with the backup from <b>${BW.esc((data._made || f.name).slice(0, 10))}</b>? We first save a copy of what you have now.`, { ok: 'Restore', title: 'Restore a backup?' }))) return;
      try {
        if (drv.kind === 'folder') await drv.writeFile(`backups/before-restore-${Date.now()}.json`, new Blob([JSON.stringify(await snapshot())], { type: 'application/json' }));
        else await backup();
        for (const n of names) await drv.writeJSON(n, data[n]);
      } catch (e) { return BW.error(e); }
      BW.toast('Restored! Reloading…', '♻️');
      setTimeout(() => location.reload(), 900);
    };
    input.click();
  }

  // ---------- theme ----------
  const THEMES = [['', '🌓', 'Automatic'], ['light', '☀️', 'Light'], ['dark', '🌙', 'Dark']];
  const applyTheme = () => { const t = ls.get('bw.theme') || ''; if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
  applyTheme();
  BW.cycleTheme = () => {
    const i = THEMES.findIndex((t) => t[0] === (ls.get('bw.theme') || ''));
    const next = THEMES[(i + 1) % THEMES.length];
    if (next[0]) ls.set('bw.theme', next[0]); else ls.del('bw.theme');
    applyTheme();
    const b = BW.$('[data-theme-btn]'); if (b) b.textContent = next[1];
    BW.toast(`${next[2]} mode`, next[1]);
  };

  function storeMenu(btn) {
    const old = BW.$('.popover'); if (old) { old.remove(); return; }
    const pop = BW.html(`<div class="popover card">
      <div class="lbl">Saving to</div>
      <div class="here">${drv.kind === 'folder' ? '📁 ' + BW.esc(drv.label) : '🧪 This browser'}</div>
      ${BW.canUseFolders ? `<button class="menu-item" data-a="folder">📁 ${drv.kind === 'folder' ? 'Switch to another folder' : 'Move everything to a folder'}</button>` : ''}
      <button class="menu-item" data-a="backup">💾 Download a backup</button>
      <button class="menu-item" data-a="restore">♻️ Restore a backup</button>
      ${drv.kind === 'folder' ? '<div class="lbl" style="padding-top:4px">A copy is saved in backups/ every day</div><button class="menu-item" data-a="browser">🧪 Use this browser instead</button>' : ''}
    </div>`);
    const r = btn.getBoundingClientRect();
    pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    pop.style.right = Math.max(16, innerWidth - r.right) + 'px';
    document.body.append(pop);
    const away = (e) => { if (!pop.contains(e.target) && e.target !== btn) { pop.remove(); document.removeEventListener('mousedown', away); } };
    setTimeout(() => document.addEventListener('mousedown', away));
    pop.onclick = async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      pop.remove();
      if (a.dataset.a === 'backup') backup();
      if (a.dataset.a === 'restore') restore();
      if (a.dataset.a === 'folder') {
        if (drv.kind === 'browser') moveToFolder();
        else if (await pickFolder()) location.reload();
      }
      if (a.dataset.a === 'browser' && await BW.confirm('Your folder stays exactly as it is. This browser starts with its own separate copy.', { ok: 'Switch' })) {
        ls.set('bw.mode', 'browser'); location.reload();
      }
    };
  }

  // ---------- small routes: tools react to #new, #open/<id>, #start … from the palette or other tools ----------
  let routes = null;
  const runRoute = () => {
    if (!routes) return;
    const [k, ...rest] = location.hash.slice(1).split('/');
    if (!routes[k]) return;
    history.replaceState(null, '', location.pathname + location.search);
    routes[k](decodeURIComponent(rest.join('/')));
  };
  BW.route = (handlers) => { routes = handlers; runRoute(); };
  window.addEventListener('hashchange', runRoute);

  // ---------- keyboard shortcuts ----------
  const keys = [];
  BW.shortcut = (key, label, run) => keys.push({ key, label, run });
  const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (drv) BW.openPalette(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || BW.$('.modal-wrap, .drawer-wrap, .palette-wrap, .ob')) return;
    if (e.key === '?') { e.preventDefault(); showKeys(); return; }
    const k = keys.find((x) => x.key === e.key.toLowerCase());
    if (k) { e.preventDefault(); k.run(); }
  });
  function showKeys() {
    const rows = [['⌘K / Ctrl K', 'Search everything and jump anywhere'], ['?', 'This list']].concat(keys.map((k) => [k.key === '/' ? '/' : k.key.toUpperCase(), k.label]));
    BW.modal({ title: '⌨️ Keyboard shortcuts', body: `<div class="keys">${rows.map(([k, l]) => `<div><kbd>${BW.esc(k)}</kbd><span>${BW.esc(l)}</span></div>`).join('')}</div>` });
  }

  // ---------- ⌘K command palette ----------
  const CREATE = [
    ['🧾', 'New invoice', 'invoices', '#new/invoice'], ['💬', 'New quote', 'invoices', '#new/quote'], ['📇', 'New client', 'clients', '#new'],
    ['⏱️', 'Start the timer', 'time', '#start'], ['📸', 'Add an expense', 'expenses', '#new'], ['🗂️', 'New task', 'board', '#new'],
    ['📝', 'New document', 'docs', ''], ['🚗', 'Log a trip', 'trips', '#new'], ['📦', 'Add a product', 'stock', '#new'], ['🔁', 'Add a subscription', 'subscriptions', '#new'],
    ['📣', 'Ask the marketing team', 'marketing', '#tab/skills'], ['🗺️', 'Make a marketing plan', 'marketing', '#skill/marketing-plan'], ['🧐', 'Check an ad or post', 'marketing', '#skill/creative-check'], ['🧭', 'Weekly check-in with Olaf', 'olaf', '#tab/coach'],
  ];
  const go = (href) => {
    const url = new URL(href, location.href);
    if (url.pathname === location.pathname && url.hash) { location.hash = url.hash; runRoute(); } else location.href = url.href;
  };
  BW.openPalette = async (mode) => {
    if (BW.$('.palette-wrap')) return;
    const app = (a) => `${BW.root}apps/${a}/index.html`;
    const base = [];
    CREATE.forEach(([e, l, a, h]) => base.push({ group: 'Create', emoji: e, label: l, href: app(a) + h }));
    if (mode !== 'new') {
      BW.apps.filter((a) => a.ready).forEach((a) => base.push({ group: 'Go to', emoji: a.emoji, label: a.name, sub: a.tagline, href: app(a.id) }));
      base.push({ group: 'Go to', emoji: '🏠', label: 'Home', href: BW.root + 'index.html' });
      base.push({ group: 'Do', emoji: '⚙️', label: 'Business details', run: BW.openSettings });
      base.push({ group: 'Do', emoji: '🌓', label: 'Switch light / dark mode', run: BW.cycleTheme });
      base.push({ group: 'Do', emoji: '💾', label: 'Download a backup', run: backup });
      base.push({ group: 'Do', emoji: '♻️', label: 'Restore a backup', run: restore });
      base.push({ group: 'Do', emoji: '⌨️', label: 'Keyboard shortcuts', run: showKeys });
      base.push({ group: 'Do', emoji: '👀', label: 'Load or remove example data', sub: 'A pretend design studio, gone again in one click', href: BW.root + 'index.html' });
    }
    const found = [];
    const load = (async () => {
      const [cl, inv, docs, tasks, stock] = await Promise.all(['clients', 'invoices', 'documents', 'tasks', 'stock'].map((n) => BW.store.all(n).catch(() => [])));
      cl.forEach((c) => found.push({ group: 'Clients', emoji: '📇', label: c.name, sub: [c.contact, c.city].filter(Boolean).join(' · '), href: app('clients') + '#open/' + c.id }));
      inv.forEach((i) => found.push({ group: i.kind === 'quote' ? 'Quotes' : i.kind === 'credit' ? 'Credit notes' : 'Invoices', emoji: i.kind === 'quote' ? '💬' : '🧾', label: `${i.number} · ${i.client ? i.client.name : 'No client'}`, sub: BW.money(BW.invoiceTotals(i).total, i.currency), href: app('invoices') + '#edit/' + i.id }));
      docs.forEach((d) => found.push({ group: 'Documents', emoji: '📝', label: d.title || 'Untitled', href: app('docs') + '#edit/' + d.id }));
      tasks.forEach((t) => found.push({ group: 'Tasks', emoji: t.status === 'done' ? '✅' : '🗂️', label: t.title, href: app('board') + '#open/' + t.id }));
      stock.forEach((s) => found.push({ group: 'Stock', emoji: s.emoji || '📦', label: s.name, sub: `${BW.num(s.qty)} in stock`, href: app('stock') + '#open/' + s.id }));
    })();
    const wrap = BW.html(`<div class="palette-wrap"><div class="palette card" role="dialog" aria-modal="true" aria-label="Search and commands">
      <div class="pal-in"><span aria-hidden="true">${mode === 'new' ? '＋' : '🔍'}</span><input type="text" placeholder="${mode === 'new' ? 'What do you want to make?' : 'Search clients, invoices, tasks… or type an action'}" aria-label="Search" autocomplete="off"><kbd>esc</kbd></div>
      <div class="pal-list" role="listbox"></div>
      <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div></div></div>`);
    const input = BW.$('input', wrap), list = BW.$('.pal-list', wrap);
    let items = [], sel = 0;
    let untrap;
    const close = () => { untrap(); wrap.remove(); };
    untrap = trapClose(wrap, close);
    const draw = () => {
      const q = input.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
      const match = (it) => words.every((w) => (it.label + ' ' + (it.sub || '') + ' ' + it.group).toLowerCase().includes(w));
      items = q ? base.filter(match).concat(found.filter(match)).sort((a, b) => (b.label.toLowerCase().startsWith(q) ? 1 : 0) - (a.label.toLowerCase().startsWith(q) ? 1 : 0)).slice(0, 40)
        : base.slice(0, mode === 'new' ? 20 : 14);
      sel = Math.min(sel, Math.max(0, items.length - 1));
      let last = '';
      list.innerHTML = items.length ? items.map((it, i) => {
        const head = it.group !== last ? `<div class="pal-group">${BW.esc(it.group)}</div>` : '';
        last = it.group;
        return `${head}<div class="pal-item" role="option" data-i="${i}" aria-selected="${i === sel}"><span class="e">${BW.esc(it.emoji)}</span><span class="t"><b>${BW.esc(it.label)}</b>${it.sub ? `<small>${BW.esc(it.sub)}</small>` : ''}</span><span class="go">↵</span></div>`;
      }).join('') : '<div class="pal-empty">Nothing found. Try a client’s name or “new”.</div>';
      const on = BW.$('[aria-selected="true"]', list); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const pick = (i) => { const it = items[i]; if (!it) return; close(); if (it.run) it.run(); else go(it.href); };
    input.oninput = () => { sel = 0; draw(); };
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
    };
    list.onmousemove = (e) => { const r = e.target.closest('[data-i]'); if (r && Number(r.dataset.i) !== sel) { sel = Number(r.dataset.i); BW.$$('.pal-item', list).forEach((x) => x.setAttribute('aria-selected', String(Number(x.dataset.i) === sel))); } };
    list.onclick = (e) => { const r = e.target.closest('[data-i]'); if (r) pick(Number(r.dataset.i)); };
    document.body.append(wrap);
    draw(); input.focus();
    load.then(() => { if (input.value) draw(); });
  };

  // ---------- recurring invoices ----------
  BW.addPeriod = (iso, every, n = 1) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (every === 'week') return BW.addDays(iso, 7 * n);
    const months = { month: 1, quarter: 3, year: 12 }[every] || 1;
    const target = new Date(y, m - 1 + months * n, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d, last));
    return isoDate(target);
  };
  // Invoices with a schedule ("repeat") get a fresh draft for every date that has come round.
  BW.runRecurring = async () => {
    const list = await BW.store.all('invoices'), today = BW.today(), made = [], touched = [];
    for (const src of list) {
      const r = src.repeat;
      if (!r || !r.on || !r.next || src.kind !== 'invoice') continue;
      const days = src.dueDate && src.issueDate ? Math.round((Date.parse(src.dueDate) - Date.parse(src.issueDate)) / 864e5) : (BW.settings.paymentDays || 14);
      for (let guard = 0; r.next <= today && guard < 24; guard++) {
        const c = JSON.parse(JSON.stringify(src));
        ['id', 'createdAt', 'updatedAt', 'sentAt', 'paidAt', 'payments', 'repeat', 'creditFor', 'fromQuote'].forEach((k) => delete c[k]);
        c.items.forEach((it) => { it.id = BW.uid(); });
        Object.assign(c, { number: BW.nextNumber(list.concat(made), 'invoice', r.next.slice(0, 4)), status: 'draft', issueDate: r.next, dueDate: BW.addDays(r.next, days), fromRepeat: src.id });
        made.push(c);
        r.next = BW.addPeriod(r.next, r.every);
      }
      if (made.some((c) => c.fromRepeat === src.id)) touched.push(src);
    }
    if (made.length) await BW.store.putMany('invoices', made.concat(touched));
    return made;
  };

  /* Olaf is a paid add-on that lives in apps/olaf/ only in the paid download (and as a demo on the
     website). Resolves to 'full', 'demo' or null, so free pages can link to it or to the Olaf page. */
  let olafCheck = null;
  BW.olafInstalled = () => olafCheck || (olafCheck = BW.loadScript(BW.root + 'apps/olaf/olaf-installed.js').then(() => BW.olafEdition || 'full', () => null));
  BW.olafPage = () => BW.siteUrl + '/olaf.html';
  BW.loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.body.append(s); });

  function topbar(app) {
    const theme = THEMES.find((t) => t[0] === (ls.get('bw.theme') || '')) || THEMES[0];
    const bar = BW.html(`<header class="topbar"><div class="wrap">
      <a class="brandmark" href="${BW.root}index.html" title="All tools"><span class="blob">✦</span><span class="word">${BW.brand.name}</span></a>
      ${app ? `<div class="crumb"><span class="slash">/</span><span>${app.emoji}</span><span class="app-name">${app.name}</span></div>` : ''}
      <div class="spacer"></div>
      <button class="btn btn-ghost search-btn" data-palette hidden title="Search everything (⌘K)"><span>🔍</span><span class="lbl">Search</span><kbd class="lbl">⌘K</kbd></button>
      <button class="btn btn-primary new-btn" data-new hidden title="Make something new"><span>＋</span><span class="lbl">New</span></button>
      <button class="icon-btn" data-theme-btn title="Light, dark or automatic">${theme[1]}</button>
      <button class="btn btn-ghost store-chip" data-store hidden><span>📁</span><span class="lbl"></span></button>
      <button class="btn settings-btn" data-settings hidden title="Business details"><span class="emo">⚙️</span><span class="lbl">Business details</span></button>
    </div></header>`);
    document.body.prepend(bar);
    BW.$('[data-theme-btn]', bar).onclick = BW.cycleTheme;
    return bar;
  }

  // Every page calls this once: draws the top bar, connects storage, runs first-time setup, then hands over.
  BW.boot = async ({ app: appId, onReady, onChange } = {}) => {
    BW.root = document.body.dataset.root || '';
    const app = BW.apps.find((a) => a.id === appId);
    const bar = topbar(app);
    if (onChange) BW.onChange(onChange);
    try {
      await connect();
      BW.settings = await BW.store.settings();
      if (!BW.settings.businessName) await runWizard();
    } catch (e) { BW.error(e); return; }
    const chip = BW.$('[data-store]', bar);
    chip.hidden = false;
    BW.$('span', chip).textContent = drv.kind === 'folder' ? '📁' : '🧪';
    BW.$('.lbl', chip).textContent = drv.kind === 'folder' ? drv.label : 'This browser';
    chip.onclick = () => storeMenu(chip);
    const sb = BW.$('[data-settings]', bar); sb.hidden = false; sb.onclick = BW.openSettings;
    const pb = BW.$('[data-palette]', bar); pb.hidden = false; pb.onclick = () => BW.openPalette();
    const nb = BW.$('[data-new]', bar); nb.hidden = false; nb.onclick = () => BW.openPalette('new');
    if (/Mac|iPhone|iPad/.test(navigator.platform)) BW.$('kbd', pb).textContent = '⌘K'; else BW.$('kbd', pb).textContent = 'Ctrl K';
    try { await BW.runRecurring(); } catch (e) { console.warn('Recurring invoices skipped', e); }
    if (onReady) { try { await onReady(); } catch (e) { BW.error(e); } }
    const ad = BW.adSlot(appId);
    if (ad) document.body.append(ad);
    autoBackup();
    installable();
  };

  // On the hosted copy (https), the suite can be installed like an app and keeps working offline.
  function installable() {
    if (!('serviceWorker' in navigator) || !/^https:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    if (!BW.$('link[rel=manifest]')) document.head.append(BW.html(`<link rel="manifest" href="${BW.root}manifest.webmanifest">`));
    navigator.serviceWorker.register(BW.root + 'sw.js').catch(() => { /* still works online */ });
  }
})();
