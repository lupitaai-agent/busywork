// Project planning sums (shared/projects.js): health, dependencies, moving dates, workload, risks,
// the weekly update, templates and the calendar export.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, plain } = require('./harness.js');

async function pm() { const { BW } = await busywork(['shared/projects.js']); return BW; }
const T = (id, o) => Object.assign({ id, projectId: 'p', title: id, status: 'todo' }, o);

test('health: on track, at risk and off track, with reasons', async () => {
  const BW = await pm();
  const on = '2026-11-10';
  const base = { p: { id: 'p', name: 'Shop', due: '2026-12-01' }, milestones: [], log: [] };
  assert.equal(BW.pm.health(Object.assign({}, base, { tasks: [T('a', { due: '2026-11-20' })] }), null, on).level, 'green');
  const amber = BW.pm.health(Object.assign({}, base, { tasks: [T('a', { due: '2026-11-05' })] }), null, on);
  assert.equal(amber.level, 'amber');
  assert.match(amber.reasons.join(), /1 task is late/);
  const red = BW.pm.health(Object.assign({}, base, { tasks: [T('a', { due: '2026-12-15' })] }), null, on);
  assert.equal(red.level, 'red');
  assert.match(red.reasons.join(), /after the deadline/);
  const ms = BW.pm.health(Object.assign({}, base, { tasks: [], milestones: [{ id: 'm', title: 'Opening', due: '2026-11-01', done: false }] }), null, on);
  assert.equal(ms.level, 'red');
  assert.match(ms.reasons[0], /Milestone “Opening” passed/);
  const set = BW.pm.health(Object.assign({}, base, { p: Object.assign({}, base.p, { health: 'amber' }), tasks: [] }), null, on);
  assert.deepEqual([set.level, set.auto, set.set], ['amber', 'green', true], 'the owner can set it by hand');
});

test('dependencies: a task that starts before what it waits for is flagged', async () => {
  const BW = await pm();
  const tasks = [T('a', { start: '2026-11-01', due: '2026-11-05' }), T('b', { start: '2026-11-04', due: '2026-11-06', after: ['a'] }), T('c', { start: '2026-11-06', due: '2026-11-07', after: ['a'] })];
  assert.deepEqual(plain(BW.pm.conflicts(tasks).map((c) => [c.task.id, c.waitsFor.id])), [['b', 'a']]);
  tasks[0].status = 'done';
  assert.equal(BW.pm.conflicts(tasks).length, 0, 'done work no longer blocks');
});

test('moving a task pushes what waits for it, keeping each length, and nothing else', async () => {
  const BW = await pm();
  const tasks = [
    T('a', { start: '2026-11-02', due: '2026-11-04' }),
    T('b', { start: '2026-11-05', due: '2026-11-07', after: ['a'] }),
    T('c', { start: '2026-11-08', due: '2026-11-08', after: ['b'] }),
    T('d', { start: '2026-11-20', due: '2026-11-21', after: ['a'] }),
    T('e', { start: '2026-11-05', due: '2026-11-06' }),
  ];
  const changed = Object.fromEntries(BW.pm.move(tasks, 'a', '2026-11-04', '2026-11-08').map((t) => [t.id, [t.start, t.due]]));
  assert.deepEqual(plain(changed), { a: ['2026-11-04', '2026-11-08'], b: ['2026-11-09', '2026-11-11'], c: ['2026-11-12', '2026-11-12'] });
  assert.equal(tasks[1].start, '2026-11-05', 'the originals are not changed');
  const loop = [T('x', { start: '2026-11-01', due: '2026-11-02', after: ['y'] }), T('y', { start: '2026-11-03', due: '2026-11-03', after: ['x'] })];
  assert.ok(BW.pm.move(loop, 'x', '2026-11-05', '2026-11-06').length <= 2, 'a loop of dependencies ends');
});

test('workload spreads hours over working days and flags too much', async () => {
  const BW = await pm();
  const d = { people: [{ id: 'anna', name: 'Anna', hours: 10 }, { id: 'piet', name: 'Piet' }], tasks: [
    T('a', { assigneeId: 'anna', start: '2030-01-07', due: '2030-01-11', hours: 20 }), // Mon to Fri: 20 hours in one week
    T('b', { assigneeId: 'piet', start: '2030-01-07', due: '2030-01-18', hours: 10 }), // two weeks
    T('c', { assigneeId: 'piet', due: '2030-01-08', status: 'done', hours: 99 }),
  ] };
  const w = BW.pm.workload(d, '2030-01-07', 2);
  assert.deepEqual(plain(w.map((r) => [r.person.name, r.hours, r.over])), [['Anna', [20, 0], [true, false]], ['Piet', [5, 5], [false, false]]]);
  assert.equal(w[1].cap, BW.pm.DEFAULT_WEEK);
});

