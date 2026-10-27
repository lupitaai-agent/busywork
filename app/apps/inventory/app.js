/* Home Inventory: what the household owns, room by room, with photos, the receipt and the warranty.
   After a break-in or water damage, the claim pack (a PDF of what was lost, with values and proof)
   is one click away. Photos and receipts are files in Inventory/. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const H = BW.house;
  const main = $('#main');
  let items = [], room = '';

  BW.boot({
    app: 'inventory',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => edit({ room: room || 'Living room', kind: 'other' }), claim: () => claim(), open: (id) => { const x = items.find((i) => i.id === id); if (x) edit(x); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap, .modal-wrap')) render(); },
  });
  BW.shortcut('n', 'Add something you own', () => edit({ room: room || 'Living room', kind: 'other' }));
  async function load() { items = await BW.store.all('inventory'); }
  const kindEmoji = (k) => (H.INV_KINDS.find((x) => x[0] === k) || H.INV_KINDS[H.INV_KINDS.length - 1])[1].split(' ')[0];
  const rooms = () => [...new Set(H.ROOMS.concat(items.map((i) => i.room).filter(Boolean)))];

  function render() {
    const today = BW.today(), t = H.totals(items), ending = H.warrantyEnding(items, today, 60);
    const shown = items.filter((i) => !room || (i.room || 'Other') === room);
    const byRoom = {}; shown.forEach((i) => (byRoom[i.room || 'Other'] = byRoom[i.room || 'Other'] || []).push(i));
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🛋️</span> Home Inventory</h1><p class="lead">What you own, room by room, with photos, receipts and warranties. Ready for any insurance claim.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">${items.length ? '<button class="btn" data-claim><span class="emo">☂️</span> Claim pack</button>' : ''}<button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add something</button></div>
      </div>
      ${items.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--grape)"><div class="k">💶 Worth together</div><div class="v">${BW.money(t.total)}</div><div class="s">${items.length} thing${items.length === 1 ? '' : 's'}. Check your contents insurance covers it.</div></div>
        <div class="card stat" style="--tint:var(--tomato)"><div class="k">📷 Without proof</div><div class="v">${t.missing}</div><div class="s">${t.missing ? 'No photo or receipt yet' : 'Everything has a photo or receipt'}</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">🧾 Warranty ending</div><div class="v">${ending.length}</div><div class="s">${ending.length ? esc(ending.map((i) => i.name).slice(0, 2).join(', ')) : 'Nothing in the next two months'}</div></div>
      </div>
      <div class="filters" data-room style="margin-bottom:18px"><button type="button" data-v="" aria-pressed="${!room}">All rooms</button>${Object.keys(t.rooms).sort().map((r) => `<button type="button" data-v="${esc(r)}" aria-pressed="${room === r}">${esc(r)}<small>${BW.money(t.rooms[r])}</small></button>`).join('')}</div>
      ${Object.keys(byRoom).sort().map((r) => `<div class="month-h"><span>${esc(r)}</span><small class="faint">${BW.money(byRoom[r].reduce((s, i) => s + H.value(i), 0))}</small></div><div class="list rise">${byRoom[r].map(row).join('')}</div>`).join('')}
      <div style="height:40px"></div>`
      : `<div class="card empty rise"><div class="big">🛋️</div><h2>Ten minutes now saves weeks after a burglary</h2>
          <p>Walk through your home and add the things worth something: the TV, the laptop, the bikes, jewellery, the sofa. A photo and the receipt each. If anything ever happens, your claim is ready.</p>
          <button class="btn btn-primary btn-big" data-new>＋ Add the first thing</button></div>`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ room: room || 'Living room', kind: 'other' }));
    const c = $('[data-claim]', main); if (c) c.onclick = claim;
    const fr = $('[data-room]', main); if (fr) fr.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { room = b.dataset.v; render(); } };
    $$('.row[data-id]', main).forEach((r) => { r.onclick = () => edit(items.find((i) => i.id === r.dataset.id)); r.onkeydown = (e) => { if (e.key === 'Enter') r.onclick(); }; });
  }
  function row(i) {
    const n = (i.photos || []).length, today = BW.today();
    const warranty = i.warrantyUntil ? (i.warrantyUntil < today ? '' : `<span class="chip chip-grey mini">🧾 Warranty to ${BW.fmtDate(i.warrantyUntil)}</span>`) : '';
    return `<div class="row" data-id="${i.id}" tabindex="0"><span class="icon-big">${kindEmoji(i.kind)}</span>
      <span class="main"><b>${esc(i.name || 'Something')}</b><small>${esc([[i.brand, i.model].filter(Boolean).join(' '), i.bought && 'bought ' + BW.fmtDate(i.bought)].filter(Boolean).join(' · ')) || '&nbsp;'}</small>
        <span class="meta">${n ? `<span class="chip chip-grey mini">📷 ${n}</span>` : ''}${i.receipt ? '<span class="chip chip-grey mini">🧾 Receipt</span>' : ''}${!n && !i.receipt ? '<span class="chip chip-grey mini">No proof yet</span>' : ''}${warranty}</span></span>
      <span class="amt">${H.value(i) ? BW.money(H.value(i)) : ''}</span></div>`;
  }

  async function saveFile(file, rec, what) {
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
    const path = `Inventory/${BW.fileSafe(rec.room || 'Other')}/${BW.fileSafe(rec.name || 'item')} ${what} ${BW.uid().slice(-4)}${ext}`;
    const r = await BW.store.writeFile(path, file, { download: false });
    if (!r.saved) { BW.toast('Photos and receipts are kept when you save to a folder: use the 📁 button at the top.', '📁'); return ''; }
    return path;
  }

  function edit(x) {
    const urls = [];
    BW.recordDrawer({
      collection: 'inventory', rec: Object.assign({ photos: [] }, x), title: 'Something you own', newTitle: 'Add something you own',
      fields: [
        { k: 'name', label: 'What is it?', ph: 'e.g. TV, Laptop, Cargo bike, Grandma’s ring', span: 2, required: true },
        { k: 'room', label: 'Room', type: 'chips', options: rooms().map((r) => [r, r]) },
        { k: 'kind', label: 'Kind', type: 'chips', options: H.INV_KINDS },
        { k: 'brand', label: 'Brand', ph: 'e.g. Samsung' },
        { k: 'model', label: 'Model', ph: 'e.g. QE55Q80' },
        { k: 'serial', label: 'Serial or frame number', ph: 'Helps the police and the insurer', span: 2 },
        { k: 'bought', label: 'Bought on', type: 'date' },
        { k: 'price', label: 'Paid', type: 'money', ph: '0.00' },
        { k: 'value', label: 'Worth now (optional)', type: 'money', ph: '0.00', hint: 'If it’s worth more or less than you paid.' },
        { k: 'warrantyUntil', label: 'Warranty until', type: 'date' },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'Where you bought it, what came with it', span: 2 },
      ],
      isComplete: (r) => !!r.name,
      top: () => `<div class="photo-strip" data-photos></div>
        <div class="row-flex" style="margin-bottom:14px"><button type="button" class="btn" data-add-photo>📷 Add photos</button><button type="button" class="btn" data-add-receipt>🧾 <span data-rlabel>Add the receipt</span></button>
          <input type="file" accept="image/*" multiple hidden data-photo-in><input type="file" accept="image/*,application/pdf" hidden data-receipt-in></div>`,
      bind: async (box, r, save) => {
        const strip = $('[data-photos]', box);
        const show = async () => {
          strip.innerHTML = '';
          for (const p of r.photos || []) {
            const f = await BW.store.readFile(p).catch(() => null);
            if (f) { const u = URL.createObjectURL(f); urls.push(u); strip.insertAdjacentHTML('beforeend', `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="${esc(r.name || 'Photo')}"></a>`); }
            else strip.insertAdjacentHTML('beforeend', `<small class="faint">📷 ${esc(p.split('/').pop())}</small>`);
          }
          $('[data-rlabel]', box).textContent = r.receipt ? 'Open the receipt' : 'Add the receipt';
        };
        await show();
        const pin = $('[data-photo-in]', box), rin = $('[data-receipt-in]', box);
        $('[data-add-photo]', box).onclick = () => pin.click();
        pin.onchange = async () => { for (const f of pin.files) { const p = await saveFile(f, r, 'photo').catch(BW.error); if (p) r.photos = (r.photos || []).concat(p); } pin.value = ''; save(); show(); };
        $('[data-add-receipt]', box).onclick = async () => {
          if (!r.receipt) return rin.click();
          const f = await BW.store.readFile(r.receipt).catch(() => null);
          if (!f) return BW.toast('The receipt is in your folder: open it there.', '📁');
          const u = URL.createObjectURL(f); urls.push(u); BW.openUrl(u);
        };
        rin.onchange = async () => { const f = rin.files[0]; rin.value = ''; if (!f) return; const p = await saveFile(f, r, 'receipt').catch(BW.error); if (p) { r.receipt = p; save(); show(); BW.toast('Receipt filed', '🧾'); } };
      },
      onClose: async () => { urls.forEach((u) => URL.revokeObjectURL(u)); await load(); render(); },
    });
  }

  // ---------- the claim pack ----------
  function claim() {
    const byRoom = {}; items.forEach((i) => (byRoom[i.room || 'Other'] = byRoom[i.room || 'Other'] || []).push(i));
    const box = BW.html(`<div>
      <p style="margin-bottom:12px">Tick what was lost or damaged. Busy makes a PDF for your insurer with every item, its value and the proof you have. Attach the photos and receipts from your Inventory folder.</p>
      <div class="grid-2" style="margin-bottom:12px"><label class="field"><span>When did it happen?</span><input class="in" type="date" data-when value="${BW.today()}"></label>
        <label class="field"><span>Policy number</span><input class="in" data-policy placeholder="From the policy"></label>
        <label class="field span-2"><span>What happened?</span><textarea class="in" data-what placeholder="e.g. A break-in through the back door while we were away. Reported to the police (number …)."></textarea></label></div>
      ${Object.keys(byRoom).sort().map((r) => `<div class="month-h"><span>${esc(r)}</span><button type="button" class="link" data-all="${esc(r)}">Tick all</button></div><div class="check-list">${byRoom[r].map((i) => `<label class="check-item"><input type="checkbox" data-id="${i.id}" data-room="${esc(r)}"><span class="main"><b>${esc(i.name || 'Something')}</b></span><small>${H.value(i) ? BW.money(H.value(i)) : ''}</small></label>`).join('')}</div>`).join('')}</div>`);
    $$('[data-all]', box).forEach((b) => b.onclick = () => $$(`[data-room="${CSS.escape(b.dataset.all)}"]`, box).forEach((c) => { c.checked = true; }));
    BW.modal({ title: '☂️ Claim pack', body: box, wide: true, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: '📄 Make the PDF', kind: 'primary', onClick: async () => {
      const ids = new Set($$('[data-id]', box).filter((c) => c.checked).map((c) => c.dataset.id));
      if (!ids.size) { BW.toast('Tick at least one thing first.', '☂️'); return false; }
      const lost = items.filter((i) => ids.has(i.id)), when = $('[data-when]', box).value, s = BW.settings;
      const lines = [`# Claim: list of lost or damaged items`, '', `${s.ownerName || ''}`, [s.address, [s.postcode, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        $('[data-policy]', box).value ? `Policy: ${$('[data-policy]', box).value}` : '', `Date of the event: ${when ? BW.fmtDate(when, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`, '',
        '# What happened', '', $('[data-what]', box).value || '[Describe what happened]', '', `# Items (${lost.length})`, ''];
      for (const i of lost) {
        lines.push(`- ${i.name || 'Item'}${i.brand || i.model ? ` (${[i.brand, i.model].filter(Boolean).join(' ')})` : ''}${i.serial ? `, serial ${i.serial}` : ''}. ${i.room || ''}. Bought ${i.bought ? BW.fmtDate(i.bought) : 'date unknown'}${BW.num(i.price) ? ` for ${BW.money(BW.num(i.price))}` : ''}${BW.num(i.value) ? `, worth ${BW.money(BW.num(i.value))} now` : ''}. Proof: ${[(i.photos || []).length && `${i.photos.length} photo${i.photos.length === 1 ? '' : 's'}`, i.receipt && 'receipt'].filter(Boolean).join(', ') || 'none'}.`);
      }
      lines.push('', `# Total: ${BW.money(lost.reduce((a, i) => a + H.value(i), 0))}`, '', 'Photos and receipts are attached as separate files.');
      try { await H.savePdf('Home', `Claim pack ${when || BW.today()}`, H.pdf('Claim pack', lines.join('\n'), { footer: `Made with Busy Home on ${BW.fmtDate(BW.today())}` })); } catch (e) { BW.error(e); return false; }
    } }] });
  }
})();
