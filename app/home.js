/* Busy Business opens on Today: the three things that most need the owner, each with one button, and nothing
   else. The brand, the year's marketing and the money stand beside it in three small cards. The tools are in the
   three parts of the rail (Brand, Marketing, Operations), never in a grid here. */
(function () {
  'use strict';
  const { $, $$, esc, ui } = BW;
  const main = $('#main');

  BW.boot({ part: 'today', onReady: render, onChange: render });

  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  const many = (n, one, more) => (n === 1 ? one : more);

  async function render() {
    const s = BW.settings, today = BW.today();
    const [invoices, time, stock, subs, tasks, clients, projects, profiles, plan, content, files] = await Promise.all(
      ['invoices', 'time', 'stock', 'subscriptions', 'tasks', 'clients', 'projects', 'mktprofile', 'mktplan', 'mktcontent', 'olaf-files'].map((n) => BW.store.all(n)));
    const sent = invoices.filter((i) => i.kind === 'invoice' && i.status === 'sent' && BW.balanceOf(i) > 0);
    const late = sent.filter((i) => i.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const sum = (a) => a.reduce((t, i) => t + BW.balanceOf(i), 0);
    const profile = profiles[0], M = BW.mkt;
    const pct = profile && M ? M.completeness(profile) : 0;
    const month0 = today.slice(0, 7) + '-01', year = Array.from({ length: 12 }, (_, i) => BW.addPeriod(month0, 'month', i).slice(0, 7));
    const inMonth = (m) => plan.filter((a) => (a.month || '').slice(0, 7) === m);
    const planned = year.filter((m) => inMonth(m).length).length;
    const who = (id) => (clients.find((c) => c.id === id) || {}).name || '';
    const nameOf = (i) => (i.client && i.client.name) || who(i.clientId) || 'A client';

    // Everything that could need the owner, heaviest first. The first three are today's; the next few are "later".
    const needs = [];
    const add = (w, n) => needs.push(Object.assign({ w }, n));
    if (late.length === 1) { const i = late[0], d = daysBetween(i.dueDate, today);
      add(100, { c: 'tomato', e: '🧾', t: d === 1 ? `${nameOf(i)} is a day late with ${BW.money(BW.balanceOf(i))}` : `${nameOf(i)} is ${d} days late with ${BW.money(BW.balanceOf(i))}`, s: 'Operations · a friendly reminder takes a minute', b: 'Send a reminder', href: `apps/invoices/index.html#edit/${i.id}` }); }
    if (late.length > 1) add(100, { c: 'tomato', e: '🧾', t: `${late.length} invoices are late: ${BW.money(sum(late))}`, s: `Operations · the oldest is from ${nameOf(late[0])}`, b: 'Send reminders', href: 'apps/invoices/index.html' });
    const open = tasks.filter((t) => t.status !== 'done' && t.due);
    const dueNow = open.filter((t) => t.due <= today).sort((a, b) => a.due.localeCompare(b.due));
    if (dueNow.length === 1) add(90, { c: 'teal', e: '🗂️', t: `"${dueNow[0].title}" ${dueNow[0].due < today ? 'was due ' + BW.fmtDate(dueNow[0].due, { weekday: 'long' }) : 'is due today'}`, s: 'Operations · on your project board', b: 'Open it', href: `apps/board/index.html#open/${dueNow[0].id}` });
    if (dueNow.length > 1) add(90, { c: 'teal', e: '🗂️', t: `${dueNow.length} tasks are due`, s: `Operations · first: ${dueNow[0].title}`, b: 'Open the board', href: 'apps/board/index.html' });
    const week = BW.addDays(today, 7);
    const ready = content.filter((p) => p.status === 'ready' && p.date && p.date <= week).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (ready) add(80, { c: 'pink', e: '📣', t: `${BW.fmtDate(ready.date, { weekday: 'long' })}'s post is ready`, s: `Marketing · ${ready.channel || 'A post'}: ${ready.title}`, b: 'Read and post', href: 'apps/marketing/index.html#tab/content' });
    const quote = invoices.filter((i) => i.kind === 'quote' && i.status === 'sent' && i.validUntil && i.validUntil >= today && i.validUntil <= week)[0];
    if (quote) { const d = daysBetween(today, quote.validUntil); add(75, { c: 'sky', e: '💬', t: d === 1 ? `The quote for ${nameOf(quote)} runs out tomorrow` : `The quote for ${nameOf(quote)} runs out in ${d} days`, s: 'Operations · a short call often settles it', b: 'Open the quote', href: `apps/invoices/index.html#edit/${quote.id}` }); }
    if (!profile || !profile.onboarded) add(profile ? 70 : 96, { c: 'sun', e: '🪧', t: 'Put your brand on one page', s: 'Brand · what you sell, when people need you, what makes you recognisable. Ten minutes.', b: 'Start', href: 'brand.html' });
    else if (pct < 100) add(60, { c: 'sun', e: '🪧', t: `Your brand page is ${pct}% filled in`, s: 'Brand · a few answers are still missing', b: 'Finish it', href: 'brand.html' });
    if (profile && !inMonth(year[0]).length) add(65, { c: 'pink', e: '🗓️', t: `Nothing is planned for ${BW.fmtDate(year[0] + '-01', { month: 'long' })}`, s: 'Marketing · buyers look every month', b: 'Plan something', href: 'apps/marketing/index.html#tab/plan' });
    const drafts = invoices.filter((i) => i.kind === 'invoice' && i.status === 'draft');
    if (drafts.length) add(55, { c: 'mint', e: '✉️', t: drafts.length === 1 ? `An invoice for ${nameOf(drafts[0])} is ready to send` : `${drafts.length} invoices are ready to send`, s: 'Operations · a draft earns nothing', b: 'Send it', href: drafts.length === 1 ? `apps/invoices/index.html#edit/${drafts[0].id}` : 'apps/invoices/index.html' });
    const soon = open.filter((t) => t.due > today && t.due <= BW.addDays(today, 2));
    if (soon.length) add(50, { c: 'teal', e: '🗂️', t: soon.length === 1 ? `"${soon[0].title}" is due ${BW.fmtDate(soon[0].due, { weekday: 'long' })}` : `${soon.length} tasks are due in the next two days`, s: 'Operations · on your project board', b: 'Open the board', href: 'apps/board/index.html' });
    const low = stock.filter((i) => BW.num(i.qty) <= BW.num(i.min));
    if (low.length) add(40, { c: 'tomato', e: '📦', t: `Running low: ${low.slice(0, 3).map((i) => i.name).join(', ')}`, s: 'Operations · time to order', b: 'Open stock', href: 'apps/stock/index.html' });
    const renewing = subs.filter((x) => x.status !== 'cancelled' && x.nextDate && x.nextDate >= today && x.nextDate <= week);
    renewing.forEach((x) => add(30, { c: 'grape', e: '🔁', t: `${x.name} renews on ${BW.fmtDate(x.nextDate, { weekday: 'long' })}`, s: 'Operations', amount: BW.money(BW.num(x.amount)), href: 'apps/subscriptions/index.html' }));
    // A business that has only just started: the first steps, in the order that pays.
    if (!invoices.length && !clients.length) {
      if (!s.iban) add(58, { c: 'mint', e: '🏦', t: 'Add your bank details', s: 'Operations · so every invoice says where to pay', b: 'Add them', id: 'settings' });
      add(57, { c: 'sky', e: '📇', t: 'Add your first client', s: 'Operations · or bring in the list you already have', b: 'Add a client', href: 'apps/clients/index.html#new' });
      add(56, { c: 'tomato', e: '🧾', t: 'Send your first invoice', s: 'Operations · it takes about a minute', b: 'New invoice', href: 'apps/invoices/index.html#new/invoice' });
    }
    needs.sort((a, b) => b.w - a.w);
    const cards = await ui.yes();
    const top = needs.filter((n) => n.b).slice(0, Math.max(0, 3 - Math.min(cards.n, 3)));
    const later = needs.filter((n) => !top.includes(n)).slice(0, 4);
    BW.partCount('today', top.length + cards.n);

    // The three small cards on the right.
    const journey = (files.find((f) => f.path === 'memory/marketing-journey.md') || {}).content || '';
    const stage = Number((journey.match(/\*\*Current stage:\*\*\s*(\d)/) || [])[1]) || 0;
    const stageName = stage ? ((journey.match(new RegExp(`- \\[[ x]\\] ${stage}\\. (.+?)(?: \\(|$)`, 'm')) || [])[1] || '') : '';
    const brandCard = stage ? `${ui.k(BW.t('Your brand'))}<h2>${BW.t('Step')} ${stage} ${BW.t('of')} 6: ${esc(BW.t(stageName))}</h2>${ui.dots(stage - 1, 6, true)}`
      : profile ? `${ui.k(BW.t('Your brand'))}<h2>${pct === 100 ? BW.t('Your brand is on one page') : `${pct}% ${BW.t('of your brand page is filled in')}`}</h2>${ui.gauge(pct, 'sun')}`
        : `${ui.k(BW.t('Your brand'))}<h2>${BW.t('Not written down yet')}</h2><p class="s">${BW.t('It is the most valuable thing your business owns.')}</p>`;
    const cells = year.map((m, i) => ({ m, state: inMonth(m).length ? (inMonth(m).every((a) => a.status === 'done') && i === 0 ? 'done' : 'planned') : 'empty', title: inMonth(m).map((a) => a.title).join(' · ') }));
    const paidNow = invoices.filter((i) => i.kind === 'invoice' && i.status === 'paid' && (i.paidAt || '').startsWith(today.slice(0, 7)));
    const active = projects.filter((p) => (p.status || 'active') === 'active').length;

    const START = [['🧾', 'Invoice', 'apps/invoices/index.html#new/invoice'], ['💬', 'Quote', 'apps/invoices/index.html#new/quote'], ['⏱️', 'Start the timer', 'apps/time/index.html'],
      ['📸', 'Receipt', 'apps/expenses/index.html#new'], ['✍️', 'Post', 'apps/marketing/index.html#tab/content']];
    main.innerHTML = `<div class="today">
      <div>
        ${ui.hello(s.ownerName)}
        <h1 class="big">${BW.t(ui.headline(top.length + cards.n))}</h1>
        ${cards.html}
        ${top.map((n, i) => ui.need(n, i)).join('')}
        ${!top.length && !cards.n ? `<div class="card all-clear">${ui.guide('happy')}<div><b>${BW.t('All caught up. Nice work!')}</b><br><span class="muted">${BW.t('Start something below, or enjoy the quiet.')}</span></div></div>` : ''}
        ${later.length ? `${ui.k(BW.t('Later this week')).replace('class="k"', 'class="k gap"')}<div class="card flat lines">${later.map((n) => ui.line(`${n.e} ${esc(n.t)}`, n.amount || '', n.href)).join('')}</div>` : ''}
        ${ui.k(BW.t('Start something')).replace('class="k"', 'class="k gap"')}
        <div class="start-row">${START.map(([e, l, h]) => `<a class="btn" href="${h}">${e} ${l}</a>`).join('')}<button type="button" class="btn btn-ghost" data-more>${BW.t('More…')}</button></div>
      </div>
      <aside class="side-col">
        <a class="card" href="brand.html" style="text-decoration:none;color:inherit">${brandCard}</a>
        <a class="card" href="apps/marketing/index.html" style="text-decoration:none;color:inherit">${ui.k(BW.t("This year's marketing"))}${ui.year(cells)}<p class="s">${planned} ${BW.t('of 12 months have something planned.')}</p></a>
        <a class="card lines-card" href="operations.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('Money'))}
          ${ui.line(BW.t('Still to come in'), BW.money(sum(sent)))}${ui.line(BW.t('Came in this month'), BW.money(paidNow.reduce((t, i) => t + BW.invoiceTotals(i).total, 0)))}${ui.line(BW.t('Jobs in progress'), String(active))}</a>
      </aside></div>`;
    ui.bindYes(main, render);
    $$('[data-need]', main).forEach((b) => b.onclick = () => { if (top[Number(b.dataset.need)].id === 'settings') BW.openSettings(); });
    $('[data-more]', main).onclick = () => BW.openPalette('new');
  }
})();
