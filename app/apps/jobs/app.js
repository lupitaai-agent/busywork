/* Job Tracker: every application on a board, from saved to offer, with follow-ups that never slip.
   Paste the job ad and see which of your skills it asks for; link the CV version you sent and the
   interview stories to prepare; draft a cover letter from your own wins. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let apps = [], skills = [], wins = [], cvs = [], stories = [], contacts = [];

  BW.boot({
    app: 'jobs',
    onReady: async () => {
      await load(); render();
      BW.route({
        'new': () => edit({ status: 'saved', savedAt: BW.today() }),
        paste: () => pasteAd(),
        open: (id) => { const x = apps.find((a) => a.id === id); if (x) edit(x); },
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  BW.shortcut('n', 'Add a job', () => edit({ status: 'saved', savedAt: BW.today() }));
  let career = [];
  async function load() { [apps, skills, wins, cvs, stories, contacts, career] = await Promise.all(['applications', 'skills', 'wins', 'cvs', 'stories', 'contacts', 'career'].map((n) => BW.store.all(n))); }
  const stars = (n) => (BW.num(n) ? '★'.repeat(BW.num(n)) + '☆'.repeat(5 - BW.num(n)) : '');

  // Paste the whole ad: Busy fills in what it can find, and you check it in the drawer.
  function pasteAd() {
    const box = BW.html(`<div class="stack" style="--gap:10px"><p>Copy everything on the job page (Ctrl or ⌘ A, then C) and paste it here. Busy picks out the company, role, place and salary, and keeps the ad for matching your skills.</p>
      <textarea class="in" rows="10" data-ad placeholder="Paste the job ad"></textarea></div>`);
    BW.modal({ title: '📋 Paste a job ad', body: box, wide: true, actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Add the job', kind: 'primary', onClick: () => {
      const text = $('[data-ad]', box).value.trim();
      if (!text) return false;
      const ad = G.parseAd(text);
      setTimeout(() => edit(Object.assign({ status: 'saved', savedAt: BW.today() }, ad)), 0);
    } }] });
  }

  const CLOSED = Object.fromEntries(G.CLOSED);
  const daysSince = (d) => Math.round((Date.parse(BW.today()) - Date.parse(d)) / 864e5);

  function render() {
    const today = BW.today(), due = G.followUpsDue(apps, today), st = G.jobStats(apps);
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🎯</span> Job Tracker</h1><p class="lead">Every application in one place, and a nudge when it’s time to follow up.</p></div>
        <div class="spacer"></div>
        <div class="row-flex"><button class="btn" data-new>＋ Add by hand</button><button class="btn btn-primary btn-big" data-paste><span class="emo">📋</span> Paste a job ad</button></div>
      </div>
      ${apps.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--tomato)"><div class="k">📨 Sent</div><div class="v">${st.sent}</div><div class="s">${st.active} still open</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">🎤 Interviews</div><div class="v">${st.interviews}</div><div class="s">${st.offers} offer${st.offers === 1 ? '' : 's'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">💬 Heard back</div><div class="v">${st.replyRate}%</div><div class="s">Silence is common. Follow up after a week.</div></div>
      </div>
      ${due.length ? `<div class="card gap-row" style="margin-bottom:18px;background:color-mix(in srgb, var(--sun) 25%, var(--surface))"><b>⏰ ${due.length} follow-up${due.length === 1 ? '' : 's'} due</b><span>${due.slice(0, 3).map((a) => `<button class="link" data-open-app="${a.id}">${esc(a.company || a.role)}</button>`).join(', ')}</span></div>` : ''}
      <div class="kanban" data-board>${G.STAGES.map(([id, label]) => {
        const list = apps.filter((a) => G.stageOf(a) === id).sort((a, b) => BW.num(b.interest) - BW.num(a.interest) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        return `<section class="col" data-col="${id}"><h3>${label} <small class="faint">${list.length}</small></h3><div class="col-list">${list.map(card).join('') || '<p class="faint col-empty">Drop a card here</p>'}</div></section>`;
      }).join('')}</div>
      <p class="faint" style="margin:6px 0 40px">💡 Drag a card to move it, or open it and pick its stage.</p>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🎯</div><h2>Track your first application</h2>
          <p>Save jobs you like, move them along as you apply and interview, and get a nudge to follow up after a week. Paste the job ad to see which of your skills it asks for.</p>
          <div class="row-flex" style="justify-content:center"><button class="btn btn-primary btn-big" data-paste>📋 Paste a job ad</button><button class="btn btn-big" data-new>＋ Add by hand</button></div></div>`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ status: 'saved', savedAt: BW.today() }));
    $$('[data-paste]', main).forEach((b) => b.onclick = pasteAd);
    $$('[data-open-app]', main).forEach((b) => b.onclick = () => edit(apps.find((a) => a.id === b.dataset.openApp)));
    $$('.job-card[data-id]', main).forEach((c) => {
      c.onclick = () => edit(apps.find((a) => a.id === c.dataset.id));
      c.onkeydown = (e) => { if (e.key === 'Enter') c.onclick(); };
      c.ondragstart = (e) => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('lifted'); };
      c.ondragend = () => c.classList.remove('lifted');
    });
    $$('[data-col]', main).forEach((col) => {
      col.ondragover = (e) => { e.preventDefault(); col.classList.add('over'); };
      col.ondragleave = () => col.classList.remove('over');
      col.ondrop = async (e) => {
        e.preventDefault(); col.classList.remove('over');
        const a = apps.find((x) => x.id === e.dataTransfer.getData('text/plain'));
        if (a && G.stageOf(a) !== col.dataset.col) await move(a, col.dataset.col === 'closed' ? 'rejected' : col.dataset.col);
      };
    });
  }

  function card(a) {
    const due = a.nextDate && a.nextDate <= BW.today() && ['applied', 'interview', 'offer'].includes(a.status);
    const matched = G.matchSkills(a.adText, skills);
    return `<div class="card job-card" data-id="${a.id}" draggable="true" tabindex="0">
      <b>${esc(a.company || 'Company?')}</b><span>${esc(a.role || 'Role?')}</span>
      ${BW.num(a.interest) ? `<small class="stars" aria-label="Interest ${BW.num(a.interest)} of 5">${stars(a.interest)}</small>` : ''}
      ${G.stageOf(a) === 'closed' ? `<small>${CLOSED[a.status] || ''}</small>` : ''}
      ${a.appliedAt && a.status !== 'saved' ? `<small class="faint">Applied ${daysSince(a.appliedAt) === 0 ? 'today' : `${daysSince(a.appliedAt)} day${daysSince(a.appliedAt) === 1 ? '' : 's'} ago`}</small>` : ''}
      ${due ? `<small class="due">⏰ Follow up ${a.nextDate < BW.today() ? 'now' : 'today'}</small>` : a.nextDate && G.stageOf(a) !== 'closed' ? `<small class="faint">📅 ${BW.fmtDate(a.nextDate)}</small>` : ''}
      ${matched.length ? `<small class="faint">🧠 ${matched.length} of your skills in the ad</small>` : ''}
      ${G.peopleAt(a.company, contacts).length ? `<small class="faint">🤝 You know ${G.peopleAt(a.company, contacts).length} ${G.peopleAt(a.company, contacts).length === 1 ? 'person' : 'people'} there</small>` : ''}
    </div>`;
  }

  async function move(a, status) {
    const r = G.moveTo(a, status, BW.today());
    try { await BW.store.put('applications', r); } catch (e) { return BW.error(e); }
    if (status === 'interview') BW.toast('An interview! Your stories for the skills they ask for are linked on the card.', '🎤');
    else if (status === 'offer' || status === 'accepted') { BW.confetti(); BW.toast('An offer! Well done.', '🎉', { label: 'Log it as a win', run: () => { location.href = '../wins/index.html#new'; } }); }
    else if (status === 'applied') BW.toast('Sent! We’ll remind you to follow up in a week.', '📨');
    await load(); render();
  }

  function edit(x) {
    const statusOptions = G.STAGES.filter((s) => s[0] !== 'closed').concat(G.CLOSED);
    BW.recordDrawer({
      collection: 'applications', rec: x, title: 'Application', newTitle: 'Add a job',
      fields: [
        { k: 'company', label: 'Company', ph: 'e.g. Acme', required: true },
        { k: 'role', label: 'Role', ph: 'e.g. Product marketing manager' },
        { k: 'url', label: 'Link to the ad', type: 'url', ph: 'https://…', span: 2 },
        { k: 'status', label: 'Stage', type: 'chips', options: statusOptions },
        { k: 'interest', label: 'How much do you want it?', type: 'chips', options: [['', 'Not sure'], ['1', '★'], ['2', '★★'], ['3', '★★★'], ['4', '★★★★'], ['5', '★★★★★']], span: 2 },
        { k: 'appliedAt', label: 'Applied on', type: 'date' },
        { k: 'nextDate', label: 'Next follow-up', type: 'date' },
        { k: 'nextStep', label: 'Next step', ph: 'e.g. Email Anna to ask about timing', span: 2 },
        { k: 'location', label: 'Where', ph: 'e.g. Utrecht, hybrid' },
        { k: 'salary', label: 'Salary', ph: 'e.g. €4,200 – €5,000' },
        { k: 'contact', label: 'Contact person', ph: 'e.g. Anna de Vries' },
        { k: 'source', label: 'Found via', ph: 'e.g. LinkedIn, a friend' },
        { k: 'adText', label: 'The job ad', type: 'textarea', ph: 'Paste the ad here to see which of your skills it asks for', span: 2 },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'Questions to ask, what you learned in the interview…', span: 2 },
      ],
      bottom: (r) => panels(r),
      bind: (box, r, save) => {
        // Moving the stage in the drawer keeps the same bookkeeping as dragging the card. The chips are
        // drawn again after the first save, so the listener goes on them, not on the drawer.
        $('[data-name="status"]', box).addEventListener('click', (e) => {
          const b = e.target.closest('[data-name="status"] button');
          if (b) { const moved = G.moveTo(Object.assign({}, r, { status: x.status }), b.dataset.v, BW.today()); ['appliedAt', 'nextDate', 'nextStep', 'reachedInterview', 'heardBack', 'closedAt', 'history'].forEach((k) => { r[k] = moved[k]; const el = $(`[name="${k}"]`, box); if (el) el.value = moved[k] || ''; }); x.status = b.dataset.v; save(); }
        });
        const ad = $('[name="adText"]', box);
        if (ad) ad.addEventListener('input', BW.debounce(() => { const m = $('[data-match]', box); if (m) m.innerHTML = matchHtml(ad.value); const w = $('[data-words]', box); if (w) w.innerHTML = wordsHtml(Object.assign({}, r, { adText: ad.value })); }, 300));
        const cv = $('[data-cv]', box); if (cv) cv.onchange = () => { r.cvId = cv.value; save(); const w = $('[data-words]', box); if (w) w.innerHTML = wordsHtml(r); };
        const who = $('[data-who]', box); if (who) who.onchange = () => { r.contactId = who.value; save(); };
        $$('[data-story]', box).forEach((b) => b.onclick = () => { const id = b.dataset.story, on = (r.storyIds || []).includes(id); r.storyIds = on ? r.storyIds.filter((s) => s !== id) : (r.storyIds || []).concat(id); b.setAttribute('aria-pressed', String(!on)); save(); });
        const draft = $('[data-draft]', box);
        if (draft) draft.onclick = () => { const l = $('[data-letter]', box); r.adText = ad ? ad.value : r.adText; l.value = G.coverLetter(r, { settings: BW.settings, wins, skills }); r.letter = l.value; save(); l.focus(); };
        const letter = $('[data-letter]', box); if (letter) letter.oninput = () => { r.letter = letter.value; save(); };
        const copy = $('[data-copy]', box); if (copy) copy.onclick = () => BW.copy(r.letter || '').then(() => BW.toast('Copied', '📋'));
      },
      onClose: async () => { await load(); render(); },
    });
  }

  function matchHtml(ad) {
    if (!String(ad || '').trim()) return '<p class="faint">Paste the job ad above to see which of your skills it mentions.</p>';
    const m = G.matchSkills(ad, skills);
    if (!skills.length) return '<p class="faint">Add skills to your <a href="../skills/index.html">Skills Map</a> to see how they match.</p>';
    return m.length ? `<p>The ad mentions <b>${m.length}</b> of your skills:</p><div class="meta">${m.map((s) => `<span class="chip chip-mint mini">✓ ${esc(s.name)}</span>`).join('')}</div>`
      : '<p class="faint">The ad doesn’t name any of your skills word for word. Read it again for what they really need.</p>';
  }

  // The ad's own words that the CV you sent (or your newest CV) doesn't use. Add the ones that are true.
  function wordsHtml(r) {
    if (!String(r.adText || '').trim()) return '';
    const cv = cvs.find((c) => c.id === r.cvId) || cvs[0];
    if (!cv) return '<p class="faint" style="margin-top:8px">Make a CV in the <a href="../cv/index.html">CV Builder</a> to see which of the ad’s words it misses.</p>';
    const missing = G.missingKeywords(r.adText, G.cvText(G.cvModel(cv, { career, skills, wins, settings: BW.settings })), 12, [r.company, r.location]);
    return `<p style="margin-top:10px">${missing.length ? `Words in the ad that <b>${esc(cv.name || 'your CV')}</b> doesn’t use:` : `✓ <b>${esc(cv.name || 'Your CV')}</b> uses the ad’s main words.`}</p>
      ${missing.length ? `<div class="meta">${missing.map((k) => `<span class="chip chip-sun mini">${esc(k)}</span>`).join('')}</div><p class="faint" style="margin-top:6px">Recruiters and their software look for these. Add the ones that are true for you, in your own words.</p>` : ''}`;
  }

  function panels(r) {
    const matched = G.matchSkills(r.adText, skills).map((s) => s.id);
    const suggested = stories.filter((s) => G.skillIds(s).some((id) => matched.includes(id)));
    const list = suggested.concat(stories.filter((s) => !suggested.includes(s)));
    return `
      <h3 class="section-title" style="margin-top:18px"><span>🧠</span>Skills match</h3><div data-match>${matchHtml(r.adText)}</div>
      <div data-words>${wordsHtml(r)}</div>
      <h3 class="section-title" style="margin-top:18px"><span>📄</span>CV you sent</h3>
      ${cvs.length ? `<select class="in" data-cv><option value="">Not chosen</option>${cvs.map((c) => `<option value="${c.id}" ${c.id === r.cvId ? 'selected' : ''}>${esc(c.name || 'CV')}</option>`).join('')}</select>
        ${r.cvId ? `<p style="margin-top:8px"><a class="btn" href="../cv/index.html#open/${r.cvId}">📄 Open this CV</a></p>` : ''}`
      : '<p class="faint">Make a CV in the <a href="../cv/index.html">CV Builder</a> and pick it here.</p>'}
      <h3 class="section-title" style="margin-top:18px"><span>🤝</span>Who you know there</h3>
      ${(() => { const p = G.peopleAt(r.company, contacts).filter((c) => c.id !== r.contactId); return p.length ? `<p style="margin-bottom:8px">In your Contacts at ${esc(r.company)}: ${p.slice(0, 4).map((c) => `<a href="../contacts/index.html#open/${c.id}">${esc(c.name)}</a>${c.role ? ` (${esc(c.role)})` : ''}`).join(', ')}. A referral beats a cold application.</p>` : ''; })()}
      ${contacts.length ? `<select class="in" data-who><option value="">Nobody yet</option>${contacts.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((c) => `<option value="${c.id}" ${c.id === r.contactId ? 'selected' : ''}>${esc(c.name || 'Someone')}${c.org ? ` (${esc(c.org)})` : ''}</option>`).join('')}</select>
        ${r.contactId ? `<p style="margin-top:8px"><a class="btn" href="../contacts/index.html#open/${r.contactId}">🤝 Open contact</a></p>` : ''}`
      : '<p class="faint">A referral beats a cold application. Add people to <a href="../contacts/index.html">Contacts</a> and link them here.</p>'}
      <h3 class="section-title" style="margin-top:18px"><span>🎤</span>Stories to prepare</h3>
      ${list.length ? `<div class="choice-chips multi">${list.map((s) => `<button type="button" data-story="${s.id}" aria-pressed="${(r.storyIds || []).includes(s.id)}">${suggested.includes(s) ? '⭐ ' : ''}${esc(s.title || 'Story')}</button>`).join('')}</div>
        ${suggested.length ? '<p class="faint" style="margin-top:6px">⭐ = proves a skill the ad asks for</p>' : ''}`
      : '<p class="faint">Write your best stories in <a href="../stories/index.html">Interview Stories</a>.</p>'}
      <h3 class="section-title" style="margin-top:18px"><span>✉️</span>Cover letter</h3>
      <p class="faint" style="margin-bottom:8px">A first draft from the ad and your wins. Make it yours before you send it.</p>
      <textarea class="in" data-letter rows="10" placeholder="Your cover letter">${esc(r.letter || '')}</textarea>
      <div class="row-flex" style="margin-top:8px"><button type="button" class="btn" data-draft>✍️ Draft from my wins</button><button type="button" class="btn" data-copy>📋 Copy</button></div>
      ${Array.isArray(r.history) && r.history.length ? `<h3 class="section-title" style="margin-top:18px"><span>🕒</span>History</h3><div class="list">${r.history.slice().reverse().map((h) => `<div class="row"><span class="main">${BW.fmtDate(h.date)}</span><b>${esc((G.STAGES.concat(G.CLOSED).find((s) => s[0] === h.status) || ['', h.status])[1])}</b></div>`).join('')}</div>` : ''}`;
  }
})();
