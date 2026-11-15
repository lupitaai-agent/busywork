/* Busy Growth opens on Today: the moment you are in (a review coming, a raise to ask for, applying, or simply
   growing), at most three things to do about it, and your worth in short beside them. The tools are in the parts of
   the rail (My worth, Grow, Say it), never in a grid here. */
(function () {
  'use strict';
  const { $, $$, esc, ui } = BW;
  const G = BW.growth;
  const main = $('#main');

  BW.boot({ part: 'today', onReady: render, onChange: render });

  const MOMENTS = [['review', '📅', 'My review'], ['raise', '💶', 'A raise'], ['applying', '📨', 'Applying'], ['growing', '🌱', 'Just growing']];

  async function render() {
    const s = BW.settings, today = BW.today();
    const [library, learning, skills, wins, apps, contacts, reviews, cvs] = await Promise.all(['library', 'learning', 'skills', 'wins', 'applications', 'contacts', 'reviews', 'cvs'].map((n) => BW.store.all(n)));
    const moment = MOMENTS.some((m) => m[0] === s.moment) ? s.moment : 'growing';
    const yearAgo = BW.addDays(today, -365);
    const results = wins.filter((w) => (w.date || '') >= yearAgo && (w.result || '').trim());
    const followUps = G.followUpsDue(apps, today), catchUp = G.catchUpDue(contacts, today);
    const doing = learning.filter((x) => x.status === 'doing');
    const weekMin = G.weekMinutes(learning, today), target = BW.num(s.learnHoursWeek) * 60;
    const active = apps.filter((a) => !G.CLOSED.some((c) => c[0] === a.status) && a.status !== 'saved');
    const empty = !(library.length + learning.length + wins.length + skills.length);

    const needs = [];
    const add = (w, n) => needs.push(Object.assign({ w }, n));
    if (empty) {
      add(99, { c: 'sky', e: '💼', t: 'Start from LinkedIn', s: 'Your jobs, skills and certificates, in ten minutes', b: 'Bring it in', href: 'apps/cv/index.html#import' });
      add(98, { c: 'pink', e: '🧠', t: 'Add three things you can do', s: 'And how well: that is the start of your worth', b: 'Add a skill', href: 'apps/skills/index.html#new' });
      add(97, { c: 'sun', e: '🏆', t: 'Write down one thing that went well', s: 'Big or small, with what it changed', b: 'Log a win', href: 'apps/wins/index.html#new' });
    }
    if (moment === 'review' || moment === 'raise') {
      if (results.length < 3) add(92, { c: 'sun', e: '🏆', t: results.length ? `Find ${3 - results.length} more ${3 - results.length === 1 ? 'result' : 'results'} from this year` : 'Find three results from this year', s: 'What you did, and what it changed. A number if you have one.', b: 'Add a result', href: 'apps/wins/index.html#new' });
      else add(70, { c: 'mint', e: '📄', t: moment === 'raise' ? 'Put your three strongest results in a row' : 'Read your worth page once, out loud', s: 'It is what you will say in the room', b: 'Open my worth', href: 'growth-worth.html' });
      add(68, { c: 'grape', e: '🗣️', t: moment === 'raise' ? 'Write the sentence you will open with' : 'Lay out your notes for the review', s: 'Busy puts your results in order; you add the words', b: 'Say it', href: `growth-sayit.html#${moment}` });
    }
    if (moment === 'applying') {
      if (!cvs.length) add(92, { c: 'teal', e: '📄', t: 'Make your CV', s: 'From what you can do and what you achieved', b: 'Start', href: 'apps/cv/index.html#new' });
      if (!apps.length) add(90, { c: 'tomato', e: '🎯', t: 'Save the first job you like', s: 'Paste the advert: Busy shows what it asks for', b: 'Add a job', href: 'apps/jobs/index.html#paste' });
    }
    followUps.slice(0, 2).forEach((a) => add(88, { c: 'tomato', e: '⏰', t: `Follow up with ${a.company || a.role || 'an application'}`, s: a.nextStep || 'A short, friendly line is enough', b: 'Open it', href: `apps/jobs/index.html#open/${a.id}` }));
    if (G.reviewDue(reviews, today)) add(80, { c: 'sun', e: '🪞', t: 'Look back at your week', s: 'Ten minutes: what moved, what was hard, what is next', b: 'Ten minutes', href: 'apps/review/index.html' });
    if (catchUp.length) add(60, { c: 'grape', e: '☕', t: `Time to catch up with ${catchUp[0].name}`, s: 'People in your corner like to hear from you', b: 'Open', href: `apps/contacts/index.html#open/${catchUp[0].id}` });
    if (!wins.some((w) => (w.date || '').startsWith(today.slice(0, 7))) && !empty) add(55, { c: 'sun', e: '🏆', t: 'Write down one thing that went well this month', s: 'While you still remember it', b: 'Log a win', href: 'apps/wins/index.html#new' });
    if (doing.length) add(50, { c: 'mint', e: '🎓', t: `Carry on with "${doing[0].title}"`, s: target ? `${G.hours(weekMin)} ${BW.t('of')} ${G.hours(target)} ${BW.t('this week')}` : `${G.hours(weekMin)} ${BW.t('this week')}`, b: 'Open', href: 'apps/learning/index.html' });
    needs.sort((a, b) => b.w - a.w);
    const cards = await ui.yes();
    const top = needs.slice(0, Math.max(0, 3 - Math.min(cards.n, 3)));
    BW.partCount('today', top.length + cards.n);

    const when = s.momentDate && s.momentDate >= today ? BW.fmtDate(s.momentDate, { day: 'numeric', month: 'long' }) : '';
    const HEAD = {
      review: when ? `Your review is on ${when}. ${results.length >= 3 ? 'You are nearly ready.' : 'Let’s get you ready.'}` : 'A review is coming. Let’s get you ready.',
      raise: results.length >= 3 ? 'You want a raise. Your case is taking shape.' : 'You want a raise. Let’s build the case.',
      applying: active.length ? `${active.length} ${active.length === 1 ? 'application' : 'applications'} on the go. One step today.` : 'Looking for the next job. One step today.',
      growing: "Know what you're worth. Say it well.",
    };
    // Your worth, in short: the strongest skills and how many results stand behind them.
    const best = skills.slice().sort((a, b) => BW.num(b.level) - BW.num(a.level)).slice(0, 4);
    const week = G.weekStart(today), last = reviews.find((r) => r.week === BW.addDays(week, -7));
    const plan = last ? G.lines(last.next).map((t, i) => [t, (last.nextDone || []).includes(i)]) : [];
    const streak = G.learningStreak(learning, today);
    const SAY = [['review', 'Notes for my review'], ['cv', 'My CV'], ['linkedin', 'My LinkedIn profile'], ['pitch', 'Me, in 30 seconds'], ['raise', 'The case for a raise']];

    main.innerHTML = `<div class="today">
      <div>
        ${ui.hello(s.ownerName)}
        <h1 class="big">${esc(BW.t(HEAD[moment]))}</h1>
        <div class="moments"><span class="k">${BW.t('What is coming up?')}</span>${MOMENTS.map(([id, e, l]) => `<button type="button" class="chip${id === moment ? ' star' : ''}" data-moment="${id}" aria-pressed="${id === moment}">${e} ${BW.t(l)}${id === 'review' && id === moment && when ? ' · ' + BW.fmtDate(s.momentDate, { day: 'numeric', month: 'short' }) : ''}</button>`).join('')}
          ${moment === 'review' || moment === 'raise' ? `<label class="mdate">${BW.t('When?')} <input type="date" class="in" data-mdate value="${esc(s.momentDate || '')}"></label>` : ''}</div>
        ${cards.html}
        ${top.map((n, i) => ui.need(n, i)).join('')}
        ${!top.length && !cards.n ? `<div class="card all-clear">${ui.guide('happy')}<div><b>${BW.t('Nothing is waiting. You are growing.')}</b><br><span class="muted">${BW.t('Come back on Friday for ten minutes.')}</span></div></div>` : ''}
        ${ui.k(BW.t('Say it well')).replace('class="k"', 'class="k gap"')}
        <div class="start-row">${SAY.map(([id, l]) => `<a class="btn${id === moment ? ' btn-primary' : ''}" href="growth-sayit.html#${id}">${BW.t(l)}</a>`).join('')}</div>
      </div>
      <aside class="side-col">
        <a class="card" href="growth-worth.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('Your worth, in short'))}
          ${best.length ? best.map((k) => `<div class="bars3 w"><span>${esc(k.name)}</span>${ui.gauge(BW.num(k.level) / 5 * 100, BW.num(k.level) >= 3 ? 'mint' : 'sun')}<b>${BW.num(k.level)}</b></div>`).join('') : `<p class="s">${BW.t('Add what you can do, and it shows here.')}</p>`}
          <p class="s">${results.length} ${BW.t(results.length === 1 ? 'result this year, with what it changed.' : 'results this year, with what they changed.')}</p></a>
        ${plan.length || streak > 1 ? `<a class="card" href="apps/review/index.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('This week'))}${plan.map(([t, done]) => `<div class="tick"><i class="${done ? 'y' : ''}">${done ? '✓' : ''}</i><span>${esc(t)}</span></div>`).join('')}${streak > 1 ? `<p class="s">🔥 ${streak} ${BW.t('weeks in a row')}</p>` : ''}</a>` : ''}
        ${doing.length ? `<a class="card" href="growth-grow.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('Growing now'))}${doing.slice(0, 3).map((x) => ui.line(`🎓 ${esc(x.title)}`, G.hours(G.itemMinutes(x)))).join('')}</a>` : ''}
      </aside></div>`;
    ui.bindYes(main, render);
    const save = async (patch) => { await BW.store.saveSettings(Object.assign({}, BW.settings, patch)); render(); };
    $$('[data-moment]', main).forEach((b) => b.onclick = () => save({ moment: b.dataset.moment }));
    const md = $('[data-mdate]', main); if (md) md.onchange = () => save({ momentDate: md.value });
  }
})();
