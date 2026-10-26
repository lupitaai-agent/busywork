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
  assert.deepEqual(plain(growthApps.filter((a) => a.ready).map((a) => a.id)), ['library', 'learning', 'skills', 'wins', 'jobs', 'cv', 'stories']);
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

test('job ads: which of your skills they name, as whole words', async () => {
  const BW = await growth();
  const skills = [{ id: 'a', name: 'SQL' }, { id: 'b', name: 'Data analysis' }, { id: 'c', name: 'C++' }, { id: 'd', name: 'Design' }, { id: 'e', name: 'Excel' }];
  const ad = 'You know SQL and data-analysis, some C++; design-thinking is a plus. We use Excel/Sheets daily. No designer needed.';
  assert.deepEqual(plain(BW.growth.matchSkills(ad, skills).map((s) => s.name)), ['SQL', 'Data analysis', 'C++', 'Design', 'Excel']);
  assert.deepEqual(plain(BW.growth.matchSkills('We need a designer', skills)), [], '“designer” is not “design”');
  assert.deepEqual(plain(BW.growth.matchSkills('', skills)), []);
});

test('moving an application keeps its history, sets the follow-up a week after applying, and counts replies', async () => {
  const BW = await growth();
  let a = { company: 'Acme', status: 'saved' };
  a = BW.growth.moveTo(a, 'applied', '2026-10-26');
  assert.deepEqual([a.appliedAt, a.nextDate], ['2026-10-26', '2026-11-02']);
  assert.equal(BW.growth.followUpsDue([a], '2026-11-01').length, 0);
  assert.equal(BW.growth.followUpsDue([a], '2026-11-02').length, 1, 'due on the day');
  a = BW.growth.moveTo(a, 'interview', '2026-11-05');
  a = BW.growth.moveTo(a, 'rejected', '2026-11-20');
  assert.deepEqual(plain(a.history.map((h) => h.status)), ['applied', 'interview', 'rejected']);
  assert.equal(a.nextDate, '', 'nothing to follow up once it’s closed');
  assert.equal(BW.growth.stageOf(a), 'closed');
  assert.ok(a.reachedInterview, 'an interview stays an interview in the stats');
  const apps = [a, BW.growth.moveTo({ status: 'saved' }, 'applied', '2026-10-01'), { status: 'saved' }, BW.growth.moveTo({ status: 'applied' }, 'offer', '2026-10-30')];
  assert.deepEqual(plain(BW.growth.jobStats(apps)), { active: 2, sent: 3, interviews: 2, offers: 1, replyRate: 67 });
});

test('a CV version shows what it includes, newest job first, with highlights and skills in your order', async () => {
  const BW = await growth();
  const career = [
    { id: 'j1', type: 'job', title: 'Assistant', org: 'Shop', start: '2019-01', end: '2021-06', bullets: '- Opened the shop\n• Ran the till' },
    { id: 'j2', type: 'job', title: 'Coordinator', org: 'Bakery', start: '2021-07', current: 1, bullets: 'Weekly newsletter for 4,000 customers' },
    { id: 'e1', type: 'education', title: 'BSc Marketing', org: 'HU', start: '2015-09', end: '2019-06' },
    { id: 'x', type: 'job', title: 'Left out', start: '2010-01', end: '2011-01' },
  ];
  const cv = { headline: 'Marketer', include: ['j1', 'j2', 'e1'], skillIds: ['s2', 's1'], winIds: ['w1'], extras: 'Dutch (native)\nEnglish (fluent)' };
  const m = BW.growth.cvModel(cv, { career, skills: [{ id: 's1', name: 'SQL' }, { id: 's2', name: 'Writing' }], wins: [{ id: 'w1', title: 'Faster report', result: '3 h to 20 min' }],
    settings: { ownerName: 'Sam Jansen', email: 'sam@example.com', linkedin: 'linkedin.com/in/sam' } });
  assert.equal(m.name, 'Sam Jansen');
  assert.deepEqual(plain(m.work.map((w) => w.title)), ['Coordinator', 'Assistant']);
  assert.match(m.work[0].period, /2021 – now$/);
  assert.deepEqual(plain(m.work[1].bullets), ['Opened the shop', 'Ran the till']);
  assert.deepEqual(plain(m.education.map((x) => x.title)), ['BSc Marketing']);
  assert.deepEqual(plain(m.skills), ['Writing', 'SQL']);
  assert.deepEqual(plain(m.highlights), ['Faster report: 3 h to 20 min']);
  assert.deepEqual(plain(m.extras), ['Dutch (native)', 'English (fluent)']);
  assert.deepEqual(plain(m.contact), ['sam@example.com', 'linkedin.com/in/sam']);
  assert.equal(BW.growth.cvModel({}, { career }).work.length, 3, 'no choice yet means everything');
});

