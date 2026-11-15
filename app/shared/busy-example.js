/* The demo's main example: Busy itself, in its own tools.
   Real, as we would fill them in ourselves: the brand profile, the buying moments, the brand assets, the year plan,
   the content calendar, the two projects and Olaf's files (his roadmap for Busy and his check of our brand assets).
   Made up, so that every tool has something to show: the clients, the invoices, the hours, the costs, the stock and
   the marketing numbers. The demo bar says the money is made up, and the marketing numbers carry a note.
   Website demo only (assets/demo.js): never in a download. Every record carries example: true.
   Nothing here names a competitor, a real customer or a marketing author. */
(function () {
  'use strict';
  const BW = window.BW;
  const day = (n) => BW.addDays(BW.today(), n);
  const LOGO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCADIAMgDASIAAhEBAxEB/8QAGgABAAMBAQEAAAAAAAAAAAAAAAUGCAQHA//EADUQAAECBAMFBAkFAQAAAAAAAAABAgMEBREGEhMWITFRoQgiYaIUFRdBQ2JxgZJCUoOR8KP/xAAbAQEAAgMBAQAAAAAAAAAAAAAABQYDBAcCAf/EADIRAAEDAgQDBgUFAQEAAAAAAAABAgMEEQUSITEGYaETQVFxkdEUIjKx4TNCgcHwI2L/2gAMAwEAAhEDEQA/ANUgEZWayymw8jLOjuTcn7fFTXqqqOmjWWVbIhkjjdI5GtTU6p6oy1PZmjPstro1OKldnMVTERVbLNbCbzXepDR48SZiOiRXq9zluqqfM59iHElTUKrYVyN5b+vsT0GHRsS79VOmNUZqYdeJHiO8FctjmAIB8jnrd63U32tRuiIAAeD0AAAAAAAAAAAAAAAAAAdMGozUu68OPEb4I5bEpJ4qmIao2Za2K3mm5SCBu02I1NOt4nqn29NjBJTRyfU0v8lUZaoMzQX3W11avFDpPO4EeJLRGxIT1Y5q3RULjRqyypQ8j7NjtTen7vFC84PxA2rVIZtH9F/JCVdAsXzs1T7EmACykcc1SnmU+UfGdZV4NTmpRI8d8zFdFiOVznLdVUmcVTmrNNlmr3YSb08V/wAhBHNuJMQWoqVhavys0/nv9ixYdTpHHnXdQACukiAAAAAAAAAAAAAAAAAAAAAAAAAAAD6QI75aK2LDcrXNW6Kh8wfWuVq3Tc+KiKllL/TZ5lQlGRm2ReDk5KCu4VnNKadLOXuxU3J4p/lB1bB674ylbI76k0XzT33KtVwdjKrU2IqoRljzsaIv6nqqfS5zgHK5Hq9yvXdS0NblREQAA8HoAAAAAAAAAAAAAoe2K+2XZzUXR9VWy33a+bU/vIXw2KimfBlz/uRFTyUxxyI+9u5bAAGuZAAAAAAAAAAAADop8ZYE7BiJ+l6Kv0uDnBK0GLTUbVZHspqz0jJlRXAAEUbQAAAAAAAAAAAAFr7gQWPKzs/g2s1NFs+DKv01+dyZW9XIZIY1le2Nu6qiep5e5GtVy9xm7bFfa7tPnXS9a5r3+Dm0/wCshq61txhvL3ct/da5sfAdZ2gwbRqmq3fGlWai/O1MrurVLrxfRpGyGRmyJl9v7IjC5Vc57V79SdABRiZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB5R2jKx6HhCTpjXWfPzaK5ObIaZl8ytPVzN/aJrHp2M5anNddlPlGoqcnxFzL0RhPcNU/bYgy+zdfTbrY0sQkyQLz0PKzRvZzrHpmEJymOdd8hNqrU5MiJmTzI4zkeqdnaseg4zmac51mVCUciJzfDXMnRXl84kp+2w99t26+m/S5C0EmSdOehpAAHJSzgAAAAAAAAAAAAAAAAAAAAAAAADjw3kDWceYXw/dKnXqfLvTjD1Ue/8W3XoZI4XyrljaqryS55c9rUu5bE8DyisdozDUndtMkahUnpwcrUgMX7u39CjVjtE4pnczabKU+mMXg5GLGen3du8pN0/DWITa5Mqc9Om/Q05MQgb338jSHH6e9eRjbG1Z2gxfWKoi3ZMTURWL8iLlb5WoKzjbEuILpVK7UJli/DWMrWfi2ydCELngOAuw5zpJHIrlS2nd/vIia2t7dEREsiAm8E1nZ/F9HqirZkvNQ1evyKuV3lcpCAsUsaSMWN2ypb1NFrlaqKhuTh9PcvMGNqNjbEuH7JS67UJZifDSMrmfi66dC80ftE4pkrNqUpT6mxOLlYsF6/du7ynOKng+rZrE5HdF66dSejxWNfqRUNIA8oo/aMw1OWbU5GoU168XI1I7E+7d/QvNGx5hfEFkplep8w9eEPVRj/xdZehBVOF1dP+rGqJ4209U0N2Opif9LkJ4Dhx3AjzOAAAAAAAAAAAAAAACh4x9qPf2b2f0brly5te38ncuXwGxTVHYPz5UdyVLoY5I86WuqeRlHGPtKu/af1/pe/Nm0P+fcKS22/Lbxsbk4cNxA1nAeF8QXWp0GnzD14xNJGP/Jtl6lxo+L2RpkkhRE/8+35IqXC3Kt2vv5mOQaNrHZzw1OXdTJ6oU168Gq5I7E+zt/Uo1Y7O2KZLM6mzdPqbE4NR6wXr9nbvMWGn4kw+bTPlXnp126mjJQTs7r+R5WCbrOCcS4futUoVQlmJ8RYKuZ+Tbp1IQmo5WSJmjVFTlqajmq1bKgAB7PgBN0bBOJcQWWl0KoTLF+IkFWs/J1k6l5o/Z2xTO2dUpun0xi8Wq9Yz0+zd3mNGoxOkp/1ZETlfX0TUzR08j/pap5WHW3ZreFzRtH7OeGpOzqnPVCpPTi1HJAYv2bv6l5o2A8L4fstMoNPl3pwiaSPf+Trr1IGo4wpI9Imq5fROuvQ3I8Lld9Sohm/B3tKuzZj1/pe7Lm0P+ncPcsHe1HubSbP6N0zZs2vb+PuXL5x47wVPEcd+Lv8A8WpztdfXT7EnBRdl+9f6AAIA3gAAAAAAAAAAAAAAAAAAAABw+nvTmY2xtRtn8X1ilolmS81ERifIq5m+VyGyTN/aJo/oOM5aotbZlQlGqq83w1yr0VhbeD6nJVuiX9ydU/FyLxWO8aO8Dysm8E0baDF9HpapdkxNQ0enyIuZ3lapCHqnZ2o/p2M5moubdlPlHKi8nxFyp0R5fMTqPh6SSXwRbeeydSGp488jW8zSHH6e5OQAOLFtAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB5R2jKP6ZhCTqbW3fITaI5eTIiZV8yNPVyCx5RtoMG1mmIl3xpV+mnztTM3q1CQwuo+Hq45fBUv5bL0MFTHnic3kY4NG9nOj+h4QnKm5tnz82qNXmyGmVPMrjOWbu5re69jY+A6Ns/g2jUxUs+DKs1E+dyZndXKXvjCoyUjYk3cvRNfvYhsLjzSq7wQnQAc0LAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABe28AAyjscvtd2YyLpetctrfBzan9ZDV177yh7HL7Zdo9NdH1VfNbdr5tP+8hfCfx3Efi+x12al/Nd/sho0UHZZ/PoAAQBvAAAAAAAAAAAAAAAHRUIKwJ2NDX9L1RPpc5ydxVJ6U02ZandipvXxT/IQRu4jTLT1L4l7l6d3QwU8iSRtcAAaRnAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOinwVjzsGGn6noi/S4JXCsnqzTplyd2Em5fFf8AKC88OYZHJTLLMm66eSfm5B4hUubJlYuxYqlIsqEo+C6yLxavJSiR4D5aK6FEarXNWyop6IRlZozKlDzss2O1Ny/u8FN3iDB1q29tCnzp1T3MNBV9kuR+y9ClA+keBElojocVisc1bKinzOdOarVsu5YUVFS6AAHw+gAAAAAAAAAAAAAAAAAAAAAAAA+kCA+ZithQ2q5zlsiIIECJMxGw4TFe5y2RELjRqMymw877OjuTev7fBCVwrCpK6SyaNTdf93mpVVTYG8zqpsiynyjILbKvFy81B0g6lFE2JiRsSyJoVlzlcquXcAAyHk5p6nS1QZljMutrI5OKFdnMKzENVdLObFbyXcoBFV+D0tX80jbO8U0X8/ybMFXLFo1dCLjU6al3WiQIjfFWrY5gDm1fTNglVjNix08qyNuoABpGcAAAAAAAAAAAAAAAAAA6YNOmph1ocCI7xRq2JSTwrMRFR0y5sJvJN6gFywXA6aob2st15X09+pDVlbIxcrSxSVOlqezLBZZbWVy8VOkAusUTImoyNLIngQ7nK5buW6gAGQ8n/9k=';

  // The business details. The address, the numbers and the bank account are pretend, like the money.
  const settings = {
    businessName: 'Busy', ownerName: 'Team Busy', email: 'hello@busy.example', phone: '', website: 'busy.com.ai',
    address: 'Busy Street 1', postcode: '3511 AX', city: 'Utrecht', country: 'Netherlands', vatNumber: 'NL000000000B01', regNumber: '00000000',
    iban: 'NL00 BANK 0000 0000 00', bic: 'BANKNL2A', currency: 'EUR', vatRates: '21, 9, 0', paymentDays: 14, quoteDays: 30, docLang: 'en',
    brandColor: '#FFC93C', logo: LOGO, logoW: 200, logoH: 200,
  };

  // The moments that make someone look for what Busy makes, in their own words.
  const M_KNOWN = 'we are good at what we do, and too few people know us';
  const M_START = 'I know I should do something about marketing, but where do I start';
  const M_INVOICE = 'I need to send an invoice or a quote today';
  const M_CANCEL = 'a contract renewed before I could cancel it';
  const M_LETTER = 'a letter came and I do not know what it wants from me';
  const M_REVIEW = 'my review is next month and I cannot say what I achieved';
  const M_SUNDAY = 'Sunday evening, and the pile of paperwork is still there';
  const M_TAX = 'tax time, and my receipts are everywhere';
  const M_MOVE = 'we are moving house';
  const M_PLAY = 'ten minutes over coffee and something to play';

  async function load() {
    const id = () => BW.uid();
    const vat = BW.vatRates()[0] != null ? BW.vatRates()[0] : 21;
    // Made up: four organisations that buy copies for their members, visitors and tenants.
    const c = {
      shops: { id: id(), source: 'Recommendation', name: 'Winkeliersvereniging Lombok', contact: 'Anna de Vries', email: 'anna@winkelslombok.example', address: 'Kanaalstraat 12', postcode: '3531 CJ', city: 'Utrecht', country: 'Netherlands', paymentDays: '14', lang: 'nl' },
      library: { id: id(), source: 'Google search', name: 'Bibliotheek De Kade', contact: 'Lisa Blauw', email: 'lisa@dekade.example', address: 'Kadeplein 9', postcode: '2512 CD', city: 'Den Haag', country: 'Netherlands' },
      cafe: { id: id(), source: 'Our website', name: 'Spellencafé De Zevende Zet', contact: 'Piet Snel', email: 'piet@zevendezet.example', address: 'Wielweg 4', postcode: '1012 AB', city: 'Amsterdam', country: 'Netherlands' },
      homes: { id: id(), source: 'Recommendation', name: 'Wooncoöperatie Het Anker', contact: 'Sam Okafor', email: 'sam@hetanker.example', address: 'Havenkade 3', postcode: '3011 EA', city: 'Rotterdam', country: 'Netherlands', paymentDays: '30' },
    };
    const snap = (k) => Object.fromEntries(['name', 'contact', 'email', 'address', 'postcode', 'city', 'country', 'vat'].map((f) => [f, c[k][f] || '']));
    const existing = await BW.store.all('invoices');
    const made = [];
    // a day in this month, so the money that came in shows on Today whatever the date
    const recent = (n) => (day(-n).slice(0, 7) === BW.today().slice(0, 7) ? day(-n) : BW.today().slice(0, 8) + '01');
    const inv = (k, o, lines) => {
      const issue = o.issueDate;
      const rec = Object.assign({ kind: 'invoice', status: 'draft', currency: BW.settings.currency, clientId: c[k].id, client: snap(k), lang: c[k].lang || '', notes: '', reverseCharge: false,
        dueDate: BW.addDays(issue, BW.num(c[k].paymentDays) || 14), items: lines.map(([desc, qty, price]) => ({ id: id(), desc, qty, price, vat })) }, o);
      rec.number = BW.nextNumber(existing.concat(made), rec.kind, issue.slice(0, 4));
      made.push(rec);
      return rec;
    };
    inv('shops', { issueDate: day(-70), status: 'paid', paidAt: day(-58) }, [['Busy Business with Olaf, 120 copies for members', 120, 7.99], ['Quick-start cards, printed', 120, 2.5]]);
    inv('library', { issueDate: day(-40), status: 'paid', paidAt: recent(6) }, [["Busy Street: Tuck's Errand, 400 copies for the holiday programme", 400, 1.99], ['Tuck poster for the youth corner', 12, 12]]);
    inv('cafe', { issueDate: day(-28), status: 'sent', sentAt: day(-28), reminders: [{ date: day(-6), tone: 'friendly' }] }, [['Busy Street 3D, 60 copies for the tournament', 60, 3.99], ['Sun-yellow mugs', 24, 12.5]]);
    inv('homes', { issueDate: day(-12), status: 'sent', sentAt: day(-12), payments: [{ date: recent(3), amount: 900 }] }, [['Busy Home with Juno, 1,200 copies for tenants', 1200, 1.49], ['Welcome leaflet, 1,200 copies', 1200, 0.6]]);
    inv('homes', { issueDate: day(-3), status: 'sent', sentAt: day(-3), repeat: { on: true, every: 'month', next: BW.addPeriod(day(-3), 'month') } }, [['Busy Home with Juno for new tenants, 40 copies', 40, 1.49]]);
    inv('shops', { kind: 'quote', issueDate: day(-2), status: 'sent', sentAt: day(-2), validUntil: day(28) }, [['Busy Business with Olaf, 400 copies for all members', 400, 7.99], ['Tuck sticker sheets', 400, 3]]);
    inv('library', { issueDate: day(0) }, [['Busy Growth with Ivy, 150 copies for the job corner', 150, 1.49]]);

    const time = [[0, 'library', 'Call about the job corner', '0:25', false], [-1, '', 'Tokyo, the last room: lights and sound', '3:15', false], [-1, 'shops', "Members' evening: the Marketing Studio, hands on", '2:30'], [-2, '', 'Film: Busy Home in half a minute', '1:45', false], [-3, 'homes', 'Welcome leaflet: words and layout', '1:30']]
      .map(([d, k, desc, dur, bill]) => ({ date: day(d), clientId: k ? c[k].id : '', desc, dur, rate: '', billable: bill !== false }));
    const expenses = [[-2, 'Domain name, one year', 15, 21, 'software'], [-6, 'Train to Rotterdam', 12.4, 9, 'travel'], [-9, 'Sticker sheets, print run', 64, 21, 'marketing'], [-15, 'Coffee with the shopkeepers', 18.5, 9, 'food'], [-20, 'Microphone for the films', 49, 21, 'equipment']]
      .map(([d, vendor, amount, vatRate, category]) => ({ date: day(d), vendor, amount, vatRate, category, paidBy: d === -15 ? 'private' : 'business' }));
    const subscriptions = [['3D figures: credits', 20, 'month', day(16), 'software'], ['Phone plan', 25, 'month', day(14), 'phone'], ['Business insurance', 38, 'month', day(3), 'insurance'], ['Domain name', 15, 'year', day(40), 'software']]
      .map(([name, amount, cycle, nextDate, category]) => ({ name, amount, cycle, nextDate, category, status: 'active', vatRate: vat }));
    const trips = [[-1, 'Utrecht', 'Rotterdam', 57, 'homes'], [-8, 'Utrecht', 'Den Haag', 62, 'library'], [-12, 'Utrecht', 'Amsterdam', 45, 'cafe']]
      .map(([d, from, to, km, k]) => ({ date: day(d), from, to, km, roundTrip: 1, purpose: 'Client meeting', clientId: c[k].id }));
    const stock = [['Tuck sticker sheets', '✂️', 3, 10, 0.4, 3, 'Merch'], ['Sun-yellow mugs', '☕', 24, 6, 4, 12.5, 'Merch'], ['Busy Street tote bags', '👜', 12, 5, 3.2, 9.95, 'Merch'], ['Quick-start cards', '🪪', 2, 10, 0.3, 2.5, 'Print']]
      .map(([name, emoji, qty, min, cost, price, category]) => ({ name, emoji, qty, min, cost, price, category }));

    // The team is the cast of Busy Street, and the two projects are real: the next part of the game, and the
    // job this brand profile points at (one promise for each app).
    const people = [{ id: id(), name: 'Tuck', role: 'Errands, paperwork and the game', hours: 16, color: 'sun' }, { id: id(), name: 'Rivet', role: 'Builds the apps', hours: 24, color: 'teal' }, { id: id(), name: 'Olaf', role: 'Brand and marketing', hours: 8, color: 'grape' }];
    const [tuck, rivet, olaf] = people.map((p) => p.id);
    const game = { id: id(), name: 'The Wrong Year: nine cities, out in December', emoji: '🏙️', color: 'grape', start: day(-30), due: day(30), status: 'active', ownerId: tuck, budgetHours: 120,
      goal: 'Nine new levels for Busy Street, from Istanbul in 1555 to Tokyo today, in 2D and in 3D, in six languages.', doneMeans: 'Both games are live in the store with the new levels, a film each, and the first players have been asked what they think.' };
    const ms = [['All nine cities can be played', day(-2), true], ['Figures and props in the streets', day(12)], ['Live in the store', day(28)]].map(([title, due, done], i) => ({ id: id(), projectId: game.id, title, due, done: !!done, order: i }));
    const tid = Array.from({ length: 8 }, id);
    const tasks = [
      [tid[0], 'Build the nine cities', 'done', -30, -4, 0, rivet, 60, [], null, day(-4)],
      [tid[1], 'Music for every city', 'done', -12, -3, 0, tuck, 6, [], null, day(-3)],
      [tid[2], 'Sounds, and a menu of 32 levels', 'done', -3, -1, 0, rivet, 8, [tid[0]], null, day(-1)],
      [tid[3], 'Play every level by hand', 'doing', 0, 6, 1, tuck, 10, [tid[2]], [['The street, levels 1 to 8', true], ['The worlds, levels 9 to 23', false], ['The nine cities', false]]],
      [tid[4], 'Figures and props for the streets', 'todo', 5, 12, 1, rivet, 16, [tid[0]]],
      [tid[5], 'Release builds for Mac and Windows', 'todo', 13, 18, 2, rivet, 8, [tid[3], tid[4]]],
      [tid[6], 'Store pages, pictures and the launch film', 'todo', 16, 24, 2, olaf, 8, [tid[4]]],
      [tid[7], 'Ask the first players for a review', 'todo', 28, 30, 2, olaf, 2, [tid[6]]],
    ].map(([tId, title, status, s, e, m, who, hours, after, checks, doneAt], i) => ({ id: tId, title, status, projectId: game.id, order: i, start: day(s), due: day(e), milestoneId: ms[m].id, assigneeId: who, hours, after,
      doneAt: doneAt || '', checklist: (checks || []).map(([text, done]) => ({ id: id(), text, done })) }));
    const promise = { id: id(), name: 'One promise for each app', emoji: '🪧', color: 'sun', start: day(-7), due: day(35), status: 'active', ownerId: olaf, budgetHours: 20,
      goal: 'Each app says in one line what it does for you: on the website, in the store and on its own first screen.', doneMeans: 'Three first screens rewritten, a film for each promise, and five people outside Busy can say what each app is for.' };
    const promiseMs = [{ id: id(), projectId: promise.id, title: 'Three promises live', due: day(30), done: false, order: 0 }];
    [['Pick the one job each app leads with', 'done', -7, -3, 3], ['Rewrite the three first screens', 'doing', -2, 8, 6], ['A half-minute film for each promise', 'todo', 9, 22, 8], ['Ask five people what each app is for', 'todo', 23, 30, 3]]
      .forEach(([title, status, s, e, hours], i) => tasks.push({ id: id(), title, status, projectId: promise.id, order: i, start: day(s), due: day(e), milestoneId: promiseMs[0].id, assigneeId: olaf, hours,
        after: i ? [tasks[tasks.length - 1].id] : [], doneAt: status === 'done' ? day(-3) : '', checklist: [] }));
    const projectlog = [
      { kind: 'risk', projectId: game.id, date: day(-12), title: 'The Windows version gets less testing than the Mac one', likelihood: '3', impact: '2', next: 'Ask three Windows players to try it before launch day', owner: 'Rivet', state: 'open' },
      { kind: 'risk', projectId: game.id, date: day(-12), title: 'The figures for the streets arrive late', likelihood: '2', impact: '1', next: 'Launch with the streets as they are and add the figures in the first update', owner: 'Tuck', state: 'open' },
      { kind: 'decision', projectId: game.id, date: day(-8), title: 'Nine cities, not ten', text: 'Berlin and Tokyo close the story. A tenth level would push the release into January.' },
      { kind: 'update', projectId: game.id, date: day(-1), health: 'green', text: 'The Wrong Year: on track\n\nDone this week:\n- Sounds, and a menu of 32 levels\n\nNext week:\n- Play every level by hand (Tuck)' },
    ];
    const catalog = [['Busy Business with Olaf', 7.99], ['Busy Growth with Ivy', 1.49], ['Busy Home with Juno', 1.49], ["Busy Street: Tuck's Errand", 1.99], ['Busy Street 3D', 3.99]].map(([name, price]) => ({ name, price, vat }));

    const all = { clients: Object.values(c), invoices: made, time, expenses, subscriptions, trips, stock, projects: [game, promise], tasks, catalog, milestones: ms.concat(promiseMs), people, projectlog };
    for (const [name, recs] of Object.entries(all)) { recs.forEach((r) => { r.example = true; }); await BW.store.putMany(name, recs); }
    await loadMarketing();
  }

  /* Busy's own marketing, as the Marketing Studio and Olaf hold it. This part is meant: it is how we see our own
     brand today, weak spots included. */
  async function loadMarketing() {
    const month = (n) => BW.addPeriod(BW.today().slice(0, 7) + '-01', 'month', n).slice(0, 7);
    const ceps = [
      [M_KNOWN, 5, 0, true], [M_REVIEW, 5, 0, true], [M_LETTER, 5, 0, true], [M_SUNDAY, 5, 0, true],
      [M_START, 5, 0], [M_CANCEL, 4, 0], [M_INVOICE, 5, 0], ['I want a raise, or the next step up', 4, 0],
      ['I am applying and need my CV tonight', 5, 0], [M_TAX, 4, 0], [M_PLAY, 5, 1], [M_MOVE, 2, 0],
    ].map(([text, common, ours, priority]) => ({ text, common, ours, priority: !!priority }));
    const assets = [
      ['Name', 'Busy', 2, 15, true],
      ['Logo', 'the sun-yellow tile with a dark sparkle', 3, 70, true],
      ['Colour', 'sun yellow #FFC93C with ink outlines on cream', 3, 50, true],
      ['Character or mascot', 'Tuck, the small hero of Busy Street, with his satchel and scissors', 3, 85, true],
      ['Shape or pattern', 'Busy Street: four buildings in a row, one for each thing you are busy with', 2, 85, true],
      ['Tagline', 'Make your invoices (job search, paperwork) fun again', 1, 55, false],
      ['Other', 'the Red Tape: the villain of the game, and of every chore', 1, 60, false],
      ['Sound or jingle', 'the snip of the scissors and the thud of the stamp', 0, 60, false],
    ].map(([type, n, fame, uniq, commit]) => ({ id: BW.uid(), type, name: n, fame, uniq, commit }));
    const profile = {
      id: 'profile', onboarded: true,
      category: 'apps that take the boring part off my hands, with an expert inside if I want one',
      offer: "Three free apps for Mac and Windows: Busy Business (brand management, from brand strategy to daily operations: 13 tools), Busy Growth (a personal growth tool: 9 tools) and Busy Home (household management: 7 tools). Each also comes with an AI expert inside, paid once: Olaf $7.99, Ivy $1.49, Juno $1.49, plus your own Claude usage. And a game, Busy Street: six levels free, the full game $1.99, in 3D $3.99.",
      price: 'budget', area: 'Online, worldwide, in six languages', market: 'both', cycle: 'rare',
      buyers: 'Ordinary people with a chore they keep putting off. Anyone who runs a small business or works for themselves, anyone with a job or looking for the next one, and every household with contracts, policies and letters.',
      words: '"nobody knows we exist", "where do I even start", "what did I actually do this year", "what does this letter want from me", "I forgot to cancel again", "there goes my evening", "I don\'t want that in someone\'s cloud"',
      ceps, assets, tone: ['Friendly', 'Playful', 'Straight-talking'], useWords: 'your brand, what matters, the boring part, made easy, done for you, your own folder, paid once',
      avoidWords: 'synergy, solutions, seamless, game-changing; and no "AI" about the free apps, because they have none',
      proof: '29 free tools in three apps, with no account. Six languages. Everything is saved in a folder on your own computer, and the free apps cannot reach the web at all. The code of the free tools is public. The experts are paid once, from $1.49. 148 reviews so far, 4.7 stars on average (example numbers).',
      barriers: ["People don't know us", 'Few reviews', 'Risky to try', 'Unclear what we do'],
      barrierNotes: 'The name is an everyday word. The expert needs your own Claude key, which takes five minutes to set up. The apps are not yet signed by Apple and Microsoft, so the first start takes an extra click.',
      competitors: [
        { name: 'A monthly subscription for every job', site: '', notes: 'an invoicing app, a CV builder, a document vault: complete and polished, a few euros to a few tens of euros a month each, and your data lives with them' },
        { name: 'A general AI chat', site: '', notes: 'free or about twenty euros a month; clever, but it knows nothing about your business until you explain it again, and it has no plan and no memory of last week' },
        { name: 'Spreadsheets and templates', site: '', notes: 'what most people use today: free and familiar, but nothing reminds you and nothing links up' },
        { name: 'An agency or a freelancer', site: '', notes: 'does it for you, and well, at a price a business this size can rarely pay' },
      ],
      channels: ['Website', 'YouTube', 'Marketplaces'], budget: '0', hours: '2',
      goals: 'Be the name a small-business owner thinks of first when they decide it is time to work on their brand. This year: 25,000 downloads and 500 reviews, one film or one page a month, and every film opening on the yellow tile and Tuck.',
      learnings: [
        { date: day(-5), text: 'We led with a list: 13 tools, 9 tools, 7 tools. Nobody remembers a list. From now on each app leads with one job.' },
        { date: day(-20), text: 'A film of one job from start to finish explains an app faster than any page of text.' },
      ],
      changelog: [], skillNotes: { 'social-media': 'No channels to keep up. One-off posts with a film, written once and translated into the other five languages.' },
    };
    const plan = [
      [-1, 'One page for every tool, so search and AI answers can find each job', 'Website', 0, M_INVOICE, 'done'],
      [0, 'A half-minute film of every app at work', 'YouTube', 0, M_KNOWN, 'done'],
      [0, 'Store pages in six languages, with the films', 'Marketplaces', 0, '', 'done'],
      [1, 'The Wrong Year: the launch film and new store pages', 'YouTube', 0, M_PLAY, 'planned'],
      [2, 'Get your evenings back: the January paperwork in one sitting', 'Website', 0, M_SUNDAY, 'planned'],
      [2, 'Know what you are worth: ready for your review in twenty minutes', 'Website', 0, M_REVIEW, 'planned'],
      [3, 'Ask every buyer for a review, a week after they bought', 'Word of mouth', 0, '', 'planned'],
      [4, 'Tax time: receipts, hours and kilometres in one export', 'Website', 0, M_TAX, 'planned'],
      [6, 'Your brand on one page: the method, step by step', 'YouTube', 0, M_START, 'planned'],
      [8, 'Moving house: everyone to tell, and when', 'Website', 0, M_MOVE, 'planned'],
      [10, 'The letter you have been avoiding: what it means and what to do', 'Website', 0, M_LETTER, 'planned'],
      [11, 'Cancel before it renews: the last day, for every contract', 'Website', 0, M_CANCEL, 'planned'],
    ].map(([m, title, channel, cost, cep, status]) => ({ month: month(m), title, channel, cost, cep, status }));
    const run = { skillId: 'distinctive-assets', title: 'Brand assets check', model: 'claude-sonnet-5-5', cost: 0.06,
      text: '## Brand assets: 5 to keep, 3 to test\n\n**Use every time**\n1. The sun-yellow tile with the dark sparkle. Yours alone, not famous yet. First second of every film, corner of every picture.\n2. Tuck. One character people can come to know beats six they meet once.\n3. Busy Street, the four buildings in a row. It explains the whole of Busy in one picture.\n\n**Carry with help**\n4. The name. An everyday word that others use too. Never let it stand alone: always with the tile.\n5. Sun yellow. Many brands are yellow. Yellow with ink outlines on cream is yours.\n\n**Test before you commit**\n6. "Fun again" says how Busy feels. Test it against a line that says what Busy does for you.\n7. The Red Tape. Everyone knows the enemy at once. A candidate for the films.\n8. The snip and the stamp. Two sounds from the game that could open every film.' };

    const [prof] = await BW.store.all('mktprofile');
    if (!prof || !prof.onboarded) {
      await BW.store.put('mktprofile', Object.assign(profile, { example: true }));
      await BW.store.putMany('mktplan', plan.map((x) => Object.assign(x, { example: true })));
      await BW.store.put('mktruns', Object.assign(run, { example: true }));
      if (!(await BW.store.all('mktnumbers')).length) {
        // Made up, and they say so: we do not publish our own visitor numbers here.
        const rows = [[-3, 4200, 610, 1150, 61], [-2, 6900, 980, 1720, 88], [-1, 11800, 1650, 2380, 117], [0, 18400, 2540, 3120, 148]];
        await BW.store.putMany('mktnumbers', rows.map(([m, visits, searchClicks, followers, reviews]) => ({ month: month(m), visits, searchClicks, followers, reviews, spend: 0,
          note: m === 0 ? 'Example numbers. Films and store pages live' : 'Example numbers', by: m === 0 ? 'olaf' : 'owner', example: true })));
      }
      if (!(await BW.store.all('mktcontent')).length) {
        const mon = BW.addDays(BW.today(), -((new Date(BW.today() + 'T12:00:00').getDay() + 6) % 7));
        await BW.store.putMany('mktcontent', [
          [0, 'YouTube', 'Busy Business in half a minute: be the name people think of first', M_KNOWN, 'A shop has the same job as a big brand: be the name people think of first, and be easy to buy from. Half a minute, one business, from brand strategy to the invoice that carries its name. The app is free; Olaf, your brand consultant, is paid for once.', 'ready'],
          [3, 'Website', 'My review is next month: what did I achieve this year?', M_REVIEW, '', 'idea'],
          [8, 'Marketplaces', 'The Wrong Year: nine cities, new pictures and the launch text', M_PLAY, '', 'idea'],
          [-5, 'YouTube', 'Busy Home in half a minute: get your evenings back', M_SUNDAY, 'The gym renews by itself on the 28th. Busy Home tells you on the 1st, with the letter ready. Sunday is for family.', 'posted'],
        ].map(([dd, channel, title, cep, text, status]) => ({ date: BW.addDays(mon, dd), channel, title, cep, text, status, by: dd === 0 ? 'olaf' : 'owner', example: true })));
      }
    }

    // Olaf's workspace: only fill files that are missing or still the blank template.
    const files = new Map((await BW.store.all('olaf-files')).map((r) => [r.path, r]));
    const blank = (path) => { const r = files.get(path); return !r || (r.content.match(/\[FILL/g) || []).length >= 8 || r.example; };
    const idFor = (path) => 'f-' + path.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
    const out = [];
    const STATUS = { 'output/growth-roadmap.md': 'approved', 'output/review-request.md': 'published' };
    const put = (path, content) => { if (blank(path)) out.push({ id: idFor(path), path, content, example: true, status: path.startsWith('output/') ? STATUS[path] || 'draft' : undefined }); };
    put('brand-documents/brand-growth-profile.md', `# Brand growth profile

> Busy's own profile. Olaf reads this file before every skill.

## The business

**Business name:** Busy
**Website:** busy.com.ai
**Location:** the Netherlands; sold online, worldwide
**Currency:** US dollars in the store; ${BW.settings.currency || 'EUR'} in this demo

## Category and buyers

**Category (in buyers' words):** ${profile.category}
**What we sell:** ${profile.offer}
**Price level:** budget
**Area served:** ${profile.area}
**Sells to:** consumers and businesses
**How often people buy the category:** Once every few years
**Who buys the category:** ${profile.buyers}
**Words customers use:** ${profile.words}

## Buying moments (category entry points)

★ = priority; common = how common among category buyers (1 to 5); linked = how strongly people link us to it (0 to 3).

${ceps.map((x) => `- ${x.priority ? '★ ' : ''}${x.text} (common ${x.common}, linked ${x.ours})`).join('\n')}

## Distinctive brand assets

Fame and uniqueness 0 to 100; ✔ = committed, use every time.

${assets.map((a) => `- ${a.commit ? '✔ ' : ''}${a.type}: ${a.name} (fame ${a.fame}, uniqueness ${a.uniq})`).join('\n')}

## Voice

**Tone of voice:** Friendly, Playful, Straight-talking
**Words to use:** ${profile.useWords}
**Words to avoid:** ${profile.avoidWords}

## Proof

**Real proof points (only use these):** ${profile.proof}

## Purchase barriers to remove

${profile.barriers.map((b) => `- ${b}`).join('\n')}
- ${profile.barrierNotes}

## Competitors

${profile.competitors.map((x) => `- ${x.name}: ${x.notes}`).join('\n')}

## Channels, budget and time

**Channels in use:** ${profile.channels.join(', ')}
**Marketing budget per month:** 0
**Time for marketing per week:** 2 hours

## Goals

${profile.goals}

## Learnings

${profile.learnings.map((l) => `- ${l.date}: ${l.text}`).join('\n')}
`);
    put('memory/marketing-journey.md', `# Marketing journey

**Started:** ${day(-21)}
**Current stage:** 2
**Hours per week:** 2
**Next check-in:** ${day(2)}

## Stages
- [x] 1. Know how you grow (done ${day(-21)})
- [ ] 2. Be easy to find and buy
- [ ] 3. Own your moments and assets
- [ ] 4. Plan always-on reach
- [ ] 5. Show up every month
- [ ] 6. Measure and learn

## This week
- [x] Pick the one job each app leads with · 40 min · positioning-icp
- [ ] Ask every buyer of this month for a review · 20 min · word-of-mouth
- [ ] Write the page "My review is next month" · 45 min · content-writer

## Numbers
| Month | New customers | Total customers | Reviews | Rating | Spend | Note |
|---|---|---|---|---|---|---|
| ${month(-1)} | 2,950 | 9,400 | 117 | 4.7 | 0 | Example numbers. Started the journey |
| ${month(0)} | 4,100 | 13,500 | 148 | 4.7 | 0 | Example numbers. Films and store pages live |

## Log
- ${day(-21)}: Started. Stage 1 done from the Marketing Studio profile. Roadmap in output/.
- ${day(-14)}: Weekly check-in. Films of every app made. Store pages still lead with a list of tools.
- ${day(-7)}: Weekly check-in. Checked the brand assets: five to keep, three to test. One job chosen for each app.
`);
    put('memory/hot-cache.md', `# Hot cache

**Business:** Busy (busy.com.ai): three free apps that take the boring part off your hands, an expert in each for a few dollars once, and a game.
**Goal:** be the name a small-business owner thinks of first when it is time to work on their brand; 500 reviews by the end of the year.
**Now:** stage 2 of the journey (be easy to find and buy). One job chosen for each app; reviews next.
**Remember:** no budget and two hours a week. No social channels to keep up. Never "AI" about the free apps. Every film opens on the yellow tile and Tuck.
`);
    put('output/growth-roadmap.md', `# Your 90-day growth roadmap

**Where you stand:** the brand assets are strong and nobody knows them yet. A street, a hero with scissors, a yellow tile: all yours, all at zero. The name will not carry you (it is an everyday word), so the assets must. Three apps and a game also mean four places to be remembered in, with two hours a week. That is too thin to spread evenly: one moment for each app, said the same way everywhere.

**The three biggest opportunities**
1. One promise for each app, tied to one buying moment. Business: "Be the name people think of first". Growth: "Know what you're worth. Say it well". Home: "Get your evenings back".
2. Proof. 148 reviews so far. Keep asking a week after each sale: fresh ones change more minds than another film.
3. Be findable in the moment: for each starred moment, one page that answers the question in the words people type.

| Week | Step | Time | Skill |
|---|---|---|---|
| 1 | Pick the one job each app leads with | 40 min | positioning-icp |
| 2 | Ask every buyer of this month for a review | 20 min | word-of-mouth |
| 3 | The page "My review is next month" | 45 min | content-writer |
| 4 | The yellow tile and Tuck in the first second of every film | 30 min | distinctive-assets |
`);
    put('output/brand-assets-check.md', `# Brand assets check

${run.text.replace(/^## .*\n\n/, '')}

**What this means for next month:** stop making new looks. Every film, page and store picture gets the same three things: the tile, Tuck, the street.
`);
    put('output/review-request.md', `# Review request

**In the store, a week after someone bought**
> Hi, thank you for buying Busy Home. If it found you a contract to cancel or a passport about to expire, would you leave a short rating on the store page? It helps other people decide. Thank you! Team Busy

**For the free apps, on the page people see after their first week**
> Has Busy been useful this week? A rating or two lines on the store page is the kindest thing you can do for a small maker. No account needed.
`);
    if (out.length) await BW.store.putMany('olaf-files', out);
    if (!(await BW.store.all('olaf-sessions')).length) {
      await BW.store.put('olaf-sessions', { skillId: 'marketing-journey', title: 'Weekly check-in', finished: true, example: true, cost: 0.12, model: 'claude-sonnet-5-5',
        files: ['output/brand-assets-check.md', 'output/review-request.md'],
        system: [{ type: 'text', text: 'Example conversation.' }],
        messages: [{ role: 'user', content: 'Weekly check-in' }, { role: 'assistant', content: [{ type: 'text', text: 'Example conversation.' }] }],
        view: [{ role: 'me', text: 'Weekly check-in' }, { role: 'olaf', tools: ['Reading memory/marketing-journey.md', 'Reading brand-documents/brand-growth-profile.md', 'Writing output/brand-assets-check.md', 'Writing output/review-request.md', 'Checking the writing'],
          text: '**One job chosen for each app: that was the hard part.** The store pages can now say one thing instead of thirteen.\n\nThis week, about an hour:\n1. Ask every buyer of this month for a review (`output/review-request.md`). Fresh ones are the first thing a careful buyer looks for.\n2. Write the page for "my review is next month and I cannot say what I achieved". Everyone with a job has that moment once a year, and nobody owns it yet.\n\nI also checked your brand assets (`output/brand-assets-check.md`): the tile, Tuck and the street are yours alone. Use them every time, and stop adding new ones.\n\nNext check-in in a week.' }] });
    }
  }

  BW.busyExample = { settings, load, loadMarketing };
})();
