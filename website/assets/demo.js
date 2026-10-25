/* The website demo: every Busywork tool, already filled with a pretend design studio, so visitors
   see what they get before they download or buy. Not part of any download: build.py adds this
   script to the website's copy of the tools only, before core.js.

   It uses the shell hook in core.js (window.BW_HOST): the business is kept in sessionStorage, so it
   lasts while the tab is open (moving between tools keeps it) and is gone when the tab closes.
   Nothing is saved to a folder, nothing is sent anywhere, and there is no AI. */
(function () {
  'use strict';
  const PREFIX = 'bw.demo.';
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
    async driver() {
      const BW = window.BW, d = SessionDriver();
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
    bar.style.cssText = 'display:flex;gap:10px 16px;flex-wrap:wrap;align-items:center;justify-content:center;padding:9px 16px;font-weight:700;font-size:.92rem;'
      + 'background:color-mix(in srgb, var(--grape) 30%, var(--surface));color:var(--ink);border-top:2px solid var(--border)';
    bar.innerHTML = '<span>🎭 A demo with a pretend design studio. Nothing you change is kept.</span>'
      + `<a class="btn" style="padding:6px 14px" href="${site}download.html">⬇️ Download free</a>`
      + `<a class="btn btn-primary" style="padding:6px 14px" href="${site}olaf.html#get">🧭 Get Olaf</a>`;
    const top = document.querySelector('.topbar');
    if (top) top.append(bar); else document.body.prepend(bar);
  });
})();
