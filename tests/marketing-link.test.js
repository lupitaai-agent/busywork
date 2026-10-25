// Marketing work in the project plan (BW.pm.linkMarketing): plan actions and posts become tasks in a
// "Marketing" project, changes flow both ways, deletes end the link, and running it twice changes nothing.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, plain } = require('./harness.js');

async function shop(seed) {
  const { BW } = await busywork(['shared/projects.js'], { seed });
  return BW;
}
const task = async (BW, link) => (await BW.store.all('tasks')).find((t) => t.link === link);

test('plan actions and posts become tasks in one Marketing project', async () => {
  const BW = await shop({
    mktplan: [{ id: 'a1', month: '2030-03', title: 'Spring window display', channel: 'Shop window', cost: 120, cep: 'A gift for Mother’s Day', status: 'planned' }, { id: 'bad', title: 'No month' }],
    mktcontent: [{ id: 'c1', date: '2030-03-14', title: 'Behind the scenes', channel: 'Instagram', status: 'draft', text: 'Flour everywhere.' }],
  });
  const r = await BW.pm.linkMarketing();
  assert.deepEqual(plain(r), { tasks: 2, marketing: 2, removed: 0 });
  const p = (await BW.store.all('projects')).find((x) => x.source === 'marketing');
  assert.equal(p.name, 'Marketing');
  assert.deepEqual([p.start, p.due], ['2030-03-01', '2030-03-31']);
  const a = await task(BW, 'plan:a1'), c = await task(BW, 'content:c1');
  assert.deepEqual([a.title, a.start, a.due, a.status, a.projectId], ['Spring window display', '2030-03-01', '2030-03-31', 'todo', p.id]);
  assert.match(a.notes, /Shop window.*Mother’s Day/);
  assert.deepEqual([c.title, c.start, c.due, c.hours], ['Behind the scenes', '2030-03-14', '2030-03-14', 1]);
  assert.match(c.notes, /Instagram[\s\S]*Flour everywhere/);
  assert.equal((await BW.store.all('mktplan')).find((x) => x.id === 'a1').taskId, a.id, 'the marketing item knows its task');
  assert.deepEqual(plain(await BW.pm.linkMarketing()), { tasks: 0, marketing: 0, removed: 0 }, 'a second run changes nothing');
});

test('done on the Board is done in the marketing plan, and the other way round', async () => {
  const BW = await shop({ mktplan: [{ id: 'a1', month: '2030-03', title: 'Flyers', status: 'planned' }], mktcontent: [{ id: 'c1', date: '2030-03-14', title: 'Post', status: 'ready' }] });
  await BW.pm.linkMarketing();
  const a = await task(BW, 'plan:a1'), c = await task(BW, 'content:c1');
  a.status = 'done'; c.status = 'done';
  await BW.store.putMany('tasks', [a, c]);
  await BW.pm.linkMarketing();
  assert.equal((await BW.store.get('mktplan', 'a1')).status, 'done');
  assert.equal((await BW.store.get('mktcontent', 'c1')).status, 'posted');
  // Back the other way: the Studio sets the action live and the post back to ready.
  const pa = await BW.store.get('mktplan', 'a1'); pa.status = 'live'; await BW.store.put('mktplan', pa);
  const pc = await BW.store.get('mktcontent', 'c1'); pc.status = 'ready'; await BW.store.put('mktcontent', pc);
  await BW.pm.linkMarketing();
  assert.equal((await task(BW, 'plan:a1')).status, 'doing');
  assert.equal((await task(BW, 'content:c1')).status, 'todo');
  assert.equal((await task(BW, 'content:c1')).doneAt, '');
});

test('waiting on the Board counts as live, without overwriting waiting', async () => {
  const BW = await shop({ mktplan: [{ id: 'a1', month: '2030-03', title: 'Flyers', status: 'planned' }] });
  await BW.pm.linkMarketing();
  const a = await task(BW, 'plan:a1'); a.status = 'waiting'; await BW.store.put('tasks', a);
  await BW.pm.linkMarketing();
  assert.equal((await BW.store.get('mktplan', 'a1')).status, 'live');
  assert.equal((await task(BW, 'plan:a1')).status, 'waiting');
});

