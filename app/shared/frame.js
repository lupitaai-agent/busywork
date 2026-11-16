/* The pieces every "Today" and every part screen of version 2 is made of: a line of work that needs you (with one
   button that does it), a quiet list for later, the year as twelve cells, a gauge. And the place where prepared
   work shows up as "Needs your yes": the free apps never have any; an edition with an expert provides BW.cards. */
(function () {
  'use strict';
  const BW = window.BW, { esc } = BW;
  const COUNT = ['Nothing needs you today.', 'One thing needs you today.', 'Two things need you today.', 'Three things need you today.'];

  const ui = (BW.ui = {
    // "Good afternoon, Sam · Sunday 15 November", and the guide of the place beside it
    hello(name) {
      const h = new Date().getHours(), hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      const first = String(name || '').split(' ')[0];
      return `<p class="hello">${BW.t(hi)}${first ? ', ' + esc(first) : ''} · ${BW.fmtDate(BW.today(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>`;
    },
    headline: (n) => COUNT[Math.min(n, 3)],
    /* One thing that needs the person. n: { c: colour, e: emoji, t: title, s: why (one line), b: button, href, more: [label, href] } */
    need(n, i) {
      const go = (label, href, kind) => (href ? `<a class="btn ${kind}" href="${esc(href)}">${esc(label)}</a>` : `<button type="button" class="btn ${kind}" data-need="${i}">${esc(label)}</button>`);
      return `<div class="card need" style="--c:var(--${n.c || 'sun'})"><span class="ic" aria-hidden="true">${n.e}</span><div class="nt"><b>${esc(n.t)}</b><span>${esc(n.s || '')}</span></div>
        <div class="na">${n.b ? go(n.b, n.href, 'btn-primary') : ''}${n.more ? (n.more[1] ? go(n.more[0], n.more[1], '') : `<button type="button" class="btn" data-more="${i}">${esc(n.more[0])}</button>`) : ''}</div></div>`;
    },
    line: (left, right, href) => `<${href ? `a href="${esc(href)}"` : 'div'} class="line"><span>${left}</span><b>${right || ''}</b></${href ? 'a' : 'div'}>`,
    k: (label) => `<p class="k">${label}</p>`,
    gauge: (pct, colour) => `<div class="gauge" style="--c:var(--${colour || 'mint'})"><i style="width:${Math.max(3, Math.min(100, Math.round(pct)))}%"></i></div>`,
    dots: (done, total, half) => `<div class="dots">${Array.from({ length: total }, (_, i) => `<i class="${i < done ? 'f' : i === done && half ? 'h' : ''}"></i>`).join('')}</div>`,
    /* The year as twelve cells. months: [{ m: 'YYYY-MM', state: 'done' | 'planned' | 'empty', note }] */
    year(months, big) {
      return `<div class="year${big ? ' big' : ''}">${months.map((x) => `<div class="${x.state === 'done' ? 'd' : x.state === 'planned' ? 'f' : 'e'}"${x.title ? ` title="${esc(x.title)}"` : ''}>${BW.fmtDate(x.m + '-01', { month: big ? 'short' : 'narrow' })}${big ? `<em>${esc(x.note || '')}</em>` : x.state === 'done' ? '<span>✓</span>' : ''}</div>`).join('')}</div>`;
    },
    // The guide of this suite's place, for an empty or an all-done screen.
    guide(pose) { const p = BW.PLACES[BW.suite]; return p && p.guide ? `<img class="guide-pic" src="${BW.root}shared/places/${p.dir}/${p.guide.name.toLowerCase()}-${pose || 'happy'}.png" alt="">` : ''; },

    /* Work an expert prepared, waiting for a yes. Free apps have no BW.cards and draw nothing. */
    async yes() {
      if (!BW.cards) return { html: '', n: 0 };
      let list = [], done = [];
      try { list = await BW.cards.list(); done = (await BW.cards.done()) || []; } catch (e) { console.warn('Cards skipped', e); }
      if (!list.length && !done.length) return { html: '', n: 0 };
      const who = (BW.EXPERTS[BW.suite] || {}).name || '';
      return { n: list.length, html: `${list.length ? `<section class="card yes-card"><h2>${BW.t('Needs your yes')} <small>· ${list.length}</small></h2>${list.map((c) => `<div class="yes" data-card="${esc(c.id)}"><div><b>${esc(c.emoji || '📝')} ${esc(c.title)}</b><span>${esc(c.why || '')}</span></div>
          <div class="na"><button type="button" class="btn btn-primary" data-yes>${BW.t('Yes')}</button><button type="button" class="btn btn-ghost" data-look>${BW.t('Look')}</button><button type="button" class="icon-btn" data-no title="${BW.t('No, thank you')}" aria-label="${BW.t('No, thank you')}">✕</button></div></div>`).join('')}</section>` : ''}
        ${done.length ? `<section class="card flat done-card"><h2>${BW.t('Done for you')} <small>· ${done.length}</small></h2>${done.slice(0, 5).map((d) => `<div class="tick"><i class="y">✓</i>${d.path && BW.cards.open ? `<button type="button" class="link" data-done-file="${esc(d.path)}">${esc(d.title)}</button>` : `<span>${esc(d.title)}</span>`}</div>`).join('')}<p class="faint">${esc(who)} ${BW.t('never sends or publishes anything without your yes.')}</p></section>` : ''}` };
    },
    bindYes(root, refresh) {
      if (!BW.cards) return;
      BW.$$('[data-card]', root).forEach((row) => {
        const id = row.dataset.card, run = (fn) => async () => { try { await fn(id); } catch (e) { BW.error(e); } refresh(); };
        BW.$('[data-yes]', row).onclick = run(BW.cards.yes);
        BW.$('[data-no]', row).onclick = run(BW.cards.no);
        BW.$('[data-look]', row).onclick = () => BW.cards.look(id);
      });
      BW.$$('[data-done-file]', root).forEach((b) => { b.onclick = () => BW.cards.open(b.dataset.doneFile).catch(BW.error); });
    },
  });
})();
