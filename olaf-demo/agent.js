/* Olaf's conversation loop. A run is a conversation with one skill: Olaf works (calling its tools as
   often as it needs), and when it has nothing left to do or needs the owner, the turn ends and the
   owner replies. Every round is saved, so closing the tab loses nothing.

   Two rules keep Claude's earlier reasoning valid across turns: the system prompt a session started
   with is stored and reused as-is, and assistant turns go back exactly as Claude sent them. */
(function () {
  'use strict';
  // The language Busy speaks (shared/i18n.js): the expert talks and writes in it, with that country's ways.
  const LANG_NAMES = { nl: 'Dutch', de: 'German', es: 'Spanish', it: 'Italian', 'pt-br': 'Brazilian Portuguese' };
  const langNote = () => {
    const n = LANG_NAMES[window.BusyLang];
    return n ? `## Language\n\nBusy is set to ${n}. Talk to the person in ${n}, and write what you make for them in ${n} unless they ask for another language. Where it matters, use that country's rules, currency, dates and customs.` : '';
  };
  const LIB = BW.olafLibrary, WS = BW.olafWs;
  const COLL = 'olaf-sessions';
  const MAX_ROUNDS = 30;  // per turn
  const MAX_PAUSES = 4;   // long web research can pause a turn
  const KEEP = 15;        // sessions kept; older finished ones are pruned

  const BASE = 'Demo edition: Olaf\'s instructions ship only with the paid download.';

  // Project skills stand on the project foundation; every other skill on the marketing foundation.
  const isProject = (id) => id.startsWith('project-');
  const foundation = (id) => { const s = LIB.skills.find((x) => x.id === (isProject(id) ? 'project-foundation' : 'marketing-foundation')); return s ? s.body : ''; };

  function brandContext(skillId = '') {
    const parts = [];
    for (const path of ['brand-documents/brand-growth-profile.md', 'brand-documents/product-marketing-context.md', 'brand-documents/brand-voice.md', 'brand-documents/icps.md', 'memory/hot-cache.md', 'memory/marketing-journey.md']) {
      const c = WS.read(path);
      if (c && c.trim()) parts.push(`### ${path}\n\n${c.trim().slice(0, 60000)}`);
    }
    const s = BW.settings;
    const facts = [['Business name', s.businessName], ['Website', s.website], ['Location', [s.city, s.country].filter(Boolean).join(', ')], ['Currency', s.currency]].filter(([, v]) => v);
    if (facts.length) parts.unshift('### From Busy settings\n\n' + facts.map(([k, v]) => `**${k}:** ${v}`).join('\n'));
    if (!isProject(skillId) && !WS.isFilled('brand-documents/brand-growth-profile.md')) parts.push('Note: the growth profile is still mostly blank. Do the work anyway, and say that running onboarding first would make the output specific to this business.');
    return '## Who you are working for\n\nThese are the owner\'s own files. Follow them; the voice rules are not suggestions.\n\n' + parts.join('\n\n---\n\n');
  }

  // Weekdays worked out by the model go wrong, and a plan for "Wednesday" has to be Wednesday: every
  // conversation gets the date in full and the next two weeks as a calendar.
  const dayName = (iso, o) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', o);
  function today() {
    const t = BW.today(), days = Array.from({ length: 14 }, (_, i) => BW.addDays(t, i));
    return `Today is ${dayName(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${t}). The next two weeks: `
      + days.map((d) => `${dayName(d, { weekday: 'short', day: 'numeric', month: 'short' })} = ${d}`).join(', ') + '.'
      // Deadlines are often further away: the Mondays of the next three months, to count from.
      + ' After that, weeks start on Monday ' + mondays(BW.addDays(t, 14), 12).map((d) => dayName(d, { day: 'numeric', month: 'short' })).join(', ') + '.';
  }
  function mondays(from, n) {
    let d = from; while (new Date(d + 'T12:00:00').getDay() !== 1) d = BW.addDays(d, 1);
    return Array.from({ length: n }, (_, i) => BW.addDays(d, 7 * i));
  }

  function skillContext(s) {
    return `## The skill you are running: ${s.id}\n\n${s.description}\n\nFollow these instructions:\n\n${s.body}`;
  }

  // What Olaf chooses from: every skill by group, with when to use it. Descriptions are cut to their first
  // sentences (some imported ones run long) and anything that is not Latin script is dropped.
  const HOW_TO_CHOOSE = 'Each skill is a way of working written for one job. Before you start a job, pick the skill that fits and call use_skill to read it, then follow it. Do this even when you think you know how: the skill holds the steps, the tools to use and the limits. One conversation can use several skills, one after the other. The skills under "Specialist" were written for bigger marketing teams: use one only when the owner asks for exactly that job, or when nothing above it fits. If nothing fits at all, work from the foundation and say so.';
  // Groups a small-business owner rarely needs: kept, and kept out of the way (the same test as on the Skills page).
  const SHELF = /website, search|launches, ads|numbers & upkeep/i;
  const brief = (d) => { const t = String(d || '').replace(/[\u2e80-\u9fff\uff00-\uffef]+[^.]*$/, '').replace(/\s+/g, ' ').trim(); return t.length > 260 ? t.slice(0, 257).replace(/\s+\S*$/, '') + '…' : t; };
  function skillIndex(except) {
    const by = new Map(LIB.skills.map((x) => [x.id, x])), seen = new Set(['marketing-foundation', 'project-foundation', except]);
    const line = (id) => { const x = by.get(id); if (!x || seen.has(id)) return ''; seen.add(id); return `- ${id}: ${brief(x.description)}`; };
    const tight = (id) => { const l = line(id); return l.length > 150 ? l.slice(0, 147).replace(/\s+\S*$/, '') + '…' : l; };
    const parts = (LIB.groups || []).filter(([title]) => !SHELF.test(title)).map(([title, ids]) => { const rows = ids.map(line).filter(Boolean); return rows.length ? `### ${String(title).replace(/^\S+\s/, '')}\n${rows.join('\n')}` : ''; }).filter(Boolean);
    const shelf = (LIB.groups || []).filter(([title]) => SHELF.test(title)).flatMap(([, ids]) => ids.map(tight)).filter(Boolean);
    const rest = LIB.skills.map((x) => line(x.id)).filter(Boolean);
    if (rest.length) parts.push('### Other\n' + rest.join('\n'));
    if (shelf.length) parts.push('### Specialist\n' + shelf.join('\n'));
    return parts.join('\n\n');
  }

  const agent = (BW.olafAgent = {
    BASE,
    get runCap() { try { return Number(localStorage.getItem('bw.olafRunCap')) || 2; } catch (e) { return 2; } },
    set runCap(v) { try { localStorage.setItem('bw.olafRunCap', String(v || 2)); } catch (e) { /* private window */ } },

    async list() { return (await BW.store.all(COLL)).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); },
    async get(id) { return BW.store.get(COLL, id); },
    async finish(s) { s.finished = true; await save(s); },
    async remove(id) { await BW.store.remove(COLL, id); },

    // skillId: one of the skills, or '' for a conversation where Olaf chooses the skill himself ("Ask Olaf").
    create(skillId, instruction) {
      const s = skillId ? LIB.skills.find((x) => x.id === skillId) : null;
      if (skillId && !s) throw new Error('There is no skill called ' + skillId);
      const system = [{ type: 'text', text: BASE }];
      if (skillId !== 'marketing-foundation' && skillId !== 'project-foundation') system.push({ type: 'text', text: foundation(skillId || '') });
      system.push({ type: 'text', text: brandContext(skillId || '') });
      if (s) system.push({ type: 'text', text: skillContext(s) + `\n\n## Your other skills\n\nWhen the conversation moves on to another job, the same rule holds. ${HOW_TO_CHOOSE}\n\n${skillIndex(s.id)}` });
      else system.push({ type: 'text', text: `## Your skills\n\nNo skill was chosen for this conversation: you choose. ${HOW_TO_CHOOSE}\n\n${skillIndex()}` });
      if (langNote()) system.push({ type: 'text', text: langNote() });
      const opening = [s ? `Run the ${s.id} skill now.` : 'The owner opened a conversation with you.'];
      if (instruction && instruction.trim()) opening.push('\nWhat the owner asked for:\n' + instruction.trim());
      else opening.push(s ? `\nNo extra instruction was given. Work from brand-documents/ and memory/, and ask the owner for what you genuinely need${s.hint ? ` (${s.hint})` : ''}.` : '\nGreet them briefly, look at where the business stands, and suggest the one most useful thing to do now.');
      opening.push('\n' + today());
      return { skillId: skillId || '', title: (instruction && instruction.trim().slice(0, 80)) || (s ? s.id : 'Ask Olaf'), system, messages: [{ role: 'user', content: opening.join('\n') }],
        view: instruction && instruction.trim() ? [{ role: 'me', text: instruction.trim() }] : [], cost: 0, files: [], finished: false, model: BW.ai.model.id, day: BW.today() };
    },

    /* Takes one turn. `ui` gets live updates: text(chunk), status(text), tool(name, detail), file(path).
       Resolves when Claude ends its turn: finished work, or a question for the owner. */
    async send(s, text, ui = {}, signal) {
      if (text && text.trim()) {
        // Coming back on another day: Claude gets the new date with the message.
        const dated = s.day && s.day !== BW.today() ? `(${today()})\n\n` : '';
        s.day = BW.today();
        s.messages.push({ role: 'user', content: dated + text.trim() }); s.view.push({ role: 'me', text: text.trim() });
      }
      const m = BW.ai.MODELS.find((x) => x.id === s.model) || BW.ai.model; // a conversation stays on the model it started with
      const tools = WS.TOOLS.concat(BW.ai.webTools(m, { maxUses: 8 }));
      const bubble = { role: 'olaf', text: '' };
      s.view.push(bubble);
      let pauses = 0, fresh = true;
      try {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          if (signal && signal.aborted) throw new DOMException('Stopped', 'AbortError');
          BW.ai.checkReady();
          fresh = true;
          const startLen = bubble.text.length;
          const r = await BW.ai.once({ m, system: s.system, messages: s.messages, tools, maxTokens: 32000, signal,
            onText: (t) => { if (fresh && bubble.text.trim()) bubble.text += '\n\n'; fresh = false; bubble.text += t; if (ui.text) ui.text(t, bubble); }, onStatus: ui.status });
          const c = BW.ai.cost(r.usage, m);
          s.cost += c; BW.ai.addSpend(c);
          if (ui.cost) ui.cost(s.cost);
          if (r.stopReason === 'refusal') throw new Error('Claude declined this request. Try rephrasing what you asked for.');
          // After a paused turn the continuation belongs to the same assistant turn: add its blocks
          // to the end rather than starting a second assistant message.
          const last = s.messages[s.messages.length - 1];
          if (last && last.role === 'assistant') last.content = last.content.concat(r.content);
          else s.messages.push({ role: 'assistant', content: r.content });
          if (r.stopReason === 'pause_turn' && pauses < MAX_PAUSES) { pauses++; if (ui.status) ui.status('Still researching…'); await save(s); continue; }

          const calls = r.content.filter((b) => b.type === 'tool_use');
          // Text written before a tool call is a working note, not the answer: keep it out of the reply.
          if (calls.length && bubble.text.length > startLen) {
            const note = bubble.text.slice(startLen).trim();
            bubble.text = bubble.text.slice(0, startLen).trimEnd();
            if (note) (bubble.notes = bubble.notes || []).push(note);
            if (ui.text) ui.text('', bubble);
          }
          if (!calls.length) {
            if (r.stopReason === 'max_tokens') bubble.text += '\n\n*(Olaf hit the length limit here. Reply "carry on" to continue.)*';
            break;
          }
          if (s.cost >= agent.runCap) {
            bubble.text += `\n\n*This run reached its limit of $${agent.runCap.toFixed(2)} and stopped. Anything saved in output/ is kept. Raise the limit in AI settings, or give Olaf a narrower job.*`;
            // The tool calls still need answers, or the conversation could not continue later.
            s.messages.push({ role: 'user', content: calls.map((b) => ({ type: 'tool_result', tool_use_id: b.id, content: 'Not run: this run reached its spending limit. Stop and summarise what you have.', is_error: true })) });
            break;
          }
          // Every tool call needs exactly one result, and all of them go back in one message.
          const results = [];
          for (const b of calls) {
            (bubble.tools = bubble.tools || []).push(describe(b));
            if (ui.tool) ui.tool(b.name, describe(b));
            const out = await WS.dispatch(b.name, b.input);
            const isErr = out && typeof out === 'object';
            if (b.name === 'write_file' && !isErr) { const p = String(b.input.path || ''); if (p && !s.files.includes(p)) s.files.push(p); if (ui.file) ui.file(p); }
            results.push({ type: 'tool_result', tool_use_id: b.id, content: isErr ? out.error : out, is_error: isErr || undefined });
          }
          s.messages.push({ role: 'user', content: results });
          await save(s);
          if (round === MAX_ROUNDS - 1) bubble.text += '\n\n*This turn hit the safety limit of steps. Reply with a narrower instruction to carry on.*';
        }
      } finally {
        if (!bubble.text.trim()) bubble.text = s.files.length ? 'Done. See the files below.' : '…';
        await save(s);
      }
      return s;
    },
  });

  function describe(b) {
    const i = b.input || {};
    if (b.name === 'write_file') return 'Writing ' + i.path;
    if (b.name === 'read_file') return 'Reading ' + i.path;
    if (b.name === 'list_dir') return 'Looking in ' + (i.path || 'the workspace');
    if (b.name === 'use_skill') return 'Looking up how to do this well';
    if (b.name === 'business_numbers') return 'Reading your sales numbers';
    if (b.name === 'check_voice') return 'Checking the writing';
    if (b.name === 'operations_overview') return 'Reading your invoices, quotes and clients';
    if (b.name === 'invoice_get') return 'Reading ' + (i.number || 'an invoice');
    if (b.name === 'invoice_draft') return `Preparing a draft ${i.kind || 'invoice'} for ${i.client || 'a client'}`;
    if (b.name === 'document_add') return 'Writing ' + (i.title || 'a document');
    if (b.name === 'plan_list') return 'Reading your plan';
    if (b.name === 'plan_add') return `Adding ${((b.input || {}).activities || []).length} activities to your plan`;
    if (b.name === 'plan_update') return 'Updating your plan';
    if (b.name === 'log_numbers') return 'Recording your numbers';
    if (b.name === 'content_list') return 'Reading your content calendar';
    if (b.name === 'content_add') return `Adding ${((b.input || {}).items || []).length} posts to your calendar`;
    if (b.name === 'content_update') return 'Updating your content calendar';
    if (b.name === 'project_list') return 'Reading your projects';
    if (b.name === 'project_get') return 'Reading the project plan';
    if (b.name === 'project_create') return 'Creating the project';
    if (b.name === 'project_update') return 'Updating the project brief';
    if (b.name === 'people_add') return 'Adding people to the team';
    if (b.name === 'plan_items_add') { const i = b.input || {}; return `Adding ${(i.milestones || []).length} milestones and ${(i.tasks || []).length} tasks to the plan`; }
    if (b.name === 'task_update') return 'Updating a task';
    if (b.name === 'milestone_update') return 'Updating a milestone';
    if (b.name === 'project_log_add') { const k = (b.input || {}).kind || 'note'; return `Writing ${k === 'update' ? 'an update' : 'a ' + k} in the project log`; }
    return b.name;
  }

  async function save(s) {
    await BW.store.put(COLL, s);
    // Keep the collection small: finished conversations beyond the newest few go.
    const all = await agent.list();
    const old = all.filter((x) => x.finished).slice(KEEP);
    for (const x of old) await BW.store.remove(COLL, x.id);
  }
})();
