/* The Busy Growth home screen: where you're heading, this week's learning, and every growth tool. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');

  BW.boot({ onReady: render, onChange: render });

  const GROUPS = [
    ['📚 Learn', ['library', 'learning']],
    ['🧠 Prove it', ['skills', 'wins']],
    ['🎯 Land it', ['jobs', 'cv', 'stories', 'contacts']],
    ['🪞 Every week', ['review']],
  ];

  async function render() {
    const s = BW.settings;
    const [library, learning, skills, wins, apps, contacts, reviews] = await Promise.all(['library', 'learning', 'skills', 'wins', 'applications', 'contacts', 'reviews'].map((n) => BW.store.all(n)));
    const today = BW.today();
    const h = new Date().getHours();
    const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const name = (s.ownerName || '').split(' ')[0];
    const weekMin = G.weekMinutes(learning, today), target = BW.num(s.learnHoursWeek) * 60;
    const streak = G.learningStreak(learning, today);
    const toRead = library.filter((x) => x.status !== 'read');
    const doing = learning.filter((x) => x.status === 'doing');
    const month = today.slice(0, 7);
    const winsMonth = wins.filter((w) => String(w.date || '').startsWith(month));
    const gap = G.gaps(skills)[0], followUps = G.followUpsDue(apps, today), catchUp = G.catchUpDue(contacts, today);
    // This week's plan: the "next week, I will…" lines from last week's review.
    const week = G.weekStart(today), last = reviews.find((r) => r.week === BW.addDays(week, -7));
    const plan = last ? G.lines(last.next).map((t, i) => [t, (last.nextDone || []).includes(i)]) : [];
    const glance = [
      G.reviewDue(reviews, today) && ['sun', '🪞', 'Weekly review', 'Due', 'Ten minutes to look back and plan next week', 'review'],
      followUps.length && ['tomato', '⏰', 'Follow-ups due', String(followUps.length), followUps.map((a) => a.company || a.role).slice(0, 3).join(', '), 'jobs'],
      catchUp.length && ['grape', '☕', 'Time to catch up', String(catchUp.length), catchUp.map((c) => c.name).slice(0, 3).join(', '), 'contacts'],
      ['grape', '🎓', 'Learning this week', `${G.hours(weekMin)}${target ? ` of ${G.hours(target)}` : ''}`, streak > 1 ? `🔥 ${streak} weeks in a row` : doing.length ? `${doing.length} thing${doing.length === 1 ? '' : 's'} on the go` : 'Plan something to learn', 'learning'],
      ['sky', '📚', 'To read', String(toRead.length), toRead[0] ? toRead[0].title || toRead[0].url : 'Save what you want to read', 'library'],
      ['sun', '🏆', 'Wins this month', String(winsMonth.length), winsMonth[0] ? winsMonth[0].title : 'Write one down while you remember', 'wins'],
      gap && ['pink', '🧠', 'Biggest gap', esc(gap.name), `${G.LEVELS[BW.num(gap.level) - 1] || 'New'} → ${G.LEVELS[BW.num(gap.target) - 1]}`, 'skills'],
    ].filter(Boolean);
    const byId = Object.fromEntries(BW.apps.map((a) => [a.id, a]));
    const steps = [
      [skills.some((x) => BW.num(x.target) > BW.num(x.level)), '🧠', 'Pick a skill to grow', 'Where you are, and where you want to be', 'apps/skills/index.html#new'],
      [library.length > 0, '🔗', 'Save something you read', 'A link, a note or a file', 'apps/library/index.html#new/link'],
      [learning.length > 0, '🎓', 'Plan something to learn', 'A course, a book or a project', 'apps/learning/index.html#new'],
      [wins.length > 0, '🏆', 'Log a win', 'Big or small, with the numbers', 'apps/wins/index.html#new'],
      [BW.store.kind === 'folder', '📁', 'Keep it in a folder', 'Pick one inside Google Drive to sync it', null],
    ];
    const doneN = steps.filter((x) => x[0]).length;
    let hidden = false;
    try { hidden = localStorage.getItem('bw.hideStart:growth') === '1'; } catch (e) { /* private window */ }
    const tile = (a) => a.ready
      ? `<a class="tile" style="--c:var(--${a.color})" href="apps/${a.id}/index.html"><span class="icon">${a.emoji}</span><b>${a.name}</b><p>${a.tagline}</p><span class="go">Open <span>→</span></span></a>`
      : `<div class="tile soon" style="--c:var(--${a.color})"><span class="chip chip-grape sticker">Soon</span><span class="icon">${a.emoji}</span><b>${a.name}</b><p>${a.tagline}</p></div>`;

    main.innerHTML = `
      <section class="home-hero">
        <div><h1>${hello}${name ? ', ' + esc(name) : ''} <span class="hand">🌱</span></h1>
          <p class="lead">${s.targetRole ? `Heading for <b>${esc(s.targetRole)}</b>. ` : ''}${s.goal ? `Your goal: ${esc(s.goal.replace(/[.\s]+$/, ''))}.` : 'Learn it, prove it, land it.'}</p></div>
      </section>
      <section class="stats glance rise">${glance.map(([c, e, k, v, sub, app]) => `
        <a class="card stat" style="--tint:var(--${c})" href="apps/${app}/index.html"><div class="k">${e} ${k}</div><div class="v">${v}</div><div class="s">${esc(sub)}</div></a>`).join('')}</section>
      ${plan.length ? `<section class="card week-plan rise"><div class="row-flex" style="justify-content:space-between"><h2>➡️ Your plan for this week</h2><a class="link" href="apps/review/index.html">From your weekly review</a></div>
        <ul class="plain-list">${plan.map(([t, done]) => `<li>${done ? '✅' : '⬜'} ${esc(t)}</li>`).join('')}</ul></section>` : ''}
      ${!hidden && doneN < steps.length ? `<section class="card start rise">
        <div class="start-head"><div><h2>🚀 Getting started</h2><small>${doneN} of ${steps.length} done</small></div><div class="bar"><i style="width:${doneN / steps.length * 100}%"></i></div><button class="link" data-hide>Hide</button></div>
        <div class="start-steps">${steps.map(([ok, e, t, sub, go], i) => `<${go && !ok ? `a href="${go}"` : 'button type="button"'} class="step ${ok ? 'ok' : ''}" data-step="${i}"><span class="tick">${ok ? '✓' : e}</span><span><b>${t}</b><small>${sub}</small></span></${go && !ok ? 'a' : 'button'}>`).join('')}</div>
      </section>` : ''}
      ${GROUPS.map(([title, ids]) => `<div class="section-h"><h2>${title}</h2></div><div class="tiles rise">${ids.map((id) => tile(byId[id])).join('')}</div>`).join('')}
      <div class="section-h"><h2>🌿 ${byId.ivy.ready ? 'Your coach' : 'Coming to Busy Growth'}</h2><small class="faint">${byId.ivy.ready ? 'On your own Claude key' : 'Free tools stay free; the AI comes with Ivy'}</small></div>
      <div class="tiles rise">${tile(byId.ivy)}
        <a class="tile" style="--c:var(--sky)" href="${BW.siteUrl}/games/index.html" target="_blank" rel="noopener"><span class="icon">🧩</span><b>Today’s brain break</b><p>Four free logic puzzles on busy.com.ai, a new one every day.</p><span class="go">Play <span>→</span></span></a></div>
      <p class="tip">💡 Press <kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd> anywhere to find something you saved, a skill or a win.</p>
      <div class="card home-foot"><span class="emo">🔒</span><div><b>Your growth, your files.</b><br><small>Everything is saved in <b>${esc(BW.store.where)}</b>. No account, no server, nothing sent to us.</small></div></div>`;
    const hide = $('[data-hide]', main);
    if (hide) hide.onclick = () => { try { localStorage.setItem('bw.hideStart:growth', '1'); } catch (e) { /* ignore */ } render(); };
    $$('button[data-step]', main).forEach((b) => b.onclick = () => { if (!steps[Number(b.dataset.step)][0]) BW.toast('Use the 📁 button at the top to pick a folder', '📁'); });
  }
})();
