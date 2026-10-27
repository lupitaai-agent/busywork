/* Contacts: the people who help your career. Who they are, how you know them, when you last talked
   and when to catch up again. Message starters to copy: Busy never sends anything for you. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let contacts = [], apps = [], query = '', how = '';

  BW.boot({
    app: 'contacts',
    onReady: async () => {
      await load(); render();
      BW.route({
        'new': () => edit({ every: '3' }),
        open: (id) => { const c = contacts.find((x) => x.id === id); if (c) edit(c); },
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap') && !$('.modal-wrap')) render(); },
  });
  BW.shortcut('n', 'Add a contact', () => edit({ every: '3' }));
  BW.shortcut('/', 'Search contacts', () => { const s = $('[data-q]', main); if (s) s.focus(); });
  async function load() { [contacts, apps] = await Promise.all(['contacts', 'applications'].map((n) => BW.store.all(n))); }

  const howLabel = (v) => (G.HOW.find((h) => h[0] === v) || ['', ''])[1];
  const when = (iso) => {
    if (!iso) return '';
    const days = Math.round((new Date(iso + 'T12:00:00') - new Date(BW.today() + 'T12:00:00')) / 864e5);
    return days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === -1 ? 'yesterday' : Math.abs(days) >= 45 ? BW.fmtDate(iso) : days < 0 ? `${-days} days ago` : `in ${days} days`;
  };
  function shown() {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => (!how || c.how === how) && (!q || [c.name, c.role, c.org, c.notes, c.tags].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  function render() {
    const today = BW.today(), due = G.catchUpDue(contacts, today), list = shown();
    const talked = contacts.filter((c) => c.lastContact && c.lastContact >= BW.addDays(today, -30)).length;
    const hows = G.HOW.filter((h) => contacts.some((c) => c.how === h[0]));
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🤝</span> Contacts</h1><p class="lead">Most jobs come through people. Keep in touch with yours, a little and often.</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add a contact</button>
      </div>
      ${contacts.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--grape)"><div class="k">🤝 People</div><div class="v">${contacts.length}</div><div class="s">${contacts.filter((c) => BW.num(c.every) > 0).length} you keep in touch with</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">☕ Time to catch up</div><div class="v">${due.length}</div><div class="s">${due.length ? 'A short message is enough' : 'All caught up'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">💬 Talked to</div><div class="v">${talked}</div><div class="s">In the last 30 days</div></div>
      </div>
      ${due.length ? `<div class="section-h"><h2>☕ Time to catch up</h2></div>
        <div class="list" style="margin-bottom:22px">${due.map(row).join('')}</div>` : ''}
      <div class="toolbar">
        <input class="in search" type="search" data-q placeholder="Search names, companies, notes…" value="${esc(query)}" aria-label="Search contacts">
        ${hows.length > 1 ? `<div class="filters" data-how><button type="button" data-v="" aria-pressed="${!how}">Everyone</button>${hows.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${how === v}">${l}</button>`).join('')}</div>` : ''}
      </div>
      ${list.length ? `<div class="list">${list.map(row).join('')}</div>` : '<div class="card empty"><div class="big">🔍</div><h2>Nobody found</h2><p>Try another word, or clear the filter.</p></div>'}
      <div style="height:40px"></div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🤝</div><h2>The people in your corner</h2>
          <p>Old colleagues, a mentor, the recruiter who was nice, someone you met at an event. Add them here with how you know them, and Busy reminds you when it’s time to catch up again.</p>
          <button class="btn btn-primary btn-big" data-new>＋ Add my first contact</button></div>`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ every: '3' }));
    const q = $('[data-q]', main);
    if (q) q.oninput = BW.debounce(() => { query = q.value; const at = q.selectionStart; render(); const n = $('[data-q]', main); n.focus(); try { n.setSelectionRange(at, at); } catch (e) { /* ignore */ } }, 150);
    const h = $('[data-how]', main); if (h) h.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { how = b.dataset.v; render(); } };
    $$('.row[data-id]', main).forEach((r) => { r.onclick = () => edit(contacts.find((c) => c.id === r.dataset.id)); r.onkeydown = (e) => { if (e.key === 'Enter') r.onclick(); }; });
    $$('[data-chat]', main).forEach((b) => b.onclick = (e) => { e.stopPropagation(); logChat(contacts.find((c) => c.id === b.dataset.chat)); });
  }

  function row(c) {
    const next = G.nextContact(c), due = next && next <= BW.today();
    return `<div class="row" data-id="${c.id}" tabindex="0">
      <span class="icon-big">${(howLabel(c.how) || '🙂').split(' ')[0]}</span>
      <span class="main"><b>${esc(c.name || 'Someone')}</b>
        <small class="faint">${[c.role, c.org].filter(Boolean).map(esc).join(' at ') || esc(howLabel(c.how).replace(/^\S+\s/, ''))}</small>
        <span class="meta">${c.lastContact ? `<span class="chip chip-grey mini">💬 ${when(c.lastContact)}</span>` : '<span class="chip chip-grey mini">💬 not yet</span>'}${next ? `<span class="chip ${due ? 'chip-sun' : 'chip-grey'} mini">☕ ${due ? 'due ' : ''}${when(next)}</span>` : ''}${G.tags(c.tags).map((t) => `<span class="chip chip-grey mini"># ${esc(t)}</span>`).join('')}</span></span>
      <button class="btn" data-chat="${c.id}" title="Write down that you talked">📝 Log a chat</button>
    </div>`;
  }

  // Log a chat: what you talked about. It sets "last contact" and moves the next catch-up along.
  function logChat(c, done) {
    if (!c) return;
    const box = BW.html(`<div class="stack" style="--gap:12px">
      <label class="field"><span>When</span><input class="in" type="date" data-date value="${BW.today()}"></label>
      <label class="field"><span>What did you talk about?</span><textarea class="in" rows="4" data-note placeholder="What’s new with them, what you promised, anything to remember"></textarea></label></div>`);
    BW.modal({
      title: `📝 Chat with ${esc(String(c.name || '').split(' ')[0] || 'them')}`, body: box,
      actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
        const r = G.logChat(c, $('[data-date]', box).value || BW.today(), $('[data-note]', box).value);
        try { await BW.store.put('contacts', r); } catch (e) { BW.error(e); return false; }
        Object.assign(c, r);
        const next = G.nextContact(r);
        BW.toast(next ? `Logged. Next catch-up ${when(next)}.` : 'Logged.', '💬');
        if (done) done(r); else { await load(); render(); }
      } }],
    });
  }

  function edit(x) {
    const ref = BW.recordDrawer({
      collection: 'contacts', rec: x, title: 'Contact', newTitle: 'Add a contact',
      fields: [
        { k: 'name', label: 'Name', ph: 'e.g. Anna de Vries', required: true },
        { k: 'how', label: 'How you know them', type: 'select', options: [['', 'Pick one']].concat(G.HOW) },
        { k: 'role', label: 'What they do', ph: 'e.g. Head of marketing' },
        { k: 'org', label: 'Where', ph: 'e.g. Acme' },
        { k: 'email', label: 'Email', type: 'email' },
        { k: 'phone', label: 'Phone' },
        { k: 'linkedin', label: 'LinkedIn', type: 'url', ph: 'https://www.linkedin.com/in/…', span: 2 },
        { k: 'every', label: 'Keep in touch', type: 'chips', options: [['', 'No reminder'], ['1', 'Every month'], ['3', 'Every 3 months'], ['6', 'Every 6 months'], ['12', 'Once a year']], span: 2 },
        { k: 'nextDate', label: 'Next catch-up', type: 'date', hint: 'Leave empty to follow “keep in touch”.' },
        { k: 'tags', label: 'Tags', ph: 'e.g. design, Utrecht' },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'How you met, what they care about, their kids’ names…', span: 2 },
      ],
      bottom: (r) => r.id ? panels(r) : '',
      bind: (box, r, save) => {
        const chat = $('[data-log]', box);
        if (chat) chat.onclick = () => logChat(r, (n) => { Object.assign(r, n); const el = $('[name="nextDate"]', box); if (el) el.value = n.nextDate || ''; ref.redraw(); });
        const pick = $('[data-msg]', box), text = $('[data-msg-text]', box);
        if (pick) pick.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; $$('button', pick).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); text.value = G.message(b.dataset.v, r, BW.settings); text.focus(); };
        const copy = $('[data-msg-copy]', box); if (copy) copy.onclick = () => BW.copy(text.value).then(() => BW.toast('Copied. Make it yours, then send it your usual way.', '📋'));
        const mail = $('[data-msg-mail]', box); if (mail) mail.onclick = () => BW.openUrl(`mailto:${encodeURIComponent(r.email)}?body=${encodeURIComponent(text.value)}`);
        const li = $('[data-li]', box); if (li) li.onclick = () => BW.openUrl(r.linkedin);
      },
      onClose: async () => { await load(); render(); },
    });
  }

  function panels(r) {
    const theirs = apps.filter((a) => a.contactId === r.id);
    const log = Array.isArray(r.log) ? r.log : [];
    const next = G.nextContact(r);
    return `
      <div class="row-flex" style="margin-top:18px"><button type="button" class="btn btn-primary" data-log>📝 Log a chat</button>${r.linkedin ? '<button type="button" class="btn" data-li>↗ LinkedIn</button>' : ''}</div>
      ${next ? `<p class="faint" style="margin-top:8px">☕ Next catch-up ${when(next)}${r.nextDate ? '' : `, ${r.every === '12' ? 'once a year' : `every ${r.every === '1' ? 'month' : r.every + ' months'}`}`}.</p>` : ''}
      <h3 class="section-title" style="margin-top:18px"><span>✉️</span>Write to them</h3>
      <div class="choice-chips" data-msg>${G.MESSAGES.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="false">${l}</button>`).join('')}</div>
      <textarea class="in" data-msg-text rows="7" style="margin-top:8px" placeholder="Pick a starting point above, or write your own"></textarea>
      <div class="row-flex" style="margin-top:8px"><button type="button" class="btn" data-msg-copy>📋 Copy</button>${r.email ? '<button type="button" class="btn" data-msg-mail>📧 Open in my email</button>' : ''}</div>
      ${theirs.length ? `<h3 class="section-title" style="margin-top:18px"><span>🎯</span>Jobs they’re linked to</h3>
        <div class="list">${theirs.map((a) => `<a class="row" href="../jobs/index.html#open/${a.id}"><span class="main"><b>${esc([a.company, a.role].filter(Boolean).join(' · '))}</b></span><small class="faint">${esc((G.STAGES.concat(G.CLOSED).find((s) => s[0] === a.status) || ['', a.status || ''])[1])}</small></a>`).join('')}</div>` : ''}
      ${log.length ? `<h3 class="section-title" style="margin-top:18px"><span>🕒</span>Chats</h3>
        <div class="list">${log.map((l) => `<div class="row"><span class="main"><b>${BW.fmtDate(l.date)}</b>${l.note ? `<small class="faint" style="white-space:pre-wrap">${esc(l.note)}</small>` : ''}</span></div>`).join('')}</div>` : ''}`;
  }
})();
