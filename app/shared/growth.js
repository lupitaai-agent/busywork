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

  // ---------- Job Tracker ----------
  G.STAGES = [['saved', '⭐ Saved'], ['applied', '📨 Applied'], ['interview', '🎤 Interview'], ['offer', '🎉 Offer'], ['closed', '📦 Closed']];
  G.CLOSED = [['accepted', '🥳 Accepted'], ['rejected', '🙅 Not this time'], ['withdrawn', '🚪 I withdrew'], ['no-answer', '👻 No answer']];
  G.stageOf = (a) => (G.CLOSED.some((c) => c[0] === a.status) ? 'closed' : G.STAGES.some((s) => s[0] === a.status) ? a.status : 'saved');
  const ACTIVE = ['applied', 'interview', 'offer'];
  // Which of your skills a job ad mentions (by name, as whole words), and which it doesn't.
  G.matchSkills = (ad, skills) => {
    const text = ' ' + String(ad || '').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ') + ' ';
    return skills.filter((s) => { const n = String(s.name || '').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim(); return n && text.includes(' ' + n + ' '); });
  };
  G.followUpsDue = (apps, today) => apps.filter((a) => ACTIVE.includes(a.status) && a.nextDate && a.nextDate <= today)
    .sort((a, b) => String(a.nextDate).localeCompare(String(b.nextDate)));
  // How the search is going: applications sent, how many got a reply (an interview, an offer or a no).
  G.jobStats = (apps) => {
    const sent = apps.filter((a) => a.status !== 'saved' && a.status !== 'withdrawn');
    const replied = sent.filter((a) => ['interview', 'offer', 'accepted', 'rejected'].includes(a.status) || a.heardBack);
    return { active: apps.filter((a) => ACTIVE.includes(a.status)).length, sent: sent.length, interviews: apps.filter((a) => a.reachedInterview || ['interview', 'offer', 'accepted'].includes(a.status)).length,
      offers: apps.filter((a) => ['offer', 'accepted'].includes(a.status)).length, replyRate: sent.length ? Math.round(replied.length / sent.length * 100) : 0 };
  };
  // Moving an application: keeps a small history, sets the next follow-up, remembers it reached an interview.
  G.moveTo = (a, status, today) => {
    const r = Object.assign({}, a, { status });
    r.history = (Array.isArray(a.history) ? a.history : []).concat([{ date: today, status }]);
    if (status === 'applied') { r.appliedAt = r.appliedAt || today; r.nextDate = BW.addDays(today, 7); r.nextStep = r.nextStep || 'Follow up if you haven’t heard back'; }
    if (status === 'interview') { r.reachedInterview = true; r.heardBack = true; r.nextStep = 'Prepare: stories for the skills they ask for'; }
    if (status === 'offer') r.heardBack = true;
    if (G.CLOSED.some((c) => c[0] === status)) { r.closedAt = today; r.nextDate = ''; if (status === 'rejected' || status === 'accepted') r.heardBack = true; }
    return r;
  };

  // ---------- CV Builder ----------
  G.CAREER_TYPES = [['job', '💼 Job'], ['education', '🎓 Education'], ['project', '🛠️ Project'], ['volunteer', '🤝 Volunteering']];
  const ym = (s) => String(s || '');
  // Newest first; what you're still doing on top.
  G.careerSort = (list) => list.slice().sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || ym(b.end || b.start).localeCompare(ym(a.end || a.start)) || ym(b.start).localeCompare(ym(a.start)));
  G.period = (e) => {
    const f = (v) => (v ? new Date(v + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '');
    return [f(e.start), e.current ? 'now' : f(e.end)].filter(Boolean).join(' – ');
  };
  const lines = (s) => String(s || '').split('\n').map((x) => x.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  // Everything a CV version shows, in order, ready to draw on screen or in a PDF.
  G.cvModel = (cv, { career = [], skills = [], wins = [], settings = {} }) => {
    const pick = (ids, list) => (Array.isArray(ids) ? ids : []).map((id) => list.find((x) => x.id === id)).filter(Boolean);
    const chosen = Array.isArray(cv.include) ? career.filter((e) => cv.include.includes(e.id)) : career;
    return {
      name: settings.ownerName || '', headline: cv.headline || settings.headline || '',
      contact: [settings.email, settings.phone, settings.linkedin, settings.city].filter(Boolean),
      summary: cv.summary || '',
      work: G.careerSort(chosen.filter((e) => e.type !== 'education')).map((e) => ({ title: e.title, org: e.org, place: e.place, period: G.period(e), bullets: lines(e.bullets) })),
      education: G.careerSort(chosen.filter((e) => e.type === 'education')).map((e) => ({ title: e.title, org: e.org, place: e.place, period: G.period(e), bullets: lines(e.bullets) })),
      highlights: pick(cv.winIds, wins).map((w) => (w.result ? `${w.title}: ${w.result}` : w.title)),
      skills: pick(cv.skillIds, skills).map((s) => s.name),
      extras: lines(cv.extras),
    };
  };
  const andList = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a.join(''));
  // A first draft of a cover letter, from the job and your own wins. Meant to be rewritten, never sent as is.
  G.coverLetter = (app, { settings = {}, wins = [], skills = [] }) => {
    const matched = G.matchSkills(app.adText, skills);
    const proof = wins.filter((w) => G.skillIds(w).some((id) => matched.some((s) => s.id === id))).slice(0, 2);
    const best = proof.length ? proof : wins.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 2);
    return [`Dear ${app.contact || 'hiring team'},`, '',
      `I’d like to apply for the ${app.role ? `${app.role} role` : 'role'} at ${app.company || 'your company'}.${settings.headline ? ` I’m currently ${settings.headline.replace(/^(a|an|the)\s+/i, (m) => m.toLowerCase())}.` : ''} [One line on why this company, in your own words.]`, '',
      matched.length ? `You’re looking for ${andList(matched.slice(0, 3).map((s) => (/[A-Z]{2}/.test(s.name) ? s.name : s.name.toLowerCase())))}. Two examples of what I bring:` : 'Two examples of what I bring:',
      ...best.map((w) => `- ${w.title}${w.result ? `: ${w.result}` : ''}.`), '',
      '[One line on what you’d like to do in this role.]', '',
      'I’d be glad to talk about how I can help.', '', 'Kind regards,', settings.ownerName || ''].join('\n');
  };

  // ---------- Interview Stories ----------
  // Common interview questions, with the words that tell which of your stories answer them.
  G.QUESTIONS = [
    ['Tell me about yourself.', []],
    ['Tell me about your biggest achievement.', []],
    ['Tell me about a time you solved a difficult problem.', ['problem', 'solve', 'fix', 'analysis', 'analys']],
    ['Describe a time you led a team or a project.', ['lead', 'leadership', 'project', 'team', 'manage']],
    ['Tell me about a conflict at work and how you handled it.', ['conflict', 'disagree', 'communication', 'team']],
    ['Tell me about a mistake you made, and what you learned.', ['mistake', 'failed', 'went wrong', 'error', 'my fault']],
    ['Describe a time you had to learn something quickly.', ['learn', 'course', 'new', 'quick']],
    ['Tell me about a time you used data to make a decision.', ['data', 'sql', 'excel', 'analys', 'numbers', 'report']],
    ['Describe a time you persuaded someone.', ['persuad', 'convinc', 'negotiat', 'sales', 'pitch', 'influence']],
    ['Tell me about working to a tight deadline.', ['deadline', 'time', 'urgent', 'project', 'deliver']],
    ['Describe a time you went the extra mile for a customer.', ['customer', 'client', 'service', 'user']],
    ['Tell me about a time you improved a process.', ['process', 'improv', 'faster', 'automat', 'efficien', 'rebuilt', 'streamlin']],
    ['Describe a time you had to prioritise.', ['priorit', 'busy', 'juggl', 'planning', 'deadline']],
    ['Tell me about a presentation you gave.', ['present', 'talk', 'speak', 'pitch', 'workshop']],
    ['Describe a time you took the initiative.', ['initiative', 'started', 'proposed', 'own', 'idea']],
    ['Tell me about a time you got difficult feedback.', ['feedback', 'criticism', 'critique', 'review']],
  ];
  const storyText = (s, skills) => [s.title, s.situation, s.task, s.action, s.result, s.tags, G.skillIds(s).map((id) => (skills.find((k) => k.id === id) || {}).name).join(' ')].join(' ').toLowerCase();
  // Your stories that answer a question: for the open questions, any story with a result.
  G.storiesFor = (question, stories, skills = []) => {
    const q = G.QUESTIONS.find((x) => x[0] === question), words = q ? q[1] : [];
    if (!words.length) return stories.filter((s) => s.result);
    return stories.filter((s) => { const t = storyText(s, skills); return words.some((w) => t.includes(w)); });
  };
  G.coverage = (stories, skills = []) => G.QUESTIONS.map(([q]) => ({ question: q, stories: G.storiesFor(q, stories, skills) }));
  // A win becomes a story to fill in: what happened goes in the situation, the result stays the result.
  G.storyFromWin = (w) => ({ title: w.title || '', situation: w.what || '', task: '', action: '', result: w.result || '', skillIds: G.skillIds(w).slice(), winId: w.id, tags: w.tags || '' });

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
