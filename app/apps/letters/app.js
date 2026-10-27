/* Letters: cancel, complain, claim, object, ask for your data. Pick a template and the contract it's
   about, and the letter fills in the household's details, the company and the dates. What Busy can't
   know stays in [brackets] to fill in. Save it as a PDF in Letters/, or copy it into an email. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const H = BW.house;
  const main = $('#main');
  let letters = [], contracts = [], cur = null, dirty = false;

  BW.boot({
    app: 'letters',
    onReady: async () => { await load(); route(); },
    onChange: async () => { await load(); if (!cur) showHome(); },
  });
  addEventListener('hashchange', async () => { await flush(); route(); });
  async function load() { [letters, contracts] = await Promise.all(['letters', 'contracts'].map((n) => BW.store.all(n))); }

  function route() {
    const [a, b, c] = location.hash.slice(1).split('/');
    if (a === 'new' && b) { cur = null; showHome(); return start(b, c); }
    const l = a === 'edit' && letters.find((x) => x.id === b);
    if (l) { cur = JSON.parse(JSON.stringify(l)); drawEditor(); } else { cur = null; showHome(); }
  }

  function showHome() {
    const recent = letters.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    main.innerHTML = `
      <div class="page-head"><div><h1><span class="title-emo">✉️</span> Letters</h1><p class="lead">Pick a letter. Busy fills in your details, the company and the dates; you check the rest.</p></div></div>
      <h2 style="margin-bottom:14px">Write a letter</h2>
      <div class="tpl-grid rise">${H.LETTERS.map((t) => `<button class="card tpl" data-t="${t.id}"><span class="e">${t.emoji}</span><b>${esc(t.name)}</b><small>${esc(t.about)}</small></button>`).join('')}</div>
      ${recent.length ? `<h2 style="margin-bottom:14px">Your letters</h2><div class="list rise" style="padding-bottom:40px">${recent.map((l) => `
        <div class="row" data-id="${l.id}" tabindex="0"><span class="icon-big">${(H.LETTERS.find((t) => t.id === l.template) || { emoji: '📨' }).emoji}</span>
          <span class="main"><b>${esc(l.title || 'A letter')}</b><small>${esc([l.to, BW.fmtDate((l.updatedAt || '').slice(0, 10))].filter(Boolean).join(' · '))}</small></span>
          ${l.sentAt ? `<span class="due ok">Sent ${BW.fmtDate(l.sentAt)}</span>` : (l.body || '').includes('[') ? '<span class="due soon">To finish</span>' : '<span class="due off">Not sent</span>'}</div>`).join('')}</div>`
        : '<p class="faint" style="padding-bottom:40px">Letters you write are kept here, so you can find what you sent and when.</p>'}`;
    $$('[data-t]', main).forEach((b) => b.onclick = () => start(b.dataset.t));
    $$('.row[data-id]', main).forEach((r) => { r.onclick = () => { location.hash = 'edit/' + r.dataset.id; }; r.onkeydown = (e) => { if (e.key === 'Enter') r.onclick(); }; });
  }

  // Before the letter: who it goes to, and which contract it's about.
  function start(tid, contractId) {
    const t = H.LETTERS.find((x) => x.id === tid);
    if (!t) return;
    const live = contracts.filter((c) => !c.cancelledAt);
    const pre = contracts.find((c) => c.id === contractId);
    const box = BW.html(`<div class="stack" style="--gap:12px"><p>${esc(t.about)}</p>
      ${contracts.length && t.id !== 'access' ? `<label class="field"><span>${t.needs === 'contract' ? 'Which contract?' : 'About a contract? (optional)'}</span><select class="in" data-c><option value="">${t.needs === 'contract' ? 'Not in my list' : 'No'}</option>${(pre && !live.includes(pre) ? [pre] : []).concat(live).map((c) => `<option value="${c.id}" ${pre && pre.id === c.id ? 'selected' : ''}>${esc([c.name, c.provider].filter(Boolean).join(' · '))}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>To</span><input class="in" data-to placeholder="The company or organisation" value="${esc(pre ? pre.provider || pre.name : '')}"></label>
      <label class="field"><span>Their address</span><textarea class="in" data-addr rows="3" placeholder="Postal address, or leave empty for an email">${esc(pre ? pre.address || '' : '')}</textarea></label></div>`);
    const sel = $('[data-c]', box);
    if (sel) sel.onchange = () => { const c = contracts.find((x) => x.id === sel.value); if (c) { $('[data-to]', box).value = c.provider || c.name || ''; $('[data-addr]', box).value = c.address || ''; } };
    BW.modal({ title: `${t.emoji} ${esc(t.name)}`, body: box, actions: [{ label: 'Never mind', kind: 'ghost', onClick: () => { if (location.hash) location.hash = ''; } }, { label: 'Write it', kind: 'primary', onClick: async () => {
      const today = BW.today(), c = sel ? contracts.find((x) => x.id === sel.value) : null;
      const to = { name: $('[data-to]', box).value.trim(), address: $('[data-addr]', box).value.trim() };
      const cc = c ? { name: c.name || c.provider, reference: c.reference, end: H.nextEnd(c, today) } : {};
      const rec = { template: t.id, to: to.name, toAddress: to.address, contractId: c ? c.id : '', title: H.fill(t.title, { me: H.me(BW.settings), to, c: cc, today }).replace(/\[addressee\]/, 'a company'),
        body: H.fill(t.body, { me: H.me(BW.settings), to, c: cc, today }) };
      try { await BW.store.put('letters', rec); } catch (e) { BW.error(e); return false; }
      await load(); setTimeout(() => { location.hash = 'edit/' + rec.id; }, 0);
    } }] });
  }

  function gaps(body) { return [...new Set((String(body).match(/\[[^\]\n]{1,60}\]/g) || []))]; }

  function drawEditor() {
    const g = gaps(cur.body);
    main.innerHTML = `
      <div style="padding-top:18px"><a class="btn btn-ghost" href="#" style="margin-left:-10px">← Letters</a></div>
      <div class="page-head" style="padding-top:6px"><div style="flex:1;min-width:0"><input class="in" data-title value="${esc(cur.title || '')}" aria-label="Title" style="font-size:1.4rem;font-weight:850"></div></div>
      <div class="writer">
        <textarea class="in body" data-body aria-label="The letter" spellcheck="true">${esc(cur.body || '')}</textarea>
        <aside>
          <div class="card" style="padding:14px 16px" data-gaps>${gapsHtml(g)}</div>
          <button class="btn btn-primary" data-pdf>📄 Save as PDF</button>
          <button class="btn" data-copy>📋 Copy the text</button>
          ${cur.sentAt ? `<button class="btn btn-ghost" data-unsent>Sent ${BW.fmtDate(cur.sentAt)} · undo</button>` : '<button class="btn" data-sent>✅ I sent it</button>'}
          <small class="faint" data-saved>All changes saved</small>
          <small class="faint">Send important letters by registered post or keep the email, so you can prove when they arrived. Busy writes the letter; it isn’t legal advice.</small>
          <button class="btn btn-ghost btn-danger" data-del>🗑️ Delete</button>
        </aside>
      </div><div style="height:40px"></div>`;
    const body = $('[data-body]', main), title = $('[data-title]', main);
    const later = BW.debounce(flush, 600);
    const changed = () => { dirty = true; cur.body = body.value; cur.title = title.value; $('[data-saved]', main).textContent = 'Saving…'; $('[data-gaps]', main).innerHTML = gapsHtml(gaps(cur.body)); bindGaps(); later(); };
    body.oninput = changed; title.oninput = changed;
    // Clicking a gap selects it in the letter, ready to type over.
    const bindGaps = () => $$('[data-gap]', main).forEach((b) => b.onclick = () => { const i = body.value.indexOf(b.dataset.gap); if (i >= 0) { body.focus(); body.setSelectionRange(i, i + b.dataset.gap.length); } });
    bindGaps();
    $('[data-pdf]', main).onclick = async () => {
      await flush();
      if (gaps(cur.body).length && !(await BW.confirm('There are still [brackets] to fill in. Make the PDF anyway?', { ok: 'Make it anyway' }))) return;
      try { await H.savePdf(`Letters/${BW.today().slice(0, 4)}`, cur.title || 'Letter', H.pdf(cur.title || 'Letter', cur.body)); } catch (e) { BW.error(e); }
    };
    $('[data-copy]', main).onclick = async () => { if (await BW.copy(cur.body.replace(/^# /gm, ''))) BW.toast('Copied. Paste it into an email.', '📋'); };
    const sent = $('[data-sent]', main); if (sent) sent.onclick = async () => { cur.sentAt = BW.today(); dirty = true; await flush(); drawEditor(); BW.toast('Noted. Keep the confirmation when it comes.', '✅'); };
    const unsent = $('[data-unsent]', main); if (unsent) unsent.onclick = async () => { cur.sentAt = ''; dirty = true; await flush(); drawEditor(); };
    $('[data-del]', main).onclick = async () => {
      dirty = false;
      const gone = JSON.parse(JSON.stringify(cur));
      cur = null; location.hash = '';
      await BW.removeWithUndo('letters', gone, esc(gone.title || 'Letter'), async () => { await load(); if (!cur) showHome(); });
    };
  }
  function gapsHtml(g) {
    return g.length ? `<b>✏️ ${g.length} thing${g.length === 1 ? '' : 's'} to fill in</b><div class="row-flex" style="margin-top:8px;gap:6px">${g.map((x) => `<button type="button" class="chip chip-sun mini" data-gap="${esc(x)}" style="border:0;cursor:pointer">${esc(x)}</button>`).join('')}</div>`
      : '<b>✓ Nothing left in brackets</b><br><small class="faint">Read it once more, then save or send it.</small>';
  }

  async function flush() {
    if (!cur || !dirty) return;
    dirty = false;
    try { await BW.store.put('letters', cur); const el = $('[data-saved]', main); if (el) el.textContent = 'All changes saved ✓'; }
    catch (e) { dirty = true; BW.error(e); }
  }
})();
