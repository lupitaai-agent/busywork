/* Marketing Studio: the Brand Profile. One record that every skill reads, built around the category,
   its buyers, buying moments (category entry points) and distinctive assets, as the foundation asks. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const M = (BW.mkt = BW.mkt || {});

  M.blank = () => ({
    id: 'profile', onboarded: false, category: '', offer: '', price: 'mid', area: '', market: 'consumers', cycle: '',
    buyers: '', words: '', ceps: [], assets: [], tone: [], useWords: '', avoidWords: '', proof: '', barriers: [], barrierNotes: '',
    competitors: [], channels: [], budget: '', hours: '', goals: '', learnings: [], changelog: [], skillNotes: {},
  });

  M.CYCLES = [['week', 'Several times a week'], ['month', 'About once a month'], ['season', 'A few times a year'], ['year', 'About once a year'], ['rare', 'Once every few years']];
  // Rough share of category buyers in the market in a given month, by how often people buy.
  const IN_MARKET = { week: 'almost all of them', month: 'most of them', season: 'roughly a quarter to a third', year: 'about one in twelve', rare: 'only a few in a hundred' };
  M.inMarket = (c) => (IN_MARKET[c] ? `In any month, ${IN_MARKET[c]} of the people who buy what you sell are actually looking. The rest will buy later, so most of your marketing is about being remembered when their moment comes.` : '');
  M.TONES = ['Friendly', 'Expert', 'Playful', 'Calm', 'Bold', 'Warm', 'No-nonsense', 'Premium', 'Local', 'Caring', 'Witty', 'Straight-talking'];
  M.CHANNELS = ['Google Business Profile', 'Website', 'Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Newsletter', 'Google Ads', 'Meta ads', 'Local press', 'Radio', 'Flyers & posters', 'Signage & shop front', 'Events & markets', 'Partners', 'Marketplaces', 'Word of mouth'];
  M.BARRIERS = ['Prices are unclear', 'Hard to book or order', 'People don\'t know us', 'Opening hours don\'t fit', 'Few reviews', 'Hard to find or reach', 'Slow to reply', 'Seems expensive', 'Unclear what we do', 'Risky to try'];
  M.ASSET_TYPES = ['Name', 'Colour', 'Logo', 'Character or mascot', 'Tagline', 'Sound or jingle', 'Shape or pattern', 'Photo style', 'Person (owner, team)', 'Packaging', 'Other'];
  const COMMON = [[1, 'Rare'], [2, 'Now and then'], [3, 'Common'], [4, 'Very common'], [5, 'Everyone']];
  const OURS = [[0, 'Not linked'], [1, 'A little'], [2, 'Quite'], [3, 'Strongly']];

  M.assetZone = (a) => {
    const f = Number(a.fame) >= 50, u = Number(a.uniq) >= 50;
    return f && u ? ['Use or lose', 'Famous and yours: use it everywhere.'] : !f && u ? ['Invest', 'Yours, not famous yet: use it more and it will grow.']
      : f && !u ? ['Avoid', 'Known, but shared with others: it may help them too.'] : ['Test or ignore', 'Not working yet: test it or replace it.'];
  };

  M.completeness = (p) => {
    const checks = [p.category, p.area, p.cycle, p.buyers, p.ceps.length >= 5, p.ceps.some((c) => c.priority), p.assets.some((a) => a.commit), p.tone.length, p.competitors.length, p.channels.length, p.budget !== '', p.goals];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  };

  // The profile as the AI reads it. Plain markdown, stable field order (helps prompt caching).
  M.text = (p) => {
    const s = BW.settings, lines = [];
    const add = (k, v) => { if (v != null && String(v).trim()) lines.push(`**${k}:** ${String(v).trim()}`); };
    add('Business name', s.businessName); add('Owner', s.ownerName); add('Location', [s.city, s.country].filter(Boolean).join(', '));
    add('Website', s.website); add('Brand colour', s.brandColor); add('Has a logo', s.logo ? 'yes' : 'no'); add('Writes invoices in', s.docLang === 'nl' ? 'Dutch' : 'English');
    add('Currency', s.currency);
    add('Category (in buyers\' words)', p.category); add('What we sell', p.offer); add('Price level', p.price); add('Area served', p.area);
    add('Sells to', p.market); add('How often people buy the category', (M.CYCLES.find((c) => c[0] === p.cycle) || [])[1]);
    add('Who buys the category', p.buyers); add('Words customers use', p.words);
    if (p.ceps.length) {
      lines.push('\n**Buying moments (category entry points)** — ★ = priority; common = how common among category buyers (1–5); linked = how strongly people link us to it (0–3):');
      p.ceps.slice().sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0)).forEach((c) => lines.push(`- ${c.priority ? '★ ' : ''}${c.text} (common ${c.common || '?'}, linked ${c.ours ?? '?'})`));
    }
    if (p.assets.length) {
      lines.push('\n**Distinctive brand assets** (fame and uniqueness 0–100; ✔ = committed, use every time):');
      p.assets.forEach((a) => lines.push(`- ${a.commit ? '✔ ' : ''}${a.type}: ${a.name} (fame ${a.fame}, uniqueness ${a.uniq} → ${M.assetZone(a)[0]})`));
    }
    add('\nTone of voice', p.tone.join(', ')); add('Words to use', p.useWords); add('Words to avoid', p.avoidWords);
    add('Real proof points (only use these)', p.proof);
    add('Purchase barriers to remove', p.barriers.concat(p.barrierNotes ? [p.barrierNotes] : []).join('; '));
    if (p.competitors.length) { lines.push('\n**Competitors:**'); p.competitors.forEach((c) => lines.push(`- ${c.name}${c.site ? ` (${c.site})` : ''}${c.notes ? `: ${c.notes}` : ''}`)); }
    add('\nChannels in use', p.channels.join(', ')); add('Marketing budget per month', p.budget ? `${p.budget} ${s.currency}` : ''); add('Time for marketing per week', p.hours ? `${p.hours} hours` : '');
    add('Goals', p.goals);
    if (p.learnings.length) { lines.push('\n**Learnings so far (most recent first):**'); p.learnings.slice(-12).reverse().forEach((l) => lines.push(`- ${l.date}: ${l.text}`)); }
    return lines.join('\n');
  };

  // The profile in the shape of Olaf's brand-documents/brand-growth-profile.md, so an owner who
  // moves from the free Studio to Olaf starts where they left off. Same headings as Olaf's template.
  M.olafMarkdown = (p) => {
    const s = BW.settings, out = [];
    const line = (k, v) => out.push(`**${k}:** ${v != null && String(v).trim() ? String(v).trim() : '[FILL]'}`);
    const list = (items) => { if (items.length) items.forEach((x) => out.push(`- ${x}`)); else out.push('- [FILL]'); };
    out.push('# Brand growth profile', '', '> Exported from the Busywork Marketing Studio. Olaf reads this file before every skill.', '', `*Last updated: ${BW.today()}*`, '');
    out.push('## The business', '');
    line('Business name', s.businessName); line('Website', s.website); line('Location', [s.city, s.country].filter(Boolean).join(', ')); line('Currency', s.currency);
    out.push('', '## Category and buyers', '');
    line('Category (in buyers\' words)', p.category); line('What we sell', p.offer); line('Price level', p.price); line('Area served', p.area);
    line('Sells to', p.market); line('How often people buy the category', (M.CYCLES.find((c) => c[0] === p.cycle) || [])[1]);
    line('Who buys the category', p.buyers); line('Words customers use', p.words);
    out.push('', '## Buying moments (category entry points)', '', '★ = priority; common = how common among category buyers (1 to 5); linked = how strongly people link us to it (0 to 3).', '');
    list(p.ceps.slice().sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0)).map((c) => `${c.priority ? '★ ' : ''}${c.text} (common ${c.common || '?'}, linked ${c.ours ?? '?'})`));
    out.push('', '## Distinctive brand assets', '', 'Fame and uniqueness 0 to 100; ✔ = committed, use every time.', '');
    list(p.assets.map((a) => `${a.commit ? '✔ ' : ''}${a.type}: ${a.name} (fame ${a.fame}, uniqueness ${a.uniq}, ${M.assetZone(a)[0].toLowerCase()})`));
    out.push('', '## Voice', '');
    line('Tone of voice', p.tone.join(', ')); line('Words to use', p.useWords); line('Words to avoid', p.avoidWords);
    out.push('', '## Proof', ''); line('Real proof points (only use these)', p.proof);
    out.push('', '## Purchase barriers to remove', ''); list(p.barriers.concat(p.barrierNotes ? [p.barrierNotes] : []));
    out.push('', '## Competitors', ''); list(p.competitors.map((c) => `${c.name}${c.site ? ` (${c.site})` : ''}${c.notes ? `: ${c.notes}` : ''}`));
    out.push('', '## Channels, budget and time', '');
    line('Channels in use', p.channels.join(', ')); line('Marketing budget per month', p.budget ? `${p.budget} ${s.currency}` : ''); line('Time for marketing per week', p.hours ? `${p.hours} hours` : '');
    out.push('', '## Goals', '', (p.goals || '').trim() || '[FILL]');
    out.push('', '## Learnings', ''); list(p.learnings.slice().reverse().map((l) => `${l.date}: ${l.text}`));
    const notes = Object.entries(p.skillNotes || {}).filter(([, v]) => v && v.trim());
    if (notes.length) { out.push('', '## House rules per skill', ''); notes.forEach(([k, v]) => out.push(`- ${k}: ${v.trim().replace(/\n+/g, ' ')}`)); }
    return out.join('\n') + '\n';
  };
  M.exportForOlaf = (p) => {
    BW.download(new Blob([M.olafMarkdown(p)], { type: 'text/markdown' }), 'brand-growth-profile.md');
    BW.toast('Saved brand-growth-profile.md. Olaf reads your profile by itself.', '🧭');
  };

  // ---------- form pieces shared by the wizard and the profile page ----------
  const multi = (name, options, picked) => `<div class="multi" data-multi="${name}">${options.map((o) => `<button type="button" data-v="${esc(o)}" aria-pressed="${picked.includes(o)}">${esc(o)}</button>`).join('')}</div>`;
  const single = (name, options, value) => `<div class="choice-chips" data-single="${name}">${options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(v) === String(value)}">${esc(l)}</button>`).join('')}</div>`;
  const ta = (name, value, ph, rows = 3) => `<textarea class="in" name="${name}" rows="${rows}" placeholder="${esc(ph)}">${esc(value || '')}</textarea>`;
  const inp = (name, value, ph, mode) => `<input class="in" name="${name}" value="${esc(value || '')}" placeholder="${esc(ph)}" ${mode ? `inputmode="${mode}"` : ''} autocomplete="off">`;
  const field = (label, html, hint) => `<label class="field" style="margin-bottom:14px"><span>${label}</span>${html}${hint ? `<em>${hint}</em>` : ''}</label>`;
  const idea = (emoji, html) => `<div class="idea"><span class="e">${emoji}</span><div>${html}</div></div>`;

  function bindChoices(box, onChange) {
    $$('[data-multi] button', box).forEach((b) => b.onclick = () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); onChange(); });
    $$('[data-single] button', box).forEach((b) => b.onclick = () => { $$('button', b.parentElement).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); onChange(); });
  }
  function readCommon(box, p) {
    $$('[name]', box).forEach((el) => { if (!el.closest('[data-rows]') && el.name in p) p[el.name] = el.value.trim(); });
    $$('[data-multi]', box).forEach((g) => { p[g.dataset.multi] = $$('[aria-pressed="true"]', g).map((b) => b.dataset.v); });
    $$('[data-single]', box).forEach((g) => { const on = $('[aria-pressed="true"]', g); if (on) p[g.dataset.single] = on.dataset.v; });
  }

  // ---------- buying moments editor ----------
  function cepHtml(p) {
    return `<div data-wrap="ceps"><div class="ceps" data-rows="ceps">
      <div class="cep-row cep-head"><span>★</span><span>Buying moment, in buyers' words</span><span class="hide-sm">How common?</span><span class="hide-sm">Linked to us?</span><span></span></div>
      ${p.ceps.map((c, i) => `<div class="cep-row" data-i="${i}">
        <button type="button" class="star" data-star aria-pressed="${!!c.priority}" title="Make this a priority" aria-label="Priority">⭐</button>
        <input class="in" type="text" data-k="text" value="${esc(c.text)}" aria-label="Buying moment">
        <select class="in" data-k="common" aria-label="How common">${COMMON.map(([v, l]) => `<option value="${v}" ${Number(c.common) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="in" data-k="ours" aria-label="Linked to us">${OURS.map(([v, l]) => `<option value="${v}" ${Number(c.ours) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="icon-btn" data-del aria-label="Remove">✕</button></div>`).join('')}
    </div>
    <div class="w-chips">${[['Why', 'my laptop died before a deadline'], ['When', 'just before the holidays'], ['Where', 'on my way to work'], ['With or for whom', 'a gift for my mum'], ['With what', 'when we renovate the kitchen'], ['Feeling', 'stressed about my tax return']].map(([w, ex]) => `<button type="button" data-ex="${esc(ex)}">${w}…</button>`).join('')}</div>
    <form class="row-flex" data-addcep><input class="in" style="flex:1" placeholder="Add a buying moment and press Enter" aria-label="New buying moment"><button class="btn">Add</button></form>
    <p class="faint" style="margin-top:8px;font-size:.85rem">Tip: think of the last ten customers. What was going on when they needed you?</p></div>`;
  }
  function bindCeps(box, p, changed) {
    const rows = $('[data-rows="ceps"]', box);
    const redraw = () => { $('[data-wrap="ceps"]', box).outerHTML = cepHtml(p); bindCeps(box, p, changed); changed(); };
    rows.oninput = rows.onchange = (e) => { const r = e.target.closest('[data-i]'); if (!r || !e.target.dataset.k) return; const c = p.ceps[Number(r.dataset.i)]; c[e.target.dataset.k] = e.target.dataset.k === 'text' ? e.target.value : Number(e.target.value); changed(); };
    rows.onclick = (e) => {
      const r = e.target.closest('[data-i]'); if (!r) return;
      const i = Number(r.dataset.i);
      if (e.target.closest('[data-del]')) { p.ceps.splice(i, 1); redraw(); }
      if (e.target.closest('[data-star]')) { p.ceps[i].priority = !p.ceps[i].priority; redraw(); }
    };
    const form = $('[data-addcep]', box);
    form.onsubmit = (e) => { e.preventDefault(); const i = $('input', form); if (!i.value.trim()) return; p.ceps.push({ text: i.value.trim(), common: 3, ours: 0, priority: false }); redraw(); $('[data-addcep] input', box).focus(); };
    $$('[data-ex]', box).forEach((b) => b.onclick = () => { const i = $('input', form); i.placeholder = `e.g. "${b.dataset.ex}"`; i.focus(); });
  }

  // ---------- distinctive assets editor ----------
  function assetHtml(p) {
    return `<div data-wrap="assets"><div data-rows="assets">${p.assets.map((a, i) => `<div class="asset-row" data-i="${i}">
        <div><select class="in" data-k="type" aria-label="Type" style="margin-bottom:4px">${M.ASSET_TYPES.map((t) => `<option ${t === a.type ? 'selected' : ''}>${t}</option>`).join('')}</select><input class="in" data-k="name" value="${esc(a.name)}" aria-label="Asset"></div>
        <label>How famous? <b data-show="fame">${a.fame}</b><input type="range" min="0" max="100" step="5" data-k="fame" value="${a.fame}"></label>
        <label>How unique? <b data-show="uniq">${a.uniq}</b><input type="range" min="0" max="100" step="5" data-k="uniq" value="${a.uniq}"></label>
        <label class="toggle" style="font-size:.8rem"><input type="checkbox" data-k="commit" ${a.commit ? 'checked' : ''}> Use always</label>
        <button type="button" class="icon-btn" data-del aria-label="Remove">✕</button>
        <small class="faint" data-zone style="grid-column:1/-1">${M.assetZone(a).join(' ')}</small></div>`).join('')}</div>
      <button type="button" class="btn" data-addasset style="margin-top:10px">＋ Add a brand element</button></div>`;
  }
  function bindAssets(box, p, changed) {
    const rows = $('[data-rows="assets"]', box);
    const redraw = () => { $('[data-wrap="assets"]', box).outerHTML = assetHtml(p); bindAssets(box, p, changed); changed(); };
    rows.oninput = rows.onchange = (e) => {
      const r = e.target.closest('[data-i]'); if (!r || !e.target.dataset.k) return;
      const a = p.assets[Number(r.dataset.i)], k = e.target.dataset.k;
      a[k] = k === 'commit' ? e.target.checked : (k === 'fame' || k === 'uniq') ? Number(e.target.value) : e.target.value;
      const show = $(`[data-show="${k}"]`, r); if (show) show.textContent = a[k];
      $('[data-zone]', r).textContent = M.assetZone(a).join(' ');
      changed();
    };
    rows.onclick = (e) => { const r = e.target.closest('[data-i]'); if (r && e.target.closest('[data-del]')) { p.assets.splice(Number(r.dataset.i), 1); redraw(); } };
    $('[data-addasset]', box).onclick = () => { p.assets.push({ type: 'Other', name: '', fame: 10, uniq: 50, commit: false }); redraw(); };
  }

  function compHtml(p) {
    return `<div data-wrap="competitors"><div data-rows="competitors">${p.competitors.map((c, i) => `<div class="comp-row" data-i="${i}"><input class="in" data-k="name" value="${esc(c.name)}" placeholder="Name"><input class="in" data-k="site" value="${esc(c.site || '')}" placeholder="Website"><input class="in" data-k="notes" value="${esc(c.notes || '')}" placeholder="Their look, strengths, what buyers say"><button type="button" class="icon-btn" data-del aria-label="Remove">✕</button></div>`).join('')}</div>
      <button type="button" class="btn" data-addcomp>＋ Add a competitor</button></div>`;
  }
  function bindComps(box, p, changed) {
    const rows = $('[data-rows="competitors"]', box);
    const redraw = () => { $('[data-wrap="competitors"]', box).outerHTML = compHtml(p); bindComps(box, p, changed); changed(); };
    rows.oninput = (e) => { const r = e.target.closest('[data-i]'); if (r && e.target.dataset.k) { p.competitors[Number(r.dataset.i)][e.target.dataset.k] = e.target.value; changed(); } };
    rows.onclick = (e) => { const r = e.target.closest('[data-i]'); if (r && e.target.closest('[data-del]')) { p.competitors.splice(Number(r.dataset.i), 1); redraw(); } };
    $('[data-addcomp]', box).onclick = () => { p.competitors.push({ name: '', site: '', notes: '' }); redraw(); };
  }

  // ---------- the steps (used by the wizard and, as sections, by the profile page) ----------
  M.steps = [
    { id: 'sell', emoji: '🏷️', title: 'What do you sell, and where?', sub: 'Describe it the way your buyers would. "Bike repairs in Utrecht", not "mobility solutions".',
      html: (p) => field('The category, in buyers\' words', inp('category', p.category, 'e.g. bike repairs, wedding photography, bookkeeping for freelancers'))
        + field('What you offer', ta('offer', p.offer, 'Main products or services, with rough prices', 3))
        + field('Price level', single('price', [['budget', 'Budget'], ['mid', 'Mid-range'], ['premium', 'Premium']], p.price))
        + field('Area you serve', inp('area', p.area, 'e.g. Utrecht and 20 km around it, the Netherlands, online in Europe'))
        + field('You sell to', single('market', [['consumers', 'Consumers'], ['businesses', 'Businesses'], ['both', 'Both']], p.market))
        + field('How often do people buy what you sell?', single('cycle', M.CYCLES, p.cycle))
        + `<div data-cyclenote>${p.cycle ? idea('🕰️', M.inMarket(p.cycle)) : ''}</div>`,
      bind: (box, p) => bindChoices(box, () => { readCommon(box, p); const n = $('[data-cyclenote]', box); if (n) n.innerHTML = p.cycle ? idea('🕰️', esc(M.inMarket(p.cycle))) : ''; }) },
    { id: 'buyers', emoji: '👥', title: 'Who buys this?', sub: 'Everyone who buys your category in your area, not just your favourite customers.',
      html: (p) => idea('💡', '<b>Why not a niche persona?</b> Research across thousands of brands shows your buyers look like your competitors\' buyers: ordinary people who buy the category. Growth comes from reaching more of them, so we describe all of them.')
        + field('Who buys your category?', ta('buyers', p.buyers || (p.category && p.area ? `Anyone in ${p.area} who needs ${p.category}.` : ''), 'e.g. Commuters, students and families in Utrecht who cycle; small companies with bike-lease plans', 3))
        + field('Words customers use', ta('words', p.words, 'Phrases from reviews, emails and calls, e.g. "my chain keeps slipping", "fixed while I wait"', 3), 'Their words beat marketing words, every time.'),
      bind: (box, p) => {} },
    { id: 'moments', emoji: '🚪', title: 'When do people need you?', sub: 'Buying moments: the needs, times, places and feelings that make someone start looking.',
      html: (p) => idea('🧠', 'People don\'t think of a business in general. They think of it in a moment ("my tyre is flat and I have to be at work at 9"). The more moments link to you, the more often you come to mind first. Add 8 to 15, then star the 3 to 5 that matter most.') + cepHtml(p),
      bind: (box, p, changed) => bindCeps(box, p, changed) },
    { id: 'assets', emoji: '🎨', title: 'What makes you recognisable?', sub: 'Your distinctive assets: colours, logo, characters, slogans, sounds. Be honest about how well-known they are.',
      html: (p) => idea('👀', '<b>Famous</b> = many people in your area link it to you. <b>Unique</b> = it doesn\'t make them think of someone else. Pick 2 to 4 to <b>use always</b>, and never swap them for something "fresher".') + assetHtml(p),
      bind: (box, p, changed) => bindAssets(box, p, changed) },
    { id: 'voice', emoji: '🗣️', title: 'How do you sound, and what holds people back?', sub: 'Your voice, your real proof, and the reasons people don\'t buy (yet).',
      html: (p) => field('Your tone (pick a few)', multi('tone', M.TONES, p.tone))
        + field('Words to use', inp('useWords', p.useWords, 'e.g. fixed, while you wait, honest price'))
        + field('Words to avoid', inp('avoidWords', p.avoidWords, 'e.g. cheap, solutions, synergy'))
        + field('Real proof', ta('proof', p.proof, 'Review score and count, years in business, awards, notable clients. Only true things: we never invent proof.', 3))
        + field('What stops people from buying?', multi('barriers', M.BARRIERS, p.barriers))
        + field('Anything else that holds people back?', inp('barrierNotes', p.barrierNotes, 'e.g. people think we only do racing bikes')),
      bind: (box, p) => bindChoices(box, () => readCommon(box, p)) },
    { id: 'competitors', emoji: '🥊', title: 'Who else do buyers consider?', sub: 'Big ones first: you share most customers with the biggest competitors.',
      html: (p) => compHtml(p), bind: (box, p, changed) => bindComps(box, p, changed) },
    { id: 'channels', emoji: '📣', title: 'Where are you visible, and what can you spend?', sub: 'A realistic plan starts from your real budget and time.',
      html: (p) => field('Channels you use now', multi('channels', M.CHANNELS, p.channels))
        + `<div class="grid-2">${field('Marketing budget per month', inp('budget', p.budget, `e.g. 250 (${BW.settings.currency})`, 'decimal'))}${field('Hours per week for marketing', inp('hours', p.hours, 'e.g. 3', 'decimal'))}</div>`
        + field('Your goals for the next year', ta('goals', p.goals, 'e.g. 40 new customers, fill quiet Tuesday mornings, become the go-to e-bike repair', 3)),
      bind: (box, p) => bindChoices(box, () => readCommon(box, p)) },
  ];

  M.readStep = (box, p) => readCommon(box, p);

  // Prefills brand elements from the Brand Kit so nobody starts from an empty list.
  M.seedAssets = (p) => {
    if (p.assets.length) return;
    const s = BW.settings;
    p.assets.push({ type: 'Name', name: s.businessName, fame: 30, uniq: 90, commit: true });
    if (s.brandColor) p.assets.push({ type: 'Colour', name: s.brandColor.toUpperCase(), fame: 15, uniq: 40, commit: true });
    if (s.logo) p.assets.push({ type: 'Logo', name: 'Our logo', fame: 20, uniq: 80, commit: true });
  };
})();
