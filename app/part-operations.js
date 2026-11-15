/* The Operations part of Busy Business: every job on one road, from quote to paid, with the money above it.
   Quotes, projects, hours, invoices and clients are still their own tools; here they are one picture. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const main = $('#main');

  BW.boot({ part: 'operations', onReady: render, onChange: render });

  const days = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  const mins = (d) => { const m = String(d || '').match(/^(\d+):(\d\d)$/); return m ? Number(m[1]) * 60 + Number(m[2]) : Math.round(BW.num(d) * 60); };

  async function render() {
    const today = BW.today(), month = today.slice(0, 7);
    const [invoices, clients, projects, tasks, time, expenses] = await Promise.all(['invoices', 'clients', 'projects', 'tasks', 'time', 'expenses'].map((n) => BW.store.all(n)));
    const who = (i) => (i.client && i.client.name) || (clients.find((c) => c.id === i.clientId) || {}).name || BW.t('No client');
    const about = (i) => ((i.items || [])[0] || {}).desc || '';
    const total = (i) => BW.invoiceTotals(i).total;
    const inv = invoices.filter((i) => i.kind === 'invoice');
    const waiting = inv.filter((i) => i.status === 'sent' && BW.balanceOf(i) > 0).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    const late = waiting.filter((i) => i.dueDate < today);
    const cameIn = inv.flatMap((i) => BW.paymentsOf(i)).filter((p) => (p.date || '').startsWith(month)).reduce((t, p) => t + BW.num(p.amount), 0);
    const out = expenses.filter((e) => (e.date || '').startsWith(month));
    // VAT so far this quarter: what was charged on invoices, less what was paid on receipts.
    const q0 = `${today.slice(0, 4)}-${String(Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
    const vatIn = inv.filter((i) => i.status !== 'draft' && (i.issueDate || '') >= q0).reduce((t, i) => t + BW.invoiceTotals(i).vatTotal, 0);
    const vatOut = expenses.filter((e) => (e.date || '') >= q0).reduce((t, e) => t + BW.num(e.amount) * BW.num(e.vatRate) / (100 + BW.num(e.vatRate)), 0);

    // The road. Each card: [amount or '', title, what, tags, link]
    const tag = (text, kind) => `<span class="tag${kind ? ' ' + kind : ''}">${esc(text)}</span>`;
    const quotes = invoices.filter((i) => i.kind === 'quote' && i.status === 'sent').map((i) => {
      const d = i.validUntil ? days(today, i.validUntil) : null;
      return [BW.money(total(i)), who(i), about(i), d == null ? '' : d < 0 ? tag(BW.t('ran out'), 'late') : tag(`${BW.t('valid')} ${d} ${BW.t(d === 1 ? 'more day' : 'more days')}`), `apps/invoices/index.html#edit/${i.id}`];
    });
    const doing = projects.filter((p) => (p.status || 'active') === 'active').map((p) => {
      const mine = tasks.filter((t) => t.projectId === p.id), done = mine.filter((t) => t.status === 'done').length, slip = mine.filter((t) => t.status !== 'done' && t.due && t.due < today).length;
      return ['', `${p.emoji || '🗓️'} ${p.name}`, (clients.find((c) => c.id === p.clientId) || {}).name || '', (mine.length ? tag(`${done} ${BW.t('of')} ${mine.length} ${BW.t('done')}`) : '') + (slip ? tag(`${slip} ${BW.t('late')}`, 'late') : mine.length ? tag(BW.t('on track')) : ''), `apps/projects/index.html#open/${p.id}`];
    });
    const drafts = inv.filter((i) => i.status === 'draft').map((i) => [BW.money(total(i)), who(i), about(i), tag(BW.t('draft ready')), `apps/invoices/index.html#edit/${i.id}`]);
    const unbilled = {};
    time.filter((t) => t.billable !== false && !t.invoiceId && t.clientId).forEach((t) => { unbilled[t.clientId] = (unbilled[t.clientId] || 0) + mins(t.dur); });
    const hours = Object.entries(unbilled).filter(([, m]) => m > 0).map(([id, m]) => ['', (clients.find((c) => c.id === id) || {}).name || BW.t('No client'), BW.t('Hours not on an invoice yet'), tag(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} ${BW.t('to bill')}`), 'apps/time/index.html']);
    const wait = waiting.map((i) => {
      const d = days(today, i.dueDate), paid = BW.paymentsOf(i).reduce((t, p) => t + BW.num(p.amount), 0);
      return [BW.money(BW.balanceOf(i)), who(i), about(i), (d < 0 ? tag(`${-d} ${BW.t(d === -1 ? 'day late' : 'days late')}`, 'late') : tag(`${BW.t('due in')} ${d} ${BW.t(d === 1 ? 'day' : 'days')}`)) + (paid ? tag(`${BW.money(paid)} ${BW.t('paid')}`) : '') + (i.repeat && i.repeat.on ? tag('🔁 ' + BW.t('repeats')) : ''), `apps/invoices/index.html#edit/${i.id}`];
    });
    const since = BW.addDays(today, -30);
    const paid = inv.filter((i) => i.status === 'paid' && (i.paidAt || '') >= since).sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || '')).slice(0, 6).map((i) => [BW.money(total(i)), who(i), about(i), '', `apps/invoices/index.html#edit/${i.id}`]);
    const col = (title, list, empty) => `<div class="col"><h3>${BW.t(title)} <span>${list.length || ''}</span></h3>${list.map(([amount, t, what, tags, href]) => `<a class="job" href="${href}"><span class="hd"><b>${esc(t)}</b>${amount ? `<span class="a">${amount}</span>` : ''}</span>${esc(what)}${tags ? `<span class="t">${tags}</span>` : ''}</a>`).join('') || `<p class="none">${BW.t(empty)}</p>`}</div>`;
    const ALSO = ['invoices', 'clients', 'time', 'expenses', 'money', 'projects', 'board', 'docs', 'subscriptions', 'trips', 'stock'].map((id) => BW.apps.find((a) => a.id === id)).filter((a) => a && a.ready);

    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('Operations')}</p><h1 class="big">${BW.t('Every job, from quote to paid.')}</h1></div>
        <div class="start-row"><details class="newjob"><summary class="btn btn-primary">＋ ${BW.t('New job')}</summary><div class="menu"><a href="apps/invoices/index.html#new/quote">💬 ${BW.t('A quote')}</a><a href="apps/projects/index.html#new">🗓️ ${BW.t('A project')}</a><a href="apps/invoices/index.html#new/invoice">🧾 ${BW.t('An invoice')}</a></div></details>
          <a class="btn" href="apps/time/index.html">⏱️ ${BW.t('Start the timer')}</a><a class="btn" href="apps/expenses/index.html#new">📸 ${BW.t('Receipt')}</a></div></div>
      <div class="money4">
        <a class="card" href="apps/invoices/index.html">${ui.k(BW.t('Still to come in'))}<b>${BW.money(waiting.reduce((t, i) => t + BW.balanceOf(i), 0))}</b><span>${waiting.length} ${BW.t(waiting.length === 1 ? 'invoice' : 'invoices')}${late.length ? `, ${late.length} ${BW.t('late')}` : ''}</span></a>
        <a class="card" href="apps/money/index.html">${ui.k(BW.t('Came in this month'))}<b>${BW.money(cameIn)}</b><span>${BW.fmtDate(month + '-01', { month: 'long' })}</span></a>
        <a class="card" href="apps/expenses/index.html">${ui.k(BW.t('Went out this month'))}<b>${BW.money(out.reduce((t, e) => t + BW.num(e.amount), 0))}</b><span>${out.length} ${BW.t(out.length === 1 ? 'receipt' : 'receipts')}</span></a>
        <a class="card" href="apps/money/index.html">${ui.k(BW.t('Keep aside for tax'))}<b>${BW.money(Math.max(0, vatIn - vatOut))}</b><span>${BW.t('VAT so far this quarter')}</span></a>
      </div>
      <div class="road">${col('Quote out', quotes, 'No quotes out.')}${col('In progress', doing, 'No projects running.')}${col('To invoice', drafts.concat(hours), 'Nothing waiting to be invoiced.')}${col('Waiting for payment', wait, 'Nobody owes you anything.')}${col('Paid lately', paid, 'Nothing paid in the last 30 days.')}</div>
      <p class="also">${BW.t('Also here:')} ${ALSO.map((a) => `<a href="apps/${a.id}/index.html">${a.emoji} ${esc(BW.t(a.name))}</a>`).join(' · ')}</p>
    </div>`;
  }
})();
