/* Stock Keeper: tap + and − as things come in and go out; it warns you before you run out. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  let items = [], moves = [], query = '', onlyLow = false, cat = '';
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  BW.boot({
    app: 'stock',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => edit(blank()), open: (id) => { const i = items.find((x) => x.id === id); if (i) edit(i); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap') && !(document.activeElement && document.activeElement.matches('[data-search]'))) render(); },
  });
  const blank = () => ({ qty: 0, min: 5, emoji: '📦' });
  BW.shortcut('n', 'Add a product', () => edit(blank()));
  BW.shortcut('/', 'Search', () => { const s = $('[data-search]', main); if (s) s.focus(); });
  async function load() {
    [items, moves] = await Promise.all([BW.store.all('stock'), BW.store.all('stockmoves')]);
    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  const cats = () => [...new Set(items.map((i) => (i.category || '').trim()).filter(Boolean))].sort();
  // Every change in quantity is written down with a reason, like Sortly's item history.
  const logMove = (item, change, reason) => (change ? BW.store.put('stockmoves', { itemId: item.id, date: new Date().toISOString(), change, reason, after: BW.num(item.qty) }) : null);

  const isLow = (i) => BW.num(i.qty) <= BW.num(i.min);

  function render() {
    const q = query.toLowerCase();
    const shown = items.filter((i) => (!onlyLow || isLow(i)) && (!cat || (i.category || '').trim() === cat) && (!q || [i.name, i.sku, i.location, i.category].join(' ').toLowerCase().includes(q)));
    const low = items.filter(isLow);
    const value = items.reduce((a, i) => a + BW.num(i.qty) * BW.num(i.cost), 0);
    const units = items.reduce((a, i) => a + BW.num(i.qty), 0);
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">📦</span> Stock Keeper</h1><p class="lead">Know what's on the shelf before it runs out.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">${canScan ? '<button class="btn" data-scan><span class="emo">📷</span> Scan a barcode</button>' : ''}${items.length ? '<button class="btn" data-export><span class="emo">⬇️</span> Export</button>' : ''}<button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add a product</button></div>
      </div>
      ${items.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--sun)"><div class="k">📦 On the shelf</div><div class="v">${units.toLocaleString(BW.locale())}</div><div class="s">${items.length} product${items.length === 1 ? '' : 's'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">💰 Stock worth</div><div class="v" data-count="${value}"></div><div class="s">At what you paid for it</div></div>
        <div class="card stat" style="--tint:var(--tomato)"><div class="k">🚨 Running low</div><div class="v">${low.length}</div><div class="s">${low.length ? 'Time to reorder' : 'Shelves look happy'}</div></div>
      </div>
      <div class="toolbar">
        <div class="tabs" role="tablist"><button role="tab" data-low="0" aria-selected="${!onlyLow}">Everything</button><button role="tab" data-low="1" aria-selected="${onlyLow}">🚨 Running low <span class="count">${low.length}</span></button></div>
        ${cats().length ? `<div class="tabs">${[['', 'All shelves']].concat(cats().map((c) => [c, c])).map(([v, l]) => `<button data-cat="${esc(v)}" aria-selected="${cat === v}">${esc(l)}</button>`).join('')}</div>` : ''}
        <label class="search"><input class="in" type="search" data-search placeholder="Search name, code or shelf…" value="${esc(query)}" aria-label="Search"></label>
      </div>
      <div class="items rise">${shown.map(card).join('') || '<p class="muted">Nothing matches.</p>'}</div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">📦</div><h2>An empty warehouse</h2><p>Add the things you sell or use. Set a minimum and we'll flag them when it's time to reorder.</p><button class="btn btn-primary btn-big" data-new>＋ Add my first product</button></div>`}`;

    $$('[data-new]', main).forEach((b) => b.onclick = () => edit(blank()));
    $$('[data-cat]', main).forEach((b) => b.onclick = () => { cat = b.dataset.cat; render(); });
    const sc = $('[data-scan]', main); if (sc) sc.onclick = scan;
    $$('[data-count]', main).forEach((el) => BW.countUp(el, Number(el.dataset.count), (v) => BW.money(v)));
    $$('[data-low]', main).forEach((b) => b.onclick = () => { onlyLow = b.dataset.low === '1'; render(); });
    $$('[data-open]', main).forEach((b) => b.onclick = () => edit(items.find((i) => i.id === b.dataset.open)));
    $$('[data-step]', main).forEach((b) => b.onclick = () => step(b));
    const s = $('[data-search]', main);
    if (s) s.oninput = BW.debounce(() => { query = s.value; render(); const n = $('[data-search]', main); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 150);
    const ex = $('[data-export]', main);
    if (ex) ex.onclick = () => BW.exportCsv(`stock-${BW.today()}.csv`, ['Product', 'Category', 'Code', 'In stock', 'Reorder at', 'Cost price', 'Sale price', 'Stock value', 'Shelf'],
      items.map((i) => [i.name, i.category || '', i.sku || '', BW.num(i.qty), BW.num(i.min), BW.num(i.cost).toFixed(2), BW.num(i.price).toFixed(2), (BW.num(i.qty) * BW.num(i.cost)).toFixed(2), i.location || '']));
  }

  function card(i) {
    return `<div class="card item ${isLow(i) ? 'low' : ''}" data-id="${i.id}">
      ${isLow(i) ? '<span class="chip chip-tomato flag">🚨 Reorder</span>' : ''}
      <div class="name" data-open="${i.id}" role="button" tabindex="0"><span class="emo">${esc(i.emoji || '📦')}</span><span style="min-width:0"><b>${esc(i.name)}</b><small>${esc([i.sku, i.location].filter(Boolean).join(' · ') || 'Tap to edit')}</small></span></div>
      <div class="qty"><button class="btn" data-step="-1" data-for="${i.id}" aria-label="One less">−</button><span class="n" data-n="${i.id}">${BW.num(i.qty)}</span><button class="btn btn-primary" data-step="1" data-for="${i.id}" aria-label="One more">＋</button></div>
      <div class="meta"><span>Reorder at ${BW.num(i.min)}</span><span>${i.price ? BW.money(BW.num(i.price)) + ' each' : ''}</span></div>
    </div>`;
  }

  // Quick taps update the number at once and save shortly after, so ten fast taps make one write.
  const pending = {};
  const persist = BW.debounce(async () => {
    const ids = Object.keys(pending), deltas = Object.assign({}, pending);
    ids.forEach((k) => delete pending[k]);
    const recs = ids.map((id) => items.find((i) => i.id === id)).filter(Boolean);
    try {
      await BW.store.putMany('stock', recs);
      for (const r of recs) await logMove(r, deltas[r.id], deltas[r.id] < 0 ? 'Sold or used' : 'Received');
    } catch (e) { BW.error(e); }
    await load(); render();
  }, 700);
  function step(b) {
    const it = items.find((i) => i.id === b.dataset.for);
    const wasLow = isLow(it), before = BW.num(it.qty);
    it.qty = Math.max(0, BW.num(it.qty) + Number(b.dataset.step));
    const n = $(`[data-n="${it.id}"]`, main); n.textContent = it.qty; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
    pending[it.id] = (pending[it.id] || 0) + (BW.num(it.qty) - before); persist();
    if (!wasLow && isLow(it)) BW.toast(`${esc(it.name)} is running low. Time to reorder!`, '🚨');
  }

  // Point the camera at a barcode: open that product, or start a new one with the code filled in.
  async function scan() {
    let stream;
    const box = BW.html('<div><video playsinline muted style="width:100%;border-radius:14px;border:2px solid var(--border);background:#000"></video><p class="muted" style="margin-top:10px">Hold the barcode in front of the camera…</p></div>');
    const m = BW.modal({ title: '📷 Scan a barcode', body: box, onClose: () => { if (stream) stream.getTracks().forEach((t) => t.stop()); } });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = $('video', box); v.srcObject = stream; await v.play();
      const det = new BarcodeDetector();
      const look = async () => {
        if (!document.contains(v)) return;
        const hits = await det.detect(v).catch(() => []);
        if (!hits.length) return requestAnimationFrame(look);
        const code = hits[0].rawValue;
        m.close();
        const found = items.find((i) => (i.sku || '').trim() === code);
        if (found) { BW.toast(`Found ${esc(found.name)}`, '🎯'); edit(found); } else { BW.toast(`New code ${esc(code)}. Add the product!`, '✨'); edit(Object.assign(blank(), { sku: code })); }
      };
      look();
    } catch (e) { m.close(); BW.toast('The camera didn’t start. Check that this page may use it.', '📷'); }
  }

  function edit(i) {
    const startQty = BW.num((i || {}).qty);
    BW.recordDrawer({
      collection: 'stock', rec: i, title: 'Product', newTitle: 'New product',
      fields: [
        { k: 'name', label: 'Product name', ph: 'e.g. Sourdough loaf, Blue mug', span: 2 },
        { k: 'emoji', label: 'An emoji for it', ph: '📦' },
        { k: 'sku', label: 'Barcode or code', ph: 'e.g. 8712345678906' },
        { k: 'category', label: 'Shelf or category', ph: 'e.g. Bakery, Mugs' },
        { k: 'qty', label: 'In stock now', type: 'number', ph: '0' },
        { k: 'min', label: 'Warn me at', type: 'number', ph: '5', hint: 'We flag it when stock drops to this.' },
        { k: 'cost', label: 'What you pay (each)', type: 'money', ph: '0.00' },
        { k: 'price', label: 'What you charge (each)', type: 'money', ph: '0.00' },
        { k: 'location', label: 'Where is it kept?', ph: 'e.g. Shelf B2, back room', span: 2 },
        { k: 'notes', label: 'Notes', type: 'textarea', span: 2, ph: 'Supplier, reorder link, sizes…' },
      ],
      bottom: (r) => {
        const hist = moves.filter((mv) => mv.itemId === r.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
        return `${BW.num(r.price) && BW.num(r.cost) ? `<p class="muted" style="margin-top:10px">💡 You make ${BW.money(BW.num(r.price) - BW.num(r.cost))} on each one (${Math.round((1 - BW.num(r.cost) / BW.num(r.price)) * 100)}% margin).</p>` : ''}
          ${hist.length ? `<h3 class="section-title">🕒 History</h3><div class="moves">${hist.map((mv) => `<div><span>${BW.fmtDate(mv.date.slice(0, 10), { day: 'numeric', month: 'short' })}</span><span>${esc(mv.reason)}</span><b class="${mv.change < 0 ? 'neg' : 'pos'}">${mv.change > 0 ? '+' : ''}${mv.change}</b><span class="faint">→ ${mv.after}</span></div>`).join('')}</div>` : ''}`;
      },
      onClose: async (r) => {
        if (r && r.id && !r.deleted && BW.num(r.qty) !== startQty) { try { await logMove(r, BW.num(r.qty) - startQty, 'Counted'); } catch (e) { BW.error(e); } }
        await load(); render();
      },
    });
  }
})();
