/* Paper Trail: the household's important documents, each with its scans in Papers/, who it belongs
   to, where the original is and when it expires. Drop scans anywhere on the page; PDFs are searchable
   by their own words. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const H = BW.house;
  const main = $('#main');
  let papers = [], q = '', kind = '', person = '';

  BW.boot({
    app: 'papers',
    onReady: async () => {
      await load(); render(); bindDrops();
      BW.route({ new: (k) => edit({ kind: k || 'other' }), open: (id) => { const x = papers.find((p) => p.id === id); if (x) edit(x); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  BW.shortcut('n', 'Add a document', () => edit({ kind: 'other' }));
  async function load() { papers = await BW.store.all('papers'); }

  // A good first guess from the file name; the owner can change it.
  const GUESS = [['id', /passport|paspoort|id[ _-]?card|identiteit|rijbewijs|driving|licen[cs]e/i], ['insurance', /polis|polic|insur|verzeker/i], ['car', /\bcar\b|auto|apk|\bmot\b|kenteken|vehicle/i],
    ['money', /tax|belasting|aangifte|salar|loon|bank|pension|pensioen|jaaropgave/i], ['house', /hypothe|mortgage|huur|lease|rent|woz|energy.?label|deed|akte|koop/i],
    ['warranty', /garant|warrant|manual|handleiding|receipt|bon|factuur|invoice/i], ['health', /vaccin|health|zorg|medical|doctor|huisarts/i],
    ['school', /school|diploma|certificate|getuigschrift|contract.*work|arbeids/i], ['contract', /contract|agreement|overeenkomst/i], ['pet', /\bvet\b|dieren|\bpet\b|dog|cat|hond|kat/i]];
  const guess = (name) => (GUESS.find(([, rx]) => rx.test(name)) || ['other'])[0];
  const titleOf = (name) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 80);

  function dueHtml(p) {
    const date = p.expires || p.reviewAt;
    if (!date || p.replaced) return '';
    const left = H.days(BW.today(), date), cls = left < 0 ? 'late' : left <= H.warnDays(p.kind) ? 'soon' : 'ok';
    return `<span class="due ${cls}">${p.expires ? (left < 0 ? 'Expired' : 'Expires') : 'Review'} ${H.when(left)}</span>`;
  }

  function render() {
    const today = BW.today();
    const people = [...new Set(papers.map((p) => p.person).filter(Boolean))].sort();
    let shown = papers.filter((p) => (!kind || p.kind === kind) && (!person || p.person === person));
    shown = q ? H.search(shown, q) : shown.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    const soon = H.expiring(papers, today);
    const counts = {}; papers.forEach((p) => { counts[p.kind || 'other'] = (counts[p.kind || 'other'] || 0) + 1; });
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🗂️</span> Paper Trail</h1><p class="lead">Every important document, found in seconds. Drop scans anywhere on this page.</p></div>
        <div class="spacer"></div>
        <div class="row-flex"><button class="btn" data-add-files><span class="emo">📎</span> Add scans</button><button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add a document</button></div>
      </div>
      ${papers.length ? `
      ${soon.length ? `<section class="card attention rise"><h2>⏰ Coming up</h2>${soon.slice(0, 6).map((e) => `<a href="#open/${e.paper.id}"><span class="e">${H.kind(e.paper.kind)[1]}</span><span class="main"><b>${esc(e.paper.title || 'A document')}</b><small>${e.paper.expires ? (e.left < 0 ? 'Expired' : 'Expires') : 'Review'} ${H.when(e.left)}, ${BW.fmtDate(e.date)}${e.paper.kind === 'id' && e.left >= 0 ? '. Renewing takes a few weeks: book it now.' : ''}</small></span></a>`).join('')}</section>` : ''}
      <div class="toolbar"><label class="search"><input class="in" type="search" placeholder="Search titles, people, notes and the words inside PDFs" value="${esc(q)}" data-q aria-label="Search documents"></label></div>
      <div class="filters" data-kind style="margin-bottom:10px"><button type="button" data-v="" aria-pressed="${!kind}">All<small>${papers.length}</small></button>${H.KINDS.filter((k) => counts[k[0]]).map((k) => `<button type="button" data-v="${k[0]}" aria-pressed="${kind === k[0]}">${k[1]} ${k[2]}<small>${counts[k[0]]}</small></button>`).join('')}</div>
      ${people.length > 1 ? `<div class="filters" data-person style="margin-bottom:18px"><button type="button" data-v="" aria-pressed="${!person}">Everyone</button>${people.map((n) => `<button type="button" data-v="${esc(n)}" aria-pressed="${person === n}">👤 ${esc(n)}</button>`).join('')}</div>` : '<div style="height:8px"></div>'}
      ${shown.length ? (q ? `<div class="list rise">${shown.map(row).join('')}</div>` : groups(shown)) : `<div class="card empty"><div class="big">🔍</div><h2>Nothing found</h2><p>Try other words, or another filter.</p></div>`}
      <div style="height:40px"></div>`
      : `<div class="card empty rise" style="margin-bottom:24px"><div class="big">🗂️</div><h2>Your documents, in one place</h2>
          <p>Passports, insurance policies, the rental contract, warranties, the car papers. Add a scan or a photo, say whose it is and when it expires, and Busy reminds you in time.</p>
          <button class="btn btn-primary btn-big" data-new>＋ Add my first document</button></div>
        <div class="drop-hint" data-add-files>📎 Or drop scans and PDFs here: each becomes a document you can tidy up later.</div>`}
      <input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" hidden data-files>`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ kind: kind || 'other', person }));
    $$('[data-add-files]', main).forEach((b) => b.onclick = () => $('[data-files]', main).click());
    $('[data-files]', main).onchange = (e) => { quickAdd([...e.target.files]); e.target.value = ''; };
    const qi = $('[data-q]', main);
    if (qi) qi.oninput = BW.debounce(() => { q = qi.value; const pos = qi.selectionStart; render(); const n = $('[data-q]', main); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }, 200);
    const fk = $('[data-kind]', main); if (fk) fk.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { kind = b.dataset.v; render(); } };
    const fp = $('[data-person]', main); if (fp) fp.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { person = b.dataset.v; render(); } };
    $$('.row[data-id]', main).forEach((r) => { r.onclick = () => edit(papers.find((p) => p.id === r.dataset.id)); r.onkeydown = (e) => { if (e.key === 'Enter') r.onclick(); }; });
  }
  function groups(list) {
    return H.KINDS.map((k) => [k, list.filter((p) => (p.kind || 'other') === k[0])]).filter(([, l]) => l.length)
      .map(([k, l]) => `<div class="month-h"><span>${k[1]} ${k[2]}</span><small class="faint">${l.length}</small></div><div class="list rise">${l.map(row).join('')}</div>`).join('');
  }
  function row(p) {
    const n = (p.files || []).length;
    const sub = [p.person, p.reference && `ref. ${p.reference}`, p.expires && `until ${BW.fmtDate(p.expires)}`, p.where && `📍 ${p.where}`].filter(Boolean);
    return `<div class="row" data-id="${p.id}" tabindex="0"><span class="icon-big">${H.kind(p.kind)[1]}</span>
      <span class="main"><b>${esc(p.title || 'A document')}</b><small>${esc(sub.join(' · ')) || '&nbsp;'}</small>
        <span class="meta">${n ? `<span class="chip chip-grey mini">📎 ${n} file${n === 1 ? '' : 's'}</span>` : '<span class="chip chip-grey mini">No scan yet</span>'}${p.replaced ? '<span class="chip chip-grey mini">Older copy</span>' : ''}${String(p.tags || '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => `<span class="chip chip-grey mini"># ${esc(t)}</span>`).join('')}</span></span>
      ${dueHtml(p)}</div>`;
  }

  // ---------- files ----------
  async function saveFile(file, rec) {
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    const path = `Papers/${H.kind(rec.kind)[2]}/${BW.fileSafe(rec.title || titleOf(file.name))} ${BW.uid().slice(-4)}${ext}`;
    const r = await BW.store.writeFile(path, file, { download: false });
    if (!r.saved) return '';
    if (BW.fileText && BW.fileText.CAN.test(file.name)) {
      try { const t = await BW.fileText.read(file.name, file); if (t) rec.text = [rec.text, t].filter(Boolean).join('\n\n').slice(0, 200000); } catch (e) { /* kept without text */ }
    }
    return path;
  }
  async function quickAdd(files) {
    if (!files.length) return;
    if (BW.store.kind !== 'folder') { BW.toast('Scans are kept when you save to a folder: use the 📁 button at the top first.', '📁'); }
    let added = 0, last = null;
    for (const f of files) {
      const rec = { title: titleOf(f.name), kind: guess(f.name), files: [] };
      try { const p = await saveFile(f, rec); if (p) rec.files.push(p); await BW.store.put('papers', rec); added++; last = rec; } catch (e) { BW.error(e); }
    }
    await load(); render();
    if (added === 1) { BW.toast('Filed. Now add whose it is and when it expires.', '🗂️'); edit(last); }
    else if (added) BW.toast(`${added} documents filed. Open each to add the details.`, '🗂️');
  }
  function bindDrops() {
    let depth = 0;
    document.addEventListener('dragenter', (e) => { if (e.dataTransfer.types.includes('Files') && !$('.drawer-wrap')) { depth++; document.body.classList.add('dragging'); } });
    document.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('dragging'); });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; document.body.classList.remove('dragging'); if (!$('.drawer-wrap') && e.dataTransfer.files.length) quickAdd([...e.dataTransfer.files]); });
  }
  async function openFile(path) {
    const f = await BW.store.readFile(path).catch(() => null);
    if (!f) return BW.toast('That file is in your folder, but this browser can’t open it from here. Open the folder to see it.', '📁');
    const url = URL.createObjectURL(f);
    BW.openUrl(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---------- one document ----------
  function edit(p) {
    const today = BW.today();
    BW.recordDrawer({
      collection: 'papers', rec: Object.assign({ files: [] }, p), title: 'Document', newTitle: 'Add a document',
      fields: [
        { k: 'title', label: 'What is it?', ph: 'e.g. Passport Noor, Home insurance policy, Lease', span: 2, required: true },
        { k: 'kind', label: 'Kind', type: 'chips', options: H.KINDS.map((k) => [k[0], `${k[1]} ${k[2]}`]) },
        { k: 'person', label: 'Whose is it?', ph: 'e.g. Noor, the whole household, the car' },
        { k: 'reference', label: 'Number or reference', ph: 'Policy or customer number', hint: 'Skip ID numbers if you’d rather not keep them here.' },
        { k: 'issued', label: 'Issued or signed on', type: 'date' },
        { k: 'expires', label: 'Expires on', type: 'date', hint: 'Busy warns you in time: four months ahead for passports and ID cards, two for the rest.' },
        { k: 'reviewAt', label: 'Look at it again on', type: 'date', hint: 'For things without an end date, like a will or the energy deal.' },
        { k: 'where', label: 'Where is the original?', ph: 'e.g. Blue folder in the study, the safe' },
        { k: 'tags', label: 'Tags', ph: 'e.g. holiday, tax 2026 (optional)' },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'What’s important about it: what’s covered, who to call', span: 2 },
        { k: 'replaced', label: 'Is this an older copy?', type: 'chips', options: [['', 'No, it’s current'], ['yes', 'Yes, replaced']] },
      ],
      isComplete: (r) => !!(r.title || (r.files || []).length),
      top: (r) => `<div class="files" data-files>${filesHtml(r)}</div>
        <div class="drop-hint" data-zone tabindex="0" role="button">📎 Add a scan, photo or PDF<input type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" hidden data-file></div>
        ${r.expires && H.days(today, r.expires) < 0 && !r.replaced ? `<p class="card" style="padding:10px 14px;background:var(--app-soft)">This one has expired. Renewed it? Add the new one and mark this as an older copy.</p>` : ''}`,
      bind: (box, r, save) => {
        const zone = $('[data-zone]', box), input = $('[data-file]', box);
        const take = async (files) => {
          for (const f of files) {
            try { const p = await saveFile(f, r); if (p) { r.files = (r.files || []).concat(p); } else BW.toast('Scans are kept when you save to a folder: use the 📁 button at the top.', '📁'); }
            catch (err) { BW.error(err); }
          }
          save(); $('[data-files]', box).innerHTML = filesHtml(r); bindFiles();
        };
        zone.onclick = () => input.click();
        zone.onkeydown = (e) => { if (e.key === 'Enter') input.click(); };
        input.onchange = () => { take([...input.files]); input.value = ''; };
        zone.ondragover = (ev) => { ev.preventDefault(); zone.classList.add('over'); };
        zone.ondragleave = () => zone.classList.remove('over');
        zone.ondrop = (ev) => { ev.preventDefault(); ev.stopPropagation(); take([...ev.dataTransfer.files]); };
        const bindFiles = () => {
          $$('[data-open]', box).forEach((b) => b.onclick = () => openFile(b.dataset.open));
          $$('[data-unlink]', box).forEach((b) => b.onclick = async () => {
            if (!(await BW.confirm('Take this file off the document? The file itself stays in your folder.', { ok: 'Take it off' }))) return;
            r.files = (r.files || []).filter((x) => x !== b.dataset.unlink); save(); $('[data-files]', box).innerHTML = filesHtml(r); bindFiles();
          });
        };
        bindFiles();
      },
      onClose: async () => { await load(); render(); },
    });
  }
  function filesHtml(r) {
    return (r.files || []).map((p) => `<div class="file-row"><span>${/\.pdf$/i.test(p) ? '📄' : /\.(png|jpe?g|gif|webp|heic)$/i.test(p) ? '🖼️' : '📎'}</span><span class="main">${esc(p.split('/').pop())}</span>
      <button type="button" class="btn" data-open="${esc(p)}">Open</button><button type="button" class="icon-btn" data-unlink="${esc(p)}" aria-label="Take this file off">✕</button></div>`).join('');
  }
})();
