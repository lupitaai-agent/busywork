/* Client Book: the shared client list every other tool reads from. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  let clients = [], invoices = [], query = '';
  let open = null; // the drawer currently showing a client

  BW.boot({
    app: 'clients',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => openClient(null), open: (id) => { if (clients.some((c) => c.id === id)) openClient(id); } });
    },
    onChange: async (name) => { if (name === 'clients' || name === 'invoices' || name === '*') { await load(); if (!open) render(); } },
  });

  BW.shortcut('n', 'New client', () => openClient(null));
  BW.shortcut('/', 'Search', () => { const s = $('[data-search]', main); if (s) s.focus(); });

  async function load() {
    [clients, invoices] = await Promise.all([BW.store.all('clients'), BW.store.all('invoices')]);
    clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  function statsFor(id) {
    const mine = invoices.filter((i) => i.clientId === id && i.kind === 'invoice');
    const sum = (arr) => arr.reduce((a, i) => a + BW.invoiceTotals(i).total, 0);
    return {
      count: mine.length,
      paid: mine.reduce((a, i) => a + BW.paymentsOf(i).reduce((x, p) => x + BW.num(p.amount), 0), 0),
      open: mine.filter((i) => i.status === 'sent').reduce((a, i) => a + BW.balanceOf(i), 0),
      all: invoices.filter((i) => i.clientId === id).sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '')),
    };
  }

  function render() {
    const q = query.toLowerCase();
    const shown = clients.filter((c) => !q || [c.name, c.contact, c.email, c.city].join(' ').toLowerCase().includes(q));
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">📇</span> Client Book</h1>
          <p class="lead">${clients.length ? `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}, all in one friendly place.` : 'Everyone you work with, in one friendly place.'}</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          <button class="btn" data-import><span class="emo">⬆️</span> Import a list</button>
          ${clients.length ? '<button class="btn" data-export><span class="emo">⬇️</span> Export</button>' : ''}
          <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add a client</button>
        </div>
      </div>
      ${clients.length ? `
        <div class="toolbar"><label class="search"><input class="in" type="search" placeholder="Search by name, email or city…" value="${esc(query)}" data-search aria-label="Search clients"></label></div>
        <div class="cgrid rise">
          ${shown.map(card).join('')}
          ${!q ? '<button class="card ccard add" data-new><span class="plus">＋</span><b>Add another client</b></button>' : ''}
        </div>
        ${!shown.length ? `<div class="empty"><div class="big">🕵️</div><h2>No one called “${esc(query)}”</h2><p>Try a shorter search, or add them as a new client.</p></div>` : ''}`
      : `<div class="card empty rise" style="margin-bottom:60px">
          <div class="big">📇</div><h2>Your client book is empty</h2>
          <p>Add your first client in a few seconds, or bring in the list you already have from Excel or Google Sheets.</p>
          <div class="row-flex" style="justify-content:center"><button class="btn btn-primary btn-big" data-new>＋ Add your first client</button><button class="btn btn-big" data-import>⬆️ Import a list</button></div>
        </div>`}`;

    $$('[data-new]', main).forEach((b) => b.onclick = () => openClient(null));
    $$('[data-import]', main).forEach((b) => b.onclick = importFlow);
    const ex = $('[data-export]', main); if (ex) ex.onclick = exportCsv;
    $$('[data-id]', main).forEach((b) => b.onclick = () => openClient(b.dataset.id));
    const s = $('[data-search]', main);
    if (s) s.oninput = BW.debounce(() => { query = s.value; render(); const n = $('[data-search]', main); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 120);
  }

  function card(c) {
    const st = statsFor(c.id);
    return `<button class="card ccard" data-id="${c.id}">
      <div class="top"><div class="avatar" style="--av:${BW.colorFor(c.name)}">${esc(BW.initials(c.name))}</div>
        <div style="min-width:0"><b>${esc(c.name)}</b><small>${esc(c.contact || c.email || c.city || 'No details yet')}</small></div></div>
      <div class="meta">
        ${c.city ? `<span>📍 ${esc(c.city)}</span>` : ''}
        ${st.count ? `<span>🧾 ${st.count} invoice${st.count === 1 ? '' : 's'}</span>` : '<span>✨ New</span>'}
        ${st.open ? `<span>⏳ ${BW.money(st.open)} open</span>` : ''}
      </div></button>`;
  }

  // ---------- one client, in a drawer that saves as you type ----------
  function openClient(id) {
    const c = id ? Object.assign({}, clients.find((x) => x.id === id)) : {};
    const box = document.createElement('div');
    const d = BW.drawer({ title: id ? 'Client' : 'New client', body: box, onClose: () => { open = null; flush().then(render); } });
    open = d;
    let pending = false;

    const draw = () => {
      const st = c.id ? statsFor(c.id) : null;
      box.innerHTML = `
        <div class="client-hero"><div class="avatar" style="--av:${BW.colorFor(c.name)}">${esc(BW.initials(c.name || '+'))}</div>
          <div><h2 data-title>${esc(c.name || 'Who are they?')}</h2><div class="save-state" data-state>${c.id ? 'All changes saved' : 'Saves by itself once it has a name'}</div></div></div>
        ${c.id ? `<div class="row-flex" style="margin-bottom:6px">
            <a class="btn btn-primary" href="../invoices/index.html#new/invoice/${c.id}">🧾 New invoice</a>
            <a class="btn" href="../invoices/index.html#new/quote/${c.id}">💬 New quote</a></div>
          <div class="totals-strip"><div><small>Paid you so far</small><b>${BW.money(st.paid)}</b></div><div><small>Still to come in</small><b>${BW.money(st.open)}</b></div></div>` : ''}
        <form data-form>${BW.fieldsHtml(BW.clientFields, c)}</form>
        ${st && st.all.length ? `<h3 class="section-title">🗂️ History</h3><div class="history">${st.all.map((i) => `
          <a href="../invoices/index.html#edit/${i.id}"><span>${i.kind === 'quote' ? '💬' : '🧾'}</span><span><b>${esc(i.number)}</b> <small>${BW.fmtDate(i.issueDate)}</small></span>
          <span class="chip ${i.status === 'paid' || i.status === 'accepted' ? 'chip-mint' : i.status === 'sent' ? 'chip-sun' : 'chip-grey'}">${statusWord(i)}</span>
          <span class="amt">${BW.money(BW.invoiceTotals(i).total)}</span></a>`).join('')}</div>` : ''}
        ${c.id ? '<div style="margin-top:28px"><button class="btn btn-ghost btn-danger" data-del>🗑️ Delete this client</button></div>' : ''}`;

      const form = $('[data-form]', box);
      const save = BW.debounce(async () => {
        BW.readFields(form, c);
        if (!c.name) { pending = false; return; }
        try {
          const isNew = !c.id;
          await BW.store.put('clients', c);
          pending = false;
          await load();
          $('[data-state]', box).textContent = 'All changes saved ✓';
          if (isNew) { d.head.textContent = 'Client'; BW.toast(`${esc(c.name)} is in your book`, '🎉'); redrawKeepingFocus(); }
        } catch (e) { BW.error(e); }
      }, 500);
      form.addEventListener('input', () => {
        pending = true;
        $('[data-state]', box).textContent = 'Saving…';
        const name = $('[name="name"]', form).value;
        $('[data-title]', box).textContent = name || 'Who are they?';
        $('.avatar', box).textContent = BW.initials(name || '+');
        $('.avatar', box).style.setProperty('--av', BW.colorFor(name));
        save();
      });
      flush = async () => { if (pending) { BW.readFields(form, c); if (c.name) await BW.store.put('clients', c); pending = false; await load(); } };
      const del = $('[data-del]', box);
      if (del) del.onclick = async () => {
        pending = false;
        const copy = Object.assign({}, c);
        d.close();
        await BW.removeWithUndo('clients', copy, esc(c.name), async () => { await load(); render(); });
      };
      if (!c.id) $('[name="name"]', form).focus();
    };
    // The first save adds buttons above the form; put the cursor back where the user was typing.
    const redrawKeepingFocus = () => {
      const a = document.activeElement, name = a && box.contains(a) ? a.name : null;
      let pos = null; try { pos = a.selectionStart; } catch (e) { /* email inputs have no caret API */ }
      draw();
      const el = name && $(`[name="${name}"]`, box);
      if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
    };
    draw();
  }
  let flush = async () => {};

  function statusWord(i) {
    if (i.kind === 'quote') return { accepted: 'Accepted', declined: 'Declined', sent: 'Sent' }[i.status] || 'Draft';
    if (i.kind === 'credit') return 'Credit note';
    if (i.status === 'sent' && i.dueDate < BW.today()) return 'Overdue';
    return { paid: 'Paid', sent: 'Waiting' }[i.status] || 'Draft';
  }

  // ---------- import and export ----------
  const SYNONYMS = {
    name: ['name', 'company', 'company name', 'client', 'customer', 'organisation', 'organization', 'business', 'bedrijf', 'bedrijfsnaam', 'klant', 'naam', 'klantnaam'],
    contact: ['contact', 'contact person', 'contact name', 'contactpersoon', 'full name', 'person'],
    email: ['email', 'e-mail', 'mail', 'email address', 'e-mailadres', 'emailadres'],
    phone: ['phone', 'telephone', 'tel', 'mobile', 'telefoon', 'telefoonnummer', 'phone number', 'mobiel'],
    vat: ['vat', 'vat number', 'vat id', 'tax id', 'btw', 'btw-nummer', 'btw nummer', 'btw-nr'],
    address: ['address', 'street', 'street address', 'address 1', 'adres', 'straat', 'straatnaam'],
    postcode: ['postcode', 'postal code', 'zip', 'zip code', 'zipcode', 'post code'],
    city: ['city', 'town', 'plaats', 'stad', 'woonplaats', 'vestigingsplaats'],
    country: ['country', 'land'],
    notes: ['notes', 'note', 'comments', 'opmerking', 'opmerkingen', 'notities'],
  };
  const guess = (headers, key) => {
    const hs = headers.map((h) => h.trim().toLowerCase());
    let i = hs.findIndex((h) => (SYNONYMS[key] || []).includes(h));
    if (i < 0) i = hs.findIndex((h) => (SYNONYMS[key] || []).some((s) => s.length > 3 && h.includes(s)));
    return i;
  };

  function importFlow() {
    const box = document.createElement('div');
    const m = BW.modal({ title: '⬆️ Import your client list', body: box, wide: true });
    box.innerHTML = `
      <div class="dropzone" data-drop tabindex="0" role="button"><div><div style="font-size:2.4rem">📄</div><b>Drop your CSV file here</b><br><small>or click to pick one</small></div></div>
      <input type="file" accept=".csv,text/csv,.txt" hidden data-file>
      <p class="muted" style="margin-top:14px">💡 Got your list in Excel or Google Sheets? Choose <b>File → Download</b> (or <b>Save as</b>) and pick <b>CSV</b>.</p>
      <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:750">Or paste it straight in</summary>
        <textarea class="in" rows="6" data-paste placeholder="Name, Email, City&#10;Bakery De Gouden Korst, anna@goudenkorst.nl, Utrecht" style="margin-top:10px"></textarea>
        <button class="btn" data-use style="margin-top:10px">Use this</button></details>`;
    const zone = $('[data-drop]', box), file = $('[data-file]', box);
    const take = (text) => { const rows = BW.csv.parse(text); if (rows.length < 2) { BW.toast("We couldn't find any rows in that. Is the first row the column names?", '🤔'); return; } mapStep(m, box, rows); };
    zone.onclick = () => file.click();
    zone.onkeydown = (e) => { if (e.key === 'Enter') file.click(); };
    file.onchange = async () => file.files[0] && take(await file.files[0].text());
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('over'); };
    zone.ondragleave = () => zone.classList.remove('over');
    zone.ondrop = async (e) => { e.preventDefault(); zone.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) take(await f.text()); };
    $('[data-use]', box).onclick = () => take($('[data-paste]', box).value);
  }

  function mapStep(m, box, rows) {
    const [headers, ...data] = rows;
    const keys = BW.clientFields.map((f) => f.k);
    const map = Object.fromEntries(keys.map((k) => [k, guess(headers, k)]));
    const build = () => data.map((r) => Object.fromEntries(keys.filter((k) => map[k] >= 0).map((k) => [k, (r[map[k]] || '').trim()]))).filter((c) => c.name);
    const draw = () => {
      const out = build();
      const known = new Set(clients.map((c) => (c.name + '|' + (c.email || '')).toLowerCase()));
      const fresh = out.filter((c) => !known.has((c.name + '|' + (c.email || '')).toLowerCase()));
      box.innerHTML = `
        <p style="margin-bottom:16px">We found <b>${data.length} rows</b>. We matched your columns as best we could. Fix anything that looks off:</p>
        <div class="map-grid">${BW.clientFields.map((f) => `<span class="lbl">${f.label}${f.required ? ' *' : ''}</span>
          <select class="in" data-k="${f.k}"><option value="-1">— leave empty —</option>${headers.map((h, i) => `<option value="${i}" ${map[f.k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select>`).join('')}</div>
        <h3 class="section-title" style="margin-top:22px">👀 Preview</h3>
        ${map.name < 0 ? '<p>Pick which column holds the <b>name</b> to see a preview.</p>' : `<div class="table-scroll"><table class="preview-table"><tr>${keys.filter((k) => map[k] >= 0).map((k) => `<th>${esc(BW.clientFields.find((f) => f.k === k).label)}</th>`).join('')}</tr>
          ${out.slice(0, 4).map((c) => `<tr>${keys.filter((k) => map[k] >= 0).map((k) => `<td>${esc(c[k])}</td>`).join('')}</tr>`).join('')}</table></div>`}
        <div class="row-flex" style="margin-top:22px;justify-content:flex-end">
          ${out.length - fresh.length ? `<small>${out.length - fresh.length} already in your book, we'll skip those.</small>` : ''}
          <button class="btn btn-primary btn-big" data-go ${fresh.length ? '' : 'disabled'}>Import ${fresh.length} client${fresh.length === 1 ? '' : 's'} 🎉</button></div>`;
      $$('select[data-k]', box).forEach((s) => s.onchange = () => { map[s.dataset.k] = Number(s.value); draw(); });
      $('[data-go]', box).onclick = async () => {
        try {
          await BW.store.putMany('clients', fresh);
          m.close(); await load(); render();
          BW.confetti(); BW.toast(`${fresh.length} clients moved in`, '🏡');
        } catch (e) { BW.error(e); }
      };
    };
    draw();
  }

  function exportCsv() {
    const keys = BW.clientFields.map((f) => f.k);
    const csv = BW.csv.stringify([BW.clientFields.map((f) => f.label), ...clients.map((c) => keys.map((k) => c[k] || ''))]);
    BW.download(new Blob(['﻿' + csv], { type: 'text/csv' }), `clients-${BW.today()}.csv`);
    BW.toast('Your client list is downloading', '📄');
  }
})();
