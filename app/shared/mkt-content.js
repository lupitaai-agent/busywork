/* The content calendar, shared by the Marketing Studio and Olaf (collection 'mktcontent').
   A post or piece: { date, channel, title, text, status idea|draft|ready|posted, cep, planId, by }.
   The Studio owner writes posts themselves, or with AI on their own key; Olaf fills the calendar
   itself. Each app passes `write(item)` and `suggest(weekStart)` actions. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const STATUS = { idea: '💡 Idea', draft: '📝 Draft', ready: '✅ Ready', posted: '🚀 Posted' };
  const CHANNELS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'Google Business Profile', 'Newsletter', 'Website / blog', 'Shop window', 'Flyer', 'Local press'];
  const monday = (iso) => { const dt = new Date(iso + 'T12:00:00'); const k = (dt.getDay() + 6) % 7; return BW.addDays(iso, -k); };

  const C = (BW.mktContent = {
    STATUS, CHANNELS,
    async render(v, opts = {}) {
      const [items, plan, prof] = await Promise.all([BW.store.all('mktcontent'), BW.store.all('mktplan'), BW.store.all('mktprofile')]);
      const start = monday(BW.today()), weeks = Array.from({ length: 4 }, (_, k) => BW.addDays(start, k * 7));
      const late = items.filter((x) => x.date < start && x.status !== 'posted');
      const inWeek = (w) => items.filter((x) => x.date >= w && x.date < BW.addDays(w, 7)).sort((a, b) => a.date.localeCompare(b.date));
      const posted30 = items.filter((x) => x.status === 'posted' && x.date >= BW.addDays(BW.today(), -30)).length;
      const card = (x) => `<div class="post" data-id="${esc(x.id)}">
          <div class="post-top"><button class="chip-btn ps-${esc(x.status || 'idea')}" data-st="${esc(x.id)}" title="Change status">${STATUS[x.status] || STATUS.idea}</button><small>${esc(BW.fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${esc(x.channel || 'Any channel')}${x.by === 'olaf' ? ' · by Olaf' : ''}</small></div>
          <b>${esc(x.title || 'Untitled')}</b>${x.cep ? `<small class="faint">🚪 ${esc(x.cep)}</small>` : ''}
          ${x.text ? `<p>${esc(x.text.length > 220 ? x.text.slice(0, 220) + '…' : x.text)}</p>` : ''}
          <div class="row-flex">${x.text ? `<button class="btn btn-ghost" data-copy="${esc(x.id)}">📋 Copy</button>` : ''}${opts.write && !x.text ? `<button class="btn btn-ghost" data-write="${esc(x.id)}">${opts.guided ? '🧭 Ask Olaf to write it' : '✨ Write it with AI'}</button>` : ''}<button class="btn btn-ghost" data-edit="${esc(x.id)}">✏️ Edit</button></div>
        </div>`;
      v.innerHTML = `
        <div class="row-flex" style="margin-bottom:14px"><div><b>${posted30} posted in the last 30 days</b><br><small class="faint">A steady rhythm you can keep beats bursts. Link each post to a buying moment and show your brand assets.</small></div>
          <div class="spacer"></div>${opts.suggest ? `<button class="btn" data-suggest>${opts.guided ? '🧭 Ask Olaf to fill the next weeks' : '✨ Suggest posts with AI'}</button>` : ''}<button class="btn btn-primary" data-add>＋ Add a post</button></div>
        ${late.length ? `<section class="card dash-card" style="margin-bottom:16px"><h3>⏰ Not posted yet <small>planned before this week</small></h3><div class="posts">${late.map(card).join('')}</div></section>` : ''}
        ${weeks.map((w, i) => { const list = inWeek(w); const planNow = plan.filter((a) => (a.month || '').slice(0, 7) === w.slice(0, 7));
          return `<section class="card dash-card" style="margin-bottom:16px"><h3>${i === 0 ? 'This week' : i === 1 ? 'Next week' : 'Week of ' + BW.fmtDate(w, { day: 'numeric', month: 'short' })} <small>${list.length} planned${!list.length && planNow.length ? ` · plan this month: ${esc(planNow.slice(0, 2).map((a) => a.title).join('; '))}` : ''}</small></h3>
            ${list.length ? `<div class="posts">${list.map(card).join('')}</div>` : `<p class="dash-gap">Nothing planned.</p>`}
            <div><button class="btn btn-ghost" data-add-week="${w}">＋ Add to this week</button></div></section>`; }).join('')}
        <div style="height:40px"></div>`;
      const again = () => C.render(v, opts), find = (id) => items.find((x) => x.id === id);
      const ceps = ((prof[0] && prof[0].ceps) || []).map((x) => x.text);
      $('[data-add]', v).onclick = () => C.edit({ date: BW.today(), status: 'idea' }, ceps, again);
      $$('[data-add-week]', v).forEach((b) => b.onclick = () => C.edit({ date: b.dataset.addWeek < BW.today() ? BW.today() : b.dataset.addWeek, status: 'idea' }, ceps, again));
      $$('[data-edit]', v).forEach((b) => b.onclick = () => C.edit(find(b.dataset.edit), ceps, again));
      $$('[data-st]', v).forEach((b) => b.onclick = async () => { const x = find(b.dataset.st), o = Object.keys(STATUS); x.status = o[(o.indexOf(x.status || 'idea') + 1) % o.length]; await BW.store.put('mktcontent', x); again(); });
      $$('[data-copy]', v).forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(find(b.dataset.copy).text); BW.toast('Copied', '📋'); } catch (e) { BW.toast('Could not copy. Open it with Edit and copy from there.', '😬'); } });
      $$('[data-write]', v).forEach((b) => b.onclick = () => opts.write(find(b.dataset.write), again, b));
      const sg = $('[data-suggest]', v); if (sg) sg.onclick = () => opts.suggest(weeks[0], again, sg);
    },

    edit(x, ceps, after) {
      BW.recordDrawer({ collection: 'mktcontent', rec: Object.assign({}, x), title: 'Post', newTitle: 'New post',
        fields: [
          { k: 'title', label: 'What is it about?', ph: 'e.g. Lights fixed while you wait', span: 2 },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'channel', label: 'Channel', type: 'select', options: [['', 'Any channel']].concat(CHANNELS.map((c) => [c, c])) },
          { k: 'status', label: 'Status', type: 'chips', options: Object.entries(STATUS) },
          { k: 'cep', label: 'Buying moment it links to', type: 'select', options: [['', '—']].concat(ceps.map((c) => [c, c])), span: 2 },
          { k: 'text', label: 'The post', type: 'textarea', span: 2, ph: 'Write it here, or leave it empty and let AI draft it.' },
        ],
        onSaved: after, confirmDelete: true });
    },

    // Adds suggested items (from AI or Olaf) without duplicating titles in the same week.
    async addMany(list, by) {
      const items = await BW.store.all('mktcontent');
      const fresh = list.filter((x) => x && x.title && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && !items.some((y) => y.title === x.title && y.date.slice(0, 7) === x.date.slice(0, 7)))
        .map((x) => ({ date: x.date, title: String(x.title).slice(0, 140), channel: x.channel || '', cep: x.cep || '', text: x.text || '', status: x.text ? 'draft' : 'idea', by }));
      if (fresh.length) await BW.store.putMany('mktcontent', fresh);
      return fresh.length;
    },
  });
})();
