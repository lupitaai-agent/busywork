/* Receipts & Expenses: snap or drop a receipt first, fill in the details after. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  const CATS = [['software', '💻 Software'], ['travel', '🚆 Travel'], ['office', '🖇️ Office'], ['food', '🥐 Food & drinks'], ['marketing', '📣 Marketing'], ['equipment', '🖥️ Equipment'], ['training', '🎓 Training'], ['other', '📦 Other']];
  const catLabel = (k) => (CATS.find((c) => c[0] === k) || CATS[CATS.length - 1])[1];
  let list = [], clients = [];
  const now = new Date();
  let year = now.getFullYear(), q = Math.floor(now.getMonth() / 3) + 1; // q = 0 means the whole year

  BW.boot({
    app: 'expenses',
    onReady: async () => {
      await load(); render(); bindDrops();
      BW.route({ new: () => edit(blank()), open: (id) => { const e = list.find((x) => x.id === id); if (e) edit(e); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });

  BW.shortcut('n', 'Add an expense', () => edit(blank()));
  BW.shortcut('r', 'Add a receipt', () => $('[data-snap]').click());
  const blank = () => ({ date: BW.today(), vatRate: BW.vatRates()[0] || 0, category: 'other', paidBy: 'business' });

  async function load() { [list, clients] = await Promise.all([BW.store.all('expenses'), BW.store.all('clients')]); }
  const clientName = (id) => (clients.find((c) => c.id === id) || {}).name || '';

  const vatOf = (e) => { const r = BW.num(e.vatRate), a = BW.num(e.amount); return Math.round(a * r / (100 + r) * 100) / 100; };
  const inPeriod = (e) => {
    if (!e.date || !e.date.startsWith(String(year))) return false;
    if (!q) return true;
    const m = Number(e.date.slice(5, 7));
    return Math.ceil(m / 3) === q;
  };

  function render() {
    const shown = list.filter(inPeriod).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const total = shown.reduce((a, e) => a + BW.num(e.amount), 0);
    const vat = shown.reduce((a, e) => a + vatOf(e), 0);
    const missing = shown.filter((e) => !e.receipt).length;
    const own = shown.filter((e) => e.paidBy === 'private').reduce((a, e) => a + BW.num(e.amount), 0);
    const toPass = list.filter((e) => e.clientId && !e.invoiceId);
    const passGroups = {};
    toPass.forEach((e) => { (passGroups[e.clientId] = passGroups[e.clientId] || []).push(e); });
    const byCat = {};
    for (const e of shown) byCat[e.category || 'other'] = (byCat[e.category || 'other'] || 0) + BW.num(e.amount);
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = cats.length ? cats[0][1] : 1;
    const months = {};
    for (const e of shown) (months[e.date.slice(0, 7)] = months[e.date.slice(0, 7)] || []).push(e);
    const label = q ? `Q${q} ${year}` : String(year);

    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">📸</span> Receipts &amp; Expenses</h1><p class="lead">Snap the receipt, we file it. Drag one anywhere on this page.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          ${shown.length ? '<button class="btn" data-export><span class="emo">⬇️</span> For my accountant</button>' : ''}
          <button class="btn" data-manual><span class="emo">✍️</span> No receipt</button>
          <button class="btn btn-primary btn-big" data-snap-btn><span class="emo">📸</span> Add a receipt</button>
        </div>
      </div>
      <div class="period">
        <button class="icon-btn" data-y="-1" aria-label="Previous year">◀</button><b>${year}</b><button class="icon-btn" data-y="1" aria-label="Next year">▶</button>
        <div class="tabs" role="tablist">${[1, 2, 3, 4, 0].map((n) => `<button role="tab" data-q="${n}" aria-selected="${q === n}">${n ? 'Q' + n : 'Whole year'}</button>`).join('')}</div>
      </div>
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--sun)"><div class="k">💸 Spent in ${label}</div><div class="v" data-count="${total}"></div><div class="s">${shown.length} expense${shown.length === 1 ? '' : 's'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">🔙 VAT to claim back</div><div class="v" data-count="${vat}"></div><div class="s">Free money. Well, your money.</div></div>
        <div class="card stat" style="--tint:var(--tomato)"><div class="k">🧾 Missing receipts</div><div class="v">${missing}</div><div class="s">${missing ? 'Your accountant will ask 👀' : 'Perfectly paper-trailed ✨'}</div></div>
        ${own ? `<div class="card stat" style="--tint:var(--pink)"><div class="k">👛 Paid from your own pocket</div><div class="v">${BW.money(own)}</div><div class="s">Pay yourself back from the business</div></div>` : ''}
      </div>
      ${Object.keys(passGroups).length ? `<h2 style="margin-bottom:12px">🔁 Pass on to clients</h2><div class="bill-list rise">${Object.entries(passGroups).map(([cid, l]) => `
        <div class="card bill"><b>${esc(clientName(cid) || 'A deleted client')}</b><small>${l.length} cost${l.length === 1 ? '' : 's'} · ${BW.money(l.reduce((a, e) => a + BW.num(e.amount) - vatOf(e), 0))} without VAT</small>
        ${clientName(cid) ? `<button class="btn btn-primary" data-pass="${cid}">🧾 Put on their invoice</button>` : ''}</div>`).join('')}</div>` : ''}
      ${shown.length ? `<div class="two">
        <div>${Object.keys(months).map((m) => `
          <div class="month-h"><span>${BW.fmtDate(m + '-01', { month: 'long', year: 'numeric' })}</span><small class="faint">${BW.money(months[m].reduce((a, e) => a + BW.num(e.amount), 0))}</small></div>
          <div class="list">${months[m].map(row).join('')}</div>`).join('')}</div>
        <aside class="card cats"><h3>Where it went</h3>
          ${cats.map(([k, v]) => `<div class="bar-row" title="${esc(catLabel(k))}: ${BW.money(v)}"><span>${catLabel(k)}</span><div class="bar-track"><div class="bar" style="width:${Math.max(2, v / max * 100)}%"></div></div><span class="val">${BW.money(v)}</span></div>`).join('')}
        </aside></div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🧾</div><h2>Nothing for ${label} yet</h2><p>Take a photo of a receipt, or drop the PDF from your email here. Fill in the amount and you're done.</p><button class="btn btn-primary btn-big" data-snap-btn>📸 Add my first receipt</button></div>`}`;

    $$('[data-count]', main).forEach((el) => BW.countUp(el, Number(el.dataset.count), (v) => BW.money(v)));
    $$('[data-q]', main).forEach((b) => b.onclick = () => { q = Number(b.dataset.q); render(); });
    $$('[data-y]', main).forEach((b) => b.onclick = () => { year += Number(b.dataset.y); render(); });
    $$('[data-snap-btn]', main).forEach((b) => b.onclick = () => $('[data-snap]').click());
    $('[data-manual]', main).onclick = () => edit(blank());
    $$('[data-pass]', main).forEach((b) => b.onclick = () => passOn(b.dataset.pass, passGroups[b.dataset.pass]));
    const ex = $('[data-export]', main); if (ex) ex.onclick = () => exportCsv(shown, label);
    $$('.row[data-id]', main).forEach((r) => r.onclick = () => edit(list.find((e) => e.id === r.dataset.id)));
  }

  function row(e) {
    const isPdf = /\.pdf$/i.test(e.receipt || '');
    return `<div class="row" data-id="${e.id}" tabindex="0">
      <span class="thumb">${e.receipt ? (isPdf ? '📄' : '🖼️') : '❔'}</span>
      <span class="main"><b>${esc(e.vendor || 'Something I bought')}</b><small>${BW.fmtDate(e.date)} · ${catLabel(e.category)}${e.receipt ? '' : ' · no receipt yet'}${e.paidBy === 'private' ? ' · 👛 paid privately' : ''}${e.clientId ? ` · 🔁 ${esc(clientName(e.clientId))}${e.invoiceId ? ' (invoiced)' : ''}` : ''}</small></span>
      <span class="amt">${BW.money(BW.num(e.amount))}</span></div>`;
  }

  // ---------- receipts ----------
  async function saveReceipt(file, rec) {
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
    const date = rec.date || BW.today();
    const path = `Receipts/${date.slice(0, 4)}/${date} ${BW.fileSafe(rec.vendor || 'receipt')} ${BW.uid().slice(-4)}${ext}`;
    const r = await BW.store.writeFile(path, file, { download: false });
    if (!r.saved) { BW.toast('Receipt photos are kept when you save to a folder. We noted the expense anyway.', '📁'); return ''; }
    return path;
  }

  async function quickAdd(file) {
    const rec = Object.assign(blank(), { vendor: '' });
    try {
      rec.receipt = await saveReceipt(file, rec);
      rec.vendor = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 40);
      await BW.store.put('expenses', rec);
    } catch (e) { return BW.error(e); }
    await load(); render();
    BW.toast('Got it! Now just add the amount.', '📸');
    edit(rec);
  }

  function bindDrops() {
    const snap = $('[data-snap]'), overlay = $('[data-dropall]');
    snap.onchange = () => { if (snap.files[0]) quickAdd(snap.files[0]); snap.value = ''; };
    let depth = 0;
    document.addEventListener('dragenter', (e) => { if (e.dataTransfer.types.includes('Files') && !$('.drawer-wrap')) { depth++; overlay.classList.add('on'); } });
    document.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) overlay.classList.remove('on'); });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      e.preventDefault(); depth = 0; overlay.classList.remove('on');
      if ($('.drawer-wrap')) return;
      const f = e.dataTransfer.files[0]; if (f) quickAdd(f);
    });
  }

  // ---------- one expense ----------
  function edit(e) {
    let url = null;
    BW.recordDrawer({
      collection: 'expenses', rec: e, title: 'Expense', newTitle: 'New expense',
      fields: [
        { k: 'vendor', label: 'Where from?', ph: 'e.g. Albert Heijn, Adobe, NS', span: 2 },
        { k: 'amount', label: 'Total paid (with VAT)', type: 'money', ph: '0.00' },
        { k: 'date', label: 'Date', type: 'date' },
        { k: 'vatRate', label: 'VAT on it', type: 'chips', options: BW.vatRates().map((r) => [r, r + '%']) },
        { k: 'category', label: 'What kind of thing?', type: 'chips', options: CATS },
        { k: 'paidBy', label: 'Paid with', type: 'chips', options: [['business', '🏦 Business account'], ['private', '👛 My own money']] },
        { k: 'clientId', label: 'Pass this cost on to a client?', type: 'select', options: [['', 'No, it’s mine']].concat(clients.map((c) => [c.id, c.name])), span: 2, hint: 'It lands on their next invoice, without VAT, so you charge VAT once.' },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'Anything your accountant should know', span: 2 },
      ],
      isComplete: (r) => !!(r.vendor || r.amount || r.receipt),
      top: (r) => `<div class="receipt-preview" data-preview>${r.receipt ? '<small>Loading receipt…</small>' : `<div class="dropzone" data-zone tabindex="0" role="button"><div><div style="font-size:2rem">📸</div><b>Add the receipt</b><br><small>Photo or PDF</small></div></div><input type="file" accept="image/*,application/pdf" hidden data-file>`}</div>`,
      bottom: (r) => `<p class="vat-note" data-vatnote>${vatLine(r)}</p>`,
      bind: async (box, r, save) => {
        box.addEventListener('input', () => { BW.readFields($('[data-form]', box), r); $('[data-vatnote]', box).textContent = vatLine(r); });
        box.addEventListener('click', () => setTimeout(() => { BW.readFields($('[data-form]', box), r); $('[data-vatnote]', box).textContent = vatLine(r); }));
        const prev = $('[data-preview]', box);
        if (r.receipt) {
          const f = await BW.store.readFile(r.receipt).catch(() => null);
          if (!f) { prev.innerHTML = `<small>📎 ${esc(r.receipt.split('/').pop())} (open your folder to see it)</small>`; return; }
          url = URL.createObjectURL(f);
          prev.innerHTML = f.type === 'application/pdf'
            ? `<a class="btn" href="${url}" target="_blank" rel="noopener">📄 Open the receipt</a>`
            : `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Receipt"></a>`;
          return;
        }
        const zone = $('[data-zone]', box), input = $('[data-file]', box);
        const take = async (file) => {
          try { const p = await saveReceipt(file, r); if (p) { r.receipt = p; save(); BW.toast('Receipt filed', '🗂️'); } }
          catch (err) { BW.error(err); }
        };
        zone.onclick = () => input.click();
        input.onchange = () => input.files[0] && take(input.files[0]);
        zone.ondragover = (ev) => { ev.preventDefault(); zone.classList.add('over'); };
        zone.ondragleave = () => zone.classList.remove('over');
        zone.ondrop = (ev) => { ev.preventDefault(); ev.stopPropagation(); zone.classList.remove('over'); if (ev.dataTransfer.files[0]) take(ev.dataTransfer.files[0]); };
      },
      onClose: async () => { if (url) URL.revokeObjectURL(url); await load(); render(); },
    });
  }
  const vatLine = (r) => (BW.num(r.amount) ? `Of ${BW.money(BW.num(r.amount))}, ${BW.money(vatOf(r))} is VAT you can usually claim back.` : '');

  // Costs passed on to a client go onto their open draft invoice, or a new one.
  async function passOn(clientId, items) {
    const c = clients.find((x) => x.id === clientId);
    try {
      const invoices = await BW.store.all('invoices');
      let inv = invoices.find((i) => i.kind === 'invoice' && i.status === 'draft' && i.clientId === clientId);
      const today = BW.today();
      if (!inv) {
        inv = { kind: 'invoice', number: BW.nextNumber(invoices, 'invoice', today.slice(0, 4)), status: 'draft', issueDate: today,
          dueDate: BW.addDays(today, BW.num(c.paymentDays) || BW.settings.paymentDays || 14), currency: BW.settings.currency, clientId, lang: c.lang || '',
          client: Object.fromEntries(['name', 'contact', 'email', 'address', 'postcode', 'city', 'country', 'vat'].map((k) => [k, c[k] || ''])), items: [], notes: '', reverseCharge: false };
      }
      inv.items = inv.items.filter((it) => it.desc || BW.num(it.price)).concat(items.map((e) => ({
        id: BW.uid(), desc: `${e.vendor || 'Cost'} (${BW.fmtDate(e.date, { day: 'numeric', month: 'short' })})`, qty: 1,
        price: Math.round((BW.num(e.amount) - vatOf(e)) * 100) / 100, vat: BW.vatRates()[0] != null ? BW.vatRates()[0] : 21,
      })));
      await BW.store.put('invoices', inv);
      items.forEach((e) => { e.invoiceId = inv.id; });
      await BW.store.putMany('expenses', items);
      BW.toast(`Added to invoice ${esc(inv.number)}. Opening it…`, '🧾');
      setTimeout(() => { location.href = `../invoices/index.html#edit/${inv.id}`; }, 1000);
    } catch (e) { BW.error(e); }
  }

  function exportCsv(rows, label) {
    BW.exportCsv(`expenses-${label.replace(' ', '-')}.csv`, ['Date', 'Where from', 'Category', 'Total', 'VAT %', 'VAT', 'Without VAT', 'Paid with', 'Receipt file', 'Notes'],
      rows.slice().reverse().map((e) => [e.date, e.vendor, catLabel(e.category).replace(/^\S+\s/, ''), BW.num(e.amount).toFixed(2), BW.num(e.vatRate), vatOf(e).toFixed(2), (BW.num(e.amount) - vatOf(e)).toFixed(2), e.paidBy === 'private' ? 'own money' : 'business', e.receipt || '', e.notes || '']));
  }
})();
