/* Website motion and ads. Plain script, no libraries. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    const show = () => {
      const span = $('span', swap);
      span.textContent = words[n % words.length]; span.style.background = colors[n % colors.length];
      swap.classList.remove(cls); void swap.offsetWidth; swap.classList.add(cls);
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

  // ---------- a little party on download ----------
  $$('[data-download]').forEach((a) => a.addEventListener('click', (e) => {
    if (window.BW && BW.confetti) BW.confetti({ x: e.clientX, y: e.clientY });
  }));
})();
