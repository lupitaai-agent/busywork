/* Marketing Studio: plan, make, measure. Every AI request = the marketing foundation + one skill's
   playbook + this brand's profile and house rules. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const M = BW.mkt, L = BW.mktLibrary;
  const main = $('#main');
  const GROUPS = [['strategy', '🧭 Strategy & research', ['strategy', 'research']], ['create', '✍️ Create', ['create']], ['reach', '📣 Reach & sell', ['reach']], ['search', '🔎 Search & website', ['search']], ['measure', '📊 Measure & improve', ['measure']]];
  const TABS = [['home', '🏠 Overview'], ['insights', '📊 Insights'], ['plan', '🗓️ Plan'], ['content', '✍️ Content'], ['skills', '🛠️ Skills'], ['profile', '🧭 Brand profile'], ['learn', '📚 Learn']];
  let p = null, plan = [], runs = [], waves = [], invoices = [], tab = 'home', skillId = null, query = '';
  let olafProfile = ''; // Olaf's growth profile, used when the Studio's own profile is still empty
  const threads = {}; // skill id → { messages (API format), view: [{ role, text, cost, saved }] }

  BW.boot({
    app: 'marketing',
    onReady: async () => {
      await load();
      if (!p.onboarded && !olafProfile) return onboarding();
      render();
      BW.route({ skill: (id) => openSkill(id), tab: (t) => { tab = t; skillId = null; render(); } });
    },
    onChange: async (name) => { if (['mktplan', 'mktruns', 'mktwaves', 'mktnumbers', 'mktcontent', 'mktsettings', 'olaf-files', 'invoices', 'clients'].includes(name)) { await load(); if (!skillId) render(); } },
  });
  BW.shortcut('k', 'Skills', () => { tab = 'skills'; skillId = null; render(); });

  async function load() {
    if (BW.pm) await BW.pm.linkMarketing().catch((e) => console.warn('Marketing link skipped', e)); // actions and posts are tasks in the Project Planner too
    const [prof, pl, rn, wv, inv, of] = await Promise.all(['mktprofile', 'mktplan', 'mktruns', 'mktwaves', 'invoices', 'olaf-files'].map((n) => BW.store.all(n)));
    const g = of.find((f) => f.path === 'brand-documents/brand-growth-profile.md');
    olafProfile = g && ((g.content.match(/\[FILL/g) || []).length < 8) ? g.content : '';
    p = Object.assign(M.blank(), prof[0] || {});
    plan = pl; runs = rn.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); waves = wv.sort((a, b) => (a.date || '').localeCompare(b.date || '')); invoices = inv;
  }
  const saveProfile = BW.debounce(async (note) => {
    try { await BW.store.put('mktprofile', p); } catch (e) { BW.error(e); }
  }, 500);
  const skill = (id) => L.skills.find((s) => s.id === id);
  const layer = (s) => s.body.split('\n## Playbook')[0];

  const md = BW.md;

  // ---------- frame ----------
  function render() {
    if (skillId) return renderSkill();
    main.innerHTML = `
      <div class="page-head" style="padding-bottom:10px">
        <div><h1><span class="title-emo">📣</span> Marketing Studio</h1><p class="lead">Do your own marketing: plan it, make it, measure it. Built on proven marketing science.</p></div>
        <div class="spacer"></div>
        <button class="btn" data-ai>${BW.ai.ready() ? '🤖 AI is on' : '🔌 Connect AI'}</button>
      </div>
      <div class="studio-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      <div data-view></div>`;
    $$('[data-tab]', main).forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
    $('[data-ai]', main).onclick = aiSettings;
    const v = $('[data-view]', main);
    const views = { home: viewHome, skills: viewSkills, plan: viewPlan, insights: viewInsights, monitor: viewInsights, content: viewContent, profile: viewProfile, learn: viewLearn };
    (views[tab] || viewHome)(v);
  }

  // ---------- overview ----------
  function viewHome(v) {
    let pct = M.completeness(p), pri = p.ceps.filter((c) => c.priority), keep = p.assets.filter((a) => a.commit);
    if (!p.onboarded && olafProfile) {
      // Set up with Olaf: read the starred moments and committed assets from its growth profile.
      const lines = olafProfile.split('\n');
      pct = 100;
      pri = lines.filter((l) => /^- ★/.test(l)).map((l) => ({ text: l.replace(/^- ★\s*/, '').split(/"?\s*\(/)[0].replace(/^"|"$/g, '') }));
      keep = lines.filter((l) => /^- ✔/.test(l)).map((l) => { const m = l.replace(/^- ✔\s*/, '').replace(/\s*\(.*$/, ''); const [type, ...rest] = m.split(':'); return { type: type.trim(), name: rest.join(':').trim() }; });
    }
    const pres = presence(), buyers = buyerStats();
    const next = [];
    if (!BW.ai.ready()) next.push(['🔌', 'Connect your Claude key', 'Needed to run skills. Your key stays on this device.', aiSettings]);
    const fromOlaf = !p.onboarded && !!olafProfile;
    if (pct < 80 && !fromOlaf) next.push(['🧭', 'Finish your brand profile', `${pct}% done. Every skill gets better with it.`, () => { tab = 'profile'; render(); }]);
    if (pri.length < 3 && !fromOlaf) next.push(['🚪', 'Pick your priority buying moments', 'Star 3 to 5 moments to focus on.', () => { tab = 'profile'; render(); }]);
    if (!plan.length) next.push(['🗺️', 'Make your always-on plan', 'A year of steady presence, within your budget.', () => openSkill('marketing-plan')]);
    if (pres.gaps >= 3 && plan.length) next.push(['🕳️', `Fill ${pres.gaps} empty months`, 'Buyers enter the market all year. Stay visible.', () => { tab = 'plan'; render(); }]);
    if (!runs.some((r) => r.skillId === 'local-presence')) next.push(['📍', 'Check your local presence', 'Often the cheapest growth: be easy to find and choose.', () => openSkill('local-presence')]);
    if (!waves.length || ageDays(waves[waves.length - 1].date) > 180) next.push(['🩺', 'Measure how often you come to mind', 'A short survey among local buyers, once or twice a year.', () => { tab = 'monitor'; render(); }]);
    next.push(['🧐', 'Check an ad or post before it goes out', 'Nine checks against what makes marketing work.', () => openSkill('creative-check')]);
    v.innerHTML = `
      ${!p.onboarded && olafProfile ? `<div class="idea rise" style="margin-bottom:18px"><span class="e">🧭</span><div><b>Your brand profile comes from Olaf.</b> You set up your marketing with Olaf, so the Studio's playbooks use that profile. You can also fill in the Studio's own profile under Brand profile.</div></div>` : ''}
      <div class="grid-cards rise" style="margin-bottom:22px">
        <div class="card pcard"><h3>🧭 Brand profile</h3><div class="meter"><i style="width:${pct}%"></i></div><p>${pct}% complete</p></div>
        <div class="card pcard"><h3>🚪 Priority moments</h3>${pri.length ? `<div class="tagrow">${pri.map((c) => `<span class="tag star">${esc(c.text)}</span>`).join('')}</div>` : '<p>None starred yet.</p>'}</div>
        <div class="card pcard"><h3>🎨 Always-use assets</h3>${keep.length ? `<div class="tagrow">${keep.map((a) => `<span class="tag">${esc(a.type)}: ${esc(a.name)}</span>`).join('')}</div>` : '<p>Choose 2 to 4 in your profile.</p>'}</div>
        <div class="card pcard"><h3>🗓️ Presence</h3><p class="big-num">${pres.active}/12</p><p>months with marketing in the past and coming year view</p></div>
        <div class="card pcard"><h3>🆕 New customers</h3><p class="big-num">${buyers.newThisYear}</p><p>this year, from your invoices. Growth comes from more buyers.</p></div>
        <div class="card pcard"><h3>🤖 AI this month</h3><p class="big-num">$${BW.ai.spentThisMonth().toFixed(2)}</p><p>${BW.ai.cap ? `of your $${BW.ai.cap} limit` : 'no limit set'} · ${esc(BW.ai.model.model)}</p></div>
      </div>
      <h2 style="margin-bottom:12px">👉 Next best steps</h2>
      <div class="next rise">${next.slice(0, 6).map(([e, t, s], i) => `<button data-next="${i}"><span class="e">${e}</span><span><b>${t}</b><small>${s}</small></span></button>`).join('')}</div>
      <h2 style="margin:28px 0 12px">📊 Your marketing dashboard <small class="faint" style="font-size:.85rem;font-weight:600">the same plan, numbers and work Olaf uses</small></h2>
      <div class="dash" data-dash><p class="faint">Loading…</p></div>
      <h2 style="margin:28px 0 12px">⚡ Popular skills</h2>
      <div class="skill-grid">${['marketing-plan', 'local-presence', 'social-media', 'copywriting', 'ad-creative', 'creative-check'].map(skillCard).join('')}</div>
      <aside class="card olaf-card rise">
        <span class="e">🧭</span>
        <div><b>Rather have an expert guide you?</b>
          <p>The Studio is do-it-yourself. Olaf, our AI expert for marketing and projects, works out where you stand, plans your next 90 days, checks in every week and does the work with you. Same marketing science, and it starts from this brand profile.</p></div>
        <div class="row-flex"><a class="btn btn-primary" data-olaf href="../olaf/index.html">Meet Olaf →</a></div>
      </aside>
      <div style="height:40px"></div>`;
    $$('[data-next]', v).forEach((b) => b.onclick = () => next[Number(b.dataset.next)][3]());
    const ol = $('[data-olaf]', v);
    if (ol) BW.olafInstalled().then((ed) => { if (!ed) { ol.href = BW.olafPage(); ol.target = '_blank'; ol.rel = 'noopener'; } else if (ed === 'full') ol.textContent = 'Open Olaf →'; });
    const dash = $('[data-dash]', v);
    BW.mktDash.load().then((d) => {
      if (!dash.isConnected) return;
      dash.innerHTML = BW.mktDash.planHtml(d, { planLink: '#tab/plan' }) + BW.mktDash.numbersHtml(d) + BW.mktDash.workHtml(d, { olafLink: '../olaf/index.html' });
      BW.mktDash.bind(dash, d, async () => { await load(); render(); });
    }).catch(BW.error);
    $$('[data-skill]', v).forEach((b) => b.onclick = () => openSkill(b.dataset.skill));
  }
  const ageDays = (iso) => (Date.now() - Date.parse(iso)) / 864e5;

  // ---------- skills ----------
  function skillCard(id) {
    const s = typeof id === 'string' ? skill(id) : id;
    return `<button class="card skill" data-skill="${s.id}"><span class="e">${s.emoji}</span><span><b>${esc(s.name)}</b><small>${esc(s.summary)}</small>${p.skillNotes[s.id] ? '<span class="tailored">✨ tailored to you</span>' : ''}</span></button>`;
  }
  function viewSkills(v) {
    const q = query.toLowerCase();
    const match = (s) => !q || (s.name + ' ' + s.summary + ' ' + s.id).toLowerCase().includes(q);
    v.innerHTML = `
      <div class="row-flex" style="margin-bottom:6px"><label class="search" style="flex:1;max-width:420px"><input class="in" type="search" data-q placeholder="Find a skill: ads, reviews, Google, newsletter…" value="${esc(query)}" aria-label="Find a skill"></label>
        <small class="faint">${L.skills.length} skills, all working from your brand profile</small></div>
      <div class="skill-groups">${GROUPS.map(([k, label, gs]) => { const list = L.skills.filter((s) => gs.includes(s.group) && match(s)); return list.length ? `<h2>${label}</h2><div class="skill-grid">${list.map(skillCard).join('')}</div>` : ''; }).join('')}</div>
      ${runs.length ? `<h2 style="margin:30px 0 12px">💾 Saved results</h2><div class="list">${runs.slice(0, 20).map((r) => `<div class="row" data-run="${r.id}" tabindex="0"><span style="font-size:1.3rem">${(skill(r.skillId) || {}).emoji || '📄'}</span><span class="main"><b>${esc(r.title)}</b><small>${esc((skill(r.skillId) || {}).name || '')} · ${BW.fmtDate((r.createdAt || '').slice(0, 10))}</small></span></div>`).join('')}</div>` : ''}
      <div style="height:40px"></div>`;
    const qi = $('[data-q]', v);
    qi.oninput = BW.debounce(() => { query = qi.value; viewSkills(v); const n = $('[data-q]', v); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 150);
    $$('[data-skill]', v).forEach((b) => b.onclick = () => openSkill(b.dataset.skill));
    $$('[data-run]', v).forEach((r) => r.onclick = () => showRun(runs.find((x) => x.id === r.dataset.run)));
  }

  function openSkill(id) {
    if (!skill(id)) return BW.toast('That skill doesn\'t exist', '🤔');
    skillId = id; render(); window.scrollTo(0, 0);
  }

  function renderSkill() {
    const s = skill(skillId), t = threads[s.id] = threads[s.id] || { messages: [], view: [] };
    main.innerHTML = `
      <div style="padding-top:18px"><button class="btn btn-ghost" data-back style="margin-left:-10px">← All skills</button></div>
      <div class="page-head" style="padding-top:6px"><div><h1>${s.emoji} ${esc(s.name)}</h1><p class="lead">${esc(s.summary)}</p></div></div>
      <div class="runner">
        <div>
          <div class="thread" data-thread>${t.view.length ? t.view.map(bubble).join('') : `<div class="card pcard"><b>How to start</b><p style="margin-top:6px">${esc(s.ask)}</p></div>`}</div>
          <form class="card composer" data-send>
            ${t.view.length ? '' : `<div class="starters">${s.starters.map((x) => `<button type="button" data-starter>${esc(x)}</button>`).join('')}</div>`}
            <textarea class="in" data-input placeholder="${esc(t.view.length ? 'Ask a follow-up, or say what to change…' : s.ask)}" aria-label="Your request"></textarea>
            <div class="row-flex">${s.web ? `<label class="toggle" style="font-size:.88rem"><input type="checkbox" data-web checked> 🔎 Allow web search</label>` : ''}
              <div class="spacer"></div><small class="faint">${esc(BW.ai.model.model)} · ⌘↵ to send</small>
              ${t.view.length ? '<button type="button" class="btn btn-ghost" data-reset>🧹 New conversation</button>' : ''}
              <button class="btn btn-primary" data-go>Send ✨</button></div>
          </form>
        </div>
        <aside class="side-info">
          <div class="card"><b>🔬 How this skill works for you</b><div class="md" style="margin-top:8px;font-size:.88rem">${md(layer(s).replace(/^## /gm, '#### '))}</div></div>
          <div class="card"><b>✨ Your house rules for this skill</b><p class="faint" style="font-size:.82rem;margin:4px 0 8px">Added to every request. Tailor them to your brand.</p>
            <textarea class="in" data-rules placeholder="e.g. Always mention we fix bikes while you wait. Never use exclamation marks.">${esc(p.skillNotes[s.id] || '')}</textarea>
            <button type="button" class="btn" data-tailor style="margin-top:8px">✨ Tailor this skill to my brand</button></div>
          <a class="card olaf-side" data-olaf href="../olaf/index.html"><b>🧭 Rather have this done for you?</b><small>Olaf runs this skill with you every week, remembers the results and keeps your plan up to date.</small></a>
          <div class="card"><small class="faint">Source: ${esc(s.source)}. Every answer follows the Studio's marketing foundation and your brand profile.</small></div>
        </aside>
      </div>`;
    $('[data-back]', main).onclick = () => { skillId = null; tab = 'skills'; render(); };
    const input = $('[data-input]', main), form = $('[data-send]', main);
    $$('[data-starter]', main).forEach((b) => b.onclick = () => { input.value = b.textContent; input.focus(); });
    input.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = (e) => { e.preventDefault(); send(s, input.value); };
    const reset = $('[data-reset]', main); if (reset) reset.onclick = () => { delete threads[s.id]; renderSkill(); };
    $('[data-rules]', main).oninput = (e) => { p.skillNotes[s.id] = e.target.value; saveProfile(); };
    $('[data-tailor]', main).onclick = (e) => tailor(s, e.target);
    bindBubbles();
    const os = $('.olaf-side', main);
    if (os) BW.olafInstalled().then((ed) => { if (!ed) { os.href = BW.olafPage(); os.target = '_blank'; os.rel = 'noopener'; } });
  }

  function bubble(m, i) {
    if (m.role === 'user') return `<div class="bubble me">${esc(m.text)}</div>`;
    return `<div class="bubble" data-i="${i}"><div class="md" data-md>${md(m.text)}</div>
      ${m.pending ? `<div class="status" data-status><span class="dots3">${esc(m.status || 'Thinking')}</span></div>` : `<div class="meta">
        <button class="btn" data-act="copy">📋 Copy</button><button class="btn" data-act="save">${m.saved ? '✅ Saved' : '💾 Save'}</button>
        <button class="btn" data-act="doc">📝 To documents</button>${/```json/.test(m.text) ? '<button class="btn" data-act="plan">🗓️ Add to plan</button>' : ''}
        ${skillId !== 'creative-check' ? '<button class="btn" data-act="check">🧐 Check it</button>' : ''}<button class="btn" data-act="learn">📌 Remember a learning</button>
        <span class="spacer"></span><span>≈ $${(m.cost || 0).toFixed(3)}</span></div>`}</div>`;
  }
  function bindBubbles() {
    $$('.bubble[data-i] [data-act]', main).forEach((b) => b.onclick = () => {
      const t = threads[skillId], m = t.view[Number(b.closest('[data-i]').dataset.i)];
      ({ copy: () => copy(m.text), save: () => saveRun(m, b), doc: () => toDocs(m), plan: () => importPlan(m.text), check: () => { const tt = threads['creative-check'] = { messages: [], view: [] }; openSkill('creative-check'); send(skill('creative-check'), 'Check this:\n\n' + m.text); return tt; }, learn: () => addLearning() })[b.dataset.act]();
    });
  }

  function systemFor(s) {
    const rules = (p.skillNotes[s.id] || '').trim();
    return [
      { type: 'text', text: L.foundation },
      { type: 'text', text: `# Playbook: ${s.name}\n\n${s.body}` },
      { type: 'text', text: `# Brand Profile\n\n${p.onboarded || !olafProfile ? M.text(p) : olafProfile}${rules ? `\n\n# House rules for this skill (from the owner)\n\n${rules}` : ''}\n\nToday is ${BW.today()}.` },
    ];
  }

  async function send(s, text) {
    text = (text || '').trim();
    if (!text) return;
    if (!BW.ai.ready()) return aiSettings();
    const t = threads[s.id];
    t.messages.push({ role: 'user', content: text });
    t.view.push({ role: 'user', text });
    const reply = { role: 'assistant', text: '', pending: true, status: 'Thinking' };
    t.view.push(reply);
    renderSkill();
    const box = $$('.bubble[data-i]', main).pop();
    const paint = BW.debounce(() => { const el = $('[data-md]', box); if (el) el.innerHTML = md(reply.text); }, 80);
    const web = $('[data-web]', main);
    try {
      const r = await BW.ai.run({
        system: systemFor(s), messages: t.messages, web: web ? web.checked : false,
        onText: (chunk) => { reply.text += chunk; reply.status = 'Writing'; paint(); const st = $('[data-status] span', box); if (st) st.textContent = 'Writing'; },
        onStatus: (msg) => { const st = $('[data-status] span', box); if (st) st.textContent = msg; },
      });
      t.messages.push({ role: 'assistant', content: r.content });
      Object.assign(reply, { pending: false, cost: r.cost, text: r.text || reply.text });
    } catch (e) {
      t.messages.pop();
      Object.assign(reply, { pending: false, text: `😬 ${e.message}` });
    }
    if (skillId === s.id) { renderSkill(); const last = $$('.bubble[data-i]', main).pop(); if (last) last.scrollIntoView({ block: 'nearest' }); }
  }

  // Writes house rules that adapt one skill to this brand, inside the foundation.
  async function tailor(s, btn) {
    if (!BW.ai.ready()) return aiSettings();
    btn.disabled = true; btn.textContent = '✨ Tailoring…';
    try {
      const r = await BW.ai.run({
        system: systemFor(s),
        messages: [{ role: 'user', content: `Write 5 to 8 short house rules that adapt the "${s.name}" playbook to this specific business: its voice, buying moments, distinctive assets, area, budget and barriers. Rules must stay within the marketing laws. Bullet points only, no intro.` }],
        maxTokens: 2000,
      });
      p.skillNotes[s.id] = r.text.trim();
      p.changelog.push({ date: BW.today(), text: `Tailored skill: ${s.name}` });
      await BW.store.put('mktprofile', p);
      BW.toast(`${esc(s.name)} now knows your brand`, '✨');
    } catch (e) { BW.error(e); }
    renderSkill();
  }

  async function copy(text) { BW.toast(await BW.copy(text) ? 'Copied!' : 'Could not copy. Select the text and copy it yourself.', '📋'); }
  async function saveRun(m, btn) {
    const title = (m.text.match(/^#+ (.+)$/m) || [null, (threads[skillId].view.find((x) => x.role === 'user') || {}).text || 'Result'])[1].slice(0, 80);
    try { await BW.store.put('mktruns', { skillId, title, text: m.text, cost: m.cost, model: BW.ai.model.id }); m.saved = true; btn.textContent = '✅ Saved'; await load(); BW.toast('Saved in your Studio', '💾'); } catch (e) { BW.error(e); }
  }
  async function toDocs(m) {
    const title = (m.text.match(/^#+ (.+)$/m) || [null, `${skill(skillId).name} – ${BW.fmtDate(BW.today())}`])[1].slice(0, 90);
    try {
      const d = { templateId: 'blank', clientId: '', title, body: m.text.replace(/\*\*/g, '').replace(/^#{2,4} /gm, '# '), legal: false };
      await BW.store.put('documents', d);
      BW.toast('Saved in the Document Maker', '📝', { label: 'Open', run: () => { location.href = `../docs/index.html#edit/${d.id}`; } });
    } catch (e) { BW.error(e); }
  }
  function addLearning() {
    BW.modal({
      title: '📌 Remember a learning',
      body: '<p class="muted" style="margin-bottom:10px">What did you learn? Every skill reads your learnings, so the Studio gets smarter about your business.</p><textarea class="in" data-l placeholder="e.g. Saturday morning posts get the most booking clicks"></textarea>',
      actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
        const v = $('.modal [data-l]').value.trim(); if (!v) return false;
        p.learnings.push({ date: BW.today(), text: v });
        try { await BW.store.put('mktprofile', p); BW.toast('Learning saved', '📌'); } catch (e) { BW.error(e); return false; }
      } }],
    });
  }
  function showRun(r) {
    BW.modal({ title: `${(skill(r.skillId) || {}).emoji || '📄'} ${esc(r.title)}`, wide: true, body: `<div class="md">${md(r.text)}</div>`,
      actions: [{ label: '🗑️ Delete', kind: 'ghost', onClick: async () => { await BW.removeWithUndo('mktruns', r, 'Result', async () => { await load(); render(); }); } }, { label: '📋 Copy', onClick: () => { copy(r.text); return false; } }, { label: 'Close', kind: 'primary' }] });
  }

  // ---------- plan ----------
  const months = () => { const start = BW.today().slice(0, 7) + '-01'; return Array.from({ length: 12 }, (_, i) => BW.addPeriod(start, 'month', i).slice(0, 7)); };
  function presence() {
    const ms = months(); const active = ms.filter((m) => plan.some((a) => (a.month || '').slice(0, 7) === m || (a.months || []).includes(m)));
    return { active: active.length, gaps: 12 - active.length, months: ms };
  }
  function viewPlan(v) {
    const ms = months(), channels = [...new Set(plan.map((a) => a.channel || 'Other'))].sort();
    const inMonth = (a, m) => (a.month || '').slice(0, 7) === m;
    const pres = presence();
    const cost = plan.filter((a) => ms.includes((a.month || '').slice(0, 7))).reduce((t, a) => t + BW.num(a.cost), 0);
    v.innerHTML = `
      <div class="row-flex" style="margin-bottom:16px"><div><b>Present in ${pres.active} of the next 12 months</b><br><small class="faint">Red months have no marketing yet. Buyers enter the market every month.</small></div>
        <div class="spacer"></div><span class="chip chip-grey">Planned spend ${BW.money(cost)}</span>
        <button class="btn" data-genplan>✨ Make a plan with AI</button><button class="btn btn-primary" data-add>＋ Add activity</button></div>
      <div class="card pcard yeargrid"><table>
        <tr><th></th>${ms.map((m) => `<th>${BW.fmtDate(m + '-01', { month: 'short' })}<br><small>${m.slice(0, 4)}</small></th>`).join('')}</tr>
        ${(channels.length ? channels : ['Your activities']).map((ch) => `<tr><td class="ch">${esc(ch)}</td>${ms.map((m) => { const acts = plan.filter((a) => (a.channel || 'Other') === ch && inMonth(a, m)); const empty = !plan.some((a) => inMonth(a, m)); return `<td class="${empty ? 'gap' : ''}" data-m="${m}" data-ch="${esc(ch)}">${acts.map((a) => `<button class="act ${a.status || ''}" data-act="${a.id}" title="${esc(a.title)}">${esc(a.title)}</button>`).join('')}</td>`; }).join('')}</tr>`).join('')}
      </table></div>
      <p class="faint" style="margin:10px 0 40px;font-size:.88rem">💡 Click an empty cell to add something there. A little every month beats one big burst: most of your future buyers aren't looking yet.</p>`;
    $('[data-add]', v).onclick = () => editActivity({ month: ms[0], status: 'planned' });
    $('[data-genplan]', v).onclick = () => { openSkill('marketing-plan'); const i = $('[data-input]', main); if (i) i.value = 'Make my always-on marketing plan for the next 12 months. End with a JSON code block listing the activities as [{"title":"","channel":"","month":"YYYY-MM","cost":0,"cep":""}].'; };
    $$('[data-act]', v).forEach((b) => b.onclick = (e) => { e.stopPropagation(); editActivity(plan.find((a) => a.id === b.dataset.act)); });
    $$('td[data-m]', v).forEach((td) => td.onclick = () => editActivity({ month: td.dataset.m, channel: td.dataset.ch === 'Your activities' ? '' : td.dataset.ch, status: 'planned' }));
  }
  function editActivity(a) {
    BW.recordDrawer({
      collection: 'mktplan', rec: a, title: 'Activity', newTitle: 'New activity',
      fields: [
        { k: 'title', label: 'What is it?', ph: 'e.g. Spring check-up ad on Instagram', span: 2 },
        { k: 'channel', label: 'Channel', ph: 'e.g. Meta ads, Google Business Profile, local paper' },
        { k: 'month', label: 'Month', type: 'month' },
        { k: 'status', label: 'Status', type: 'chips', options: [['planned', '🗓️ Planned'], ['live', '🔴 Live'], ['done', '✅ Done']] },
        { k: 'cost', label: 'Cost', type: 'money', ph: '0' },
        { k: 'reach', label: 'People reached (estimate)', type: 'number', ph: 'e.g. 5000' },
        { k: 'cep', label: 'Buying moment it links to', type: 'select', options: [['', '—']].concat(p.ceps.map((c) => [c.text, (c.priority ? '★ ' : '') + c.text])), span: 2 },
        { k: 'notes', label: 'Notes and results', type: 'textarea', span: 2, ph: 'What happened? Any learning?' },
      ],
      onClose: async () => { await load(); render(); },
    });
  }
  async function importPlan(text) {
    const m = text.match(/```json\s*([\s\S]*?)```/);
    let list;
    try { list = JSON.parse(m[1]); } catch (e) { return BW.toast('Could not read the plan list in this answer', '🤔'); }
    list = (Array.isArray(list) ? list : list.activities || []).filter((a) => a && a.title).map((a) => ({ title: String(a.title).slice(0, 120), channel: a.channel || '', month: String(a.month || '').slice(0, 7), cost: BW.num(a.cost), cep: a.cep || '', status: 'planned', fromAI: true }));
    if (!list.length) return BW.toast('No activities found in this answer', '🤔');
    try { await BW.store.putMany('mktplan', list); await load(); } catch (e) { return BW.error(e); }
    BW.toast(`${list.length} activities added to your plan`, '🗓️', { label: 'Show', run: () => { skillId = null; tab = 'plan'; render(); } });
  }

  // ---------- monitor ----------
  function buyerStats() {
    const inv = invoices.filter((i) => i.kind === 'invoice' && i.status !== 'draft' && i.clientId);
    const first = {};
    inv.forEach((i) => { if (!first[i.clientId] || i.issueDate < first[i.clientId]) first[i.clientId] = i.issueDate; });
    const ms = Array.from({ length: 12 }, (_, k) => BW.addPeriod(BW.today().slice(0, 7) + '-01', 'month', k - 11).slice(0, 7));
    const perMonth = ms.map((m) => ({ m, active: new Set(inv.filter((i) => (i.issueDate || '').startsWith(m)).map((i) => i.clientId)).size, fresh: Object.values(first).filter((d) => d.startsWith(m)).length }));
    const year = BW.today().slice(0, 4);
    const last12 = inv.filter((i) => i.issueDate >= ms[0]);
    const byClient = {};
    last12.forEach((i) => { byClient[i.clientId] = byClient[i.clientId] || { rev: 0, n: 0 }; byClient[i.clientId].rev += BW.invoiceTotals(i).subtotal; byClient[i.clientId].n++; });
    const vals = Object.values(byClient).sort((a, b) => b.rev - a.rev), tot = vals.reduce((t, x) => t + x.rev, 0);
    const top = vals.slice(0, Math.max(1, Math.round(vals.length * 0.2))).reduce((t, x) => t + x.rev, 0);
    return { perMonth, newThisYear: Object.values(first).filter((d) => d.startsWith(year)).length, customers: vals.length, topShare: tot ? top / tot : 0, once: vals.length ? vals.filter((x) => x.n === 1).length / vals.length : 0, avg: vals.length ? last12.length / vals.length : 0 };
  }
  function bars(list, key) {
    const max = Math.max(1, ...list.map((x) => x[key]));
    return `<div class="minibars">${list.map((x) => `<div class="b" title="${x[key]}"><em>${x[key] || ''}</em><i style="height:${x[key] / max * 100}%"></i><span>${BW.fmtDate(x.m + '-01', { month: 'short' }).slice(0, 3)}</span></div>`).join('')}</div>`;
  }
  // ---------- insights and content (shared with Olaf) ----------
  // Opens a skill for the owner, with the observation or task already in the box.
  function runSkill(id, prompt) {
    openSkill(id);
    const i = $('[data-input]', main); if (i && prompt) { i.value = prompt; i.focus(); }
  }
  function aiModal(title, ask, system) {
    if (!BW.ai.ready()) return aiSettings();
    const box = BW.html('<div class="md" style="min-height:120px"><p class="faint">Thinking…</p></div>');
    BW.modal({ title, body: box, wide: true });
    let text = '';
    BW.ai.run({ system, messages: [{ role: 'user', content: ask }], onText: (t) => { text += t; box.innerHTML = BW.md(text); } })
      .then((r) => { box.insertAdjacentHTML('beforeend', `<p class="faint" style="margin-top:10px;font-size:.8rem">≈ $${r.cost.toFixed(3)} on your Claude key</p>`); })
      .catch((e) => { box.innerHTML = `<p>${esc(e.message)}</p>`; });
  }
  // The foundation and the brand profile, without a skill's playbook: for short answers about the numbers.
  const withoutPlaybook = () => { const s = systemFor(skill('marketing-plan')); return [s[0], s[2]]; };
  function viewInsights(v) {
    v.innerHTML = '<div data-ins><p class="faint">Loading…</p></div><h2 style="margin:8px 0 12px">🧠 Brand strength</h2><div data-mon></div>';
    BW.mktInsights.render($('[data-ins]', v), {
      run: runSkill,
      explain: (c, d) => aiModal('✨ Your month, explained', 'Explain my marketing month in plain words for a busy owner: what changed, what it probably means (using the marketing laws), and the two or three things to do next, each with the skill that helps. Short: under 250 words. Here are the numbers as JSON:\n\n' + JSON.stringify(BW.mktInsights.facts(c, d)), withoutPlaybook()),
    }).catch(BW.error);
    viewMonitor($('[data-mon]', v));
  }
  function viewContent(v) {
    const sys = () => systemFor(skill('social-media'));
    BW.mktContent.render(v, {
      write: (item, again, btn) => {
        if (!BW.ai.ready()) return aiSettings();
        btn.disabled = true; btn.textContent = '✨ Writing…';
        BW.ai.run({ system: sys(), messages: [{ role: 'user', content: `Write this post, ready to paste. Only the post text (and hashtags if the channel uses them), no explanation.\n\nChannel: ${item.channel || 'Instagram'}\nDate: ${item.date}\nAbout: ${item.title}${item.cep ? `\nBuying moment: ${item.cep}` : ''}` }] })
          .then(async (r) => { item.text = r.text.trim(); item.status = 'draft'; await BW.store.put('mktcontent', item); BW.toast(`Drafted (≈ $${r.cost.toFixed(3)})`, '✨'); again(); })
          .catch((e) => { BW.error(e); btn.disabled = false; btn.textContent = '✨ Write it with AI'; });
      },
      suggest: (weekStart, again, btn) => {
        if (!BW.ai.ready()) return aiSettings();
        btn.disabled = true; btn.textContent = '✨ Thinking…';
        const planNow = plan.filter((a) => (a.month || '') >= weekStart.slice(0, 7)).slice(0, 12).map((a) => `${a.month}: ${a.title} (${a.channel || 'any channel'})`).join('\n');
        BW.ai.run({ system: sys(), messages: [{ role: 'user', content: `Suggest posts for the four weeks starting ${weekStart}: a rhythm one busy person can keep (state it), linked to my buying moments and plan, using my brand assets. Answer with only a JSON array: [{"date":"YYYY-MM-DD","channel":"…","title":"…","cep":"…"}].\n\nMy plan:\n${planNow || '(empty)'}` }], maxTokens: 4000 })
          .then(async (r) => { const m = r.text.match(/\[[\s\S]*\]/); let list = []; try { list = JSON.parse(m[0]); } catch (e) { throw new Error('The suggestion could not be read. Try again.'); }
            const n = await BW.mktContent.addMany(list, 'ai'); BW.toast(`${n} post ideas added (≈ $${r.cost.toFixed(3)})`, '✨'); again(); })
          .catch((e) => { BW.error(e); btn.disabled = false; btn.textContent = '✨ Suggest posts with AI'; });
      },
    }).catch(BW.error);
  }

  function viewMonitor(v) {
    const b = buyerStats(), last = waves[waves.length - 1];
    const own = BW.settings.businessName;
    const metric = (w, brand) => { const r = w.rows.find((x) => x.brand === brand); if (!r) return null; const links = r.links.reduce((t, n) => t + BW.num(n), 0); const all = w.rows.reduce((t, x) => t + x.links.reduce((s, n) => s + BW.num(n), 0), 0); return { mpen: w.n ? r.any / w.n : 0, net: r.any ? links / r.any : 0, mms: all ? links / all : 0 }; };
    v.innerHTML = `<div class="mon rise">
      <section class="card"><h3>👥 Customers buying each month</h3><p class="why">How many different customers bought from you each month (penetration).</p>${bars(b.perMonth, 'active')}</section>
      <section class="card"><h3>🪶 Your light buyers</h3><p class="why">Every business has a few heavy and many light customers. That's normal, and it's where growth hides.</p>
        <p class="big-num">${Math.round(b.topShare * 100)}%</p><p>of the last 12 months' revenue came from your top 20% of customers (research says expect roughly 50 to 60%, not 80%).</p>
        <p style="margin-top:8px"><b>${Math.round(b.once * 100)}%</b> of customers bought once · on average <b>${b.avg.toFixed(1)}</b> invoices per customer.</p></section>
      <section class="card"><h3>🧠 How often you come to mind</h3><p class="why">From a short survey among local buyers of your category. Repeat once or twice a year.</p>
        ${last ? `<table class="data-table wave-table"><tr><th>Brand</th><th>Mental penetration</th><th>Network size</th><th>Mental market share</th></tr>${last.rows.map((r) => { const x = metric(last, r.brand); return `<tr${r.brand === own ? ' style="font-weight:800"' : ''}><td>${esc(r.brand)}</td><td>${Math.round(x.mpen * 100)}%</td><td>${x.net.toFixed(1)}</td><td>${Math.round(x.mms * 100)}%</td></tr>`; }).join('')}</table>
          <small class="faint">${BW.fmtDate(last.date)} · ${last.n} category buyers · ${waves.length} survey${waves.length === 1 ? '' : 's'} so far</small>` : '<p class="muted">No survey results yet.</p>'}
        <div class="row-flex" style="margin-top:12px"><button class="btn" data-design>✨ Design my survey</button><button class="btn btn-primary" data-wave>＋ Enter survey results</button></div></section>
      <section class="card asset-grid"><h3>🎨 Distinctive assets</h3><p class="why">Famous and unique assets are shortcuts to your brand. Update the scores after each test.</p>${assetGrid()}
        <div class="row-flex" style="margin-top:8px"><button class="btn" data-assets>Edit scores</button><button class="btn" data-assetskill>✨ Plan an asset test</button></div></section>
      <section class="card"><h3>🗓️ Presence</h3><p class="why">Buyers enter the market all year. Aim for marketing in every month.</p>
        <p class="big-num">${presence().active}/12</p><p>months covered in your 12-month plan</p><button class="btn" data-plan style="margin-top:10px">Open the plan</button></section>
    </div>`;
    $('[data-wave]', v).onclick = enterWave;
    $('[data-design]', v).onclick = () => openSkill('brand-health');
    $('[data-assets]', v).onclick = () => { tab = 'profile'; render(); setTimeout(() => { const el = $('[data-section="assets"]'); if (el) el.scrollIntoView(); }, 50); };
    $('[data-assetskill]', v).onclick = () => openSkill('distinctive-assets');
    $('[data-plan]', v).onclick = () => { tab = 'plan'; render(); };
  }
  function assetGrid() {
    const W = 320, H = 240, pad = 30;
    const x = (f) => pad + f / 100 * (W - pad - 10), y = (u) => H - pad - u / 100 * (H - pad - 10);
    const pts = p.assets.map((a) => `<circle cx="${x(a.fame)}" cy="${y(a.uniq)}" r="7" fill="var(--app)" stroke="var(--border)" stroke-width="1.5"><title>${esc(a.name)}: fame ${a.fame}, uniqueness ${a.uniq}</title></circle><text x="${a.fame > 55 ? x(a.fame) - 10 : x(a.fame) + 10}" y="${y(a.uniq) + 4}" text-anchor="${a.fame > 55 ? 'end' : 'start'}">${esc((a.name || a.type).slice(0, 18))}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fame and uniqueness of brand assets">
      <rect x="${pad}" y="10" width="${W - pad - 10}" height="${H - pad - 10}" fill="none" stroke="var(--hair)" stroke-width="1.5"/>
      <line x1="${x(50)}" x2="${x(50)}" y1="10" y2="${H - pad}" stroke="var(--hair)" stroke-dasharray="4 4"/><line x1="${pad}" x2="${W - 10}" y1="${y(50)}" y2="${y(50)}" stroke="var(--hair)" stroke-dasharray="4 4"/>
      <text class="q" x="${x(52)}" y="24">Use or lose</text><text class="q" x="${pad + 6}" y="24">Invest</text><text class="q" x="${x(52)}" y="${H - pad - 6}">Avoid</text><text class="q" x="${pad + 6}" y="${H - pad - 6}">Test or ignore</text>
      <text x="${W / 2}" y="${H - 8}" text-anchor="middle" class="q">Fame →</text><text x="12" y="${H / 2}" class="q" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">Uniqueness →</text>
      ${pts}</svg>`;
  }
  function enterWave() {
    const brands = [BW.settings.businessName].concat(p.competitors.map((c) => c.name).filter(Boolean)).slice(0, 8);
    const ceps = p.ceps.filter((c) => c.priority).concat(p.ceps.filter((c) => !c.priority)).slice(0, 8);
    if (!ceps.length) return BW.toast('Add buying moments to your profile first', '🚪');
    const box = document.createElement('div');
    box.innerHTML = `<p class="muted" style="margin-bottom:12px">Enter how many respondents linked each brand to each buying moment, and how many linked the brand to at least one moment.</p>
      <div class="grid-2" style="margin-bottom:12px"><label class="field"><span>Survey date</span><input class="in" type="date" data-date value="${BW.today()}"></label><label class="field"><span>Category buyers who answered</span><input class="in" inputmode="numeric" data-n placeholder="e.g. 60"></label></div>
      <div class="table-scroll" style="overflow-x:auto"><table class="data-table wave-table wave-input"><tr><th>Brand</th>${ceps.map((c) => `<th title="${esc(c.text)}">${esc(c.text.slice(0, 22))}${c.text.length > 22 ? '…' : ''}</th>`).join('')}<th>Linked to ≥1</th></tr>
      ${brands.map((b, i) => `<tr data-b="${i}"><td>${esc(b)}</td>${ceps.map((c, j) => `<td><input class="in" inputmode="numeric" data-c="${j}" aria-label="${esc(b)}: ${esc(c.text)}"></td>`).join('')}<td><input class="in" inputmode="numeric" data-any aria-label="${esc(b)} linked to at least one"></td></tr>`).join('')}</table></div>`;
    BW.modal({ title: '🧠 Survey results', wide: true, body: box, actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Save results', kind: 'primary', onClick: async () => {
      const n = BW.num($('[data-n]', box).value);
      if (!(n > 0)) { BW.toast('How many people answered?', '🤔'); return false; }
      const rows = brands.map((b, i) => { const tr = $(`tr[data-b="${i}"]`, box); return { brand: b, links: $$('[data-c]', tr).map((x) => BW.num(x.value)), any: BW.num($('[data-any]', tr).value) }; });
      try { await BW.store.put('mktwaves', { date: $('[data-date]', box).value, n, ceps: ceps.map((c) => c.text), rows }); await load(); render(); BW.toast('Survey saved', '🧠'); } catch (e) { BW.error(e); return false; }
    } }] });
  }

  // ---------- brand profile ----------
  function viewProfile(v) {
    const pct = M.completeness(p);
    v.innerHTML = `<div class="row-flex" style="margin-bottom:16px"><div class="meter" style="flex:1;max-width:320px"><i style="width:${pct}%"></i></div><b>${pct}% complete</b><div class="spacer"></div><small class="faint">Saves as you type. Every skill reads this.</small><button class="btn" data-olaf-export title="Download this profile as a markdown file">⬇️ Download profile</button></div>
      ${M.steps.map((st) => `<section class="card pcard" data-section="${st.id}" style="margin-bottom:18px"><h2 style="margin-bottom:4px">${st.emoji} ${st.title}</h2><p class="muted" style="margin-bottom:14px">${st.sub}</p><div data-body>${st.html(p)}</div></section>`).join('')}
      <section class="card pcard" style="margin-bottom:40px"><h2>📌 Learnings</h2><p class="muted" style="margin-bottom:10px">What you learned from your marketing. Every skill reads these.</p>
        ${p.learnings.length ? `<ul>${p.learnings.slice().reverse().map((l) => `<li><small class="faint">${BW.fmtDate(l.date)}</small> ${esc(l.text)}</li>`).join('')}</ul>` : '<p class="faint">Nothing yet.</p>'}<button class="btn" data-learn style="margin-top:10px">＋ Add a learning</button></section>`;
    M.steps.forEach((st) => {
      const box = $(`[data-section="${st.id}"] [data-body]`, v);
      const changed = () => { M.readStep(box, p); saveProfile(); };
      if (st.bind) st.bind(box, p, changed);
      box.addEventListener('input', changed); box.addEventListener('click', () => setTimeout(changed));
    });
    $('[data-learn]', v).onclick = addLearning;
    $('[data-olaf-export]', v).onclick = () => M.exportForOlaf(p);
  }

  // ---------- learn ----------
  const LESSONS = [
    ['🌱', 'Grow by winning more buyers', 'Businesses grow mostly by getting more customers, not by making existing ones buy more. Bigger brands simply have more buyers, who are a bit more loyal.', 'Count new customers every month.'],
    ['🪶', 'Most customers are light customers', 'A few people buy often; many buy rarely. Together the light buyers bring a big share of sales. Don\'t only talk to your regulars.', 'Reach people who bought once, or never.'],
    ['⏳', 'Most buyers aren\'t buying today', 'At any moment only a small share of people need what you sell. The rest will need it later and will pick whoever comes to mind.', 'Stay visible every month, not just in campaigns.'],
    ['🚪', 'Own the buying moments', 'People think of a business in a moment: a need, a time, a place, a feeling. Link your business to the common moments.', 'Star 3–5 moments in your profile and use them in every message.'],
    ['🎨', 'Be recognisable in a glance', 'Colours, logo, a character or a slogan that people link only to you are shortcuts in their memory. Consistency builds them; redesigns break them.', 'Choose 2–4 assets and use them everywhere.'],
    ['🛒', 'Make it easy to buy', 'Being easy to find, book, pay and reach is often the cheapest growth there is: opening hours, Google profile, reviews, clear prices.', 'Run the Local presence skill.'],
    ['📡', 'Reach everyone, all year', 'Reaching more people beats reaching the same people more often. A small, steady presence beats one big burst.', 'Fill the empty months in your plan.'],
    ['👀', 'Get noticed, then be remembered', 'Ads must stand out and show clearly who they\'re from: brand early and often. Emotion and humour earn attention.', 'Use the Creative check before anything goes out.'],
    ['🎟️', 'Go easy on discounts', 'Discounts mostly reward people who would have bought anyway, and only for a while. Better: make trying you easier.', 'Use the Offers skill for smarter offers.'],
    ['📏', 'Measure what matters', 'New customers, how often you come to mind, and whether your assets are recognised. Likes from fans say little.', 'Do a brand health survey once or twice a year.'],
  ];
  function viewLearn(v) {
    v.innerHTML = `<p class="lead" style="margin-bottom:18px">Ten ideas from decades of research into how people really buy. Every skill in the Studio works by them.</p>
      <div class="lessons rise">${LESSONS.map(([e, t, x, d]) => `<div class="card lesson"><span class="e">${e}</span><h3>${t}</h3><p>${x}</p><div class="do">👉 ${d}</div></div>`).join('')}</div>
      <div class="row-flex" style="margin:24px 0 40px"><button class="btn btn-primary" data-full>📖 Read the full foundation</button><button class="btn" data-licences>📜 Skill sources and licences</button></div>`;
    $('[data-full]', v).onclick = () => BW.modal({ title: '📖 The marketing foundation', wide: true, body: `<div class="md">${md(L.foundationDoc)}</div>` });
    $('[data-licences]', v).onclick = () => BW.modal({ title: '📜 Sources and licences', wide: true, body: '<p>The skill library\'s sources, licences and credits are in the <b>licenses</b> folder next to this tool (<code>apps/marketing/licenses</code>), including the full Apache 2.0 licence text. The marketing foundation summarises published marketing science in our own words.</p>' });
  }

  // ---------- AI settings ----------
  function aiSettings() { BW.ai.settings({ onSave: render }); }

  // ---------- onboarding ----------
  function onboarding() {
    M.seedAssets(p);
    if (!p.area) p.area = [BW.settings.city, BW.settings.country].filter(Boolean).join(', ');
    let i = -1;
    const total = M.steps.length + 1;
    const ob = BW.html('<div class="ob"><div class="ob-card card studio"></div></div>');
    document.body.append(ob);
    const card = $('.ob-card', ob);
    const dots = () => `<div class="dots">${Array.from({ length: total }, (_, n) => `<i class="${n === i ? 'on' : n < i ? 'done' : ''}"></i>`).join('')}</div>`;
    const draw = () => {
      if (i === -1) {
        card.innerHTML = `<div class="ob-emoji">📣</div><h1>Let's set up your marketing brain</h1>
          <p class="sub">Eight short steps, about ten minutes. Everything the Studio makes for you will be based on this, and on three ideas from decades of research:</p>
          <div class="next" style="margin-bottom:6px">
            <div class="idea" style="margin:0"><span class="e">🌱</span><div><b>Grow by winning more buyers.</b> Not by squeezing your regulars.</div></div>
            <div class="idea" style="margin:0"><span class="e">🧠</span><div><b>Be the one they think of.</b> In the moments people need what you sell.</div></div>
            <div class="idea" style="margin:0"><span class="e">🛒</span><div><b>Be easy to buy.</b> Easy to find, recognise, book and pay.</div></div></div>
          <div class="ob-foot"><button class="btn btn-ghost" data-later>Do this later</button><div class="spacer"></div><button class="btn btn-primary btn-big" data-next>Let's start →</button></div>`;
      } else if (i < M.steps.length) {
        const st = M.steps[i];
        card.innerHTML = `${dots()}<div class="ob-emoji">${st.emoji}</div><h1>${st.title}</h1><p class="sub">${st.sub}</p><div data-step>${st.html(p)}</div>
          <div class="ob-foot"><button class="btn btn-ghost" data-back>← Back</button><div class="spacer"></div><button class="btn btn-ghost" data-skip>Skip</button><button class="btn btn-primary btn-big" data-next>Next →</button></div>`;
        const box = $('[data-step]', card);
        if (st.bind) st.bind(box, p, () => M.readStep(box, p));
      } else {
        card.innerHTML = `${dots()}<div class="ob-emoji">🤖</div><h1>Connect your AI</h1><p class="sub">The Studio uses Claude with your own key. You pay Anthropic directly for what you use, usually a few cents per answer. You can also do this later.</p>
          <div class="idea"><span class="e">🔒</span><div>Your key stays in this browser only and is sent only to Anthropic. Get one at <b>console.anthropic.com</b> → API keys.</div></div>
          <label class="field"><span>Claude API key</span><input class="in" type="password" data-key value="${esc(BW.ai.key)}" placeholder="sk-ant-…" autocomplete="off"></label>
          <div class="ob-foot"><button class="btn btn-ghost" data-back>← Back</button><div class="spacer"></div><button class="btn btn-primary btn-big" data-next>Finish 🎉</button></div>`;
      }
      const nx = $('[data-next]', card), bk = $('[data-back]', card), sk = $('[data-skip]', card), later = $('[data-later]', card);
      const keep = () => { const box = $('[data-step]', card); if (box) M.readStep(box, p); };
      nx.onclick = async () => {
        keep();
        const key = $('[data-key]', card); if (key) BW.ai.key = key.value;
        if (i === M.steps.length) return finish();
        try { await BW.store.put('mktprofile', p); } catch (e) { return BW.error(e); }
        i++; draw();
      };
      if (bk) bk.onclick = () => { keep(); i--; draw(); };
      if (sk) sk.onclick = () => { i++; draw(); };
      if (later) later.onclick = () => finish(true);
      const f = $('input, textarea', card); if (f && i >= 0) f.focus();
    };
    const finish = async (skipped) => {
      p.onboarded = true;
      p.changelog.push({ date: BW.today(), text: skipped ? 'Skipped onboarding' : 'Finished onboarding' });
      try { await BW.store.put('mktprofile', p); } catch (e) { return BW.error(e); }
      ob.remove();
      if (!skipped) { BW.confetti(); BW.toast('Your marketing brain is ready!', '🧠'); }
      render();
      BW.route({ skill: (id) => openSkill(id), tab: (t) => { tab = t; skillId = null; render(); } });
    };
    draw();
  }
})();
