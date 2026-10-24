/* Olaf's workspace: its files and the tools Claude can call on them.
   Files are one Busywork collection ('olaf-files', one record per path), so they live in the owner's
   folder or browser like everything else. Finished work is also written as a plain file under Olaf/
   in the owner's folder. Skills are read-only and come from the bundled library. */
(function () {
  'use strict';
  const LIB = BW.olafLibrary;
  const COLL = 'olaf-files';
  const WRITABLE = ['brand-documents/', 'memory/', 'output/', 'content-inbox/'];
  const READABLE = WRITABLE.concat(['skills/']);
  const MAX_FILE = 400000; // characters; bigger files are cut when read, refused when written

  let files = new Map(); // path → record

  const ws = (BW.olafWs = {
    WRITABLE,
    async load() {
      files = new Map((await BW.store.all(COLL)).map((r) => [r.path, r]));
      return files;
    },
    // A new workspace starts from the blank templates. An owner who already filled in the Marketing
    // Studio's brand profile gets it as their growth profile straight away.
    async ensureSeeded() {
      await ws.load();
      const add = [];
      for (const [path, content] of Object.entries(LIB.templates)) if (!files.has(path)) add.push(rec(path, content));
      ['output/', 'content-inbox/'].forEach((d) => { if (!ws.list(d).length && !files.has(d + 'README.md')) add.push(rec(d + 'README.md', d === 'output/' ? '# Output\n\nFinished work from Olaf lands here.\n' : '# Content inbox\n\nDrop notes, exports and drafts here for Olaf to work from.\n')); });
      const growth = files.get('brand-documents/brand-growth-profile.md');
      const growthBlank = !growth || /\[FILL/.test(growth.content) && (growth.content.match(/\[FILL/g) || []).length > 8;
      if (growthBlank && BW.mkt && BW.mkt.olafMarkdown) {
        const prof = (await BW.store.all('mktprofile'))[0];
        if (prof && (prof.category || (prof.ceps || []).length)) add.push(rec('brand-documents/brand-growth-profile.md', BW.mkt.olafMarkdown(Object.assign(BW.mkt.blank(), prof))));
      }
      if (add.length) { await BW.store.putMany(COLL, add); await ws.load(); }
      return add.length;
    },
    list(dir) {
      dir = norm(dir || '');
      if (dir === 'skills/' || dir === 'skills') return LIB.skills.map((s) => 'skills/' + s.id + '/');
      if (dir.startsWith('skills/')) {
        const id = dir.split('/')[1];
        return ['skills/' + id + '/SKILL.md'].concat(Object.keys(LIB.refs).filter((k) => k.startsWith('skills/' + id + '/')));
      }
      if (!dir) return READABLE.slice();
      const out = new Set();
      for (const p of files.keys()) if (p.startsWith(dir)) { const rest = p.slice(dir.length); out.add(dir + (rest.includes('/') ? rest.split('/')[0] + '/' : rest)); }
      return [...out].sort();
    },
    read(path) {
      path = norm(path);
      if (path.startsWith('skills/')) {
        const m = path.match(/^skills\/([^/]+)\/SKILL\.md$/);
        if (m) { const s = LIB.skills.find((x) => x.id === m[1]); return s ? s.body : null; }
        return LIB.refs[path] == null ? null : LIB.refs[path];
      }
      const r = files.get(path);
      return r ? r.content : null;
    },
    async write(path, content) {
      path = norm(path);
      if (!WRITABLE.some((d) => path.startsWith(d)) || path.endsWith('/')) throw new Error(`Olaf can only write files inside ${WRITABLE.join(', ')}`);
      if (/\.\.|[\\:*?"<>|]/.test(path)) throw new Error('That file name is not allowed.');
      if (String(content).length > MAX_FILE) throw new Error('That file is too big to save.');
      const r = Object.assign(files.get(path) || {}, { id: idFor(path), path, content: String(content) });
      // Anything Olaf writes for the owner waits for them: a changed deliverable is a draft again.
      if (path.startsWith('output/')) r.status = 'draft';
      await BW.store.put(COLL, r);
      files.set(path, r);
      mirror(path, r.content);
      return r;
    },
    async remove(path) {
      const r = files.get(path);
      if (r) { await BW.store.remove(COLL, r.id); files.delete(path); }
    },
    all: () => [...files.values()].sort((a, b) => a.path.localeCompare(b.path)),
    isFilled(path) { const c = ws.read(path); return !!c && (c.match(/\[FILL/g) || []).length < 8; },

    /* ---------- the tools Claude can call ---------- */
    TOOLS: [
      { name: 'list_dir', description: 'List files and folders in your workspace. Folders: brand-documents/, memory/, output/, content-inbox/, and skills/ (read-only). An empty path lists the top level.',
        input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Folder, e.g. "memory/"' } }, required: ['path'] } },
      { name: 'read_file', description: 'Read a file from your workspace, e.g. "brand-documents/brand-voice.md" or "skills/content-writer/references/x.md".',
        input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { name: 'write_file', description: 'Create or replace a file in brand-documents/, memory/, output/ or content-inbox/. Replaces the whole file, so read it first when you are extending it. Deliverables go in output/ with a descriptive name ending in .md.',
        input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
      { name: 'business_numbers', description: 'The owner\'s marketing numbers in one go, the same as their Insights page: new customers, active customers, revenue and spend per month from invoices and the plan; where new customers came from; cost per new customer; repeat share; the monthly numbers recorded on the dashboard; and the observations the dashboard shows. Use for check-ins and monthly reviews.',
        input_schema: { type: 'object', properties: {} } },
      { name: 'plan_list', description: 'The owner\'s marketing plan: every activity on the shared dashboard (also shown in the Marketing Studio), with id, month, title, channel, cost, buying moment and status (planned, live, done).',
        input_schema: { type: 'object', properties: {} } },
      { name: 'plan_add', description: 'Add activities to the owner\'s marketing plan on the dashboard. Use it for every plan you make, so the owner sees it month by month. Check plan_list first so you do not add duplicates.',
        input_schema: { type: 'object', properties: { activities: { type: 'array', items: { type: 'object', properties: {
          month: { type: 'string', description: 'YYYY-MM' }, title: { type: 'string' }, channel: { type: 'string' }, cost: { type: 'number', description: 'Planned cost in the business currency' },
          cep: { type: 'string', description: 'The buying moment it links to, in the words of the growth profile' } }, required: ['month', 'title'] } } }, required: ['activities'] } },
      { name: 'plan_update', description: 'Change one activity in the plan: its status (planned, live, done), month, title, channel, cost, or notes on how it went.',
        input_schema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['planned', 'live', 'done'] }, month: { type: 'string' }, title: { type: 'string' }, channel: { type: 'string' }, cost: { type: 'number' }, notes: { type: 'string' } }, required: ['id'] } },
      { name: 'log_numbers', description: 'Record the owner\'s marketing numbers for a month on the dashboard: total Google reviews, average rating, website visits, followers, and a note. Only numbers the owner gave you or you read from a real source; never estimates. The first month recorded is the starting point everything is measured against.',
        input_schema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' }, reviews: { type: 'number' }, rating: { type: 'number' }, visits: { type: 'number' }, followers: { type: 'number' }, note: { type: 'string' } }, required: ['month'] } },
      { name: 'content_list', description: 'The owner\'s content calendar (shared with the Marketing Studio): posts and pieces with id, date, channel, title, text, status (idea, draft, ready, posted) and buying moment.',
        input_schema: { type: 'object', properties: { from: { type: 'string', description: 'Only items on or after this date (YYYY-MM-DD). Optional.' } } } },
      { name: 'content_add', description: 'Put posts on the owner\'s content calendar. Include the finished text when you have written it (it becomes a draft for the owner to approve); leave text empty for an idea. Check content_list first so nothing is added twice.',
        input_schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' }, channel: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' }, cep: { type: 'string' } }, required: ['date', 'title'] } } }, required: ['items'] } },
      { name: 'content_update', description: 'Change one item on the content calendar: its text, date, channel, title or status (idea, draft, ready, posted).',
        input_schema: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, date: { type: 'string' }, channel: { type: 'string' }, title: { type: 'string' }, status: { type: 'string', enum: ['idea', 'draft', 'ready', 'posted'] } }, required: ['id'] } },
      { name: 'check_voice', description: 'Check text before it goes to the owner as final copy: reports em dashes and stock AI words and phrases that make writing read as machine-made. Fix everything it reports.',
        input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    ],
    async dispatch(name, input) {
      input = input || {};
      try {
        if (name === 'list_dir') { const l = ws.list(input.path || ''); return l.length ? l.join('\n') : '(empty)'; }
        if (name === 'read_file') {
          if (!READABLE.some((d) => norm(input.path || '').startsWith(d))) return err(`You can read ${READABLE.join(', ')}`);
          const c = ws.read(input.path || '');
          if (c == null) return err(`There is no file at ${input.path}. Use list_dir to see what exists.`);
          return c.length > MAX_FILE ? c.slice(0, MAX_FILE) + '\n\n[... cut: the file is longer ...]' : c;
        }
        if (name === 'write_file') { const r = await ws.write(input.path || '', input.content == null ? '' : input.content); return `Saved ${r.path} (${r.content.length} characters).`; }
        if (name === 'business_numbers') {
          const d = await BW.mktInsights.load(), c = BW.mktInsights.compute(d);
          return JSON.stringify(Object.assign(BW.mktInsights.facts(c, d), { totalCustomersEver: c.customersEver, observations: BW.mktInsights.observations(d, c).map((o) => o.text),
            note: c.customersEver ? undefined : 'No sent invoices yet: ask the owner for their numbers instead.' }), null, 1);
        }
        if (name === 'check_voice') return voiceCheck(String(input.text || ''));
        if (name === 'content_list') { const l = (await BW.store.all('mktcontent')).filter((x) => !input.from || x.date >= input.from).sort((a, b) => a.date.localeCompare(b.date)); return l.length ? JSON.stringify(l.map(({ id, date, channel, title, text, status, cep, by }) => ({ id, date, channel, title, text, status, cep, by })), null, 1) : 'The content calendar is empty.'; }
        if (name === 'content_add') { const n = await BW.mktContent.addMany(Array.isArray(input.items) ? input.items : [], 'olaf'); return n ? `Added ${n} items to the content calendar.` : err('Nothing added: each item needs a date (YYYY-MM-DD) and a title, and it must not already be on the calendar.'); }
        if (name === 'content_update') {
          const x = await BW.store.get('mktcontent', input.id);
          if (!x) return err('No item with that id. Use content_list.');
          ['text', 'date', 'channel', 'title', 'status'].forEach((k) => { if (input[k] != null) x[k] = String(input[k]); });
          if (input.text && !input.status && (x.status || 'idea') === 'idea') x.status = 'draft';
          await BW.store.put('mktcontent', x);
          return `Updated "${x.title}".`;
        }
        if (name === 'plan_list') { const l = await BW.store.all('mktplan'); return l.length ? JSON.stringify(l.map((a) => ({ id: a.id, month: a.month, title: a.title, channel: a.channel, cost: a.cost, cep: a.cep, status: a.status || 'planned', notes: a.notes })), null, 1) : 'The plan is empty.'; }
        if (name === 'plan_add') {
          const acts = (Array.isArray(input.activities) ? input.activities : []).filter((a) => a && a.title && /^\d{4}-\d{2}$/.test(String(a.month || '').slice(0, 7)))
            .map((a) => ({ month: String(a.month).slice(0, 7), title: String(a.title).slice(0, 140), channel: String(a.channel || ''), cost: BW.num(a.cost), cep: String(a.cep || ''), status: 'planned', fromAI: true, by: 'olaf' }));
          if (!acts.length) return err('No valid activities: each needs a month (YYYY-MM) and a title.');
          await BW.store.putMany('mktplan', acts);
          return `Added ${acts.length} activities to the plan.`;
        }
        if (name === 'plan_update') {
          const a = await BW.store.get('mktplan', input.id);
          if (!a) return err('No activity with that id. Use plan_list.');
          ['status', 'title', 'channel', 'notes'].forEach((k) => { if (input[k] != null) a[k] = String(input[k]); });
          if (input.month) a.month = String(input.month).slice(0, 7);
          if (input.cost != null) a.cost = BW.num(input.cost);
          await BW.store.put('mktplan', a);
          return `Updated "${a.title}".`;
        }
        if (name === 'log_numbers') {
          const m = String(input.month || '').slice(0, 7);
          if (!/^\d{4}-\d{2}$/.test(m)) return err('month must be YYYY-MM');
          const all = await BW.store.all('mktnumbers');
          const rec = all.find((x) => x.month === m) || { month: m };
          ['reviews', 'rating', 'visits', 'followers'].forEach((k) => { if (input[k] != null && input[k] !== '') rec[k] = BW.num(input[k]); });
          if (input.note) rec.note = String(input.note).slice(0, 200);
          rec.by = 'olaf';
          await BW.store.put('mktnumbers', rec);
          return `Recorded the numbers for ${m}.`;
        }
        return err('Unknown tool ' + name);
      } catch (e) { return err(e.message || String(e)); }
    },
    voiceCheck,
  });

  const err = (m) => ({ error: m });
  const norm = (p) => String(p || '').trim().replace(/^\.?\/+/, '').replace(/\/{2,}/g, '/');
  const idFor = (path) => 'f-' + path.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
  const rec = (path, content) => ({ id: idFor(path), path, content });

  // A readable copy of each file in the owner's folder (folder mode only; the browser would download).
  function mirror(path, content) {
    if (BW.store.kind !== 'folder') return;
    BW.store.writeFile('Olaf/' + path, new Blob([content], { type: 'text/markdown' }), { download: false }).catch(() => {});
  }

  function voiceCheck(text) {
    const v = LIB.voice, found = [];
    text.split('\n').forEach((line, n) => {
      if (/^\s*(```|\|)/.test(line)) return;
      const low = line.toLowerCase();
      if (/—|&mdash;|(?<!-)--(?!-)/.test(line)) found.push(`line ${n + 1}: em dash`);
      v.words.forEach((w) => { if (new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(low)) found.push(`line ${n + 1}: "${w}"`); });
      v.phrases.forEach(([rx, label]) => { if (new RegExp(rx, 'i').test(low)) found.push(`line ${n + 1}: ${label}`); });
    });
    return found.length ? 'Fix these before it goes out:\n' + found.slice(0, 40).join('\n') : 'Clean: no em dashes or stock phrases found.';
  }
})();
