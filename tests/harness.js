/* Loads Busywork's browser scripts into a fresh sandbox with just enough of a browser around them,
   so the logic can be tested with Node alone (node --test), no packages and no real browser.
   The page itself (drawing, clicking) is checked in a real browser; these tests cover what is
   underneath: money, dates, storage, versions, AI requests, marketing numbers, exports. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = path.join(__dirname, '..', 'app');

// An element that accepts whatever the scripts do to it and remembers little.
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.dataset = {}; this.style = {}; this.children = []; this.attributes = {}; this.innerHTML = ''; this.textContent = ''; this.value = ''; }
  get classList() { return { add() {}, remove() {}, toggle() {}, contains: () => false }; }
  get content() { return { firstElementChild: new El('div') }; }
  get firstElementChild() { return this.children[0] || null; }
  append(...c) { this.children.push(...c); } prepend(...c) { this.children.unshift(...c); }
  remove() {} after() {} before() {} click() { if (this.onclick) this.onclick(); } select() {}
  setAttribute(k, v) { this.attributes[k] = String(v); } getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener() {} removeEventListener() {}
  // Any lookup finds a fresh element, so start-up code that wires up its buttons runs through.
  querySelector() { return new El('div'); } querySelectorAll() { return []; }
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
}

function storage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, clear: () => m.clear(),
  };
}

/* load(['shared/core.js', ...], { host, fetch, page }) -> the sandbox's window, with BW on it.
   host is window.BW_HOST: the same hook a desktop or phone shell would use. */
function load(files, opts = {}) {
  opts.before = opts.before || (() => {});
  const document = new El('#document');
  document.documentElement = new El('html'); document.body = new El('body'); document.head = new El('head');
  document.createElement = (t) => new El(t);
  document.execCommand = () => false;
  const win = {
    document, localStorage: storage(), sessionStorage: storage(),
    location: { protocol: 'file:', hostname: '', pathname: opts.page || '/Users/someone/Busywork/apps/invoices/index.html', hash: '', search: '', href: 'file:///index.html', reload() {} },
    navigator: { userAgent: 'node-test', language: 'en-GB', platform: 'Test', clipboard: { writeText: async () => {} } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
    innerWidth: 1280, innerHeight: 800, scrollY: 0,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, console,
    Blob, URL, TextEncoder, TextDecoder, ReadableStream, Response, Headers, AbortController, crypto, structuredClone,
    fetch: opts.fetch || (async () => { throw new Error('No network in tests'); }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: (f) => setTimeout(f, 0),
    BW_HOST: opts.host,
  };
  win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  opts.before(win);
  // Paths are inside app/, or absolute (the Olaf repository tests load its files this way).
  for (const f of files) vm.runInContext(fs.readFileSync(path.isAbsolute(f) ? f : path.join(APP, f), 'utf8'), ctx, { filename: f });
  return win;
}

// A Busywork with memory storage and the default settings, ready for tests.
async function busywork(files = [], opts = {}) {
  const win = load(['shared/core.js', ...files], opts);
  const { BW } = win;
  BW.useDriver(BW.drivers.memory(opts.seed));
  BW.settings = await BW.store.settings();
  return win;
}

// Values made inside the sandbox have the sandbox's own Array and Object, so compare them as plain data.
const plain = (v) => JSON.parse(JSON.stringify(v));

module.exports = { load, busywork, plain, APP };
