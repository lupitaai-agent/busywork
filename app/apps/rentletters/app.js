/* Letters to Tenants: a welcome, a visit, a repair, a copy of a certificate, the deposit at the end. Filled from your
   details, the home and the tenancy, in the language chosen for the tenancy (the home's country's by default); what Busy cannot know stays in
   [brackets]. Saved in the folder and printed as a PDF. Busy drafts; you send. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const R = BW.rentals;
  const main = $('#main');
  const lang = () => window.BusyLang || 'en';
  let letters = [], homes = [], tenancies = [];

  BW.boot({
    app: 'rentletters',
    onReady: async () => {
      await load(); render();
      BW.route({ new: (id) => pick(id), open: async (id) => { await load(); const l = letters.find((x) => x.id === id); if (l) edit(l); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap, .modal-wrap')) render(); },
  });
  async function load() { [letters, homes, tenancies] = await Promise.all(['rentletters', 'homes', 'tenancies'].map((n) => BW.store.all(n).catch(() => []))); }
  const homeOf = (t) => homes.find((h) => h.id === (t || {}).homeId) || {};

  function render() {
    main.innerHTML = `
      <div class="page-head"><div><h1><span class="title-emo">✉️</span> ${BW.t('Letters to Tenants')}</h1><p class="lead">${BW.t('Filled in with the home and the tenancy, in the language you choose for each tenant. Busy drafts; you send.')}</p></div></div>
      <div class="tpl-grid rise">${R.LETTERS.map((t) => `<button class="card tpl" data-t="${t.id}"><span class="e">${t.emoji}</span><b>${esc(BW.t(t.name))}</b><small>${esc(BW.t(t.about))}</small></button>`).join('')}</div>
      ${letters.length ? `<section class="card" style="margin-top:18px"><h2>${BW.t('Written before')}</h2>${letters.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).map((l) => `<a class="file-row" href="#open/${l.id}"><span>✉️</span><span class="main"><b>${esc(l.title || BW.t('A letter'))}</b><small>${esc([l.to, langName(l.lang), l.sentAt ? BW.t(`sent on ${BW.fmtDate(l.sentAt)}`) : BW.t('not sent yet')].filter(Boolean).join(' · '))}</small></span></a>`).join('')}</section>` : ''}`;
    $$('[data-t]', main).forEach((b) => b.onclick = () => pick(b.dataset.t));
  }

  // Which tenancy the letter is for, then the filled letter in the drawer.
  function pick(id) {
    const tpl = R.LETTERS.find((x) => x.id === id) || R.LETTERS[0];
    const list = tenancies.slice().sort((a, b) => String(b.start).localeCompare(String(a.start)));
    if (!list.length) return BW.toast(BW.t('Add a tenancy first, in Homes & Tenancies.'), '🏠');
    if (list.length === 1) return create(tpl, list[0]);
    const box = BW.html(`<div class="check-list">${list.map((t, i) => `<label class="check-item"><input type="radio" name="t" value="${t.id}" ${i ? '' : 'checked'}><span class="main"><b>${esc(t.tenants || BW.t('A tenant'))}</b><br><small>${esc(homeOf(t).name || '')}${t.endedAt ? ` · ${BW.t(`ended on ${BW.fmtDate(t.endedAt)}`)}` : ''}</small></span></label>`).join('')}</div>`);
    BW.modal({ title: `${tpl.emoji} ${esc(BW.t(tpl.name))}`, body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Write it', kind: 'primary', onClick: () => { const v = ($('input[name=t]:checked', box) || {}).value; create(tpl, tenancies.find((t) => t.id === v)); } }] });
  }
  const langName = (l) => (R.LETTER_LANGS.find((x) => x[0] === l) || ['', l || ''])[1];
  async function create(tpl, t) {
    const home = homeOf(t), code = R.countryOf(home, BW.settings, lang());
    const f = R.fillLetter(tpl.id, code, { s: BW.settings, home, t, today: BW.today(), uiLang: lang() });
    let rec;
    try { rec = await BW.store.put('rentletters', { template: tpl.id, tenancyId: t.id, to: t.tenants || '', title: f.title, body: f.body, lang: f.lang }); } catch (e) { return BW.error(e); }
    await load(); edit(rec);
  }

  function edit(l) {
    BW.recordDrawer({
      collection: 'rentletters', rec: Object.assign({}, l), title: 'The letter',
      top: (r) => `<p class="s" style="margin-bottom:10px">${BW.t('Fill in what is still in [brackets]. Then make the PDF, and send it the way you always do.')}</p>`
        + (r.template && r.template !== 'letter' ? `<p class="s" style="margin:0 0 6px"><b>${BW.t('The letter’s language')}</b> · ${BW.t('Remembered for this tenancy. The rules stay those of the home’s country.')}</p><div class="filters" data-lang style="margin-bottom:14px">${R.LETTER_LANGS.map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${v === r.lang}">${esc(n)}</button>`).join('')}</div>` : ''),
      fields: [
        { k: 'title', label: 'Title', span: 2 },
        { k: 'body', label: 'The letter', type: 'textarea', span: 2 },
        { k: 'sentAt', label: 'Sent on', type: 'date', hint: 'Fill in when it has gone, so the record shows it.' },
      ],
      bottom: () => `<p style="margin-top:12px"><button type="button" class="btn btn-primary" data-pdf>📄 ${BW.t('Make the PDF')}</button></p>`,
      bind: (box, r, save) => {
        const ta = $('textarea[name=body]', box); if (ta) ta.style.minHeight = '360px';
        // Another language: the template again in that language, kept for the tenancy. Your own changes are asked about first.
        const pick = $('[data-lang]', box);
        if (pick) pick.onclick = async (e) => {
          const b = e.target.closest('[data-v]'); if (!b || b.dataset.v === r.lang) return;
          const t = tenancies.find((x) => x.id === r.tenancyId) || {}, home = homeOf(t), code = R.countryOf(home, BW.settings, lang());
          BW.readFields($('[data-form]', box), r);
          const was = R.fillLetter(r.template, code, { s: BW.settings, home, t, today: BW.today(), lang: r.lang });
          if (r.body !== was.body && !(await BW.confirm(BW.t('Your changes to this letter will be replaced by the template in the other language. Go on?'), { ok: 'Change the language' }))) return;
          const f = R.fillLetter(r.template, code, { s: BW.settings, home, t, today: BW.today(), lang: b.dataset.v });
          Object.assign(r, { title: f.title, body: f.body, lang: f.lang });
          $('[name=title]', box).value = f.title; $('textarea[name=body]', box).value = f.body;
          $$('[data-v]', pick).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === f.lang)));
          save();
          if (t.id && t.letterLang !== f.lang) { try { await BW.store.put('tenancies', Object.assign({}, t, { letterLang: f.lang })); await load(); } catch (err) { BW.error(err); } }
        };
        $('[data-pdf]', box).onclick = async () => {
          BW.readFields($('[data-form]', box), r);
          if (/\[[^\]]+\]/.test(r.body || '') && !(await BW.confirm(BW.t('Some [brackets] are still empty. Make the PDF anyway?'), { ok: 'Make it' }))) return;
          try {
            // The tenant, the letter's date and the end of its id are in the name: two letters never share a file,
            // and the same letter made again replaces its own.
            const name = R.fileName(r.title || 'Letter', r.to, r.sentAt || String(r.createdAt || '').slice(0, 10) || BW.today(), String(r.id || '').slice(-4));
            const res = await BW.store.writeFile(`Letters/${name}.pdf`, R.pdf(r.title || 'Letter', r.body || '', { footer: '' }));
            BW.toast(res.saved ? `${BW.t('Saved to')} ${esc(res.where)}` : BW.t('The PDF is in your Downloads'), '📄');
          } catch (e) { BW.error(e); }
        };
      },
      onClose: async () => { await load(); render(); },
    });
  }
})();
