/* The three parts of Busy Growth, each one screen. My worth: what you can do, what you achieved and what you are
   growing into, on one page. Grow: what you are learning and what comes next. Say it: the same facts laid out for
   the place you need them (a review, a raise, half a minute, a CV, a profile). The page says which (data-part). */
(function () {
  'use strict';
  const { $, $$, esc, ui } = BW;
  const G = BW.growth;
  const main = $('#main'), part = document.body.dataset.part;

  BW.boot({ part, onReady: render, onChange: render });
  if (part === 'sayit') addEventListener('hashchange', render);

  const also = (ids) => `<p class="also">${BW.t('Also here:')} ${ids.map((id) => BW.apps.find((a) => a.id === id)).filter(Boolean).map((a) => `<a href="apps/${a.id}/index.html">${a.emoji} ${esc(BW.t(a.name))}</a>`).join(' · ')}</p>`;

  async function render() {
    const s = BW.settings, today = BW.today();
    const [library, learning, skills, wins, apps, reviews, career] = await Promise.all(['library', 'learning', 'skills', 'wins', 'applications', 'reviews', 'career'].map((n) => BW.store.all(n)));
    const yearAgo = BW.addDays(today, -365);
    const best = skills.slice().sort((a, b) => BW.num(b.level) - BW.num(a.level));
    const year = wins.filter((w) => (w.date || '') >= yearAgo).sort((a, b) => ((b.result ? 1 : 0) - (a.result ? 1 : 0)) || String(b.date).localeCompare(String(a.date)));
    const doing = learning.filter((x) => x.status === 'doing');
    const gaps = G.gaps(skills);
    const now = (G.careerSort(career.filter((c) => c.type === 'job' || !c.type))[0] || {});
    const who = [s.headline || now.title, s.targetRole ? `${BW.t('growing into')} ${s.targetRole}` : ''].filter(Boolean).join(', ');
    const shows = (k) => { const w = wins.find((x) => G.skillIds(x).includes(k.id)); return w ? w.title : ''; };

    if (part === 'worth') {
      if (!skills.length && !wins.length) {
        main.innerHTML = `<div class="part-page"><div class="card starter"><p class="hello">${BW.t('My worth')}</p><h1 class="big">${BW.t("Know what you're worth.")}</h1>
          <p class="lead">${BW.t('One page that says what you can do, what you achieved and what you are growing into. It starts with two things.')}</p>
          <div class="start-row"><a class="btn btn-primary" href="apps/cv/index.html#import">💼 ${BW.t('Start from LinkedIn')}</a><a class="btn" href="apps/skills/index.html#new">🧠 ${BW.t('Add something you can do')}</a><a class="btn" href="apps/wins/index.html#new">🏆 ${BW.t('Write down a result')}</a></div></div></div>`;
        return;
      }
      main.innerHTML = `<div class="part-page"><div class="poster">
        <section class="band" style="--brand:#2FD18C"><span class="logo blank">${esc((s.ownerName || '?').slice(0, 1))}</span><div><h1>${esc(s.ownerName || BW.t('Your worth on a page'))}</h1><p>${esc(who)}</p></div>
          <span class="spacer"></span><span class="band-tools"><button type="button" class="btn" data-details>✏️ ${BW.t('Change')}</button><button type="button" class="btn" data-print>🖨️ ${BW.t('Print this page')}</button></span></section>
        <section class="card">${ui.k(BW.t('What I can do'))}${best.slice(0, 6).map((k) => `<div class="bars3 w"><span>${esc(k.name)}</span>${ui.gauge(BW.num(k.level) / 5 * 100, BW.num(k.level) >= 3 ? 'mint' : 'sun')}<b>${BW.num(k.level)}</b></div>${shows(k) ? `<p class="shows">${esc(shows(k))}</p>` : ''}`).join('') || `<p class="s">${BW.t('Nothing yet.')}</p>`}
          <p class="s"><a href="apps/skills/index.html">${BW.t('Open the Skills Map')} →</a></p></section>
        <section class="card wide">${ui.k(BW.t('What I achieved this year'))}${year.slice(0, 5).map((w) => `<div class="tick"><i class="y">★</i><span><b>${esc(w.title || '')}</b>${w.result ? ' ' + esc(w.result) : ''}</span></div>`).join('') || `<p class="s">${BW.t('Nothing written down yet. One result is enough to start.')}</p>`}
          <p class="s"><a href="apps/wins/index.html#new">${BW.t('Add a result')} →</a></p></section>
        <section class="card">${ui.k(BW.t('What I am growing into'))}${doing.slice(0, 3).map((x) => ui.line(`🎓 ${esc(x.title)}`, G.hours(G.itemMinutes(x)))).join('')}${gaps.slice(0, 3).map((k) => ui.line(`🧠 ${esc(k.name)}`, `${BW.num(k.level)} → ${BW.num(k.target)}`)).join('') || (doing.length ? '' : `<p class="s">${BW.t('Pick one thing to get better at.')}</p>`)}
          <p class="s"><a href="growth-grow.html">${BW.t('Open Grow')} →</a></p></section>
        <section class="card wide">${ui.k(BW.t('What I want next'))}<h2>${esc(s.goal || s.targetRole || BW.t('Not written down yet'))}</h2>
          <p class="s">${BW.t('Say it well:')} <a href="growth-sayit.html#review">${BW.t('Notes for my review')}</a> · <a href="growth-sayit.html#raise">${BW.t('The case for a raise')}</a> · <a href="growth-sayit.html#pitch">${BW.t('Me, in 30 seconds')}</a> · <a href="apps/cv/index.html">${BW.t('My CV')}</a></p></section>
      </div>${also(['skills', 'wins'])}</div>`;
      $('[data-print]', main).onclick = () => window.print();
      $('[data-details]', main).onclick = () => BW.openSettings();
      return;
    }

    if (part === 'grow') {
      const toRead = library.filter((x) => x.status !== 'read').slice(0, 4);
      const weekMin = G.weekMinutes(learning, today), target = BW.num(s.learnHoursWeek) * 60, streak = G.learningStreak(learning, today);
      const week = G.weekStart(today), last = reviews.find((r) => r.week === BW.addDays(week, -7));
      const plan = last ? G.lines(last.next).map((t, i) => [t, (last.nextDone || []).includes(i)]) : [];
      main.innerHTML = `<div class="part-page">
        <div class="part-head"><div><p class="hello">${BW.t('Grow')}</p><h1 class="big">${BW.t(doing.length ? 'What you are growing into.' : 'Pick one thing to get better at.')}</h1></div>
          <div class="start-row"><a class="btn btn-primary" href="apps/learning/index.html#new">🎓 ${BW.t('Plan something to learn')}</a><a class="btn" href="apps/library/index.html#new">📚 ${BW.t('Save something you read')}</a></div></div>
        <div class="poster">
          <section class="card wide">${ui.k(BW.t('Learning now'))}${doing.map((x) => { const done = G.itemMinutes(x), all = BW.num(x.hoursPlanned) * 60; return `<p class="m"><b>${esc(x.title)}</b> · ${G.hours(done)}${all ? ` ${BW.t('of')} ${G.hours(all)}` : ''}</p>${ui.gauge(all ? done / all * 100 : 8)}`; }).join('') || `<p class="s">${BW.t('Nothing on the go.')}</p>`}
            <p class="s">${target ? `${G.hours(weekMin)} ${BW.t('of')} ${G.hours(target)} ${BW.t('this week')}` : `${G.hours(weekMin)} ${BW.t('this week')}`}${streak > 1 ? ` · 🔥 ${streak} ${BW.t('weeks in a row')}` : ''} · <a href="apps/learning/index.html">${BW.t('Open the Learning Planner')} →</a></p></section>
          <section class="card">${ui.k(BW.t('Where you want to get better'))}${gaps.slice(0, 4).map((k) => ui.line(`🧠 ${esc(k.name)}`, `${BW.t(G.LEVELS[BW.num(k.level) - 1] || 'New')} → ${BW.t(G.LEVELS[BW.num(k.target) - 1] || '')}`, `apps/skills/index.html#open/${k.id}`)).join('') || `<p class="s">${BW.t('Set a target on a skill and it shows here.')}</p>`}</section>
          <section class="card">${ui.k(BW.t('To read'))}${toRead.map((x) => ui.line(`${(G.KINDS[x.kind] || G.KINDS.link)[0]} ${esc(x.title || x.url || '')}`, '', 'apps/library/index.html')).join('') || `<p class="s">${BW.t('Nothing waiting.')}</p>`}</section>
          <section class="card">${ui.k(BW.t('This week'))}${plan.map(([t, done]) => `<div class="tick"><i class="${done ? 'y' : ''}">${done ? '✓' : ''}</i><span>${esc(t)}</span></div>`).join('') || `<p class="s">${BW.t('Your plan for the week comes from your weekly review.')}</p>`}
            <p class="s"><a href="apps/review/index.html">${BW.t(G.reviewDue(reviews, today) ? 'Your weekly review is due: ten minutes' : 'Open the Weekly Review')} →</a></p></section>
        </div>${also(['learning', 'library', 'review'])}</div>`;
      return;
    }

    // Say it: one set of facts, laid out for the place they are needed. Free: Busy lays it out, the person writes.
    const name = s.ownerName || '', top = year.filter((w) => w.result).slice(0, 3);
    const lines = (list, f) => (list.length ? list.map(f).join('\n') : '- ');
    const done = learning.filter((x) => x.status === 'done' && (x.doneAt || '') >= yearAgo);
    const DOCS = {
      review: ['📅', 'Notes for my review', () => [`${name}: ${BW.t('notes for my review')}`, '', `## ${BW.t('My year in three lines')}`, '- ', '- ', '- ', '', `## ${BW.t('Results')}`, lines(year.slice(0, 6), (w) => `- ${w.title}${w.result ? ': ' + w.result : ''}`), '',
        `## ${BW.t('How I grew')}`, lines(done.slice(0, 5), (x) => `- ${BW.t('Finished')}: ${x.title}`), lines(gaps.slice(0, 3), (k) => `- ${k.name}: ${BW.t('from')} ${BW.num(k.level)} ${BW.t('towards')} ${BW.num(k.target)}`), '',
        `## ${BW.t('What I want next')}`, `- ${s.goal || s.targetRole || ''}`, '', `## ${BW.t('What I need from my manager')}`, '- ', '', `## ${BW.t('My one ask')}`, '- '].join('\n')],
      raise: ['💶', 'The case for a raise', () => [`${name}: ${BW.t('the case for a raise')}`, '', `## ${BW.t('The ask')}`, `- ${BW.t('A figure or a narrow range, and from when:')} `, '', `## ${BW.t('Three reasons')}`, lines(top, (w, i) => `${i + 1}. ${w.title}: ${w.result}`), '',
        `## ${BW.t('How my job has grown')}`, '- ', '', `## ${BW.t('What the job pays elsewhere (two sources, with their dates)')}`, '- ', '- ', '', `## ${BW.t('The sentence I open with')}`, '- ', '',
        `## ${BW.t('If the answer is "not now"')}`, `- ${BW.t('What would make it a yes, and when do we look again?')}`].join('\n')],
      pitch: ['🗣️', 'Me, in 30 seconds', () => [`${BW.t('For an interview')}`, `${BW.t("I'm")} ${s.headline || now.title || '…'}. ${top[0] ? `${top[0].title}: ${top[0].result}` : '…'} ${s.targetRole ? `${BW.t('Next, I want to work as')} ${s.targetRole}.` : ''}`, '',
        `${BW.t('For someone new')}`, `${BW.t('I')} … ${BW.t('for')} … . ${BW.t('And you?')}`, '', `${BW.t('For my manager')}`, `${top[0] ? `${BW.t('This year')}: ${top[0].title}. ${top[0].result}` : '…'} ${BW.t('Next year I would like to take on')} … .`].join('\n')],
    };
    const LINKS = [['cv', '📄', 'My CV', 'apps/cv/index.html'], ['linkedin', '💼', 'My LinkedIn profile', 'apps/cv/index.html#linkedin'], ['stories', '🎤', 'My interview stories', 'apps/stories/index.html'], ['jobs', '🎯', 'My applications', 'apps/jobs/index.html']];
    const open = location.hash.slice(1);
    if (LINKS.some((l) => l[0] === open && open !== 'stories' && open !== 'jobs')) { location.replace(LINKS.find((l) => l[0] === open)[3]); return; }
    const cur = DOCS[open] ? open : 'review';
    const active = apps.filter((a) => !G.CLOSED.some((c) => c[0] === a.status));
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('Say it')}</p><h1 class="big">${BW.t('Say it well.')}</h1></div></div>
      <div class="tray-two">
        <section class="card sayit"><div class="chips">${Object.entries(DOCS).map(([id, [e, l]]) => `<a class="chip${id === cur ? ' star' : ''}" href="#${id}">${e} ${BW.t(l)}</a>`).join('')}</div>
          <textarea class="in" data-doc rows="18" spellcheck="true">${esc(DOCS[cur][2]())}</textarea>
          <div class="row-flex"><button type="button" class="btn btn-primary" data-copy>📋 ${BW.t('Copy')}</button><button type="button" class="btn" data-save>⬇️ ${BW.t('Save as a file')}</button><div class="spacer"></div><small class="faint">${BW.t('Busy lays out your facts; the words are yours. With Ivy, she writes it for you.')}</small></div></section>
        <div class="side-col">
          ${LINKS.map(([, e, l, href]) => `<a class="card link-card" href="${href}"><b>${e} ${BW.t(l)}</b><span>→</span></a>`).join('')}
          ${active.length ? `<section class="card">${ui.k(BW.t('Applications on the go'))}${active.slice(0, 4).map((a) => ui.line(`🎯 ${esc(a.company || a.role || '')}`, esc(BW.t((G.STAGES.find((x) => x[0] === G.stageOf(a)) || ['', ''])[1].replace(/^\S+\s/, ''))), `apps/jobs/index.html#open/${a.id}`)).join('')}</section>` : ''}
        </div></div>
      ${also(['cv', 'stories', 'jobs', 'contacts'])}</div>`;
    const doc = $('[data-doc]', main);
    $('[data-copy]', main).onclick = async () => { await BW.copy(doc.value); BW.toast('Copied.', '📋'); };
    $('[data-save]', main).onclick = () => BW.download(new Blob([doc.value], { type: 'text/plain' }), `${BW.fileSafe(BW.t(DOCS[cur][1]))}.txt`);
    void $$;
  }
})();
