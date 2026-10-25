/* The content calendar, shared by the Marketing Studio and Olaf (collection 'mktcontent').
   A post or piece: { date, channel, title, text, status idea|draft|ready|posted, cep, planId, by }.
   The Studio owner writes posts themselves; Olaf (paid) fills the calendar
   itself. Each app passes `write(item)` and `suggest(weekStart)` actions. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const STATUS = { idea: '💡 Idea', draft: '📝 Draft', ready: '✅ Ready', posted: '🚀 Posted' };
  const CHANNELS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'Google Business Profile', 'Newsletter', 'Website / blog', 'Shop window', 'Flyer', 'Local press'];
  // Where each channel's posting screen is. We copy the text first; the owner pastes it there.
  const OPEN = { Instagram: 'https://www.instagram.com/', Facebook: 'https://www.facebook.com/', LinkedIn: 'https://www.linkedin.com/feed/?shareActive=true',
    TikTok: 'https://www.tiktok.com/upload', 'Google Business Profile': 'https://business.google.com/' };
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
          <div class="row-flex">${x.text ? `<button class="btn ${x.status === 'posted' ? 'btn-ghost' : ''}" data-post="${esc(x.id)}">📤 Post it</button><button class="btn btn-ghost" data-copy="${esc(x.id)}">📋 Copy</button>` : ''}${opts.write && !x.text ? `<button class="btn btn-ghost" data-write="${esc(x.id)}">🧭 Ask Olaf to write it</button>` : ''}<button class="btn btn-ghost" data-edit="${esc(x.id)}">✏️ Edit</button></div>
        </div>`;
      v.innerHTML = `
        <div class="row-flex" style="margin-bottom:14px"><div><b>${posted30} posted in the last 30 days</b><br><small class="faint">A steady rhythm you can keep beats bursts. Link each post to a buying moment and show your brand assets.</small></div>
          <div class="spacer"></div><button class="btn btn-ghost" data-export>⬇️ Export</button>${opts.suggest ? `<button class="btn" data-suggest>🧭 Ask Olaf to fill the next weeks</button>` : opts.upsell ? `<button class="btn btn-ghost" data-upsell>🧭 Let Olaf write your posts</button>` : ''}<button class="btn btn-primary" data-add>＋ Add a post</button></div>
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
      $$('[data-copy]', v).forEach((b) => b.onclick = async () => { if (await BW.copy(find(b.dataset.copy).text)) BW.toast('Copied', '📋'); else BW.toast('Could not copy. Open it with Edit and copy from there.', '😬'); });
      $$('[data-write]', v).forEach((b) => b.onclick = () => opts.write(find(b.dataset.write), again, b));
      $$('[data-post]', v).forEach((b) => b.onclick = () => C.postIt(find(b.dataset.post), again));
      $('[data-export]', v).onclick = () => C.exportMenu(items.filter((x) => x.date >= start && x.date < BW.addDays(start, 28)));
      const sg = $('[data-suggest]', v); if (sg) sg.onclick = () => opts.suggest(weeks[0], again, sg);
      const up = $('[data-upsell]', v); if (up) up.onclick = () => opts.upsell();
    },

    edit(x, ceps, after) {
      BW.recordDrawer({ collection: 'mktcontent', rec: Object.assign({}, x), title: 'Post', newTitle: 'New post',
        fields: [
          { k: 'title', label: 'What is it about?', ph: 'e.g. Lights fixed while you wait', span: 2 },
          { k: 'date', label: 'Date', type: 'date' },
          { k: 'channel', label: 'Channel', type: 'select', options: [['', 'Any channel']].concat(CHANNELS.map((c) => [c, c])) },
          { k: 'status', label: 'Status', type: 'chips', options: Object.entries(STATUS) },
          { k: 'cep', label: 'Buying moment it links to', type: 'select', options: [['', '—']].concat(ceps.map((c) => [c, c])), span: 2 },
          { k: 'text', label: 'The post', type: 'textarea', span: 2, ph: 'Write it here, or leave it empty for now.' },
        ],
        onSaved: after, confirmDelete: true });
    },

    /* Posting happens in the platforms' own apps (posting for you would need their logins on a server).
       This gets the text there with the least effort: copy and open, a QR code for the phone, an email
       to yourself, or a calendar reminder with the text inside. */
    postIt(x, after) {
      const url = OPEN[x.channel];
      let qr = '';
      try { qr = BW.qr ? BW.qr.svg(x.text, 3) : ''; } catch (e) { qr = ''; }
      const mail = `mailto:${encodeURIComponent((BW.settings && BW.settings.email) || '')}?subject=${encodeURIComponent('Post: ' + (x.title || ''))}&body=${encodeURIComponent(x.text)}`;
      const box = BW.html(`<div class="postit">
        <div class="postit-opts">
          ${url ? `<button class="btn btn-primary" data-open>📋 Copy and open ${esc(x.channel)}</button>` : '<button class="btn btn-primary" data-open>📋 Copy the text</button>'}
          <a class="btn" href="${mail}">✉️ Email it to me</a>
          <button class="btn" data-ics>📅 Add a reminder to my calendar</button>
        </div>
        <div class="postit-qr">${qr ? `<div class="qr-box">${qr}</div><small>📱 Scan with your phone's camera: the text opens, ready to copy into the app with your photo.</small>` : '<small>📱 This post is too long for one QR code. Email it to yourself to post it from your phone.</small>'}</div>
        <p class="faint" style="font-size:.85rem">After posting, mark it as posted so your dashboard counts it.</p></div>`);
      BW.modal({ title: '📤 Post it', body: box, wide: true, actions: [{ label: 'Close', kind: 'ghost' }, { label: '🚀 Mark as posted', kind: 'primary', onClick: async () => { x.status = 'posted'; await BW.store.put('mktcontent', x); BW.toast('Marked as posted', '🚀'); after(); } }] });
      $('[data-open]', box).onclick = async () => {
        if (await BW.copy(x.text)) BW.toast('Copied: paste it into the post', '📋'); else BW.toast('Could not copy. Select the text in Edit and copy it there.', '😬');
        if (url) BW.openUrl(url);
      };
      $('[data-ics]', box).onclick = () => C.download([x], 'post-' + x.date + '.ics');
    },

    exportMenu(list) {
      const box = BW.html(`<div><p class="muted" style="margin-bottom:12px">${list.length} posts in the next four weeks.</p>
        <div class="postit-opts"><button class="btn btn-primary" data-ics>📅 Calendar file (.ics)</button><button class="btn" data-csv>📊 Spreadsheet (.csv)</button></div>
        <p class="faint" style="font-size:.85rem;margin-top:10px">The calendar file puts each post in your calendar on its day, with the text inside and a reminder at 9:00. The spreadsheet has date, channel, title, text and status; scheduling tools can usually import it after matching the columns.</p></div>`);
      BW.modal({ title: '⬇️ Export the content calendar', body: box });
      $('[data-ics]', box).onclick = () => C.download(list, 'content-calendar.ics');
      $('[data-csv]', box).onclick = () => BW.exportCsv('content-calendar.csv', ['Date', 'Channel', 'Title', 'Text', 'Status', 'Buying moment'], list.map((x) => [x.date, x.channel || '', x.title || '', x.text || '', x.status || 'idea', x.cep || '']));
    },

    // An iCalendar file: all-day events with the post in the description and a 9:00 reminder.
    download(list, name) {
      const esc2 = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
      const d = (iso) => iso.replace(/-/g, '');
      // Lines are at most 75 bytes (not characters: an emoji is four), continued after a space.
      const bytes = new TextEncoder();
      const fold = (line) => {
        const out = []; let cur = '', n = 0;
        for (const ch of line) {
          const b = bytes.encode(ch).length;
          if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
          cur += ch; n += b;
        }
        return out.concat(cur).join('\r\n ');
      };
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Busy//Content calendar//EN', 'CALSCALE:GREGORIAN'];
      list.forEach((x) => lines.push('BEGIN:VEVENT', `UID:${x.id}@busywork`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
        `DTSTART;VALUE=DATE:${d(x.date)}`, `DTEND;VALUE=DATE:${d(BW.addDays(x.date, 1))}`, fold(`SUMMARY:${esc2('Post: ' + (x.title || '') + (x.channel ? ' (' + x.channel + ')' : ''))}`),
        fold(`DESCRIPTION:${esc2(x.text || 'Write this post first.')}`), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Time to post', 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT'));
      lines.push('END:VCALENDAR');
      BW.download(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar' }), name);
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
