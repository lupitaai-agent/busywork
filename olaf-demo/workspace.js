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
      // Projects: the same plan as the Project Planner and the Project Board (shared/projects.js).
      { name: 'project_list', description: 'Every project in the Project Planner with its status, health and the reasons for it, progress, deadline and next milestone; plus the team (people with their hours a week). Start here for any project work.',
        input_schema: { type: 'object', properties: {} } },
      { name: 'project_get', description: 'One project in full: the brief, milestones, tasks (status, dates, who, hours, milestone, what each waits for), risks, decisions, recent updates, health with reasons, what got done this week, what is next, late and stuck, and the workload of the people on it.',
        input_schema: { type: 'object', properties: { id: { type: 'string', description: 'Project id from project_list' } }, required: ['id'] } },
      { name: 'project_create', description: 'Create a project in the Project Planner. Check project_list first so you do not make a duplicate.',
        input_schema: { type: 'object', properties: { name: { type: 'string' }, client: { type: 'string', description: 'Client name as in the Client Book, if any' }, start: { type: 'string', description: 'YYYY-MM-DD' }, due: { type: 'string', description: 'Deadline, YYYY-MM-DD' },
          goal: { type: 'string' }, doneMeans: { type: 'string', description: 'What done means, in a sentence that can be checked' }, budgetHours: { type: 'number', description: 'Time budget in hours: what the result is worth' }, owner: { type: 'string', description: 'Person name' } }, required: ['name'] } },
      { name: 'project_update', description: 'Change a project brief, its status (active, paused, done) or set its health by hand (green, amber, red; empty to let the planner work it out).',
        input_schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, goal: { type: 'string' }, doneMeans: { type: 'string' }, start: { type: 'string' }, due: { type: 'string' }, budgetHours: { type: 'number' },
          status: { type: 'string', enum: ['active', 'paused', 'done'] }, health: { type: 'string', enum: ['', 'green', 'amber', 'red'] }, owner: { type: 'string', description: 'Person name' } }, required: ['id'] } },
      { name: 'people_add', description: 'Add team members (no accounts: a name is enough) with their role and the hours a week they have for project work. People already there are left as they are.',
        input_schema: { type: 'object', properties: { people: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, hours: { type: 'number' }, email: { type: 'string' } }, required: ['name'] } } }, required: ['people'] } },
      { name: 'plan_items_add', description: 'Add milestones and tasks to a project in one go. Refer to milestones, people and other tasks by name: milestones made in the same call can be used by tasks, and "after" lists the titles of tasks this one waits for. Tasks with a title already in the project are skipped.',
        input_schema: { type: 'object', properties: { projectId: { type: 'string' },
          milestones: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['title'] } },
          tasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, start: { type: 'string', description: 'YYYY-MM-DD' }, due: { type: 'string', description: 'YYYY-MM-DD' }, milestone: { type: 'string', description: 'Milestone title' },
            assignee: { type: 'string', description: 'Person name' }, hours: { type: 'number', description: 'Estimate in hours of work' }, after: { type: 'array', items: { type: 'string' }, description: 'Titles of tasks this one waits for' }, notes: { type: 'string' } }, required: ['title'] } } },
          required: ['projectId'] } },
      { name: 'task_update', description: 'Change one task: status (todo, doing, waiting, done), dates, who does it, estimate, milestone, title, or add a note. When its dates move later, the tasks that wait for it move along; the result says which.',
        input_schema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['todo', 'doing', 'waiting', 'done'] }, start: { type: 'string' }, due: { type: 'string' }, assignee: { type: 'string', description: 'Person name, or empty for nobody' },
          hours: { type: 'number' }, milestone: { type: 'string', description: 'Milestone title, or empty for none' }, title: { type: 'string' }, note: { type: 'string', description: 'Added to the task notes with today\'s date' } }, required: ['id'] } },
      { name: 'project_log_add', description: 'Write to a project\'s log: a risk (likelihood and impact 1 to 3, a next step, an owner), a decision (what and why) or a weekly update (health and text). Pass the id of an existing risk to change it, for example to close it.',
        input_schema: { type: 'object', properties: { projectId: { type: 'string' }, kind: { type: 'string', enum: ['risk', 'decision', 'update'] }, id: { type: 'string', description: 'An existing entry to change' }, title: { type: 'string' }, text: { type: 'string' },
          likelihood: { type: 'number' }, impact: { type: 'number' }, next: { type: 'string' }, owner: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed'] }, health: { type: 'string', enum: ['green', 'amber', 'red'] } }, required: ['projectId', 'kind'] } },
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
        if (name.startsWith('project_') || name === 'people_add' || name === 'plan_items_add' || name === 'task_update') return await projectTool(name, input);
        return err('Unknown tool ' + name);
      } catch (e) { return err(e.message || String(e)); }
    },
    voiceCheck,
  });

  const err = (m) => ({ error: m });
  /* ---------- project tools ---------- */
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  async function projectTool(name, input) {
    const P = BW.pm;
    const d = await P.load();
    const findPerson = (n) => d.people.find((x) => same(x.name, n)) || d.people.find((x) => n && same(x.name.split(' ')[0], n));
    const proj = (id) => d.projects.find((x) => x.id === id);
    const dates = (o, keys) => { for (const k of keys) if (o[k] != null && o[k] !== '' && !isDate(o[k])) throw new Error(`${k} must be YYYY-MM-DD`); };
    if (name === 'project_list') {
      return JSON.stringify({ today: BW.today(), projects: d.projects.map((p) => {
        const x = P.of(d, p.id), h = P.health(x, d), pr = P.progress(x), next = x.milestones.find((m) => !m.done);
        return { id: p.id, name: p.name, client: x.client ? x.client.name : '', status: p.status || 'active', health: h.level, reasons: h.reasons, tasksDone: pr.done, tasks: pr.total, deadline: p.due || '', nextMilestone: next ? { title: next.title, due: next.due || '' } : null };
      }), people: d.people.map((x) => ({ name: x.name, role: x.role || '', hoursAWeek: BW.num(x.hours) || P.DEFAULT_WEEK })) }, null, 1);
    }
    if (name === 'project_get') {
      const x = P.of(d, input.id);
      if (!x) return err('No project with that id. Use project_list.');
      const h = P.health(x, d), u = P.weekly(x, d), title = (id) => (x.tasks.find((t) => t.id === id) || {}).title;
      const who = (id) => (d.people.find((y) => y.id === id) || {}).name || '';
      const ids = new Set(x.tasks.map((t) => t.assigneeId).filter(Boolean));
      return JSON.stringify({
        today: BW.today(),
        project: { id: x.p.id, name: x.p.name, client: x.client ? x.client.name : '', clientEmail: x.client ? x.client.email || '' : '', status: x.p.status || 'active', start: x.p.start || '', deadline: x.p.due || '',
          goal: x.p.goal || '', doneMeans: x.p.doneMeans || '', budgetHours: x.p.budgetHours || '', owner: who(x.p.ownerId), plannedHours: P.progress(x).hours },
        health: { level: h.level, setByHand: h.set, reasons: h.reasons, teamOnly: h.internal },
        milestones: x.milestones.map((m) => ({ title: m.title, due: m.due || '', done: !!m.done })),
        tasks: x.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status || 'todo', start: t.start || '', due: t.due || '', doneAt: t.doneAt || '', milestone: (x.milestones.find((m) => m.id === t.milestoneId) || {}).title || '',
          who: who(t.assigneeId), hours: t.hours || '', waitsFor: (t.after || []).map(title).filter(Boolean), notes: t.notes || '' })),
        risks: x.log.filter((r) => r.kind === 'risk').map((r) => ({ id: r.id, title: r.title, likelihood: r.likelihood, impact: r.impact, level: P.riskLevel(r.likelihood, r.impact), next: r.next || '', owner: r.owner || '', state: r.state || 'open' })),
        decisions: x.log.filter((r) => r.kind === 'decision').map((r) => ({ date: r.date, title: r.title, why: r.text || '' })),
        recentUpdates: x.log.filter((r) => r.kind === 'update').slice(0, 3).map((r) => ({ date: r.date, health: r.health, text: r.text })),
        thisWeek: { done: u.done.map((t) => t.title), next: u.next.map((t) => t.title), late: u.late.map((t) => t.title), waitingOnSomeone: u.stuck.map((t) => t.title) },
        workload: P.workload(d, P.monday(BW.today()), 4).filter((r) => ids.has(r.person.id)).map((r) => ({ person: r.person.name, hoursAWeek: r.cap, weeks: r.weeks.map((w, i) => ({ week: w, hours: r.hours[i] })) })),
      }, null, 1);
    }
    if (name === 'project_create') {
      if (!String(input.name || '').trim()) return err('A project needs a name.');
      dates(input, ['start', 'due']);
      if (d.projects.some((p) => same(p.name, input.name) && (p.status || 'active') !== 'done')) return err('A project with that name already exists. Use project_list and project_update.');
      const client = input.client ? d.clients.find((c) => same(c.name, input.client)) : null;
      const owner = input.owner ? findPerson(input.owner) : null;
      const p = { name: String(input.name).trim().slice(0, 120), emoji: '📁', color: 'sky', status: 'active', start: input.start || BW.today(), due: input.due || '', goal: String(input.goal || ''), doneMeans: String(input.doneMeans || ''),
        budgetHours: input.budgetHours != null ? BW.num(input.budgetHours) : '', clientId: client ? client.id : '', ownerId: owner ? owner.id : '', by: 'olaf' };
      await BW.store.put('projects', p);
      return `Created "${p.name}" (id ${p.id}).${input.client && !client ? ` No client called "${input.client}" in the Client Book: left without a client.` : ''}${input.owner && !owner ? ` No person called "${input.owner}": add them with people_add.` : ''}`;
    }
    if (name === 'project_update') {
      const p = proj(input.id);
      if (!p) return err('No project with that id. Use project_list.');
      dates(input, ['start', 'due']);
      ['name', 'goal', 'doneMeans', 'start', 'due', 'status', 'health'].forEach((k) => { if (input[k] != null) p[k] = String(input[k]); });
      if (input.budgetHours != null) p.budgetHours = BW.num(input.budgetHours);
      let note = '';
      if (input.owner != null) { const o = findPerson(input.owner); p.ownerId = o ? o.id : ''; if (input.owner && !o) note = ` No person called "${input.owner}".`; }
      await BW.store.put('projects', p);
      return `Updated "${p.name}".${note}`;
    }
    if (name === 'people_add') {
      const list = (Array.isArray(input.people) ? input.people : []).filter((x) => x && String(x.name || '').trim());
      const fresh = list.filter((x) => !d.people.some((y) => same(y.name, x.name))).map((x, i) => ({ name: String(x.name).trim(), role: String(x.role || ''), email: String(x.email || ''),
        hours: x.hours != null ? BW.num(x.hours) : '', color: ['sky', 'grape', 'pink', 'sun', 'mint', 'teal', 'tomato'][(d.people.length + i) % 7] }));
      if (fresh.length) await BW.store.putMany('people', fresh);
      return fresh.length ? `Added ${fresh.map((x) => x.name).join(', ')}.` : 'Everyone named is already on the team.';
    }
    if (name === 'plan_items_add') {
      const x = P.of(d, input.projectId);
      if (!x) return err('No project with that id. Use project_list.');
      const notes = [];
      const ms = (Array.isArray(input.milestones) ? input.milestones : []).filter((m) => m && String(m.title || '').trim());
      ms.forEach((m) => dates(m, ['due']));
      const newMs = ms.filter((m) => !x.milestones.some((y) => same(y.title, m.title))).map((m, i) => ({ id: BW.uid(), projectId: x.p.id, title: String(m.title).trim().slice(0, 120), due: m.due || '', done: false, order: x.milestones.length + i }));
      const allMs = x.milestones.concat(newMs);
      const ts = (Array.isArray(input.tasks) ? input.tasks : []).filter((t) => t && String(t.title || '').trim());
      ts.forEach((t) => dates(t, ['start', 'due']));
      const fresh = ts.filter((t) => !x.tasks.some((y) => same(y.title, t.title))).map((t, i) => ({ id: BW.uid(), projectId: x.p.id, title: String(t.title).trim().slice(0, 160), status: ['todo', 'doing', 'waiting', 'done'].includes(t.status) ? t.status : 'todo',
        order: x.tasks.length + i, start: t.start || '', due: t.due || t.start || '', hours: t.hours != null ? BW.num(t.hours) : '', notes: String(t.notes || ''), by: 'olaf', _in: t }));
      const allTasks = x.tasks.concat(fresh);
      for (const t of fresh) {
        const i = t._in; delete t._in;
        if (i.milestone) { const m = allMs.find((y) => same(y.title, i.milestone)); if (m) t.milestoneId = m.id; else notes.push(`no milestone "${i.milestone}" for "${t.title}"`); }
        if (i.assignee) { const p = findPerson(i.assignee); if (p) t.assigneeId = p.id; else notes.push(`no person "${i.assignee}" for "${t.title}" (people_add first)`); }
        t.after = (Array.isArray(i.after) ? i.after : []).map((a) => { const y = allTasks.find((z) => same(z.title, a)); if (!y) notes.push(`"${t.title}" waits for unknown task "${a}"`); return y && y.id; }).filter(Boolean);
      }
      if (newMs.length) await BW.store.putMany('milestones', newMs);
      if (fresh.length) await BW.store.putMany('tasks', fresh);
      const skipped = ts.length - fresh.length;
      const clash = P.conflicts(allTasks).filter((c) => fresh.includes(c.task));
      return `Added ${newMs.length} milestone${newMs.length === 1 ? '' : 's'} and ${fresh.length} task${fresh.length === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped: already in the project)` : ''}.`
        + (notes.length ? ' Check: ' + notes.join('; ') + '.' : '') + (clash.length ? ` These start before what they wait for is done: ${clash.map((c) => `"${c.task.title}" (waits for "${c.waitsFor.title}")`).join(', ')}.` : '');
    }
    if (name === 'task_update') {
      const t = d.tasks.find((y) => y.id === input.id);
      if (!t) return err('No task with that id. Use project_get.');
      dates(input, ['start', 'due']);
      const x = P.of(d, t.projectId);
      const notes = [];
      if (input.status) { t.status = input.status; t.doneAt = input.status === 'done' ? (t.doneAt || BW.today()) : ''; }
      if (input.title) t.title = String(input.title).slice(0, 160);
      if (input.hours != null) t.hours = BW.num(input.hours);
      if (input.assignee != null) { const p = findPerson(input.assignee); t.assigneeId = p ? p.id : ''; if (input.assignee && !p) notes.push(`no person "${input.assignee}"`); }
      if (input.milestone != null) { const m = x.milestones.find((y) => same(y.title, input.milestone)); t.milestoneId = m ? m.id : ''; if (input.milestone && !m) notes.push(`no milestone "${input.milestone}"`); }
      if (input.note) t.notes = ((t.notes ? t.notes + '\n' : '') + BW.today() + ': ' + String(input.note)).slice(-4000);
      let pushed = [];
      const ns = input.start != null ? input.start : t.start, nd = input.due != null ? input.due : t.due;
      if (ns !== t.start || nd !== t.due) {
        const moved = P.move(x.tasks.map((y) => (y.id === t.id ? t : y)), t.id, ns, nd);
        pushed = moved.filter((y) => y.id !== t.id);
        Object.assign(t, { start: ns || '', due: nd || ns || '' });
        if (pushed.length) await BW.store.putMany('tasks', pushed);
      }
      await BW.store.put('tasks', t);
      return `Updated "${t.title}".` + (pushed.length ? ` Moved along because they wait for it: ${pushed.map((y) => `"${y.title}" now ${y.start} to ${y.due}`).join(', ')}.` : '') + (notes.length ? ' Check: ' + notes.join('; ') + '.' : '');
    }
    if (name === 'project_log_add') {
      const p = proj(input.projectId);
      if (!p) return err('No project with that id. Use project_list.');
      if (!['risk', 'decision', 'update'].includes(input.kind)) return err('kind must be risk, decision or update');
      const old = input.id ? d.log.find((r) => r.id === input.id && r.projectId === p.id) : null;
      if (input.id && !old) return err('No entry with that id in this project.');
      const r = old || { projectId: p.id, kind: input.kind, date: BW.today(), by: 'olaf' };
      ['title', 'text', 'next', 'owner', 'state', 'health'].forEach((k) => { if (input[k] != null) r[k] = String(input[k]).slice(0, 4000); });
      ['likelihood', 'impact'].forEach((k) => { if (input[k] != null) r[k] = String(Math.min(3, Math.max(1, Math.round(BW.num(input[k]) || 1)))); });
      if (r.kind === 'risk') { r.state = r.state || 'open'; r.likelihood = r.likelihood || '2'; r.impact = r.impact || '2'; }
      if (r.kind === 'update') { r.text = r.text || r.title || ''; r.health = r.health || P.health(P.of(d, p.id), d).level; }
      if (!r.title && r.kind !== 'update') return err('A risk or decision needs a title.');
      await BW.store.put('projectlog', r);
      return `${old ? 'Changed' : 'Added'} the ${r.kind}${r.title ? ` "${r.title}"` : ''} in "${p.name}".`;
    }
    return err('Unknown tool ' + name);
  }

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
