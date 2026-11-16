/* The Brand Strategy part of Busy Business: how strong the brand is, what the research found and what to do next.
   Tabs: Overview, Brand health, Buyers & moments, Recognisable, Positioning, Reports.
   The numbers come from the owner's own brand profile; with Olaf, each brand skill's newest report adds its finding.
   A report starts with a short block the page reads (skills/<id>/SKILL.md, "For the Brand Strategy page"):
     ---\n skill: brand-health\n date: 2026-11-15\n headline: …\n score: 14%\n next: …\n ---
   A business that has not written its brand down yet starts here with three questions. */
(function () {
  'use strict';
  const { $, $$, esc, ui } = BW;
  const main = $('#main'), M = BW.mkt;

  BW.boot({ part: 'brand', onReady: start, onChange: render });

  const EDIT = 'apps/marketing/index.html?part=brand#tab/profile';
  const short = (text, n) => (text.length > n ? text.slice(0, n).replace(/\s+\S*$/, '') + '…' : text);
  const TABS = [['overview', 'Overview'], ['health', 'Brand health'], ['buyers', 'Buyers & moments'], ['recognisable', 'Recognisable'], ['positioning', 'Positioning'], ['reports', 'Reports']];
  /* Olaf's brand skills: id, emoji, name, after how many days a report is worth redoing, the tab it belongs to.
     Files that came before the block are known by their names. */
  const SKILLS = [
    ['brand-health', '📊', 'Brand health', 90, 'health'], ['local-presence', '📍', 'Easy to find', 90, 'health'],
    ['category-entry-points', '🔑', 'Buying moments', 180, 'buyers'], ['customer-research', '🗣️', 'Customer research', 180, 'buyers'],
    ['distinctive-assets', '🎨', 'Brand assets', 180, 'recognisable'], ['brand-positioning', '🧭', 'Positioning', 365, 'positioning'],
    ['brand-session', '🪧', 'Brand on one page', 365, 'positioning'], ['pr-local-press', '📰', 'Press and partners', 180, 'positioning'],
  ].map(([id, emoji, name, redo, tab]) => ({ id, emoji, name, redo, tab }));
  const NAMED = { 'output/brand-on-a-page.md': 'brand-session', 'output/positioning.md': 'brand-positioning' };
  // Reports written before the block, known by words in their names.
  const WORDS = [[/brand-assets|distinctive/, 'distinctive-assets'], [/brand-health|comes-to-mind|mental-availability/, 'brand-health'], [/buying-moments|entry-points/, 'category-entry-points'],
    [/local-presence|findab|easy-to-find/, 'local-presence'], [/customer-research|interviews|survey/, 'customer-research'], [/press|pr-plan/, 'pr-local-press']];
  let tab = 'overview', olaf = false;

  async function start() {
    try { olaf = ['full', 'locked'].includes(await BW.entitlements.edition('olaf')); } catch (e) { olaf = false; }
    BW.route({ tab: (t) => { if (TABS.some(([id]) => id === t)) tab = t; render(); } });
    render();
  }

  // ---------- reading the reports ----------
  function parse(f) {
    const text = String(f.content || '');
    const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
    const fm = {};
    if (m) m[1].split('\n').forEach((l) => { const kv = l.match(/^([a-z-]+):\s*(.*)$/i); if (kv) fm[kv[1].toLowerCase()] = kv[2].trim(); });
    const body = m ? text.slice(m[0].length) : text;
    const name = f.path.replace(/^output\//, '').replace(/\.md$/i, '');
    const skill = fm.skill || NAMED[f.path] || (SKILLS.find((s) => name.startsWith(s.id + '-')) || {}).id || (WORDS.find(([re]) => re.test(name)) || [])[1] || '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(fm.date || '') ? fm.date : (name.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || String(f.updatedAt || f.createdAt || '').slice(0, 10);
    const title = ((body.match(/^#\s+(.+)$/m) || [])[1] || name.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-/g, ' ')).trim();
    const first = body.replace(/^#.*$/gm, '').split(/\n\s*\n/).map((x) => x.replace(/[*_>#`-]/g, '').trim()).find((x) => x.length > 20) || '';
    return { path: f.path, skill, date, title, headline: fm.headline || '', summary: fm.headline || short(first, 160), score: fm.score || '', next: fm.next || '', body };
  }
  const reportsOf = (files) => files.filter((f) => /^output\/[^/]+\.md$/i.test(f.path || '') && !/README\.md$/i.test(f.path) && f.content && !f.example).map(parse).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const ago = (d) => (d ? Math.round((new Date(BW.today()) - new Date(d)) / 864e5) : null);
  const when = (d) => (d ? BW.fmtDate(d, { day: 'numeric', month: 'short' }) : '');
  const state = (sk, r) => (!r ? 'none' : ago(r.date) >= sk.redo ? 'aging' : 'done');

  function open(r) {
    if (!document.querySelector('link[href$="shared/ai.css"]')) document.head.append(BW.html(`<link rel="stylesheet" href="${BW.root}shared/ai.css">`));
    BW.modal({ title: `📄 ${esc(r.title)}`, body: BW.html(`<div><p class="faint">${esc(when(r.date))}</p><div class="md">${BW.md(r.body)}</div></div>`), wide: true,
      actions: [{ label: 'Close', kind: 'ghost' }, { label: BW.t('Copy the text'), onClick: async () => { await BW.copy(r.body); BW.toast('Copied.', '📋'); return false; } }] });
  }
  function ask(sk) {
    if (BW.expertLink && BW.expertLink.viaClaude()) return BW.expertLink.askSkill(sk.id);
    location.href = `${BW.root}apps/olaf/index.html#skill/${sk.id}`;
  }

  // ---------- pieces ----------
  // The line under a tile: where the number comes from, how fresh it is, and the next click.
  const meta = (sk, r) => {
    if (!olaf) return '';
    const st = state(sk, r);
    return `<p class="bs-meta"><span>${esc(BW.t(sk.name))} · ${r ? `<b class="${st === 'aging' ? 'old' : 'fresh'}">${esc(when(r.date))}</b>` : `<b class="never">${BW.t('not done yet')}</b>`}</span>
      ${r ? `<button type="button" class="link" data-open="${esc(r.path)}">${BW.t('Read the report')} →</button>` : `<button type="button" class="link" data-ask="${sk.id}">${BW.t('Do this with Olaf')} →</button>`}</p>`;
  };
  const reportCard = (sk, r) => `<section class="card bs-report">${ui.k(`${sk.emoji} ${esc(BW.t(sk.name))}`)}
    ${r ? `${r.score ? `<div class="bs-big">${esc(r.score)}</div>` : ''}<h3>${esc(r.headline || r.title)}</h3>${r.next ? `<p class="s"><b>${BW.t('Next:')}</b> ${esc(r.next)}</p>` : ''}
      <p class="bs-meta"><span class="${state(sk, r) === 'aging' ? 'old' : 'fresh'}">${esc(when(r.date))}${state(sk, r) === 'aging' ? ' · ' + BW.t('time to redo') : ''}</span>
        <span><button type="button" class="link" data-open="${esc(r.path)}">${BW.t('Read the report')}</button>${olaf ? ` · <button type="button" class="link" data-ask="${sk.id}">${BW.t('Redo with Olaf')}</button>` : ''}</span></p>`
    : `<p class="s">${BW.t('Not done yet.')}</p>${olaf ? `<button type="button" class="btn btn-expert" data-ask="${sk.id}">${BW.t('Ask Olaf')}</button>` : ''}`}</section>`;

  async function render() {
    const [profiles, plan, waves, files] = await Promise.all(['mktprofile', 'mktplan', 'mktwaves', 'olaf-files'].map((n) => BW.store.all(n)));
    const p = profiles[0];
    if (!p || (!p.category && !p.ceps.length)) return starter(p);
    const s = BW.settings, today = BW.today();
    const reports = reportsOf(files), latest = {};
    for (const r of reports) if (r.skill && !latest[r.skill]) latest[r.skill] = r;
    const S = Object.fromEntries(SKILLS.map((k) => [k.id, k]));
    const starred = p.ceps.filter((c) => c.priority);
    const always = p.assets.filter((a) => a.commit), test = p.assets.length - always.length;
    const keptLine = BW.t(`${always.length} kept`);
    const find = [[!!s.website, 'A website'], [!!(s.email || s.phone), 'An email address or phone number'], [!!(p.proof || '').trim(), 'Real proof: reviews, years, clients'],
      [!(p.barriers || []).includes('Prices are unclear'), 'Clear prices'], [!(p.barriers || []).includes('Few reviews'), 'Reviews']];
    const found = find.filter((f) => f[0]).length, missing = find.find((f) => !f[0]);
    const sorted = waves.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const pct = (w) => { const row = w && (w.rows || []).find((r) => r.brand === s.businessName); return row && w.n ? Math.round(row.any / w.n * 100) : null; };
    const mind = pct(sorted[sorted.length - 1]), trend = sorted.map(pct).filter((v) => v != null).slice(-6);
    const month0 = today.slice(0, 7) + '-01', year = Array.from({ length: 12 }, (_, i) => BW.addPeriod(month0, 'month', i).slice(0, 7));
    const inMonth = (m) => plan.filter((a) => (a.month || '').slice(0, 7) === m);
    const planned = year.filter((m) => inMonth(m).length).length;
    const first = (p.buyers || '').split(/(?<=[.!?])\s/)[0];
    const who = first && first.length <= 80 ? [first, (p.buyers || '').slice(first.length).trim()] : [BW.t('Everyone who buys what you sell'), p.buyers || ''];
    const bh = latest['brand-health'], lp = latest['local-presence'], da = latest['distinctive-assets'], cep = latest['category-entry-points'];
    const n = reports.length;

    const band = `<section class="band" style="--brand:${esc(s.brandColor || '#FFC93C')}">${s.logo ? `<img class="logo" src="${s.logo}" alt="">` : `<span class="logo blank">${esc((s.businessName || '?').slice(0, 1))}</span>`}
        <div><h1>${esc(s.businessName || 'Your business')}</h1><p>${esc(short(p.category || p.offer || '', 120))}</p></div>
        <span class="spacer"></span>${(p.tone || []).map((t) => `<span class="chip">${esc(BW.t(t))}</span>`).join('')}
        <span class="band-tools"><a class="btn" href="${EDIT}">✏️ ${BW.t('Change')}</a><button type="button" class="btn" data-print>🖨️ ${BW.t('Print this page')}</button></span></section>`;
    const tabs = `<nav class="bs-tabs" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${tab === id}">${BW.t(label)}${id === 'reports' && n ? ` · ${n}` : ''}</button>`).join('')}</nav>`;

    const tiles = `<section class="card bs-tile">${ui.k(BW.t('Comes to mind'))}
        <div class="bs-big">${bh && bh.score ? esc(bh.score) : mind != null ? mind + '%' : '?'}</div>
        <p class="s">${bh && bh.headline ? esc(bh.headline) : mind != null ? BW.t('think of you when they need what you sell') : BW.t('Not measured yet. A short survey among people who buy what you sell tells you.')}</p>
        ${trend.length > 1 ? `<div class="bs-spark">${trend.map((v) => `<i style="height:${Math.max(8, v)}%" title="${v}%"></i>`).join('')}</div>` : ui.gauge(mind != null ? mind : bh && /%$/.test(bh.score) ? parseFloat(bh.score) || 0 : 0, 'grape')}
        ${meta(S['brand-health'], bh)}</section>
      <section class="card bs-tile">${ui.k(BW.t('Easy to find and buy'))}
        <div class="bs-big">${lp && lp.score ? esc(lp.score) : `${found} ${BW.t('of')} 5`}</div>
        <p class="s">${lp && lp.headline ? esc(lp.headline) : missing ? `${BW.t('Still missing:')} ${esc(BW.t(missing[1]))}` : BW.t('Nothing missing on this list.')}</p>
        ${ui.gauge(found / 5 * 100)}${meta(S['local-presence'], lp)}</section>
      <section class="card bs-tile">${ui.k(BW.t('Recognisable'))}
        <div class="bs-big">${keptLine}${test > 0 ? ` · ${test} ${BW.t('to test')}` : ''}</div>
        <p class="s">${da && da.headline ? esc(da.headline) : esc(always.slice(0, 3).map((a) => a.name).join(' · ') || BW.t('Nothing chosen yet.'))}</p>
        ${ui.gauge(Math.min(always.length, 4) / 4 * 100, 'sun')}${meta(S['distinctive-assets'], da)}</section>`;

    const latestBox = `<section class="card bs-latest">${ui.k(BW.t('Latest reports'))}${reports.slice(0, 4).map((r) => `<button type="button" class="bs-rep" data-open="${esc(r.path)}"><span class="e">${(S[r.skill] || {}).emoji || '📄'}</span><span><b>${esc(r.title)}</b><small>${esc(when(r.date))}${r.score ? ' · ' + esc(r.score) : ''}</small></span><span class="go">${BW.t('Open')}</span></button>`).join('')
      || `<p class="s">${olaf ? BW.t('Olaf’s reports show here, the newest first.') : BW.t('Reports from your brand research show here.')}</p>`}</section>`;

    const work = olaf ? `<section class="card bs-work">${ui.k(BW.t('Olaf’s brand work: what is up to date'))}<div class="bs-skills">${SKILLS.map((sk) => {
      const r = latest[sk.id], st = state(sk, r);
      return `<div class="bs-sk ${st}"><b>${sk.emoji} ${esc(BW.t(sk.name))}</b>${r ? `<small class="${st === 'aging' ? 'old' : 'fresh'}">${esc(when(r.date))}</small>` : `<small class="never">${BW.t('Not done yet.')}</small>`}
        ${st === 'done' ? `<button type="button" class="link" data-open="${esc(r.path)}">${BW.t('Read the report')}</button>` : `<button type="button" class="btn btn-expert" data-ask="${sk.id}">${st === 'aging' ? BW.t('Redo with Olaf') : BW.t('Ask Olaf')}</button>`}</div>`;
    }).join('')}</div></section>` : '';

    const moments = `<section class="card bs-moments">${ui.k(BW.t('The moments to own'))}<div class="chips">${starred.map((c) => `<span class="chip star">★ ${esc(c.text)}</span>`).join('') || `<span class="muted">${BW.t('No moments starred yet.')}</span>`}</div>
      ${cep && (cep.next || cep.headline) ? `<p class="s"><b>${BW.t('Olaf’s advice:')}</b> ${esc(cep.next || cep.headline)}</p>` : ''}
      <p class="bs-meta"><span>${p.ceps.length} ${BW.t('buying moments')}</span><button type="button" class="link" data-tab="buyers">${BW.t('See them all')} →</button></p></section>`;

    const yearBox = `<section class="card bs-year">${ui.k(BW.t('This year'))}${ui.year(year.map((m, i) => ({ m, state: inMonth(m).length ? (i === 0 && inMonth(m).every((a) => a.status === 'done') ? 'done' : 'planned') : 'empty', title: inMonth(m).map((a) => a.title).join(' · ') })))}
      <p class="s">${planned} ${BW.t('of 12 months planned.')} <a href="apps/marketing/index.html">${BW.t('Open marketing')} →</a></p></section>`;

    const views = {
      overview: () => `<div class="bs-grid">${tiles}</div><div class="bs-grid two">${moments}${latestBox}</div>${work}${yearBox}`,
      health: () => `<div class="bs-grid">${tiles}</div>
        <section class="card">${ui.k(BW.t('Easy to find and buy'))}${find.map(([ok, label]) => `<div class="tick"><i class="${ok ? 'y' : ''}">${ok ? '✓' : ''}</i><span>${esc(BW.t(label))}</span></div>`).join('')}</section>
        <div class="bs-grid two">${reportCard(S['brand-health'], bh)}${reportCard(S['local-presence'], lp)}</div>`,
      buyers: () => `<section class="card">${ui.k(BW.t('Who buys'))}<h2>${esc(who[0])}</h2><p class="s">${esc(who[1])}</p>${p.words ? `<p class="s"><b>${BW.t('Words customers use')}:</b> ${esc(p.words)}</p>` : ''}</section>
        <section class="card">${ui.k(BW.t('When they need you'))}<div class="bs-ceps">${p.ceps.slice().sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0)).map((c) => `<div class="bs-cep${c.priority ? ' star' : ''}"><b>${c.priority ? '★ ' : ''}${esc(c.text)}</b><small>${BW.t('how common')} ${'●'.repeat(c.common || 0)}${'○'.repeat(5 - (c.common || 0))} · ${BW.t('linked to you')} ${'●'.repeat(c.ours || 0)}${'○'.repeat(3 - (c.ours || 0))}</small></div>`).join('')}</div>
          <p class="bs-meta"><span></span><a class="link" href="${EDIT}">${BW.t('Change')} →</a></p></section>
        <div class="bs-grid two">${reportCard(S['category-entry-points'], cep)}${reportCard(S['customer-research'], latest['customer-research'])}</div>`,
      recognisable: () => `<section class="card">${ui.k(BW.t('What makes you recognisable'))}<div class="sw"><i style="background:${esc(s.brandColor || '#FFC93C')}"></i>${s.logo ? `<i style="background:url(${s.logo}) center/cover"></i>` : ''}</div>
          <div class="bs-assets">${p.assets.map((a) => { const z = M.assetZone(a); return `<div class="bs-asset${a.commit ? ' kept' : ''}"><b>${esc(a.name)}</b><small>${esc(BW.t(a.type))} · ${a.commit ? BW.t('use every time') : BW.t('to test')} · ${esc(BW.t(z[0]))}</small></div>`; }).join('') || `<p class="s">${BW.t('Nothing chosen yet.')}</p>`}</div>
          <p class="bs-meta"><span>${BW.t('Your real logo files, fonts and photos are in the Brand Kit.')}</span><a class="link" href="apps/brand/index.html">${BW.t('Open the Brand Kit')} →</a></p></section>
        ${reportCard(S['distinctive-assets'], da)}`,
      positioning: () => `<section class="card">${ui.k(BW.t('What you sell'))}<h2>${esc(p.category || '')}</h2><p class="s">${esc(p.offer || '')}</p>${p.area ? `<div class="chips"><span class="chip">${esc(p.area)}</span></div>` : ''}</section>
        <div class="bs-grid two"><section class="card">${ui.k(BW.t('Real proof'))}<p class="s">${esc(p.proof || BW.t('Nothing written down yet.'))}</p></section>
          <section class="card">${ui.k(BW.t('What stops people buying'))}<div class="chips">${(p.barriers || []).map((b) => `<span class="chip">${esc(BW.t(b))}</span>`).join('') || `<span class="muted">${BW.t('Nothing written down yet.')}</span>`}</div></section></div>
        <section class="card">${ui.k(BW.t('What buyers do instead'))}${(p.competitors || []).map((c) => `<div class="bs-alt"><b>${esc(c.name)}</b>${c.notes ? `<span>${esc(c.notes)}</span>` : ''}</div>`).join('') || `<p class="s">${BW.t('Nothing written down yet.')}</p>`}</section>
        <div class="bs-grid">${reportCard(S['brand-positioning'], latest['brand-positioning'])}${reportCard(S['brand-session'], latest['brand-session'])}${reportCard(S['pr-local-press'], latest['pr-local-press'])}</div>`,
      reports: () => `<section class="card">${ui.k(BW.t('Reports'))}${reports.map((r) => `<button type="button" class="bs-rep" data-open="${esc(r.path)}"><span class="e">${(S[r.skill] || {}).emoji || '📄'}</span><span><b>${esc(r.title)}</b><small>${esc(when(r.date))}${r.skill && S[r.skill] ? ' · ' + esc(BW.t(S[r.skill].name)) : ''}${r.summary ? ' · ' + esc(short(r.summary, 110)) : ''}</small></span><span class="go">${BW.t('Open')}</span></button>`).join('')
        || `<p class="s">${olaf ? BW.t('Olaf’s reports show here, the newest first.') : BW.t('Reports from your brand research show here.')}</p>`}</section>`,
    };

    main.innerHTML = `<div class="part-page bs">${band}${tabs}<div class="bs-view">${views[tab]()}</div></div>`;
    $('[data-print]', main).onclick = () => window.print();
    $$('[data-tab]', main).forEach((b) => { b.onclick = () => { tab = b.dataset.tab; render(); }; });
    $$('[data-open]', main).forEach((b) => { b.onclick = () => { const r = reports.find((x) => x.path === b.dataset.open); if (r) open(r); }; });
    $$('[data-ask]', main).forEach((b) => { b.onclick = () => ask(S[b.dataset.ask]); });
  }

  // Three questions, and the brand is on a page. Everything else can be added later, from the page itself.
  function starter(old) {
    const s = BW.settings;
    main.innerHTML = `<div class="part-page"><div class="card starter">
      <p class="hello">${esc(s.businessName || '')}</p>
      <h1 class="big">${BW.t('Put your brand on one page.')}</h1>
      <p class="lead">${BW.t('A brand is what people think of when they need what you sell. It is the most valuable thing your business owns. Three questions, about ten minutes.')}</p>
      <form data-form>
        <label class="field"><span>1. ${BW.t('What do you sell, said the way a customer would say it?')}</span><input class="in" name="category" placeholder="${BW.t('e.g. bike repairs, wedding photos, a plumber who comes today')}" required></label>
        <label class="field"><span>${BW.t('Where?')}</span><input class="in" name="area" placeholder="${BW.t('e.g. Utrecht and around, the Netherlands, online')}" value="${esc(s.city || '')}"></label>
        <fieldset><legend>2. ${BW.t('When do people need you? Think of your last three customers.')}</legend>
          <input class="in" name="m1" placeholder="${BW.t('e.g. my chain snapped on the way to work')}">
          <input class="in" name="m2" placeholder="${BW.t('e.g. we are opening a shop next month')}">
          <input class="in" name="m3" placeholder="${BW.t('e.g. the old one finally gave up')}"></fieldset>
        <label class="field"><span>3. ${BW.t('If someone saw your van, your window or your invoice without the name, how would they know it is yours?')}</span><input class="in" name="asset" placeholder="${BW.t('e.g. the yellow van, our mascot, "fixed while you wait"')}"></label>
        <div class="row-flex"><button class="btn btn-primary">${BW.t('Show my brand')} →</button></div>
      </form></div></div>`;
    $('[data-form]', main).onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, v = (n) => f[n].value.trim();
      const p = Object.assign(M.blank(), old || {}, { category: v('category'), area: v('area'), onboarded: true });
      p.buyers = p.buyers || (p.area ? `Anyone in ${p.area} who needs ${p.category}.` : '');
      ['m1', 'm2', 'm3'].map(v).filter(Boolean).forEach((text, i) => p.ceps.push({ text, common: 3, ours: 0, priority: i < 3 }));
      M.seedAssets(p);
      if (v('asset')) p.assets.push({ type: 'Other', name: v('asset'), fame: 10, uniq: 70, commit: true });
      await BW.store.put('mktprofile', p);
      BW.confetti();
      render();
    };
  }
})();
