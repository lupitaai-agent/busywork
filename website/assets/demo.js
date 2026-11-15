/* The website demo: every Busy tool, already filled in, so visitors see what they get before they download or
   buy. Busy Business opens on Busy itself (our own brand profile, year plan and projects; the money is made up),
   with a pretend design studio one click away; Busy Growth has a pretend career switcher and Busy Home a pretend
   household. Not part of any download: build.py adds this script to the website's copy of the tools only, before core.js.

   It uses the shell hook in core.js (window.BW_HOST): the business is kept in sessionStorage, so it
   lasts while the tab is open (moving between tools keeps it) and is gone when the tab closes.
   Nothing is saved to a folder, nothing is sent anywhere, and there is no AI. */
(function () {
  'use strict';
  // Each suite has its own pretend data, as each has its own folder.
  const SUITE = (document.body && document.body.dataset.suite) || 'business';
  const GROWTH = SUITE === 'growth', HOUSE = SUITE === 'house';
  // Busy Business has two examples. Busy itself is the main one; the design studio is the one the Workshop tour
  // tells its story about, so the tour's links ask for it (?example=studio). The choice lasts for the tab.
  const WHICH = (() => {
    if (GROWTH || HOUSE) return '';
    let asked = '', kept = '';
    try { asked = new URLSearchParams(location.search).get('example') || ''; } catch (e) { /* no address to read */ }
    try { kept = sessionStorage.getItem('bw.demo.which') || ''; } catch (e) { /* private window */ }
    const which = asked === 'studio' || asked === 'busy' ? asked : kept === 'studio' ? 'studio' : 'busy';
    try { sessionStorage.setItem('bw.demo.which', which); } catch (e) { /* private window: Busy every time */ }
    return which;
  })();
  const PREFIX = GROWTH ? 'bw.demo.growth.' : HOUSE ? 'bw.demo.house.' : WHICH === 'busy' ? 'bw.demo.busy.' : 'bw.demo.';
  const ss = {
    get(k) { try { return sessionStorage.getItem(PREFIX + k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(PREFIX + k, v); } catch (e) { /* private window: it simply resets */ } },
  };

  // The storage driver contract (core.js), on this tab's sessionStorage.
  function SessionDriver() {
    return {
      kind: 'demo',
      label: 'this demo',
      async readJSON(name, fallback) { const raw = ss.get('data.' + name); return raw ? JSON.parse(raw) : fallback; },
      async writeJSON(name, val) { ss.set('data.' + name, JSON.stringify(val)); },
      async list() {
        const out = [];
        try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k.startsWith(PREFIX + 'data.')) out.push(k.slice(PREFIX.length + 5)); } } catch (e) { /* none */ }
        return out;
      },
      async readFile() { return null; },
      async writeFile(path, blob, opts) {
        if (opts && opts.download === false) return { saved: false };
        window.BW.download(blob, path.split('/').pop());
        return { saved: false, where: 'your Downloads' };
      },
      async listFiles() { return []; },
      async removeFile() { /* nothing is kept */ },
    };
  }

  window.BW_HOST = {
    installable: false, // the demo is not an app to install
    expertDemo: true, // each suite's expert shows pretend prepared work ("Needs your yes"): no AI, nothing kept
    async driver() {
      const BW = window.BW, d = SessionDriver();
      if (!ss.get('seeded') && GROWTH) {
        BW.useDriver(d);
        await BW.loadScript(BW.root + 'shared/growth-examples.js');
        await d.writeJSON('settings', BW.growthExamples.settings);
        BW.settings = await BW.store.settings();
        await BW.growthExamples.load();
        ss.set('seeded', '1');
      }
      if (!ss.get('seeded') && HOUSE) {
        BW.useDriver(d);
        await BW.loadScript(BW.root + 'shared/house-examples.js');
        await d.writeJSON('settings', BW.houseExamples.settings);
        BW.settings = await BW.store.settings();
        await BW.houseExamples.load();
        ss.set('seeded', '1');
      }
      if (!ss.get('seeded') && WHICH === 'busy') {
        BW.useDriver(d);
        await BW.loadScript(BW.root + 'shared/busy-example.js');
        await d.writeJSON('settings', BW.busyExample.settings);
        BW.settings = await BW.store.settings();
        await BW.busyExample.load();
        ss.set('seeded', '1');
      }
      if (!ss.get('seeded')) {
        BW.useDriver(d);
        await d.writeJSON('settings', {
          businessName: 'Studio Noor', ownerName: 'Noor Visser', email: 'hello@studionoor.example', phone: '+31 30 123 4567', website: 'studionoor.example',
          address: 'Oudegracht 100', postcode: '3511 AX', city: 'Utrecht', country: 'Netherlands', vatNumber: 'NL000000000B01', regNumber: '00000000',
          iban: 'NL00 BANK 0000 0000 00', bic: 'BANKNL2A', currency: 'EUR', vatRates: '21, 9, 0', paymentDays: 14, quoteDays: 30, docLang: 'en', brandColor: '#FF6B4A',
        });
        BW.settings = await BW.store.settings();
        await BW.loadScript(BW.root + 'shared/examples.js');
        await BW.examples.load();
        ss.set('seeded', '1');
      }
      return d;
    },
  };

  // A bar under the top bar on every page: what this is, and the two ways to the real thing.
  document.addEventListener('DOMContentLoaded', () => {
    const site = (document.body.dataset.root || '') + '../';
    const bar = document.createElement('div');
    bar.setAttribute('role', 'note');
    bar.className = 'demo-bar';
    bar.style.cssText = 'display:flex;gap:10px 16px;flex-wrap:wrap;align-items:center;justify-content:center;padding:7px 16px;font-weight:700;font-size:.88rem;'
      + 'background:color-mix(in srgb, var(--grape) 30%, var(--surface));color:var(--ink);border-top:2px solid var(--border)';
    bar.innerHTML = HOUSE
      ? '<span>🎭 A demo: a pretend household. Nothing is kept.</span>'
        + `<a class="btn btn-primary" style="padding:6px 14px" href="${site}home/index.html#get">⬇️ Download free</a>`
      : GROWTH
      ? '<span>🎭 A demo: a pretend career switcher. Nothing is kept.</span>'
        + `<a class="btn btn-primary" style="padding:6px 14px" href="${site}growth/index.html#get">⬇️ Download free</a>`
      : (WHICH === 'busy'
        ? '<span>🎭 A demo: Busy itself, with made-up numbers. Nothing is kept.</span>'
          + '<button type="button" class="link" data-example="studio">See a design studio</button>'
        : '<span>🎭 A demo: a pretend design studio. Nothing is kept.</span>'
          + '<button type="button" class="link" data-example="busy">See Busy itself</button>')
        + `<a class="btn" style="padding:6px 14px" href="${site}business/download.html">⬇️ Download free</a>`
        + `<a class="btn btn-primary" style="padding:6px 14px" href="${site}business/olaf.html#get">🧭 Get Olaf</a>`;
    // Above the page, beside the rail (core.js makes the place for notices when it draws the frame).
    const place = () => document.querySelector('[data-notices]');
    const put = () => { const n = place(); if (n) n.append(bar); else document.body.prepend(bar); };
    if (place()) put(); else setTimeout(put, 0);
    // The other example: remember the choice and open this same tool again, from its first screen.
    const other = bar.querySelector('[data-example]');
    if (other && other.dataset) other.onclick = () => {
      try { sessionStorage.setItem('bw.demo.which', other.dataset.example); } catch (e) { /* private window */ }
      location.href = location.pathname;
    };
  });
})();
