/* The marketing dashboard, shared by the Marketing Studio and Olaf. Both apps read and write the same
   collections, so an owner sees one plan, one set of numbers and one list of work, whether they do
   their marketing themselves or Olaf keeps it up to date:
     mktplan      activities per month (title, channel, month, cost, cep, status planned|live|done)
     mktnumbers   monthly numbers the owner or Olaf records (reviews, rating, visits, followers, note)
     mktwaves     brand-health survey results
     mktruns      results saved in the Studio
     olaf-files   Olaf's work; files under output/ carry a status: draft|approved|published
     invoices     new customers per month, the growth number */
(function () {
  'use strict';
  const { $$, esc } = BW;
  const STATUS = { planned: '🗓️ Planned', live: '🔴 Live', done: '✅ Done' };
  const WORK = { draft: '📝 Draft', approved: '👍 Approved', published: '🚀 Published' };
  const month = (n) => BW.addPeriod(BW.today().slice(0, 7) + '-01', 'month', n).slice(0, 7);
  const label = (m) => BW.fmtDate(m + '-01', { month: 'short' });

  const D = (BW.mktDash = {
    STATUS, WORK,
    async load() {
      // Marketing actions and posts are also tasks in the Project Planner: bring both sides up to date first.
      if (BW.pm) await BW.pm.linkMarketing().catch((e) => console.warn('Marketing link skipped', e));
      const names = ['mktplan', 'mktnumbers', 'mktwaves', 'mktruns', 'olaf-files', 'invoices', 'mktprofile'];
      const [plan, numbers, waves, runs, files, invoices, prof] = await Promise.all(names.map((n) => BW.store.all(n)));
      return { plan, numbers: numbers.sort((a, b) => (a.month || '').localeCompare(b.month || '')), waves: waves.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
        runs: runs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), invoices, profile: prof[0] || null,
        work: files.filter((f) => f.path.startsWith('output/') && !/README\.md$/.test(f.path)).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')) };
    },

    // New and active customers per month from sent invoices: the growth number.
    customers(invoices, n = 6) {
      const sent = invoices.filter((i) => i.kind === 'invoice' && i.status !== 'draft' && i.clientId);
      const first = {};
      sent.forEach((i) => { if (!first[i.clientId] || i.issueDate < first[i.clientId]) first[i.clientId] = i.issueDate; });
      const ms = Array.from({ length: n }, (_, k) => month(k - n + 1));
      return { months: ms.map((m) => ({ m, fresh: Object.values(first).filter((d) => (d || '').startsWith(m)).length })), total: Object.keys(first).length,
        newThisYear: Object.values(first).filter((d) => (d || '').startsWith(BW.today().slice(0, 4))).length };
    },

    planHtml(d, { months = 3, planLink } = {}) {
      const ms = Array.from({ length: months }, (_, k) => month(k));
      const ahead = Array.from({ length: 12 }, (_, k) => month(k));
      const covered = ahead.filter((m) => d.plan.some((a) => (a.month || '').slice(0, 7) === m)).length;
      return `<section class="card dash-card"><h3>🗓️ The plan <small>${covered} of the next 12 months have marketing</small></h3>
        ${ms.map((m) => { const acts = d.plan.filter((a) => (a.month || '').slice(0, 7) === m);
          return `<div class="dash-month"><b>${label(m)}</b>${acts.length ? acts.map((a) => `<div class="dash-act"><button class="chip-btn st-${esc(a.status || 'planned')}" data-plan="${esc(a.id)}" title="Change status">${STATUS[a.status] || STATUS.planned}</button><span>${esc(a.title)}<small>${esc([a.channel, a.cost ? BW.money(a.cost) : ''].filter(Boolean).join(' · '))}</small></span></div>`).join('')
            : '<p class="dash-gap">Nothing planned yet. Buyers enter the market every month.</p>'}</div>`; }).join('')}
        ${planLink ? `<a class="btn btn-ghost" href="${planLink}">Open the full year plan →</a>` : ''}
        <p class="faint" style="font-size:.85rem;margin-top:8px">📣 Every action and post is also a task in the <a href="${BW.root}apps/projects/index.html">Project Planner</a> and on the Project Board. Tick it off in either place.</p></section>`;
    },

    numbersHtml(d) {
      const c = D.customers(d.invoices), max = Math.max(1, ...c.months.map((x) => x.fresh));
      const last = d.numbers[d.numbers.length - 1], first = d.numbers[0];
      const delta = (k) => (last && first && last !== first && last[k] !== '' && first[k] !== '' && last[k] != null && first[k] != null) ? BW.num(last[k]) - BW.num(first[k]) : null;
      const fmt = (v, k) => (v == null || v === '' ? '–' : k === 'rating' ? Number(v).toFixed(1) : v);
      const own = BW.settings.businessName;
      const wave = d.waves[d.waves.length - 1], row = wave && wave.rows.find((r) => r.brand === own);
      return `<section class="card dash-card"><h3>📊 Numbers <small>growth comes from more buyers</small></h3>
        <div class="dash-kpis">
          <div><span>New customers this year</span><b>${c.newThisYear}</b><small>from your invoices</small></div>
          ${['reviews', 'rating'].map((k) => { const dv = delta(k); return `<div><span>${k === 'reviews' ? 'Reviews' : 'Rating'}</span><b>${fmt(last && last[k], k)}</b><small>${dv == null ? (last ? 'as of ' + label(last.month) : 'not recorded yet') : (dv >= 0 ? '+' : '') + (k === 'rating' ? dv.toFixed(1) : dv) + ' since ' + label(first.month)}</small></div>`; }).join('')}
          <div><span>Think of you first</span><b>${row && wave.n ? Math.round(row.any / wave.n * 100) + '%' : '–'}</b><small>${row ? 'brand survey ' + BW.fmtDate(wave.date) : 'no brand survey yet'}</small></div>
        </div>
        <div class="minibars dash-bars">${c.months.map((x) => `<div class="b" title="${x.fresh} new"><em>${x.fresh || ''}</em><i style="height:${x.fresh / max * 100}%"></i><span>${label(x.m).slice(0, 3)}</span></div>`).join('')}</div>
        <small class="faint">New customers per month, from your invoices</small>
        <div class="row-flex" style="margin-top:10px"><button class="btn" data-numbers>＋ Add this month's numbers</button></div></section>`;
    },

    workHtml(d, { olafLink } = {}) {
      const items = d.work.slice(0, 6), runs = d.runs.slice(0, 3);
      const waiting = d.work.filter((f) => (f.status || 'draft') === 'draft').length;
      return `<section class="card dash-card"><h3>📄 Work <small>${waiting ? `${waiting} waiting for you` : 'nothing waiting'}</small></h3>
        ${items.length ? items.map((f) => `<div class="dash-act"><button class="chip-btn wk-${esc(f.status || 'draft')}" data-work="${esc(f.id)}" title="Change status">${WORK[f.status] || WORK.draft}</button><span>${olafLink ? `<a href="${olafLink}#file/${encodeURIComponent(f.path)}">${esc(f.path.slice(7))}</a>` : `<a href="#" data-open="${esc(f.path)}">${esc(f.path.slice(7))}</a>`}<small>by Olaf · ${BW.fmtDate((f.updatedAt || '').slice(0, 10))}</small></span></div>`).join('')
          : '<p class="dash-gap">Nothing from Olaf yet.</p>'}
        ${runs.length ? `<p class="faint" style="margin:10px 0 4px;font-size:.82rem">Saved in the Studio</p>${runs.map((r) => `<div class="dash-act"><span>💾 ${esc(r.title)}<small>${BW.fmtDate((r.createdAt || '').slice(0, 10))}</small></span></div>`).join('')}` : ''}
      </section>`;
    },

    /* Wires the buttons inside a dashboard. `refresh` is called after any change. */
    bind(root, d, refresh) {
      $$('[data-plan]', root).forEach((b) => b.onclick = async () => {
        const a = d.plan.find((x) => x.id === b.dataset.plan); const order = Object.keys(STATUS);
        a.status = order[(order.indexOf(a.status || 'planned') + 1) % order.length];
        await BW.store.put('mktplan', a); refresh();
      });
      $$('[data-work]', root).forEach((b) => b.onclick = async () => {
        const f = d.work.find((x) => x.id === b.dataset.work); const order = Object.keys(WORK);
        f.status = order[(order.indexOf(f.status || 'draft') + 1) % order.length];
        await BW.store.put('olaf-files', f); refresh();
      });
      $$('[data-numbers]', root).forEach((b) => b.onclick = () => D.addNumbers(d, refresh));
    },

    addNumbers(d, refresh) {
      const m = month(0), cur = d.numbers.find((x) => x.month === m) || { month: m };
      const box = BW.html(`<div><p class="muted" style="margin-bottom:12px">Fill in what you know; leave the rest empty. New customers come from your invoices by themselves.</p>
        <div class="grid-2">
          <label class="field"><span>Month</span><input class="in" type="month" data-k="month" value="${esc(cur.month)}"></label>
          <label class="field"><span>Google reviews (total)</span><input class="in" inputmode="numeric" data-k="reviews" value="${esc(cur.reviews == null ? '' : cur.reviews)}"></label>
          <label class="field"><span>Average rating</span><input class="in" inputmode="decimal" data-k="rating" value="${esc(cur.rating == null ? '' : cur.rating)}" placeholder="e.g. 4.7"></label>
          <label class="field"><span>Website visits</span><input class="in" inputmode="numeric" data-k="visits" value="${esc(cur.visits == null ? '' : cur.visits)}"></label>
          <label class="field"><span>Followers (main channel)</span><input class="in" inputmode="numeric" data-k="followers" value="${esc(cur.followers == null ? '' : cur.followers)}"></label>
          <label class="field"><span>Note</span><input class="in" data-k="note" value="${esc(cur.note || '')}" placeholder="e.g. lights campaign ran"></label>
        </div></div>`);
      BW.modal({ title: '📊 This month\'s numbers', body: box, actions: [{ label: 'Save', kind: 'primary', onClick: async () => {
        const rec = Object.assign({}, cur); $$('[data-k]', box).forEach((i) => { rec[i.dataset.k] = i.value.trim(); });
        if (!/^\d{4}-\d{2}$/.test(rec.month)) { BW.toast('Pick a month', '🤔'); return false; }
        const same = d.numbers.find((x) => x.month === rec.month); if (same) rec.id = same.id;
        rec.by = 'owner'; await BW.store.put('mktnumbers', rec); BW.toast('Numbers saved', '📊'); refresh();
      } }] });
    },
  });
})();
