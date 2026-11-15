/* The Brand part of Busy Business: the brand on one page. What you sell and to whom, the moments people need you,
   what makes you recognisable, how strong the brand is today, the year and the week. Read it, change it, print it.
   A business that has not written its brand down yet starts here with three questions. */
(function () {
  'use strict';
  const { $, $$, esc, ui } = BW;
  const main = $('#main'), M = BW.mkt;

  BW.boot({ part: 'brand', onReady: render, onChange: render });

  const EDIT = 'apps/marketing/index.html?part=brand#tab/profile';
  const short = (text, n) => (text.length > n ? text.slice(0, n).replace(/\s+\S*$/, '') + '…' : text);

  async function render() {
    const [profiles, plan, waves, files, invoices, projects] = await Promise.all(['mktprofile', 'mktplan', 'mktwaves', 'olaf-files', 'invoices', 'projects'].map((n) => BW.store.all(n)));
    const p = profiles[0];
    if (!p || (!p.category && !p.ceps.length)) return starter(p);
    const s = BW.settings, today = BW.today();
    const starred = p.ceps.filter((c) => c.priority), rest = p.ceps.length - starred.length;
    // "Who buys": the owner's first sentence as the headline when it is short enough to be one.
    const first = (p.buyers || '').split(/(?<=[.!?])\s/)[0];
    const who = first && first.length <= 80 ? [first, (p.buyers || '').slice(first.length).trim()] : [BW.t('Everyone who buys what you sell'), p.buyers || ''];
    const always = p.assets.filter((a) => a.commit), test = p.assets.length - always.length;
    // How strong: three plain measures, each from the owner's own answers.
    const find = [!!s.website, !!(s.email || s.phone), !!(p.proof || '').trim(), !(p.barriers || []).includes('Prices are unclear'), !(p.barriers || []).includes('Few reviews')];
    const found = find.filter(Boolean).length;
    const wave = waves.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).pop();
    const row = wave && (wave.rows || []).find((r) => r.brand === s.businessName);
    const mind = row && wave.n ? Math.round(row.any / wave.n * 100) : null;
    const month0 = today.slice(0, 7) + '-01', year = Array.from({ length: 12 }, (_, i) => BW.addPeriod(month0, 'month', i).slice(0, 7));
    const inMonth = (m) => plan.filter((a) => (a.month || '').slice(0, 7) === m);
    const planned = year.filter((m) => inMonth(m).length).length;
    const next = plan.filter((a) => a.status !== 'done' && (a.month || '') >= year[0]).sort((a, b) => (a.month || '').localeCompare(b.month || ''))[0];
    // This week: the expert's steps when there are any, else the gaps on this page.
    const journey = (files.find((f) => f.path === 'memory/marketing-journey.md') || {}).content || '';
    const steps = (journey.split(/^## This week$/m)[1] || '').split(/^## /m)[0].split('\n').map((l) => l.match(/^- \[( |x|X)\] (.+?)(?: · .*)?$/)).filter(Boolean).map((m) => [m[1] !== ' ', m[2]]);
    const gaps = [[starred.length >= 3, 'Star the three moments that matter most'], [always.length >= 2, 'Pick the things you will always use'], [!!(p.proof || '').trim(), 'Write down your real proof: reviews, years, clients'],
      [p.competitors.length > 0, 'Say who else buyers consider'], [planned >= 9, 'Plan something for every month']].filter((g) => !g[0]).slice(0, 3);
    const week = steps.length ? steps : gaps;
    const out = invoices.filter((i) => i.kind === 'invoice' && i.status === 'sent' && BW.balanceOf(i) > 0);
    const late = out.filter((i) => i.dueDate < today).length;

    main.innerHTML = `<div class="part-page"><div class="poster">
      <section class="band" style="--brand:${esc(s.brandColor || '#FFC93C')}">${s.logo ? `<img class="logo" src="${s.logo}" alt="">` : `<span class="logo blank">${esc((s.businessName || '?').slice(0, 1))}</span>`}
        <div><h1>${esc(s.businessName || 'Your business')}</h1><p>${esc(short(p.category || p.offer || '', 120))}</p></div>
        <span class="spacer"></span>${p.area ? `<span class="chip">${esc(p.area)}</span>` : ''}
        <span class="band-tools"><a class="btn" href="${EDIT}">✏️ ${BW.t('Change')}</a><button type="button" class="btn" data-print>🖨️ ${BW.t('Print this page')}</button></span></section>
      <section class="card">${ui.k(BW.t('Who buys'))}<h2>${esc(who[0])}</h2><p class="s">${esc(who[1])}</p></section>
      <section class="card">${ui.k(BW.t('When they need you'))}<div class="chips">${starred.map((c) => `<span class="chip star">★ ${esc(c.text)}</span>`).join('') || `<span class="muted">${BW.t('No moments starred yet.')}</span>`}${rest > 0 ? `<a class="chip soft" href="${EDIT}">${rest} ${BW.t('more')}</a>` : ''}</div></section>
      <section class="card">${ui.k(BW.t('What makes you recognisable'))}<div class="sw"><i style="background:${esc(s.brandColor || '#FFC93C')}"></i>${s.logo ? `<i style="background:url(${s.logo}) center/cover"></i>` : ''}</div>
        <div class="chips">${always.map((a) => `<span class="chip">${esc(a.name)}</span>`).join('') || `<span class="muted">${BW.t('Nothing chosen yet.')}</span>`}</div>
        <p class="s">${always.length ? `${BW.t('Use these every time.')} ` : ''}${test > 0 ? `<b>${test} ${BW.t('more to test.')}</b> ` : ''}<a href="apps/brand/index.html">${BW.t('Open the Brand Kit')} →</a></p></section>
      <section class="card">${ui.k(BW.t('How strong is your brand'))}
        <p class="m"><b>${BW.t('Easy to find and buy')}</b> · ${found} ${BW.t('of')} 5</p>${ui.gauge(found / 5 * 100)}
        <p class="m"><b>${BW.t('Recognisable')}</b> · ${always.length} ${BW.t(always.length === 1 ? 'thing you always use' : 'things you always use')}</p>${ui.gauge(Math.min(always.length, 4) / 4 * 100, 'sun')}
        <p class="m"><b>${BW.t('Comes to mind')}</b> · ${mind == null ? BW.t('no survey yet') : mind + '% ' + BW.t('think of you')}</p>${ui.gauge(mind == null ? 0 : mind, 'grape')}</section>
      <section class="card">${ui.k(BW.t('This year'))}${ui.year(year.map((m, i) => ({ m, state: inMonth(m).length ? (i === 0 && inMonth(m).every((a) => a.status === 'done') ? 'done' : 'planned') : 'empty', title: inMonth(m).map((a) => a.title).join(' · ') })))}
        <p class="s">${planned} ${BW.t('of 12 months planned.')} ${next ? `<b>${BW.t('Next:')}</b> ${esc(next.title)}` : ''} <a href="apps/marketing/index.html">${BW.t('Open marketing')} →</a></p></section>
      <section class="card">${ui.k(BW.t('This week'))}${week.length ? week.map(([done, text]) => `<div class="tick"><i class="${done ? 'y' : ''}">${done ? '✓' : ''}</i><span>${esc(BW.t(text))}</span></div>`).join('') : `<p class="s">${BW.t('Nothing is missing on this page. Keep showing up.')}</p>`}</section>
      <a class="card flat ops" href="operations.html"><b>🧰 ${BW.t('Operations today')}</b><span>${BW.money(out.reduce((t, i) => t + BW.balanceOf(i), 0))} ${BW.t('still to come in')}</span>${late ? `<span>${late} ${BW.t(late === 1 ? 'invoice is late' : 'invoices are late')}</span>` : ''}
        <span>${projects.filter((x) => (x.status || 'active') === 'active').length} ${BW.t('jobs in progress')}</span><span class="spacer"></span><span class="btn">${BW.t('Open operations')} →</span></a>
    </div></div>`;
    $('[data-print]', main).onclick = () => window.print();
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
