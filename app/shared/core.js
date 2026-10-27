/* Busy core: storage, business details, onboarding and the shared UI bits.
   A plain script rather than a module, because module scripts refuse to load
   when a page is opened straight from disk (file://). */
(function () {
  'use strict';
  const BW = (window.BW = window.BW || {});

  BW.brand = { name: 'Busy', tagline: 'Make your paperwork fun again.' };
  // The website. build.py puts the real address in the copies it publishes and zips.
  BW.siteUrl = 'https://busywork.example';
  // The release, shown in problem reports and written into the business folder (data/meta.json).
  BW.version = '0.9.0';
  // A shell around Busy (a desktop or phone app, a test, a hosted version) can set window.BW_HOST
  // before this file loads to bring its own storage driver, platform functions, AI transport or
  // entitlements. A plain browser tab sets nothing and gets the defaults below. See ARCHITECTURE.md.
  const host = window.BW_HOST || {};

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
    { id: 'olaf', name: 'Olaf', emoji: '🧭', color: 'grape', ready: true, tagline: 'Your AI expert for marketing and projects: a plan, a weekly check-in, and the work done with you.', addon: true },
    { id: 'projects', name: 'Project Planner', emoji: '🗓️', color: 'sky', ready: true, tagline: 'Milestones, a timeline and who does what, for every project.' },
    { id: 'team', name: 'Team Mode', emoji: '👥', color: 'mint', ready: false, tagline: 'Share one business folder with your team and see who did what.' },
  ].map((a) => Object.assign({ suite: 'business' }, a)).concat([
    { id: 'library', suite: 'growth', name: 'Library', emoji: '📚', color: 'sky', ready: true, tagline: 'Everything you read and learn, kept and easy to find again.' },
    { id: 'learning', suite: 'growth', name: 'Learning Planner', emoji: '🎓', color: 'grape', ready: true, tagline: 'Courses, books and projects, planned week by week.' },
    { id: 'skills', suite: 'growth', name: 'Skills Map', emoji: '🧠', color: 'pink', ready: true, tagline: 'What you can do, how well, and the proof behind it.' },
    { id: 'wins', suite: 'growth', name: 'Wins Log', emoji: '🏆', color: 'sun', ready: true, tagline: 'Every achievement, ready for your CV and your next review.' },
    { id: 'jobs', suite: 'growth', name: 'Job Tracker', emoji: '🎯', color: 'tomato', ready: true, tagline: 'Every application on a board, with follow-ups that never slip.' },
    { id: 'cv', suite: 'growth', name: 'CV Builder', emoji: '📄', color: 'teal', ready: true, tagline: 'CVs and cover letters from your real skills and wins.' },
    { id: 'stories', suite: 'growth', name: 'Interview Stories', emoji: '🎤', color: 'mint', ready: true, tagline: 'Your best stories, linked to the skills they prove.' },
    { id: 'contacts', suite: 'growth', name: 'Contacts', emoji: '🤝', color: 'grape', ready: true, tagline: 'The people in your corner, and when to catch up again.' },
    { id: 'review', suite: 'growth', name: 'Weekly Review', emoji: '🪞', color: 'sun', ready: true, tagline: 'Ten minutes on Friday: what moved, what was hard, what’s next.' },
    { id: 'ivy', suite: 'growth', name: 'Ivy', emoji: '🌿', color: 'mint', ready: false, tagline: 'Your AI coach for professional growth. Learn it, prove it, land it.' },
  ]);

  // A suite is a set of tools with its own home page and its own folder. Business folders and growth
  // folders never mix: each suite remembers its own folder on this computer.
  BW.SUITES = {
    business: { name: 'Busy Business', home: 'index.html', noun: 'business', folder: 'My Business', details: 'Business details', key: '' },
    growth: { name: 'Busy Growth', home: 'growth.html', noun: 'growth folder', folder: 'My Growth', details: 'Your details', key: ':growth' },
  };
  BW.suite = 'business';
  const suite = () => BW.SUITES[BW.suite] || BW.SUITES.business;
  BW.suiteApps = () => BW.apps.filter((a) => a.suite === BW.suite);

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
  // ---------- platform ----------
  // The few things that work differently in a browser tab, an installed web app or a future desktop
  // or phone shell. Apps call these, never the browser directly; a shell replaces any of them
  // through window.BW_HOST.platform.
  BW.platform = Object.assign({
    kind: location.protocol === 'file:' ? 'file' : (window.matchMedia && matchMedia('(display-mode: standalone)').matches ? 'installed' : 'web'),
    download(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
    openUrl(url) { window.open(url, '_blank', 'noopener'); },
    // Resolves true when the text is on the clipboard. Falls back to the old way for file:// pages
    // in browsers that keep the clipboard API for https.
    async copy(text) {
      try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* try the old way */ }
      const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.append(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* no clipboard at all */ }
      t.remove(); return ok;
    },
  }, host.platform);
  BW.download = (blob, name) => BW.platform.download(blob, name);
  BW.openUrl = (url) => BW.platform.openUrl(url);
  BW.copy = (text) => BW.platform.copy(text);

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

  // Markdown for AI answers: escape everything first, then render a small, safe subset.
  BW.md = function md(src) {
    const esc = BW.esc;
    const lines = esc(src || '').split('\n'), out = [];
    let i = 0;
    const inline = (t) => t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${buf.join('\n')}</code></pre>`); continue; }
      if (/^#{1,4} /.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n}>${inline(l.slice(n + 1))}</h${n}>`); i++; continue; }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\|/.test(l) && i + 1 < lines.length && /^\|?\s*:?-+:?\s*\|/.test(lines[i + 1])) {
        const row = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = row(l); i += 2; const body = [];
        while (i < lines.length && /^\|/.test(lines[i])) body.push(row(lines[i++]));
        out.push(`<table><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`); continue;
      }
      if (/^\s*([-*]|\d+\.) /.test(l)) {
        const ordered = /^\s*\d+\./.test(l), items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.) /, '').replace(/^\[( |x)\] /i, (m0, x) => (x.trim() ? '☑ ' : '☐ ')));
        out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
      }
      if (/^&gt; ?/.test(l)) { const buf = []; while (i < lines.length && /^&gt; ?/.test(lines[i])) buf.push(lines[i++].replace(/^&gt; ?/, '')); out.push(`<blockquote>${inline(buf.join('<br>'))}</blockquote>`); continue; }
      if (!l.trim()) { i++; continue; }
      // A line no branch above took (say a lone "|" row) still starts a paragraph, so the loop always moves on.
      const buf = [lines[i++]]; while (i < lines.length && lines[i].trim() && !/^(#{1,4} |```|\||\s*([-*]|\d+\.) |&gt;)/.test(lines[i])) buf.push(lines[i++]);
      out.push(`<p>${inline(buf.join('<br>'))}</p>`);
    }
    return out.join('');
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
  // A driver is where a business lives. All of them keep the same contract, so no app knows (or
  // cares) whether that is a folder, this browser, memory in a test, or later a native shell or a
  // sync service. Collections are arrays of records, except settings and meta, which are objects.
  //   kind, label                        what it is, for the top bar
  //   readJSON(name, fallback)           one collection, or fallback when there is none
  //   writeJSON(name, value)             replaces the collection whole
  //   list()                             names of the collections that exist
  //   readFile(path) -> Blob | null      other files by path: receipts, backups
  //   writeFile(path, blob, opts)        -> { saved, where }; opts.download false: never fall back to a download
  //   listFiles(dir), removeFile(path)   used for tidying old backups
  // Every collection is one JSON file in data/, so a folder stays readable by people. DATA.md
  // describes each collection.
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
      async listFiles(path) {
        const names = [];
        try { for await (const [n, h] of (await dir(path)).entries()) if (h.kind === 'file') names.push(n); } catch (e) { /* nothing there */ }
        return names;
      },
      async removeFile(path) {
        const parts = path.split('/'); const fname = parts.pop();
        try { await (await dir(parts.join('/'))).removeEntry(fname); } catch (e) { if (e.name !== 'NotFoundError') throw e; }
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
      async listFiles() { return []; },
      async removeFile() { /* nothing is kept */ },
    };
  }

  // Keeps everything in memory, as JSON text so a caller can never change stored data by accident.
  // For tests, previews and demos; gone when the page closes.
  function MemoryDriver(seed) {
    const data = new Map(Object.entries(seed || {}).map(([k, v]) => [k, JSON.stringify(v)]));
    const files = new Map();
    return {
      kind: 'memory',
      label: 'memory',
      async readJSON(name, fallback) { return data.has(name) ? JSON.parse(data.get(name)) : fallback; },
      async writeJSON(name, val) { data.set(name, JSON.stringify(val)); },
      async list() { return [...data.keys()]; },
      async readFile(path) { return files.get(path) || null; },
      async writeFile(path, blob) { files.set(path, blob); return { saved: true, where: 'memory' }; },
      async listFiles(path) {
        const pre = path.replace(/\/?$/, '/');
        return [...files.keys()].filter((k) => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map((k) => k.slice(pre.length));
      },
      async removeFile(path) { files.delete(path); },
    };
  }
  BW.drivers = { folder: FolderDriver, browser: BrowserDriver, memory: MemoryDriver };

  let drv = null;
  // Swaps the driver in place: for tests and shells. Pages use connect() below.
  BW.useDriver = (d) => { drv = d; readOnly = ''; };
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

  // Set when the data is newer than this copy of Busy understands: reading works, saving does not.
  let readOnly = '';
  const writable = () => { if (readOnly) throw new Error(readOnly); };
  const serialWrite = (fn, name) => serial(async () => { writable(); return fn(); }, name);

  BW.store = {
    get kind() { return drv && drv.kind; },
    get where() { return drv ? drv.label : ''; },
    get readOnly() { return readOnly; },
    all: (name) => drv.readJSON(name, []),
    async get(name, id) { return (await drv.readJSON(name, [])).find((r) => r.id === id) || null; },
    // Read-modify-write per save, so two open apps do not overwrite each other's records.
    put: (name, rec) => serialWrite(async () => {
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
    putMany: (name, recs) => serialWrite(async () => {
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
    remove: (name, id) => serialWrite(async () => {
      const list = await drv.readJSON(name, []);
      await drv.writeJSON(name, list.filter((r) => r.id !== id));
      notify(name);
    }, name),
    removeWhere: (name, test) => serialWrite(async () => {
      const list = await drv.readJSON(name, []);
      const keep = list.filter((r) => !test(r));
      if (keep.length !== list.length) { await drv.writeJSON(name, keep); notify(name); }
      return list.length - keep.length;
    }, name),
    replaceAll: (name, list) => serialWrite(async () => { await drv.writeJSON(name, list); notify(name); }, name),
    collections: () => drv.list(),
    async settings() { return Object.assign({}, DEFAULTS, await drv.readJSON('settings', {})); },
    saveSettings: (s) => serialWrite(async () => {
      await drv.writeJSON('settings', s);
      BW.settings = Object.assign({}, DEFAULTS, s);
      notify('settings');
    }, 'settings'),
    writeFile: (path, blob, opts) => { writable(); return drv.writeFile(path, blob, opts); },
    readFile: (path) => drv.readFile(path),
    listFiles: (path) => drv.listFiles(path),
    removeFile: (path) => { writable(); return drv.removeFile(path); },
  };

  // ---------- data versions ----------
  // data/meta.json says which version of the data format a business is in. When a release changes
  // the shape of a record, it adds a step to MIGRATIONS (and DATA.md) instead of patching records
  // wherever they are read. Steps run once, oldest first, at start-up, after a full backup of how
  // things were. Each step records its version when done, so a step interrupted halfway runs again:
  // write steps so that running one twice does no harm.
  // A business last saved by a newer version of Busy opens read-only, so an old copy on another computer
  // (the same folder synced through Google Drive, say) can never undo what the new one changed.
  BW.DATA_VERSION = 1;
  const MIGRATIONS = [
    // { to: 2, about: 'Invoices keep their lines in `items` instead of `lines`',
    //   async run(db) { const list = await db.read('invoices', []); ...; await db.write('invoices', list); } },
  ];
  BW.migrate = async function migrate(d = drv, steps = MIGRATIONS, target = BW.DATA_VERSION) {
    const run = async () => {
      const meta = (await d.readJSON('meta', null)) || {};
      const names = (await d.list()).filter((n) => n !== 'meta');
      // No meta yet: a brand-new business starts at the current version; older data is version 1.
      let v = Number(meta.dataVersion) || (names.length ? 1 : target);
      const save = () => d.writeJSON('meta', Object.assign(meta, { dataVersion: v, savedBy: BW.version, updatedAt: new Date().toISOString() }, meta.createdAt ? {} : { createdAt: new Date().toISOString() }));
      if (v > target) return { status: 'newer', version: v };
      const todo = steps.filter((st) => st.to > v && st.to <= target).sort((a, b) => a.to - b.to);
      if (!todo.length) { if (meta.dataVersion !== v) await save(); return { status: 'current', version: v }; }
      const copy = new Blob([JSON.stringify(await snapshot(d))], { type: 'application/json' });
      const saved = await d.writeFile(`backups/before-update-v${v}-${BW.today()}-${Date.now()}.json`, copy, { download: false }).catch(() => ({ saved: false }));
      if (!saved.saved) ls.set('bw.beforeUpdate', await copy.text());
      const db = { read: (n, fb) => d.readJSON(n, fb), write: (n, val) => d.writeJSON(n, val), list: () => d.list() };
      for (const st of todo) { await st.run(db); v = st.to; await save(); }
      return { status: 'updated', version: v, steps: todo.length };
    };
    return navigator.locks ? navigator.locks.request('busywork:migrate', run) : run();
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
  BW.error = (e) => { console.error(e); BW.problems.note('shown', e); BW.toast(BW.esc(e && e.message ? e.message : String(e)), '😬'); };

  // ---------- problems ----------
  // The last 30 errors, kept in this browser only, so an owner can send a problem report. Messages
  // and stack lines only: no records, no settings, no key. Nothing is ever sent anywhere by itself.
  // Where we are, without the folders above Busy (they can carry a person's name).
  const pagePath = () => { const parts = location.pathname.split('/'); const i = parts.lastIndexOf('apps'); return i >= 0 ? parts.slice(i).join('/') : parts.pop(); };
  BW.problems = {
    list() { try { return JSON.parse(ls.get('bw.problems') || '[]'); } catch (e) { return []; } },
    note(kind, e) {
      const msg = String(e && e.message ? e.message : e).replace(/sk-ant-[\w-]+/g, 'sk-ant-…').slice(0, 300);
      const list = BW.problems.list().slice(-29);
      list.push({ at: new Date().toISOString(), kind, page: pagePath(), message: msg,
        stack: String((e && e.stack) || '').split('\n').slice(1, 6).map((l) => l.trim().replace(/(?:file|https?):\/\/\S*?\/(apps|shared)\//, '$1/')).join('\n') });
      ls.set('bw.problems', JSON.stringify(list));
    },
    clear() { ls.del('bw.problems'); },
  };
  window.addEventListener('error', (e) => BW.problems.note('error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => BW.problems.note('promise', e.reason));
  // A problem report: what someone helping needs to know, and nothing about the business itself
  // (collections are counted, never copied).
  BW.diagnostics = async () => {
    const counts = {};
    if (drv) for (const n of await drv.list()) { const v = await drv.readJSON(n, null).catch(() => 'unreadable'); counts[n] = Array.isArray(v) ? v.length : typeof v; }
    const meta = drv ? await drv.readJSON('meta', {}).catch(() => ({})) : {};
    return { report: 'Busy problem report', made: new Date().toISOString(), version: BW.version, dataVersion: meta.dataVersion || null,
      supportedDataVersion: BW.DATA_VERSION, storage: drv ? drv.kind : null, readOnly: !!readOnly, platform: BW.platform.kind,
      browser: navigator.userAgent, language: navigator.language, page: pagePath(),
      olaf: await BW.entitlements.edition('olaf'), collections: counts, problems: BW.problems.list() };
  };

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
  BW.houseAds = () => BW.suiteApps().filter((a) => a.ready).map((a) => ({
    id: a.id, emoji: a.emoji, title: `Try ${a.name}`, text: a.tagline, cta: 'Open it', href: `${BW.root}apps/${a.id}/index.html`, color: a.color,
  })).concat(BW.suiteApps().filter((a) => !a.ready).map((a) => ({
    id: a.id, emoji: a.emoji, title: `Coming soon: ${a.name}`, text: a.tagline, color: a.color,
  })));
  BW.adSlot = (here) => {
    let pool = BW.sponsors.length ? BW.sponsors.map((s) => Object.assign({ sponsored: true }, s)) : BW.houseAds().filter((h) => h.id !== here);
    const olaf = pool.find((h) => h.id === 'olaf');
    if (olaf && !BW.sponsors.length) {
      olaf.title = 'Want more customers? Meet Olaf'; olaf.text = 'Your AI expert for marketing and projects: a 90-day plan, a weekly check-in and the work done with you.'; olaf.cta = 'Meet Olaf';
      if (BW.olafEdition !== 'full') { olaf.href = BW.olafEdition === 'demo' ? olaf.href : BW.olafPage(); olaf.external = BW.olafEdition !== 'demo'; }
      pool = pool.concat([olaf, olaf, olaf]); // about one in four cards
    }
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
  // Busy Growth asks about the person, not a business.
  const GROWTH_STEPS = [
    { emoji: '👋', title: 'Hi! What should we call you?', sub: 'Busy Growth is your own place to learn, keep track of what you can do, and land what’s next.', fields: [
      { k: 'ownerName', label: 'Your name', ph: 'e.g. Sam Jansen', required: true },
      { k: 'headline', label: 'What you do now', ph: 'e.g. Marketing coordinator at a bakery chain', hint: 'Or “Student”, “Between jobs”, anything that fits.' },
    ] },
    { emoji: '🌱', title: 'Where would you like to grow?', sub: 'A rough idea is fine. You can change it any time.', fields: [
      { k: 'targetRole', label: 'A role you’d like next', ph: 'e.g. Product marketing manager' },
      { k: 'goal', label: 'In a year I’d like to…', ph: 'e.g. lead my own campaigns and be paid for it', span: 2 },
      { k: 'learnHoursWeek', label: 'Hours a week for learning', type: 'chips', options: [[1, '1 hour'], [2, '2 hours'], [3, '3 hours'], [5, '5 hours']] },
    ] },
  ];
  const GROWTH_DETAILS = GROWTH_STEPS[0].fields.concat(GROWTH_STEPS[1].fields, [
    { k: 'email', label: 'Email', type: 'email', ph: 'you@example.com', hint: 'Shown on your CV.' },
    { k: 'phone', label: 'Phone', ph: '+31 6 1234 5678' },
    { k: 'linkedin', label: 'LinkedIn', ph: 'linkedin.com/in/you' },
    { k: 'city', label: 'Where you live', ph: 'e.g. Utrecht' },
  ]);
  const COLORS = ['#FF6B4A', '#F5A623', '#2FD18C', '#22C3C3', '#4DA3FF', '#9B6BFF', '#FF7AC6', '#1E1B2E'];

  function fieldsHtml(fields, data) {
    return `<div class="grid-2">${fields.map((f) => {
      const v = data[f.k] == null ? '' : data[f.k];
      let input;
      // Option labels are often names the owner typed (clients, projects), so they are escaped.
      // A field with html: true has labels written in code, such as colour swatches.
      if (f.type === 'select') input = `<select class="in" name="${f.k}">${f.options.map(([val, l]) => `<option value="${BW.esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${BW.esc(l)}</option>`).join('')}</select>`;
      else if (f.type === 'chips') input = `<div class="choice-chips" data-name="${f.k}">${f.options.map(([val, l]) => `<button type="button" data-v="${BW.esc(val)}" aria-pressed="${String(val) === String(v)}">${f.html ? l : BW.esc(l)}</button>`).join('')}</div>`;
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

  function runWizard(steps = BW.suite === 'growth' ? GROWTH_STEPS : STEPS) {
    return new Promise((resolve) => {
      const data = Object.assign({}, BW.settings, BW.suite === 'business' ? {} : { suite: BW.suite });
      let i = 0;
      const ob = overlay('<div class="ob-card card"></div>');
      const card = BW.$('.ob-card', ob);
      const render = () => {
        const done = i >= steps.length;
        const st = steps[i] || {};
        card.innerHTML = done
          ? `<div style="text-align:center"><div class="ob-emoji">🎉</div><h1>You're all set, ${BW.esc((data.ownerName || '').split(' ')[0] || data.businessName)}!</h1>
             <p class="sub">Your ${BW.suite === 'growth' ? 'details are' : 'business details are'} saved. Change them any time with the ⚙️ button at the top.</p>
             <button class="btn btn-primary btn-big" data-go>Let's go →</button></div>`
          : `<div class="dots">${steps.map((_, n) => `<i class="${n === i ? 'on' : n < i ? 'done' : ''}"></i>`).join('')}</div>
             <div class="ob-emoji">${st.emoji}</div><h1>${st.title}</h1><p class="sub">${st.sub}</p>
             <form data-step>${st.custom === 'look' ? lookHtml(data) : fieldsHtml(st.fields, data)}</form>
             <div class="ob-foot">${i > 0 ? '<button class="btn btn-ghost" data-back>← Back</button>' : ''}<div class="spacer"></div>
               ${i > 0 ? '<button class="btn btn-ghost" data-skip>Skip for now</button>' : ''}
               <button class="btn btn-primary btn-big" data-next>${i === steps.length - 1 ? 'Finish' : 'Next'} →</button></div>`;
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
    if (BW.suite === 'growth') return growthSettings();
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

  function growthSettings() {
    const data = Object.assign({}, BW.settings);
    const box = BW.html(`<div>${fieldsHtml(GROWTH_DETAILS, data)}</div>`);
    bindChips(box);
    BW.modal({
      title: '⚙️ Your details', body: box, wide: true,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Save', kind: 'primary', onClick: async () => {
          readFields(box, data);
          if (!data.ownerName) { BW.toast('What should we call you? 🙂', '✏️'); return false; }
          try { await BW.store.saveSettings(Object.assign(data, { suite: 'growth' })); BW.toast('Saved.', '✨'); listeners.forEach((fn) => fn('settings')); }
          catch (e) { BW.error(e); return false; }
        } },
      ],
    });
  }

  // ---------- connecting storage ----------
  async function welcome() {
    // The paid edition says where Olaf's requests go; the free download has no AI to mention.
    const olafHere = await BW.olafInstalled();
    return new Promise((resolve) => {
      const ob = overlay(`<div class="ob-card card wide">
        <div class="ob-emoji">👋</div>
        <h1>Hi! Where should your ${suite().noun} live?</h1>
        <p class="sub">Busy saves everything as normal files in a folder you choose, so it’s yours: easy to back up, never lost when a browser is cleared.</p>
        ${BW.canUseFolders ? `<div class="options" style="grid-template-columns:1fr">
          <button class="option" data-folder>
            <span class="emo">📁</span><b>Choose a folder for my ${suite().noun}</b>
            <p>Make a new folder like <b>“${suite().folder}”</b>. <br>Tip: put it inside Google Drive, Dropbox, OneDrive or iCloud Drive and it backs up and syncs by itself.</p>
          </button>
        </div>` : `<div class="idea"><span class="e">🧭</span><div><b>Open Busy in Chrome or Edge.</b> This browser can't save to a folder on your computer, and Busy keeps your business in files, not inside a browser where clearing your history would delete it. Chrome and Edge are free for Mac and Windows: open the same <b>index.html</b> in one of them.</div></div>`}
        <div class="privacy-note"><span>🔒</span><span><b>Private by design.</b> There's no account and no server, and nothing you type is sent to us.${olafHere ? ' Olaf sends only what you ask it to Anthropic, the maker of Claude, with your own key.' : ''}</span></div>
      </div>`);
      const folder = BW.$('[data-folder]', ob);
      if (folder) folder.onclick = async () => {
        const ok = await pickFolder();
        if (ok) { ob.remove(); resolve(); }
      };
    });
  }

  async function pickFolder() {
    let h;
    try { h = await window.showDirectoryPicker({ id: 'busywork', mode: 'readwrite' }); }
    catch (e) { if (e.name !== 'AbortError') BW.error(e); return false; }
    await kv.set('root' + suite().key, h);
    ls.set('bw.mode' + suite().key, 'folder');
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
    if (host.driver) { drv = await host.driver(); return; }
    const mode = ls.get('bw.mode' + suite().key);
    if (mode === 'browser') { drv = BrowserDriver(); return; }
    if (mode === 'folder' && BW.canUseFolders) {
      const h = await kv.get('root' + suite().key);
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
  // A backup is one JSON file: a few _fields about the file, then every collection under its name.
  async function snapshot(d = drv) {
    const out = { _busywork: 1, _made: new Date().toISOString(), _app: BW.version };
    for (const name of new Set(['settings', ...(await d.list())])) { const v = await d.readJSON(name, null); if (v != null) out[name] = v; }
    return out;
  }
  BW.snapshot = () => snapshot();
  async function backup() {
    BW.download(new Blob([JSON.stringify(await snapshot(), null, 2)], { type: 'application/json' }), `busy-backup-${BW.today()}.json`);
  }
  // Daily copies past the newest 14, oldest first. busywork-… copies are from before the rename and
  // age out the same way, by their date.
  BW.backupsToRemove = (names, keep = 14) => {
    const day = (n) => n.replace(/^\D+/, '');
    return names.filter((n) => /^busy(work)?-\d{4}-\d\d-\d\d\.json$/.test(n)).sort((a, b) => day(a).localeCompare(day(b))).slice(0, -keep);
  };
  // Once a day, folder mode keeps a full copy in backups/ and clears out copies older than two weeks.
  async function autoBackup() {
    if (drv.kind !== 'folder') return;
    const name = `busy-${BW.today()}.json`;
    try {
      if (await drv.readFile('backups/' + name)) return;
      const data = await snapshot();
      if (!Object.keys(data).some((k) => k[0] !== '_' && k !== 'settings' && k !== 'meta')) return; // nothing worth keeping yet
      await drv.writeFile('backups/' + name, new Blob([JSON.stringify(data)], { type: 'application/json' }));
      BW.backupsToRemove(await drv.listFiles('backups')).forEach((n) => drv.removeFile('backups/' + n).catch(() => {}));
    } catch (e) { console.warn('Backup skipped', e); }
  }
  function restore() {
    const input = BW.html('<input type="file" accept=".json,application/json" hidden>');
    document.body.append(input);
    input.onchange = async () => {
      const f = input.files[0]; input.remove(); if (!f) return;
      let data;
      try { data = JSON.parse(await f.text()); } catch (e) { return BW.toast('That file isn’t a Busy backup.', '🤔'); }
      const names = Object.keys(data).filter((k) => !k.startsWith('_'));
      if (!names.length) return BW.toast('That backup is empty.', '🤔');
      const version = Number(data.meta && data.meta.dataVersion) || 1;
      if (version > BW.DATA_VERSION) return BW.toast('That backup was made by a newer version of Busy. Download the latest version of Busy first.', '🤔');
      if (!(await BW.confirm(`Replace what’s here now with the backup from <b>${BW.esc((data._made || f.name).slice(0, 10))}</b>? We first save a copy of what you have now.`, { ok: 'Restore', title: 'Restore a backup?' }))) return;
      try {
        if (drv.kind === 'folder') await drv.writeFile(`backups/before-restore-${Date.now()}.json`, new Blob([JSON.stringify(await snapshot())], { type: 'application/json' }));
        else await backup();
        for (const n of names) await drv.writeJSON(n, data[n]);
        // Older backups have no meta: say which version they are, so the update steps run on reload.
        if (!data.meta) await drv.writeJSON('meta', { dataVersion: version, restoredAt: new Date().toISOString() });
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
      ${drv.kind === 'folder' ? '<div class="lbl" style="padding-top:4px">A copy is saved in backups/ every day</div>' : ''}
      <button class="menu-item" data-a="report">🩺 Download a problem report</button>
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
      if (a.dataset.a === 'report') {
        BW.download(new Blob([JSON.stringify(await BW.diagnostics(), null, 2)], { type: 'application/json' }), `busy-problem-report-${BW.today()}.json`);
        BW.toast('Report downloading. It counts your records but contains none of them.', '🩺');
      }
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
    ['🔗', 'Save a link', 'library', '#new/link'], ['📝', 'Write a note', 'library', '#new/note'], ['📎', 'Add files to the Library', 'library', '#new/file'],
    ['🎓', 'Plan something to learn', 'learning', '#new'], ['🧠', 'Add a skill', 'skills', '#new'], ['🏆', 'Log a win', 'wins', '#new'],
    ['🎯', 'Add a job', 'jobs', '#new'], ['📄', 'New CV version', 'cv', '#new'], ['🎤', 'Write an interview story', 'stories', '#new'], ['🎲', 'Practise an interview question', 'stories', '#practice'],
    ['🤝', 'Add a contact', 'contacts', '#new'], ['🪞', 'Review this week', 'review', '#new'],
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
    const mine = new Set(BW.suiteApps().map((a) => a.id));
    CREATE.filter((c) => mine.has(c[2])).forEach(([e, l, a, h]) => base.push({ group: 'Create', emoji: e, label: l, href: app(a) + h }));
    if (mode !== 'new') {
      BW.suiteApps().filter((a) => a.ready).forEach((a) => base.push({ group: 'Go to', emoji: a.emoji, label: a.name, sub: a.tagline, href: app(a.id) }));
      base.push({ group: 'Go to', emoji: '🏠', label: 'Home', href: BW.root + suite().home });
      base.push({ group: 'Do', emoji: '⚙️', label: suite().details, run: BW.openSettings });
      base.push({ group: 'Do', emoji: '🌓', label: 'Switch light / dark mode', run: BW.cycleTheme });
      base.push({ group: 'Do', emoji: '💾', label: 'Download a backup', run: backup });
      base.push({ group: 'Do', emoji: '♻️', label: 'Restore a backup', run: restore });
      base.push({ group: 'Do', emoji: '⌨️', label: 'Keyboard shortcuts', run: showKeys });
      if (BW.suite === 'business') base.push({ group: 'Do', emoji: '👀', label: 'Load or remove example data', sub: 'A pretend design studio, gone again in one click', href: BW.root + 'index.html' });
    }
    const found = [];
    const load = (async () => {
      const [cl, inv, docs, tasks, stock] = await Promise.all(['clients', 'invoices', 'documents', 'tasks', 'stock'].map((n) => BW.store.all(n).catch(() => [])));
      cl.forEach((c) => found.push({ group: 'Clients', emoji: '📇', label: c.name, sub: [c.contact, c.city].filter(Boolean).join(' · '), href: app('clients') + '#open/' + c.id }));
      inv.forEach((i) => found.push({ group: i.kind === 'quote' ? 'Quotes' : i.kind === 'credit' ? 'Credit notes' : 'Invoices', emoji: i.kind === 'quote' ? '💬' : '🧾', label: `${i.number} · ${i.client ? i.client.name : 'No client'}`, sub: BW.money(BW.invoiceTotals(i).total, i.currency), href: app('invoices') + '#edit/' + i.id }));
      docs.forEach((d) => found.push({ group: 'Documents', emoji: '📝', label: d.title || 'Untitled', href: app('docs') + '#edit/' + d.id }));
      tasks.forEach((t) => found.push({ group: 'Tasks', emoji: t.status === 'done' ? '✅' : '🗂️', label: t.title, href: app('board') + '#open/' + t.id }));
      stock.forEach((s) => found.push({ group: 'Stock', emoji: s.emoji || '📦', label: s.name, sub: `${BW.num(s.qty)} in stock`, href: app('stock') + '#open/' + s.id }));
      const [lib, learn, skills, wins] = await Promise.all(['library', 'learning', 'skills', 'wins'].map((n) => BW.store.all(n).catch(() => [])));
      lib.forEach((x) => found.push({ group: 'Library', emoji: x.kind === 'link' ? '🔗' : x.kind === 'note' ? '📝' : '📎', label: x.title || x.url || 'Untitled', sub: x.tags || '', href: app('library') + '#open/' + x.id }));
      learn.forEach((x) => found.push({ group: 'Learning', emoji: '🎓', label: x.title, sub: x.provider || '', href: app('learning') + '#open/' + x.id }));
      skills.forEach((x) => found.push({ group: 'Skills', emoji: '🧠', label: x.name, sub: x.category || '', href: app('skills') + '#open/' + x.id }));
      wins.forEach((x) => found.push({ group: 'Wins', emoji: '🏆', label: x.title, sub: x.date || '', href: app('wins') + '#open/' + x.id }));
      const [jobs, cvs, stories] = await Promise.all(['applications', 'cvs', 'stories'].map((n) => BW.store.all(n).catch(() => [])));
      jobs.forEach((x) => found.push({ group: 'Jobs', emoji: '🎯', label: [x.company, x.role].filter(Boolean).join(' · '), sub: x.status || '', href: app('jobs') + '#open/' + x.id }));
      cvs.forEach((x) => found.push({ group: 'CVs', emoji: '📄', label: x.name || 'CV', href: app('cv') + '#open/' + x.id }));
      stories.forEach((x) => found.push({ group: 'Stories', emoji: '🎤', label: x.title || 'Story', href: app('stories') + '#open/' + x.id }));
      const [people] = await Promise.all(['contacts'].map((n) => BW.store.all(n).catch(() => [])));
      people.forEach((x) => found.push({ group: 'Contacts', emoji: '🤝', label: x.name || 'Someone', sub: [x.role, x.org].filter(Boolean).join(' · '), href: app('contacts') + '#open/' + x.id }));
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
  // ---------- what this copy may use ----------
  // One place answers "may this copy use a paid feature?". Today that depends on which files were
  // installed: the paid download includes Olaf. Later it may be a licence key, an app-store receipt
  // or an account: only this object changes (or a shell passes its own through window.BW_HOST).
  // edition(): 'full', 'demo' or null (not here).
  // 'locked': the paid files are here but licences are switched on and none is valid.
  BW.entitlements = Object.assign({
    async edition(feature) {
      // Olaf (Busy Business) and Ivy (Busy Growth): their paid files say they are here.
      const ed = feature === 'olaf' ? await BW.olafInstalled() : feature === 'ivy' ? (BW.ivyEdition || null) : null;
      if (ed !== 'full' || !BW.licence.required(feature)) return ed;
      return (await BW.licence.current(feature)) ? 'full' : 'locked';
    },
    async has(feature) { return (await this.edition(feature)) === 'full'; },
  }, host.entitlements);

  // ---------- licences ----------
  // A licence is one line of text, BWL1.<details>.<signature>, sent to a buyer as a key to paste
  // or a small file. The details are JSON: { v: 1, product, id, licensee, email, issued, kid }.
  // The seller signs it with a private key that never leaves them (the Olaf repository's
  // tools/licence.js); this copy checks it with the public key its paid build ships in
  // BW.licenceConfig[product] = { required, keys: { kid: public JWK }, revoked: [ids] }.
  // ECDSA P-256 with SHA-256: built into every current browser and Node, works offline and from
  // file://, no server. It stops casual sharing (a licence names the business it was sold to),
  // not a determined copier. Licences live in the business folder ('licences'), so every computer
  // that opens the business is licensed.
  async function verifyOne(t, product, config) {
    const m = /^(BWL1\.([A-Za-z0-9_-]+))\.([A-Za-z0-9_-]+)$/.exec(t);
    if (!m) return { ok: false, reason: 'format' };
    let lic;
    try { lic = JSON.parse(new TextDecoder().decode(b64u(m[2]))); } catch (e) { return { ok: false, reason: 'format' }; }
    if (!lic || lic.v !== 1 || !lic.id) return { ok: false, reason: 'format' };
    if (lic.product !== product) return { ok: false, reason: 'product' };
    const jwk = config && config.keys && config.keys[lic.kid];
    if (!jwk) return { ok: false, reason: 'key' };
    if ((config.revoked || []).includes(lic.id)) return { ok: false, reason: 'revoked' };
    if (lic.expires && lic.expires < BW.today()) return { ok: false, reason: 'expired' };
    if (!(window.crypto && crypto.subtle)) return { ok: false, reason: 'unsupported' };
    try {
      const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u(m[3]), new TextEncoder().encode(m[1]));
      return ok ? { ok: true, licence: lic, text: t } : { ok: false, reason: 'signature' };
    } catch (e) { return { ok: false, reason: 'signature' }; }
  }
  const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  BW.licenceConfig = BW.licenceConfig || {};
  BW.licence = {
    required: (product) => !!(BW.licenceConfig[product] && BW.licenceConfig[product].required),
    // { ok: true, licence } or { ok: false, reason } with reason one of: format, product, key,
    // revoked, expired, signature, unsupported.
    // Takes the key on its own, the whole licence file, or a key an email programme wrapped over lines.
    async verify(text, product, config = BW.licenceConfig[product]) {
      text = String(text || '');
      const found = text.match(/BWL1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      const tries = [found && found[0], text.replace(/\s+/g, '')].filter(Boolean);
      let first = null;
      for (const t of tries) {
        const r = await verifyOne(t, product, config);
        if (r.ok) return r;
        first = first || r;
      }
      return first || { ok: false, reason: 'format' };
    },
    // The first valid licence for a product in this business, or null.
    async current(product) {
      for (const r of await BW.store.all('licences')) {
        if (r.product !== product) continue;
        const v = await BW.licence.verify(r.key, product);
        if (v.ok) return v.licence;
      }
      return null;
    },
    // Checks a pasted key or the text of a licence file, and keeps it when it is valid.
    async add(text, product) {
      const v = await BW.licence.verify(text, product);
      if (v.ok) {
        const old = (await BW.store.all('licences')).find((r) => r.licenceId === v.licence.id);
        await BW.store.put('licences', Object.assign(old || {}, { product, licenceId: v.licence.id, key: v.text, licensee: v.licence.licensee || '' }));
      }
      return v;
    },
    // What to tell the owner when a key does not work.
    explain(reason) {
      return { format: 'That isn’t a whole licence key. Copy everything from BWL1 to the end, or choose the licence file.',
        product: 'That licence is for a different product.',
        key: 'This licence was made for a newer version of Busy. Download the latest version from your purchase email.',
        revoked: 'This licence has been withdrawn. Write to us if you think that is a mistake.',
        expired: 'This licence has ended.',
        signature: 'That licence key isn’t valid. Check that nothing was changed when it was copied.',
        unsupported: 'This browser can’t check licences. Open Busy in a current Chrome, Edge, Safari or Firefox.' }[reason] || 'That licence key isn’t valid.';
    },
  };
  BW.olafPage = () => BW.siteUrl + '/business/olaf.html';
  /* A gentle pointer to Olaf at a good moment (a paid invoice, a new client). At most once a week,
     never when Olaf is already installed, never inside documents. */
  BW.olafNudge = (msg) => {
    const key = 'bw.olafNudgeAt';
    let last = 0; try { last = Number(localStorage.getItem(key)) || 0; } catch (e) { /* private window */ }
    if (Date.now() - last < 7 * 864e5) return;
    BW.olafInstalled().then((ed) => {
      if (ed === 'full') return;
      try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* ignore */ }
      setTimeout(() => BW.toast(msg, '🧭', { label: 'Meet Olaf', run: () => BW.openUrl(ed === 'demo' ? BW.root + 'apps/olaf/index.html' : BW.olafPage()) }), 1800);
    });
  };
  BW.loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.body.append(s); });

  function topbar(app) {
    const theme = THEMES.find((t) => t[0] === (ls.get('bw.theme') || '')) || THEMES[0];
    const bar = BW.html(`<header class="topbar"><div class="wrap">
      <a class="brandmark" href="${BW.root}${suite().home}" title="All tools"><span class="blob">✦</span><span class="word">${BW.brand.name}</span></a>
      ${app ? `<div class="crumb"><span class="slash">/</span><span>${app.emoji}</span><span class="app-name">${app.name}</span></div>` : ''}
      <div class="spacer"></div>
      <button class="btn btn-ghost search-btn" data-palette hidden title="Search everything (⌘K)"><span>🔍</span><span class="lbl">Search</span><kbd class="lbl">⌘K</kbd></button>
      <button class="btn btn-primary new-btn" data-new hidden title="Make something new"><span>＋</span><span class="lbl">New</span></button>
      <button class="icon-btn" data-theme-btn title="Light, dark or automatic">${theme[1]}</button>
      <button class="btn btn-ghost store-chip" data-store hidden><span>📁</span><span class="lbl"></span></button>
      <button class="btn settings-btn" data-settings hidden title="${suite().details}"><span class="emo">⚙️</span><span class="lbl">${suite().details}</span></button>
    </div></header>`);
    document.body.prepend(bar);
    BW.$('[data-theme-btn]', bar).onclick = BW.cycleTheme;
    return bar;
  }

  // Every page calls this once: draws the top bar, connects storage, runs first-time setup, then hands over.
  BW.boot = async ({ app: appId, onReady, onChange } = {}) => {
    BW.root = document.body.dataset.root || '';
    const app = BW.apps.find((a) => a.id === appId);
    BW.suite = document.body.dataset.suite || (app && app.suite) || 'business';
    if (BW.suite === 'business') BW.olafInstalled(); // early, so tip cards know whether Olaf is here
    const bar = topbar(app);
    if (onChange) BW.onChange(onChange);
    try {
      await connect();
      const data = await BW.migrate();
      // Business kept in the browser (older versions offered it): say so plainly, with the way out.
      if (drv.kind === 'browser') {
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        const warn = BW.html(`<div class="readonly-bar" role="status">⚠️ Your business is saved only in this browser: clearing your browsing data would delete it. ${BW.canUseFolders ? '<button class="link" data-move>Move it to a folder</button>' : '<button class="link" data-backup>Download a backup</button>'}</div>`);
        bar.append(warn);
        const mv = BW.$('[data-move]', warn); if (mv) mv.onclick = moveToFolder;
        const bk = BW.$('[data-backup]', warn); if (bk) bk.onclick = backup;
      }
      if (data.status === 'newer') {
        readOnly = 'This business was last saved by a newer version of Busy, so this copy only shows it. Download the latest version of Busy to make changes.';
        bar.append(BW.html(`<div class="readonly-bar" role="status">🔒 ${readOnly}</div>`));
      }
      BW.settings = await BW.store.settings();
      if (!readOnly && (BW.suite === 'growth' ? !BW.settings.ownerName : !BW.settings.businessName)) await runWizard();
    } catch (e) { BW.error(e); return; }
    const chip = BW.$('[data-store]', bar);
    chip.hidden = false;
    // A shell's own storage (the website demo, a desktop app) shows its own label.
    const [icon, label] = drv.kind === 'folder' ? ['📁', drv.label] : drv.kind === 'browser' ? ['🧪', 'This browser'] : ['🎭', drv.label.replace(/^\w/, (c) => c.toUpperCase())];
    BW.$('span', chip).textContent = icon;
    BW.$('.lbl', chip).textContent = label;
    chip.onclick = () => (drv.kind === 'folder' || drv.kind === 'browser' ? storeMenu(chip) : BW.toast(`Saving to ${BW.esc(drv.label)}. Download Busy to keep your ${suite().noun} in your own folder.`, icon));
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
    if (host.installable === false) return;
    if (!('serviceWorker' in navigator) || !/^https:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    if (!BW.$('link[rel=manifest]')) document.head.append(BW.html(`<link rel="manifest" href="${BW.root}manifest.webmanifest">`));
    navigator.serviceWorker.register(BW.root + 'sw.js').catch(() => { /* still works online */ });
  }
})();
