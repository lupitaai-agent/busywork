// Busy Growth (shared/growth.js): bookmarks, search, files dropped into the library folder, skill
// evidence and gaps, learning hours and streaks, and the brag document. Plus the suite plumbing in core.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { busywork, plain, APP } = require('./harness.js');

async function growth() { const { BW } = await busywork(['shared/growth.js']); return BW; }

test('bookmarks from a browser export become links, tagged by the folders they sit in', async () => {
  const BW = await growth();
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>
    <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
      <DT><A HREF="https://example.com/sql" ADD_DATE="1">Learn SQL &amp; more</A>
      <DT><H3>Career</H3>
      <DL><p>
        <DT><H3>Interviews</H3>
        <DL><p><DT><A HREF="https://example.com/star">STAR method</A></DL><p>
        <DT><A HREF="https://example.com/cv">CV tips</A>
      </DL><p>
      <DT><A HREF="javascript:alert(1)">A bookmarklet</A>
    </DL><p>
  </DL><p>`;
  const links = plain(BW.growth.parseBookmarks(html));
  assert.deepEqual(links.map((l) => [l.title, l.url, l.tags]), [
    ['Learn SQL & more', 'https://example.com/sql', ''],
    ['STAR method', 'https://example.com/star', 'career, interviews'],
    ['CV tips', 'https://example.com/cv', 'career'],
  ]);
  assert.ok(links.every((l) => l.kind === 'link' && l.status === 'to-read'));
  assert.deepEqual(plain(BW.growth.parseBookmarks('not a bookmarks file')), []);
});

test('search needs every word, ranks title hits first, and shows why something matched', async () => {
  const BW = await growth();
  const items = [
    { id: 'a', title: 'Pricing models', notes: 'value based pricing for agencies' },
    { id: 'b', title: 'Negotiation', highlights: 'start with the range, not a number; pricing anchors' },
    { id: 'c', title: 'Agency pricing playbook', tags: 'pricing, agencies' },
    { id: 'd', title: 'Unrelated', text: 'nothing here' },
  ];
  assert.deepEqual(plain(BW.growth.search(items, 'pricing').map((x) => x.id)), ['c', 'a', 'b']);
  assert.deepEqual(plain(BW.growth.search(items, 'pricing agencies').map((x) => x.id)), ['c', 'a']);
  assert.equal(BW.growth.search(items, '').length, 4);
  assert.match(BW.growth.snippet(items[1], 'anchors'), /pricing anchors/);
});

test('files dropped into library/ outside Busy get a record once; names never overwrite', async () => {
  const BW = await growth();
  const known = [{ kind: 'file', path: 'library/Report.pdf' }];
  const fresh = plain(BW.growth.newFiles(known, ['report.PDF', 'notes.md', '.DS_Store', 'slides.pptx']));
  assert.deepEqual(fresh.map((f) => [f.title, f.path, f.kind]), [['notes', 'library/notes.md', 'file'], ['slides', 'library/slides.pptx', 'file']]);
  assert.equal(BW.growth.freeName('cv.pdf', ['CV.pdf', 'cv (2).pdf']), 'cv (3).pdf');
  assert.equal(BW.growth.freeName('new.txt', ['cv.pdf']), 'new.txt');
  assert.equal(BW.growth.textOf('a.html', '<style>x{}</style><h1>Hi&nbsp;there</h1><p>you</p>'), 'Hi there you');
  assert.ok(BW.growth.TEXT_FILES.test('notes.md') && !BW.growth.TEXT_FILES.test('book.pdf'));
});

test('a skill’s proof comes from wins, learning and the library; the biggest gaps come first', async () => {
  const BW = await growth();
  const data = { library: [{ id: 'l1', skillIds: ['sql'] }, { id: 'l2' }], learning: [{ id: 'c1', skillIds: ['sql', 'excel'] }], wins: [{ id: 'w1', skillIds: ['excel'] }] };
  const ev = BW.growth.evidence('sql', data);
  assert.deepEqual([ev.library.length, ev.learning.length, ev.wins.length], [1, 1, 0]);
  assert.equal(BW.growth.evidenceCount(BW.growth.evidence('excel', data)), 2);
  const skills = [{ id: 'a', name: 'Writing', level: 3, target: 4 }, { id: 'b', name: 'SQL', level: 1, target: 4 }, { id: 'c', name: 'Excel', level: 4, target: 4 }, { id: 'd', name: 'Design', level: '2', target: '' }];
  assert.deepEqual(plain(BW.growth.gaps(skills).map((s) => s.name)), ['SQL', 'Writing']);
});

test('learning time: this week from Monday, and weeks in a row with time logged', async () => {
  const BW = await growth();
  // 2026-10-28 is a Wednesday; its week runs Monday 26 October to Sunday 1 November.
  const learning = [{ sessions: [{ date: '2026-10-26', minutes: 30 }, { date: '2026-11-01', minutes: '45' }, { date: '2026-10-25', minutes: 60 }] },
    { sessions: [{ date: '2026-10-14', minutes: 20 }, { date: '2026-10-05', minutes: 10 }] }];
  assert.equal(BW.growth.weekStart('2026-10-28'), '2026-10-26');
  assert.equal(BW.growth.weekMinutes(learning, '2026-10-28'), 75);
  assert.equal(BW.growth.learningStreak(learning, '2026-10-28'), 4, 'this week, last week, the week before and the one before that');
  assert.equal(BW.growth.learningStreak([{ sessions: [{ date: '2026-10-21', minutes: 5 }] }], '2026-10-28'), 1, 'nothing yet this week still counts last week');
  assert.equal(BW.growth.learningStreak([], '2026-10-28'), 0);
  assert.equal(BW.growth.itemMinutes(learning[0]), 135);
  assert.equal(BW.growth.hours(75), '1.3 h');
});

test('the brag document lists one year of wins by month, with results, proof and skills', async () => {
  const BW = await growth();
  const skills = [{ id: 's1', name: 'SQL' }];
  const wins = [
    { date: '2026-03-02', title: 'Faster report', what: 'Rebuilt it in SQL.', result: '3 hours to 20 minutes', skillIds: ['s1'], proof: 'Email from Anna' },
    { date: '2026-01-15', title: 'First talk' },
    { date: '2025-12-01', title: 'Last year' },
  ];
  const md = BW.growth.bragDoc(wins, skills, 2026, 'Sam');
  assert.match(md, /^# Sam: wins in 2026/);
  assert.ok(md.indexOf('January 2026') < md.indexOf('March 2026'), 'oldest first');
  assert.match(md, /\*\*Result:\*\* 3 hours to 20 minutes/);
  assert.match(md, /\*\*Skills:\*\* SQL/);
  assert.match(md, /\*\*Proof:\*\* Email from Anna/);
  assert.doesNotMatch(md, /Last year/);
});

test('Growth is its own suite: its tools, its home page, its own pages', async () => {
  const { BW } = await busywork();
  const growthApps = BW.apps.filter((a) => a.suite === 'growth');
  assert.deepEqual(plain(growthApps.filter((a) => a.ready).map((a) => a.id)), ['library', 'learning', 'skills', 'wins']);
  assert.ok(BW.apps.filter((a) => a.suite === 'business').some((a) => a.id === 'invoices'));
  assert.ok(BW.apps.every((a) => BW.SUITES[a.suite]), 'every tool belongs to a known suite');
  assert.equal(BW.SUITES.growth.home, 'growth.html');
  assert.notEqual(BW.SUITES.growth.key, BW.SUITES.business.key, 'a growth folder is remembered apart from a business folder');
  for (const a of growthApps.filter((x) => x.ready)) {
    const page = fs.readFileSync(path.join(APP, 'apps', a.id, 'index.html'), 'utf8');
    assert.match(page, /data-suite="growth"/, `${a.id} says it belongs to Growth`);
    assert.match(page, /shared\/growth\.js/);
  }
  assert.match(fs.readFileSync(path.join(APP, 'growth.html'), 'utf8'), /data-suite="growth"[\s\S]*growth-home\.js/);
});
