/* Busy Growth: the logic the growth tools share, kept apart from the screens so it can be tested.
   Library search and imports, skill evidence, learning hours, the brag document, and picking up
   files someone dropped into the library/ folder outside Busy. */
(function () {
  'use strict';
  const BW = (window.BW = window.BW || {});
  const G = (BW.growth = {});

  G.LEVELS = ['Aware', 'Learning', 'Can do it', 'Strong', 'Expert']; // level 1 to 5
  G.KINDS = { link: ['🔗', 'Link'], note: ['📝', 'Note'], file: ['📎', 'File'] };
  G.LEARN_KINDS = [['course', '🎓 Course'], ['book', '📖 Book'], ['video', '🎬 Video'], ['project', '🛠️ Project'], ['certificate', '📜 Certificate'], ['other', '✨ Other']];
  G.LEARN_STATUS = [['planned', 'Planned'], ['doing', 'Doing'], ['done', 'Done'], ['dropped', 'Dropped']];

  // Tags are typed as "design, ai research"; kept as text, read as a clean list.
  G.tags = (s) => [...new Set(String(s || '').split(/[,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
  G.skillIds = (x) => (Array.isArray(x && x.skillIds) ? x.skillIds : []);

  // Files Busy can read as text (for search and, later, for Ivy). PDFs and others are kept and opened as they are.
  G.TEXT_FILES = /\.(md|markdown|txt|text|csv|html?|json)$/i;
  G.fileKind = (name) => {
    const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
    if (ext === 'pdf') return '📕';
    if (/^(png|jpe?g|gif|webp|svg|heic)$/.test(ext)) return '🖼️';
    if (/^(docx?|odt|rtf|pages)$/.test(ext)) return '📄';
    if (/^(xlsx?|ods|csv|numbers)$/.test(ext)) return '📊';
    if (/^(pptx?|odp|key)$/.test(ext)) return '📽️';
    if (/^(md|markdown|txt|text)$/.test(ext)) return '📝';
    return '📎';
  };
  // Readable text from a file's contents: HTML loses its tags, everything is cut to a sensible size.
  G.textOf = (name, raw, max = 20000) => {
    let s = String(raw || '');
    if (/\.html?$/i.test(name)) s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    return s.replace(/\s+/g, ' ').trim().slice(0, max);
  };

  // A name for a new file in library/ that doesn't overwrite one already there: "notes (2).pdf".
  G.freeName = (name, taken) => {
    const used = new Set((taken || []).map((x) => x.toLowerCase()));
    const clean = (BW.fileSafe ? BW.fileSafe(name) : String(name)) || 'file';
    if (!used.has(clean.toLowerCase())) return clean;
    const m = clean.match(/^(.*?)(\.[^.]+)?$/);
    for (let n = 2; ; n++) { const c = `${m[1]} (${n})${m[2] || ''}`; if (!used.has(c.toLowerCase())) return c; }
  };

  // Files in library/ that have no record yet (dropped in through Finder or Explorer), as new records.
  G.newFiles = (items, names) => {
    const known = new Set(items.filter((x) => x.path).map((x) => x.path.toLowerCase()));
    return names.filter((n) => !n.startsWith('.') && !known.has(('library/' + n).toLowerCase()))
      .map((n) => ({ kind: 'file', title: n.replace(/\.[^.]+$/, ''), path: 'library/' + n, fileName: n, status: 'to-read', tags: '', addedAt: (BW.today ? BW.today() : '') }));
  };

  // Bookmarks exported from Chrome, Edge, Firefox or Safari (the "Netscape bookmark file" every browser
  // writes). The folders a link sits in become its tags; the browser's own top folders don't.
  const ROOT_FOLDER = /^(bookmarks( bar| menu| toolbar)?|favorites|favourites|other bookmarks|mobile bookmarks)$/i;
  const unhtml = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
  G.parseBookmarks = (html) => {
    const out = [], stack = [];
    const tokens = /<DT><H3[^>]*>([\s\S]*?)<\/H3>|<DL>|<\/DL>|<DT><A\s+([^>]*)>([\s\S]*?)<\/A>/gi;
    let t, folder = null;
    while ((t = tokens.exec(String(html || '')))) {
      if (t[1] != null) { folder = unhtml(t[1]); continue; }
      const tag = t[0].toUpperCase();
      if (tag === '<DL>') { stack.push(folder); folder = null; continue; }
      if (tag === '</DL>') { stack.pop(); continue; }
      const href = (t[2].match(/HREF="([^"]*)"/i) || [])[1];
      if (!href || !/^https?:/i.test(href)) continue;
      const tags = stack.filter((f) => f && !ROOT_FOLDER.test(f)).join(', ').toLowerCase();
      out.push({ kind: 'link', url: unhtml(href), title: unhtml(t[3]) || unhtml(href), tags, status: 'to-read' });
    }
    return out;
  };

  // Search the Library: every word must appear somewhere; a hit in the title counts most.
  G.search = (items, q) => {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items.slice();
    const scored = [];
    for (const it of items) {
      const title = String(it.title || '').toLowerCase();
      const hay = [title, it.url, it.tags, it.notes, it.highlights, it.text, it.fileName].join(' ').toLowerCase();
      if (!words.every((w) => hay.includes(w))) continue;
      const score = words.reduce((s, w) => s + (title.includes(w) ? 3 : 0) + (String(it.tags || '').toLowerCase().includes(w) ? 2 : 0) + 1, 0);
      scored.push([score, it]);
    }
    return scored.sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  };
  // A few words around the first match, for showing why something was found.
  G.snippet = (it, q, len = 140) => {
    const w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean)[0];
    const src = [it.highlights, it.notes, it.text].filter(Boolean).join(' · ');
    if (!w || !src) return src.slice(0, len);
    const at = src.toLowerCase().indexOf(w);
    if (at < 0) return src.slice(0, len);
    let from = Math.max(0, at - 40);
    if (from) { const sp = src.lastIndexOf(' ', from); from = sp > 0 ? sp + 1 : 0; } // start at a whole word
    return (from ? '…' : '') + src.slice(from, from + len) + (from + len < src.length ? '…' : '');
  };

  // The proof behind a skill: what you saved, learned and achieved that names it.
  G.evidence = (skillId, { library = [], learning = [], wins = [] }) => {
    const has = (x) => G.skillIds(x).includes(skillId);
    return { library: library.filter(has), learning: learning.filter(has), wins: wins.filter(has) };
  };
  G.evidenceCount = (ev) => ev.library.length + ev.learning.length + ev.wins.length;
  // Biggest gaps first: how far the skill is from where you want it.
  G.gaps = (skills) => skills.filter((s) => BW.num(s.target) > BW.num(s.level))
    .sort((a, b) => (BW.num(b.target) - BW.num(b.level)) - (BW.num(a.target) - BW.num(a.level)) || String(a.name).localeCompare(String(b.name)));

  // Learning time. Sessions are { date, minutes } on each learning item.
  const mondayOf = (iso) => { const d = new Date(iso + 'T12:00:00'); const back = (d.getDay() + 6) % 7; d.setDate(d.getDate() - back); return d.toISOString().slice(0, 10); };
  G.weekStart = mondayOf;
  G.minutesBetween = (learning, from, to) => learning.reduce((sum, x) => sum + (Array.isArray(x.sessions) ? x.sessions : [])
    .filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + BW.num(s.minutes), 0), 0);
  G.weekMinutes = (learning, today) => { const from = mondayOf(today); return G.minutesBetween(learning, from, BW.addDays(from, 6)); };
  G.itemMinutes = (x) => (Array.isArray(x.sessions) ? x.sessions : []).reduce((a, s) => a + BW.num(s.minutes), 0);
  // Weeks in a row (counting back from this week or last week) with any learning logged.
  G.learningStreak = (learning, today) => {
    let week = mondayOf(today), n = 0;
    if (!G.minutesBetween(learning, week, BW.addDays(week, 6))) week = BW.addDays(week, -7);
    while (G.minutesBetween(learning, week, BW.addDays(week, 6)) > 0) { n++; week = BW.addDays(week, -7); }
    return n;
  };
  G.hours = (min) => { const h = min / 60; return (Math.round(h * 10) / 10).toLocaleString('en-GB') + ' h'; };

  // The brag document: a year of wins in Markdown, grouped by month, with the skills each one proves.
  // For a performance review, a raise conversation or the next CV.
  G.bragDoc = (wins, skills, year, name) => {
    const skillName = Object.fromEntries(skills.map((s) => [s.id, s.name]));
    const mine = wins.filter((w) => String(w.date || '').startsWith(String(year))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const lines = [`# ${name ? name + ': ' : ''}wins in ${year}`, '', `${mine.length} win${mine.length === 1 ? '' : 's'}, from the Busy Growth Wins Log.`, ''];
    let month = '';
    for (const w of mine) {
      const m = String(w.date).slice(0, 7);
      if (m !== month) { month = m; lines.push(`## ${new Date(m + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`, ''); }
      lines.push(`### ${w.title || 'A win'}`);
      if (w.what) lines.push('', w.what);
      if (w.result) lines.push('', `**Result:** ${w.result}`);
      const sk = G.skillIds(w).map((id) => skillName[id]).filter(Boolean);
      if (sk.length) lines.push('', `**Skills:** ${sk.join(', ')}`);
      if (w.proof) lines.push('', `**Proof:** ${w.proof}`);
      lines.push('');
    }
    return lines.join('\n');
  };

  // ---------- on screen: link anything to skills ----------
  // Chips for every skill (on = linked), plus a box to add a new skill on the spot.
  G.skillPickerHtml = (skills, selected) => `<div class="field span-2 skill-pick" data-skill-pick><span>Skills this shows or builds</span>
    <div class="choice-chips multi">${skills.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((s) => `<button type="button" data-skill="${BW.esc(s.id)}" aria-pressed="${(selected || []).includes(s.id)}">🧠 ${BW.esc(s.name)}</button>`).join('')}</div>
    <div class="row-flex" style="margin-top:8px"><input class="in" data-new-skill placeholder="Add a new skill, e.g. Public speaking" style="flex:1"><button type="button" class="btn" data-add-skill>＋ Add</button></div></div>`;
  G.bindSkillPicker = (box, rec, save, skills) => {
    const pick = BW.$('[data-skill-pick]', box); if (!pick) return;
    rec.skillIds = G.skillIds(rec).slice();
    pick.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-skill]');
      if (b) {
        const id = b.dataset.skill, on = rec.skillIds.includes(id);
        rec.skillIds = on ? rec.skillIds.filter((x) => x !== id) : rec.skillIds.concat(id);
        b.setAttribute('aria-pressed', String(!on));
        save();
        return;
      }
      if (e.target.closest('[data-add-skill]')) add();
    });
    const input = BW.$('[data-new-skill]', pick);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    async function add() {
      const name = input.value.trim(); if (!name) return;
      let s = skills.find((x) => String(x.name).toLowerCase() === name.toLowerCase());
      if (!s) { s = { name, level: 2, target: 3, category: '' }; try { await BW.store.put('skills', s); } catch (err) { return BW.error(err); } skills.push(s); }
      if (!rec.skillIds.includes(s.id)) rec.skillIds.push(s.id);
      const chips = BW.$('.choice-chips', pick);
      if (!BW.$(`[data-skill="${s.id}"]`, chips)) chips.insertAdjacentHTML('beforeend', `<button type="button" data-skill="${BW.esc(s.id)}" aria-pressed="true">🧠 ${BW.esc(s.name)}</button>`);
      else BW.$(`[data-skill="${s.id}"]`, chips).setAttribute('aria-pressed', 'true');
      input.value = '';
      save();
    }
  };
  // Skill names as small chips, for lists.
  G.skillChips = (ids, skills) => {
    const byId = Object.fromEntries(skills.map((s) => [s.id, s]));
    return (ids || []).map((id) => byId[id]).filter(Boolean).map((s) => `<span class="chip chip-grey mini">🧠 ${BW.esc(s.name)}</span>`).join('');
  };
})();
