/* Olaf: the AI marketing expert. Coach (the owner's journey), every skill, Olaf's files, and the
   conversation panel where Olaf works and asks. The loop itself is agent.js; files and tools are
   workspace.js. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const LIB = BW.olafLibrary, WS = BW.olafWs, A = BW.olafAgent;
  const main = $('#main');
  const TABS = [['home', '🏠 Dashboard'], ['insights', '📊 Insights'], ['content', '✍️ Content'], ['skills', '🛠️ Skills'], ['files', '🗂️ Files'], ['history', '💬 Conversations']];
  const GROUPS = LIB.groups; // olaf/groups.json, shared with the website's skill list
  const STAGES = ['Know how you grow', 'Be easy to find and buy', 'Own your moments and assets', 'Plan always-on reach', 'Show up every month', 'Measure and learn'];

  let tab = 'home', session = null, running = null, query = '', openFile = null;
  let locked = false; // licences are on and none is valid: only the unlock screen may show

  /* Editions. The website runs a demo: Olaf's screens with the example business, no instructions
     and no AI. The paid download is the full Olaf. */
  const DEMO = LIB.edition === 'demo';
  const OLAF_PAGE = (BW.siteUrl || '') + '/olaf.html';
  /* Licences: signed by the seller, checked offline by BW.licence (core.js) against the public keys
     the paid build ships. Asked for only when the build switches it on (OLAF_REQUIRE_LICENCE). */

  BW.boot({
    app: 'olaf',
    onReady: async () => {
      locked = !DEMO && (await BW.entitlements.edition('olaf')) === 'locked';
      if (locked) return licenceScreen();
      if (DEMO) await demoData();
      await WS.ensureSeeded();
      render();
      BW.route({ tab: (t) => { tab = t === 'coach' ? 'home' : t; session = null; render(); }, skill: (id) => start(id, ''), file: (f) => { openFile = decodeURIComponent(f); tab = 'files'; session = null; render(); } });
    },
    onChange: async (name) => { if (['olaf-files', 'mktplan', 'mktnumbers', 'mktcontent', 'mktsettings', 'invoices', 'clients', '*'].includes(name)) { await WS.load(); if (!session) render(); } },
  });

  const skill = (id) => LIB.skills.find((s) => s.id === id);
  const pretty = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').replace(/\bIcp\b/, 'ICP').replace(/\bSeo\b/, 'SEO').replace(/\bGeo\b/, 'GEO').replace(/\bPr\b/, 'PR').replace(/\bAb\b/, 'A/B');
  const short = (s, n) => { s = String(s || ''); const cut = s.split(/(?<=\.)\s/)[0]; return (cut.length < n ? cut : s.slice(0, n).replace(/\s\S*$/, '') + '…'); };

  // ---------- frame ----------
  function render() {
    if (locked) return; // the unlock screen stays until a valid licence reloads the page
    if (session) return renderSession();
    main.innerHTML = `
      <div class="page-head" style="padding-bottom:10px">
        <div><h1><img class="olaf-title-mark" src="../../shared/icons/olaf.svg" alt=""> Olaf <span class="chip chip-sun" style="vertical-align:middle;font-size:.75rem">Early access</span></h1>
          <p class="lead">Your AI marketing expert. It works out where you stand, plans your next 90 days, checks in every week and does the work with you.</p></div>
        <div class="spacer"></div>
        <button class="btn" data-ai>${BW.ai.ready() ? '🤖 AI is on' : '🔌 Connect AI'}</button>
      </div>
      ${DEMO ? `<div class="demo-bar"><span><b>This is the Olaf demo</b>, with an example business. You can look around everything; Olaf's work and the AI only run in the full version.</span><a class="btn btn-primary" href="${OLAF_PAGE}">Get Olaf →</a></div>` : ''}
      <div class="studio-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      <div data-view></div>`;
    $$('[data-tab]', main).forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
    $('[data-ai]', main).onclick = settings;
    const views = { home: viewHome, insights: viewInsights, content: viewContent, skills: viewSkills, files: viewFiles, history: viewHistory };
    (views[tab] || viewHome)($('[data-view]', main));
  }

  // ---------- editions ----------
  function demoNotice(id) {
    const s = skill(id);
    BW.modal({ title: '🧭 In the full version, Olaf starts here', body: BW.html(`<div><p>Olaf would now run <b>${esc(pretty(id))}</b>${s ? `: ${esc(short(s.description, 160))}` : ''}</p>
      <p class="muted" style="margin-top:10px">It reads your files, does the work and saves it to this dashboard, on your own Claude key. The demo shows the example business only.</p></div>`),
      actions: [{ label: 'Keep looking', kind: 'ghost' }, { label: 'Get Olaf →', kind: 'primary', onClick: () => { location.href = OLAF_PAGE; } }] });
  }
  async function demoData() {
    if ((await BW.store.all('olaf-files')).some((f) => f.example)) return;
    try {
      if (!BW.examples) await BW.loadScript('../../shared/examples.js');
      if (await BW.examples.present()) await BW.examples.loadMarketing(); else await BW.examples.load();
    } catch (e) { /* the demo still opens, just emptier */ }
  }
  function licenceScreen() {
    main.innerHTML = `<div class="card licence"><h1>🧭 Unlock Olaf</h1>
      <p>Paste the licence key from your purchase email, or choose the licence file that came with it. You do this once: the licence is saved with your business, so every computer that opens it is ready.</p>
      <textarea class="in" data-lk rows="3" placeholder="BWL1.…" autocomplete="off" spellcheck="false"></textarea>
      <div class="row-flex"><button class="btn btn-primary" data-lgo>Unlock Olaf</button><label class="btn btn-ghost">📄 Choose the licence file<input type="file" accept=".txt,.licence,text/plain" data-lfile hidden></label><div class="spacer"></div><a class="btn btn-ghost" href="${OLAF_PAGE}">Buy Olaf</a></div>
      <small class="faint" data-lmsg role="status"></small></div>`;
    const msg = $('[data-lmsg]', main);
    const unlock = async (text) => {
      msg.textContent = 'Checking…';
      let r;
      try { r = await BW.licence.add(text, 'olaf'); } catch (e) { msg.textContent = e.message; return; }
      if (!r.ok) { msg.textContent = BW.licence.explain(r.reason); return; }
      BW.toast(`Olaf is unlocked for ${esc(r.licence.licensee || 'your business')}`, '🧭');
      BW.confetti();
      setTimeout(() => location.reload(), 900);
    };
    $('[data-lgo]', main).onclick = () => unlock($('[data-lk]', main).value);
    $('[data-lfile]', main).onchange = async (e) => { const f = e.target.files[0]; if (f) unlock(await f.text()); };
  }


  function settings() {
    if (DEMO) return demoNotice('marketing-journey');
    BW.ai.settings({ onSave: render });
    // Olaf's own per-run limit sits under the shared AI settings.
    setTimeout(() => {
      const box = $('.modal .model-cards'); if (!box || $('[data-runcap]')) return;
      const f = BW.html(`<label class="field" style="margin-top:14px"><span>Olaf: limit per conversation, in US dollars</span><input class="in" inputmode="decimal" data-runcap value="${A.runCap}"><em>Olaf stops and reports when one conversation reaches this.</em></label>`);
      box.parentElement.append(f);
      $('[data-runcap]').oninput = (e) => { A.runCap = BW.num(e.target.value) || 2; };
      BW.licence.current('olaf').then((lic) => {
        if (lic) box.parentElement.append(BW.html(`<p class="faint" style="margin-top:12px">🧾 Olaf licence <b>${esc(lic.id)}</b>, licensed to ${esc(lic.licensee || 'this business')}.</p>`));
      });
    });
  }

  // ---------- coach ----------
  function journey() {
    const text = WS.read('memory/marketing-journey.md');
    if (!text) return null;
    const j = { stages: [], week: [] };
    let sec = '';
    for (const line of text.split('\n')) {
      if (line.startsWith('## ')) { sec = line.slice(3).trim().toLowerCase(); continue; }
      const f = line.match(/^\*\*(Started|Current stage|Hours per week|Next check-in):\*\*\s*(.*)$/);
      if (f) { j[f[1]] = f[2].trim(); continue; }
      const st = sec === 'stages' && line.match(/^- \[( |x|X)\] (\d)\. (.+?)\s*(?:\(done ([0-9-]+)\))?\s*$/);
      if (st) { j.stages.push({ n: +st[2], title: st[3], done: st[1] !== ' ', when: st[4] || '' }); continue; }
      const w = sec === 'this week' && line.match(/^- \[( |x|X)\] (.+)$/);
      if (w && !/\[action\]/.test(w[2])) j.week.push({ text: w[2], done: w[1] !== ' ' });
    }
    if (!j.stages.length) j.stages = STAGES.map((t, i) => ({ n: i + 1, title: t, done: false }));
    return j;
  }

  function stageCards(stages) {
    const now = (stages.find((s) => !s.done) || {}).n;
    return `<div class="stages">${stages.map((s) => `<div class="stage ${s.done ? 'done' : ''} ${s.n === now ? 'now' : ''}"><span class="n">${s.done ? '✓' : s.n}</span><b>${esc(s.title)}</b><small>${s.done ? 'Done ' + esc(s.when || '') : s.n === now ? 'You are here' : ''}</small></div>`).join('')}</div>`;
  }

  /* ---------- insights and content: the same pages as the Studio, with Olaf doing the work ---------- */
  function viewInsights(v) {
    BW.mktInsights.render(v, { guided: true, run: (id, prompt) => start(id, prompt || ''), explain: () => start('marketing-journey', 'Monthly review') }).catch(BW.error);
  }
  function viewContent(v) {
    BW.mktContent.render(v, { guided: true,
      write: (item) => start('social-media', `Write this post and put the text on my content calendar (item ${item.id}): "${item.title}", ${item.channel || 'any channel'}, ${item.date}${item.cep ? `, buying moment: ${item.cep}` : ''}.`),
      suggest: (w) => start('social-media', `Fill my content calendar for the four weeks from ${w}: a rhythm I can keep with my hours, linked to my plan and buying moments, with the finished text for this week's posts.`),
    }).catch(BW.error);
  }

  /* ---------- setup: onboarding as a visible checklist ---------- */
  const SETUP = [
    { id: 'growth', title: 'How your business grows', mins: 15, file: 'brand-documents/brand-growth-profile.md', required: true, what: 'who buys, the moments they need you, what they know you by, your budget and hours' },
    { id: 'customers', title: 'Your customers in their own words', mins: 5, file: 'brand-documents/icps.md', what: 'why people choose you, who is not a fit, the objection you hear most' },
    { id: 'competitors', title: 'Who you compete with', mins: 5, file: 'memory/battlecard-seeds.md', what: 'the shops, chains and online options people compare you with' },
    { id: 'voice', title: 'Your voice and words', mins: 5, file: 'brand-documents/brand-voice.md', what: 'how you sound, words you use and avoid, examples you like' },
    { id: 'proof', title: 'Proof: reviews, results, quotes', mins: 5, file: 'memory/proof-library.md', what: 'what you can show: review score, years, results, customer quotes' },
    { id: 'numbers', title: 'Channels and starting numbers', mins: 5, what: 'where you are active, and your numbers today, so progress can be measured' },
  ];
  const fills = (s) => ((s || '').match(/\[FILL/g) || []).length;
  function topicDone(topic, ctx) {
    if (topic.id === 'numbers') return ctx.d.numbers.length > 0;
    const c = WS.read(topic.file), tpl = LIB.templates[topic.file] || '';
    if (!c || c === tpl) return false;
    return fills(tpl) ? fills(c) <= Math.floor(fills(tpl) / 2) : c.length > tpl.length + 150;
  }
  async function setupState() {
    const d = await BW.mktDash.load();
    const rec = (await BW.store.all('olaf-setup'))[0] || { id: 'setup', skipped: [] };
    const ctx = { d, rec };
    const topics = SETUP.map((tp) => Object.assign({}, tp, { done: topicDone(tp, ctx), skipped: rec.skipped.includes(tp.id) }));
    const j = journey();
    const planned = !!j && d.plan.length > 0;
    const next = topics.find((tp) => !tp.done && !tp.skipped);
    return { d, rec, topics, j, planned, next, complete: planned && topics[0].done };
  }
  const topicPrompt = (tp) => `Let's set up: ${tp.title.toLowerCase()}.`;

  function setupHtml(st) {
    const canPlan = st.topics[0].done;
    return `<section class="card setup rise">
      <h2>Set up your marketing <small>${st.topics.filter((x) => x.done).length} of ${st.topics.length} topics · then Olaf makes your plan</small></h2>
      <ol class="setup-list">${st.topics.map((tp) => {
        const state = tp.done ? 'done' : tp.skipped ? 'skipped' : tp === st.next ? 'next' : 'todo';
        return `<li class="is-${state}"><span class="tick">${tp.done ? '✓' : tp.skipped ? '–' : ''}</span>
          <div><b>${esc(tp.title)}</b><small>${esc(tp.what)}${tp.required ? ' · needed for everything else' : ''}</small></div>
          ${tp.done ? `<button class="btn btn-ghost" data-topic="${tp.id}">Review</button>`
            : `${tp.required ? '' : `<button class="btn btn-ghost" data-skip="${tp.id}">${tp.skipped ? 'Unskip' : 'Skip'}</button>`}<button class="btn ${state === 'next' ? 'btn-primary' : ''}" data-topic="${tp.id}">${state === 'next' ? '▶ Start' : 'Start'} · ${tp.mins} min</button>`}</li>`; }).join('')}
        <li class="is-${st.planned ? 'done' : canPlan && !st.next ? 'next' : 'todo'} final"><span class="tick">${st.planned ? '✓' : '★'}</span>
          <div><b>Your plan</b><small>a one-page summary, your starting numbers, a 90-day roadmap and a 12-month plan on this dashboard</small></div>
          ${st.planned ? '' : `<button class="btn ${canPlan && !st.next ? 'btn-primary' : ''}" data-makeplan ${canPlan ? '' : 'disabled title="Do the first topic first"'}>${canPlan && !st.next ? '▶ Make my plan' : 'Make my plan'}</button>`}</li>
      </ol>
      ${canPlan && st.next ? '<p class="faint" style="font-size:.85rem">You can make your plan now, or do the other topics first for a sharper plan. Each takes a few minutes.</p>' : ''}
    </section>`;
  }

  function doneHtml(st) {
    const when = (st.j && st.j.Started) || '';
    return `<section class="card setup-done rise"><span class="e">🎉</span><div><b>Your marketing is set up${when ? ' since ' + esc(BW.fmtDate(when)) : ''}.</b>
      <small>Olaf keeps this dashboard current: the plan, your numbers and the work. Your part is a short check-in each week.</small></div>
      <button class="btn btn-ghost" data-review>Setup topics</button></section>`;
  }

  /* ---------- the dashboard (home) ---------- */
  async function viewHome(v) {
    const st = await setupState(), j = st.j, key = BW.ai.ready();
    const due = j && (!j['Next check-in'] || j['Next check-in'] <= BW.today());
    v.innerHTML = `
      ${key ? '' : `<div class="next rise" style="margin-bottom:16px"><button data-key><span class="e">🔌</span><span><b>Connect your Claude key</b><small>Olaf runs on your own key. It stays in this browser and is only sent to Anthropic.</small></span></button></div>`}
      ${st.complete ? doneHtml(st) : setupHtml(st)}
      ${!st.complete && !j && !st.topics[0].done ? `<div class="row-flex" style="margin:-4px 0 18px"><small class="faint">Just looking around?</small><button class="btn btn-ghost" data-example>👀 Show an example business</button></div>` : ''}
      ${j ? `<div class="card coach-hero rise">
          <div><h2>Stage ${Math.min(j.stages.filter((s) => s.done).length + 1, 6)} of 6: ${esc((j.stages.find((s) => !s.done) || { title: 'Keep it going' }).title)}</h2>
            <p>Next check-in ${esc(j['Next check-in'] || 'when you are ready')}${j['Hours per week'] ? ' · planned around ' + esc(j['Hours per week']) + ' hours a week' : ''}</p></div>
          <div class="row-flex"><button class="btn btn-primary" data-go="weekly">${due ? '⏰ ' : ''}Weekly check-in</button><button class="btn" data-go="monthly">Monthly review</button><button class="btn" data-go="ask">Ask Olaf</button></div>
        </div>
        <div class="card pcard rise" style="margin-bottom:16px"><h3>🧭 Your journey</h3>${stageCards(j.stages)}</div>
        <div class="card pcard rise" style="margin-bottom:16px"><h3>📋 This week <small class="faint" style="font-weight:600">tick off what you did</small></h3>${j.week.length ? `<ul class="week">${j.week.map((w, i) => `<li class="${w.done ? 'done' : ''}" data-week="${i}" role="checkbox" aria-checked="${w.done}" tabindex="0">${esc(w.text)}</li>`).join('')}</ul>` : '<p>Nothing planned yet. Run a weekly check-in.</p>'}</div>` : ''}
      <div class="dash rise">${BW.mktDash.planHtml(st.d, { planLink: '../marketing/index.html#tab/plan' })}${BW.mktDash.numbersHtml(st.d)}${BW.mktDash.workHtml(st.d)}</div>
      <div style="height:40px"></div>`;
    const k = $('[data-key]', v); if (k) k.onclick = settings;
    BW.mktDash.bind(v, st.d, () => viewHome(v));
    $$('[data-open]', v).forEach((a) => a.onclick = (e) => { e.preventDefault(); openFile = a.dataset.open; tab = 'files'; render(); });
    $$('[data-topic]', v).forEach((b) => b.onclick = () => { const tp = SETUP.find((x) => x.id === b.dataset.topic); start('onboarding', topicPrompt(tp)); });
    $$('[data-skip]', v).forEach((b) => b.onclick = async () => {
      const id = b.dataset.skip, rec = st.rec; rec.skipped = rec.skipped.includes(id) ? rec.skipped.filter((x) => x !== id) : rec.skipped.concat(id);
      await BW.store.put('olaf-setup', rec); viewHome(v);
    });
    const mp = $('[data-makeplan]', v); if (mp) mp.onclick = () => start('marketing-journey', 'Make my plan: I have finished setting up.');
    const rv = $('[data-review]', v); if (rv) rv.onclick = () => { const box = BW.html(`<div>${setupHtml(Object.assign({}, st, { planned: true }))}</div>`); BW.modal({ title: 'Setup topics', body: box, wide: true }); $$('[data-topic]', box).forEach((b) => b.onclick = () => { $('.modal .close, .modal [aria-label=Close]') && $('.modal .close, .modal [aria-label=Close]').click(); start('onboarding', topicPrompt(SETUP.find((x) => x.id === b.dataset.topic))); }); };
    $$('[data-week]', v).forEach((li) => li.onclick = async () => { await toggleWeek(Number(li.dataset.week)); viewHome(v); });
    const go = { weekly: 'Weekly check-in', monthly: 'Monthly review' };
    $$('[data-go]', v).forEach((b) => b.onclick = () => (b.dataset.go === 'ask' ? ask() : start('marketing-journey', go[b.dataset.go])));
    const ex = $('[data-example]', v);
    if (ex) ex.onclick = async () => {
      ex.disabled = true;
      try {
        if (!BW.examples) await BW.loadScript('../../shared/examples.js');
        if (await BW.examples.present()) await BW.examples.loadMarketing(); else await BW.examples.load();
        await WS.load(); render();
        BW.toast('Meet the example studio: set up, at stage 2, with work waiting. Remove it from the Busywork home screen.', '👀');
      } catch (e) { BW.error(e); ex.disabled = false; }
    };
  }

  // The owner ticks off a step: flip that line in the journey file Olaf keeps.
  async function toggleWeek(n) {
    const text = WS.read('memory/marketing-journey.md'); if (!text) return;
    let sec = '', k = -1;
    const lines = text.split('\n').map((line) => {
      if (line.startsWith('## ')) sec = line.slice(3).trim().toLowerCase();
      if (sec === 'this week' && /^- \[( |x|X)\] /.test(line) && !/\[action\]/.test(line) && ++k === n) return line.replace(/^- \[( |x|X)\]/, (m0, x) => (x === ' ' ? '- [x]' : '- [ ]'));
      return line;
    });
    await WS.write('memory/marketing-journey.md', lines.join('\n'));
  }

  function ask() {
    const box = BW.html('<div><textarea class="in" data-q rows="4" placeholder="e.g. Should I start a loyalty card? Is TikTok worth it for a bike shop?"></textarea></div>');
    BW.modal({ title: '🧭 Ask Olaf', body: box, actions: [{ label: 'Ask', kind: 'primary', onClick: () => { const q = $('[data-q]', box).value.trim(); if (q) start('marketing-journey', 'A question: ' + q); } }] });
    setTimeout(() => $('[data-q]', box).focus(), 50);
  }

  // ---------- skills ----------
  function skillCard(id) {
    const s = skill(id);
    return s ? `<button class="card skill" data-skill="${s.id}"><span><b>${esc(pretty(s.id))}</b><small>${esc(short(s.description.replace(/^When (the|an?) (user|owner) wants to /i, 'For when you want to '), 130))}</small></span></button>` : '';
  }
  function viewSkills(v) {
    const q = query.toLowerCase(), groups = GROUPS;
    const match = (id) => { const s = skill(id); return s && (!q || (s.id + ' ' + s.description).toLowerCase().includes(q)); };
    v.innerHTML = `
      <div class="row-flex" style="margin-bottom:6px"><label class="search" style="flex:1;max-width:420px"><input class="in" type="search" data-q placeholder="Find a skill: reviews, Google, newsletter…" value="${esc(query)}" aria-label="Find a skill"></label>
        <small class="faint">${LIB.skills.length} skills, all on the marketing foundation</small></div>
      <div class="skill-groups">${groups.map(([label, ids]) => { const l = ids.filter(match); return l.length ? `<h2>${label}</h2><div class="skill-grid">${l.map(skillCard).join('')}</div>` : ''; }).join('')}</div>
      <div style="height:40px"></div>`;
    const qi = $('[data-q]', v);
    qi.oninput = BW.debounce(() => { query = qi.value; viewSkills(v); const n = $('[data-q]', v); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 150);
    $$('[data-skill]', v).forEach((b) => b.onclick = () => compose(b.dataset.skill));
  }

  function compose(id) {
    const s = skill(id);
    const box = BW.html(`<div><p class="muted" style="margin-bottom:12px">${esc(short(s.description, 300))}</p>
      <label class="field"><span>What should Olaf do? (optional)</span><textarea class="in" data-i rows="4" placeholder="${esc(s.hint || 'Leave it empty and Olaf works from your brand documents, asking what it needs.')}"></textarea></label></div>`);
    BW.modal({ title: '🧭 ' + pretty(s.id), body: box, actions: [{ label: 'Start', kind: 'primary', onClick: () => start(id, $('[data-i]', box).value) }] });
    setTimeout(() => $('[data-i]', box).focus(), 50);
  }

  // ---------- files ----------
  function viewFiles(v) {
    const all = WS.all();
    const dirs = WS.WRITABLE.map((d) => [d, all.filter((f) => f.path.startsWith(d))]);
    const cur = openFile && WS.read(openFile) != null ? openFile : null;
    v.innerHTML = `
      <div class="files">
        <div class="card pcard">
          ${dirs.map(([d, list]) => `<h3>${{ 'brand-documents/': '🧭 Brand documents', 'memory/': '🧠 Memory', 'output/': '📄 Output', 'content-inbox/': '📥 Inbox' }[d]}</h3>
            <div class="flist">${list.map((f) => `<button data-f="${esc(f.path)}" aria-pressed="${f.path === cur}">${esc(f.path.slice(d.length))}${/\[FILL/.test(f.content) ? ' <small class="faint">to fill</small>' : ''}</button>`).join('') || '<small class="faint">Empty</small>'}</div>`).join('')}
          <label class="btn" style="margin-top:14px">📥 Add to inbox<input type="file" data-up multiple accept=".md,.txt,.csv,.json,.html,text/*" hidden></label>
          <p class="faint" style="font-size:.82rem;margin-top:8px">${BW.store.kind === 'folder' ? 'A readable copy of every file is kept under <b>Olaf/</b> in your business folder.' : 'Saved in this browser. Pick a business folder to keep plain copies on disk.'}</p>
        </div>
        <div class="card pcard fview">${cur ? `
          <div class="row-flex" style="margin-bottom:10px"><b>${esc(cur)}</b><div class="spacer"></div><button class="btn" data-edit>✏️ Edit</button><button class="btn" data-dl>⬇️ Download</button></div>
          <div class="md" data-body>${BW.md(WS.read(cur))}</div>` : '<p class="faint">Pick a file to read it. Olaf keeps your brand documents, what it has learned, and everything it made here.</p>'}</div>
      </div>`;
    $$('[data-f]', v).forEach((b) => b.onclick = () => { openFile = b.dataset.f; viewFiles(v); });
    $('[data-up]', v).onchange = async (e) => {
      for (const f of e.target.files) {
        if (f.size > 400000) { BW.toast(`${esc(f.name)} is too big (max 400 KB)`, '😬'); continue; }
        await WS.write('content-inbox/' + BW.fileSafe(f.name), await f.text());
      }
      BW.toast('Added to the inbox. Olaf reads it when a skill needs it.', '📥'); viewFiles(v);
    };
    if (cur) {
      $('[data-dl]', v).onclick = () => BW.download(new Blob([WS.read(cur)], { type: 'text/markdown' }), cur.split('/').pop());
      $('[data-edit]', v).onclick = () => {
        const body = $('[data-body]', v);
        body.outerHTML = `<textarea class="in mono" data-text rows="22">${esc(WS.read(cur))}</textarea><div class="row-flex" style="margin-top:10px"><div class="spacer"></div><button class="btn btn-primary" data-save>Save</button></div>`;
        $('[data-save]', v).onclick = async () => { try { await WS.write(cur, $('[data-text]', v).value); BW.toast('Saved', '✅'); viewFiles(v); } catch (e) { BW.error(e); } };
      };
    }
  }

  // ---------- conversations ----------
  async function viewHistory(v) {
    const list = await A.list();
    v.innerHTML = list.length ? `<div class="list">${list.map((s) => `<div class="row" data-s="${s.id}" tabindex="0"><span style="font-size:1.3rem">${s.finished ? '✅' : '💬'}</span><span class="main"><b>${esc(s.title)}</b><small>${esc(pretty(s.skillId))} · ${BW.fmtDate((s.updatedAt || '').slice(0, 10))} · $${(s.cost || 0).toFixed(2)}${s.finished ? '' : ' · open'}</small></span></div>`).join('')}</div>`
      : '<div class="empty card pcard"><p>No conversations yet. Start one from the Coach or a skill.</p></div>';
    $$('[data-s]', v).forEach((r) => r.onclick = async () => { session = await A.get(r.dataset.s); render(); });
  }

  async function start(id, instruction) {
    if (DEMO) return demoNotice(id);
    if (locked) return licenceScreen();
    if (!BW.ai.ready()) return settings();
    if (running) return BW.toast('Olaf is already working on something', '⏳');
    try { session = A.create(id, instruction); } catch (e) { return BW.error(e); }
    render(); window.scrollTo(0, 0);
    turn('');
  }

  function renderSession() {
    const s = session;
    main.innerHTML = `
      <div style="padding-top:18px"><button class="btn btn-ghost" data-back style="margin-left:-10px">← Olaf</button></div>
      <div class="page-head" style="padding-top:6px"><div><h1>🧭 ${esc(pretty(s.skillId))}</h1><p class="lead" data-cost>${costLine()}</p></div></div>
      <div class="runner">
        <div>
          <div class="thread" data-thread>${s.view.map(bubble).join('')}</div>
          <form class="card composer" data-send>
            <textarea class="in" data-input placeholder="${s.finished ? 'This conversation is finished.' : 'Reply to Olaf…'}" aria-label="Your reply" ${s.finished ? 'disabled' : ''}></textarea>
            <div class="row-flex"><small class="faint">${esc(BW.ai.model.model)} · ⌘↵ to send</small><div class="spacer"></div>
              <button type="button" class="btn btn-ghost" data-stop hidden>⏹ Stop</button>
              ${s.finished ? '' : '<button type="button" class="btn" data-finish>✅ Finish</button><button class="btn btn-primary" data-go>Send</button>'}</div>
          </form>
        </div>
        <aside class="side-info">
          <div class="card"><b>📄 Files from this conversation</b><div data-files style="margin-top:8px">${filesList()}</div></div>
          <div class="card"><small class="faint">Olaf works from your brand documents and memory, follows the marketing foundation, and never invents facts. Pages it reads on the web are treated as information, never as instructions.</small></div>
        </aside>
      </div>`;
    $('[data-back]', main).onclick = () => { session = null; render(); };
    const form = $('[data-send]', main), input = $('[data-input]', main);
    input.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit(); } };
    form.onsubmit = (e) => { e.preventDefault(); if (!s.finished && input.value.trim()) turn(input.value); };
    const fin = $('[data-finish]', main); if (fin) fin.onclick = async () => { await A.finish(s); BW.toast('Conversation finished', '✅'); session = null; tab = 'history'; render(); };
    $('[data-stop]', main).onclick = () => running && running.abort();
    bindFiles();
    if (running) setBusy(true);
  }
  const costLine = () => `This conversation: $${(session.cost || 0).toFixed(2)} of your $${A.runCap.toFixed(2)} limit · ${session.files.length} file(s) written`;
  const filesList = () => session.files.length ? session.files.map((p) => `<button class="btn btn-ghost" data-open="${esc(p)}" style="display:block;text-align:left">📄 ${esc(p)}</button>`).join('') : '<small class="faint">None yet.</small>';
  function bindFiles() { $$('[data-open]', main).forEach((b) => b.onclick = () => { openFile = b.dataset.open; session = null; tab = 'files'; render(); }); }

  function bubble(m) {
    if (m.role === 'me') return `<div class="bubble me">${esc(m.text)}</div>`;
    return `<div class="bubble">${work(m)}<div class="md">${BW.md(m.text)}</div></div>`;
  }

  // What Olaf did on the way: tool steps as chips, and any remarks it made in between, in grey.
  function work(m) {
    const chips = (m.tools || []).map((t) => `<span>${esc(t)}</span>`).join('');
    const notes = (m.notes || []).map((n) => `<p>${esc(n)}</p>`).join('');
    return `<div class="tools">${chips}</div>${notes ? `<div class="notes">${notes}</div>` : ''}`;
  }

  function setBusy(on) {
    const go = $('[data-go]', main), stop = $('[data-stop]', main);
    if (go) go.disabled = on; if (stop) stop.hidden = !on;
  }

  async function turn(text) {
    const s = session, ctrl = new AbortController();
    running = ctrl;
    if (text) { const i = $('[data-input]', main); if (i) i.value = ''; }
    const thread = () => $('[data-thread]', main);
    let live = null, status = 'Olaf is reading your files';
    const paint = (b) => {
      if (session !== s || !thread()) return;
      if (!live) { thread().insertAdjacentHTML('beforeend', '<div class="bubble" data-live><div data-work></div><div class="md" data-md></div><div class="status" data-status></div></div>'); live = $('[data-live]', main); }
      $('[data-work]', live).innerHTML = work(b);
      $('[data-md]', live).innerHTML = BW.md(b.text);
      $('[data-status]', live).innerHTML = `<span class="dots3">${esc(status)}</span>`;
    };
    if (text && thread()) thread().insertAdjacentHTML('beforeend', `<div class="bubble me">${esc(text.trim())}</div>`);
    setBusy(true);
    let cur = { text: '', tools: [] };
    paint(cur);
    try {
      await A.send(s, text, {
        text: (t, b) => { cur = b; paint(b); },
        status: (t) => { status = t; paint(cur); },
        tool: () => { cur = s.view[s.view.length - 1]; status = 'Working'; paint(cur); },
        file: () => { const f = $('[data-files]', main); if (f && session === s) { f.innerHTML = filesList(); bindFiles(); } },
        cost: () => { const c = $('[data-cost]', main); if (c && session === s) c.textContent = costLine(); },
      }, ctrl.signal);
    } catch (e) {
      if (e.name !== 'AbortError') BW.error(e); else BW.toast('Stopped', '⏹');
    } finally {
      running = null;
      await WS.load();
      if (session === s) renderSession();
    }
  }
})();
