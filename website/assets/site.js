/* Website motion and ads. Plain script, no libraries. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Light or dark as chosen in the tools (kept in this browser): the website follows it, as its pages did while they
  // still loaded the tools' own script (app/shared/core.js) for the confetti.
  try { const look = localStorage.getItem('bw.theme'); if (look) document.documentElement.dataset.theme = look; } catch (e) { /* private window */ }
  // ---------- the Olaf waitlist ----------
  // Posts to the form service set at build time (form action). Without one, it says so plainly.
  $$('form[data-waitlist]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = $('.wl-msg', f), btn = $('button[type=submit]', f);
    if (!f.getAttribute('action')) { msg.textContent = 'The list is not connected yet. Please try again soon.'; msg.className = 'wl-msg err'; return; }
    btn.disabled = true; msg.textContent = 'Sending…'; msg.className = 'wl-msg';
    try {
      const data = new FormData(f);
      data.delete('consent'); // the tick is required to send; the service needs only the details
      const res = await fetch(f.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      const json = await res.json().catch(() => ({}));
      // Only a problem with the address is the visitor's to fix; anything else is ours.
      const badEmail = json.errors && (json.errors.email || (json.errors.fields && json.errors.fields.email));
      if (badEmail) { msg.textContent = 'That email address does not look right. Check it and try again.'; msg.className = 'wl-msg err'; btn.disabled = false; return; }
      if (!res.ok || json.success === false) throw new Error(json.message || String(res.status));
      f.reset();
      // Right whether or not the list asks people to confirm by email first (double opt-in).
      msg.textContent = "You're on the list. We'll email you when Olaf can be bought. If an email asks you to confirm your address, click the link in it.";
      msg.className = 'wl-msg ok';
    } catch (e) { msg.textContent = 'Something went wrong on our side, not yours. Please try again in a little while.'; msg.className = 'wl-msg err'; }
    btn.disabled = false;
  }));

  // The detailed free-vs-Olaf comparison starts folded on phones (it is a wide table).
  if (innerWidth <= 700) $$('details.cmp-details[open]').forEach((d) => d.removeAttribute('open'));

  // ---------- Google AdSense: the website only, never inside the tools ----------
  // Fill in after AdSense approves the domain. Until then the slots are removed (or show a
  // placeholder when you preview locally). For visitors in the EU/UK, switch on AdSense's own
  // consent message (AdSense → Privacy & messaging); the AdSense script then shows it by itself.
  const ADSENSE = {
    client: '', // 'ca-pub-0000000000000000'
    slots: { 'home-1': '', 'home-2': '', download: '', tool: '' }, // ad unit ids from AdSense → Ads → By ad unit
  };
  function ads() {
    const slots = $$('[data-ad]');
    if (!slots.length) return; // no ad on this page: load nothing from the ad network
    const preview = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (!ADSENSE.client) {
      slots.forEach((s) => { if (preview) s.innerHTML = '<div class="lbl">Advertisement</div><div class="placeholder">Ad space · Google AdSense shows here once the site is approved</div>'; else s.remove(); });
      return;
    }
    const sc = document.createElement('script');
    sc.async = true; sc.crossOrigin = 'anonymous';
    sc.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADSENSE.client);
    document.head.append(sc);
    slots.forEach((s) => {
      const unit = ADSENSE.slots[s.dataset.ad];
      if (!unit) { s.remove(); return; }
      s.innerHTML = `<div class="lbl">Advertisement</div><ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE.client}" data-ad-slot="${unit}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  }
  ads();

  // ---------- nav and progress bar ----------
  const nav = $('.nav'), bar = $('.progress');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    if (nav) nav.classList.toggle('solid', scrollY > 20);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- hero: the word that keeps changing ----------
  const swap = $('[data-swap]');
  if (swap) {
    const words = JSON.parse(swap.dataset.swap), colors = ['var(--tomato)', 'var(--sun)', 'var(--mint)', 'var(--sky)', 'var(--pink)', 'var(--grape)', 'var(--teal)'];
    let n = 0;
    // With Reduce motion on, the word still changes, with a soft fade instead of the flip (site.css).
    const cls = calm ? 'fade' : 'flip';
    // Looked up every time: on the homepage the word lives in Busy Street's card, which the street redraws.
    const show = () => {
      const el = $('[data-swap]');
      if (!el) return;
      const span = $('span', el);
      span.textContent = words[n % words.length]; span.style.background = colors[n % colors.length];
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      n++;
    };
    show();
    setInterval(show, calm ? 3000 : 2200);
  }

  // ---------- floating stickers follow the mouse and the scroll ----------
  const stickers = $$('.hero .sticker');
  let mx = 0, my = 0;
  addEventListener('mousemove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  if (!calm && stickers.length) (function loop() {
    stickers.forEach((s) => {
      const d = Number(s.dataset.depth || 1);
      s.style.transform = `translate(${mx * 40 * d}px, ${my * 40 * d - scrollY * .25 * d}px) rotate(${(s.dataset.rot || 0)}deg)`;
    });
    requestAnimationFrame(loop);
  })();

  // ---------- reveal on scroll ----------
  // A video that only loads and plays while it is on screen, and never for people who asked for less motion
  const seen = document.querySelectorAll('video[data-seen-src]');
  if (seen.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const vio = new IntersectionObserver((es) => es.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting) { if (!v.src) v.src = v.dataset.seenSrc; v.play().catch(() => {}); } else if (v.src) v.pause();
    }), { threshold: 0.25 });
    seen.forEach((v) => vio.observe(v));
  } else seen.forEach((v) => { v.controls = true; v.preload = 'metadata'; v.src = v.dataset.seenSrc; });

  // A film's poster is fetched when the film comes near the screen, not with the page, and as WebP where there is one
  // and the browser takes it. build.py (webp_pictures) moved the poster to a <noscript> copy in front of the film, for
  // browsers without scripts: its address is read from there. data-lazy-poster="webp": a WebP stands next to it.
  const films = $$('video[data-lazy-poster]');
  if (films.length) {
    const takesWebp = new Promise((ok) => {
      const i = new Image(); i.onload = () => ok(i.width === 1); i.onerror = () => ok(false);
      i.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
    });
    const poster = (v) => {
      const copy = v.previousElementSibling, m = copy && copy.tagName === 'NOSCRIPT' && / poster="([^"]+)"/.exec(copy.textContent);
      if (!m || v.poster) return;
      const url = m[1].replace(/&amp;/g, '&');
      if (v.dataset.lazyPoster !== 'webp') v.poster = url;
      else takesWebp.then((yes) => { v.poster = yes ? url.replace(/\.(jpe?g|png)$/, '.webp') : url; });
    };
    if ('IntersectionObserver' in window) {
      const near = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { poster(en.target); near.unobserve(en.target); } }), { rootMargin: '400px 0px' });
      films.forEach((v) => near.observe(v));
    } else films.forEach(poster);
  }

  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); } }), { threshold: .15 });
  $$('.reveal').forEach((el) => io.observe(el));

  // ---------- showcase: the picture on the left follows the text on the right ----------
  const showcase = $('.showcase');
  if (showcase) {
    const panels = $$('.panel', showcase), title = $('[data-mock-title]', showcase);
    const activate = (p) => {
      panels.forEach((x) => x.classList.toggle('on', x === p));
      $$('.scene', showcase).forEach((s) => s.classList.toggle('on', s.dataset.scene === p.dataset.scene));
      showcase.style.setProperty('--active', getComputedStyle(p).getPropertyValue('--c').trim() || 'var(--sun)');
      if (title) title.textContent = p.dataset.title;
    };
    const pio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) activate(e.target); }), { rootMargin: '-45% 0px -45% 0px' });
    panels.forEach((p) => pio.observe(p));
    activate(panels[0]);
  }

  // live bits inside the scenes
  const ring = $('[data-ring]'), clock = $('[data-clock]'), km = $('[data-km]');
  let sec = 5047, kms = 0;
  if (!calm) setInterval(() => {
    sec++;
    if (clock) clock.textContent = `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    if (ring) ring.style.setProperty('--p', ((sec % 60) / 60 * 100) + '%');
    if (km) { kms = (kms + 3) % 400; km.textContent = (1240 + kms) + ' km'; }
  }, 1000);

  // ---------- "what would you pay elsewhere" calculator ----------
  const calc = $('.calc');
  if (calc) {
    const out = $('[data-save]', calc), month = $('[data-month]', calc);
    let shown = 0;
    const update = () => {
      const m = $$('input:checked', calc).reduce((a, i) => a + Number(i.dataset.price), 0), target = m * 12, from = shown, t0 = performance.now();
      month.textContent = '€' + m;
      (function step(t) {
        const k = calm ? 1 : Math.min(1, (t - t0) / 500);
        shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
        out.textContent = '€' + shown.toLocaleString('en');
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    };
    calc.addEventListener('change', update); update();
  }

  // ---------- moving pictures stand still for people who turned motion off ----------
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) $$('video[autoplay]').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });

  // ---------- a language picked in the footer is remembered, so the browser's language no longer redirects ----------
  $$('.langs a[data-lang]').forEach((a) => a.addEventListener('click', () => {
    try { localStorage.setItem('busy.lang', a.dataset.lang); } catch (e) { /* private window: the link still works */ }
  }));

  // ---------- a little party on download ----------
  // The website's own confetti, the same as the apps' (BW.confetti in app/shared/core.js): the website's pages don't
  // load that file, which is the whole app toolkit, for this alone. Not for people who asked for less motion.
  function confetti(x, y) {
    if (calm) return;
    const cv = document.createElement('canvas'), dpr = window.devicePixelRatio || 1;
    cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:300';
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    document.body.append(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const colors = ['#FF6B4A', '#FFC93C', '#2FD18C', '#4DA3FF', '#9B6BFF', '#FF7AC6', '#22C3C3'];
    const ox = x || innerWidth / 2, oy = y || innerHeight / 3;  // a click from the keyboard has no place: the middle then
    const bits = Array.from({ length: 140 }, () => ({
      x: ox, y: oy, vx: (Math.random() - .5) * 16, vy: Math.random() * -14 - 4, r: Math.random() * 6 + 4,
      c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * Math.PI, va: (Math.random() - .5) * .4, s: Math.random() < .5,
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.vy += .45; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.a += b.va;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c;
        if (b.s) ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); else { ctx.beginPath(); ctx.arc(0, 0, b.r / 2.4, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      if (t - t0 < 2600) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }
  $$('[data-download]').forEach((a) => a.addEventListener('click', (e) => confetti(e.clientX, e.clientY)));
})();

/* ---------- 2026-11-20: the menu on narrow screens, and what happens after a download click ---------- */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  // The menu is a <details>, so it opens and closes without this script. With it: a tap outside, a link in it,
  // Escape (focus goes back to the button) or tabbing out of it closes it.
  const menu = $('.nav .menu');
  if (menu) {
    const shut = (focus) => { if (!menu.open) return; menu.open = false; if (focus) $('summary', menu).focus(); };
    document.addEventListener('click', (e) => { if (!menu.contains(e.target) || e.target.closest('a')) shut(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(true); });
    menu.addEventListener('focusout', (e) => { if (e.relatedTarget && !menu.contains(e.relatedTarget)) shut(false); });
  }

  // Which computer this is: its download button keeps the colour (site.css reads data-os). A phone or tablet is neither.
  const ua = navigator.userAgent || '', plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const phone = /Android|iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(plat) && navigator.maxTouchPoints > 1);
  const os = phone ? '' : /Mac/i.test(plat) ? 'mac' : /Win/i.test(plat) ? 'windows' : '';
  if (os) document.documentElement.dataset.os = os;

  // After a click on an installer the download starts as it always did, and a panel says what happens next: the
  // steps to open the file, and the suite's expert. The panel's words wait in a <template> in the footer (build.py
  // download_panel), in the page's own language. On a phone, where an installer is of no use, the panel offers the
  // demo in the browser and the link to copy instead, and no file is fetched.
  const INSTALLER = /\/releases\/latest\/download\/(Busy-([A-Za-z-]+?)-Beta-(Mac|Windows)\.(?:dmg|exe))$/;
  const tpl = $('#dl-panel');
  let panel = null, opener = null;
  const close = (back) => {
    if (!panel) return;
    panel.remove(); panel = null;
    if (back && opener && document.contains(opener)) opener.focus();
  };
  function open(a, m) {
    close(false);
    const suite = (a.dataset.suite || m[2]).toLowerCase(), system = (a.dataset.os || m[3]).toLowerCase();
    opener = a;
    panel = tpl.content.firstElementChild.cloneNode(true);
    const keep = (attr, value) => $$('[' + attr + ']', panel).forEach((el) => { if (el.getAttribute(attr) !== value) el.remove(); });
    const demo = $('[data-dl-demos] a[data-suite="' + suite + '"]', panel);
    keep('data-dl-when', phone ? 'phone' : 'computer');
    keep('data-dl-os', system);
    keep('data-dl-expert', suite);
    keep('data-dl-for', suite === 'games' || suite === 'tucks-errand' ? 'game' : 'app');  // the demo of an app, or the games themselves
    const file = $('[data-dl-file]', panel), again = $('[data-dl-again]', panel), try_ = $('[data-dl-demo]', panel), copy = $('[data-dl-copy]', panel);
    if (file) file.textContent = m[1] + (a.dataset.size ? ' · ' + a.dataset.size : '');
    if (again) again.href = a.href;
    if (try_) { if (demo) try_.href = demo.href; else try_.remove(); }
    if (copy) copy.addEventListener('click', async () => {
      const link = location.href.split('#')[0];
      try { await navigator.clipboard.writeText(link); } catch (err) {
        // no clipboard here (an old browser, or a page not served over https): the old way, through a text box
        const box = document.createElement('textarea');
        box.value = link; box.setAttribute('readonly', ''); box.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(box); box.select();
        try { document.execCommand('copy'); } catch (e2) { /* nothing more to try */ }
        box.remove();
      }
      const said = $('[data-dl-copied]', panel);
      if (said) said.hidden = false;
    });
    const title = $('h2', panel);
    if (title) { title.id = 'dl-title'; panel.setAttribute('aria-labelledby', 'dl-title'); }
    $('[data-dl-close]', panel).addEventListener('click', () => close(true));
    document.body.append(panel);
    panel.focus({ preventScroll: true });
  }
  if (tpl && tpl.content) {
    // Listening on the page, not on each link: the tours draw their download buttons after the page has loaded.
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href*="/releases/latest/download/"]');
      const m = a && INSTALLER.exec(a.getAttribute('href'));
      if (!m || a.hasAttribute('data-dl-again') || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (phone) e.preventDefault();
      open(a, m);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(true); });
  }
})();
