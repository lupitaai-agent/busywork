/* Busy Home: the logic the household tools share. Dates first: when a document expires, when a
   contract renews and the last day to cancel it, when an upkeep job is due. Then the starter lists,
   the letter templates and the PDF every letter and pack is printed with. No DOM here except the PDF
   helper, so the tests can run it all. */
(function () {
  'use strict';
  const BW = window.BW;
  const num = (v) => BW.num(v);
  const isDate = (v) => /^\d{4}-\d\d-\d\d$/.test(String(v || ''));
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

  const H = (BW.house = {});

  // ---------- Paper Trail ----------
  H.KINDS = [['id', '🪪', 'ID and passport'], ['insurance', '☂️', 'Insurance'], ['contract', '📑', 'Contracts'], ['house', '🏠', 'House'], ['car', '🚗', 'Car'],
    ['money', '💶', 'Money and tax'], ['health', '🩺', 'Health'], ['school', '🎒', 'School and work'], ['warranty', '🧾', 'Warranties and manuals'], ['pet', '🐾', 'Pets'], ['other', '📄', 'Other']];
  H.kind = (id) => H.KINDS.find((k) => k[0] === id) || H.KINDS[H.KINDS.length - 1];
  // Passports and ID cards take weeks to renew, so they warn earlier.
  H.warnDays = (kind) => (kind === 'id' ? 120 : 60);
  // Documents whose expiry or review date is close (or past), soonest first.
  H.expiring = (papers, today, extra = 0) => papers
    .map((p) => ({ p, date: isDate(p.expires) ? p.expires : isDate(p.reviewAt) ? p.reviewAt : '' }))
    .filter(({ p, date }) => date && !p.replaced && days(today, date) <= H.warnDays(p.kind) + extra)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ p, date }) => ({ paper: p, date, left: days(today, date) }));
  // Words for "how long until": "in 12 days", "today", "3 days ago".
  H.when = (left) => (left === 0 ? 'today' : left === 1 ? 'tomorrow' : left > 0 ? (left > 60 ? `in ${Math.round(left / 30)} months` : `in ${left} days`) : left === -1 ? 'yesterday' : `${-left} days ago`);
  // A small search over title, kind, person, tags, notes and the PDF's own text.
  H.search = (list, q, fields = ['title', 'person', 'tags', 'notes', 'reference', 'text', 'name', 'provider', 'room', 'brand', 'task']) => {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return list;
    return list.map((x) => {
      const hay = fields.map((f) => String(x[f] || '')).join(' \n ').toLowerCase();
      const score = words.reduce((s, w) => (s < 0 ? s : hay.includes(w) ? s + (String(x.title || x.name || '').toLowerCase().includes(w) ? 3 : 1) : -1), 0);
      return [x, score];
    }).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([x]) => x);
  };

  // ---------- Contracts & Renewals ----------
  H.CONTRACT_KINDS = [['insurance', '☂️ Insurance'], ['energy', '⚡ Energy'], ['water', '💧 Water'], ['phone', '📱 Phone'], ['internet', '🌐 Internet and TV'], ['streaming', '📺 Streaming'],
    ['sport', '🏋️ Gym and sport'], ['membership', '🎟️ Membership'], ['rent', '🏠 Rent or lease'], ['loan', '💶 Loan or mortgage'], ['car', '🚗 Car'], ['other', '📄 Other']];
  H.contractKind = (id) => (H.CONTRACT_KINDS.find((k) => k[0] === id) || H.CONTRACT_KINDS[H.CONTRACT_KINDS.length - 1])[1];
  H.PER = [['month', 'a month'], ['quarter', 'a quarter'], ['year', 'a year']];
  H.monthly = (c) => num(c.cost) / ({ month: 1, quarter: 3, year: 12 }[c.per] || 1);
  // Notice: a number and a unit, e.g. { notice: 1, noticeUnit: 'month' }.
  H.noticeText = (c) => { const n = num(c.notice); if (!n) return 'no notice period'; const u = c.noticeUnit || 'month'; return `${n} ${u}${n === 1 ? '' : 's'}`; };
  const minusNotice = (date, c) => {
    const n = num(c.notice); if (!n) return date;
    const u = c.noticeUnit || 'month';
    return u === 'day' ? BW.addDays(date, -n) : u === 'week' ? BW.addDays(date, -7 * n) : BW.addPeriod(date, 'month', -n);
  };
  /* When the contract next ends. A contract with an end date that renews itself rolls on by its
     renewal term (12 months unless set); one that has become "cancel any time" has no end until
     someone gives notice, so this returns ''. */
  H.nextEnd = (c, today) => {
    if (c.cancelledAt) return isDate(c.end) ? c.end : '';
    if (!isDate(c.end)) return '';
    let end = c.end;
    if (end >= today || c.renews === 'no') return end;
    if (c.renews === 'rolling') return '';
    const step = num(c.renewMonths) || 12;
    for (let guard = 0; end < today && guard < 400; guard++) end = BW.addPeriod(end, 'month', step);
    return end;
  };
  // The last day to give notice so it ends at the next end date instead of renewing.
  H.cancelBy = (c, today) => { const end = H.nextEnd(c, today); return end && !c.cancelledAt ? minusNotice(end, c) : ''; };
  // For a "cancel any time" contract: give notice today and it ends on this day.
  H.endsIfCancelledToday = (c, today) => minusNotice(today, Object.assign({}, c, { notice: -num(c.notice) }));
  /* What to know about a contract today: 'ended', 'cancelled' (ending), 'decide' (the last day to
     cancel is within 45 days), 'missed' (that day passed, it renews), 'rolling' or 'ok'. */
  H.contractState = (c, today) => {
    if (c.cancelledAt) { const end = H.nextEnd(c, today); return end && end < today ? 'ended' : 'cancelled'; }
    if (c.renews === 'no' && isDate(c.end) && c.end < today) return 'ended';
    const by = H.cancelBy(c, today);
    if (!by) return isDate(c.end) || c.renews === 'rolling' ? 'rolling' : 'ok';
    const left = days(today, by);
    return left < 0 ? 'missed' : left <= 45 ? 'decide' : 'ok';
  };
  // Every contract that needs a decision soon, soonest first.
  H.decisions = (contracts, today, within = 45) => contracts
    .map((c) => ({ c, by: H.cancelBy(c, today) }))
    .filter(({ c, by }) => by && !c.cancelledAt && days(today, by) >= 0 && days(today, by) <= within)
    .sort((a, b) => a.by.localeCompare(b.by))
    .map(({ c, by }) => ({ contract: c, by, left: days(today, by), end: H.nextEnd(c, today) }));
  H.totalMonthly = (contracts, today) => contracts.filter((c) => !['ended'].includes(H.contractState(c, today))).reduce((s, c) => s + H.monthly(c), 0);

  // ---------- Home Upkeep ----------
  H.AREAS = [['heating', '🔥 Heating'], ['safety', '🚨 Safety'], ['water', '🚿 Water'], ['outside', '🏡 Outside'], ['inside', '🧽 Inside'], ['appliances', '🔌 Appliances'], ['car', '🚗 Car'], ['garden', '🌳 Garden'], ['other', '🔧 Other']];
  H.area = (id) => (H.AREAS.find((a) => a[0] === id) || H.AREAS[H.AREAS.length - 1])[1];
  // When a job is next due: a date set by hand wins, then last done + every N months, else now.
  H.nextDue = (j, today) => (isDate(j.next) ? j.next : isDate(j.last) ? BW.addPeriod(j.last, 'month', num(j.every) || 12) : today);
  H.jobState = (j, today) => { const left = days(today, H.nextDue(j, today)); return left < 0 ? 'overdue' : left <= 30 ? 'soon' : 'ok'; };
  // Marks a job done: logs it, sets last, clears a hand-set next date.
  H.markDone = (j, date, note, cost) => {
    const log = [{ date, note: note || '', cost: cost === '' || cost == null ? '' : num(cost) }].concat(j.log || []);
    return Object.assign({}, j, { last: date, next: '', log });
  };
  H.STARTER = [
    ['Service the boiler', 'heating', 12, 'A yearly service keeps it safe and the warranty valid.'],
    ['Bleed the radiators', 'heating', 12, 'Before the heating season.'],
    ['Test the smoke alarms', 'safety', 3, 'Press the button. Replace batteries yearly, alarms every 10 years.'],
    ['Check the carbon monoxide alarm', 'safety', 6, ''],
    ['Clean the gutters', 'outside', 12, 'After the leaves have fallen.'],
    ['Check the roof and the seals', 'outside', 12, 'After the winter.'],
    ['Clean the extractor hood filter', 'inside', 3, ''],
    ['Descale the kettle and the coffee machine', 'appliances', 3, ''],
    ['Clean the washing machine and the dryer filter', 'appliances', 3, ''],
    ['Have the chimney swept', 'heating', 12, 'If you use a fireplace or wood stove.'],
    ['Car service', 'car', 12, ''],
    ['Car inspection', 'car', 12, 'The roadworthiness test, if your car needs one.'],
  ];

  // ---------- Home Inventory ----------
  H.ROOMS = ['Living room', 'Kitchen', 'Bedroom', 'Children’s room', 'Bathroom', 'Hallway', 'Study', 'Attic', 'Garage', 'Garden', 'Other'];
  H.INV_KINDS = [['electronics', '💻 Electronics'], ['appliance', '🔌 Appliance'], ['furniture', '🛋️ Furniture'], ['jewellery', '💍 Jewellery'], ['bike', '🚲 Bike'], ['art', '🖼️ Art'],
    ['clothing', '👗 Clothing'], ['tools', '🧰 Tools'], ['other', '📦 Other']];
  H.value = (x) => num(x.value) || num(x.price);
  H.totals = (items) => {
    const rooms = {};
    for (const x of items) { const r = x.room || 'Other'; rooms[r] = (rooms[r] || 0) + H.value(x); }
    return { total: items.reduce((s, x) => s + H.value(x), 0), rooms, missing: items.filter((x) => !x.receipt && !(x.photos || []).length).length };
  };
  H.warrantyEnding = (items, today, within = 60) => items.filter((x) => isDate(x.warrantyUntil) && days(today, x.warrantyUntil) >= 0 && days(today, x.warrantyUntil) <= within)
    .sort((a, b) => a.warrantyUntil.localeCompare(b.warrantyUntil));

  // ---------- Letters ----------
  /* Household letter templates. {{me.*}} is the household, {{to.*}} the addressee, {{c.*}} the
     contract the letter is about, {{today}} today's date. Unknown fields stay visible as
     [brackets] to fill in. */
  H.LETTERS = [
    { id: 'cancel', emoji: '✂️', name: 'Cancel a contract', about: 'End a subscription, insurance or contract, with the date it should stop.', needs: 'contract',
      title: 'Cancellation: {{c.name}}',
      body: '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n# Cancellation of {{c.name}}\n\nReference: {{c.reference}}\n\nDear Sir or Madam,\n\nI hereby cancel the contract above. Please end it at the first possible date, which I understand to be {{c.end}}.\n\nPlease confirm the cancellation and the end date in writing, and stop any direct debits after that date.\n\nKind regards,\n\n\n{{me.name}}' },
    { id: 'move', emoji: '🚚', name: 'Change of address', about: 'Tell a company or organisation where you live now.', title: 'New address: {{me.name}}',
      body: '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n# Change of address\n\nReference: [customer or policy number]\n\nDear Sir or Madam,\n\nFrom [date] my address is:\n\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\nPlease use it for all letters from that date. My email address and phone number stay the same: {{me.email}}, {{me.phone}}.\n\nKind regards,\n\n\n{{me.name}}' },
    { id: 'complaint', emoji: '😤', name: 'Complaint', about: 'Calm, factual and clear about what you want them to do.', title: 'Complaint: [about what]',
      body: '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n# Complaint about [the product or service]\n\nReference: {{c.reference}}\n\nDear Sir or Madam,\n\nOn [date] [what happened, in two or three sentences].\n\nThis is not what I agreed to, because [why].\n\nI would like you to [what you want: a repair, a refund, a replacement, an apology], within 14 days of this letter.\n\nI have kept [receipts, photos, emails] and can send copies.\n\nKind regards,\n\n\n{{me.name}}' },
    { id: 'claim', emoji: '☂️', name: 'Insurance claim', about: 'Report damage or theft, with the list of what was lost.', needs: 'contract', title: 'Claim: {{c.name}}',
      body: '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n# Claim under policy {{c.reference}}\n\nDear Sir or Madam,\n\nOn [date] [what happened: water damage, a break-in, a fire].\n\nThe damage:\n\n- [item, value]\n- [item, value]\n\nI have attached photos, receipts and [a police report, if there was a theft]. Please let me know what else you need and when an assessor can visit, if needed.\n\nKind regards,\n\n\n{{me.name}}' },
    { id: 'objection', emoji: '✋', name: 'Objection to a decision', about: 'Object to a decision by a council, tax office or other authority, within the deadline.', title: 'Objection to decision [reference]',
      body: '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n# Objection to your decision of [date], reference [reference]\n\nDear Sir or Madam,\n\nI object to the decision above. A copy is attached.\n\nMy reasons:\n\n- [reason one]\n- [reason two]\n\nI ask you to [withdraw the decision / change it to …].\n\nPlease confirm that you have received this objection.\n\nKind regards,\n\n\n{{me.name}}' },
    { id: 'access', emoji: '🔎', name: 'Ask for your personal data', about: 'Ask a company for all the data it holds about you (your right under the GDPR).', title: 'Request for my personal data',
      body: '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n# Request for access to my personal data\n\nDear Sir or Madam,\n\nUnder article 15 of the General Data Protection Regulation I ask for a copy of all personal data you hold about me, the purposes you use it for, who you have shared it with, how long you keep it and where you got it from.\n\nMy details: {{me.name}}, {{me.email}}, customer number [number, if you have one].\n\nThe regulation gives you one month to reply.\n\nKind regards,\n\n\n{{me.name}}' },
    { id: 'warranty', emoji: '🧾', name: 'Faulty product', about: 'Ask the shop to repair or replace something that broke too soon.', title: 'Faulty product: [product]',
      body: '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n# Faulty product: [product]\n\nDear Sir or Madam,\n\nOn [date of purchase] I bought [product] from you for [price]. A copy of the receipt is attached.\n\nSince [date] it [what is wrong]. I have used it normally.\n\nUnder the legal guarantee a product must work as long as can reasonably be expected. I ask you to repair or replace it free of charge.\n\nKind regards,\n\n\n{{me.name}}' },
    { id: 'letter', emoji: '📨', name: 'Blank letter', about: 'Your address and the date, the rest is yours.', title: 'Letter to {{to.name}}',
      body: '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n# About …\n\nDear …,\n\n\n\nKind regards,\n\n\n{{me.name}}' },
  ];
  H.fill = (text, { me = {}, to = {}, c = {}, today = BW.today() } = {}) => {
    const s = Object.assign({}, me);
    const contract = Object.assign({}, c, { end: c.end ? BW.fmtDate(c.end, { day: 'numeric', month: 'long', year: 'numeric' }) : '' });
    return String(text).replace(/\{\{(\w+)\.?(\w*)\}\}/g, (all, a, b) => {
      if (a === 'today') return BW.fmtDate(today, { day: 'numeric', month: 'long', year: 'numeric' });
      const src = a === 'me' ? s : a === 'to' ? to : a === 'c' ? contract : null;
      const v = src && src[b];
      return v != null && String(v).trim() ? String(v) : `[${b === 'name' && a === 'to' ? 'addressee' : b}]`;
    }).replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n\n');
  };
  H.me = (s) => ({ name: s.ownerName || '', address: s.address || '', postcode: s.postcode || '', city: s.city || '', email: s.email || '', phone: s.phone || '' });

  // ---------- Moving Planner ----------
  // [days relative to the moving day, task]
  H.MOVE_TASKS = [
    [-56, 'Give notice on the rental, or set the dates for the sale'], [-56, 'Ask two or three movers for a quote, or book a van'],
    [-42, 'Clear out: sell, give away or throw out what you won’t take'], [-35, 'Book time off work for the move'],
    [-28, 'Tell your energy, water and internet providers the moving date'], [-28, 'Arrange childcare or a pet sitter for the day'],
    [-21, 'Start packing what you don’t use every day; label boxes by room'], [-21, 'Arrange parking or a permit for the van'],
    [-14, 'Send the change-of-address letters'], [-14, 'Set up post forwarding'],
    [-7, 'Pack a box for the first night: kettle, sheets, chargers, tools'], [-3, 'Defrost the freezer'],
    [0, 'Read the meters at both homes and take photos'], [0, 'Hand over or collect the keys'],
    [3, 'Register at your new address with the council, if you need to'], [7, 'Check the insurance covers the new home'],
    [14, 'Find a doctor and a dentist nearby, if you moved far'], [30, 'Check that all post comes to the new address'],
  ];
  H.WHO_TO_TELL = ['The council (registering your address)', 'Your employer', 'Your bank', 'The tax office, if it doesn’t follow your registration', 'Your doctor and dentist', 'School or childcare',
    'Your insurers', 'Energy, water and internet', 'Your phone provider', 'Subscriptions and memberships', 'Friends and family'];
  H.moveTasks = (move) => H.MOVE_TASKS.map(([d, t], i) => ({ id: 't' + i, task: t, due: isDate(move.date) ? BW.addDays(move.date, d) : '', done: false }));

  // ---------- Just in Case ----------
  H.BINDER = [
    ['people', '📞', 'People to call', 'Family, a close friend, your doctor, a lawyer or notary, your employer.'],
    ['where', '📍', 'Where things are', 'The folder with the papers, spare keys, the will, the safe. Never the codes themselves.'],
    ['money', '💶', 'Money and accounts', 'Which banks, pensions and insurances you have. No passwords or PINs.'],
    ['home', '🏠', 'The house', 'The stopcock, the fuse box, the meters, who to call for the heating.'],
    ['digital', '💻', 'Digital life', 'Where your password manager is and who may open it, accounts to close or keep.'],
    ['pets', '🐾', 'Pets', 'Food, the vet, medicines, who would take them in.'],
    ['wishes', '💐', 'Wishes', 'Anything you want the people you love to know.'],
    ['notes', '📝', 'Anything else', ''],
  ];

  // ---------- the dashboard: everything with a date, soonest first ----------
  H.upcoming = ({ papers = [], contracts = [], upkeep = [], inventory = [], moves = [] }, today, within = 60) => {
    const out = [];
    for (const e of H.expiring(papers, today)) out.push({ date: e.date, app: 'papers', id: e.paper.id, emoji: H.kind(e.paper.kind)[1], text: `${e.paper.title || 'A document'} ${e.left < 0 ? 'expired' : 'expires'}`, left: e.left });
    for (const d of H.decisions(contracts, today, within)) out.push({ date: d.by, app: 'contracts', id: d.contract.id, emoji: '✂️', text: `Last day to cancel ${d.contract.name || d.contract.provider || 'a contract'}`, left: d.left });
    for (const j of upkeep) { const due = H.nextDue(j, today); const left = days(today, due); if (left <= Math.min(within, 30)) out.push({ date: due, app: 'upkeep', id: j.id, emoji: '🛠️', text: j.task || 'Upkeep', left }); }
    for (const x of H.warrantyEnding(inventory, today, within)) out.push({ date: x.warrantyUntil, app: 'inventory', id: x.id, emoji: '🧾', text: `Warranty ends: ${x.name || 'something you own'}`, left: days(today, x.warrantyUntil) });
    for (const m of moves) if (isDate(m.date) && days(today, m.date) >= 0 && !m.finished) out.push({ date: m.date, app: 'moving', id: m.id, emoji: '🚚', text: `Moving day${m.to ? ': ' + m.to : ''}`, left: days(today, m.date) });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  };

  // ---------- one PDF style for letters and packs ----------
  // body: lines; "# " is a heading, "- " a bullet. Returns a Blob.
  H.pdf = (title, body, { footer = '' } = {}) => {
    const d = new BW.pdf.Doc(), W = d.W, Hh = d.H, M = 64, accent = '#F5A623';
    let y = 64, page = 1;
    const foot = () => { if (footer) d.text(footer, M, Hh - 32, { size: 7.5, color: '#9A97AC' }); d.text(String(page), W - M, Hh - 32, { size: 7.5, color: '#9A97AC', align: 'right' }); };
    const room = (h) => { if (y + h > Hh - 64) { foot(); d.addPage(); page++; y = 64; } };
    d.rect(0, 0, W, 8, { fill: accent });
    for (const raw of String(body).split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (!line) { y += 8; continue; }
      if (line.startsWith('# ')) {
        room(30); y += 8;
        d.wrap(line.slice(2), W - 2 * M, 13, true).forEach((l) => { d.text(l, M, y, { size: 13, bold: true, color: '#1E1B2E' }); y += 17; });
        y += 2; continue;
      }
      const bullet = /^[-*] /.test(line), text = bullet ? line.slice(2) : line, x = bullet ? M + 14 : M;
      d.wrap(text, W - M - x, 10.5).forEach((l, i) => { room(15); if (bullet && !i) d.rect(M + 3, y - 5, 4, 4, { fill: accent, r: 2 }); d.text(l, x, y, { size: 10.5, color: '#2B2840' }); y += 15; });
    }
    foot();
    return d.blob(title);
  };
  // Saves a PDF in the folder (or downloads it) and says where it went.
  H.savePdf = async (folder, title, blob) => {
    const name = BW.fileSafe(title || 'Document') + '.pdf';
    const r = await BW.store.writeFile(`${folder}/${name}`, blob);
    BW.toast(r.saved ? `Saved to ${BW.esc(r.where)}` : `${BW.esc(name)} is in your Downloads`, '📄');
  };
  H.days = days;
})();