test('risk level from likelihood and impact', async () => {
  const BW = await pm();
  assert.deepEqual(plain([[1, 1], [1, 3], [2, 2], [2, 3], [3, 3], ['', '']].map(([l, i]) => BW.pm.riskLevel(l, i))), ['low', 'medium', 'medium', 'high', 'critical', 'low']);
});

test('the weekly update comes from the plan', async () => {
  const BW = await pm();
  const on = '2026-11-10';
  const x = { p: { id: 'p', name: 'Signage' }, milestones: [{ id: 'm', title: 'Install', due: '2026-11-20', done: false }], log: [{ kind: 'risk', projectId: 'p', title: 'Printer late', likelihood: 3, impact: 2 }, { kind: 'risk', title: 'Rain', likelihood: 1, impact: 1 }], tasks: [
    T('Sketches', { status: 'done', doneAt: '2026-11-08' }), T('Old thing', { status: 'done', doneAt: '2026-10-01' }),
    T('Print', { due: '2026-11-14', assigneeId: 'sam' }), T('Feedback', { status: 'waiting', due: '2026-11-25' }), T('Measure', { due: '2026-11-03' }),
  ] };
  const u = BW.pm.weekly(x, null, on);
  assert.deepEqual(plain([u.done.map((t) => t.id), u.next.map((t) => t.id), u.late.map((t) => t.id), u.stuck.map((t) => t.id), u.risks.map((r) => r.title), u.milestone.title]),
    [['Sketches'], ['Print'], ['Measure'], ['Feedback'], ['Printer late'], 'Install']);
  const text = BW.pm.updateText(x, u, [{ id: 'sam', name: 'Sam' }]);
  assert.match(text, /^Signage: at risk/);
  assert.match(text, /Done this week:\n- Sketches/);
  assert.match(text, /- Print, .*\(Sam\)/);
  assert.match(text, /Next milestone: Install/);
});

test('every template makes a sound plan: ids, milestones and waits all point somewhere real', async () => {
  const BW = await pm();
  for (const tpl of BW.pm.TEMPLATES) {
    const { project, milestones, tasks } = BW.pm.fromTemplate(tpl, '2026-11-02', { name: 'Test' });
    assert.equal(project.name, 'Test');
    assert.ok(project.due >= project.start, tpl.id);
    const ids = new Set(tasks.map((t) => t.id));
    for (const t of tasks) {
      assert.ok(t.start <= t.due, `${tpl.id}: ${t.title} dates`);
      assert.ok(!t.milestoneId || milestones.some((m) => m.id === t.milestoneId), `${tpl.id}: ${t.title} milestone`);
      for (const a of t.after) assert.ok(ids.has(a), `${tpl.id}: ${t.title} waits for a real task`);
      const m = milestones.find((x) => x.id === t.milestoneId);
      assert.ok(!m || t.due <= m.due, `${tpl.id}: ${t.title} ends by its milestone`);
    }
    assert.deepEqual(plain(BW.pm.conflicts(tasks).map((c) => c.task.title)), [], `${tpl.id}: no task starts before what it waits for`);
    for (const m of milestones) assert.ok(m.due <= project.due, `${tpl.id}: ${m.title} before the deadline`);
  }
});

test('the project calendar is valid iCalendar with milestones and open tasks', async () => {
  const BW = await pm();
  const x = { p: { name: 'Café, signage' }, milestones: [{ id: 'm1', title: 'Install ✨🪧', due: '2026-11-20' }], tasks: [T('t1', { title: 'Print', due: '2026-11-14' }), T('t2', { due: '2026-11-15', status: 'done' })] };
  const ics = BW.pm.ics(x);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  for (const l of ics.split('\r\n')) assert.ok(Buffer.byteLength(l) <= 75, l);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2, 'done tasks are left out');
  assert.match(ics.replace(/\r\n /g, ''), /SUMMARY:◆ Install ✨🪧 \(Café\\, signage\)/);
});

test('progress counts tasks and hours', async () => {
  const BW = await pm();
  const pr = BW.pm.progress({ milestones: [{ done: true }, {}], tasks: [T('a', { status: 'done', hours: 6 }), T('b', { hours: '2' }), T('c')] });
  assert.deepEqual(plain(pr), { total: 3, done: 1, pct: 33, hours: 10, hoursDone: 6, milestones: 2, milestonesDone: 1 });
});

test('who has too much on shows in health, but stays out of the update a client may read', async () => {
  const BW = await pm();
  const on = BW.today();
  const t = T('big', { assigneeId: 'daan', start: on, due: BW.addDays(on, 2), hours: 80 });
  const d = { people: [{ id: 'daan', name: 'Daan', hours: 12 }], tasks: [t] };
  const x = { p: { id: 'p', name: 'Signs' }, milestones: [], log: [], tasks: [t] };
  assert.match(BW.pm.health(x, d).reasons.join(), /Daan has more work than hours/);
  const u = BW.pm.weekly(x, d);
  assert.equal(u.health, 'amber');
  assert.ok(!BW.pm.updateText(x, u).includes('Daan has more work'));
});
