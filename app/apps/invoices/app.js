/* Invoices & Quotes: edit right on the paper, then save a PDF or send it. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  let invoices = [], clients = [], catalog = [], tab = 'all', query = '';
  let cur = null, isNew = false, dirty = false;

  BW.boot({
    app: 'invoices',
    onReady: async () => { await load(); route(); },
    onChange: async (name) => {
      if (name === 'settings') { if (cur) drawEditor(); else showList(); return; }
      await load();
      if (!cur) showList();
    },
  });
  window.addEventListener('hashchange', route);
  BW.shortcut('n', 'New invoice', () => { location.hash = '#new/invoice'; });
  BW.shortcut('q', 'New quote', () => { location.hash = '#new/quote'; });
  BW.shortcut('/', 'Search', () => { const s = $('[data-search]', main); if (s) s.focus(); });
  window.addEventListener('beforeunload', () => { if (dirty) flush(); });

  async function load() {
    [invoices, clients, catalog] = await Promise.all([BW.store.all('invoices'), BW.store.all('clients'), BW.store.all('catalog')]);
  }

  async function route() {
    await flush();
    const [a, b, c] = location.hash.slice(1).split('/');
    if (a === 'new') return startNew(b === 'quote' ? 'quote' : 'invoice', c);
    if (a === 'edit') {
      const inv = invoices.find((i) => i.id === b);
      if (inv) return edit(JSON.parse(JSON.stringify(inv)), false);
      BW.toast("Couldn't find that one", '🤔');
    }
    cur = null;
    showList();
  }

  // ---------- status ----------
  const STATUS = {
    draft: ['Draft', '✏️', 'chip-grey'], sent: ['Waiting', '⏳', 'chip-sun'], overdue: ['Overdue', '⏰', 'chip-tomato'], paid: ['Paid', '✅', 'chip-mint'],
    qdraft: ['Draft', '✏️', 'chip-grey'], qsent: ['Sent', '📨', 'chip-sky'], accepted: ['Accepted', '🤝', 'chip-mint'], declined: ['Declined', '🙅', 'chip-grey'], expired: ['Expired', '⌛', 'chip-grey'],
    part: ['Part paid', '🌗', 'chip-sky'], cdraft: ['Draft', '✏️', 'chip-grey'], credit: ['Credit note', '↩️', 'chip-grape'],
  };
  function statusOf(i) {
    const today = BW.today();
    if (i.kind === 'quote') {
      if (i.status === 'accepted' || i.status === 'declined') return i.status;
      if (i.status === 'sent') return i.validUntil && i.validUntil < today ? 'expired' : 'qsent';
      return 'qdraft';
    }
    if (i.kind === 'credit') return i.status === 'draft' ? 'cdraft' : 'credit';
    if (i.status === 'paid') return 'paid';
    if (i.status === 'sent') return i.dueDate && i.dueDate < today ? 'overdue' : (i.payments && i.payments.length ? 'part' : 'sent');
    return 'draft';
  }
  const chip = (i) => { const [l, e, c] = STATUS[statusOf(i)]; return `<span class="chip ${c}">${e} ${l}</span>`; };
  const total = (i) => BW.invoiceTotals(i).total;
  const sum = (arr) => arr.reduce((a, i) => a + total(i), 0);
  const sumOpen = (arr) => arr.reduce((a, i) => a + BW.balanceOf(i), 0);
  const L = () => BW.docLabels((cur && cur.lang) || BW.settings.docLang);
  // Marking paid records whatever is still open as one last payment.
  function markPaid(i) {
    const left = BW.balanceOf(i);
    if (i.payments && i.payments.length && left > 0) i.payments.push({ date: BW.today(), amount: left });
    i.status = 'paid'; i.paidAt = BW.today(); if (!i.sentAt) i.sentAt = i.issueDate;
  }

  // ---------- list ----------
  function showList() {
    const inv = invoices.filter((i) => i.kind === 'invoice');
    const year = String(new Date().getFullYear());
    const waiting = inv.filter((i) => ['sent', 'part'].includes(statusOf(i)));
    const overdue = inv.filter((i) => statusOf(i) === 'overdue');
    const paidYear = inv.filter((i) => statusOf(i) === 'paid' && (i.paidAt || i.issueDate || '').startsWith(year));
    const TABS = [
      ['all', 'All', () => true],
      ['draft', 'Drafts', (i) => ['draft', 'qdraft'].includes(statusOf(i))],
      ['waiting', 'Waiting', (i) => ['sent', 'overdue', 'part'].includes(statusOf(i))],
      ['paid', 'Paid', (i) => statusOf(i) === 'paid'],
      ['quotes', 'Quotes', (i) => i.kind === 'quote'],
      ['repeat', '🔁 Repeating', (i) => i.repeat && i.repeat.on],
    ].concat(invoices.some((i) => i.kind === 'credit') ? [['credits', 'Credit notes', (i) => i.kind === 'credit']] : []);
    const q = query.toLowerCase();
    const filter = TABS.find((t) => t[0] === tab)[2];
    const shown = invoices.filter(filter)
      .filter((i) => !q || [i.number, i.client && i.client.name].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '') || (b.number || '').localeCompare(a.number || ''));

    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🧾</span> Invoices &amp; Quotes</h1>
          <p class="lead">${invoices.length ? 'Pick one up where you left off, or start a fresh one.' : 'Make your first one in about a minute. Seriously.'}</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          <a class="btn" href="#new/quote"><span class="emo">💬</span> New quote</a>
          <a class="btn btn-primary btn-big" href="#new/invoice"><span class="emo">＋</span> New invoice</a>
        </div>
      </div>
      ${invoices.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--sun)"><div class="k">⏳ Waiting to come in</div><div class="v" data-count="${sumOpen(waiting)}"></div><div class="s">${waiting.length} invoice${waiting.length === 1 ? '' : 's'} out there</div></div>
        <div class="card stat" style="--tint:var(--tomato)"><div class="k">⏰ Overdue</div><div class="v" data-count="${sumOpen(overdue)}"></div><div class="s">${overdue.length ? 'Time for a friendly nudge' : 'Nothing late. Lovely! 🌈'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">✅ Paid in ${year}</div><div class="v" data-count="${sum(paidYear)}"></div><div class="s">${paidYear.length} invoice${paidYear.length === 1 ? '' : 's'}. Nice work!</div></div>
      </div>
      <div class="toolbar">
        <div class="tabs" role="tablist">${TABS.map(([id, label, f]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}">${label} <span class="count">${invoices.filter(f).length}</span></button>`).join('')}</div>
        <label class="search"><input class="in" type="search" placeholder="Search number or client…" value="${esc(query)}" data-search aria-label="Search"></label>
      </div>
      <div class="list rise">${shown.map(row).join('') || `<div class="empty"><div class="big">🍃</div><h2>Nothing here</h2><p>${query ? 'No matches for that search.' : 'This list is empty for now.'}</p></div>`}</div>`
      : `<div class="card empty rise" style="margin-bottom:60px"><div class="big">🧾</div><h2>No invoices yet</h2>
          <p>Pick a client, type what you did, hit send. We do the maths, the numbering and the PDF.</p>
          <div class="row-flex" style="justify-content:center"><a class="btn btn-primary btn-big" href="#new/invoice">＋ Make my first invoice</a><a class="btn btn-big" href="#new/quote">💬 Or a quote</a></div></div>`}`;

    $$('[data-count]', main).forEach((el) => BW.countUp(el, Number(el.dataset.count), (v) => BW.money(v)));
    $$('[data-tab]', main).forEach((b) => b.onclick = () => { tab = b.dataset.tab; showList(); });
    $$('.row[data-id]', main).forEach((r) => {
      r.onclick = () => { location.hash = '#edit/' + r.dataset.id; };
      r.onkeydown = (e) => { if (e.key === 'Enter') r.click(); };
    });
    $$('[data-quickpaid]', main).forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const i = invoices.find((x) => x.id === b.dataset.quickpaid);
      markPaid(i);
      try { await BW.store.put('invoices', i); } catch (err) { return BW.error(err); }
      const r = b.getBoundingClientRect();
      BW.confetti({ x: r.left + r.width / 2, y: r.top });
      BW.toast(`Cha-ching! ${BW.money(total(i))} from ${esc(i.client ? i.client.name : 'your client')}`, '💰');
      BW.olafNudge('Want more customers like this one? Olaf, your AI marketing expert, plans how to find them.');
      showList();
    });
    const s = $('[data-search]', main);
    if (s) s.oninput = BW.debounce(() => { query = s.value; showList(); const n = $('[data-search]', main); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 150);
  }

  function row(i) {
    const st = statusOf(i);
    const when = i.kind === 'quote' ? `Valid until ${BW.fmtDate(i.validUntil)}` : i.kind === 'credit' ? 'Credit note' : st === 'paid' ? `Paid ${BW.fmtDate(i.paidAt)}` : `Due ${BW.fmtDate(i.dueDate)}`;
    const extra = [i.repeat && i.repeat.on ? `🔁 next ${BW.fmtDate(i.repeat.next, { day: 'numeric', month: 'short' })}` : '', i.reminders && i.reminders.length ? `⏰ reminded ${i.reminders.length}×` : '', st === 'part' || (st === 'overdue' && i.payments && i.payments.length) ? `${BW.money(BW.balanceOf(i), i.currency)} still open` : ''].filter(Boolean).join(' · ');
    return `<div class="row" data-id="${i.id}" tabindex="0">
      ${chip(i)}<span class="num">${esc(i.number)}</span>
      <span class="main"><b>${i.kind === 'quote' ? '💬 ' : ''}${esc(i.client ? i.client.name : 'No client yet')}</b><small>${BW.fmtDate(i.issueDate)} · ${when}${extra ? ' · ' + extra : ''}</small></span>
      ${['sent', 'overdue', 'part'].includes(st) ? `<button class="btn btn-mint quick" data-quickpaid="${i.id}" title="Mark as paid">💸 Paid</button>` : ''}
      <span class="amt">${BW.money(total(i), i.currency)}</span></div>`;
  }

  // ---------- creating and saving ----------
  const nextNumber = (kind, year) => BW.nextNumber(invoices, kind, year);
  const blankItem = () => ({ id: BW.uid(), desc: '', qty: 1, price: '', vat: BW.vatRates()[0] != null ? BW.vatRates()[0] : 21 });
  // withDefaults: also take the client's own payment terms and invoice language (when picking, not when refreshing).
  function setClient(inv, c, withDefaults) {
    inv.clientId = c.id;
    inv.client = {};
    for (const k of ['name', 'contact', 'email', 'address', 'postcode', 'city', 'country', 'vat']) inv.client[k] = c[k] || '';
    if (!withDefaults) return;
    inv.lang = c.lang || '';
    if (inv.kind === 'invoice' && BW.num(c.paymentDays)) inv.dueDate = BW.addDays(inv.issueDate, BW.num(c.paymentDays));
  }

  function startNew(kind, clientId) {
    const s = BW.settings, today = BW.today();
    const inv = { kind, number: nextNumber(kind, today.slice(0, 4)), status: 'draft', issueDate: today, currency: s.currency, items: [blankItem()], notes: '', reverseCharge: false };
    if (kind === 'invoice') inv.dueDate = BW.addDays(today, s.paymentDays || 14); else inv.validUntil = BW.addDays(today, s.quoteDays || 30);
    const c = clientId && clients.find((x) => x.id === clientId);
    if (c) setClient(inv, c, true);
    edit(inv, true);
  }

  function edit(inv, fresh) {
    cur = inv; isNew = fresh; dirty = fresh && !!inv.clientId;
    // Drafts follow the Client Book; once sent, an invoice keeps the address it was sent to.
    if (!fresh && inv.status === 'draft' && inv.clientId) {
      const c = clients.find((x) => x.id === inv.clientId);
      if (c) setClient(inv, c);
    }
    drawEditor();
    if (dirty) flush();
  }

  const hasContent = (i) => !!i.clientId || (i.items || []).some((it) => it.desc || BW.num(it.price));
  const saveSoon = BW.debounce(() => flush(), 600);
  function changed() { dirty = true; setSaved('Saving…'); saveSoon(); refreshChecks(); }
  async function flush() {
    if (!cur || !dirty) return;
    if (isNew && !hasContent(cur)) return;
    dirty = false;
    try {
      await BW.store.put('invoices', cur);
      const copy = JSON.parse(JSON.stringify(cur));
      const at = invoices.findIndex((x) => x.id === cur.id);
      if (at >= 0) invoices[at] = copy; else invoices.push(copy);
      if (isNew) { isNew = false; history.replaceState(null, '', '#edit/' + cur.id); }
      setSaved(BW.store.kind === 'folder' ? `Saved to ${esc(BW.store.where)} ✓` : 'Saved ✓');
    } catch (e) { dirty = true; BW.error(e); }
  }
  const saveNow = async () => { dirty = true; await flush(); };
  function setSaved(t) { const el = $('[data-saved]', main); if (el) el.innerHTML = t; }

  // ---------- the editor ----------
  function drawEditor() {
    const s = BW.settings, inv = cur, Lb = L(), q = inv.kind === 'quote', cr = inv.kind === 'credit';
    const accent = s.brandColor || '#FF6B4A';
    main.innerHTML = `
      <div class="editor">
        <div>
          <a class="btn btn-ghost back" href="#">← All invoices &amp; quotes</a>
          <div class="paper" style="--doc:${esc(accent)};--on-doc:${BW.isLight(accent) ? '#1E1B2E' : '#fff'}">
            <div class="p-top">
              <div class="p-brand">${s.logo ? `<img src="${s.logo}" alt="${esc(s.businessName)}">` : `<div class="p-biz">${esc(s.businessName)}</div>`}</div>
              <div class="p-title"><div class="p-kind">${q ? Lb.quote : cr ? Lb.credit : Lb.invoice}</div>
                <label class="p-num">${Lb.no}<input data-f="number" value="${esc(inv.number)}" aria-label="Number"></label></div>
            </div>
            <div class="p-parties">
              <div class="p-from"><span class="p-label">${Lb.from}</span>${fromHtml(s)}</div>
              <div class="p-to"><span class="p-label">${q ? Lb.quoteFor : Lb.billTo}</span><div data-client></div></div>
              <div class="p-dates">
                <label><span class="p-label">${Lb.date}</span><input type="date" data-f="issueDate" value="${inv.issueDate || ''}"></label>
                <label><span class="p-label">${q ? Lb.valid : Lb.due}</span><input type="date" data-f="${q ? 'validUntil' : 'dueDate'}" value="${(q ? inv.validUntil : inv.dueDate) || ''}"></label>
                <div class="quick-days">${[7, 14, 30].map((n) => `<button type="button" data-days="${n}" title="${n} days after the invoice date">+${n} days</button>`).join('')}</div>
              </div>
            </div>
            <div class="p-ihead"><span>${Lb.desc}</span><span>${Lb.qty}</span><span>${Lb.price}</span><span>${Lb.vat}</span><span>${Lb.amount}</span><span></span></div>
            <div data-items></div>
            <button class="add-line" data-add>＋ Add a line</button>
            <div class="p-bottom">
              <textarea data-f="notes" rows="3" placeholder="Add a note (optional). For example: Thanks for the lovely project!">${esc(inv.notes)}</textarea>
              <div class="p-totals" data-totals></div>
            </div>
            <div class="p-pay" data-pay></div>
          </div>
        </div>
        <aside class="side">
          <div class="card side-card">
            <div class="row-flex"><span data-status></span><div class="spacer"></div><span class="saved" data-saved>${isNew ? 'Not saved yet' : ''}</span></div>
            <ol class="checklist">
              <li data-ck="client"><i>1</i>Pick who it's for</li>
              <li data-ck="items"><i>2</i>Add what you did</li>
              <li data-ck="sent"><i>3</i>${q ? 'Send it off' : 'Send it, get paid'}</li>
            </ol>
            <div class="big-total"><small>Total</small><b data-bigtotal></b></div>
          </div>
          <div class="side-actions" data-actions></div>
          <div class="card side-card more" data-more></div>
          <label class="rc"><input type="checkbox" data-rc ${inv.reverseCharge ? 'checked' : ''}><span>Business client in another EU country (VAT reverse-charged)</span></label>
        </aside>
      </div>`;

    drawClient(); drawItems(); drawPay(); drawSide();

    $$('[data-f]', main).forEach((el) => el.addEventListener('input', () => {
      cur[el.dataset.f] = el.value;
      if (el.dataset.f === 'issueDate') drawPay();
      changed();
    }));
    $$('[data-days]', main).forEach((b) => b.onclick = () => {
      const k = q ? 'validUntil' : 'dueDate';
      cur[k] = BW.addDays(cur.issueDate || BW.today(), Number(b.dataset.days));
      $(`[data-f="${k}"]`, main).value = cur[k];
      drawPay(); changed();
    });
    $('[data-add]', main).onclick = () => addLine();
    $('[data-rc]', main).onchange = (e) => { cur.reverseCharge = e.target.checked; drawItems(); changed(); };
  }

  function fromHtml(s) {
    const lines = [s.address, [s.postcode, s.city].filter(Boolean).join(' '), s.email].filter(Boolean);
    return `<b>${esc(s.businessName)}</b>${lines.map((l) => `<div>${esc(l)}</div>`).join('')}
      ${lines.length ? '' : '<button class="link" data-settings>＋ Add your address</button>'}`;
  }

  function drawClient() {
    const slot = $('[data-client]', main), c = cur.client;
    slot.innerHTML = c
      ? `<div class="p-client"><b>${esc(c.name)}</b>${[c.contact, c.address, [c.postcode, c.city].filter(Boolean).join(' '), c.country, c.vat && 'VAT ' + c.vat].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('')}
         <button class="link" data-pick>Change</button></div>`
      : '<button class="pick-client pulse" data-pick><span class="emo">👉</span> Who\'s this for?<br><u>Pick a client</u></button>';
    $('[data-pick]', slot).onclick = pickClient;
    const set = $('[data-settings]', main); if (set) set.onclick = BW.openSettings;
  }

  function drawItems() {
    const rates = BW.vatRates();
    const box = $('[data-items]', main);
    box.innerHTML = cur.items.map((it) => {
      const opts = rates.includes(BW.num(it.vat)) ? rates : rates.concat(BW.num(it.vat));
      return `<div class="item" data-id="${it.id}">
        <textarea rows="1" data-i="desc" placeholder="What did you do? e.g. Logo design" aria-label="Description">${esc(it.desc)}</textarea>
        <input data-i="qty" inputmode="decimal" value="${esc(it.qty)}" placeholder="Qty" aria-label="Quantity">
        <input data-i="price" inputmode="decimal" value="${esc(it.price)}" placeholder="0.00" aria-label="Price">
        <select data-i="vat" aria-label="VAT" ${cur.reverseCharge ? 'disabled' : ''}>${opts.map((r) => `<option value="${r}" ${r === BW.num(it.vat) ? 'selected' : ''}>${r}%</option>`).join('')}</select>
        <div class="i-amt" data-amt></div>
        <div class="i-tools"><button type="button" class="i-star" data-star aria-label="Save to my products and services" title="Save to my products & services">☆</button><button type="button" class="i-del" data-del aria-label="Remove line" title="Remove line">✕</button></div>
      </div>`;
    }).join('');
    $$('textarea', box).forEach(grow);
    box.oninput = (e) => {
      const el = e.target, it = cur.items.find((x) => x.id === el.closest('.item').dataset.id);
      it[el.dataset.i] = el.dataset.i === 'vat' ? BW.num(el.value) : el.value;
      if (el.tagName === 'TEXTAREA') { grow(el); suggest(el, it); }
      updateTotals(); changed();
    };
    box.onchange = (e) => { if (e.target.dataset.i) box.oninput(e); };
    box.addEventListener('focusout', () => setTimeout(() => { const sg = $('.suggest', main); if (sg && !sg.contains(document.activeElement)) sg.remove(); }, 150));
    box.onclick = (e) => {
      const star = e.target.closest('[data-star]');
      if (star) { saveToCatalog(cur.items.find((x) => x.id === star.closest('.item').dataset.id)); return; }
      if (!e.target.closest('[data-del]')) return;
      const id = e.target.closest('.item').dataset.id;
      cur.items = cur.items.filter((x) => x.id !== id);
      if (!cur.items.length) cur.items.push(blankItem());
      drawItems(); changed();
    };
    // Enter in the last price box starts a new line, like a spreadsheet.
    box.onkeydown = (e) => {
      if (e.key === 'Enter' && e.target.dataset.i === 'price') { e.preventDefault(); addLine(); }
    };
    updateTotals();
  }
  function addLine() {
    const last = cur.items[cur.items.length - 1];
    const it = blankItem(); if (last) it.vat = last.vat;
    cur.items.push(it);
    drawItems();
    $(`.item[data-id="${it.id}"] textarea`, main).focus();
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

  // ---------- products & services (type-ahead on invoice lines) ----------
  function suggest(el, it) {
    const old = $('.suggest', main); if (old) old.remove();
    const q = el.value.trim().toLowerCase();
    if (q.length < 2 || !catalog.length) return;
    const hits = catalog.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 5);
    if (!hits.length) return;
    const box = BW.html(`<div class="suggest" role="listbox">${hits.map((c) => `<button type="button" data-cat="${c.id}"><span>${esc(c.name)}</span><b>${BW.money(BW.num(c.price), cur.currency)}</b></button>`).join('')}</div>`);
    el.closest('.item').append(box);
    box.onclick = (e) => {
      const c = catalog.find((x) => x.id === e.target.closest('[data-cat]').dataset.cat);
      Object.assign(it, { desc: c.name, price: c.price, vat: c.vat != null ? c.vat : it.vat });
      box.remove(); drawItems(); changed();
      BW.toast(`Added ${esc(c.name)}`, '📚');
    };
  }
  async function saveToCatalog(it) {
    if (!it.desc || !BW.num(it.price)) return BW.toast('Fill in a description and a price first', '✏️');
    const same = catalog.find((c) => c.name.toLowerCase() === it.desc.trim().toLowerCase());
    const rec = Object.assign(same || {}, { name: it.desc.trim(), price: BW.num(it.price), vat: BW.num(it.vat) });
    try { await BW.store.put('catalog', rec); } catch (e) { return BW.error(e); }
    if (!same) catalog.push(rec);
    BW.toast(`Saved. Type “${esc(rec.name.slice(0, 20))}” on any invoice to add it again.`, '⭐');
  }
  function manageCatalog() {
    const box = document.createElement('div');
    const draw = () => {
      box.innerHTML = catalog.length ? `<div class="list">${catalog.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `
        <div class="row" style="cursor:default"><span class="main"><b>${esc(c.name)}</b><small>${BW.num(c.vat)}% VAT</small></span><span class="amt">${BW.money(BW.num(c.price))}</span>
        <button class="icon-btn" data-rm="${c.id}" aria-label="Remove ${esc(c.name)}">🗑️</button></div>`).join('')}</div>`
        : '<p class="muted">Nothing saved yet. Click the ☆ next to any invoice line to save it here, then type a few letters on a new invoice to add it in one go.</p>';
      $$('[data-rm]', box).forEach((b) => b.onclick = async () => {
        const c = catalog.find((x) => x.id === b.dataset.rm);
        catalog = catalog.filter((x) => x !== c); draw();
        await BW.removeWithUndo('catalog', c, esc(c.name), (back) => { if (back) { catalog.push(back); draw(); } });
      });
    };
    draw();
    BW.modal({ title: '📚 My products & services', body: box, actions: [{ label: 'Done', kind: 'primary' }] });
  }

  function updateTotals() {
    const t = BW.invoiceTotals(cur), cy = cur.currency, Lb = L();
    const paid = BW.paymentsOf(cur).reduce((a, p) => a + BW.num(p.amount), 0);
    $$('.item', main).forEach((row) => {
      const it = cur.items.find((x) => x.id === row.dataset.id);
      $('[data-amt]', row).textContent = BW.money(BW.num(it.qty) * BW.num(it.price), cy);
    });
    $('[data-totals]', main).innerHTML = `
      <div class="t"><span>${Lb.subtotal}</span><span>${BW.money(t.lines, cy)}</span></div>
      <div class="t disc"><span>${cur.discount != null && cur.discount !== '' ? `${Lb.discount.replace(/\s*\{p\}%/, '')}<input data-disc inputmode="decimal" value="${esc(cur.discount)}" aria-label="Discount percentage">%` : '<button class="link" data-adddisc>＋ Add a discount</button>'}</span><span>${t.discount ? '- ' + BW.money(t.discount, cy) : ''}</span></div>
      ${t.vat.map((v) => `<div class="t"><span>${Lb.vatLine.replace('{r}', v.rate)}</span><span>${BW.money(v.amount, cy)}</span></div>`).join('')}
      ${cur.reverseCharge ? `<div class="t"><span>${Lb.reverse}</span><span>${BW.money(0, cy)}</span></div>` : ''}
      <div class="grand"><span>${Lb.total}</span><span>${BW.money(t.total, cy)}</span></div>
      ${paid && cur.kind === 'invoice' && BW.balanceOf(cur) > 0 ? `<div class="t"><span>${Lb.paid}</span><span>- ${BW.money(paid, cy)}</span></div><div class="t" style="font-weight:850;color:#1E1B2E"><span>${Lb.due2}</span><span>${BW.money(BW.balanceOf(cur), cy)}</span></div>` : ''}`;
    const big = $('[data-bigtotal]', main); if (big) big.textContent = BW.money(t.total, cy);
    const add = $('[data-adddisc]', main);
    if (add) add.onclick = () => { cur.discount = 10; updateTotals(); changed(); const d = $('[data-disc]', main); d.focus(); d.select(); };
    const di = $('[data-disc]', main);
    if (di) di.oninput = BW.debounce(() => { cur.discount = di.value; const pos = di.selectionStart; updateTotals(); changed(); const n = $('[data-disc]', main); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } if (!di.value) { delete cur.discount; updateTotals(); } }, 350);
  }

  function drawPay() {
    const s = BW.settings, Lb = L(), el = $('[data-pay]', main), lang = cur.lang || s.docLang;
    const date = (iso) => BW.fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' }, lang);
    if (cur.kind === 'quote') { el.textContent = Lb.validNote.replace('{valid}', date(cur.validUntil)); return; }
    if (cur.kind === 'credit') { el.textContent = Lb.creditFor.replace('{number}', cur.creditForNumber || ''); return; }
    if (!s.iban) { el.innerHTML = '<button class="link" data-settings>＋ Add your bank details so clients know where to pay</button>'; $('[data-settings]', el).onclick = BW.openSettings; return; }
    const balance = BW.balanceOf(cur);
    const text = Lb.pay.replace('{total}', BW.money(balance, cur.currency, lang)).replace('{due}', date(cur.dueDate))
      .replace('{iban}', s.iban).replace('{name}', s.businessName).replace('{number}', cur.number);
    let qr = '';
    if ((cur.currency || s.currency) === 'EUR' && balance > 0 && BW.qr) {
      try { qr = `<div class="qr" title="${esc(Lb.scan)}">${BW.qr.svg(BW.qr.epc({ name: s.businessName, iban: s.iban, bic: s.bic, amount: balance, text: `${Lb.invoice} ${cur.number}` }), 2)}<small>${esc(Lb.scan)}</small></div>`; } catch (e) { /* no code, just the text */ }
    }
    el.innerHTML = `<div class="pay-row"><div>${esc(text)}${cur.payLink ? `<div style="margin-top:8px"><b>${esc(Lb.payOnline)}</b> <a href="${esc(/^https?:/.test(cur.payLink) ? cur.payLink : 'https://' + cur.payLink)}" target="_blank" rel="noopener">${esc(cur.payLink.replace(/^https?:\/\//, ''))}</a></div>` : ''}</div>${qr}</div>`;
  }

  function refreshChecks() {
    const ck = (k, on) => { const li = $(`[data-ck="${k}"]`, main); if (li) { li.classList.toggle('done', on); $('i', li).textContent = on ? '✓' : li.dataset.n || $('i', li).textContent; } };
    $$('.checklist li', main).forEach((li, n) => { li.dataset.n = n + 1; });
    ck('client', !!cur.client);
    ck('items', cur.items.some((it) => it.desc && BW.num(it.price)));
    ck('sent', cur.status !== 'draft');
    if (cur.kind === 'invoice') drawPay();
  }

  function drawSide() {
    $('[data-status]', main).innerHTML = chip(cur);
    const st = statusOf(cur), q = cur.kind === 'quote';
    const b = [];
    b.push(`<button class="btn btn-primary btn-big btn-block" data-act="email"><span class="emo">✉️</span> ${cur.status === 'draft' ? 'Send it' : 'Send it again'}</button>`);
    b.push('<button class="btn btn-block" data-act="pdf"><span class="emo">📄</span> Save as PDF</button>');
    if (cur.kind === 'credit') {
      if (cur.creditFor) b.push(`<a class="btn btn-block" href="#edit/${cur.creditFor}">🧾 Open the original invoice</a>`);
    } else if (!q) {
      if (st !== 'paid') b.push('<button class="btn btn-mint btn-block" data-act="paid"><span class="emo">💸</span> Mark as paid</button>');
      else b.push('<button class="btn btn-block" data-act="unpaid">↩️ Not paid after all</button>');
      if (['sent', 'part', 'overdue'].includes(st)) b.push('<button class="btn btn-block" data-act="part"><span class="emo">🌗</span> They paid part of it</button>');
      if (st === 'overdue') b.push('<button class="btn btn-sun btn-block" data-act="remind"><span class="emo">⏰</span> Send a reminder</button>');
      if (st === 'draft') b.push('<button class="btn btn-ghost btn-block" data-act="sent">📨 I sent it another way</button>');
    } else {
      if (cur.status === 'accepted' && cur.invoiceId) b.push(`<a class="btn btn-mint btn-block" href="#edit/${cur.invoiceId}">🧾 Go to the invoice</a>`);
      else b.push('<button class="btn btn-mint btn-block" data-act="accept"><span class="emo">🤝</span> They said yes! Make the invoice</button>');
      if (cur.status !== 'declined' && cur.status !== 'accepted') b.push('<button class="btn btn-ghost btn-block" data-act="decline">🙅 They said no</button>');
    }
    b.push(`<div class="row-flex" style="justify-content:center"><button class="btn btn-ghost" data-act="dup">📑 Duplicate</button>${cur.kind === 'invoice' && cur.status !== 'draft' ? '<button class="btn btn-ghost" data-act="credit">↩️ Credit note</button>' : ''}<button class="btn btn-ghost btn-danger" data-act="del">🗑️ Delete</button></div>`);
    const box = $('[data-actions]', main);
    box.innerHTML = b.join('');
    box.onclick = (e) => { const a = e.target.closest('[data-act]'); if (a) ACTIONS[a.dataset.act](a); };
    drawMore();
    refreshChecks();
  }

  // Repeat schedule, pay-now link and payments received, under the action buttons.
  function drawMore() {
    const box = $('[data-more]', main);
    if (cur.kind === 'quote' || cur.kind === 'credit') { box.hidden = true; return; }
    const r = cur.repeat || {};
    const pays = cur.payments || [];
    box.innerHTML = `
      <label class="toggle"><input type="checkbox" data-rep ${r.on ? 'checked' : ''}><span><b>🔁 Repeat this invoice</b><small>For retainers and monthly work. A new draft appears by itself.</small></span></label>
      ${r.on ? `<div class="grid-2" style="margin-top:10px"><label class="field"><span>Every</span><select class="in" data-every>${[['week', 'week'], ['month', 'month'], ['quarter', '3 months'], ['year', 'year']].map(([k, l]) => `<option value="${k}" ${r.every === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Next one</span><input class="in" type="date" data-next value="${esc(r.next || '')}"></label></div>` : ''}
      <label class="field" style="margin-top:14px"><span>💳 Pay-now link <small class="faint">(optional)</small></span><input class="in" data-paylink placeholder="Tikkie, Mollie or Stripe link" value="${esc(cur.payLink || '')}"></label>
      ${pays.length ? `<div style="margin-top:14px"><b>💶 Payments received</b>${pays.map((p, i) => `<div class="pay-line"><span>${BW.fmtDate(p.date)}</span><span>${BW.money(BW.num(p.amount), cur.currency)}</span><button class="icon-btn" data-unpay="${i}" aria-label="Remove this payment">✕</button></div>`).join('')}</div>` : ''}
      ${cur.reminders && cur.reminders.length ? `<p class="faint" style="margin-top:10px;font-size:.82rem">⏰ Reminders sent: ${cur.reminders.map((x) => BW.fmtDate(x.date, { day: 'numeric', month: 'short' })).join(', ')}</p>` : ''}
      <button class="link" data-catalog style="margin-top:12px">📚 My products &amp; services</button>`;
    box.hidden = false;
    $('[data-rep]', box).onchange = (e) => {
      cur.repeat = Object.assign({ every: 'month', next: BW.addPeriod(cur.issueDate || BW.today(), 'month') }, cur.repeat, { on: e.target.checked });
      changed(); drawMore();
      if (e.target.checked) BW.toast(`Next copy on ${BW.fmtDate(cur.repeat.next)}. It waits as a draft for you to check.`, '🔁');
    };
    const ev = $('[data-every]', box); if (ev) ev.onchange = () => { cur.repeat.every = ev.value; cur.repeat.next = BW.addPeriod(cur.issueDate || BW.today(), ev.value); changed(); drawMore(); };
    const nx = $('[data-next]', box); if (nx) nx.onchange = () => { cur.repeat.next = nx.value; changed(); };
    const pl = $('[data-paylink]', box); pl.oninput = BW.debounce(() => { cur.payLink = pl.value.trim(); changed(); drawPay(); }, 400);
    $$('[data-unpay]', box).forEach((b) => b.onclick = () => { cur.payments.splice(Number(b.dataset.unpay), 1); if (cur.status === 'paid') cur.status = 'sent'; changed(); drawSide(); updateTotals(); drawPay(); });
    $('[data-catalog]', box).onclick = manageCatalog;
  }

  // ---------- picking a client ----------
  function pickClient() {
    const box = document.createElement('div');
    const m = BW.modal({ title: '👥 Who is it for?', body: box });
    const listView = () => {
      box.innerHTML = `${clients.length ? `<label class="search"><input class="in" type="search" placeholder="Search your clients…" data-q aria-label="Search clients"></label><div class="pick-list" data-list></div><div class="or">or</div>` : '<p class="muted" style="margin-bottom:14px">Your Client Book is empty. Add your first client right here.</p>'}
        <button class="btn btn-block ${clients.length ? '' : 'btn-primary'}" data-newc>＋ Add a new client</button>`;
      const list = $('[data-list]', box);
      const fill = (q) => {
        if (!list) return;
        const found = clients.filter((c) => !q || [c.name, c.contact, c.city].join(' ').toLowerCase().includes(q.toLowerCase()))
          .sort((a, b) => a.name.localeCompare(b.name));
        list.innerHTML = found.map((c) => `<button data-c="${c.id}"><span class="avatar" style="--av:${BW.colorFor(c.name)}">${esc(BW.initials(c.name))}</span>
          <span><b>${esc(c.name)}</b><br><small>${esc([c.contact, c.city].filter(Boolean).join(' · ') || 'No details yet')}</small></span></button>`).join('')
          || '<p class="muted" style="text-align:center">No one by that name. Add them below 👇</p>';
      };
      fill('');
      const qi = $('[data-q]', box);
      if (qi) { qi.oninput = () => fill(qi.value); qi.focus(); }
      if (list) list.onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) choose(clients.find((c) => c.id === b.dataset.c)); };
      $('[data-newc]', box).onclick = formView;
    };
    const formView = () => {
      const c = {};
      box.innerHTML = `<form data-form>${BW.fieldsHtml(BW.clientFields.filter((f) => f.k !== 'notes'), c)}</form>
        <div class="row-flex" style="margin-top:18px"><button class="btn btn-ghost" data-back>← Back</button><div class="spacer"></div><button class="btn btn-primary" data-save>Save and use</button></div>`;
      const form = $('[data-form]', box);
      $('[name="name"]', form).focus();
      $('[data-back]', box).onclick = listView;
      const save = async () => {
        BW.readFields(form, c);
        if (!c.name) { const n = $('[name="name"]', form); n.classList.add('shake'); n.focus(); setTimeout(() => n.classList.remove('shake'), 500); return; }
        try { await BW.store.put('clients', c); clients.push(c); BW.toast(`${esc(c.name)} added to your Client Book`, '📇'); choose(c); }
        catch (e) { BW.error(e); }
      };
      $('[data-save]', box).onclick = save;
      form.onsubmit = (e) => { e.preventDefault(); save(); };
    };
    const choose = (c) => { setClient(cur, c, true); m.close(); drawEditor(); changed(); };
    listView();
  }

  // ---------- actions ----------
  function ready() {
    const nudge = (k, msg) => {
      const li = $(`[data-ck="${k}"]`, main); li.classList.add('shake'); setTimeout(() => li.classList.remove('shake'), 500);
      BW.toast(msg, '👉');
      return false;
    };
    if (!cur.client) { $('[data-pick]', main).focus(); return nudge('client', 'Pick who it’s for first'); }
    if (!cur.items.some((it) => it.desc && BW.num(it.price))) { const t = $('.item textarea', main); if (t) t.focus(); return nudge('items', 'Add at least one line with a price'); }
    return true;
  }

  async function makePdf() {
    const blob = BW.pdf.invoice(cur, Object.assign({}, BW.settings, cur.lang ? { docLang: cur.lang } : {}));
    const year = (cur.issueDate || BW.today()).slice(0, 4);
    const name = BW.fileSafe(`${cur.number} ${cur.client ? cur.client.name : ''}`) + '.pdf';
    const r = await BW.store.writeFile(`${{ quote: 'Quotes', credit: 'Credit notes' }[cur.kind] || 'Invoices'}/${year}/${name}`, blob);
    return Object.assign({ blob, name }, r);
  }

  function emailText() {
    const s = BW.settings, lang = cur.lang || s.docLang, nl = lang === 'nl', Lb = L(), c = cur.client;
    const first = (c.contact || '').trim().split(/\s+/)[0];
    const amount = BW.money(cur.kind === 'invoice' ? BW.balanceOf(cur) : total(cur), cur.currency, lang);
    const date = (iso) => BW.fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' }, lang);
    const sign = [s.ownerName, s.businessName].filter((x, i, a) => x && a.indexOf(x) === i).join('\n');
    const subject = `${cur.kind === 'quote' ? Lb.quote : cur.kind === 'credit' ? Lb.credit : Lb.invoice} ${cur.number} – ${s.businessName}`;
    let body;
    if (nl) {
      body = `${first ? 'Hoi ' + first : 'Hallo'},\n\n` + (cur.kind === 'quote'
        ? `In de bijlage vind je offerte ${cur.number} van ${amount}. De offerte is geldig tot ${date(cur.validUntil)}. Vragen? Laat het gerust weten!\n\nGroet,\n`
        : `In de bijlage vind je factuur ${cur.number} van ${amount}, te betalen vóór ${date(cur.dueDate)}.${s.iban ? `\nJe kunt het bedrag overmaken naar ${s.iban} t.n.v. ${s.businessName}, onder vermelding van ${cur.number}.` : ''}\n\nAlvast bedankt!\n\n`) + sign;
    } else {
      body = `${first ? 'Hi ' + first : 'Hi there'},\n\n` + (cur.kind === 'quote'
        ? `Please find attached quote ${cur.number} for ${amount}. It's valid until ${date(cur.validUntil)}. Any questions? Just reply to this email.\n\nBest wishes,\n`
        : `Please find attached invoice ${cur.number} for ${amount}, due on ${date(cur.dueDate)}.${s.iban ? `\nYou can transfer it to ${s.iban} (${s.businessName}), mentioning ${cur.number}.` : ''}\n\nThanks so much!\n\n`) + sign;
    }
    return { subject, body };
  }

  function mailButtons(to, subject, body) {
    const enc = encodeURIComponent;
    return `<div class="row-flex"><a class="btn btn-primary" data-mail href="https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}" target="_blank" rel="noopener">Gmail</a>
      <a class="btn" data-mail href="https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}" target="_blank" rel="noopener">Outlook</a>
      <a class="btn" data-mail href="mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}">Mail app</a></div>`;
  }

  async function copyText(text) {
    BW.toast(await BW.copy(text) ? 'Copied!' : 'Could not copy. Select the text and copy it yourself.', '📋');
  }

  const ACTIONS = {
    async pdf() {
      if (!ready()) return;
      await saveNow();
      try { const r = await makePdf(); BW.toast(r.saved ? `Saved to ${esc(r.where)}` : `${esc(r.name)} is in your Downloads`, '📄'); }
      catch (e) { BW.error(e); }
    },
    async email() {
      if (!ready()) return;
      let r;
      try { r = await makePdf(); } catch (e) { return BW.error(e); }
      if (cur.status === 'draft') { cur.status = 'sent'; cur.sentAt = BW.today(); }
      await saveNow(); drawSide();
      const { subject, body } = emailText(), to = cur.client.email || '', enc = encodeURIComponent;
      const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
      const outlook = `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
      const mailto = `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
      const m = BW.modal({
        title: '✉️ Ready to send!',
        body: `<ol class="send-steps">
          <li class="done"><i>✓</i><div><b>Your PDF is ready</b><small>${r.saved ? `Saved in <b>${esc(r.where)}</b>` : `<b>${esc(r.name)}</b> is in your Downloads folder`}</small>
            ${r.saved ? '<button class="link" data-dl>Also put a copy in my Downloads</button>' : ''}</div></li>
          <li><i>2</i><div><b>Open your email</b><small>We wrote the message for you${to ? '' : '. Add their email address, theirs isn’t in your Client Book yet'}.</small>
            <div class="row-flex"><a class="btn btn-primary" href="${gmail}" target="_blank" rel="noopener">Gmail</a><a class="btn" href="${outlook}" target="_blank" rel="noopener">Outlook</a><a class="btn" href="${mailto}">Mail app</a></div></div></li>
          <li><i>3</i><div><b>Attach the PDF and hit send</b><small>Drag <b>${esc(r.name)}</b> into the email. That’s it!</small></div></li>
        </ol>
        <details style="margin-top:20px"><summary style="cursor:pointer;font-weight:750">See the message</summary>
          <div class="mail-preview"><b>${esc(subject)}</b>\n\n${esc(body)}</div><button class="btn" data-copy>📋 Copy message</button></details>`,
        actions: [{ label: 'Done 👍', kind: 'primary' }],
      });
      const dl = $('[data-dl]', m.el); if (dl) dl.onclick = () => BW.download(r.blob, r.name);
      $('[data-copy]', m.el).onclick = () => copyText(body);
    },
    async paid(btn) {
      markPaid(cur);
      await saveNow(); drawSide(); updateTotals(); drawPay();
      const r = btn.getBoundingClientRect();
      BW.confetti({ x: r.left + r.width / 2, y: r.top });
      BW.toast(`Cha-ching! ${BW.money(total(cur), cur.currency)} in the bag`, '💰');
      BW.olafNudge('Want more customers like this one? Olaf, your AI marketing expert, plans how to find them.');
    },
    async unpaid() { cur.status = 'sent'; delete cur.paidAt; if (cur.payments && cur.payments.length) cur.payments.pop(); await saveNow(); drawSide(); updateTotals(); drawPay(); },
    part() {
      const left = BW.balanceOf(cur);
      BW.modal({
        title: '🌗 They paid part of it',
        body: `<div class="grid-2"><label class="field"><span>How much came in?</span><input class="in" inputmode="decimal" data-amt placeholder="${left.toFixed(2)}"></label>
          <label class="field"><span>When?</span><input class="in" type="date" data-date value="${BW.today()}"></label></div>
          <p class="muted" style="margin-top:10px">Still open now: <b>${BW.money(left, cur.currency)}</b>. Deposits work the same way.</p>`,
        actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Save payment', kind: 'primary', onClick: async () => {
          const amt = BW.num($('.modal [data-amt]').value);
          if (!(amt > 0)) { BW.toast('Fill in an amount', '✏️'); return false; }
          if (!cur.payments || !cur.payments.length) cur.payments = [];
          cur.payments.push({ date: $('.modal [data-date]').value || BW.today(), amount: Math.min(amt, left) });
          if (cur.status === 'draft') cur.status = 'sent';
          const done = BW.balanceOf(cur) <= 0;
          if (done) { cur.status = 'paid'; cur.paidAt = BW.today(); }
          await saveNow(); drawSide(); updateTotals(); drawPay();
          if (done) { BW.confetti(); BW.toast('Paid in full. Cha-ching!', '💰'); } else BW.toast(`${BW.money(BW.balanceOf(cur), cur.currency)} still to come`, '🌗');
        } }],
      });
    },
    remind() {
      const s = BW.settings, lang = cur.lang || s.docLang, nl = lang === 'nl', c = cur.client || {};
      const first = (c.contact || '').trim().split(/\s+/)[0];
      const late = Math.max(0, Math.round((Date.parse(BW.today()) - Date.parse(cur.dueDate)) / 864e5));
      const amount = BW.money(BW.balanceOf(cur), cur.currency, lang), due = BW.fmtDate(cur.dueDate, { day: 'numeric', month: 'long' }, lang);
      const sign = [s.ownerName, s.businessName].filter((x, i, a) => x && a.indexOf(x) === i).join('\n');
      const pay = s.iban ? (nl ? `\n\nJe kunt het bedrag overmaken naar ${s.iban} t.n.v. ${s.businessName}, onder vermelding van ${cur.number}.` : `\n\nYou can transfer it to ${s.iban} (${s.businessName}), mentioning ${cur.number}.`) : '';
      const hi = nl ? (first ? `Hoi ${first},` : 'Hallo,') : (first ? `Hi ${first},` : 'Hi there,');
      const TONES = nl ? {
        friendly: ['Vriendelijke herinnering', `${hi}\n\nEven een vriendelijk seintje: factuur ${cur.number} van ${amount} stond open tot ${due}. Misschien is hij tussen wal en schip geraakt?${pay}\n\nAl betaald? Dan mag je dit bericht negeren. Dank je wel!\n\n${sign}`],
        firm: ['Herinnering: factuur verlopen', `${hi}\n\nFactuur ${cur.number} van ${amount} is inmiddels ${late} dagen over de betaaltermijn. Wil je hem deze week voldoen?${pay}\n\nLaat het gerust weten als er iets niet klopt.\n\n${sign}`],
        final: ['Laatste herinnering', `${hi}\n\nOndanks eerdere herinneringen staat factuur ${cur.number} van ${amount} nog open (${late} dagen te laat). Ik vraag je het bedrag binnen 7 dagen te betalen. Daarna moet ik helaas verdere stappen zetten.${pay}\n\n${sign}`],
      } : {
        friendly: ['Friendly reminder', `${hi}\n\nJust a friendly nudge: invoice ${cur.number} for ${amount} was due on ${due}. It may have slipped through the cracks.${pay}\n\nAlready paid? Then please ignore this, and thank you!\n\n${sign}`],
        firm: ['Reminder: invoice overdue', `${hi}\n\nInvoice ${cur.number} for ${amount} is now ${late} days past its due date. Could you settle it this week?${pay}\n\nIf anything is wrong with it, just let me know.\n\n${sign}`],
        final: ['Final reminder', `${hi}\n\nDespite earlier reminders, invoice ${cur.number} for ${amount} is still open (${late} days late). Please pay within 7 days, after which I will have to take further steps.${pay}\n\n${sign}`],
      };
      let tone = (cur.reminders || []).length >= 2 ? 'final' : (cur.reminders || []).length ? 'firm' : 'friendly';
      const box = document.createElement('div');
      const draw = () => {
        const [subj, body] = TONES[tone];
        const subject = `${subj}: ${cur.number}`;
        box.innerHTML = `<div class="choice-chips" style="margin-bottom:14px">${[['friendly', '🙂 Friendly'], ['firm', '😐 Firm'], ['final', '😤 Final']].map(([k, l]) => `<button type="button" data-tone="${k}" aria-pressed="${tone === k}">${l}</button>`).join('')}</div>
          <div class="mail-preview"><b>${esc(subject)}</b>\n\n${esc(body)}</div>
          <p class="muted" style="margin:8px 0 12px">Tip: attach the invoice PDF again. ${late ? `It’s ${late} days late.` : ''}</p>
          ${mailButtons(c.email || '', subject, body)}`;
        $$('[data-tone]', box).forEach((b) => b.onclick = () => { tone = b.dataset.tone; draw(); });
        $$('[data-mail]', box).forEach((a) => a.addEventListener('click', async () => {
          cur.reminders = (cur.reminders || []).concat({ date: BW.today(), tone });
          await saveNow(); drawSide();
        }));
      };
      draw();
      BW.modal({ title: '⏰ Send a reminder', body: box, wide: true, actions: [{ label: 'Done', kind: 'primary' }] });
    },
    async credit() {
      await saveNow();
      const today = BW.today();
      const cn = {
        kind: 'credit', number: nextNumber('credit', today.slice(0, 4)), status: 'draft', issueDate: today, currency: cur.currency, lang: cur.lang || '',
        clientId: cur.clientId, client: Object.assign({}, cur.client), items: cur.items.map((i) => Object.assign({}, i, { id: BW.uid(), qty: -BW.num(i.qty) })),
        discount: cur.discount, reverseCharge: cur.reverseCharge, notes: '', creditFor: cur.id, creditForNumber: cur.number,
      };
      try { await BW.store.put('invoices', cn); await load(); } catch (e) { return BW.error(e); }
      BW.toast(`Credit note ${esc(cn.number)} made. Change the lines if it’s only part of the invoice.`, '↩️');
      location.hash = '#edit/' + cn.id;
    },
    async sent() { cur.status = 'sent'; cur.sentAt = BW.today(); await saveNow(); drawSide(); BW.toast('Marked as sent. Fingers crossed for a quick payment!', '🤞'); },
    async decline() { cur.status = 'declined'; await saveNow(); drawSide(); BW.toast("Their loss. On to the next one!", '💪'); },
    async accept() {
      if (!ready()) return;
      await saveNow();
      const today = BW.today();
      const inv = {
        kind: 'invoice', number: nextNumber('invoice', today.slice(0, 4)), status: 'draft', issueDate: today, dueDate: BW.addDays(today, BW.settings.paymentDays || 14),
        currency: cur.currency, clientId: cur.clientId, client: Object.assign({}, cur.client), items: cur.items.map((i) => Object.assign({}, i, { id: BW.uid() })),
        notes: '', reverseCharge: cur.reverseCharge, fromQuote: cur.id,
      };
      try {
        await BW.store.put('invoices', inv);
        cur.status = 'accepted'; cur.invoiceId = inv.id;
        await saveNow(); await load();
      } catch (e) { return BW.error(e); }
      BW.confetti(); BW.toast('Deal! Your invoice is ready to go', '🤝');
      location.hash = '#edit/' + inv.id;
    },
    async dup() {
      await flush();
      const today = BW.today(), q = cur.kind === 'quote';
      const copy = JSON.parse(JSON.stringify(cur));
      for (const k of ['id', 'createdAt', 'updatedAt', 'sentAt', 'paidAt', 'invoiceId', 'fromQuote']) delete copy[k];
      Object.assign(copy, { number: nextNumber(cur.kind, today.slice(0, 4)), status: 'draft', issueDate: today });
      if (q) copy.validUntil = BW.addDays(today, BW.settings.quoteDays || 30); else copy.dueDate = BW.addDays(today, BW.settings.paymentDays || 14);
      copy.items.forEach((i) => { i.id = BW.uid(); });
      edit(copy, true);
      await saveNow();
      BW.toast(`Copied into ${esc(copy.number)}`, '📑');
    },
    async del() {
      if (isNew && !cur.id) { location.hash = ''; return; }
      const gone = JSON.parse(JSON.stringify(cur));
      dirty = false; cur = null;
      invoices = invoices.filter((i) => i.id !== gone.id);
      location.hash = '';
      await BW.removeWithUndo('invoices', gone, `${gone.kind === 'quote' ? 'Quote' : gone.kind === 'credit' ? 'Credit note' : 'Invoice'} ${esc(gone.number)}`, async () => { await load(); if (!cur) showList(); });
    },
  };
})();
