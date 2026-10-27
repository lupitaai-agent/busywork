/* CV Builder: one career history, as many CV versions as you need. Each version picks the jobs,
   skills and wins that fit the role, shows a live preview, and saves a real PDF in your folder. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let cvs = [], career = [], skills = [], wins = [], cur = null, dirty = false, view = 'cv';

  BW.boot({
    app: 'cv',
    onReady: async () => {
      await load();
      cur = cvs[0] || null;
      render();
      BW.route({
        'new': () => newVersion(),
        open: (id) => { const c = cvs.find((x) => x.id === id); if (c) { cur = c; view = 'cv'; render(); } },
        linkedin: () => { view = 'linkedin'; render(); },
        'import': () => BW.linkedin.importFlow({ onDone: async () => { await load(); render(); } }),
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
        skillIds: skills.filter((s) => BW.num(s.level) >= 3).map((s) => s.id), winIds: wins.filter((w) => w.result).slice(0, 4).map((w) => w.id), extras: BW.settings.languages || '' };
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
          <div class="row-flex" style="justify-content:center"><button class="btn btn-primary btn-big" data-new>＋ Start my CV</button><button class="btn btn-big" data-import>💼 Start from LinkedIn</button></div>
          <p class="faint" style="margin-top:10px">Starting from LinkedIn brings in your jobs, education, skills and certificates from LinkedIn’s own data download. Nothing is sent anywhere.</p></div>`;
      $('[data-new]', main).onclick = () => newVersion();
      $('[data-import]', main).onclick = () => BW.linkedin.importFlow({ onDone: async () => { await load(); if (career.length && !cvs.length) await newVersion(); else render(); } });
      return;
    }
    const included = new Set(Array.isArray(cur.include) ? cur.include : career.map((e) => e.id));
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">📄</span> CV Builder</h1><p class="lead">Your career once, then a CV for every role, and your LinkedIn profile from the same facts.</p></div>
        <div class="spacer"></div>
        <div class="filters" data-view role="tablist"><button type="button" data-v="cv" aria-pressed="${view === 'cv'}">📄 CV</button><button type="button" data-v="linkedin" aria-pressed="${view === 'linkedin'}">💼 LinkedIn</button></div>
      </div>
      ${view === 'linkedin' ? '<div data-li></div>' : `<div class="row-flex" style="margin:-8px 0 16px">
          <select class="in" data-version aria-label="CV version" style="width:auto">${cvs.map((c) => `<option value="${c.id}" ${c.id === cur.id ? 'selected' : ''}>${esc(c.name || 'CV')}</option>`).join('')}</select>
          <button class="btn" data-copy title="A copy to tailor for one job">📑 Copy</button>
          <button class="btn" data-new-v>＋ New</button>
          <button class="btn btn-primary btn-big" data-pdf><span class="emo">⬇️</span> Save PDF</button>
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
        <div><div class="cv-preview card" data-preview aria-label="Preview"></div><div class="card cv-check" data-check></div></div>
      </div>`}`;
    $('[data-view]', main).onclick = (e) => { const b = e.target.closest('[data-v]'); if (b && b.dataset.v !== view) { view = b.dataset.v; render(); } };
    if (view === 'linkedin') return linkedinView($('[data-li]', main));
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
    const ck = $('[data-check]', main);
    if (ck) {
      const items = G.cvCheck(m), ok = items.filter((i) => i.ok).length;
      ck.innerHTML = `<details ${ok < items.length ? 'open' : ''}><summary><b>✅ CV check: ${ok} of ${items.length}</b> <small class="faint">what recruiters and their software look for</small></summary>
        <ul class="checklist">${items.map((i) => `<li class="${i.ok ? 'ok' : ''}"><span>${i.ok ? '✓' : '○'}</span><div>${esc(i.text)}${i.tip ? `<small>${esc(i.tip)}</small>` : ''}</div></li>`).join('')}</ul></details>`;
    }
  }

  // LinkedIn: the same facts as your CV, as text to paste into your profile, within LinkedIn's limits.
  function linkedinView(el) {
    const L = BW.linkedin, s = BW.settings;
    const sec = L.sections({ settings: s, career, skills, wins });
    const count = (n, max) => `<small class="counter ${n > max ? 'over' : ''}">${n} / ${max}</small>`;
    const checks = L.checklist(sec, s), ok = checks.filter((i) => i.ok).length;
    el.innerHTML = `
      <div class="card li-import"><span class="emo">💼</span><div><b>${s.linkedinImportedAt ? `Imported from LinkedIn on ${BW.fmtDate(s.linkedinImportedAt)}` : 'Bring your LinkedIn in'}</b>
        <small>${s.linkedinImportedAt ? 'Import again any time: only what is new is added.' : 'Your jobs, education, skills, certificates and profile, from LinkedIn’s own data download. Nothing is sent anywhere.'}</small></div>
        <button class="btn ${s.linkedinImportedAt ? '' : 'btn-primary'}" data-import>📦 Import from LinkedIn</button></div>
      <div class="li-layout">
        <div>
          <div class="card li-sec"><div class="li-head"><h3>✍️ Headline</h3>${count(sec.headline.length, L.LIMITS.headline)}<button class="btn" data-copy-k="headline">📋 Copy</button></div>
            <textarea class="in" rows="2" data-li-k="headline" placeholder="e.g. Customer service lead learning data analysis · SQL, Excel, dashboards · Turning tickets into insight">${esc(sec.headline)}</textarea>
            <small class="faint">The line under your name. Say what you do, what you’re good at and where you’re heading.</small></div>
          <div class="card li-sec"><div class="li-head"><h3>📝 About</h3>${count(sec.about.length, L.LIMITS.about)}<button class="btn" data-copy-k="about">📋 Copy</button></div>
            <textarea class="in" rows="9" data-li-k="about" placeholder="Three short paragraphs: what you do and for whom; two results with numbers; what you’re looking for next.">${esc(sec.about)}</textarea>
            ${wins.filter((w) => w.result).length ? `<small class="faint">Results to use, from your Wins Log: ${wins.filter((w) => w.result).slice(0, 3).map((w) => `<i>${esc(w.result)}</i>`).join(' · ')}</small>` : ''}</div>
          <div class="section-h"><h2>💼 Experience</h2><small class="faint">Paste each into the description of the job on LinkedIn</small></div>
          ${sec.positions.length ? sec.positions.map((x) => `<div class="card li-sec"><div class="li-head"><h3>${esc(x.title)}${x.org ? ` · ${esc(x.org)}` : ''}</h3>${count(x.text.length, L.LIMITS.position)}${x.text ? `<button class="btn" data-copy-pos="${x.id}">📋 Copy</button>` : ''}</div>
            <small class="faint">${esc(x.period)}</small>${x.text ? `<pre class="li-text">${esc(x.text)}</pre>` : `<p class="faint">No lines yet. <button class="link" data-edit-job="${x.id}">Add what you did and achieved</button>.</p>`}</div>`).join('')
            : '<p class="faint">Add your jobs under 📄 CV, or import them from LinkedIn.</p>'}
          <div class="section-h"><h2>🧠 Skills</h2>${sec.skills.length ? '<button class="btn" data-copy-skills>📋 Copy all</button>' : ''}</div>
          ${sec.skills.length ? `<p>${sec.skills.map(esc).join(' · ')}</p><small class="faint">Strongest first. On LinkedIn, pin your top three to your profile.</small>` : '<p class="faint">Add skills in the <a href="../skills/index.html">Skills Map</a>.</p>'}
        </div>
        <aside class="card cv-check"><b>✅ Profile check: ${ok} of ${checks.length}</b>
          <ul class="checklist">${checks.map((i) => `<li class="${i.ok ? 'ok' : ''}"><span>${i.ok ? '✓' : '○'}</span><div>${esc(i.text)}${!i.ok && i.tip ? `<small>${esc(i.tip)}</small>` : ''}</div></li>`).join('')}</ul></aside>
      </div><div style="height:40px"></div>`;
    $('[data-import]', el).onclick = () => BW.linkedin.importFlow({ onDone: async () => { await load(); render(); } });
    const save = BW.debounce(async () => { try { await BW.store.saveSettings(Object.assign({}, BW.settings)); } catch (e) { BW.error(e); } }, 600);
    $$('[data-li-k]', el).forEach((t) => t.oninput = () => {
      BW.settings[t.dataset.liK] = t.value;
      t.parentElement.querySelector('.counter').outerHTML = count(t.value.length, L.LIMITS[t.dataset.liK]);
      save();
    });
    $$('[data-li-k]', el).forEach((t) => t.onchange = () => linkedinView(el)); // the checklist follows when you leave the field
    const copy = (text) => BW.copy(text).then(() => BW.toast('Copied. Paste it into LinkedIn.', '📋'));
    $$('[data-copy-k]', el).forEach((b) => b.onclick = () => copy(BW.settings[b.dataset.copyK] || ''));
    $$('[data-copy-pos]', el).forEach((b) => b.onclick = () => copy((sec.positions.find((x) => x.id === b.dataset.copyPos) || {}).text || ''));
    const cs = $('[data-copy-skills]', el); if (cs) cs.onclick = () => copy(sec.skills.join(', '));
    $$('[data-edit-job]', el).forEach((b) => b.onclick = () => editCareer(career.find((e) => e.id === b.dataset.editJob)));
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
