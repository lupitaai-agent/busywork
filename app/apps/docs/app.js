/* Document Maker: pick a template and a client, and the letter writes most of itself. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  let docs = [], clients = [], custom = [], cur = null, dirty = false;

  const TEMPLATES = [
    { id: 'letter', emoji: '📨', name: 'Letter', about: 'A clean business letter on your letterhead.', title: 'Letter to {{client.name}}',
      body: '{{client.name}}\n{{client.contact}}\n{{client.address}}\n{{client.postcode}} {{client.city}}\n\n{{today}}\n\n# About …\n\nDear {{client.contact}},\n\nWrite your message here.\n\nKind regards,\n\n{{me.name}}\n{{me.business}}' },
    { id: 'reminder', emoji: '⏰', name: 'Friendly payment reminder', about: 'A polite nudge for an overdue invoice.', title: 'Payment reminder – {{client.name}}',
      body: '{{client.name}}\n{{client.address}}\n{{client.postcode}} {{client.city}}\n\n{{today}}\n\n# Friendly reminder: open invoice\n\nDear {{client.contact}},\n\nI hope all is well! According to my records, invoice [number] for [amount] was due on [date] and hasn’t reached me yet. It may simply have slipped through the cracks.\n\nCould you transfer the amount to {{me.iban}} in the name of {{me.business}}, mentioning the invoice number?\n\nAlready paid? Then please ignore this letter, and thank you!\n\nKind regards,\n\n{{me.name}}\n{{me.business}} · {{me.email}} · {{me.phone}}' },
    { id: 'thanks', emoji: '🙏', name: 'Thank-you note', about: 'Make a client’s day after a project.', title: 'Thank you, {{client.name}}',
      body: '{{today}}\n\nDear {{client.contact}},\n\nThank you so much for working with {{me.business}}. It was a real pleasure, and I’m proud of what we made together.\n\nIf you know anyone who could use a hand, I’d be grateful for an introduction. And of course, I’m here whenever you need me again.\n\nWarm wishes,\n\n{{me.name}}' },
    { id: 'proposal', emoji: '💡', name: 'Proposal', about: 'Explain the plan before you send the quote.', title: 'Proposal for {{client.name}}',
      body: '{{today}}\n\nPrepared for {{client.name}}\n\n# The goal\n\nWhat the client wants to achieve, in one or two sentences.\n\n# What I’ll do\n\n- Step one\n- Step two\n- Step three\n\n# Timing\n\nWhen each part will be ready.\n\n# Investment\n\nThe price, or “see the attached quote”.\n\n# Next step\n\nReply to this email and I’ll get started.\n\n{{me.name}}\n{{me.business}} · {{me.email}}' },
    { id: 'agreement', emoji: '🤝', name: 'Simple service agreement', about: 'The basics in writing. Have a lawyer check it.', legal: true, title: 'Service agreement – {{client.name}}',
      body: '# Service agreement\n\nBetween {{me.business}}, {{me.address}}, {{me.postcode}} {{me.city}} (“the supplier”)\nand {{client.name}}, {{client.address}}, {{client.postcode}} {{client.city}} (“the client”).\n\nDate: {{today}}\n\n# 1. The work\n\nThe supplier will deliver: [describe the work].\n\n# 2. Price and payment\n\nThe client pays [amount, excl. VAT]. Invoices are paid within {{me.paymentDays}} days.\n\n# 3. Timing\n\nThe work starts on [date] and is delivered by [date].\n\n# 4. Changes\n\nChanges to the work are agreed in writing (email is fine) and may change the price.\n\n# 5. Ownership\n\nOnce paid in full, the client owns the final work. The supplier may show it in their portfolio.\n\n# 6. Ending the agreement\n\nEither side may end this agreement in writing. Work done so far is paid for.\n\nSigned for the supplier:\n\n\n{{me.name}}\n\nSigned for the client:\n\n\n{{client.contact}}' },
    { id: 'pricelist', emoji: '🏷️', name: 'Price list', about: 'Your services and rates on one page.', title: 'Price list {{me.business}}',
      body: '# Prices {{me.business}}\n\nValid from {{today}}. All prices exclude VAT.\n\n# Services\n\n- Service one: €…\n- Service two: €… per hour\n- Service three: from €…\n\n# Good to know\n\n- Invoices are paid within {{me.paymentDays}} days\n- Travel within the city is included\n\nQuestions? {{me.email}} · {{me.phone}}' },
    { id: 'brief', emoji: '🎯', name: 'Project brief', about: 'Agree on goals, scope and deadlines up front.', title: 'Project brief – {{client.name}}',
      body: '# Project brief\n\nClient: {{client.name}}\nContact: {{client.contact}}\nDate: {{today}}\n\n# Background\n\nWhy this project, and why now.\n\n# Goals\n\n- What success looks like\n\n# In scope\n\n- …\n\n# Not in scope\n\n- …\n\n# Deliverables and deadlines\n\n- …\n\n# Budget\n\n…\n\n# Who decides\n\n…' },
    { id: 'meeting', emoji: '🗣️', name: 'Meeting notes', about: 'What was said, what was agreed, who does what.', title: 'Meeting notes {{client.name}} – {{today}}',
      body: '# Meeting with {{client.name}}\n\n{{today}} · with {{client.contact}} and {{me.name}}\n\n# What we talked about\n\n- …\n\n# What we agreed\n\n- …\n\n# Next steps\n\n- {{me.name}}: …\n- {{client.contact}}: …\n\nNext meeting: …' },
    { id: 'blank', emoji: '📄', name: 'Blank page', about: 'Just your letterhead and a blinking cursor.', title: 'Untitled document', body: '' },
  ];

  BW.boot({
    app: 'docs',
    onReady: async () => { await load(); route(); },
    onChange: async () => { await load(); if (!cur) showHome(); },
  });
  addEventListener('hashchange', async () => { await flush(); route(); });

  async function load() { [docs, clients, custom] = await Promise.all(['documents', 'clients', 'doctemplates'].map((n) => BW.store.all(n))); }
  function route() {
    const [a, b] = location.hash.slice(1).split('/');
    const d = a === 'edit' && docs.find((x) => x.id === b);
    if (d) { cur = JSON.parse(JSON.stringify(d)); drawEditor(); } else { cur = null; showHome(); }
  }

  // {{client.name}}, {{me.business}}, {{today}} … become real details. Unknown ones are left visible.
  function fill(text, client) {
    const s = BW.settings, c = client || {};
    const me = { name: s.ownerName || s.businessName, business: s.businessName, email: s.email, phone: s.phone, address: s.address, postcode: s.postcode, city: s.city, iban: s.iban, paymentDays: s.paymentDays, website: s.website };
    return text.replace(/\{\{(\w+)\.?(\w*)\}\}/g, (all, a, b) => {
      if (a === 'today') return BW.fmtDate(BW.today(), { day: 'numeric', month: 'long', year: 'numeric' });
      const src = a === 'client' ? c : a === 'me' ? me : null;
      return src && src[b] != null ? String(src[b]) : (a === 'client' ? '' : all);
    }).replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').replace(/^\s*\n/, '');
  }

  function showHome() {
    const all = TEMPLATES.concat(custom.map((t) => Object.assign({ emoji: '⭐', about: 'Your own template' }, t, { mine: true })));
    const recent = docs.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    main.innerHTML = `
      <div class="page-head"><div><h1><span class="title-emo">📝</span> Document Maker</h1><p class="lead">Pick a template. We fill in the names and addresses, you add the good bits.</p></div></div>
      <h2 style="margin-bottom:14px">Start something new</h2>
      <div class="tpl-grid rise">${all.map((t) => `<button class="card tpl" data-t="${t.id}"><span class="e">${esc(t.emoji)}</span><b>${esc(t.name)}</b><small>${esc(t.about)}</small></button>`).join('')}</div>
      ${recent.length ? `<h2 style="margin-bottom:14px">Your documents</h2><div class="list rise" style="padding-bottom:40px">${recent.map((d) => `
        <div class="row" data-id="${d.id}" tabindex="0"><span style="font-size:1.4rem">${esc((all.find((t) => t.id === d.templateId) || { emoji: '📄' }).emoji)}</span>
          <span class="main"><b>${esc(d.title || 'Untitled')}</b><small>${d.clientId ? esc((clients.find((c) => c.id === d.clientId) || {}).name || '') + ' · ' : ''}Edited ${BW.fmtDate((d.updatedAt || '').slice(0, 10))}</small></span></div>`).join('')}</div>` : ''}`;
    $$('[data-t]', main).forEach((b) => b.onclick = () => start(all.find((t) => t.id === b.dataset.t)));
    $$('.row[data-id]', main).forEach((r) => { r.onclick = () => { location.hash = '#edit/' + r.dataset.id; }; r.onkeydown = (e) => { if (e.key === 'Enter') r.click(); }; });
  }

  function start(t) {
    const make = async (client) => {
      const d = { templateId: t.id, clientId: client ? client.id : '', title: fill(t.title || t.name, client).trim(), body: fill(t.body || '', client), legal: !!t.legal };
      try { await BW.store.put('documents', d); } catch (e) { return BW.error(e); }
      docs.push(d); location.hash = '#edit/' + d.id;
    };
    if (t.id === 'blank' || !clients.length) return make(null);
    const m = BW.modal({
      title: `${esc(t.emoji)} Who is it for?`,
      body: `<div class="list">${clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<div class="row" data-c="${c.id}" tabindex="0"><span class="avatar" style="--av:${BW.colorFor(c.name)};width:36px;height:36px">${esc(BW.initials(c.name))}</span><span class="main"><b>${esc(c.name)}</b><small>${esc(c.contact || c.city || '')}</small></span></div>`).join('')}</div>`,
      actions: [{ label: 'Nobody in particular', kind: 'ghost', onClick: () => { make(null); } }],
    });
    $$('[data-c]', m.el).forEach((r) => r.onclick = () => { m.close(); make(clients.find((c) => c.id === r.dataset.c)); });
  }

  // ---------- editor ----------
  function drawEditor() {
    const s = BW.settings;
    main.innerHTML = `
      <div class="doc-editor">
        <div><a class="btn btn-ghost" href="#" style="margin:0 0 12px -10px">← All documents</a>
          <div class="sheet" style="--doc:${esc(s.brandColor || '#FF6B4A')}">
            <div class="head">${s.logo ? `<img src="${s.logo}" alt="">` : `<span class="biz">${esc(s.businessName)}</span>`}<small class="faint">${esc([s.email, s.phone].filter(Boolean).join(' · '))}</small></div>
            <input class="title" data-title value="${esc(cur.title)}" aria-label="Document title">
            <textarea data-body aria-label="Document text" placeholder="Start typing…">${esc(cur.body)}</textarea>
          </div></div>
        <aside class="side">
          <div class="card" style="padding:16px"><div class="save-state" data-saved>All changes saved</div></div>
          ${cur.legal ? '<div class="warn">⚖️ <b>Not legal advice.</b> This template covers the basics. For anything big, have a lawyer look at it.</div>' : ''}
          <button class="btn btn-primary btn-big btn-block" data-pdf>📄 Save as PDF</button>
          <div class="insert-wrap"><button class="btn btn-block" data-insert>🔤 Insert a detail</button><div class="insert-menu card" data-menu hidden></div></div>
          <button class="btn btn-block" data-copy>📋 Copy the text</button>
          <button class="btn btn-block" data-tpl>⭐ Save as my template</button>
          <div class="row-flex" style="justify-content:center"><button class="btn btn-ghost" data-dup>📑 Duplicate</button><button class="btn btn-ghost btn-danger" data-del>🗑️ Delete</button></div>
          <div class="card tips"><b>Little tricks</b><br><code># Title</code> makes a heading<br><code>- item</code> makes a bullet point<br>The PDF gets your logo and colour.</div>
        </aside>
      </div>`;
    const save = BW.debounce(flush, 600);
    const touch = () => { dirty = true; $('[data-saved]', main).textContent = 'Saving…'; save(); };
    $('[data-title]', main).oninput = (e) => { cur.title = e.target.value; touch(); };
    $('[data-body]', main).oninput = (e) => { cur.body = e.target.value; touch(); };
    $('[data-pdf]', main).onclick = savePdf;
    // Insert any business or client detail at the cursor, like PandaDoc's variables, but filled in straight away.
    const menu = $('[data-menu]', main), body = $('[data-body]', main);
    let caret = 0;
    body.addEventListener('blur', () => { caret = body.selectionStart; });
    $('[data-insert]', main).onclick = () => {
      const s = BW.settings, c = clients.find((x) => x.id === cur.clientId) || {};
      const items = [
        ['Today’s date', BW.fmtDate(BW.today(), { day: 'numeric', month: 'long', year: 'numeric' })],
        ['Client name', c.name], ['Contact person', c.contact], ['Client address', [c.address, [c.postcode, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')], ['Client email', c.email],
        ['My name', s.ownerName], ['Business name', s.businessName], ['My email', s.email], ['My phone', s.phone], ['IBAN', s.iban], ['VAT number', s.vatNumber], ['Company reg. no.', s.regNumber], ['Website', s.website],
      ].filter(([, v]) => v);
      menu.innerHTML = items.map(([l, v], i) => `<button type="button" class="menu-item" data-ins="${i}"><span><b>${esc(l)}</b><br><small>${esc(v)}</small></span></button>`).join('') || '<p class="muted" style="padding:10px">Pick a client or fill in your business details first.</p>';
      menu.hidden = !menu.hidden;
      menu.onclick = (e) => {
        const b = e.target.closest('[data-ins]'); if (!b) return;
        const v = items[Number(b.dataset.ins)][1];
        body.value = body.value.slice(0, caret) + v + body.value.slice(caret);
        cur.body = body.value; touch(); menu.hidden = true;
        body.focus(); body.setSelectionRange(caret + v.length, caret + v.length);
      };
    };
    $('[data-copy]', main).onclick = async () => { try { await navigator.clipboard.writeText(cur.body); } catch (e) { /* fall through */ } BW.toast('Copied!', '📋'); };
    $('[data-tpl]', main).onclick = async () => {
      try { await BW.store.put('doctemplates', { name: cur.title || 'My template', title: cur.title, body: cur.body }); } catch (e) { return BW.error(e); }
      BW.toast('Saved to your templates', '⭐');
    };
    $('[data-dup]', main).onclick = async () => {
      await flush();
      const d = { templateId: cur.templateId, clientId: cur.clientId, title: cur.title + ' (copy)', body: cur.body, legal: cur.legal };
      try { await BW.store.put('documents', d); } catch (e) { return BW.error(e); }
      docs.push(d); location.hash = '#edit/' + d.id; BW.toast('Copied', '📑');
    };
    $('[data-del]', main).onclick = async () => {
      dirty = false;
      const gone = JSON.parse(JSON.stringify(cur));
      cur = null; location.hash = '';
      await BW.removeWithUndo('documents', gone, esc(gone.title || 'Document'), async () => { await load(); if (!cur) showHome(); });
    };
  }

  async function flush() {
    if (!cur || !dirty) return;
    dirty = false;
    try { await BW.store.put('documents', cur); const el = $('[data-saved]', main); if (el) el.textContent = 'All changes saved ✓'; }
    catch (e) { dirty = true; BW.error(e); }
  }

  function savePdf() {
    const s = BW.settings, d = new BW.pdf.Doc(), W = d.W, H = d.H, M = 60, accent = s.brandColor || '#FF6B4A';
    let y = 54, page = 1;
    const footer = () => {
      d.line(M, H - 48, W - M, H - 48, { color: '#E6E3EE' });
      d.text([s.businessName, s.email, s.phone, s.website].filter(Boolean).join('  ·  '), M, H - 32, { size: 7.5, color: '#9A97AC' });
      d.text(String(page), W - M, H - 32, { size: 7.5, color: '#9A97AC', align: 'right' });
    };
    const room = (h) => { if (y + h > H - 70) { footer(); d.addPage(); page++; y = 60; } };
    d.rect(0, 0, W, 10, { fill: accent });
    if (s.logo && s.logoW) { const k = Math.min(150 / s.logoW, 48 / s.logoH); d.image(s.logo, s.logoW, s.logoH, M, y - 14, s.logoW * k, s.logoH * k); y += 50; }
    else { d.text(s.businessName, M, y + 10, { size: 16, bold: true }); y += 44; }
    for (const raw of cur.body.split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (!line) { y += 8; continue; }
      if (line.startsWith('# ')) {
        room(30); y += 10;
        d.wrap(line.slice(2), W - 2 * M, 13, true).forEach((l) => { d.text(l, M, y, { size: 13, bold: true, color: '#1E1B2E' }); y += 17; });
        y += 2; continue;
      }
      const bullet = /^[-*] /.test(line);
      const text = bullet ? line.slice(2) : line, x = bullet ? M + 14 : M;
      d.wrap(text, W - M - x, 10.5).forEach((l, i) => {
        room(15);
        if (bullet && !i) d.rect(M + 3, y - 5, 4, 4, { fill: accent, r: 2 });
        d.text(l, x, y, { size: 10.5, color: '#2B2840' }); y += 15;
      });
    }
    footer();
    const name = BW.fileSafe(cur.title || 'Document') + '.pdf';
    BW.store.writeFile(`Documents/${BW.today().slice(0, 4)}/${name}`, d.blob(cur.title))
      .then((r) => BW.toast(r.saved ? `Saved to ${esc(r.where)}` : `${esc(name)} is in your Downloads`, '📄'))
      .catch(BW.error);
  }
})();
