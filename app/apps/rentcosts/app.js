/* Costs & the Tax Year: what each home cost, by kind, with the receipt; and the year's totals per home (rent in,
   costs by kind) for the return or the accountant, as a list and a CSV. Each home counts in its own country's tax
   year and money, so a landlord with homes in two countries sees one block per country. Busy groups the numbers; it
   never says what is deductible and never files anything. */
(function () {
  'use strict';
  const { $, esc } = BW;
  const R = BW.rentals;
  const main = $('#main');
  const lang = () => window.BusyLang || 'en';
  let homes = [], tenancies = [], payments = [], costs = [], year = '';

  BW.boot({
    app: 'rentcosts',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => edit({}), open: async (id) => { await load(); const c = costs.find((x) => x.id === id); if (c) edit(c); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap, .modal-wrap')) render(); },
  });
  BW.shortcut('n', 'Add a cost', () => edit({}));
  async function load() { [homes, tenancies, payments, costs] = await Promise.all(['homes', 'tenancies', 'rentpayments', 'rentcosts'].map((n) => BW.store.all(n).catch(() => []))); }
  const codeOf = (h) => R.countryOf(h || {}, BW.settings, lang());
  // The countries the homes are in; without a home, the landlord's own.
  const codes = () => { const c = [...new Set(homes.map(codeOf))]; return c.length ? c : [codeOf({})]; };
  // One country: its own way of writing the year (2026-27 in England). Several: the year each tax year starts in.
  const yearLabel = (y) => (codes().length === 1 ? R.taxYearLabel(codes()[0], y) : String(y));
  const thisYear = () => String(Math.max(...codes().map((c) => Number(R.taxYearOf(c, BW.today())))));
  const homeName = (h) => (h ? h.name || h.address || BW.t('A home') : BW.t('No home'));

  function render() {
    year = year || thisYear();
    const blocks = R.taxYears(year, { homes, tenancies, payments, costs }, BW.settings, lang());
    // A cost shows in the year of its own home's country; a cost without a home in the landlord's own.
    const own = blocks.find((b) => b.code === codeOf({})) || blocks[0], blockOf = (c) => { const h = homes.find((x) => x.id === c.homeId); return (h && blocks.find((b) => b.code === codeOf(h))) || own; };
    const shown = costs.filter((c) => { const b = blockOf(c); return b && c.date >= b.from && c.date <= b.to; }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const years = [Number(thisYear()), Number(thisYear()) - 1, Number(thisYear()) - 2].map(String);
    const row = (r, b) => `<tr><td>${esc(homeName(r.home))}</td><td class="n">${BW.money(r.rent, b.currency)}</td><td class="n">${BW.money(r.totalCosts, b.currency)}</td><td class="n">${BW.money(r.net, b.currency)}</td></tr>`;
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🧾</span> ${BW.t('Costs & the Tax Year')}</h1><p class="lead">${BW.t('Costs per home with the receipt, and the year’s totals for the return or the accountant.')}</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> ${BW.t('Add a cost')}</button>
      </div>
      <div class="filters" data-year style="margin-bottom:14px">${years.map((y) => `<button type="button" data-v="${y}" aria-pressed="${y === year}">${yearLabel(y)}</button>`).join('')}</div>
      ${blocks.map((b) => `<section class="card"><h2>${BW.t('The tax year')} ${b.label}${blocks.length > 1 ? ` · ${b.pack ? `${b.pack.flag} ${esc(b.pack.name)}` : BW.t('Another country')}` : ''}</h2><p class="s">${BW.fmtDate(b.from)} – ${BW.fmtDate(b.to)}</p>
        <div class="table-scroll"><table class="ledger"><thead><tr><th>${BW.t('Rented home')}</th><th class="n">${BW.t('Rent in')}</th><th class="n">${BW.t('Costs')}</th><th class="n">${BW.t('Rent less costs')}</th></tr></thead><tbody>
        ${b.rows.concat(b.noHome ? [b.noHome] : []).map((r) => row(r, b)).join('') || `<tr><td colspan="4">${BW.t('No homes yet.')}</td></tr>`}
        </tbody></table></div></section>`).join('')}
      <section class="card"><p class="row-flex" style="gap:8px"><button class="btn" data-csv>⬇️ ${BW.t('For the accountant (CSV)')}</button></p>
        <p class="s">${BW.t('Totals of what you recorded. Which costs count, and how, is for the tax office’s guidance or your accountant. Busy never files anything.')}</p></section>
      <section class="card" style="margin-top:16px"><h2>${BW.t('Costs this year')}</h2>
        ${shown.length ? shown.map((c) => `<a class="file-row" href="#open/${c.id}"><span>${R.costKind(c.kind)[1]}</span><span class="main"><b>${esc(c.what || BW.t('A cost'))}</b><small>${esc([BW.fmtDate(c.date), homeName(homes.find((h) => h.id === c.homeId)), BW.t(R.costKind(c.kind)[2])].filter(Boolean).join(' · '))}</small></span><b>${BW.money(R.amount(c.amount), blockOf(c).currency)}</b></a>`).join('')
          : `<p class="s">${BW.t('Nothing yet. Add a repair, the insurance, the agent’s fee.')}</p>`}</section>`;
    $('[data-new]', main).onclick = () => edit({});
    $('[data-year]', main).onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { year = b.dataset.v; render(); } };
    $('[data-csv]', main).onclick = () => csv(blocks);
  }

  // One line per home, each with its own tax year and currency; what has no home is a line of its own.
  function csv(blocks) {
    const kinds = R.COST_KINDS.map((k) => k[0]);
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [[BW.t('Rented home'), BW.t('From'), BW.t('To'), BW.t('Currency'), BW.t('Rent in'), ...kinds.map((k) => BW.t(R.costKind(k)[2])), BW.t('Costs'), BW.t('Rent less costs')].map(q).join(',')];
    for (const b of blocks) for (const r of b.rows.concat(b.noHome ? [b.noHome] : [])) lines.push([homeName(r.home), r.from, r.to, b.currency || '', r.rent, ...kinds.map((k) => r.costs[k] || 0), r.totalCosts, r.net].map(q).join(','));
    BW.download(new Blob([lines.join('\n')], { type: 'text/csv' }), `${R.fileName(BW.t('Tax year'), yearLabel(year))}.csv`);
  }

  // The receipt of a cost: a photo or PDF, kept in the folder under Costs/<year>.
  async function saveReceipt(file, rec) {
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase(), date = rec.date || BW.today();
    const path = `Costs/${date.slice(0, 4)}/${R.fileName(date, rec.what || 'receipt')} ${BW.uid().slice(-4)}${ext}`;
    const r = await BW.store.writeFile(path, file, { download: false });
    if (!r.saved) { BW.toast(BW.t('Receipt photos are kept when you save to a folder. We noted the expense anyway.'), '📁'); return ''; }
    return path;
  }

  function edit(c) {
    let url = '';
    BW.recordDrawer({
      collection: 'rentcosts', rec: Object.assign({ date: BW.today(), kind: 'repairs', homeId: (homes[0] || {}).id || '' }, c), title: 'A cost', newTitle: 'Add a cost',
      fields: [
        { k: 'what', label: 'What was it?', ph: 'e.g. New boiler valve, landlord insurance', span: 2, required: true },
        { k: 'amount', label: 'Amount', type: 'money' },
        { k: 'date', label: 'Paid on', type: 'date' },
        // "No home" is for a cost of all homes together (the accountant, a subscription): it still counts in the totals.
        ...(homes.length ? [{ k: 'homeId', label: 'For which home', type: 'chips', options: homes.map((h) => [h.id, h.name || h.address || BW.t('A home')]).concat([['', BW.t('No home')]]) }] : []),
        { k: 'kind', label: 'Kind', type: 'chips', options: R.COST_KINDS.map(([v, e, l]) => [v, `${e} ${BW.t(l)}`]) },
        { k: 'note', label: 'Note', ph: 'Optional', span: 2 },
      ],
      bottom: () => '<p style="margin-top:12px" data-receipt></p>',
      bind: async (box, r, save) => {
        const slot = $('[data-receipt]', box);
        const draw = async () => {
          if (r.receipt) {
            const f = await BW.store.readFile(r.receipt).catch(() => null);
            if (f) { if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f); }
            slot.innerHTML = f ? `<a class="btn" href="${url}" target="_blank" rel="noopener">📄 ${BW.t('Open the receipt')}</a>` : `<small>📎 ${esc(r.receipt.split('/').pop())}</small>`;
            return;
          }
          slot.innerHTML = `<label class="btn">📎 ${BW.t('Add the receipt')}<input type="file" accept="image/*,application/pdf" hidden></label>`;
          $('input', slot).onchange = async (e) => {
            const file = (e.target.files || [])[0]; if (!file) return;
            BW.readFields($('[data-form]', box), r);
            try { const p = await saveReceipt(file, r); if (p) { r.receipt = p; save(); BW.toast(BW.t('Receipt filed'), '🗂️'); draw(); } } catch (err) { BW.error(err); }
          };
        };
        draw();
      },
      isComplete: (r) => !!String(r.what || '').trim() && R.amount(r.amount) > 0,
      onClose: async () => { if (url) URL.revokeObjectURL(url); await load(); render(); },
    });
  }
})();
