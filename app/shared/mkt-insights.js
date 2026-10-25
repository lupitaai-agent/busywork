/* Marketing insights, shared by the Marketing Studio (do it yourself) and Olaf (guided).
   No connectors: everything is measured from what a small business already has. Invoices give new
   customers, revenue and repeat business; the Client Book says how each customer found you; the
   owner (or Olaf) records a few monthly numbers by hand or from a CSV export.

   The page is opinionated on purpose: one growth number first (new customers), a short list of
   what stands out, and a health card per channel with the skills that improve it. Each app passes
   its own actions: the Studio opens a skill for the owner, Olaf starts working on it. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;

  // kind: 'sum' adds up within a month (calls, visits); 'last' is a level (followers, rating).
  const METRICS = [
    { k: 'gbpViews', label: 'Google profile views', ch: 'local', kind: 'sum' },
    { k: 'gbpCalls', label: 'Calls from Google', ch: 'local', kind: 'sum' },
    { k: 'gbpDirections', label: 'Route requests', ch: 'local', kind: 'sum' },
    { k: 'gbpClicks', label: 'Website clicks from Google', ch: 'local', kind: 'sum' },
    { k: 'reviews', label: 'Google reviews (total)', ch: 'local', kind: 'last' },
    { k: 'rating', label: 'Average rating', ch: 'local', kind: 'last', dec: 1 },
    { k: 'visits', label: 'Website visits', ch: 'web', kind: 'sum' },
    { k: 'searchClicks', label: 'Clicks from Google search', ch: 'web', kind: 'sum' },
    { k: 'followers', label: 'Followers (main channel)', ch: 'social', kind: 'last' },
    { k: 'reach', label: 'People reached on social', ch: 'social', kind: 'sum' },
    { k: 'subscribers', label: 'Newsletter subscribers', ch: 'email', kind: 'last' },
    { k: 'openRate', label: 'Newsletter open rate (%)', ch: 'email', kind: 'last' },
    { k: 'enquiries', label: 'Enquiries (calls, mails, forms)', ch: 'sales', kind: 'sum' },
    { k: 'spend', label: 'Marketing spend', ch: 'sales', kind: 'sum', money: true },
  ];
  const byKey = Object.fromEntries(METRICS.map((m) => [m.k, m]));

  /* The channels a small business actually runs, each with the skills that improve it.
     `need` is shown when the channel has no numbers yet. */
  const CHANNELS = [
    { id: 'local', icon: '📍', title: 'Found nearby', metrics: ['gbpViews', 'gbpCalls', 'gbpDirections', 'reviews', 'rating'],
      sources: ['Google Maps', 'Walked past'], skills: [['local-presence', 'Fix your Google profile'], ['word-of-mouth', 'Get more reviews']],
      need: 'Google Business Profile → Performance shows views, calls and route requests per month.' },
    { id: 'web', icon: '🌐', title: 'Website and search', metrics: ['visits', 'searchClicks'],
      sources: ['Google search', 'Our website'], skills: [['page-audit', 'Check a page'], ['technical-seo-checker', 'Website health check'], ['keyword-research', 'What people search for']],
      need: 'Search Console and your website statistics can export a CSV per month.' },
    { id: 'social', icon: '📱', title: 'Social media', metrics: ['followers', 'reach'],
      sources: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok'], skills: [['social-media', 'Plan and write posts'], ['creative-check', 'Check a post']],
      need: 'Instagram and Facebook insights show reach per month (Meta Business Suite can export a CSV).' },
    { id: 'email', icon: '✉️', title: 'Newsletter', metrics: ['subscribers', 'openRate'],
      sources: ['Newsletter'], skills: [['newsletter', 'Write the next issue'], ['email-sequence', 'Welcome emails']],
      need: 'Your email tool shows subscribers and open rate per send.' },
    { id: 'word', icon: '🗣️', title: 'Word of mouth and partners', metrics: [],
      sources: ['Recommendation', 'Partner', 'Came back'], skills: [['word-of-mouth', 'Referrals and reviews'], ['case-studies', 'A customer story']],
      need: 'Measured from how new customers found you.' },
    { id: 'ads', icon: '🎯', title: 'Ads and offers', metrics: ['spend'],
      sources: ['An ad', 'Event or market'], skills: [['paid-ads', 'Plan ads'], ['ad-creative', 'Write ad copy'], ['offers-promotions', 'Design an offer']],
      need: 'Record what you spend per month to see the cost per new customer.' },
  ];

  const month = (n) => BW.addPeriod(BW.today().slice(0, 7) + '-01', 'month', n).slice(0, 7);
  const label = (m) => BW.fmtDate(m + '-01', { month: 'short' });
  const num = (v) => (v === '' || v == null ? null : BW.num(v));
  const fmt = (v, m) => (v == null ? '–' : m && m.money ? BW.money(v) : m && m.dec ? Number(v).toFixed(m.dec) : Math.round(v).toLocaleString());

  const I = (BW.mktInsights = {
    METRICS, CHANNELS,
    async load() {
      const d = await BW.mktDash.load();
      const [clients, settings] = await Promise.all([BW.store.all('clients'), BW.store.all('mktsettings')]);
      d.clients = clients; d.settings = settings[0] || { id: 'settings', goalNew: '' };
      return d;
    },

    // Everything the page shows, worked out once.
    compute(d) {
      const ms = Array.from({ length: 12 }, (_, k) => month(k - 11));
      const sent = d.invoices.filter((i) => i.kind === 'invoice' && i.status !== 'draft' && i.clientId);
      const first = {};
      sent.forEach((i) => { if (!first[i.clientId] || i.issueDate < first[i.clientId]) first[i.clientId] = i.issueDate; });
      const per = ms.map((m) => {
        const these = sent.filter((i) => (i.issueDate || '').startsWith(m));
        const fresh = Object.entries(first).filter(([, dt]) => (dt || '').startsWith(m)).map(([id]) => id);
        const revenue = these.reduce((t, i) => t + BW.invoiceTotals(i).subtotal, 0);
        const fromNew = these.filter((i) => fresh.includes(i.clientId)).reduce((t, i) => t + BW.invoiceTotals(i).subtotal, 0);
        const row = d.numbers.find((x) => x.month === m) || {};
        const planned = d.plan.filter((a) => (a.month || '').slice(0, 7) === m && a.status !== 'planned').reduce((t, a) => t + BW.num(a.cost), 0);
        const spend = num(row.spend) != null ? num(row.spend) : planned || null;
        return { m, fresh: fresh.length, freshIds: fresh, active: new Set(these.map((i) => i.clientId)).size, revenue, fromNew, spend, row };
      });
      const cur = per[11], prev = per[10];
      // Sources of new customers over the last 12 months.
      const newIds = per.flatMap((x) => x.freshIds);
      const src = {};
      newIds.forEach((id) => { const c = d.clients.find((x) => x.id === id); const s = (c && c.source) || 'Not recorded'; src[s] = (src[s] || 0) + 1; });
      const spend12 = per.reduce((t, x) => t + (x.spend || 0), 0), new12 = newIds.length;
      const rev12 = per.reduce((t, x) => t + x.revenue, 0), fromNew12 = per.reduce((t, x) => t + x.fromNew, 0);
      const series = (k) => ms.map((m) => num((d.numbers.find((x) => x.month === m) || {})[k]));
      return { ms, per, cur, prev, src, new12, spend12, rev12, cpa: new12 && spend12 ? spend12 / new12 : null, repeatShare: rev12 ? 1 - fromNew12 / rev12 : null, series,
        goal: num(d.settings.goalNew), customersEver: Object.keys(first).length };
    },

    /* "What stands out": plain observations a small-business owner can act on, each with the skill
       that helps. Ordered by how much they matter for growth. */
    observations(d, c) {
      const out = [], add = (icon, text, skill, label) => out.push({ icon, text, skill, label });
      const last3 = c.per.slice(-3).reduce((t, x) => t + x.fresh, 0), prev3 = c.per.slice(-6, -3).reduce((t, x) => t + x.fresh, 0);
      if (!c.customersEver) add('🧾', 'No sent invoices yet, so new customers can\'t be counted. Send invoices through Busywork and this page fills itself.', null);
      else if (last3 < prev3) add('📉', `New customers are down: ${last3} in the last three months, ${prev3} in the three before. Growth comes from more buyers; check that you are visible every month.`, 'marketing-plan', 'Plan steady presence');
      else if (last3 > prev3) add('📈', `New customers are up: ${last3} in the last three months against ${prev3} before. Find out what brought them in and keep doing it.`, null);
      const unknown = c.src['Not recorded'] || 0;
      if (c.new12 && unknown / c.new12 > 0.4) add('❓', `You don't know how ${unknown} of your ${c.new12} new customers found you. Ask "How did you find us?" and note it in the Client Book: it is the cheapest marketing measurement there is.`, null);
      const top = Object.entries(c.src).filter(([s]) => s !== 'Not recorded').sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 2) add('⭐', `${top[0]} brought the most new customers this year (${top[1]}). Make it easier: ${top[0] === 'Recommendation' ? 'ask happy customers to pass your name on' : 'give it a steady place in your plan'}.`, top[0] === 'Recommendation' ? 'word-of-mouth' : 'marketing-plan', top[0] === 'Recommendation' ? 'Get more referrals' : 'Plan it in');
      const ahead = Array.from({ length: 3 }, (_, k) => month(k)).filter((m) => !d.plan.some((a) => (a.month || '').slice(0, 7) === m));
      if (ahead.length) add('🕳️', `No marketing planned for ${ahead.map(label).join(', ')}. Most people who will buy from you aren't looking yet; a little every month keeps you in mind.`, 'marketing-plan', 'Fill the gaps');
      const rv = c.series('reviews').filter((v) => v != null);
      if (rv.length >= 3 && rv[rv.length - 1] <= rv[rv.length - 3]) add('💬', 'Your review count hasn\'t grown in three months. Recent reviews help people choose you on Google.', 'word-of-mouth', 'Ask for reviews');
      if (c.cpa != null) add('💶', `Each new customer cost about ${BW.money(c.cpa)} in marketing over the last 12 months (${BW.money(c.spend12)} spent, ${c.new12} new customers).`, 'reach-planner', 'Get more reach per euro');
      const wave = d.waves[d.waves.length - 1];
      if (!wave || (Date.now() - Date.parse(wave.date)) / 864e5 > 365) add('🧠', 'No brand survey in the last year. A short survey shows whether more local buyers think of you, which sales figures only show later.', 'brand-health', 'Plan a survey');
      if (!d.numbers.length) add('📊', 'No monthly numbers recorded yet. Five minutes at the start of each month (or a CSV export) is enough to see what moves.', null);
      return out.slice(0, 6);
    },

    /* The page. opts: { run(skillId, prompt), explain(c), guided } */
    async render(v, opts = {}) {
      const d = await I.load(), c = I.compute(d), obs = I.observations(d, c);
      const max = Math.max(1, c.goal || 0, ...c.per.map((x) => x.fresh));
      const goalLine = c.goal ? `<div class="goal-line" style="bottom:${c.goal / max * 100}%"><span>goal ${c.goal}</span></div>` : '';
      const srcRows = Object.entries(c.src).sort((a, b) => b[1] - a[1]);
      const srcMax = Math.max(1, ...srcRows.map((r) => r[1]));
      const hasNum = (ch) => ch.metrics.some((k) => c.series(k).some((x) => x != null));
      v.innerHTML = `
        <div class="ins-top">
          <section class="card dash-card ins-growth">
            <h3>🌱 New customers <small>the number that shows growth · from your invoices</small></h3>
            <div class="ins-big"><b>${c.cur.fresh}</b><span>this month${c.goal ? ` · goal ${c.goal}` : ''}</span><b>${c.new12}</b><span>last 12 months</span></div>
            <div class="dash-bars ins-bars">${goalLine}${c.per.map((x) => `<div class="b" title="${x.fresh} new in ${label(x.m)}"><em>${x.fresh || ''}</em><i style="height:${x.fresh / max * 100}%"></i><span>${label(x.m).slice(0, 3)}</span></div>`).join('')}</div>
            <div class="row-flex"><small class="faint">Revenue last 12 months ${BW.money(c.rev12)}${c.repeatShare != null ? ` · ${Math.round(c.repeatShare * 100)}% from returning customers` : ''}${c.cpa != null ? ` · ${BW.money(c.cpa)} marketing per new customer` : ''}</small><span class="spacer"></span><button class="btn btn-ghost" data-goal>🎯 ${c.goal ? 'Change goal' : 'Set a goal'}</button></div>
          </section>
          <section class="card dash-card">
            <h3>🔎 How new customers found you <small>last 12 months · from the Client Book</small></h3>
            ${srcRows.length ? `<div class="src">${srcRows.map(([s, n]) => `<div><span>${esc(s)}</span><i style="width:${n / srcMax * 100}%"></i><b>${n}</b></div>`).join('')}</div>` : '<p class="dash-gap">No new customers in the last 12 months yet.</p>'}
            <small class="faint">Ask every new customer "How did you find us?" and pick it in the Client Book.</small>
          </section>
        </div>
        <section class="card dash-card" style="margin:16px 0">
          <h3>💡 What stands out <small>${opts.guided ? 'Olaf picks these up in your check-ins' : 'and what to do about it'}</small></h3>
          ${obs.length ? obs.map((o, i) => `<div class="obs"><span class="e">${o.icon}</span><p>${esc(o.text)}</p>${o.skill ? `<button class="btn btn-ghost" data-obs="${i}">${esc(o.label)} →</button>` : ''}</div>`).join('') : '<p>Nothing urgent. Keep going.</p>'}
          ${opts.explain ? `<div class="row-flex" style="margin-top:6px"><button class="btn btn-primary" data-explain>🧭 Ask Olaf to review the month</button><small class="faint">Olaf reads all of this, updates your plan and tells you what to change.</small></div>`
            : opts.upsell ? `<div class="row-flex" style="margin-top:6px"><button class="btn" data-upsell>🧭 Olaf reviews your month with you</button><small class="faint">With Olaf, the AI expert in the paid edition, this turns into a plan every month.</small></div>` : ''}
        </section>
        <h2 style="margin:24px 0 12px">Channel health</h2>
        <div class="dash">${CHANNELS.map((ch) => {
          const fromSrc = ch.sources.reduce((t, s) => t + (c.src[s] || 0), 0);
          const tiles = ch.metrics.map((k) => { const s = c.series(k), vals = s.filter((x) => x != null); if (!vals.length) return ''; const lastV = vals[vals.length - 1], prevV = vals.length > 1 ? vals[vals.length - 2] : null;
            const pts = s.map((x, i) => (x == null ? null : [i, x])).filter(Boolean), mx = Math.max(...vals), mn = Math.min(...vals);
            const line = pts.length > 1 ? `<svg viewBox="0 0 110 24" class="spark"><polyline points="${pts.map(([i, x]) => `${i * 10},${22 - (mx === mn ? 10 : (x - mn) / (mx - mn) * 20)}`).join(' ')}"/></svg>` : '';
            return `<div class="tile"><span>${esc(byKey[k].label)}</span><b>${fmt(lastV, byKey[k])}</b>${prevV != null ? `<small class="${lastV >= prevV ? 'up' : 'down'}">${lastV >= prevV ? '▲' : '▼'} ${fmt(Math.abs(lastV - prevV), byKey[k])}</small>` : '<small>first month</small>'}${line}</div>`; }).join('');
          return `<section class="card dash-card ch"><h3>${ch.icon} ${esc(ch.title)} <small>${fromSrc ? `${fromSrc} new customer${fromSrc > 1 ? 's' : ''} this year` : 'no new customers traced here yet'}</small></h3>
            ${tiles ? `<div class="tiles">${tiles}</div>` : `<p class="faint" style="font-size:.85rem">${esc(ch.need)}</p>`}
            <div class="ch-skills">${ch.skills.map(([id, l]) => `<button class="btn btn-ghost" data-skill="${id}">${esc(l)}</button>`).join('')}</div></section>`; }).join('')}</div>
        <section class="card dash-card" style="margin-top:16px">
          <h3>📒 Monthly numbers <small>a few minutes a month, by hand or from an export</small></h3>
          <div class="table-scroll"><table class="num-table"><tr><th></th>${c.ms.slice(-6).map((m) => `<th>${label(m)}</th>`).join('')}</tr>
            ${METRICS.filter((m) => c.series(m.k).some((x) => x != null)).map((m) => `<tr><td>${esc(m.label)}</td>${c.series(m.k).slice(-6).map((x) => `<td>${fmt(x, m)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="7" class="faint">Nothing recorded yet.</td></tr>`}</table></div>
          <div class="row-flex" style="margin-top:10px"><button class="btn btn-primary" data-add>＋ Add this month's numbers</button><label class="btn">📥 Import a CSV export<input type="file" accept=".csv,text/csv" data-csv hidden></label>
            <small class="faint">Works with exports from Google Business Profile, Search Console, Meta Business Suite and most email tools.</small></div>
        </section>
        <div style="height:40px"></div>`;
      const again = () => I.render(v, opts);
      $$('[data-obs]', v).forEach((b) => b.onclick = () => { const o = obs[Number(b.dataset.obs)]; opts.run && opts.run(o.skill, o.text); });
      $$('[data-skill]', v).forEach((b) => b.onclick = () => opts.run && opts.run(b.dataset.skill, ''));
      const ex = $('[data-explain]', v); if (ex) ex.onclick = () => opts.explain(c, d);
      const up = $('[data-upsell]', v); if (up) up.onclick = () => opts.upsell();
      $('[data-goal]', v).onclick = () => I.editGoal(d, again);
      $('[data-add]', v).onclick = () => I.addNumbers(d, again);
      $('[data-csv]', v).onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then((txt) => I.importCsv(txt, f.name, d, again)); };
    },

    editGoal(d, after) {
      const box = BW.html(`<div><p class="muted" style="margin-bottom:12px">How many new customers a month would make you happy? Keep it realistic: you can change it any time.</p>
        <label class="field"><span>New customers per month</span><input class="in" inputmode="numeric" data-g value="${esc(d.settings.goalNew || '')}"></label></div>`);
      BW.modal({ title: '🎯 Your goal', body: box, actions: [{ label: 'Save', kind: 'primary', onClick: async () => { d.settings.goalNew = $('[data-g]', box).value.trim(); await BW.store.put('mktsettings', d.settings); after(); } }] });
    },

    addNumbers(d, after) {
      const m = month(0), cur = d.numbers.find((x) => x.month === m) || { month: m };
      const box = BW.html(`<div><p class="muted" style="margin-bottom:12px">Fill in what you know and leave the rest empty. New customers and revenue come from your invoices by themselves.</p>
        <label class="field"><span>Month</span><input class="in" type="month" data-k="month" value="${esc(cur.month)}"></label>
        ${CHANNELS.filter((ch) => ch.metrics.length).map((ch) => `<h4 style="margin:14px 0 6px">${ch.icon} ${esc(ch.title)}</h4><div class="grid-2">${ch.metrics.map((k) => `<label class="field"><span>${esc(byKey[k].label)}</span><input class="in" inputmode="decimal" data-k="${k}" value="${esc(cur[k] == null ? '' : cur[k])}"></label>`).join('')}</div>`).join('')}
        <h4 style="margin:14px 0 6px">🧾 Sales</h4><div class="grid-2"><label class="field"><span>${esc(byKey.enquiries.label)}</span><input class="in" inputmode="numeric" data-k="enquiries" value="${esc(cur.enquiries == null ? '' : cur.enquiries)}"></label>
        <label class="field"><span>Note</span><input class="in" data-k="note" value="${esc(cur.note || '')}" placeholder="e.g. lights campaign ran"></label></div></div>`);
      BW.modal({ title: '📒 This month\'s numbers', body: box, wide: true, actions: [{ label: 'Save', kind: 'primary', onClick: async () => {
        const rec = Object.assign({}, cur); $$('[data-k]', box).forEach((i) => { rec[i.dataset.k] = i.value.trim(); });
        if (!/^\d{4}-\d{2}$/.test(rec.month)) { BW.toast('Pick a month', '🤔'); return false; }
        const same = d.numbers.find((x) => x.month === rec.month); if (same) rec.id = same.id;
        rec.by = 'owner'; await BW.store.put('mktnumbers', rec); BW.toast('Numbers saved', '📒'); after();
      } }] });
    },

    /* Most marketing tools export a CSV with a date column and a few number columns. We find the
       date, let the owner say which column is which metric, and add it up per month. */
    importCsv(text, name, d, after) {
      const rows = BW.csv.parse(text);
      if (rows.length < 2) return BW.toast('That file has no rows to import', '🤔');
      const head = rows[0].map((h) => h.trim()), body = rows.slice(1);
      const toMonth = (s) => { s = String(s || '').trim(); let m = s.match(/^(\d{4})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}`; m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (m) return `${m[3]}-${(Number(m[2]) > 12 ? m[1] : m[2]).padStart(2, '0')}`; const t = Date.parse(s); return isNaN(t) ? null : new Date(t).toISOString().slice(0, 7); };
      const dateCol = head.findIndex((_, i) => body.slice(0, 5).every((r) => toMonth(r[i])));
      if (dateCol < 0) return BW.toast('No date column found. Export the report per day or per month.', '🤔');
      const numCols = head.map((h, i) => i).filter((i) => i !== dateCol && body.slice(0, 5).some((r) => /\d/.test(r[i] || '')) && body.slice(0, 5).every((r) => !(r[i] || '').trim() || !isNaN(BW.num(r[i]))));
      const guess = (h) => { h = h.toLowerCase(); const map = [['call', 'gbpCalls'], ['direction', 'gbpDirections'], ['route', 'gbpDirections'], ['website click', 'gbpClicks'], ['view', 'gbpViews'], ['impression', 'gbpViews'], ['click', 'searchClicks'], ['session', 'visits'], ['visit', 'visits'], ['user', 'visits'], ['reach', 'reach'], ['follower', 'followers'], ['subscriber', 'subscribers'], ['open', 'openRate'], ['review', 'reviews'], ['rating', 'rating'], ['spend', 'spend'], ['cost', 'spend']]; const hit = map.find(([w]) => h.includes(w)); return hit ? hit[1] : ''; };
      const box = BW.html(`<div><p class="muted" style="margin-bottom:12px"><b>${esc(name)}</b>: ${body.length} rows, dates in “${esc(head[dateCol])}”. Pick what each column is; leave the rest on “skip”. Values are added up per month (levels like followers or rating take the month's last value).</p>
        ${numCols.map((i) => `<label class="field"><span>${esc(head[i])}</span><select class="in" data-col="${i}"><option value="">Skip</option>${METRICS.map((m) => `<option value="${m.k}" ${guess(head[i]) === m.k ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>`).join('') || '<p>No number columns found.</p>'}</div>`);
      BW.modal({ title: '📥 Import numbers', body: box, actions: [{ label: 'Import', kind: 'primary', onClick: async () => {
        const picks = $$('[data-col]', box).filter((s) => s.value).map((s) => [Number(s.dataset.col), s.value]);
        if (!picks.length) { BW.toast('Pick at least one column', '🤔'); return false; }
        const months = {};
        body.forEach((r) => { const m = toMonth(r[dateCol]); if (!m) return; months[m] = months[m] || {}; picks.forEach(([i, k]) => { const val = BW.num(r[i]); if (isNaN(val) || !String(r[i] || '').trim()) return; months[m][k] = byKey[k].kind === 'sum' ? (months[m][k] || 0) + val : val; }); });
        const recs = Object.entries(months).map(([m, vals]) => Object.assign({}, d.numbers.find((x) => x.month === m) || { month: m }, vals, { by: 'import' }));
        await BW.store.putMany('mktnumbers', recs);
        BW.toast(`Imported ${recs.length} month${recs.length > 1 ? 's' : ''}`, '📥'); after();
      } }] });
    },

    // Compact facts for an AI summary or for Olaf.
    facts(c, d) {
      return { today: BW.today(), currency: BW.settings.currency, goalNewPerMonth: c.goal, newCustomers: c.per.map((x) => ({ month: x.m, new: x.fresh, activeCustomers: x.active, revenueExVat: Math.round(x.revenue), spend: x.spend })),
        sources: c.src, costPerNewCustomer: c.cpa && Math.round(c.cpa), repeatRevenueShare: c.repeatShare == null ? null : Math.round(c.repeatShare * 100) + '%',
        numbers: d.numbers.slice(-6).map(({ id, createdAt, updatedAt, example, by, ...x }) => x), planThisAndNextMonth: d.plan.filter((a) => [month(0), month(1)].includes((a.month || '').slice(0, 7))).map((a) => ({ month: a.month, title: a.title, status: a.status })) };
    },
  });
})();
