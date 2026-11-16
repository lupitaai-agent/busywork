/* The link between Busy and the person's own Claude: no key, no second bill.

   The expert's skills are a plugin in the person's Claude. Busy's folder is where the two meet, in a folder
   called "Claude" inside it:
     Claude/START HERE.md   what this is, for Claude and for a curious person
     Claude/now/            the briefing: Busy writes it (where things stand), Claude reads it
     Claude/files/          the expert's own files (profile, notes, finished work): both read and write
     Claude/cards/          Claude writes one card per piece of prepared work; Busy shows it as "Needs your yes"
     Claude/done/           Busy moves a card here once the person said yes or no
   Claude never changes Busy's own records. A card holds the changes as a list of the expert's own tool calls, and
   Busy runs them itself when the person says yes: the same code the key-based expert uses.

   Loaded by core.js on every page of an edition that has the expert (apps/<expert>/room/link.js). It provides
   BW.cards (read by shared/frame.js), BW.askExpert, the expert's card in the rail, and the three steps to connect.
   It does nothing until the person connects, and after that only when something changed. */
(function () {
  'use strict';
  const BW = window.BW;
  const x = BW.EXPERTS && BW.EXPERTS[BW.suite];
  if (!x || BW.expertLink) return;
  const { esc } = BW;
  // The website demo: pretend cards, so a visitor sees what the expert prepares. No AI, and nothing is kept.
  const DEMO = (x.id === 'olaf' && BW.olafEdition === 'demo') || !!(window.BW_HOST && window.BW_HOST.expertDemo);
  const DIR = 'Claude';
  const STUB = { edition: 'full', skills: [], refs: {}, templates: {}, groups: [], voice: { words: [], phrases: [] } };
  /* read: tools whose answer is the briefing (no input needed). detail: one file per open thing, for the tools
     that need an id. never: tools that make no sense on a card. Every other tool may be used on a card. */
  const CFG = {
    olaf: { plugin: 'busy-business', app: 'Busy Business', hello: 'Set up Busy Business with me', coll: 'olaf-files', lib: 'olafLibrary', tools: () => BW.olafWs, dirs: ['brand-documents', 'memory', 'output', 'content-inbox'],
      scripts: ['shared/ai.js', 'apps/marketing/profile.js', 'shared/mkt-dash.js', 'shared/mkt-insights.js', 'shared/qr.js', 'shared/mkt-content.js', 'shared/projects.js', 'apps/olaf/workspace.js'],
      read: ['operations_overview', 'business_numbers', 'plan_list', 'content_list', 'project_list'],
      never: ['list_dir', 'read_file', 'write_file', 'use_skill', 'check_voice', 'invoice_get', 'project_get'],
      detail: [['invoices', 'invoice_get', 'operations_overview', (o) => [].concat(o.waitingForPayment || [], o.draftsNotSent || [], o.quotesOut || []).map((i) => ({ number: i.number }))],
        ['projects', 'project_get', 'project_list', (o) => (o.projects || []).filter((p) => p.status !== 'done').map((p) => ({ id: p.id }))]],
      ask: ['What needs me today?', 'Put my brand on one page', 'Write this week’s post'] },
    ivy: { plugin: 'busy-growth', app: 'Busy Growth', hello: 'Set up Busy Growth with me', coll: 'ivy-files', lib: 'ivyLibrary', tools: () => BW.ivyTools, dirs: ['', 'output'],
      scripts: ['shared/growth.js', 'shared/ai.js', 'apps/ivy/tools.js'],
      read: ['growth_overview', 'skills_list', 'wins_list', 'learning_list', 'applications_list', 'career_list', 'cv_list', 'stories_list', 'contacts_list', 'reviews_list', 'library_search'],
      never: ['list_files', 'read_file', 'write_file', 'use_skill', 'check_voice', 'suggest_next', 'library_read', 'application_get'],
      detail: [['applications', 'application_get', 'applications_list', (o) => (Array.isArray(o) ? o : []).map((a) => ({ id: a.id }))]],
      ask: ['What am I worth?', 'Get me ready for my review', 'Help me find what I achieved this year'] },
    juno: { plugin: 'busy-home', app: 'Busy Home', hello: 'Set up Busy Home with me', coll: 'juno-files', lib: 'junoLibrary', tools: () => BW.junoTools, dirs: ['', 'output'],
      scripts: ['shared/house.js', 'shared/filetext.js', 'shared/ai.js', 'apps/juno/tools.js'],
      read: ['home_overview', 'papers_list', 'contracts_list', 'upkeep_list', 'inventory_list', 'letters_list', 'binder_list', 'move_get'],
      never: ['list_files', 'read_file', 'write_file', 'use_skill', 'check_voice', 'suggest_next', 'papers_search', 'paper_read', 'open_document'],
      detail: [],
      ask: ['What do I need to do this week?', 'I have a letter I do not understand', 'What do we pay for every month?'] },
  }[x.id];
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } } };
  const jget = (k, d) => { try { return JSON.parse(ls.get(k)) || d; } catch (e) { return d; } };
  const K = (n) => `bw.claude.${n}:${x.id}`;
  const MODE = 'bw.expert.mode:' + x.id;
  const mode = () => (DEMO ? 'claude' : ls.get(MODE) || '');
  const folder = () => !!BW.store && BW.store.kind === 'folder';
  const live = () => !DEMO && folder() && mode() === 'claude';

  // ---------- files in the Claude folder ----------
  const readText = async (path) => { const f = await BW.store.readFile(path); if (!f) return null; return typeof f.text === 'function' ? f.text() : new TextDecoder().decode(f); };
  const writeText = (path, text) => BW.store.writeFile(path, new Blob([text], { type: 'text/plain' }), { download: false });
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36) + ':' + s.length; };

  // The expert's own tools, loaded when the first briefing or the first card needs them: never on a page that has no use for them.
  let ready = null;
  const loaded = (src) => [...document.scripts].some((s) => (s.src || '').split('?')[0].endsWith('/' + src));
  function tools() {
    if (!ready) ready = (async () => {
      if (!CFG.tools()) {
        BW[CFG.lib] = BW[CFG.lib] || STUB; // the skills themselves live in the Claude plugin; the tools only need the shape
        for (const src of CFG.scripts) if (!loaded(src)) await BW.loadScript(BW.root + src);
      }
      const t = CFG.tools();
      if (t.ensureSeeded) await t.ensureSeeded();
      return t;
    })();
    return ready;
  }

  const START = () => `# Busy and Claude meet here

This folder belongs to ${CFG.app}. ${x.name}, ${String(x.role).toLowerCase()}, works from it.

- now/    Where things stand today. Busy writes these files. Read them; never change them.
- files/  ${x.name}'s own files: what was learned, and finished work. Read and write here.
- cards/  One card (a .json file) for each piece of work that changes something in Busy.
          The person sees it in Busy as "Needs your yes". Busy makes the change when they say yes.
- done/   Cards the person answered. Read them to see what was accepted and what was not.

Never change any other file in the Busy folder: Busy keeps its records there.
The skill "${x.id}" of the ${CFG.plugin} plugin explains the rest.
`;

  /* The briefing: where things stand, as the expert's own reading tools tell it. One file per tool, written only
     when it says something new. */
  let briefing = null;
  function brief(force) {
    if (!live()) return Promise.resolve();
    if (briefing) return briefing;
    briefing = (async () => {
      const t = await tools(), today = BW.today(), wrote = force ? {} : jget(K('now'), {});
      const put = async (path, text) => { const h = hash(text); if (wrote[path] === h) return; await writeText(`${DIR}/${path}`, text); wrote[path] = h; };
      await put('START HERE.md', START());
      const s = BW.settings, who = [['Name', x.id === 'olaf' ? s.businessName : s.ownerName], ['Owner', x.id === 'olaf' ? s.ownerName : ''], ['Lives with', s.household], ['Now', s.headline], ['Heading for', s.targetRole], ['Goal', s.goal],
        ['Moment', s.moment ? `${s.moment}${s.momentDate ? ' on ' + s.momentDate : ''}` : ''], ['Website', s.website], ['City', s.city], ['Country', s.country], ['Currency', s.currency], ['Language', window.BusyLang || 'en']].filter(([, v]) => v);
      const day = (d, o) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', o);
      const days = Array.from({ length: 14 }, (_, i) => BW.addDays(today, i)).map((d) => `${day(d, { weekday: 'short', day: 'numeric', month: 'short' })} = ${d}`).join(', ');
      await put('now/today.md', `# Today\n\nToday is ${day(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${today}).\nThe next two weeks: ${days}.\nTake weekdays from this list; never work one out yourself.\n\n# Who this is\n\n${who.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`);
      const said = {};
      for (const name of CFG.read) {
        let out; try { out = await t.dispatch(name, {}); } catch (e) { out = { error: String(e.message || e) }; }
        said[name] = out;
        await put(`now/${name}.md`, `# ${name}\n\nWhat Busy's "${name}" says today (${today}).\n\n${typeof out === 'string' ? out : 'Not available: ' + (out && out.error)}\n`);
      }
      for (const [file, tool, from, ids] of CFG.detail) {
        let list = []; try { list = ids(JSON.parse(said[from])); } catch (e) { /* nothing to show yet */ }
        const parts = [];
        for (const input of list.slice(0, 40)) { const out = await t.dispatch(tool, input); if (typeof out === 'string') parts.push(out); }
        await put(`now/${file}.md`, `# ${file}\n\nEach open one in full, as Busy's "${tool}" gives it (${today}).\n\n${parts.join('\n\n---\n\n') || 'None open.'}\n`);
      }
      // The real brand files the owner keeps in the Brand Kit: Claude can open them where they are.
      if (x.id === 'olaf') {
        const bf = (await BW.store.listFiles('Brand files')).filter((n) => !n.startsWith('.')).sort();
        await put('now/brand_files.md', `# Brand files\n\nThe owner's real brand files (logo versions, fonts, photos, the brand guide), kept with the Brand Kit in the folder "Brand files" next to this "Claude" folder. Open them there; never change, move or delete them. To suggest a new file, write it to files/output/ and say so.\n\n${bf.map((n) => `- Brand files/${n}`).join('\n') || 'None yet. The owner adds them in Busy: Brand Kit, Your brand files.'}\n`);
      }
      // The expert's own files, as real files Claude can read and write.
      const seen = jget(K('sync'), {});
      for (const r of await BW.store.all(CFG.coll)) {
        if (!r.path || r.content == null || /(^|\/)README\.md$/.test(r.path)) continue;
        const h = hash(r.content), p = `${DIR}/files/${r.path}`;
        if (seen[r.path] === h) continue;
        const disk = seen[r.path] ? await readText(p) : null;
        if (disk != null && hash(disk) !== seen[r.path]) continue; // Claude changed it meanwhile: the next pick-up takes that in first
        await writeText(p, r.content); seen[r.path] = h;
      }
      ls.set(K('sync'), JSON.stringify(seen)); ls.set(K('now'), JSON.stringify(wrote)); ls.set(K('briefed'), today); ls.set(K('dirty'), '');
    })().catch((e) => console.warn('The briefing for Claude was not written:', e && e.message)).finally(() => { briefing = null; });
    return briefing;
  }

  /* What Claude wrote into files/: taken into Busy, and remembered so "Done for you" can name it. */
  async function pickUp() {
    if (!live()) return [];
    const seen = jget(K('sync'), {}), fresh = [];
    for (const dir of CFG.dirs) {
      for (const n of await BW.store.listFiles(`${DIR}/files${dir ? '/' + dir : ''}`)) {
        if (!/\.(md|txt)$/i.test(n)) continue;
        const path = (dir ? dir + '/' : '') + n, text = await readText(`${DIR}/files/${path}`);
        if (text == null || text.length > 200000 || seen[path] === hash(text)) continue;
        fresh.push([path, text]);
      }
    }
    if (!fresh.length) return [];
    const t = await tools(), took = [];
    for (const [path, text] of fresh) {
      const out = await t.dispatch('write_file', { path, content: text });
      seen[path] = hash(text);
      if (out && typeof out === 'object') console.info('Not taken from Claude:', path, out.error); else took.push(path);
    }
    ls.set(K('sync'), JSON.stringify(seen));
    if (took.length) ls.set(K('wrote'), JSON.stringify(jget(K('wrote'), []).concat(took.map((p) => ({ p, at: Date.now() }))).slice(-30)));
    return took;
  }

  // ---------- cards ----------
  const allowed = async (tool) => { const t = await tools(); return t.TOOLS.some((d) => d.name === tool) && !CFG.never.includes(tool) && !CFG.read.includes(tool); };
  // What a step on a card does, in plain words (for "Look").
  const WHAT = { plan_add: 'Add to your marketing plan', plan_update: 'Change your marketing plan', log_numbers: 'Record the numbers of the month', content_add: 'Put posts on your calendar', content_update: 'Change a post on your calendar',
    project_create: 'Start a project', project_update: 'Change a project', people_add: 'Add people to the team', plan_items_add: 'Add tasks to a project', task_update: 'Change a task', milestone_update: 'Change a milestone',
    project_log_add: 'Write in the project log', invoice_draft: 'Prepare a draft in Invoices & Quotes', document_add: 'Save a letter in the Document Maker',
    library_add: 'Save in your Library', skills_update: 'Update your Skills Map', learning_add: 'Add to your Learning Planner', learning_update: 'Update your Learning Planner', wins_add: 'Add to your Wins Log',
    application_add: 'Add a job to your Job Tracker', application_update: 'Update an application', career_update: 'Update your career history', career_add: 'Add to your career history', profile_update: 'Save your headline and About',
    cv_create: 'Make a CV version', stories_add: 'Save interview stories', contact_update: 'Update a contact', review_save: 'Save your weekly review',
    paper_add: 'File documents in Paper Trail', paper_update: 'Update a document', contract_add: 'Add a contract', contract_update: 'Update a contract', upkeep_add: 'Add an upkeep job', upkeep_update: 'Update an upkeep job',
    upkeep_done: 'Mark a job as done', inventory_add: 'Add to your Home Inventory', letter_create: 'Save a letter in Letters', move_create: 'Start a move', move_add_tasks: 'Add tasks to the move', binder_add: 'Add to the Just in Case binder' };
  const say = (c) => { const i = c.input || {}, n = i.title || i.name || i.client || i.company || ''; return `${BW.t(WHAT[c.tool] || String(c.tool || '').replace(/_/g, ' '))}${n ? ': ' + n : ''}`; };
  async function readCard(file) {
    const raw = await readText(`${DIR}/cards/${file}`);
    if (raw == null) return null;
    let c; try { c = JSON.parse(raw); } catch (e) { return { id: file, bad: 'This card is not readable.' }; }
    if (!c || typeof c.title !== 'string' || !c.title.trim()) return { id: file, bad: 'This card has no title.' };
    const calls = Array.isArray(c.calls) ? c.calls.slice(0, 25) : [];
    for (const k of calls) if (!k || typeof k.tool !== 'string' || !(await allowed(k.tool))) return { id: file, title: c.title.slice(0, 160), bad: `This card wants to use "${k && k.tool}", which ${x.name} may not change.` };
    return { id: file, title: c.title.trim().slice(0, 160), why: String(c.why || '').slice(0, 300), emoji: String(c.emoji || '📝').slice(0, 4), show: String(c.show || '').slice(0, 20000), calls };
  }
  const DEMO_CARDS = { olaf: async () => {
    const today = BW.today(), inv = (await BW.store.all('invoices')).filter((i) => i.kind === 'invoice' && i.status === 'sent' && i.dueDate < today && BW.balanceOf(i) > 0)[0];
    const post = (await BW.store.all('mktcontent')).find((p) => p.status === 'ready' || p.status === 'draft');
    const who = inv ? (inv.client || {}).name || 'a client' : '', me = BW.settings.ownerName || BW.settings.businessName || '';
    return [inv && { id: 'd1', emoji: '🧾', title: `A friendly reminder to ${who}`, why: `${Math.round((new Date(today) - new Date(inv.dueDate)) / 864e5)} days late, ${BW.money(BW.balanceOf(inv))}. Written and ready to send.`, calls: [{ tool: 'document_add', input: { title: `Reminder: invoice ${inv.number}` } }],
      show: `Hello ${who},\n\nA short note about invoice ${inv.number}: it was due on ${inv.dueDate} and is still open for ${BW.money(BW.balanceOf(inv))}.\n\nCould you take a look this week? If it is already on its way, thank you, and please ignore this.\n\nKind regards,\n${me}` },
      post && { id: 'd2', emoji: '📣', title: `This week's post: ${post.title}`, why: `${post.channel || 'A post'}, in your voice, for the moment it belongs to.`, calls: [{ tool: 'content_update', input: { title: post.title } }], show: post.text || '' },
      { id: 'd3', emoji: '⭐', title: 'A review request to your last five customers', why: 'Two lines each. Reviews are the first thing a careful buyer looks for.', calls: [{ tool: 'document_add', input: { title: 'Review request' } }],
        show: `Hello [name],\n\nThank you for choosing us. If you have two minutes, a short review would help the next person find us: [link].\n\nThank you,\n${me}` }].filter(Boolean);
  }, ivy: async () => {
    const today = BW.today();
    const apps = await BW.store.all('applications'), late = apps.find((a) => a.nextDate && a.nextDate <= today && a.status === 'applied'), talk = apps.find((a) => a.status === 'interview');
    const wins = (await BW.store.all('wins')).sort((a, b) => (a.date < b.date ? 1 : -1));
    return [wins.length && { id: 'd1', emoji: '📄', title: 'Your worth on one page, ready for your review', why: `${wins.length} results from this year, each with its proof. Two minutes to read.`, calls: [],
      show: `${BW.settings.ownerName || ''}: what I am worth\n\nThis year, in three lines\n${wins.slice(0, 3).map((w) => `- ${w.title}${w.result ? ': ' + w.result : ''}`).join('\n')}\n\nWhat I am asking for\n- The next step towards ${BW.settings.targetRole || 'my next role'}, and the pay that goes with it.` },
      late && { id: 'd2', emoji: '✉️', title: `A follow-up to ${late.company}, ready to send`, why: `You applied ${Math.round((new Date(today) - new Date(late.appliedAt || late.savedAt)) / 864e5)} days ago and heard nothing. Short and friendly.`, calls: [{ tool: 'application_update', input: { company: late.company } }],
        show: `Hello,\n\nI applied for the ${late.role || 'role'} at ${late.company} recently and wanted to ask how the timing looks on your side. I am still very interested, and happy to send anything that helps.\n\nKind regards,\n${BW.settings.ownerName || ''}` },
      talk && { id: 'd3', emoji: '🎤', title: `Three stories to tell at ${talk.company}`, why: 'Picked from your wins for what the job ad asks. Practise each once.', calls: [{ tool: 'stories_add', input: { items: [1, 2, 3] } }],
        show: wins.slice(0, 3).map((w, i) => `${i + 1}. ${w.title}\n   What you did: ${w.what || ''}\n   The result: ${w.result || ''}`).join('\n\n') }].filter(Boolean);
  }, juno: async () => {
    const today = BW.today();
    const contracts = await BW.store.all('contracts'), gym = contracts.find((c) => c.kind === 'sport') || contracts[0], energy = contracts.find((c) => c.kind === 'energy');
    const paper = (await BW.store.all('papers')).filter((p) => p.expires && p.expires > today).sort((a, b) => (a.expires < b.expires ? -1 : 1))[0];
    const letter = gym && (await BW.store.all('letters')).find((l) => l.contractId === gym.id);
    const eur = (n) => BW.money(n);
    return [gym && { id: 'd1', emoji: '✉️', title: `The letter to cancel ${String(gym.name).toLowerCase() === 'gym' ? 'the gym' : gym.name}, ready to send`, why: `It renews for a year unless the letter is there in time. That is ${eur(BW.num(gym.cost) * 12)} a year.`, calls: [{ tool: 'letter_create', input: { title: `Cancellation: ${gym.name}` } }],
      show: letter ? letter.body : `Dear sir, madam,\n\nI am cancelling my membership as of the end of the current term. Please confirm in writing.\n\nKind regards,\n${BW.settings.ownerName || ''}` },
      paper && { id: 'd2', emoji: '🪪', title: `${paper.title}: what to bring, and when to book`, why: `It runs out in ${Math.round((new Date(paper.expires) - new Date(today)) / 864e5)} days. Booking takes about a week.`, calls: [{ tool: 'upkeep_add', input: { items: [1] } }],
        show: `1. Book the appointment at the town hall this week.\n2. Bring: the old document, one recent photo, a bank card.\n3. Collect it about a week later.\n\nI put a reminder on the day you need to book by.` },
      energy && { id: 'd3', emoji: '⚡', title: 'Your energy contract: keep, switch or stop', why: `The fixed price ends soon. You pay ${eur(BW.num(energy.cost))} a month now.`, calls: [{ tool: 'contract_update', input: { name: energy.name } }],
        show: `What you pay now: ${eur(BW.num(energy.cost))} a month, fixed.\nWhat happens if you do nothing: a variable rate from next month.\n\nThree things to compare before then:\n1. The price per unit, with the standing charge.\n2. The length of the new term.\n3. The cost of leaving early.\n\nSay yes and I set the date to decide by, a week before the end.` }].filter(Boolean);
  } };
  const demoCards = () => DEMO_CARDS[x.id]();
  const DEMO_DONE = { olaf: ['Filed three receipts and counted the VAT you get back', 'Checked your brand assets: five to keep, three to test', 'Wrote this week’s update for your project'],
    ivy: ['Turned your course into two lines for your CV', 'Found three wins in your weekly reviews', 'Wrote your 30-second introduction'],
    juno: ['Read the letter from the insurer: nothing to do', 'Filed four scans with their dates', 'Added the boiler service to this month'] };
  const gone = new Set();
  const cards = (BW.cards = {
    async list() {
      if (DEMO) return (await demoCards()).filter((c) => !gone.has(c.id));
      if (!live()) return [];
      const names = (await BW.store.listFiles(`${DIR}/cards`)).filter((n) => /\.json$/i.test(n)).sort();
      const out = [];
      for (const n of names.slice(0, 20)) { const c = await readCard(n); if (c) out.push(c.bad ? { id: c.id, emoji: '⚠️', title: c.title || n, why: c.bad, calls: [], bad: c.bad } : c); }
      return out;
    },
    async done() {
      if (DEMO) return DEMO_DONE[x.id].map((title) => ({ title }));
      if (!live()) return [];
      const week = Date.now() - 7 * 864e5, out = [];
      for (const d of jget(K('yes'), []).filter((r) => r.at > week).reverse()) out.push({ title: d.title });
      for (const w of jget(K('wrote'), []).filter((r) => r.at > week).reverse()) out.push({ title: `${BW.t('Wrote')} ${w.p.replace(/^.*\//, '').replace(/\.(md|txt)$/, '').replace(/-/g, ' ')}`, path: w.p });
      return out.slice(0, 8);
    },
    async yes(id) {
      if (DEMO) { gone.add(id); BW.toast('In your own Busy this is now saved. The demo keeps nothing.', '🎭'); return; }
      const c = await readCard(id);
      if (!c || c.bad) { if (c) BW.toast(esc(c.bad), '⚠️'); return; }
      const t = await tools(), results = [];
      for (const k of c.calls) {
        const out = await t.dispatch(k.tool, k.input || {});
        if (out && typeof out === 'object') {
          await writeText(`${DIR}/cards/${id.replace(/\.json$/i, '')}.problem.txt`, `Busy could not do this card.\n\nStep: ${k.tool}\nProblem: ${out.error}\nSteps done before it: ${results.map((r) => r.tool).join(', ') || 'none'}\n\nWrite a new card (a new file name) for what is left, with this put right. Then delete this note and the old card.\n`);
          BW.toast(`${esc(x.name)} needs to put this right first: ${esc(String(out.error).slice(0, 140))}`, '⚠️');
          return;
        }
        results.push({ tool: k.tool, result: String(out).slice(0, 400) });
      }
      await writeText(`${DIR}/done/${BW.today()} ${id}`, JSON.stringify({ answer: 'yes', at: new Date().toISOString(), title: c.title, results }, null, 1));
      await BW.store.removeFile(`${DIR}/cards/${id}`);
      ls.set(K('yes'), JSON.stringify(jget(K('yes'), []).concat({ title: c.title, at: Date.now() }).slice(-30)));
      BW.toast(`${esc(c.title)}: ${BW.t('done.')}`, '✅');
      brief();
    },
    async no(id) {
      if (DEMO) { gone.add(id); return; }
      const c = await readCard(id);
      await writeText(`${DIR}/done/${BW.today()} ${id}`, JSON.stringify({ answer: 'no', at: new Date().toISOString(), title: (c && c.title) || id }, null, 1));
      await BW.store.removeFile(`${DIR}/cards/${id}`);
    },
    // A file the expert wrote, read in Busy: the same text that sits in the folder.
    async open(path) {
      const r = (await BW.store.all(CFG.coll)).find((f) => f.path === path);
      const text = r ? r.content : await readText(`${DIR}/files/${path}`);
      if (text == null) return BW.toast('This file is no longer there.', '⚠️');
      const name = path.replace(/^.*\//, '').replace(/\.(md|txt)$/i, '').replace(/-/g, ' ');
      if (!document.querySelector('link[href$="shared/ai.css"]')) document.head.append(BW.html(`<link rel="stylesheet" href="${BW.root}shared/ai.css">`));
      BW.modal({ title: `📄 ${esc(name)}`, body: BW.html(`<div class="md">${BW.md(text.replace(/^---\n[\s\S]*?\n---\n?/, ''))}</div>`), wide: true,
        actions: [{ label: 'Close', kind: 'ghost' }, { label: BW.t('Copy the text'), onClick: async () => { await BW.copy(text); BW.toast('Copied.', '📋'); return false; } }] });
    },
    async look(id) {
      const c = DEMO ? (await demoCards()).find((k) => k.id === id) : await readCard(id);
      if (!c) return;
      const body = BW.html(`<div><p class="muted">${esc(c.why || c.bad || '')}</p>${c.show ? `<pre class="card-show">${esc(c.show)}</pre>` : ''}
        ${c.calls && c.calls.length ? `<p class="k" style="margin-top:14px">${BW.t('When you say yes, Busy will')}</p><ul class="card-calls">${c.calls.map((k) => `<li>${esc(say(k))}</li>`).join('')}</ul>` : ''}</div>`);
      BW.modal({ title: `${esc(c.emoji || '📝')} ${esc(c.title)}`, body, wide: true, actions: [{ label: 'Close', kind: 'ghost' }].concat(c.bad ? [] : [{ label: 'Yes', kind: 'primary', onClick: async () => { await cards.yes(id); BW.refresh(); } }]) });
    },
  });

  // ---------- talking to Claude ----------
  const open = (url) => { if (window.BW_HOST && window.BW_HOST.platform && window.BW_HOST.platform.openUrl) BW.openUrl(url); else location.href = url; };
  // The desktop app knows the Busy folder's full path (the one the owner chose, not the default): the link names it,
  // so every new Claude task starts in that folder instead of the last one Claude remembers. Claude still asks once
  // to confirm a folder that arrives by link. In a browser there is no path, and the link goes without one.
  async function folderPath() {
    try {
      const N = window.BW_NATIVE;
      if (!N || !N.where || !folder()) return '';
      const w = await N.where(BW.suite || (document.body && document.body.dataset.suite) || 'business');
      return (w && w.path) || '';
    } catch (e) { return ''; }
  }
  async function send(text) {
    try { await BW.copy(text); } catch (e) { /* no clipboard: the link still carries it */ }
    const at = await folderPath();
    open('claude://cowork/new?q=' + encodeURIComponent(text) + (at ? '&folder=' + encodeURIComponent(at) : ''));
    BW.toast('Claude opens with your request typed in. If it stays closed, open Claude yourself and paste: the request is copied.', x.emoji || '💬');
  }
  BW.askExpert = (text) => {
    if (DEMO) return BW.toast(`In your own ${esc(CFG.app)}, ${esc(x.name)} starts on this in your Claude.`, '🎭');
    if (mode() === 'key') { location.href = `${BW.root}apps/${x.id}/index.html`; return null; }
    if (mode() !== 'claude') return connect();
    if (text) return send(`${x.name}, in my Busy folder: ${text}`);
    const box = BW.html(`<div><textarea class="in" data-q rows="4" placeholder="${esc(BW.t('Say it the way you would say it to a colleague.'))}"></textarea>
      <div class="chips" style="margin-top:10px">${CFG.ask.map((a) => `<button type="button" class="chip-btn" data-a>${esc(BW.t(a))}</button>`).join('')}</div></div>`);
    BW.$$('[data-a]', box).forEach((b) => { b.onclick = () => { BW.$('[data-q]', box).value = b.textContent; }; });
    BW.modal({ title: `${x.emoji || '💬'} ${esc(BW.t(`Ask ${x.name}`))}`, body: box, actions: [{ label: BW.t('Open the steps'), kind: 'ghost', onClick: () => { setTimeout(connect, 50); } }, { label: 'Never mind', kind: 'ghost' }, { label: BW.t('Ask in Claude') + ' →', kind: 'primary', onClick: () => { const q = BW.$('[data-q]', box).value.trim(); if (!q) return false; send(`${x.name}, in my Busy folder: ${q}`); return true; } }] });
    setTimeout(() => BW.$('[data-q]', box).focus(), 50);
    return null;
  };

  // Busy's own skill buttons, without a key: the same skill, asked in the person's Claude.
  const viaClaude = () => !DEMO && mode() !== 'key';
  const askSkill = (name, instruction) => BW.askExpert([name ? `use your skill "${name}"` : '', instruction || ''].filter(Boolean).join(': '));

  // ---------- connecting, in three steps ----------
  async function connected() {
    if (DEMO) return true;
    if (!folder()) return false;
    if (ls.get(K('met'))) return true;
    const met = !!(await readText(`${DIR}/connected.json`)) || (await BW.store.listFiles(`${DIR}/cards`)).length > 0 || (await BW.store.listFiles(`${DIR}/done`)).length > 0;
    if (met) ls.set(K('met'), '1');
    return met;
  }
  function connect() {
    const where = BW.store ? BW.store.where : '';
    const desk = window.BW_HOST && window.BW_HOST.revealFolder;
    const body = BW.html(`<div class="connect">
      <div class="idea best-key"><span class="e">🔑</span><div><b>${esc(BW.t('The best experience: a Claude API key.'))}</b> ${esc(BW.t(`${x.name} then works right here in Busy, in one conversation, with everything already open. You pay Anthropic for what you use.`))}
        <div style="margin-top:8px"><button type="button" class="btn" data-usekey>🔑 ${BW.t('Use a key')}</button></div></div></div>
      <p class="lead">${esc(BW.t('Or use the Claude app you already have:'))} ${esc(BW.t(`${x.name} works on the Claude you already have. No key, no second bill. Three steps, about two minutes.`))}</p>
      ${folder() ? '' : `<p class="idea"><span class="e">📁</span><span>${BW.t('First let Busy save in a folder (the folder button in the rail). Claude and Busy meet in that folder.')}</span></p>`}
      <div class="cstep"><i>1</i><div><b>${esc(BW.t(`Add ${x.name} to your Claude`))}</b><p>${BW.t('Save the plugin file. In Claude, open Cowork, choose Customize, then Plugins, and upload the file.')}</p>
        <button type="button" class="btn" data-plugin>⬇️ ${BW.t('Save the plugin file')}</button></div></div>
      <div class="cstep"><i>2</i><div><b>${BW.t('Show Claude your Busy folder')}</b><p>${BW.t('When Claude asks which folder to work in, choose this one:')} <b>${esc(where)}</b></p>
        ${desk ? `<button type="button" class="btn" data-reveal>📁 ${BW.t('Show the folder')}</button>` : ''}</div></div>
      <div class="cstep"><i>3</i><div><b>${BW.t('Say hello')}</b><p>${BW.t('Claude opens with the first sentence typed in. Press Enter.')}</p>
        <button type="button" class="btn btn-primary" data-hello>${x.emoji || '💬'} ${BW.t('Open Claude')}</button> <button type="button" class="btn btn-ghost" data-copy>${BW.t('Copy the sentence')}</button></div></div>
      </div>`);
    const hello = `${CFG.hello}. Use the ${CFG.plugin} plugin and work in my Busy folder.`;
    const start = async () => { if (!folder()) { BW.toast('Choose a folder for Busy first: the folder button in the rail.', '📁'); return false; } ls.set(MODE, 'claude'); await brief(true); paint(); return true; };
    // The plugin travels as a script (room/plugin.js): a page opened from a folder cannot fetch its own files.
    BW.$('[data-plugin]', body).onclick = async () => {
      try {
        if (!BW.expertPlugin) await BW.loadScript(`${BW.root}apps/${x.id}/room/plugin.js`);
        const bin = atob(BW.expertPlugin.data), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/zip' });
        if (folder()) await BW.store.writeFile(`${DIR}/${BW.expertPlugin.name}`, blob, { download: false }).catch(() => {});
        BW.download(blob, BW.expertPlugin.name);
        BW.toast(folder() ? 'Saved. A copy is also in your Busy folder, in the folder Claude.' : 'Saved.', '⬇️');
      } catch (e) { BW.toast('The plugin file is not in this copy of Busy. Download Busy again from where you bought it.', '⚠️'); }
    };
    const rv = BW.$('[data-reveal]', body); if (rv) rv.onclick = () => window.BW_HOST.revealFolder(BW.suite);
    const useKey = () => { ls.set(MODE, 'key'); location.href = `${BW.root}apps/${x.id}/index.html`; };
    BW.$('[data-usekey]', body).onclick = useKey;
    BW.$('[data-hello]', body).onclick = async () => { if (await start()) send(hello); };
    BW.$('[data-copy]', body).onclick = async () => { if (await start()) { await BW.copy(hello); BW.toast('Copied. Paste it into Claude.', '📋'); } };
    BW.modal({ title: `${x.emoji || '💬'} ${esc(BW.t(`Connect ${x.name}`))}`, body, wide: true, actions: [{ label: 'Done', kind: 'primary', onClick: () => { check(true); } }] });
  }
  BW.connectExpert = connect;

  // The expert's card at the foot of the rail says where things stand.
  async function paint() {
    const box = BW.$('[data-helper]');
    if (!box) return;
    const m = mode(), on = m === 'claude' && await connected();
    const pic = `<img src="${BW.root}apps/${x.id}/room/${x.id}-hello.png" alt="" data-pic>`, role = BW.t(x.role);
    // The expert's own room (the animated figure, the skills, the files) stays one click away, whichever way they work.
    const room = `<a class="room-go" href="${BW.root}apps/${x.id}/index.html">${esc(BW.t(`Open ${x.name}`))}</a>`;
    box.innerHTML = m === 'key' ? `${pic}<b>${esc(x.name)}</b><span>${role}.</span><a class="go" href="${BW.root}apps/${x.id}/index.html">${esc(BW.t(`Open ${x.name}`))} →</a>`
      : on ? `${pic}<b>${esc(x.name)} <small class="on" title="${esc(BW.t('Connected to your Claude'))}">●</small></b><span>${role}. ${BW.t('On your own Claude.')}</span><span class="go-row"><button type="button" class="go" data-ask>${esc(BW.t(`Ask ${x.name}`))} →</button>${room}</span>`
        : `${pic}<b>${esc(x.name)}</b><span>${role}. ${BW.t(m === 'claude' ? 'Waiting for the first hello from Claude.' : 'Works on the Claude you already have.')}</span><span class="go-row"><button type="button" class="go" data-connect>${m === 'claude' ? BW.t('Open the steps') : esc(BW.t(`Connect ${x.name}`))} →</button>${room}</span>`;
    box.hidden = false;
    const img = BW.$('[data-pic]', box); if (img) img.onerror = () => img.remove();
    const a = BW.$('[data-ask]', box); if (a) a.onclick = () => BW.askExpert();
    const c = BW.$('[data-connect]', box); if (c) c.onclick = connect;
  }

  // Look in the folder now and then: new cards, files Claude wrote. Tell the page when something changed.
  let last = null;
  async function check(force) {
    if (!live()) { paint(); return; }
    try {
      const took = await pickUp();
      const names = (await BW.store.listFiles(`${DIR}/cards`)).filter((n) => /\.json$/i.test(n)).sort().join('|');
      const changed = force || took.length || names !== (last || '');
      last = names;
      if (changed) BW.refresh();
    } catch (e) { console.info('Could not look in the Claude folder:', e && e.message); }
    paint();
  }
  BW.expertLink = { mode, brief, check, connect, paint, live, pickUp, viaClaude, askSkill, met: () => !!ls.get(K('met')) };
  paint();
  if (DEMO) return;
  const later = BW.debounce(() => brief(), 3000);
  const touched = (name) => { if (name === 'expert' || name === '*' || !live()) return; ls.set(K('dirty'), '1'); later(); };
  BW.onChange(touched);
  document.addEventListener('bw:saved', (e) => touched(e.detail));
  addEventListener('focus', () => check());
  const tick = setInterval(() => { if (!document.hidden) check(); }, 20000);
  if (tick && tick.unref) tick.unref(); // a test run ends when its work is done
  const first = setTimeout(() => { if (live() && (ls.get(K('dirty')) || ls.get(K('briefed')) !== BW.today())) brief(); check(); }, 500);
  if (first && first.unref) first.unref();
})();