test('a cover letter draft uses the wins that prove the skills the ad asks for, and leaves room to write', async () => {
  const BW = await growth();
  const skills = [{ id: 's1', name: 'SQL' }, { id: 's2', name: 'Writing' }];
  const wins = [{ title: 'Faster report', result: '3 h to 20 min', skillIds: ['s1'], date: '2026-01-01' }, { title: 'Blog relaunch', skillIds: ['s2'], date: '2026-05-01' }];
  const letter = BW.growth.coverLetter({ company: 'Acme', role: 'Data analyst', contact: 'Anna', adText: 'Strong SQL needed' }, { settings: { ownerName: 'Sam', headline: 'A marketing coordinator' }, wins, skills });
  assert.match(letter, /^Dear Anna,/);
  assert.match(letter, /the Data analyst role at Acme/);
  assert.match(letter, /You’re looking for SQL\./, 'skill names keep their capitals');
  assert.match(letter, /currently a marketing coordinator/);
  assert.match(letter, /- Faster report: 3 h to 20 min\./);
  assert.doesNotMatch(letter, /Blog relaunch/, 'only the wins that match the ad');
  assert.match(letter, /\[One line on why this company/, 'a gap only you can fill');
  assert.match(letter, /Kind regards,\nSam$/);
});

test('interview stories: which questions they answer, and a win becomes a story to finish', async () => {
  const BW = await growth();
  const skills = [{ id: 'd', name: 'Data analysis' }];
  const stories = [
    { title: 'The broken newsletter', situation: 'The week the newsletter broke', action: 'I fixed the template', result: 'Sent on time' },
    { title: 'Weekly report', result: 'Saved 3 hours', skillIds: ['d'] },
    { title: 'Half a story' },
  ];
  const q = (s) => BW.growth.QUESTIONS.find((x) => x[0].startsWith(s))[0];
  assert.deepEqual(plain(BW.growth.storiesFor(q('Tell me about a time you used data'), stories, skills).map((s) => s.title)), ['Weekly report'], 'found through the skill’s name');
  const solved = plain(BW.growth.storiesFor(q('Tell me about a time you solved'), stories, skills).map((s) => s.title));
  assert.ok(solved.includes('The broken newsletter') && !solved.includes('Half a story'), '“I fixed…” answers a problem question');
  assert.equal(BW.growth.storiesFor(q('Tell me about yourself'), stories, skills).length, 2, 'open questions: any story with a result');
  const cov = BW.growth.coverage(stories, skills);
  assert.equal(cov.length, BW.growth.QUESTIONS.length);
  assert.ok(cov.some((c) => !c.stories.length), 'and the questions still without a story');
  const learned = [{ title: 'Learned SQL', action: 'I learned SQL in a week', result: 'Report done' }];
  assert.equal(BW.growth.storiesFor(q('Tell me about a mistake'), learned, skills).length, 0, 'learning something is not a story about a mistake');
  const s = plain(BW.growth.storyFromWin({ id: 'w1', title: 'Faster report', what: 'Rebuilt it in SQL', result: '3 h to 20 min', skillIds: ['d'] }));
  assert.deepEqual([s.title, s.situation, s.result, s.winId, s.skillIds], ['Faster report', 'Rebuilt it in SQL', '3 h to 20 min', 'w1', ['d']]);
});