test('moving dates and renaming flow both ways; the plan keeps months, the timeline keeps days', async () => {
  const BW = await shop({ mktplan: [{ id: 'a1', month: '2030-03', title: 'Flyers', status: 'planned' }], mktcontent: [{ id: 'c1', date: '2030-03-14', title: 'Post' }] });
  await BW.pm.linkMarketing();
  const a = await task(BW, 'plan:a1');
  a.start = '2030-04-07'; a.due = '2030-04-11'; a.title = 'Flyers for the market'; await BW.store.put('tasks', a);
  await BW.pm.linkMarketing();
  const pa = await BW.store.get('mktplan', 'a1');
  assert.deepEqual([pa.month, pa.title], ['2030-04', 'Flyers for the market']);
  assert.deepEqual([(await task(BW, 'plan:a1')).start, (await task(BW, 'plan:a1')).due], ['2030-04-07', '2030-04-11'], 'days the owner chose stay');
  const c = await BW.store.get('mktcontent', 'c1'); c.date = '2030-03-20'; await BW.store.put('mktcontent', c);
  await BW.pm.linkMarketing();
  assert.deepEqual([(await task(BW, 'content:c1')).start, (await task(BW, 'content:c1')).due], ['2030-03-20', '2030-03-20']);
});

test('when both sides changed the same thing, the newer change wins', async () => {
  const BW = await shop({ mktplan: [{ id: 'a1', month: '2030-03', title: 'Flyers', status: 'planned' }] });
  await BW.pm.linkMarketing();
  const a = await task(BW, 'plan:a1'); a.title = 'Older title'; await BW.store.put('tasks', a);
  await new Promise((r) => setTimeout(r, 5));
  const pa = await BW.store.get('mktplan', 'a1'); pa.title = 'Newer title'; await BW.store.put('mktplan', pa);
  await BW.pm.linkMarketing();
  assert.equal((await task(BW, 'plan:a1')).title, 'Newer title');
  assert.equal((await BW.store.get('mktplan', 'a1')).title, 'Newer title');
});

test('who does it, hours and waits belong to the task and survive a link', async () => {
  const BW = await shop({ mktplan: [{ id: 'a1', month: '2030-03', title: 'Flyers' }] });
  await BW.pm.linkMarketing();
  const a = await task(BW, 'plan:a1'); Object.assign(a, { assigneeId: 'noor', hours: 6, after: ['x'] }); await BW.store.put('tasks', a);
  const pa = await BW.store.get('mktplan', 'a1'); pa.title = 'Flyers, round 2'; await BW.store.put('mktplan', pa);
  await BW.pm.linkMarketing();
  const now = await task(BW, 'plan:a1');
  assert.deepEqual(plain([now.title, now.assigneeId, now.hours, now.after]), ['Flyers, round 2', 'noor', 6, ['x']]);
});

test('deleting the marketing item removes its task; deleting the task ends the link', async () => {
  const BW = await shop({ mktplan: [{ id: 'a1', month: '2030-03', title: 'Flyers' }, { id: 'a2', month: '2030-04', title: 'Market stall' }] });
  await BW.pm.linkMarketing();
  await BW.store.remove('mktplan', 'a1');
  const t2 = await task(BW, 'plan:a2'); await BW.store.remove('tasks', t2.id);
  const r = await BW.pm.linkMarketing();
  assert.equal(r.removed, 1);
  assert.equal(await task(BW, 'plan:a1'), undefined);
  assert.equal(await task(BW, 'plan:a2'), undefined, 'a task deleted on purpose does not come back');
  assert.ok(await BW.store.get('mktplan', 'a2'), 'and the marketing item stays');
});

test('no marketing, no Marketing project; pm.load links before it reads', async () => {
  const BW = await shop({ projects: [{ id: 'p', name: 'Other' }] });
  await BW.pm.linkMarketing();
  assert.equal((await BW.store.all('projects')).length, 1);
  await BW.store.put('mktplan', { id: 'a9', month: '2030-05', title: 'Open day' });
  const d = await BW.pm.load();
  assert.ok(d.tasks.some((t) => t.link === 'plan:a9'));
  assert.ok(d.projects.some((p) => p.source === 'marketing'));
});

test('two links at once in one tab do not make double tasks', async () => {
  const BW = await shop({ mktplan: [{ id: 'a1', month: '2030-03', title: 'Flyers' }] });
  await Promise.all([BW.pm.linkMarketing(), BW.pm.linkMarketing(), BW.pm.load()]);
  assert.equal((await BW.store.all('tasks')).length, 1);
  assert.equal((await BW.store.all('projects')).length, 1);
});

test('the example business comes and goes with its linked tasks and Marketing project', async () => {
  const { BW } = await busywork(['shared/projects.js', 'shared/examples.js']);
  await BW.examples.load();
  await BW.pm.linkMarketing();
  const linked = (await BW.store.all('tasks')).filter((t) => t.link);
  assert.ok(linked.length >= 10);
  assert.ok(linked.every((t) => t.example));
  await BW.examples.remove();
  await BW.pm.linkMarketing();
  assert.equal((await BW.store.all('tasks')).length, 0);
  assert.equal((await BW.store.all('projects')).length, 0, 'no empty Marketing project left behind');
});
