/* Example data for Busy Growth: Lena, a customer service team lead learning her way into data
   analysis, so people can see every growth tool full of life. Used by the website demo only; not in
   any download. Every record carries example: true. */
(function () {
  'use strict';
  const BW = window.BW;
  const day = (n) => BW.addDays(BW.today(), n);

  BW.growthExamples = {
    settings: {
      suite: 'growth', ownerName: 'Lena Bakker', headline: 'Customer service team lead', targetRole: 'data analyst',
      goal: 'Land a data analyst role by the summer', learnHoursWeek: 3, email: 'lena@example.com', city: 'Utrecht',
    },
    async load() {
      const id = () => BW.uid();
      const ex = (o) => Object.assign({ id: id(), example: true }, o);
      const sk = {
        sql: ex({ name: 'SQL', category: 'Data', level: 2, target: 4, notes: 'Joins are fine now; window functions next.' }),
        excel: ex({ name: 'Excel', category: 'Data', level: 4, target: 4 }),
        viz: ex({ name: 'Data visualisation', category: 'Data', level: 2, target: 4 }),
        python: ex({ name: 'Python', category: 'Data', level: 1, target: 3 }),
        people: ex({ name: 'Stakeholder management', category: 'People', level: 4, target: 4 }),
        stats: ex({ name: 'Statistics', category: 'Data', level: 2, target: 3 }),
      };
      const sessions = (list) => list.map(([d, minutes]) => ({ date: day(d), minutes }));
      const learning = [
        ex({ title: 'SQL for data analysis', kind: 'course', provider: 'Online course', status: 'doing', start: day(-30), due: day(30), hoursPlanned: 20, skillIds: [sk.sql.id],
          sessions: sessions([[-1, 45], [-3, 30], [-8, 60], [-10, 40], [-15, 50], [-22, 45]]) }),
        ex({ title: 'Storytelling with data', kind: 'book', provider: 'Book', status: 'done', start: day(-60), doneAt: day(-20), skillIds: [sk.viz.id], sessions: sessions([[-25, 60], [-21, 90]]) }),
        ex({ title: 'Python basics', kind: 'course', provider: 'Free course', status: 'planned', start: day(14), hoursPlanned: 12, skillIds: [sk.python.id] }),
      ];
      const library = [
        ex({ kind: 'link', title: 'A friendly guide to SQL window functions', url: 'https://example.com/sql-window-functions', notes: 'Finally understood ROW_NUMBER. Use it for the repeat-ticket report.',
          tags: 'sql', skillIds: [sk.sql.id], status: 'read', addedAt: day(-12), readAt: day(-11) }),
        ex({ kind: 'link', title: 'Choosing the right chart', url: 'https://example.com/choosing-a-chart', notes: 'Bar charts for comparing, lines for time. Never two axes.',
          tags: 'charts', skillIds: [sk.viz.id], status: 'to-read', addedAt: day(-3) }),
        ex({ kind: 'link', title: 'What a data analyst does all day', url: 'https://example.com/analyst-day', tags: 'career', status: 'reading', addedAt: day(-6) }),
        ex({ kind: 'note', title: 'Questions to ask in interviews', notes: 'Who uses the reports? What does a good first 90 days look like? Which tools does the team use?', tags: 'career, interviews', addedAt: day(-5) }),
      ];
      const wins = [
        ex({ date: day(-26), title: 'Cut the weekly ticket report from 3 hours to 20 minutes', what: 'Rebuilt the report with a SQL query and a pivot table instead of copying by hand.',
          result: '2.5 hours saved every week', proof: 'The team lead meeting notes', skillIds: [sk.sql.id, sk.excel.id], tags: 'reporting' }),
        ex({ date: day(-12), title: 'Built a dashboard the support team uses every morning', what: 'One page with open tickets, waiting times and the busiest hours.',
          result: 'Waiting times down 18% in a month', skillIds: [sk.viz.id], tags: 'dashboard' }),
        ex({ date: day(-50), title: 'Trained four new colleagues in two weeks', what: 'Wrote a short handbook and paired with each of them.', result: 'All four on their own in half the usual time', skillIds: [sk.people.id] }),
      ];
      const career = [
        ex({ type: 'job', title: 'Team lead customer service', org: 'Fietsplan', place: 'Utrecht', start: '2022-03', current: true,
          bullets: 'Lead a team of 8 handling 1,200 tickets a week\nBuilt the weekly reporting in SQL and Excel\nIntroduced a morning dashboard for the team' }),
        ex({ type: 'job', title: 'Customer service agent', org: 'Fietsplan', place: 'Utrecht', start: '2019-09', end: '2022-02', bullets: 'Top-rated agent two years running' }),
        ex({ type: 'education', title: 'BA Communication', org: 'University of Applied Sciences Utrecht', place: 'Utrecht', start: '2015-09', end: '2019-06' }),
      ];
      const cv = ex({ name: 'Data analyst CV', headline: 'Customer service lead moving into data analysis',
        summary: 'Team lead who turned weekly reporting from a chore into a dashboard. Learning SQL and Python, with real results to show.',
        skillIds: [sk.sql.id, sk.excel.id, sk.viz.id, sk.people.id], winIds: [wins[0].id, wins[1].id] });
      const story = ex({ title: 'The three-hour report', winId: wins[0].id, skillIds: [sk.sql.id, sk.excel.id],
        situation: 'Every Monday I spent three hours copying ticket numbers into a spreadsheet for the management meeting.',
        task: 'The numbers were late and sometimes wrong. I wanted a report that was right and quick.',
        action: 'I taught myself enough SQL to pull the numbers straight from the ticket system, and built a pivot table on top.',
        result: 'It takes 20 minutes now: 2.5 hours saved every week, and nobody has found a mistake since.', practised: 2, lastPractised: day(-4) });
      const contacts = [
        ex({ name: 'Anna de Vries', how: 'manager', role: 'Head of operations', org: 'Fietsplan', email: 'anna@example.com', every: '3', lastContact: day(-110),
          notes: 'My first manager. Knows the data team at Greenline.', log: [{ date: day(-110), note: 'Lunch. She offered to introduce me to the data team at Greenline.' }] }),
        ex({ name: 'Bram Peters', how: 'mentor', role: 'Senior data analyst', org: 'Northwind', every: '1', lastContact: day(-12),
          log: [{ date: day(-12), note: 'Went through my SQL portfolio. Tip: show the before and after of the report.' }] }),
        ex({ name: 'Sara Jansen', how: 'recruiter', role: 'Recruiter', org: 'Acme', lastContact: day(-9), nextDate: day(5), notes: 'Recruiter for the Acme data analyst role.' }),
      ];
      const a = (o, hist) => ex(Object.assign({ history: hist.map(([d, status]) => ({ date: day(d), status })) }, o));
      const applications = [
        a({ company: 'Acme', role: 'Data analyst', status: 'applied', savedAt: day(-14), appliedAt: day(-9), nextDate: day(-2), nextStep: 'Email Sara to ask about timing',
          location: 'Utrecht, hybrid', cvId: cv.id, contactId: contacts[2].id, adText: 'We are looking for a data analyst with SQL, Excel and data visualisation skills, who can explain numbers to colleagues.' }, [[-14, 'saved'], [-9, 'applied']]),
        a({ company: 'Greenline', role: 'Junior BI analyst', status: 'interview', savedAt: day(-20), appliedAt: day(-18), reachedInterview: true, heardBack: true, nextDate: day(3), nextStep: 'Second interview: prepare the dashboard story',
          contactId: contacts[0].id, storyIds: [story.id], adText: 'Junior BI analyst. SQL and dashboards, stakeholder management.' }, [[-20, 'saved'], [-18, 'applied'], [-6, 'interview']]),
        a({ company: 'Northwind', role: 'Data analyst', status: 'saved', savedAt: day(-2), location: 'Amsterdam' }, [[-2, 'saved']]),
      ];
      const lastWeek = BW.addDays(BW.growth.weekStart(BW.today()), -7);
      const reviews = [
        ex({ week: lastWeek, went: 'Finished chapter 6 of the SQL course\nThe dashboard went live', hard: 'Little time on Wednesday and Thursday', energy: 4,
          next: 'Finish the window functions chapter\nFollow up with Acme\nAsk Anna about Greenline', nextDone: [2], focusSkillId: sk.sql.id, minutes: 100, finished: 0, wins: 1, applied: 0, read: 1 }),
      ];
      const put = [['skills', Object.values(sk)], ['learning', learning], ['library', library], ['wins', wins], ['career', career], ['cvs', [cv]], ['stories', [story]],
        ['contacts', contacts], ['applications', applications], ['reviews', reviews]];
      for (const [name, list] of put) await BW.store.putMany(name, list);
    },
  };
})();
