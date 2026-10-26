/* CV Builder: one career history, as many CV versions as you need. Each version picks the jobs,
   skills and wins that fit the role, shows a live preview, and saves a real PDF in your folder. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let cvs = [], career = [], skills = [], wins = [], cur = null, dirty = false;

  BW.boot({
    app: 'cv',
    onReady: async () => {
      await load();
      cur = cvs[0] || null;
      render();
      BW.route({
        'new': () => newVersion(),
        open: (id) => { const c = cvs.find((x) => x.id === id); if (c) { cur = c; render(); } },
      });
    },
    onChange: async (what) => { if (what === 'cvs' && dirty) return; await load(); if (cur) cur = cvs.find((x) => x.id === cur.id) || cur; if (!$('.drawer-wrap')) render(); },
  });
  async function load() { [cvs, career, skills, wins] = await Promise.all(['cvs', 'career', 'skills', 'wins'].map((n) => BW.store.all(n))); }

  const later = BW.debounce(async () => {
    if (!cur || !dirty) return;
    dirty = false;
    try { await BW.store.put('cvs', cur); const el = $('[data-saved]', main); if (el) el.textContent = 'All changes saved ✓'; } catch (e) { dirty = true; BW.error(e); }
  }, 500);
  const changed = () => { dirty = true; const el = $('[data-saved]', main); if (el) el.textContent = 'Saving…'; later(); preview(); };

  async function newVersion(from) {
    const base = from ? Object.assign({}, from, { id: undefined, createdAt: undefined, updatedAt: undefined, name: `${from.name || 'CV'} (copy)` })
      : { name: cvs.length ? `CV ${cvs.length + 1}` : 'My CV', headline: BW.settings.headline || '', summary: '', include: career.map((e) => e.id),
        skillIds: skills.filter((s) => BW.num(s.level) >= 3).map((s) => s.id), winIds: wins.filter((w) => w.result).slice(0, 4).map((w) => w.id), extras: '' };
    delete base.id;
    try { await BW.store.put('cvs', base); } catch (e) { return BW.error(e); }
    await load(); cur = cvs.find((c) => c.id === base.id); render();
    BW.toast(from ? 'Copied. Tailor it for the job.' : 'A new CV version. Fill it in on the left; the preview follows.', '📄');
  }

  function render() {
    if (!cur) {
      main.innerHTML = `
        <div class="page-head"><div><h1><span class="title-emo">📄</span> CV Builder</h1><p class="lead">Your career once, then a CV for every role: pick what fits, see it, save a real PDF.</p></div></div>
        <div class="card empty rise" style="margin-bottom:50px"><div class="big">📄</div><h2>Make your first CV</h2>
          <p>Add your jobs and education once. Each CV version picks the ones that fit a role, adds your best skills and wins, and saves as a clean PDF in your folder. Your name and contact details come from ⚙️ Your details.</p>
          <button class="btn btn-primary btn-big" data-new>＋ Start my CV</button></div>`;
      $('[data-new]', main).onclick = () => newVersion();
      return;
    }
    const included = new Set(Array.isArray(cur.include) ? cur.include : career.map((e) => e.id));
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">📄</span> CV Builder</h1><p class="lead">Your career once, then a CV for every role.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          <select class="in" data-version aria-label="CV version" style="width:auto">${cvs.map((c) => `<option value="${c.id}" ${c.id === cur.id ? 'selected' : ''}>${esc(c.name || 'CV')}</option>`).join('')}</select>
          <button class="btn" data-copy title="A copy to tailor for one job">📑 Copy</button>
          <button class="btn" data-new-v>＋ New</button>
          <button class="btn btn-primary btn-big" data-pdf><span class="emo">⬇️</span> Save PDF</button>
        </div>
      </div>
      <div class="cv-layout">
        <div class="cv-edit">
          <div class="save-state" data-saved>All changes saved</div>
          <div class="card" style="padding:18px">
            <div class="grid-2">
              <label class="field span-2"><span>Name of this version</span><input class="in" data-k="name" value="${esc(cur.name || '')}" placeholder="e.g. Product marketing"></label>
              <label class="field span-2"><span>Headline</span><input class="in" data-k="headline" value="${esc(cur.headline || '')}" placeholder="e.g. Marketing coordinator who turns data into campaigns"></label>
              <label class="field span-2"><span>Summary</span><textarea class="in" data-k="summary" rows="4" placeholder="Two or three lines: what you do, what you’re best at, what you want next">${esc(cur.summary || '')}</textarea></label>
            </div>
            ${!BW.settings.email && !BW.settings.linkedin ? '<p class="faint" style="margin-top:6px">💡 Add your email and LinkedIn under <button class="link" data-details>⚙️ Your details</button> to put them on your CV.</p>' : ''}
          </div>
          <div class="section-h"><h2>💼 Your career</h2><button class="btn" data-add-career>＋ Add</button></div>
          ${career.length ? `<div class="list">${G.careerSort(career).map((e) => `<div class="row" data-career="${e.id}" tabindex="0">
            <input type="checkbox" data-inc="${e.id}" ${included.has(e.id) ? 'checked' : ''} aria-label="Show on this CV" title="Show on this CV">
            <span class="main"><b>${esc(e.title || '?')}</b><small class="faint">${esc([e.org, G.period(e)].filter(Boolean).join(' · '))}</small></span>
            <span class="chip chip-grey mini">${esc((G.CAREER_TYPES.find((t) => t[0] === e.type) || G.CAREER_TYPES[0])[1])}</span></div>`).join('')}</div>
            <p class="faint" style="margin-top:6px">Tick what this version shows. Changes to a job show on every CV that includes it.</p>`
          : '<p class="faint">Add your jobs, education and projects once. Every CV picks from them.</p>'}
          <div class="section-h"><h2>🧠 Skills</h2><a class="link" href="../skills/index.html">Skills Map →</a></div>
          ${skills.length ? `<div class="choice-chips multi" data-pick="skillIds">${skills.slice().sort((a, b) => BW.num(b.level) - BW.num(a.level)).map((s) => `<button type="button" data-v="${s.id}" aria-pressed="${(cur.skillIds || []).includes(s.id)}">${esc(s.name)}</button>`).join('')}</div>` : '<p class="faint">Add skills in the Skills Map to choose them here.</p>'}
          <div class="section-h"><h2>🏆 Highlights</h2><a class="link" href="../wins/index.html">Wins Log →</a></div>
          ${wins.length ? `<div class="choice-chips multi" data-pick="winIds">${wins.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((w) => `<button type="button" data-v="${w.id}" aria-pressed="${(cur.winIds || []).includes(w.id)}">${esc(w.title)}</button>`).join('')}</div>` : '<p class="faint">Log wins in the Wins Log; the best ones become your highlights.</p>'}
          <div class="section-h"><h2>➕ Extras</h2></div>
          <label class="field"><span>Languages, certificates, tools… one per line</span><textarea class="in" data-k="extras" rows="3" placeholder="Dutch (native), English (fluent)&#10;Google Analytics certificate">${esc(cur.extras || '')}</textarea></label>
          <p style="margin:22px 0 40px"><button class="btn btn-ghost btn-danger" data-del>🗑️ Delete this version</button></p>
        </div>
        <div class="cv-preview card" data-preview aria-label="Preview"></div>
      </div>`;
    preview();
    $('[data-version]', main).onchange = (e) => { cur = cvs.find((c) => c.id === e.target.value); render(); };
    $('[data-copy]', main).onclick = () => newVersion(cur);
    $('[data-new-v]', main).onclick = () => newVersion();
    $('[data-pdf]', main).onclick = savePdf;
    const det = $('[data-details]', main); if (det) det.onclick = BW.openSettings;
    $$('[data-k]', main).forEach((el) => el.oninput = () => { cur[el.dataset.k] = el.value; changed(); });
    $$('[data-pick]', main).forEach((g) => g.onclick = (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const k = g.dataset.pick, list = Array.isArray(cur[k]) ? cur[k].slice() : [], on = list.includes(b.dataset.v);
      cur[k] = on ? list.filter((x) => x !== b.dataset.v) : list.concat(b.dataset.v);
      b.setAttribute('aria-pressed', String(!on)); changed();
    });
    $$('[data-inc]', main).forEach((c) => {
      c.onclick = (e) => e.stopPropagation();
      c.onchange = () => { const set = new Set(Array.isArray(cur.include) ? cur.include : career.map((x) => x.id)); if (c.checked) set.add(c.dataset.inc); else set.delete(c.dataset.inc); cur.include = [...set]; changed(); };
    });
    $$('[data-career]', main).forEach((r) => { r.onclick = () => editCareer(career.find((e) => e.id === r.dataset.career)); r.onkeydown = (e) => { if (e.key === 'Enter') r.onclick(); }; });
    $('[data-add-career]', main).onclick = () => editCareer({ type: 'job' });
    $('[data-del]', main).onclick = async () => {
      if (!(await BW.confirm(`Delete “${esc(cur.name || 'this CV')}”? Your career history stays.`, { ok: 'Delete', danger: true }))) return;
      try { await BW.store.remove('cvs', cur.id); } catch (e) { return BW.error(e); }
      await load(); cur = cvs[0] || null; render();
    };
  }

  function preview() {
    const el = $('[data-preview]', main); if (!el) return;
    const m = G.cvModel(cur, { career, skills, wins, settings: BW.settings });
    const block = (title, list) => (list.length ? `<h4>${title}</h4>${list.map((x) => `<div class="cv-item"><div class="cv-row"><b>${esc(x.title || '')}</b><span>${esc(x.period)}</span></div>
      ${x.org || x.place ? `<div class="cv-org">${esc([x.org, x.place].filter(Boolean).join(', '))}</div>` : ''}${x.bullets.length ? `<ul>${x.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`).join('')}` : '');
    el.innerHTML = `<div class="cv-page">
      <h2>${esc(m.name || 'Your name')}</h2>${m.headline ? `<p class="cv-head">${esc(m.headline)}</p>` : ''}
      ${m.contact.length ? `<p class="cv-contact">${m.contact.map(esc).join(' · ')}</p>` : ''}
      ${m.summary ? `<p class="cv-summary">${esc(m.summary)}</p>` : ''}
      ${m.highlights.length ? `<h4>Highlights</h4><ul>${m.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      ${block('Experience', m.work)}${block('Education', m.education)}
      ${m.skills.length ? `<h4>Skills</h4><p>${m.skills.map(esc).join(' · ')}</p>` : ''}
      ${m.extras.length ? `<h4>More</h4><ul>${m.extras.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  function editCareer(e) {
    BW.recordDrawer({
      collection: 'career', rec: e, title: 'Career', newTitle: 'Add to your career',
      fields: [
        { k: 'type', label: 'What', type: 'chips', options: G.CAREER_TYPES },
        { k: 'title', label: 'Role, degree or project', ph: 'e.g. Marketing coordinator', span: 2, required: true },
        { k: 'org', label: 'Company or school', ph: 'e.g. Bakkerij De Gouden Korst' },
        { k: 'place', label: 'Where', ph: 'e.g. Utrecht' },
        { k: 'start', label: 'From (month)', type: 'month' },
        { k: 'end', label: 'Until (month)', type: 'month' },
        { k: 'current', label: 'Still doing this?', type: 'chips', options: [['', 'No'], ['1', 'Yes, until now']] },
        { k: 'bullets', label: 'What you did and achieved, one line each', type: 'textarea', ph: 'Ran the weekly newsletter for 4,000 customers\nCut report time from 3 hours to 20 minutes with SQL', span: 2 },
      ],
      bottom: () => (wins.length ? `<p class="faint" style="margin-top:10px">💡 Your wins, to borrow a line from: ${wins.slice(0, 5).map((w) => `<i>${esc(w.title)}${w.result ? ` (${esc(w.result)})` : ''}</i>`).join('; ')}</p>` : ''),
      onSaved: async (r, isNew) => {
        // Something new shows on the CV you're editing straight away.
        if (isNew && cur && Array.isArray(cur.include) && !cur.include.includes(r.id)) { cur.include = cur.include.concat(r.id); try { await BW.store.put('cvs', cur); } catch (err) { BW.error(err); } }
      },
      onClose: async () => { await load(); if (cur) cur = cvs.find((x) => x.id === cur.id) || cur; render(); },
    });
  }

  // The PDF: Busy's own PDF writer, A4, one clean column. Saved in CVs/ in your folder.
  function savePdf() {
    const m = G.cvModel(cur, { career, skills, wins, settings: BW.settings });
    const d = new BW.pdf.Doc(), W = d.W, H = d.H, M = 56, ink = '#1E1B2E', soft = '#5B5670', accent = '#13834F';
    let y = 64;
    const room = (h) => { if (y + h > H - 50) { d.addPage(); y = 60; } };
    const para = (txt, size = 10, color = ink, x = M, bold = false) => d.wrap(txt, W - M - x, size, bold).forEach((l) => { room(size + 5); d.text(l, x, y, { size, color, bold }); y += size + 4.5; });
    const heading = (t) => { room(36); y += 12; d.text(t.toUpperCase(), M, y, { size: 9, bold: true, color: accent }); y += 5; d.line(M, y, W - M, y, { color: '#DDD8E8' }); y += 15; };
    const bullets = (list, x = M) => list.forEach((b) => d.wrap(b, W - M - x - 12, 10).forEach((l, i) => { room(15); if (!i) d.rect(x + 2, y - 5, 3.5, 3.5, { fill: accent, r: 2 }); d.text(l, x + 12, y, { size: 10, color: ink }); y += 14.5; }));
    d.text(m.name || 'Your name', M, y, { size: 22, bold: true, color: ink }); y += 20;
    if (m.headline) para(m.headline, 11.5, soft);
    if (m.contact.length) { y += 2; para(m.contact.join('  ·  '), 9, soft); }
    if (m.summary) { y += 8; para(m.summary, 10.5); }
    if (m.highlights.length) { heading('Highlights'); bullets(m.highlights); }
    for (const [title, list] of [['Experience', m.work], ['Education', m.education]]) {
      if (!list.length) continue;
      heading(title);
      list.forEach((x) => {
        room(40);
        d.text(x.title || '', M, y, { size: 11, bold: true, color: ink });
        if (x.period) d.text(x.period, W - M, y, { size: 9, color: soft, align: 'right' });
        y += 14;
        if (x.org || x.place) { d.text([x.org, x.place].filter(Boolean).join(', '), M, y, { size: 9.5, color: soft }); y += 14; }
        bullets(x.bullets);
        y += 6;
      });
    }
    if (m.skills.length) { heading('Skills'); para(m.skills.join('  ·  ')); }
    if (m.extras.length) { heading('More'); bullets(m.extras); }
    const name = `${BW.fileSafe([m.name, cur.name].filter(Boolean).join(' - ') || 'CV')}.pdf`;
    BW.store.writeFile(`CVs/${name}`, d.blob(`${m.name} CV`))
      .then((r) => BW.toast(r.saved ? `Saved to ${esc(r.where)}` : `${esc(name)} is in your Downloads`, '📄'))
      .catch(BW.error);
  }
})();
