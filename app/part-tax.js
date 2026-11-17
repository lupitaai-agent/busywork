/* Tax time: one date a year, and the papers worth keeping for it. Every country now pre-fills much of the return;
   what a household still has to do is keep the receipts the tax office does not know about, and remember one date.
   Busy keeps the papers and the date. It never gives tax advice and never files anything. */
(function () {
  'use strict';
  const { $, $$, esc, ui } = BW;
  const H = BW.house;
  const main = $('#main');

  BW.boot({ part: 'dates', onReady: render, onChange: render });

  // Ticks on the list of papers to gather, per country and tax year, kept on the household's settings.
  const ticksKey = (code, year) => `${code}:${year}`;

  async function render() {
    const s = BW.settings, today = BW.today(), code = H.taxCountry(s, H.lang());
    const chips = `<div class="filters" data-country role="group" aria-label="${BW.t('Country')}">${Object.entries(H.TAX).map(([k, x]) => `<button type="button" data-v="${k}" aria-pressed="${k === code}">${x.flag} ${esc(x.name)}</button>`).join('')}<button type="button" data-v="none" aria-pressed="${s.taxCountry === 'none'}">${BW.t('Not for me')}</button></div>`;
    const choose = () => { $('[data-country]', main).onclick = async (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      try { await BW.store.saveSettings(Object.assign({}, BW.settings, { taxCountry: b.dataset.v })); } catch (err) { return BW.error(err); }
      render();
    }; };
    // No country known (or switched off): ask, never guess.
    if (!code) {
      main.innerHTML = `<div class="part-page">
        <div class="part-head"><div><p class="hello">${BW.t('Tax time')}</p><h1 class="big">${BW.t('Keep the right papers all year. Then it is one evening.')}</h1></div>${chips}</div>
        <div class="dates-two"><div><section class="card">${ui.k(BW.t('Country'))}<p class="s">${BW.t('Choose a country to see its date and the papers to gather.')}</p></section></div>
        <aside class="side-col"><section class="card">${ui.k(BW.t('What Busy does'))}<p class="s">${BW.t('Busy keeps the papers and the date. It does not give tax advice and never sends anything to the tax office.')}</p></section></aside></div>
        <p class="also">${BW.t('Also here:')} <a href="home-dates.html">🗓️ ${BW.t('Dates')}</a> · <a href="home-tray.html">📥 ${BW.t('The tray')}</a></p></div>`;
      choose();
      return;
    }
    const t = H.TAX[code], d = H.taxDates(code, today);
    const papers = H.visiblePapers((await BW.store.all('papers')).filter((p) => !p.replaced), H.myself());
    const year = d.year, tagged = H.taxPapers(papers, year), nowYear = H.taxYearOf(code, today), collecting = H.taxPapers(papers, nowYear);
    const ticks = ((s.taxTicks || {})[ticksKey(code, year)]) || [];
    const due = BW.fmtDate(d.due, { day: 'numeric', month: 'long', year: 'numeric' });
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('Tax time')}</p><h1 class="big">${d.left <= 60 ? `${BW.t('The tax return is due')} ${H.when(d.left)}.` : BW.t('Keep the right papers all year. Then it is one evening.')}</h1></div>
        ${chips}</div>
      <div class="dates-two"><div>
        <section class="card">
          ${ui.k(`${t.flag} ${esc(BW.t(t.form))}`)}
          <h2>${BW.t('Due')} ${due}</h2>
          <p class="s">${d.open ? BW.t('The season is open.') : `${BW.t('Opens on')} ${BW.fmtDate(d.opens, { day: 'numeric', month: 'long' })}.`} ${t.vary ? BW.t('The exact dates move a little each year: check them on the official site.') : ''}</p>
          <p class="s">${esc(BW.t(t.who))}</p>
          <p><a class="btn" href="${esc(t.link)}" target="_blank" rel="noopener">${BW.t('The official site')} ↗</a></p>
        </section>
        <section class="card">
          ${ui.k(`${BW.t('To gather for')} ${esc(year)}`)}
          <div class="check-list" data-ticks>${t.gather.map((g, i) => `<label class="check-item"><input type="checkbox" data-i="${i}" ${ticks.includes(i) ? 'checked' : ''}><span class="main">${esc(BW.t(g))}</span></label>`).join('')}</div>
          ${t.also ? `<p class="s" style="margin-top:10px">💡 ${esc(BW.t(t.also))}</p>` : ''}
        </section>
        <section class="card">
          ${ui.k(`${BW.t('Kept for')} ${esc(year)}: ${tagged.length}`)}
          ${tagged.length ? tagged.map((p) => ui.line(`${H.kind(p.kind)[1]} ${esc(p.title || 'A document')}`, p.where ? `📍 ${esc(p.where)}` : '', `apps/papers/index.html#open/${p.id}`)).join('') : `<p class="s">${BW.t('Nothing tagged for this year yet. Open a document and choose “Keep for the tax return”.')}</p>`}
          ${tagged.length ? `<button type="button" class="btn" data-list style="margin-top:10px">📄 ${BW.t('Make the list (PDF)')}</button>` : ''}
        </section>
      </div><aside class="side-col">
        <section class="card">${ui.k(BW.t('Worth keeping during the year'))}${t.keep.map((k) => `<p class="s">🧾 ${esc(BW.t(k))}</p>`).join('')}
          <p class="s">${BW.t('When one comes in, drop it on the tray and choose “Keep for the tax return”.')}</p></section>
        ${nowYear !== year ? `<section class="card">${ui.k(`${BW.t('Collecting now for')} ${esc(nowYear)}`)}<h2>${collecting.length}</h2><p class="s">${BW.t(collecting.length === 1 ? 'document kept so far' : 'documents kept so far')}</p></section>` : ''}
        <section class="card">${ui.k(BW.t('What Busy does'))}<p class="s">${BW.t('Busy keeps the papers and the date. It does not give tax advice and never sends anything to the tax office.')}</p></section>
      </aside></div>
      <p class="also">${BW.t('Also here:')} <a href="home-dates.html">🗓️ ${BW.t('Dates')}</a> · <a href="home-tray.html">📥 ${BW.t('The tray')}</a></p></div>`;
    choose();
    $('[data-ticks]', main).onchange = async () => {
      const on = $$('[data-i]', main).filter((x) => x.checked).map((x) => Number(x.dataset.i));
      const all = Object.assign({}, BW.settings.taxTicks || {}, { [ticksKey(code, year)]: on });
      try { await BW.store.saveSettings(Object.assign({}, BW.settings, { taxTicks: all })); } catch (err) { BW.error(err); }
    };
    const l = $('[data-list]', main);
    if (l) l.onclick = async () => {
      const lines = [`# ${BW.t('Tax return')} ${year}: ${BW.t(t.form)}`, `${BW.t('Due')} ${due}`, '', `# ${BW.t('Kept for this year')}`, ''];
      tagged.forEach((p) => lines.push(`- ${p.title || 'Document'}${p.person ? ` (${p.person})` : ''}${p.where ? `: ${p.where}` : ''}`));
      lines.push('', `# ${BW.t('To gather')}`, '');
      t.gather.forEach((g, i) => lines.push(`- ${ticks.includes(i) ? '[x]' : '[ ]'} ${BW.t(g)}`));
      try { await H.savePdf('Home', `${BW.t('Tax return')} ${year}`, H.pdf(`${BW.t('Tax return')} ${year}`, lines.join('\n'), { footer: BW.t('A list made by Busy Home. Not tax advice.') })); } catch (err) { BW.error(err); }
    };
  }
})();
