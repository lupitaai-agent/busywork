/* Library: everything you read and learn, kept in your own folder. Links with why they matter,
   notes, and files (saved in library/), tagged by topic and skill, and found again in a second. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let items = [], skills = [], query = '', kind = 'all', status = 'all', tag = '';

  BW.boot({
    app: 'library',
    onReady: async () => {
      await load();
      await pickUpFiles();
      render();
      BW.route({
        'new': (what) => (what === 'note' ? edit({ kind: 'note' }) : what === 'file' ? chooseFiles() : edit({ kind: 'link', status: 'to-read' })),
        open: (id) => { const x = items.find((i) => i.id === id); if (x) edit(x); },
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  BW.shortcut('n', 'Save a link', () => edit({ kind: 'link', status: 'to-read' }));
  BW.shortcut('/', 'Search the library', () => { const s = $('[data-q]', main); if (s) s.focus(); });

  async function load() { [items, skills] = await Promise.all([BW.store.all('library'), BW.store.all('skills')]); }

  // Files dropped into library/ with Finder or Explorer get a record the next time the Library opens,
  // and files that can be read (text, PDF, Word and other Office files) get their text, once.
  async function pickUpFiles() {
    if (BW.store.kind !== 'folder' || BW.store.readOnly) return;
    const fresh = G.newFiles(items, await BW.store.listFiles('library'));
    for (const r of fresh) await readText(r);
    const unread = items.filter((x) => x.kind === 'file' && x.path && !x.text && !x.textTried && readable(x.fileName));
    for (const r of unread) await readText(r);
    const changed = fresh.concat(unread);
    if (!changed.length) return;
    try { await BW.store.putMany('library', changed); } catch (e) { return BW.error(e); }
    if (fresh.length) BW.toast(`Picked up ${fresh.length} new file${fresh.length === 1 ? '' : 's'} from your library folder`, '📎');
    else if (unread.some((x) => x.text)) BW.toast(`Made ${unread.filter((x) => x.text).length} file${unread.filter((x) => x.text).length === 1 ? '' : 's'} searchable`, '🔎');
    await load();
  }
  const readable = (name) => G.TEXT_FILES.test(name || '') || (BW.fileText && BW.fileText.CAN.test(name || ''));
  // The words in a file, for search: plain text read directly, PDF and Office files through fileText.
  async function textFrom(name, blob) {
    if (G.TEXT_FILES.test(name)) return G.textOf(name, await blob.text());
    return BW.fileText && BW.fileText.CAN.test(name) ? BW.fileText.read(name, blob) : '';
  }
  async function readText(r, blob) {
    if (!readable(r.fileName)) return;
    try { const f = blob || await BW.store.readFile(r.path); if (f) r.text = await textFrom(r.fileName, f); } catch (e) { /* kept without text */ }
    r.textTried = true;
  }

  const tagsOf = () => {
    const count = {};
    items.forEach((x) => G.tags(x.tags).forEach((t) => { count[t] = (count[t] || 0) + 1; }));
    return Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map((x) => x[0]);
  };
  function shown() {
    let list = items.filter((x) => (kind === 'all' || x.kind === kind) && (status === 'all' || (status === 'read' ? x.status === 'read' : x.status !== 'read'))
      && (!tag || G.tags(x.tags).includes(tag)));
    list = query ? G.search(list, query) : list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return list;
  }

  function render() {
    const list = shown(), tags = tagsOf(), unread = items.filter((x) => x.status !== 'read').length;
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">📚</span> Library</h1><p class="lead">Everything you read and learn, kept in your own folder and easy to find again.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          <button class="btn" data-import title="Import bookmarks from your browser">⭐ Import bookmarks</button>
          <button class="btn" data-files><span class="emo">📎</span> Add files</button>
          <button class="btn" data-note><span class="emo">📝</span> Note</button>
          <button class="btn btn-primary btn-big" data-link><span class="emo">🔗</span> Save a link</button>
        </div>
      </div>
      ${items.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--sky)"><div class="k">📚 In your library</div><div class="v">${items.length}</div><div class="s">${items.filter((x) => x.kind === 'link').length} links · ${items.filter((x) => x.kind === 'note').length} notes · ${items.filter((x) => x.kind === 'file').length} files</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">👀 Still to read</div><div class="v">${unread}</div><div class="s">${unread ? 'Pick one for your next coffee' : 'All caught up'}</div></div>
        <div class="card stat" style="--tint:var(--pink)"><div class="k">🧠 Linked to skills</div><div class="v">${items.filter((x) => G.skillIds(x).length).length}</div><div class="s">Proof for your Skills Map</div></div>
      </div>
      <div class="toolbar">
        <input class="in search" type="search" data-q placeholder="Search titles, notes, highlights and file text…" value="${esc(query)}" aria-label="Search the library">
        <div class="filters" data-kind>${[['all', 'All'], ['link', '🔗 Links'], ['note', '📝 Notes'], ['file', '📎 Files']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${kind === v}">${l}</button>`).join('')}</div>
        <div class="filters" data-status>${[['all', 'Any'], ['todo', 'To read'], ['read', 'Read']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${status === v}">${l}</button>`).join('')}</div>
      </div>
      ${tags.length ? `<div class="filters" data-tags style="margin:-6px 0 18px">${tags.map((t) => `<button type="button" data-v="${esc(t)}" aria-pressed="${tag === t}"># ${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="drop-hint">📎 Drop files anywhere on this page to add them to your library folder</div>
      ${list.length ? `<div class="list">${list.map(row).join('')}</div>` : `<div class="card empty"><div class="big">🔍</div><h2>Nothing found</h2><p>Try another word, or clear the filters.</p></div>`}
      <div style="height:40px"></div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">📚</div><h2>Start your library</h2>
          <p>Save the articles, videos and courses that teach you something, with a line on why they matter. Add your notes and files too. Everything stays in your own folder, ready when you need it again.</p>
          <div class="row-flex" style="justify-content:center"><button class="btn btn-primary btn-big" data-link>🔗 Save my first link</button><button class="btn btn-big" data-files>📎 Add files</button><button class="btn btn-big" data-import>⭐ Import bookmarks</button></div></div>`}`;
    $$('[data-link]', main).forEach((b) => b.onclick = () => edit({ kind: 'link', status: 'to-read' }));
    $$('[data-note]', main).forEach((b) => b.onclick = () => edit({ kind: 'note' }));
    $$('[data-files]', main).forEach((b) => b.onclick = chooseFiles);
    $$('[data-import]', main).forEach((b) => b.onclick = importBookmarks);
    const q = $('[data-q]', main);
    if (q) q.oninput = BW.debounce(() => { query = q.value; const at = q.selectionStart; render(); const n = $('[data-q]', main); n.focus(); try { n.setSelectionRange(at, at); } catch (e) { /* ignore */ } }, 150);
    const pick = (sel, set) => { const g = $(sel, main); if (g) g.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { set(b.dataset.v); render(); } }; };
    pick('[data-kind]', (v) => { kind = v; });
    pick('[data-status]', (v) => { status = v; });
    pick('[data-tags]', (v) => { tag = tag === v ? '' : v; });
    $$('.row[data-id]', main).forEach((r) => {
      r.onclick = () => edit(items.find((x) => x.id === r.dataset.id));
      r.onkeydown = (e) => { if (e.key === 'Enter') r.onclick(); };
    });
    $$('[data-open]', main).forEach((b) => b.onclick = (e) => { e.stopPropagation(); open(items.find((x) => x.id === b.dataset.open)); });
  }

  function row(x) {
    const [emo] = G.KINDS[x.kind] || G.KINDS.link;
    const icon = x.kind === 'file' ? G.fileKind(x.fileName) : emo;
    const host = x.url ? (String(x.url).match(/^https?:\/\/([^/]+)/i) || [, ''])[1].replace(/^www\./, '') : '';
    const snip = query ? G.snippet(x, query) : (x.notes || x.highlights || '').slice(0, 140);
    return `<div class="row" data-id="${x.id}" tabindex="0">
      <span class="icon-big">${icon}</span>
      <span class="main"><b>${esc(x.title || x.url || x.fileName || 'Untitled')}</b>
        <small class="faint">${[host, x.kind === 'file' ? esc(x.fileName || '') : '', x.addedAt ? BW.fmtDate(x.addedAt) : ''].filter(Boolean).map((s) => esc(s)).join(' · ')}</small>
        ${snip ? `<div class="snip">${esc(snip)}</div>` : ''}
        <span class="meta">${G.tags(x.tags).map((t) => `<span class="chip chip-grey mini"># ${esc(t)}</span>`).join('')}${G.skillChips(G.skillIds(x), skills)}</span></span>
      ${x.kind !== 'note' ? `<button class="btn" data-open="${x.id}" title="Open">${x.kind === 'file' ? '📂 Open' : '↗ Open'}</button>` : ''}
      ${x.kind !== 'note' ? `<span class="status-pill ${x.status === 'read' ? 'done' : x.status === 'reading' ? 'doing' : 'todo'}">${x.status === 'read' ? 'Read' : x.status === 'reading' ? 'Reading' : 'To read'}</span>` : ''}
    </div>`;
  }

  async function open(x) {
    if (!x) return;
    if (x.kind === 'link' && x.url) { BW.openUrl(x.url); return; }
    if (x.kind === 'file') {
      const f = await BW.store.readFile(x.path).catch(() => null);
      if (!f) { BW.toast('That file isn’t in your library folder any more', '🤔'); return; }
      const url = URL.createObjectURL(f);
      BW.openUrl(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  function edit(x) {
    const k = x.kind || 'link';
    const status = { k: 'status', label: 'Status', type: 'chips', options: [['to-read', '👀 To read'], ['reading', '📖 Reading'], ['read', '✅ Read']] };
    const fields = k === 'link' ? [
      { k: 'url', label: 'Link', type: 'url', ph: 'https://…', span: 2 },
      { k: 'title', label: 'Title', ph: 'What is it?', span: 2 },
      { k: 'notes', label: 'Why it matters', type: 'textarea', ph: 'One line for future you: what did you learn, or why save it?', span: 2 },
      { k: 'highlights', label: 'Highlights and quotes', type: 'textarea', ph: 'Paste the bits worth remembering', span: 2 },
      { k: 'tags', label: 'Tags', ph: 'e.g. pricing, ai, interviews', span: 2 }, status,
    ] : k === 'note' ? [
      { k: 'title', label: 'Title', ph: 'e.g. What I learned at the SEO meetup', span: 2 },
      { k: 'notes', label: 'Your note', type: 'textarea', ph: 'Write it the way you’d explain it to a friend.', span: 2 },
      { k: 'tags', label: 'Tags', ph: 'e.g. seo, meetup', span: 2 },
    ] : [
      { k: 'title', label: 'Title', span: 2 },
      { k: 'notes', label: 'Why it matters', type: 'textarea', ph: 'What’s in it, and why you kept it', span: 2 },
      { k: 'highlights', label: 'Highlights and quotes', type: 'textarea', span: 2 },
      { k: 'tags', label: 'Tags', span: 2 }, status,
    ];
    BW.recordDrawer({
      collection: 'library', rec: Object.assign({ addedAt: BW.today() }, x), title: k === 'note' ? 'Note' : k === 'file' ? 'File' : 'Link',
      newTitle: k === 'note' ? 'Write a note' : 'Save a link', fields,
      top: (r) => (r.kind === 'file' || (r.kind === 'link' && r.url) ? `<div class="open-row"><button type="button" class="btn" data-open-this>${r.kind === 'file' ? `📂 Open ${esc(r.fileName || 'file')}` : '↗ Open the link'}</button>
        ${r.kind === 'file' && r.size ? `<span class="faint">${Math.max(1, Math.round(r.size / 1024)).toLocaleString('en-GB')} KB · in library/</span>` : ''}</div>
        ${r.kind === 'file' ? `<p class="faint" style="margin:-4px 0 14px">${fileSearch(r)}</p>` : ''}` : ''),
      bottom: (r) => G.skillPickerHtml(skills, G.skillIds(r)),
      bind: (box, r, save) => {
        G.bindSkillPicker(box, r, save, skills);
        const o = $('[data-open-this]', box); if (o) o.onclick = () => open(r);
        const url = $('[name="url"]', box), title = $('[name="title"]', box);
        // A pasted link gets a readable title until you write a better one.
        if (url && title) url.addEventListener('change', () => { if (!title.value.trim() && url.value.trim()) { title.value = titleFromUrl(url.value.trim()); save(); } });
        const st = $('[data-name="status"]', box);
        if (st) st.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.v === 'read' && !r.readAt) { r.readAt = BW.today(); save(); } });
      },
      isComplete: (r) => !!(r.url || r.title || r.notes || r.path),
      onClose: async (r) => {
        if (r && r.deleted && r.path) { try { await BW.store.removeFile(r.path); } catch (e) { BW.error(e); } }
        await load(); render();
      },
      confirmDelete: x.kind === 'file' ? 'This removes the file from your library folder too.' : null,
    });
  }
  // Whether a file's words are in the search, and why not when they aren't.
  function fileSearch(r) {
    const words = r.text ? r.text.split(/\s+/).filter(Boolean).length : 0;
    if (words) return `🔎 Searchable: about ${words.toLocaleString('en-GB')} words${words >= 3000 ? ' (the first part)' : ''}`;
    if (/\.doc$/i.test(r.fileName || '')) return '🔎 Old Word files (.doc) can’t be searched. Save it as .docx and add it again.';
    if (readable(r.fileName)) return r.textTried ? '🔎 No text found: perhaps a scan, a photo of text or a protected file. Add notes to find it by.' : '🔎 Not read yet';
    return '🔎 Found by its title, tags and notes';
  }
  const titleFromUrl = (u) => {
    const m = u.match(/^https?:\/\/(?:www\.)?([^/?#]+)(\/[^?#]*)?/i);
    if (!m) return u;
    const last = (m[2] || '').split('/').filter(Boolean).pop() || '';
    const words = decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
    return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)} (${m[1]})` : m[1];
  };

  // ---------- files ----------
  function chooseFiles() {
    if (BW.store.kind !== 'folder') { BW.toast('Files are kept in your Busy Growth folder. Pick one with the 📁 button first.', '📁'); return; }
    const input = BW.html('<input type="file" multiple hidden>');
    document.body.append(input);
    input.onchange = () => { addFiles([...input.files]); input.remove(); };
    input.click();
  }
  async function addFiles(files) {
    if (!files.length) return;
    if (BW.store.kind !== 'folder') { BW.toast('Files are kept in your Busy Growth folder. Pick one with the 📁 button first.', '📁'); return; }
    const taken = await BW.store.listFiles('library');
    const recs = [];
    for (const f of files) {
      const name = G.freeName(f.name, taken);
      taken.push(name);
      try { await BW.store.writeFile('library/' + name, f, { download: false }); } catch (e) { BW.error(e); continue; }
      const r = { kind: 'file', title: f.name.replace(/\.[^.]+$/, ''), path: 'library/' + name, fileName: name, size: f.size, status: 'to-read', tags: '', addedAt: BW.today() };
      await readText(r, f);
      recs.push(r);
    }
    if (!recs.length) return;
    try { await BW.store.putMany('library', recs); } catch (e) { return BW.error(e); }
    BW.toast(`Added ${recs.length} file${recs.length === 1 ? '' : 's'} to your library`, '📎');
    await load(); render();
    if (recs.length === 1) edit(items.find((x) => x.path === recs[0].path));
  }
  let depth = 0;
  document.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { depth++; document.body.classList.add('dragging'); } });
  document.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('dragging'); });
  document.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
    addFiles([...e.dataTransfer.files]);
  });

  // ---------- bookmarks ----------
  function importBookmarks() {
    const box = BW.html(`<div><p>Export your bookmarks from your browser, then choose the file here. The folders they’re in become tags. Links you already saved are skipped.</p>
      <ul class="faint" style="margin:12px 0 16px 1.1em"><li><b>Chrome or Edge:</b> Bookmarks manager → ⋮ → Export bookmarks</li><li><b>Firefox:</b> Bookmarks → Manage bookmarks → Import and backup → Export to HTML</li><li><b>Safari:</b> File → Export → Bookmarks</li></ul>
      <input type="file" accept=".html,.htm,text/html" data-bm class="in"><p data-found style="margin-top:12px;font-weight:700"></p></div>`);
    let found = [];
    BW.$('[data-bm]', box).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const have = new Set(items.map((x) => String(x.url || '').toLowerCase()));
      found = G.parseBookmarks(await f.text()).filter((x) => !have.has(x.url.toLowerCase()));
      BW.$('[data-found]', box).textContent = found.length ? `${found.length} new link${found.length === 1 ? '' : 's'} to import.` : 'No new links found in that file.';
    };
    BW.modal({ title: '⭐ Import bookmarks', body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Import', kind: 'primary', onClick: async () => {
      if (!found.length) { BW.toast('Choose your bookmarks file first', '⭐'); return false; }
      const today = BW.today();
      try { await BW.store.putMany('library', found.map((x) => Object.assign(x, { addedAt: today }))); } catch (e) { BW.error(e); return false; }
      BW.toast(`Imported ${found.length} link${found.length === 1 ? '' : 's'}`, '⭐');
      await load(); render();
    } }] });
  }
})();
