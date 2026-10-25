/* Example data: a pretend design studio, so people can see every tool full of life before they
   type a thing. Every record carries example: true, which is how "Remove example data" finds it. */
(function () {
  'use strict';
  const BW = window.BW;
  const day = (n) => BW.addDays(BW.today(), n);
  const COLLECTIONS = ['clients', 'invoices', 'time', 'expenses', 'subscriptions', 'trips', 'stock', 'projects', 'tasks', 'milestones', 'people', 'projectlog', 'catalog', 'mktprofile', 'mktplan', 'mktwaves', 'mktruns', 'mktnumbers', 'mktcontent', 'olaf-files', 'olaf-sessions'];

  async function load() {
    const id = () => BW.uid();
    const vat = BW.vatRates()[0] != null ? BW.vatRates()[0] : 21;
    const c = {
      korst: { id: id(), source: 'Recommendation', name: 'Bakkerij De Gouden Korst', contact: 'Anna de Vries', email: 'anna@goudenkorst.example', address: 'Bakkerstraat 12', postcode: '3511 AA', city: 'Utrecht', country: 'Netherlands', paymentDays: '14', lang: 'nl' },
      blauw: { id: id(), source: 'Instagram', name: 'Studio Blauw', contact: 'Lisa Blauw', email: 'lisa@studioblauw.example', address: 'Kanaalweg 9', postcode: '2512 CD', city: 'Den Haag', country: 'Netherlands', rate: '95' },
      snel: { id: id(), source: 'Walked past', name: 'Fietsenmaker Snel', contact: 'Piet Snel', email: 'piet@snel.example', address: 'Wielweg 4', postcode: '1012 AB', city: 'Amsterdam', country: 'Netherlands' },
      cafe: { id: id(), source: 'Recommendation', name: 'Café Morgenrood', contact: 'Sam Okafor', email: 'sam@morgenrood.example', address: 'Havenkade 3', postcode: '3011 EA', city: 'Rotterdam', country: 'Netherlands', paymentDays: '30' },
    };
    const snap = (k) => Object.fromEntries(['name', 'contact', 'email', 'address', 'postcode', 'city', 'country', 'vat'].map((f) => [f, c[k][f] || '']));
    const existing = await BW.store.all('invoices');
    const made = [];
    const inv = (k, o, lines) => {
      const issue = o.issueDate;
      const rec = Object.assign({ kind: 'invoice', status: 'draft', currency: BW.settings.currency, clientId: c[k].id, client: snap(k), lang: c[k].lang || '', notes: '', reverseCharge: false,
        dueDate: BW.addDays(issue, BW.num(c[k].paymentDays) || 14), items: lines.map(([desc, qty, price]) => ({ id: id(), desc, qty, price, vat })) }, o);
      rec.number = BW.nextNumber(existing.concat(made), rec.kind, issue.slice(0, 4));
      made.push(rec);
      return rec;
    };
    inv('korst', { issueDate: day(-70), status: 'paid', paidAt: day(-58) }, [['Logo design, three concepts', 1, 850], ['Brand colours and fonts', 1, 350]]);
    inv('blauw', { issueDate: day(-40), status: 'paid', paidAt: day(-30) }, [['Website design', 1, 1800], ['Copywriting, 6 pages', 6, 100]]);
    inv('snel', { issueDate: day(-28), status: 'sent', sentAt: day(-28), reminders: [{ date: day(-6), tone: 'friendly' }] }, [['Shop window graphics', 1, 450]]);
    inv('cafe', { issueDate: day(-12), status: 'sent', sentAt: day(-12), payments: [{ date: day(-5), amount: 600 }] }, [['Menu design', 1, 950], ['Menu printing, 200 copies', 200, 2.5]]);
    inv('blauw', { issueDate: day(-3), status: 'sent', sentAt: day(-3), repeat: { on: true, every: 'month', next: BW.addPeriod(day(-3), 'month') } }, [['Monthly website care', 1, 250]]);
    inv('cafe', { kind: 'quote', issueDate: day(-2), status: 'sent', sentAt: day(-2), validUntil: day(28) }, [['New interior signage', 1, 2800], ['Installation', 6, 75]]);
    inv('korst', { issueDate: day(0) }, [['Instagram templates', 10, 45]]);

    const time = [[0, 'blauw', 'Homepage tweaks', '1:45'], [-1, 'cafe', 'Signage sketches', '2:30'], [-1, 'korst', 'Instagram templates', '3:15'], [-2, 'snel', 'Phone call about poster', '0:20', false], [-3, 'blauw', 'Newsletter layout', '1:30']]
      .map(([d, k, desc, dur, bill]) => ({ date: day(d), clientId: c[k].id, desc, dur, rate: '', billable: bill !== false }));
    const expenses = [[-2, 'Adobe', 59.99, 21, 'software'], [-6, 'NS train ticket', 12.4, 9, 'travel'], [-9, 'Office supplies', 24.9, 21, 'office'], [-15, 'Lunch with Café Morgenrood', 38.5, 9, 'food'], [-20, 'Laptop stand', 49, 21, 'equipment']]
      .map(([d, vendor, amount, vatRate, category]) => ({ date: day(d), vendor, amount, vatRate, category, paidBy: d === -15 ? 'private' : 'business' }));
    const subscriptions = [['Adobe Creative Cloud', 59.99, 'month', day(8), 'software'], ['Phone plan', 25, 'month', day(14), 'phone'], ['Business insurance', 38, 'month', day(3), 'insurance'], ['Domain name', 15, 'year', day(40), 'software']]
      .map(([name, amount, cycle, nextDate, category]) => ({ name, amount, cycle, nextDate, category, status: 'active', vatRate: vat }));
    const trips = [[-1, 'Amsterdam', 'Utrecht', 45, 'korst'], [-8, 'Amsterdam', 'Utrecht', 45, 'korst'], [-12, 'Amsterdam', 'Rotterdam', 75, 'cafe']]
      .map(([d, from, to, km, k]) => ({ date: day(d), from, to, km, roundTrip: 1, purpose: 'Client meeting', clientId: c[k].id }));
    const stock = [['Sourdough loaf', '🍞', 3, 5, 2.1, 5.5, 'Bakery'], ['Logo mugs', '☕', 24, 6, 4, 12.5, 'Merch'], ['Tote bags', '👜', 12, 5, 3.2, 9.95, 'Merch'], ['Sticker sheets', '✨', 2, 10, 0.4, 3, 'Merch']]
      .map(([name, emoji, qty, min, cost, price, category]) => ({ name, emoji, qty, min, cost, price, category }));
    // Two projects with a real plan for the Project Planner: one slipping a little, one on track.
    const people = [{ id: id(), name: 'Noor Visser', role: 'Owner, designer', hours: 30, color: 'grape' }, { id: id(), name: 'Daan Bakker', role: 'Freelance sign maker', hours: 12, color: 'sun' }];
    const [noor, daan] = people.map((p) => p.id);
    const project = { id: id(), name: 'Signage for Café Morgenrood', emoji: '☕', color: 'teal', clientId: c.cafe.id, start: day(-21), due: day(16), status: 'active', ownerId: noor, budgetHours: 40,
      goal: 'New window and wall signs that make people walking past the harbour stop for coffee.', doneMeans: 'Signs installed, Sam has signed off, invoice sent.' };
    const ms = [['Design approved', day(-3)], ['Signs printed', day(8)], ['Installed', day(14)]].map(([title, due], i) => ({ id: id(), projectId: project.id, title, due, done: false, order: i }));
    const tid = Array.from({ length: 6 }, id);
    const tasks = [
      [tid[0], 'Measure the walls', 'done', -21, -19, 0, noor, 2, [], null, day(-19)],
      [tid[1], 'Three sketch directions', 'doing', -17, -5, 0, noor, 10, [tid[0]], [['Retro', true], ['Minimal', true], ['Playful', false]]],
      [tid[2], 'Get feedback from Sam', 'waiting', -4, -2, 0, noor, 1, [tid[1]]],
      [tid[3], 'Order sample prints', 'todo', -1, 3, 1, daan, 3, [tid[2]]],
      [tid[4], 'Final print run', 'todo', 4, 8, 1, daan, 6, [tid[3]]],
      [tid[5], 'Install day', 'todo', 13, 14, 2, daan, 10, [tid[4]]],
    ].map(([tId, title, status, s, e, m, who, hours, after, checks, doneAt], i) => ({ id: tId, title, status, projectId: project.id, order: i, start: day(s), due: day(e), milestoneId: ms[m].id, assigneeId: who, hours, after,
      doneAt: doneAt || '', checklist: (checks || []).map(([text, done]) => ({ id: id(), text, done })) }));
    const site = { id: id(), name: 'Website care plan for Studio Blauw', emoji: '🌐', color: 'sky', clientId: c.blauw.id, start: day(-10), due: day(25), status: 'active', ownerId: noor, budgetHours: 16,
      goal: 'Move Studio Blauw to the monthly care plan and refresh the homepage.', doneMeans: 'New homepage live, care plan running.' };
    const siteMs = [{ id: id(), projectId: site.id, title: 'Homepage live', due: day(20), done: false, order: 0 }];
    [['Collect new photos', 'done', -10, -6, 2], ['Rewrite the homepage words', 'doing', -5, 6, 5], ['Build the new homepage', 'todo', 7, 18, 7], ['Go live and check on phones', 'todo', 19, 20, 2]]
      .forEach(([title, status, s, e, hours], i) => tasks.push({ id: id(), title, status, projectId: site.id, order: i, start: day(s), due: day(e), milestoneId: siteMs[0].id, assigneeId: noor, hours,
        after: i ? [tasks[tasks.length - 1].id] : [], doneAt: status === 'done' ? day(-6) : '', checklist: [] }));
    const projectlog = [
      { kind: 'risk', projectId: project.id, date: day(-12), title: 'The printer is busy before the holidays, so the print run could slip a week', likelihood: '3', impact: '2', next: 'Book the print slot now, before the design is final', owner: 'Daan', state: 'open' },
      { kind: 'risk', projectId: project.id, date: day(-12), title: 'Rain on install day', likelihood: '1', impact: '1', next: 'Keep the next morning free', owner: 'Noor', state: 'open' },
      { kind: 'decision', projectId: project.id, date: day(-8), title: 'Matte finish, not gloss', text: 'Gloss reflects the harbour light. Sam agreed on the call.' },
      { kind: 'update', projectId: project.id, date: day(-7), health: 'green', text: 'Signage for Café Morgenrood: on track\n\nDone this week:\n- Measured the walls\n\nNext week:\n- Three sketch directions (Noor)' },
    ];
    const catalog = [['Logo design', 850], ['Hourly design work', 75], ['Website page', 400]].map(([name, price]) => ({ name, price, vat }));

    const all = { clients: Object.values(c), invoices: made, time, expenses, subscriptions, trips, stock, projects: [project, site], tasks, catalog, milestones: ms.concat(siteMs), people, projectlog };
    for (const [name, recs] of Object.entries(all)) { recs.forEach((r) => { r.example = true; }); await BW.store.putMany(name, recs); }
    await loadMarketing();
  }

  /* The same pretend studio's marketing: a filled-in Studio profile, a year plan, one brand survey and
     a saved result, plus an Olaf workspace at stage 2 of the journey with finished work to look at.
     Nothing real is overwritten: a profile or Olaf file the owner already filled in stays as it is. */
  async function loadMarketing() {
    const name = BW.settings.businessName || 'Sunny Side Studio';
    const month = (n) => BW.addPeriod(BW.today().slice(0, 7) + '-01', 'month', n).slice(0, 7);
    const ceps = [
      ['opening a new shop or café', 5, 1, true], ['refurbishing or moving to new premises', 4, 1, true], ['a new menu or price list', 4, 2, true],
      ['the website looks outdated', 4, 0, true], ['a seasonal campaign (summer, Christmas)', 3, 1], ['flyers for an event or market', 3, 1],
      ['starting on Instagram properly', 3, 0], ['a competitor opens nearby', 2, 0], ['a new product line', 2, 1],
    ].map(([text, common, ours, priority]) => ({ text, common, ours, priority: !!priority }));
    const assets = [['Colour', 'sunny yellow #FFC93C', 35, 62, true], ['Character or mascot', 'the hand-drawn sun doodle', 18, 78, true], ['Tagline', 'Good design, around the corner', 9, 55, false], ['Photo style', 'real shop owners in natural light', 14, 28, false]]
      .map(([type, n, fame, uniq, commit]) => ({ id: BW.uid(), type, name: n, fame, uniq, commit }));
    const profile = {
      id: 'profile', onboarded: true, category: "a designer for my shop's logo, menu, signs or website", offer: 'Logos, menus, shop signage, packaging and simple websites for local businesses',
      price: 'mid', area: 'Utrecht and the towns around it', market: 'businesses', cycle: 'year',
      buyers: 'Owners of independent shops, cafés, bakeries and salons, usually when they open, refurbish or refresh',
      words: '"I want it to look professional", "something that fits us", "before the opening", "not too expensive"',
      ceps, assets, tone: ['Friendly', 'Local', 'Straight-talking'], useWords: 'your shop, your street, clear prices', avoidWords: 'synergy, solutions, world-class',
      proof: '4.9 on Google from 31 reviews; more than 60 local businesses since 2019', barriers: ['Prices are unclear', 'Few reviews', "People don't know us"], barrierNotes: '',
      competitors: [{ name: 'Studio Kade', site: 'studiokade.example', notes: 'premium, slower, Utrecht centre' }, { name: 'Online logo marketplaces', site: '', notes: 'cheap and generic, no local knowledge' }],
      channels: ['Google Business Profile', 'Website', 'Instagram', 'LinkedIn', 'Word of mouth', 'Partners'], budget: '250', hours: '3',
      goals: 'Two new local clients a month, and be the studio owners think of first when they open or refurbish.',
      learnings: [{ date: day(-20), text: 'Posts showing a finished shop window got three times the profile visits of design-process posts.' }],
      changelog: [], skillNotes: { 'social-media': 'Show real local shops, never stock photos.' },
    };
    const plan = [
      [-2, 'Google Business Profile: prices, photos, booking link', 'Google Business Profile', 0, 'the website looks outdated', 'done'],
      [-1, 'Review requests after every finished job', 'Word of mouth', 0, '', 'done'],
      [0, 'Two "before the opening" posts a week', 'Instagram', 0, 'opening a new shop or café', 'planned'],
      [0, 'Coffee with the Utrecht shopfitters (partner referrals)', 'Partners', 20, 'refurbishing or moving to new premises', 'planned'],
      [1, 'Local social ads around new business openings', 'Meta ads', 120, 'opening a new shop or café', 'planned'],
      [2, 'Menu makeover mini-campaign', 'Instagram', 60, 'a new menu or price list', 'planned'],
      [3, 'Christmas window kit for shops', 'Flyers & posters', 90, 'a seasonal campaign (summer, Christmas)', 'planned'],
      [5, 'Spring "open your doors" local press story', 'Local press', 0, 'opening a new shop or café', 'planned'],
      [7, 'Summer terrace signage offer', 'Meta ads', 120, 'a seasonal campaign (summer, Christmas)', 'planned'],
      [9, 'Website refresh case study', 'LinkedIn', 0, 'the website looks outdated', 'planned'],
    ].map(([m, title, channel, cost, cep, status]) => ({ month: month(m), title, channel, cost, cep, status }));
    const priority = ceps.filter((c) => c.priority).map((c) => c.text);
    const wave = { date: day(-120), n: 60, ceps: priority, rows: [
      { brand: name, links: [9, 6, 7, 3], any: 14 }, { brand: 'Studio Kade', links: [12, 10, 5, 8], any: 19 }, { brand: 'Online logo marketplaces', links: [6, 2, 4, 9], any: 15 }] };
    const run = { skillId: 'local-presence', title: 'Local presence check', model: 'claude-sonnet-5-5', cost: 0.07,
      text: '## Local presence: 12 of 20 done\n\n**Top five fixes**\n1. Add a price indication for the three most asked-for jobs.\n2. Upload six photos of finished shop windows.\n3. Add the booking link to your Google Business Profile.\n4. Reply to the four reviews without an answer.\n5. List the towns you serve in the profile description.\n\n**Business description, ready to paste**\n> We design logos, menus, signs and simple websites for independent shops and cafés in and around Utrecht. Clear prices, fast turnaround, and a designer who knows your street.' };

    const [prof] = await BW.store.all('mktprofile');
    if (!prof || !prof.onboarded) {
      await BW.store.put('mktprofile', Object.assign(profile, { example: true }));
      await BW.store.putMany('mktplan', plan.map((x) => Object.assign(x, { example: true })));
      await BW.store.put('mktwaves', Object.assign(wave, { example: true }));
      await BW.store.put('mktruns', Object.assign(run, { example: true }));
      if (!(await BW.store.all('mktnumbers')).length) {
        await BW.store.putMany('mktnumbers', [{ month: month(-1), reviews: 27, rating: 4.9, visits: 410, followers: 820, note: 'Starting point', by: 'owner' },
          { month: month(0), reviews: 31, rating: 4.9, visits: 465, followers: 846, note: 'Google profile done', by: 'olaf' }].map((x) => Object.assign(x, { example: true })));
        const more = [[-3, 210, 9, 6, 320, 2100], [-2, 240, 11, 8, 360, 2400], [-1, 260, 12, 9, 410, 2650], [0, 310, 15, 12, 465, 3100]];
        const nums = await BW.store.all('mktnumbers');
        await BW.store.putMany('mktnumbers', more.map(([m, gbpViews, gbpCalls, gbpDirections, visits, reach]) => Object.assign(nums.find((x) => x.month === month(m)) || { month: month(m), example: true }, { gbpViews, gbpCalls, gbpDirections, visits, reach, spend: m === 0 ? 20 : 0 })));
      }
      if (!(await BW.store.all('mktcontent')).length) {
        const mon = BW.addDays(BW.today(), -((new Date(BW.today() + 'T12:00:00').getDay() + 6) % 7));
        await BW.store.putMany('mktcontent', [
          [0, 'Instagram', 'Before the opening: Café Morgenrood window', 'opening a new shop or café', 'Two weeks before opening, Sam had a bare window and a lot of plans. Now the street knows exactly what is coming. Opening a shop or café in Utrecht? We make your window, menu and signs ready before day one. ☀️', 'ready'],
          [3, 'Instagram', 'Menus that change when your prices do', 'a new menu or price list', '', 'idea'],
          [8, 'LinkedIn', 'Website refresh: before and after for Studio Blauw', 'the website looks outdated', '', 'idea'],
          [-5, 'Google Business Profile', 'New photos of finished shop windows', '', 'Six new photos of windows we made this year, from Utrecht Oudwijk to Lombok.', 'posted'],
        ].map(([dd, channel, title, cep, text, status]) => ({ date: BW.addDays(mon, dd), channel, title, cep, text, status, by: dd === 0 ? 'olaf' : 'owner', example: true })));
      }
    }

    // Olaf: only fill files that are missing or still the blank template.
    const files = new Map((await BW.store.all('olaf-files')).map((r) => [r.path, r]));
    const blank = (path) => { const r = files.get(path); return !r || (r.content.match(/\[FILL/g) || []).length >= 8 || r.example; };
    const idFor = (path) => 'f-' + path.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
    const out = [];
    const STATUS = { 'output/growth-roadmap.md': 'approved', 'output/review-request.md': 'published' };
    const put = (path, content) => { if (blank(path)) out.push({ id: idFor(path), path, content, example: true, status: path.startsWith('output/') ? STATUS[path] || 'draft' : undefined }); };
    put('brand-documents/brand-growth-profile.md', `# Brand growth profile

> Example business. Olaf reads this file before every skill.

## The business

**Business name:** ${name}
**Location:** Utrecht, Netherlands
**Currency:** ${BW.settings.currency || 'EUR'}

## Category and buyers

**Category (in buyers' words):** ${profile.category}
**What we sell:** ${profile.offer}
**Price level:** mid
**Area served:** ${profile.area}
**Sells to:** businesses
**How often people buy the category:** About once a year
**Who buys the category:** ${profile.buyers}
**Words customers use:** ${profile.words}

## Buying moments (category entry points)

★ = priority; common = how common among category buyers (1 to 5); linked = how strongly people link us to it (0 to 3).

${ceps.map((c) => `- ${c.priority ? '★ ' : ''}${c.text} (common ${c.common}, linked ${c.ours})`).join('\n')}

## Distinctive brand assets

Fame and uniqueness 0 to 100; ✔ = committed, use every time.

${assets.map((a) => `- ${a.commit ? '✔ ' : ''}${a.type}: ${a.name} (fame ${a.fame}, uniqueness ${a.uniq})`).join('\n')}

## Voice

**Tone of voice:** Friendly, Local, Straight-talking
**Words to use:** ${profile.useWords}
**Words to avoid:** ${profile.avoidWords}

## Proof

**Real proof points (only use these):** ${profile.proof}

## Purchase barriers to remove

- Prices are unclear
- Few reviews
- People don't know us

## Competitors

- Studio Kade (studiokade.example): premium, slower, Utrecht centre
- Online logo marketplaces: cheap and generic, no local knowledge

## Channels, budget and time

**Channels in use:** ${profile.channels.join(', ')}
**Marketing budget per month:** 250 ${BW.settings.currency || 'EUR'}
**Time for marketing per week:** 3 hours

## Goals

${profile.goals}

## Learnings

- ${day(-20)}: ${profile.learnings[0].text}
`);
    put('memory/marketing-journey.md', `# Marketing journey

**Started:** ${day(-21)}
**Current stage:** 2
**Hours per week:** 3
**Next check-in:** ${day(2)}

## Stages
- [x] 1. Know how you grow (done ${day(-21)})
- [ ] 2. Be easy to find and buy
- [ ] 3. Own your moments and assets
- [ ] 4. Plan always-on reach
- [ ] 5. Show up every month
- [ ] 6. Measure and learn

## This week
- [x] Add prices, six photos and the booking link to your Google Business Profile · 40 min · local-presence
- [ ] Send the review request to the last five finished clients · 20 min · word-of-mouth
- [ ] Post the two "before the opening" posts Olaf wrote · 15 min · social-media

## Numbers
| Month | New customers | Total customers | Reviews | Rating | Spend | Note |
|---|---|---|---|---|---|---|
| ${month(-1)} | 1 | 3 | 27 | 4.9 | 0 | Started the journey |
| ${month(0)} | 2 | 4 | 31 | 4.9 | 20 | Google profile done |

## Log
- ${day(-21)}: Started. Stage 1 done from the Marketing Studio profile. Roadmap in output/.
- ${day(-14)}: Weekly check-in. Google profile half done; prices still missing.
- ${day(-7)}: Weekly check-in. Profile done. Wrote the review request and two posts.
`);
    put('memory/hot-cache.md', `# Hot cache

**Business:** ${name}, a small design studio in Utrecht for local shops and cafés.
**Goal:** two new local clients a month.
**Now:** stage 2 of the journey (be easy to find and buy). Google profile done; reviews next.
**Remember:** never use stock photos; show real local shops. Owner has about 3 hours a week.
`);
    put('output/growth-roadmap.md', `# Your 90-day growth roadmap

**Where you stand:** people who already know you rate you highly (4.9 from 31 reviews), but too few local owners think of you when they open or refurbish. Your profile is strong; being easy to find and choose is the gap.

**The three biggest opportunities**
1. Be easy to choose on Google: prices, photos, booking link, more recent reviews.
2. Own "opening a new shop or café": it is the most common buying moment, and no studio owns it yet.
3. Keep a small presence every month instead of bursts around your busy season.

| Week | Step | Time | Skill |
|---|---|---|---|
| 1 | Google Business Profile: prices, photos, booking link | 40 min | local-presence |
| 2 | Review requests to the last five clients | 20 min | word-of-mouth |
| 3 | Two "before the opening" posts | 30 min | social-media |
| 4 | Coffee with two shopfitters about referrals | 60 min | word-of-mouth |
`);
    put('output/review-request.md', `# Review request

**By text, the day after handover**
> Hi Anna, it was a pleasure making the new menus for De Gouden Korst. If you're happy with them, would you leave us a short Google review? It helps other shop owners find us: [your review link]. Thanks! ${name}

**By email, a week later if there's no review yet**
> Subject: A small favour?
>
> Hi Anna, thanks again for choosing us for the menus. If you have a minute, a Google review would mean a lot to a small studio like ours: [your review link]. No pressure at all.
`);
    put('output/instagram-before-the-opening.md', `# Two "before the opening" posts

**Post 1 (photo: the finished window at Café Morgenrood, yellow sun doodle in the corner)**
Two weeks before opening, Sam had a bare window and a lot of plans. Now the street knows exactly what's coming. Opening a shop or café in Utrecht? We'll make your window, menu and signs ready before day one. ☀️

**Post 2 (photo: menu proofs on the counter)**
The menu is the first thing your guests read. We design menus that are easy to change when your prices do. Opening soon? Send us a message.
`);
    if (out.length) await BW.store.putMany('olaf-files', out);
    if (!(await BW.store.all('olaf-sessions')).length) {
      await BW.store.put('olaf-sessions', { skillId: 'marketing-journey', title: 'Weekly check-in', finished: true, example: true, cost: 0.14, model: 'claude-sonnet-5-5',
        files: ['output/review-request.md', 'output/instagram-before-the-opening.md'],
        system: [{ type: 'text', text: 'Example conversation.' }],
        messages: [{ role: 'user', content: 'Weekly check-in' }, { role: 'assistant', content: [{ type: 'text', text: 'Example conversation.' }] }],
        view: [{ role: 'me', text: 'Weekly check-in' }, { role: 'olaf', tools: ['Reading memory/marketing-journey.md', 'Reading your sales numbers', 'Writing output/review-request.md', 'Writing output/instagram-before-the-opening.md', 'Checking the writing'],
          text: '**Nice work: your Google profile is complete.** Prices, photos and the booking link are all there, which removes two of your three purchase barriers.\n\nThis week, about 35 minutes:\n1. Send the review request to your last five clients (`output/review-request.md`).\n2. Post the two "before the opening" posts (`output/instagram-before-the-opening.md`). Opening a shop is the most common moment people need a designer, and nobody owns it yet.\n\nNext check-in in a week.' }] });
    }
  }

  async function remove() {
    let n = 0;
    for (const name of COLLECTIONS) n += await BW.store.removeWhere(name, (r) => r.example);
    return n;
  }
  async function present() {
    for (const name of ['clients', 'invoices']) if ((await BW.store.all(name)).some((r) => r.example)) return true;
    return false;
  }

  BW.examples = { load, loadMarketing, remove, present };
})();
