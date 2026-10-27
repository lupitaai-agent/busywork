/* Just in Case: what the people you love would need to know if something happened to you. People
   to call, where things are, accounts, the house, pets, wishes; plus every contract and document
   already in Busy Home. One PDF to print and put with the will. Never passwords: only where they are. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const H = BW.house;
  const main = $('#main');
  let entries = [], contracts = [], papers = [];

  BW.boot({
    app: 'binder',
    onReady: async () => { await load(); render(); BW.route({ new: (sec) => edit({ section: sec || 'people' }), open: (id) => { const x = entries.find((e) => e.id === id); if (x) edit(x); } }); },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  async function load() { [entries, contracts, papers] = await Promise.all(['binder', 'contracts', 'papers'].map((n) => BW.store.all(n))); }
  const live = () => contracts.filter((c) => H.contractState(c, BW.today()) !== 'ended');
  const current = () => papers.filter((p) => !p.replaced);

  function render() {
    const filled = H.BINDER.filter(([id]) => entries.some((e) => e.section === id)).length;
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">📕</span> Just in Case</h1><p class="lead">Everything your family would need if something happened to you. Fill it in once, print it, tell them where it is.</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-pdf><span class="emo">🖨️</span> Make the PDF</button>
      </div>
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--mint)"><div class="k">📕 Sections filled in</div><div class="v">${filled} of ${H.BINDER.length}</div><div class="s">${filled === H.BINDER.length ? 'Complete. Look at it again once a year.' : 'A few minutes each'}</div></div>
        <div class="card stat" style="--tint:var(--sky)"><div class="k">🔗 Already in Busy Home</div><div class="v">${live().length + current().length}</div><div class="s">${live().length} contracts and ${current().length} documents, added for you</div></div>
      </div>
      <div class="card attention rise"><h2>🔒 Never passwords or PINs</h2><small>Write where things are and who may open them, not the codes themselves. The binder is a file in your folder: keep that folder safe, and tell one or two people where the printout is.</small></div>
      ${H.BINDER.map(([id, emo, title, hint]) => {
        const mine = entries.filter((e) => e.section === id);
        return `<section class="card binder-sec rise"><div class="row-flex" style="justify-content:space-between"><h2>${emo} ${esc(title)}</h2><button class="btn" data-add="${id}">＋ Add</button></div>
          ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
          ${mine.map((e) => `<div class="binder-entry" data-id="${e.id}" tabindex="0"><b>${esc(e.title || 'Untitled')}</b>${e.text ? `<p>${esc(e.text)}</p>` : ''}</div>`).join('') || '<small class="faint">Nothing yet.</small>'}</section>`;
      }).join('')}
      <section class="card binder-sec rise"><h2>🔁 Contracts</h2><p class="hint">From Contracts &amp; Renewals: what to keep, transfer or cancel.</p>
        ${live().map((c) => `<div class="binder-entry" data-contract="${c.id}"><b>${esc(c.name || c.provider || 'Contract')}</b><p>${esc([c.provider, c.reference && 'ref. ' + c.reference, c.phone].filter(Boolean).join(' · '))}</p></div>`).join('') || '<small class="faint">Add contracts in Contracts &amp; Renewals and they show here.</small>'}</section>
      <section class="card binder-sec rise"><h2>🗂️ Documents</h2><p class="hint">From Paper Trail, with where each original is.</p>
        ${current().map((p) => `<div class="binder-entry" data-paper="${p.id}"><b>${esc(p.title || 'Document')}</b><p>${esc([p.person, p.where ? '📍 ' + p.where : 'Where the original is: not filled in'].filter(Boolean).join(' · '))}</p></div>`).join('') || '<small class="faint">Add documents in Paper Trail and they show here.</small>'}</section>
      <div style="height:40px"></div>`;
    $$('[data-add]', main).forEach((b) => b.onclick = () => edit({ section: b.dataset.add }));
    $$('.binder-entry[data-id]', main).forEach((el) => { el.onclick = () => edit(entries.find((e) => e.id === el.dataset.id)); el.onkeydown = (e) => { if (e.key === 'Enter') el.onclick(); }; });
    $$('[data-contract]', main).forEach((el) => el.onclick = () => { location.href = '../contracts/index.html#open/' + el.dataset.contract; });
    $$('[data-paper]', main).forEach((el) => el.onclick = () => { location.href = '../papers/index.html#open/' + el.dataset.paper; });
    $('[data-pdf]', main).onclick = pdf;
  }

  function edit(e) {
    const sec = H.BINDER.find((s) => s[0] === e.section) || H.BINDER[0];
    BW.recordDrawer({
      collection: 'binder', rec: e, title: `${sec[1]} ${sec[2]}`, newTitle: `${sec[1]} ${sec[2]}`,
      fields: [
        { k: 'section', label: 'Section', type: 'chips', options: H.BINDER.map(([id, emo, t]) => [id, `${emo} ${t}`]) },
        { k: 'title', label: 'Title', ph: sec[0] === 'people' ? 'e.g. My sister Eva' : sec[0] === 'where' ? 'e.g. The will' : 'A short title', span: 2, required: true },
        { k: 'text', label: 'What they need to know', type: 'textarea', ph: sec[3] || 'Write it as you would explain it to them', span: 2 },
      ],
      top: () => '<p class="faint" style="margin-bottom:12px">🔒 No passwords or PINs: where they are and who may open them.</p>',
      isComplete: (r) => !!(r.title || r.text),
      onClose: async () => { await load(); render(); },
    });
  }

  async function pdf() {
    const s = BW.settings, lines = [`# Just in case: ${s.ownerName || 'our household'}`, `Written ${BW.fmtDate(BW.today(), { day: 'numeric', month: 'long', year: 'numeric' })}. ${[s.address, [s.postcode, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}`, ''];
    for (const [id, emo, title] of H.BINDER) {
      const mine = entries.filter((e) => e.section === id);
      if (!mine.length) continue;
      lines.push(`# ${title}`, '');
      mine.forEach((e) => { lines.push(`- ${e.title || ''}`); if (e.text) e.text.split('\n').forEach((l) => lines.push(l)); lines.push(''); });
    }
    if (live().length) { lines.push('# Contracts', ''); live().forEach((c) => lines.push(`- ${[c.name || c.provider, c.provider !== c.name && c.provider, c.reference && 'ref. ' + c.reference, c.phone].filter(Boolean).join(' · ')}`)); lines.push(''); }
    if (current().length) { lines.push('# Documents', ''); current().forEach((p) => lines.push(`- ${p.title || 'Document'}${p.person ? ` (${p.person})` : ''}: ${p.where || 'original’s place not noted'}`)); }
    try { await H.savePdf('Home', `Just in case ${BW.today()}`, H.pdf('Just in case', lines.join('\n'), { footer: 'Keep this somewhere safe. No passwords are written here.' })); } catch (e) { BW.error(e); }
  }
})();
