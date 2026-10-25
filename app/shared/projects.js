/* Project planning, shared by the Project Planner (do it yourself), the Project Board and Olaf
   (guided). No screens here: the plan's data, and the sums every view needs, so the free planner
   and Olaf always agree on what is late, at risk or too much for one person.

   A project is a record in 'projects' with a brief (goal, what done means, start, deadline, hours
   budget). Its milestones are promises with a date ('milestones'); its tasks are the cards on the
   Project Board ('tasks'), now with a start, a due date, a person, an estimate in hours and the
   tasks they wait for (`after`). People are the team ('people'), with the hours a week they have.
   Risks, decisions and weekly updates go in one log ('projectlog'). */
(function () {
  'use strict';
  const BW = window.BW;

  const STATUS = { todo: 'To do', doing: 'Doing', waiting: 'Waiting on someone', done: 'Done' };
  const HEALTH = { green: { label: 'On track', emoji: '🟢' }, amber: { label: 'At risk', emoji: '🟠' }, red: { label: 'Off track', emoji: '🔴' } };
  const LEVELS = ['low', 'medium', 'high', 'critical'];
  const DEFAULT_HOURS = 2;    // a task without an estimate counts as two hours of work
  const DEFAULT_WEEK = 32;    // hours a week a person has for project work, unless set

  const today = () => BW.today();
  const num = (v) => (v === '' || v == null ? null : BW.num(v));
  const utc = (iso) => Date.parse(iso + 'T00:00:00Z');
  const days = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
  const monday = (iso) => BW.addDays(iso, -((new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay() + 6) % 7));
  const open = (t) => (t.status || 'todo') !== 'done';
  // A task's dates: a task with only a due date is a one-day task on that date.
  const startOf = (t) => t.start || t.due || '';
  const endOf = (t) => t.due || t.start || '';

  let linking = null;
  const PLAN_ST = { planned: 'todo', live: 'doing', done: 'done' }, PLAN_BACK = { todo: 'planned', doing: 'live', done: 'done' };
  const monthEnd = (m) => BW.addDays(BW.addPeriod(m + '-01', 'month'), -1);
  // Both sides of a link in the same terms: title, when (the plan's month or the post's day) and a status of todo, doing or done.
  const mktSide = (kind, r) => ({ title: String(r.title || ''), when: kind === 'plan' ? String(r.month || '').slice(0, 7) : String(r.date || ''),
    status: kind === 'plan' ? PLAN_ST[r.status || 'planned'] || 'todo' : r.status === 'posted' ? 'done' : 'todo' });
  const taskSide = (kind, t) => ({ title: String(t.title || ''), when: kind === 'plan' ? (t.start || t.due || '').slice(0, 7) : (t.due || t.start || ''),
    status: (t.status || 'todo') === 'done' ? 'done' : kind === 'plan' && ['doing', 'waiting'].includes(t.status) ? 'doing' : 'todo' });

  async function linkOnce() {
    const [plan, content, projects, tasks] = await Promise.all(['mktplan', 'mktcontent', 'projects', 'tasks'].map((n) => BW.store.all(n)));
    const items = plan.filter((a) => a.title && /^\d{4}-\d{2}/.test(a.month || '')).map((rec) => ({ kind: 'plan', rec }))
      .concat(content.filter((c) => c.title && /^\d{4}-\d{2}-\d{2}$/.test(c.date || '')).map((rec) => ({ kind: 'content', rec })));
    const linked = tasks.filter((t) => t.link);
    const exists = new Set(plan.map((a) => 'plan:' + a.id).concat(content.map((c) => 'content:' + c.id)));
    const gone = linked.filter((t) => !exists.has(t.link)).map((t) => t.id);
    let project = projects.find((p) => p.source === 'marketing');
    if (!items.length && !gone.length) {
      // Nothing to link. An empty Marketing project (the example business removed, say) goes too.
      if (project && !tasks.some((t) => t.projectId === project.id)) await BW.store.remove('projects', project.id);
      return { tasks: 0, marketing: 0, removed: 0 };
    }
    const outTasks = [], outPlan = [], outContent = [];
    if (items.length && !project) {
      project = { id: BW.uid(), name: 'Marketing', emoji: '📣', color: 'pink', status: 'active', source: 'marketing',
        goal: 'The marketing plan and the content calendar, as tasks. Made by the Marketing Studio and Olaf; change them here or there.', doneMeans: '' };
    }
    let order = tasks.filter((t) => project && t.projectId === project.id).length;
    for (const { kind, rec } of items) {
      const link = kind + ':' + rec.id;
      let t = linked.find((x) => x.link === link);
      const m = mktSide(kind, rec);
      if (!t) {
        if (rec.taskId) continue; // its task was deleted on purpose: the link has ended
        t = { id: BW.uid(), projectId: project.id, link, source: 'marketing', title: m.title, status: m.status, order: order++, hours: kind === 'content' ? 1 : '',
          start: kind === 'plan' ? m.when + '-01' : m.when, due: kind === 'plan' ? monthEnd(m.when) : m.when, doneAt: m.status === 'done' ? today() : '',
          notes: kind === 'plan' ? `From the marketing plan${rec.channel ? ': ' + rec.channel : ''}${rec.cep ? '. Buying moment: ' + rec.cep : ''}${rec.cost ? '. Budget ' + BW.money(BW.num(rec.cost)) : ''}.`
            : `A post${rec.channel ? ' for ' + rec.channel : ''} on the content calendar.${rec.text ? '\n\n' + String(rec.text).slice(0, 600) : ''}` };
        t.sync = m;
        if (rec.example) t.example = true; // removed with the example business
        rec.taskId = t.id;
        outTasks.push(t); (kind === 'plan' ? outPlan : outContent).push(rec);
        continue;
      }
      const tv = taskSide(kind, t), sv = t.sync || m;
      let tChanged = false, mChanged = false;
      const next = {};
      for (const f of ['title', 'when', 'status']) {
        const mDiff = m[f] !== sv[f], tDiff = tv[f] !== sv[f];
        let v = sv[f];
        if (mDiff && tDiff) v = (rec.updatedAt || '') >= (t.updatedAt || '') ? m[f] : tv[f];
        else if (mDiff) v = m[f];
        else if (tDiff) v = tv[f];
        next[f] = v;
        if (v !== tv[f]) {
          tChanged = true;
          if (f === 'title') t.title = v;
          if (f === 'when') { if (kind === 'plan') { t.start = v + '-01'; t.due = monthEnd(v); } else { t.start = v; t.due = v; } }
          if (f === 'status') { if (!(v === 'doing' && t.status === 'waiting')) t.status = v; t.doneAt = v === 'done' ? (t.doneAt || today()) : ''; }
        }
        if (v !== m[f]) {
          mChanged = true;
          if (f === 'title') rec.title = v;
          if (f === 'when') { if (kind === 'plan') rec.month = v; else rec.date = v; }
          if (f === 'status') { if (kind === 'plan') rec.status = PLAN_BACK[v]; else if (v === 'done') rec.status = 'posted'; else if (rec.status === 'posted') rec.status = 'ready'; }
        }
      }
      if (!t.sync || ['title', 'when', 'status'].some((f) => t.sync[f] !== next[f])) { t.sync = next; tChanged = true; }
      if (rec.taskId !== t.id) { rec.taskId = t.id; mChanged = true; }
      if (tChanged) outTasks.push(t);
      if (mChanged) (kind === 'plan' ? outPlan : outContent).push(rec);
    }
    // The Marketing project spans its tasks.
    if (project) {
      const mine = tasks.filter((t) => t.projectId === project.id && !gone.includes(t.id)).concat(outTasks.filter((t) => !tasks.includes(t)));
      const starts = mine.map(startOf).filter(Boolean).sort(), ends = mine.map(endOf).filter(Boolean).sort();
      const span = { start: starts[0] || '', due: ends[ends.length - 1] || '' };
      if (!projects.includes(project) || project.start !== span.start || project.due !== span.due) { Object.assign(project, span); await BW.store.put('projects', project); }
    }
    if (outTasks.length) await BW.store.putMany('tasks', outTasks);
    if (outPlan.length) await BW.store.putMany('mktplan', outPlan);
    if (outContent.length) await BW.store.putMany('mktcontent', outContent);
    if (gone.length) await BW.store.removeWhere('tasks', (t) => gone.includes(t.id));
    if (project && !items.length && !tasks.some((t) => t.projectId === project.id && !gone.includes(t.id))) await BW.store.remove('projects', project.id);
    return { tasks: outTasks.length, marketing: outPlan.length + outContent.length, removed: gone.length };
  }

  const P = (BW.pm = {
    STATUS, HEALTH, LEVELS, DEFAULT_HOURS, DEFAULT_WEEK, startOf, endOf, days, monday,

    // Links marketing work first (see linkMarketing), so every view sees the same tasks.
    async load({ link = true } = {}) {
      if (link) await P.linkMarketing().catch((e) => console.warn('Marketing link skipped', e));
      const names = ['projects', 'tasks', 'milestones', 'people', 'projectlog', 'clients'];
      const [projects, tasks, milestones, people, log, clients] = await Promise.all(names.map((n) => BW.store.all(n)));
      return { projects, tasks, milestones, people, log, clients };
    },
    // Everything belonging to one project, milestones and tasks in plan order.
    of(d, id) {
      const p = d.projects.find((x) => x.id === id);
      if (!p) return null;
      const milestones = d.milestones.filter((m) => m.projectId === id).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || (a.order || 0) - (b.order || 0));
      const tasks = d.tasks.filter((t) => t.projectId === id).sort((a, b) => (startOf(a) || '9').localeCompare(startOf(b) || '9') || (a.order || 0) - (b.order || 0));
      const log = d.log.filter((x) => x.projectId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return { p, milestones, tasks, log, client: d.clients.find((c) => c.id === p.clientId) || null, owner: d.people.find((x) => x.id === p.ownerId) || null };
    },

    progress(x) {
      const total = x.tasks.length, done = x.tasks.filter((t) => !open(t)).length;
      const hours = x.tasks.reduce((s, t) => s + (num(t.hours) || DEFAULT_HOURS), 0);
      const hoursDone = x.tasks.filter((t) => !open(t)).reduce((s, t) => s + (num(t.hours) || DEFAULT_HOURS), 0);
      return { total, done, pct: total ? Math.round((done / total) * 100) : 0, hours, hoursDone, milestones: x.milestones.length, milestonesDone: x.milestones.filter((m) => m.done).length };
    },

    // Tasks that start before something they wait for is finished.
    conflicts(tasks) {
      const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
      const out = [];
      for (const t of tasks) {
        if (!open(t) || !startOf(t)) continue;
        for (const id of t.after || []) {
          const dep = byId[id];
          if (dep && open(dep) && endOf(dep) && startOf(t) <= endOf(dep)) out.push({ task: t, waitsFor: dep });
        }
      }
      return out;
    },

    /* How the project is doing, with the reasons in plain words. The owner can set it by hand
       (p.health); otherwise it follows from the plan:
       red   a milestone date has passed, the plan ends after the deadline, or 3+ tasks are late
       amber something is late, waits on something unfinished, or someone has too much on */
    health(x, d, on = today()) {
      const reasons = [], internal = []; // internal: for the team's eyes, not for a client update
      const late = x.tasks.filter((t) => open(t) && endOf(t) && endOf(t) < on);
      const lateMs = x.milestones.filter((m) => !m.done && m.due && m.due < on);
      const lastEnd = x.tasks.filter(open).map(endOf).filter(Boolean).sort().pop();
      const waits = P.conflicts(x.tasks);
      const stuck = x.tasks.filter((t) => t.status === 'waiting');
      const rank = { green: 0, amber: 1, red: 2 };
      let level = 'green';
      const worse = (l) => { if (rank[l] > rank[level]) level = l; };
      if (lateMs.length) { worse('red'); reasons.push(`${lateMs.length === 1 ? `Milestone “${lateMs[0].title}”` : `${lateMs.length} milestones`} passed without being done`); }
      if (x.p.due && lastEnd && lastEnd > x.p.due) { worse('red'); reasons.push(`The plan ends ${BW.fmtDate(lastEnd)}, after the deadline of ${BW.fmtDate(x.p.due)}`); }
      if (late.length) { worse(late.length >= 3 ? 'red' : 'amber'); reasons.push(`${late.length} task${late.length === 1 ? ' is' : 's are'} late`); }
      if (waits.length) { worse('amber'); reasons.push(`${waits.length} task${waits.length === 1 ? ' starts' : 's start'} before what ${waits.length === 1 ? 'it waits' : 'they wait'} for is done`); }
      if (stuck.length) reasons.push(`${stuck.length} waiting on someone`);
      if (d) {
        const heavy = P.workload(d, monday(on), 3).filter((r) => r.over.some(Boolean) && x.tasks.some((t) => open(t) && t.assigneeId === r.person.id));
        if (heavy.length) { worse('amber'); const r = `${heavy.map((y) => y.person.name).join(', ')} ${heavy.length === 1 ? 'has' : 'have'} more work than hours in the next weeks`; reasons.push(r); internal.push(r); }
      }
      const set = x.p.health && HEALTH[x.p.health] ? x.p.health : null;
      return { level: set || level, auto: level, set: !!set, reasons, internal, late, lateMilestones: lateMs, conflicts: waits };
    },

    /* Moves a task to new dates and pushes everything waiting for it (and what waits for those)
       just far enough to start the day after, keeping each task's length. Returns the changed
       tasks, new objects, for the caller to save. Weekends are not skipped: small teams work them. */
    move(tasks, id, start, due) {
      const byId = new Map(tasks.map((t) => [t.id, Object.assign({}, t)]));
      const changed = new Map();
      const t0 = byId.get(id);
      if (!t0) return [];
      t0.start = start || ''; t0.due = due || start || '';
      changed.set(id, t0);
      const queue = [id], seen = new Set();
      while (queue.length) {
        const cur = byId.get(queue.shift());
        if (seen.has(cur.id)) continue;
        seen.add(cur.id);
        for (const t of byId.values()) {
          if (!(t.after || []).includes(cur.id) || !open(t) || !startOf(t) || !endOf(cur)) continue;
          if (startOf(t) > endOf(cur)) continue;
          const len = Math.max(0, days(startOf(t), endOf(t)));
          const s = BW.addDays(endOf(cur), 1);
          t.start = s; t.due = BW.addDays(s, len);
          changed.set(t.id, t);
          queue.push(t.id);
        }
      }
      return [...changed.values()];
    },

    /* Hours of open work per person per week, for `weeks` weeks from `from` (a Monday). A task's
       estimate is spread over its working days (Monday to Friday) between start and due. */
    workload(d, from = monday(today()), weeks = 6) {
      const starts = Array.from({ length: weeks }, (_, i) => BW.addDays(from, i * 7));
      return d.people.map((person) => {
        const hours = starts.map(() => 0);
        for (const t of d.tasks) {
          if (!open(t) || t.assigneeId !== person.id || !endOf(t)) continue;
          // Work already late lands on today; work under way counts from today to its due date.
          const now = today(), end = endOf(t) < now ? now : endOf(t), s = startOf(t) < now ? now : startOf(t);
          const workdays = [];
          for (let k = 0, day = s; day <= end && k < 400; k++, day = BW.addDays(day, 1)) { const wd = new Date(utc(day)).getUTCDay(); if (wd !== 0 && wd !== 6) workdays.push(day); }
          if (!workdays.length) workdays.push(end);
          const per = (num(t.hours) || DEFAULT_HOURS) / workdays.length;
          for (const day of workdays) { const i = starts.findIndex((w) => day >= w && day < BW.addDays(w, 7)); if (i >= 0) hours[i] += per; }
        }
        const cap = num(person.hours) || DEFAULT_WEEK;
        return { person, weeks: starts, hours: hours.map((h) => Math.round(h * 10) / 10), cap, over: hours.map((h) => h > cap) };
      });
    },

    // Likelihood and impact are 1 (low) to 3 (high).
    riskLevel(likelihood, impact) {
      const l = Math.min(3, Math.max(1, Number(likelihood) || 1)), i = Math.min(3, Math.max(1, Number(impact) || 1));
      const s = l * i;
      return s >= 9 ? 'critical' : s >= 6 ? 'high' : s >= 3 ? 'medium' : 'low';
    },

    /* What this week's update needs, from the plan itself: what got done in the last 7 days, what is
       due in the next 7, what is late, what is stuck, the open risks that matter, the next milestone. */
    weekly(x, d, on = today()) {
      const since = BW.addDays(on, -7), until = BW.addDays(on, 7);
      const doneAt = (t) => t.doneAt || (t.updatedAt || '').slice(0, 10);
      const h = P.health(x, d, on);
      return {
        health: h.level, reasons: h.reasons.filter((r) => !h.internal.includes(r)),
        done: x.tasks.filter((t) => !open(t) && doneAt(t) >= since && doneAt(t) <= on),
        next: x.tasks.filter((t) => open(t) && endOf(t) && endOf(t) >= on && endOf(t) <= until),
        late: h.late,
        stuck: x.tasks.filter((t) => t.status === 'waiting'),
        risks: x.log.filter((r) => r.kind === 'risk' && r.state !== 'closed' && ['high', 'critical'].includes(P.riskLevel(r.likelihood, r.impact))),
        milestone: x.milestones.filter((m) => !m.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))[0] || null,
      };
    },
    // The weekly update as plain text, to paste into an email or chat.
    updateText(x, u, people = []) {
      const who = (t) => { const p = people.find((y) => y.id === t.assigneeId); return p ? ` (${p.name})` : ''; };
      const list = (a, f) => (a.length ? a.map((t) => '- ' + f(t)).join('\n') : '- Nothing');
      return [
        `${x.p.name}: ${HEALTH[u.health] ? HEALTH[u.health].label.toLowerCase() : 'update'}`,
        u.reasons && u.reasons.length ? u.reasons.join('. ') + '.' : '',
        '', 'Done this week:', list(u.done, (t) => t.title),
        '', 'Next week:', list(u.next, (t) => `${t.title}, ${BW.fmtDate(endOf(t))}${who(t)}`),
        u.late.length ? '\nLate:\n' + list(u.late, (t) => `${t.title}, was due ${BW.fmtDate(endOf(t))}${who(t)}`) : '',
        u.stuck.length ? '\nWaiting on someone:\n' + list(u.stuck, (t) => t.title) : '',
        u.milestone ? `\nNext milestone: ${u.milestone.title}${u.milestone.due ? ', ' + BW.fmtDate(u.milestone.due) : ''}` : '',
      ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
    },

    /* Starting points. Offsets are days from the project start; `ms` is the milestone a task leads to,
       `after` the tasks (by position) it waits for. A template is a suggestion: everything can change. */
    TEMPLATES: [
      { id: 'blank', name: 'Blank project', emoji: '📁', about: 'Start from nothing.', weeks: 4, milestones: [], tasks: [] },
      { id: 'client', name: 'Client project', emoji: '🤝', about: 'From kick-off to invoice: brief, first version, feedback, delivery.', weeks: 6,
        milestones: [['Brief agreed', 5], ['First version shown', 21], ['Delivered', 38], ['Invoiced and paid', 41]],
        tasks: [['Kick-off call and notes', 0, 1, 0, 2], ['Write the brief and get a yes', 1, 4, 0, 3, [0]], ['Make the first version', 6, 14, 1, 16, [1]], ['Show it and collect feedback', 21, 1, 1, 2, [2]],
          ['Work in the feedback', 24, 9, 2, 8, [3]], ['Final check and hand-over', 34, 4, 2, 3, [4]], ['Send the invoice', 39, 1, 3, 1, [5]]] },
      { id: 'launch', name: 'Launch something new', emoji: '🚀', about: 'A product, service or offer: get it ready, tell people, launch, learn.', weeks: 8,
        milestones: [['Offer decided', 7], ['Ready to sell', 35], ['Launched', 42], ['First results reviewed', 55]],
        tasks: [['Decide what it is, for whom, at what price', 0, 7, 0, 4], ['Make or source it', 8, 21, 1, 24, [0]], ['Photos and words for it', 22, 10, 1, 6, [0]],
          ['Website or shop page', 32, 4, 1, 5, [2]], ['Tell regular customers first', 36, 4, 2, 3, [3]], ['Launch day', 42, 1, 2, 4, [1, 4]], ['Look at what sold and what people said', 50, 6, 3, 3, [5]]] },
      { id: 'event', name: 'Event or workshop', emoji: '🎪', about: 'Date, place, guests, the day itself and the follow-up.', weeks: 6,
        milestones: [['Date and place fixed', 7], ['Invitations out', 14], ['Event day', 38], ['Follow-up sent', 41]],
        tasks: [['Pick date, place and budget', 0, 6, 0, 3], ['Book the venue and suppliers', 6, 8, 1, 4, [0]], ['Write and send the invitations', 8, 6, 1, 3, [0]],
          ['Programme and materials', 14, 18, 2, 10, [2]], ['Reminder to guests', 33, 1, 2, 1, [2]], ['Set up and run the day', 37, 2, 2, 12, [3]], ['Thank-you and photos to guests', 39, 3, 3, 2, [5]]] },
      { id: 'website', name: 'New website', emoji: '🌐', about: 'Pages, words, photos, build, check, go live.', weeks: 8,
        milestones: [['Pages and words agreed', 14], ['Site built', 42], ['Live', 52]],
        tasks: [['List the pages and what each must do', 0, 5, 0, 3], ['Write the words', 5, 10, 0, 10, [0]], ['Gather photos and logo', 5, 10, 0, 4, [0]],
          ['Build the pages', 15, 25, 1, 30, [1, 2]], ['Check on phone and computer', 41, 5, 2, 4, [3]], ['Connect the domain and go live', 47, 3, 2, 2, [4]], ['Tell customers', 52, 2, null, 2, [5]]] },
      { id: 'move', name: 'Move or fit-out', emoji: '🏗️', about: 'A new shop, studio or office: contractors, the move, opening.', weeks: 10,
        milestones: [['Contracts signed', 10], ['Fit-out done', 56], ['Open for business', 69]],
        tasks: [['Quotes from contractors', 0, 9, 0, 6], ['Sign contracts and plan the works', 9, 1, 0, 3, [0]], ['Fit-out works', 15, 40, 1, 20, [1]],
          ['Change address everywhere (bank, website, Google)', 50, 7, 2, 3], ['Pack and move', 56, 5, 2, 16, [2]], ['Opening for customers', 66, 4, 2, 8, [4]]] },
    ],
    // A template turned into records for a project starting on `start`. Ids are made here so tasks can wait on each other.
    fromTemplate(tpl, start, project = {}) {
      const p = Object.assign({ id: BW.uid(), name: tpl.name, emoji: tpl.emoji, start, due: BW.addDays(start, tpl.weeks * 7 - 1), status: 'active', template: tpl.id }, project);
      p.start = p.start || start;
      const ms = tpl.milestones.map(([title, at], i) => ({ id: BW.uid(), projectId: p.id, title, due: BW.addDays(start, at), done: false, order: i }));
      const ids = tpl.tasks.map(() => BW.uid());
      const tasks = tpl.tasks.map(([title, at, len, msi, hours, after], i) => ({ id: ids[i], projectId: p.id, title, status: 'todo', order: i, start: BW.addDays(start, at),
        due: BW.addDays(start, at + Math.max(0, len - 1)), milestoneId: ms[msi] ? ms[msi].id : '', hours, after: (after || []).map((k) => ids[k]) }));
      return { project: p, milestones: ms, tasks };
    },

    /* Marketing work is project work too. Every action in the marketing plan and every post on the
       content calendar (made in the Marketing Studio or by Olaf) is also a task in one "Marketing"
       project, so it is on the Project Board, the timeline and in each person's workload.
       Both sides can change it. Each linked task remembers the values of the last link (`sync`); a
       field changed on one side since then is copied to the other, and when both changed, the newer
       change wins. Title, date (the plan's month, the post's day) and status are linked; who does it,
       the estimate and what it waits for belong to the task. Deleting the task ends the link for that
       item (the marketing item stays); deleting the marketing item removes its task.
       Safe to run any time and as often as you like: it writes only what changed. */
    async linkMarketing() {
      if (linking) return linking;
      linking = linkOnce().finally(() => { linking = null; });
      return linking;
    },

    // Milestones and dated tasks as calendar events (all-day), for Google, Apple or Outlook calendars.
    ics(x) {
      const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
      const enc = new TextEncoder();
      const fold = (line) => { const out = []; let cur = '', n = 0; for (const ch of line) { const b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; } cur += ch; n += b; } return out.concat(cur).join('\r\n '); };
      const ev = (uid, date, summary, desc) => ['BEGIN:VEVENT', `UID:${uid}@busywork`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
        `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${BW.addDays(date, 1).replace(/-/g, '')}`, fold('SUMMARY:' + esc(summary)), desc ? fold('DESCRIPTION:' + esc(desc)) : null, 'END:VEVENT'].filter(Boolean);
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Busy//Project Planner//EN', 'CALSCALE:GREGORIAN'];
      x.milestones.filter((m) => m.due).forEach((m) => lines.push(...ev(m.id, m.due, `◆ ${m.title} (${x.p.name})`, 'Milestone')));
      x.tasks.filter((t) => open(t) && t.due).forEach((t) => lines.push(...ev(t.id, t.due, `${t.title} (${x.p.name})`, t.notes || '')));
      lines.push('END:VCALENDAR');
      return lines.join('\r\n') + '\r\n';
    },
  });
})();
