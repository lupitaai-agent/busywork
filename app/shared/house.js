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
  H.when = (left) => BW.t(left === 0 ? 'today' : left === 1 ? 'tomorrow' : left > 0 ? (left > 540 ? `in ${Math.round(left / 365)} years` : left > 60 ? `in ${Math.round(left / 30)} months` : `in ${left} days`) : left === -1 ? 'yesterday' : `${-left} days ago`);
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
  /* The last day to give notice so it ends at the next end date instead of renewing. Only a contract
     that renews by itself has one: one that becomes "cancel any time" can be stopped later without a
     penalty, and one that just ends needs nothing. */
  H.cancelBy = (c, today) => {
    if (c.cancelledAt || c.renews === 'rolling' || c.renews === 'no') return '';
    const end = H.nextEnd(c, today); return end ? minusNotice(end, c) : '';
  };
  // For a "cancel any time" contract: give notice today and it ends on this day.
  H.endsIfCancelledToday = (c, today) => minusNotice(today, Object.assign({}, c, { notice: -num(c.notice) }));
  /* What to know about a contract today: 'ended', 'cancelled' (ending), 'decide' (the last day to
     cancel is within 45 days), 'missed' (that day passed, it renews), 'term' (a fixed term ends
     within 45 days, after which it is cancel any time: time to compare), 'rolling' (cancel any time)
     or 'ok'. */
  H.contractState = (c, today) => {
    if (c.cancelledAt) { const end = H.nextEnd(c, today); return end && end < today ? 'ended' : 'cancelled'; }
    if (c.renews === 'no') return isDate(c.end) && c.end < today ? 'ended' : 'ok';
    if (c.renews === 'rolling') return isDate(c.end) && c.end >= today ? (days(today, c.end) <= 45 ? 'term' : 'ok') : 'rolling';
    const by = H.cancelBy(c, today);
    if (!by) return 'ok';
    const left = days(today, by);
    return left < 0 ? 'missed' : left <= 45 ? 'decide' : 'ok';
  };
  /* Every contract with a date to act on soon, soonest first: the last day to cancel one that renews
     by itself (kind 'cancel'), or the end of a fixed term (kind 'term'). */
  H.decisions = (contracts, today, within = 45) => contracts
    .filter((c) => !c.cancelledAt)
    .map((c) => (c.renews === 'rolling' ? { c, by: isDate(c.end) && c.end >= today ? c.end : '', kind: 'term' } : { c, by: H.cancelBy(c, today), kind: 'cancel' }))
    .filter(({ by }) => by && days(today, by) >= 0 && days(today, by) <= within)
    .sort((a, b) => a.by.localeCompare(b.by))
    .map(({ c, by, kind }) => ({ contract: c, by, kind, left: days(today, by), end: H.nextEnd(c, today) }));
  // How a decision reads in a list.
  H.decisionText = (d) => (d.kind === 'term' ? `Fixed term ends: ${d.contract.name || d.contract.provider || 'a contract'}` : `Last day to cancel ${d.contract.name || d.contract.provider || 'a contract'}`);
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
  // i18n: skip (letters are written in the language Busy speaks, with that country's rules)
  // The same letters in the other languages Busy speaks: [title, body]. The data request names the law of
  // the place: the GDPR in Europe, the LGPD in Brazil; the faulty product the legal guarantee there.
  const HEAD = '{{me.name}}\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\n{{to.name}}\n{{to.address}}\n\n{{me.city}}, {{today}}\n\n';
  H.LETTER_TEXT = {
    nl: {
      cancel: ['Opzegging: {{c.name}}', '# Opzegging {{c.name}}\n\nKenmerk: {{c.reference}}\n\nGeachte heer, mevrouw,\n\nHierbij zeg ik het bovengenoemde contract op. Ik verzoek u het te beëindigen op de eerst mogelijke datum; volgens mij is dat {{c.end}}.\n\nWilt u de opzegging en de einddatum schriftelijk bevestigen en na die datum geen automatische incasso’s meer uitvoeren?\n\nMet vriendelijke groet,\n\n\n{{me.name}}'],
      move: ['Nieuw adres: {{me.name}}', '# Adreswijziging\n\nKenmerk: [klant- of polisnummer]\n\nGeachte heer, mevrouw,\n\nVanaf [datum] is mijn adres:\n\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\nWilt u vanaf die datum al uw post naar dit adres sturen? Mijn e-mailadres en telefoonnummer blijven hetzelfde: {{me.email}}, {{me.phone}}.\n\nMet vriendelijke groet,\n\n\n{{me.name}}'],
      complaint: ['Klacht: [waarover]', '# Klacht over [het product of de dienst]\n\nKenmerk: {{c.reference}}\n\nGeachte heer, mevrouw,\n\nOp [datum] [wat er gebeurde, in twee of drie zinnen].\n\nDit is niet wat we hebben afgesproken, omdat [waarom].\n\nIk verzoek u [wat u wilt: een reparatie, terugbetaling, vervanging, excuses], binnen 14 dagen na deze brief.\n\nIk heb [bonnen, foto’s, e-mails] bewaard en kan kopieën sturen.\n\nMet vriendelijke groet,\n\n\n{{me.name}}'],
      claim: ['Schademelding: {{c.name}}', '# Schademelding onder polis {{c.reference}}\n\nGeachte heer, mevrouw,\n\nOp [datum] [wat er gebeurde: waterschade, een inbraak, brand].\n\nDe schade:\n\n- [voorwerp, waarde]\n- [voorwerp, waarde]\n\nIk stuur foto’s, bonnen en [een proces-verbaal van de politie, bij diefstal] mee. Laat u mij weten wat u verder nodig hebt en wanneer een expert kan langskomen, als dat nodig is?\n\nMet vriendelijke groet,\n\n\n{{me.name}}'],
      objection: ['Bezwaar tegen besluit [kenmerk]', '# Bezwaarschrift tegen uw besluit van [datum], kenmerk [kenmerk]\n\nGeachte heer, mevrouw,\n\nIk maak bezwaar tegen het bovengenoemde besluit. Een kopie stuur ik mee.\n\nMijn redenen:\n\n- [eerste reden]\n- [tweede reden]\n\nIk verzoek u [het besluit in te trekken / het te wijzigen in …].\n\nWilt u bevestigen dat u dit bezwaarschrift hebt ontvangen?\n\nMet vriendelijke groet,\n\n\n{{me.name}}'],
      access: ['Verzoek om inzage in mijn persoonsgegevens', '# Inzageverzoek persoonsgegevens (artikel 15 AVG)\n\nGeachte heer, mevrouw,\n\nOp grond van artikel 15 van de Algemene verordening gegevensbescherming (AVG) vraag ik u om een kopie van alle persoonsgegevens die u over mij verwerkt, de doelen waarvoor u ze gebruikt, met wie u ze hebt gedeeld, hoe lang u ze bewaart en waar u ze vandaan hebt.\n\nMijn gegevens: {{me.name}}, {{me.email}}, klantnummer [nummer, als u dat hebt].\n\nDe AVG geeft u één maand om te reageren.\n\nMet vriendelijke groet,\n\n\n{{me.name}}'],
      warranty: ['Defect product: [product]', '# Defect product: [product]\n\nGeachte heer, mevrouw,\n\nOp [aankoopdatum] heb ik bij u [product] gekocht voor [prijs]. Een kopie van de bon stuur ik mee.\n\nSinds [datum] [wat er mis is]. Ik heb het product normaal gebruikt.\n\nVolgens de wet moet een product zo lang werken als je redelijkerwijs mag verwachten. Ik verzoek u het kosteloos te repareren of te vervangen.\n\nMet vriendelijke groet,\n\n\n{{me.name}}'],
      letter: ['Brief aan {{to.name}}', '# Betreft …\n\nBeste …,\n\n\n\nMet vriendelijke groet,\n\n\n{{me.name}}'],
    },
    de: {
      cancel: ['Kündigung: {{c.name}}', '# Kündigung {{c.name}}\n\nVertrags- oder Kundennummer: {{c.reference}}\n\nSehr geehrte Damen und Herren,\n\nhiermit kündige ich den oben genannten Vertrag fristgerecht zum nächstmöglichen Zeitpunkt, nach meiner Berechnung zum {{c.end}}.\n\nBitte bestätigen Sie mir die Kündigung und das Vertragsende schriftlich und buchen Sie danach keine Lastschriften mehr ab.\n\nMit freundlichen Grüßen\n\n\n{{me.name}}'],
      move: ['Neue Adresse: {{me.name}}', '# Adressänderung\n\nKunden- oder Vertragsnummer: [Nummer]\n\nSehr geehrte Damen und Herren,\n\nab dem [Datum] lautet meine Adresse:\n\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\nBitte verwenden Sie ab diesem Datum diese Adresse für alle Schreiben. Meine E-Mail-Adresse und Telefonnummer bleiben gleich: {{me.email}}, {{me.phone}}.\n\nMit freundlichen Grüßen\n\n\n{{me.name}}'],
      complaint: ['Beschwerde: [worüber]', '# Beschwerde über [das Produkt oder die Leistung]\n\nZeichen: {{c.reference}}\n\nSehr geehrte Damen und Herren,\n\nam [Datum] [was passiert ist, in zwei oder drei Sätzen].\n\nDas entspricht nicht unserer Vereinbarung, weil [warum].\n\nIch bitte Sie, innerhalb von 14 Tagen nach diesem Schreiben [was Sie möchten: eine Reparatur, eine Erstattung, einen Ersatz, eine Entschuldigung].\n\n[Quittungen, Fotos, E-Mails] habe ich aufbewahrt und sende Ihnen gern Kopien.\n\nMit freundlichen Grüßen\n\n\n{{me.name}}'],
      claim: ['Schadenmeldung: {{c.name}}', '# Schadenmeldung zur Versicherungsnummer {{c.reference}}\n\nSehr geehrte Damen und Herren,\n\nam [Datum] [was passiert ist: ein Wasserschaden, ein Einbruch, ein Brand].\n\nDer Schaden:\n\n- [Gegenstand, Wert]\n- [Gegenstand, Wert]\n\nFotos, Belege und [die Anzeigebestätigung der Polizei, bei Diebstahl] füge ich bei. Bitte teilen Sie mir mit, was Sie noch benötigen und wann gegebenenfalls ein Gutachter kommen kann.\n\nMit freundlichen Grüßen\n\n\n{{me.name}}'],
      objection: ['Widerspruch gegen Bescheid [Aktenzeichen]', '# Widerspruch gegen Ihren Bescheid vom [Datum], Aktenzeichen [Aktenzeichen]\n\nSehr geehrte Damen und Herren,\n\ngegen den oben genannten Bescheid lege ich hiermit Widerspruch ein. Eine Kopie liegt bei.\n\nBegründung:\n\n- [erster Grund]\n- [zweiter Grund]\n\nIch beantrage, [den Bescheid aufzuheben / ihn wie folgt zu ändern: …].\n\nBitte bestätigen Sie mir den Eingang dieses Widerspruchs.\n\nMit freundlichen Grüßen\n\n\n{{me.name}}'],
      access: ['Auskunftsersuchen zu meinen personenbezogenen Daten', '# Auskunft über meine personenbezogenen Daten (Art. 15 DSGVO)\n\nSehr geehrte Damen und Herren,\n\ngemäß Artikel 15 der Datenschutz-Grundverordnung (DSGVO) bitte ich um eine Kopie aller personenbezogenen Daten, die Sie über mich verarbeiten, und um Auskunft über die Zwecke, die Empfänger, die Speicherdauer und die Herkunft der Daten.\n\nMeine Angaben: {{me.name}}, {{me.email}}, Kundennummer [Nummer, falls vorhanden].\n\nDie DSGVO sieht eine Antwort innerhalb eines Monats vor.\n\nMit freundlichen Grüßen\n\n\n{{me.name}}'],
      warranty: ['Mangelhaftes Produkt: [Produkt]', '# Mangel an [Produkt]\n\nSehr geehrte Damen und Herren,\n\nam [Kaufdatum] habe ich bei Ihnen [Produkt] für [Preis] gekauft. Eine Kopie des Kaufbelegs liegt bei.\n\nSeit dem [Datum] [was nicht funktioniert]. Ich habe das Produkt normal benutzt.\n\nIm Rahmen der gesetzlichen Gewährleistung bitte ich Sie, den Mangel kostenlos zu beheben oder das Produkt zu ersetzen.\n\nMit freundlichen Grüßen\n\n\n{{me.name}}'],
      letter: ['Schreiben an {{to.name}}', '# Betreff: …\n\nSehr geehrte …,\n\n\n\nMit freundlichen Grüßen\n\n\n{{me.name}}'],
    },
    es: {
      cancel: ['Baja: {{c.name}}', '# Solicitud de baja de {{c.name}}\n\nReferencia: {{c.reference}}\n\nEstimados señores:\n\nPor la presente solicito la baja del contrato indicado, con efecto en la primera fecha posible, que según mis cálculos es el {{c.end}}.\n\nLes ruego que me confirmen por escrito la baja y la fecha de finalización, y que no carguen más recibos a partir de esa fecha.\n\nAtentamente,\n\n\n{{me.name}}'],
      move: ['Nueva dirección: {{me.name}}', '# Cambio de domicilio\n\nReferencia: [número de cliente o de póliza]\n\nEstimados señores:\n\nA partir del [fecha], mi dirección es:\n\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\nLes ruego que la utilicen para toda la correspondencia a partir de esa fecha. Mi correo electrónico y mi teléfono no cambian: {{me.email}}, {{me.phone}}.\n\nAtentamente,\n\n\n{{me.name}}'],
      complaint: ['Reclamación: [sobre qué]', '# Reclamación sobre [el producto o servicio]\n\nReferencia: {{c.reference}}\n\nEstimados señores:\n\nEl [fecha] [qué pasó, en dos o tres frases].\n\nEsto no es lo acordado, porque [por qué].\n\nLes solicito [lo que pide: una reparación, un reembolso, una sustitución, una disculpa] en un plazo de 14 días desde esta carta.\n\nConservo [tiques, fotos, correos] y puedo enviarles copias.\n\nAtentamente,\n\n\n{{me.name}}'],
      claim: ['Parte de siniestro: {{c.name}}', '# Comunicación de siniestro, póliza {{c.reference}}\n\nEstimados señores:\n\nEl [fecha] [qué pasó: daños por agua, un robo, un incendio].\n\nLos daños:\n\n- [objeto, valor]\n- [objeto, valor]\n\nAdjunto fotos, tiques y [la denuncia policial, en caso de robo]. Les ruego que me indiquen qué más necesitan y cuándo puede venir un perito, si es necesario.\n\nAtentamente,\n\n\n{{me.name}}'],
      objection: ['Recurso contra la resolución [referencia]', '# Recurso contra su resolución del [fecha], referencia [referencia]\n\nEstimados señores:\n\nPor la presente interpongo recurso contra la resolución indicada, de la que adjunto copia.\n\nMotivos:\n\n- [primer motivo]\n- [segundo motivo]\n\nSolicito [que se anule la resolución / que se modifique en el sentido de …].\n\nLes ruego que me confirmen la recepción de este escrito.\n\nAtentamente,\n\n\n{{me.name}}'],
      access: ['Solicitud de acceso a mis datos personales', '# Ejercicio del derecho de acceso (art. 15 RGPD)\n\nEstimados señores:\n\nDe acuerdo con el artículo 15 del Reglamento General de Protección de Datos (RGPD), solicito una copia de todos los datos personales que tratan sobre mí, los fines para los que los usan, a quién los han comunicado, durante cuánto tiempo los conservan y de dónde los obtuvieron.\n\nMis datos: {{me.name}}, {{me.email}}, número de cliente [número, si lo tiene].\n\nEl Reglamento les concede un mes para responder.\n\nAtentamente,\n\n\n{{me.name}}'],
      warranty: ['Producto defectuoso: [producto]', '# Producto defectuoso: [producto]\n\nEstimados señores:\n\nEl [fecha de compra] les compré [producto] por [precio]. Adjunto copia del tique.\n\nDesde el [fecha] [qué falla]. Lo he usado con normalidad.\n\nDe acuerdo con la garantía legal, les solicito que lo reparen o lo sustituyan sin coste.\n\nAtentamente,\n\n\n{{me.name}}'],
      letter: ['Carta a {{to.name}}', '# Asunto: …\n\nEstimado/a …:\n\n\n\nAtentamente,\n\n\n{{me.name}}'],
    },
    it: {
      cancel: ['Disdetta: {{c.name}}', '# Disdetta del contratto {{c.name}}\n\nRiferimento: {{c.reference}}\n\nSpettabile azienda,\n\ncon la presente comunico la disdetta del contratto indicato, con effetto dalla prima data utile, che secondo i miei calcoli è il {{c.end}}.\n\nVi prego di confermare per iscritto la disdetta e la data di cessazione, e di interrompere qualsiasi addebito dopo tale data.\n\nCordiali saluti,\n\n\n{{me.name}}'],
      move: ['Nuovo indirizzo: {{me.name}}', '# Cambio di indirizzo\n\nRiferimento: [numero cliente o di polizza]\n\nSpettabile azienda,\n\ndal [data] il mio indirizzo è:\n\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\nVi prego di utilizzarlo per tutta la corrispondenza a partire da quella data. Email e telefono restano invariati: {{me.email}}, {{me.phone}}.\n\nCordiali saluti,\n\n\n{{me.name}}'],
      complaint: ['Reclamo: [oggetto]', '# Reclamo relativo a [prodotto o servizio]\n\nRiferimento: {{c.reference}}\n\nSpettabile azienda,\n\nil [data] [cosa è successo, in due o tre frasi].\n\nCiò non corrisponde a quanto concordato, perché [motivo].\n\nVi chiedo [cosa chiedete: una riparazione, un rimborso, una sostituzione, delle scuse] entro 14 giorni dalla presente.\n\nHo conservato [scontrini, foto, email] e posso inviarvene copia.\n\nCordiali saluti,\n\n\n{{me.name}}'],
      claim: ['Denuncia di sinistro: {{c.name}}', '# Denuncia di sinistro, polizza {{c.reference}}\n\nSpettabile compagnia,\n\nil [data] [cosa è successo: danni da acqua, un furto, un incendio].\n\nI danni:\n\n- [oggetto, valore]\n- [oggetto, valore]\n\nAllego foto, scontrini e [la denuncia alle forze dell’ordine, in caso di furto]. Vi prego di indicarmi cos’altro vi serve e quando può venire un perito, se necessario.\n\nCordiali saluti,\n\n\n{{me.name}}'],
      objection: ['Ricorso contro il provvedimento [riferimento]', '# Ricorso contro il vostro provvedimento del [data], riferimento [riferimento]\n\nSpettabile amministrazione,\n\ncon la presente presento ricorso contro il provvedimento indicato, di cui allego copia.\n\nMotivi:\n\n- [primo motivo]\n- [secondo motivo]\n\nChiedo [l’annullamento del provvedimento / la sua modifica in …].\n\nVi prego di confermare la ricezione del presente ricorso.\n\nCordiali saluti,\n\n\n{{me.name}}'],
      access: ['Richiesta di accesso ai miei dati personali', '# Richiesta di accesso ai dati personali (art. 15 GDPR)\n\nSpettabile azienda,\n\nai sensi dell’articolo 15 del Regolamento generale sulla protezione dei dati (GDPR) chiedo una copia di tutti i dati personali che trattate su di me, le finalità del trattamento, a chi li avete comunicati, per quanto tempo li conservate e da dove li avete ottenuti.\n\nI miei dati: {{me.name}}, {{me.email}}, codice cliente [numero, se lo avete].\n\nIl Regolamento prevede una risposta entro un mese.\n\nCordiali saluti,\n\n\n{{me.name}}'],
      warranty: ['Prodotto difettoso: [prodotto]', '# Prodotto difettoso: [prodotto]\n\nSpettabile negozio,\n\nil [data di acquisto] ho acquistato da voi [prodotto] al prezzo di [prezzo]. Allego copia dello scontrino.\n\nDal [data] [cosa non funziona]. L’ho utilizzato normalmente.\n\nIn base alla garanzia legale di conformità vi chiedo di ripararlo o sostituirlo senza spese.\n\nCordiali saluti,\n\n\n{{me.name}}'],
      letter: ['Lettera a {{to.name}}', '# Oggetto: …\n\nGentile …,\n\n\n\nCordiali saluti,\n\n\n{{me.name}}'],
    },
    'pt-br': {
      cancel: ['Cancelamento: {{c.name}}', '# Cancelamento de {{c.name}}\n\nReferência: {{c.reference}}\n\nPrezados,\n\nVenho por meio desta solicitar o cancelamento do contrato acima, na primeira data possível, que pelos meus cálculos é {{c.end}}.\n\nPeço que confirmem por escrito o cancelamento e a data de encerramento, e que não façam mais cobranças após essa data.\n\nAtenciosamente,\n\n\n{{me.name}}'],
      move: ['Novo endereço: {{me.name}}', '# Mudança de endereço\n\nReferência: [número de cliente ou da apólice]\n\nPrezados,\n\nA partir de [data], meu endereço é:\n\n{{me.address}}\n{{me.postcode}} {{me.city}}\n\nPeço que usem este endereço para todas as correspondências a partir dessa data. Meu e-mail e telefone continuam os mesmos: {{me.email}}, {{me.phone}}.\n\nAtenciosamente,\n\n\n{{me.name}}'],
      complaint: ['Reclamação: [sobre o quê]', '# Reclamação sobre [o produto ou serviço]\n\nReferência: {{c.reference}}\n\nPrezados,\n\nEm [data], [o que aconteceu, em duas ou três frases].\n\nIsso não é o que foi combinado, porque [por quê].\n\nSolicito [o que você quer: o conserto, o reembolso, a troca, um pedido de desculpas] no prazo de 14 dias a partir desta carta.\n\nGuardei [notas fiscais, fotos, e-mails] e posso enviar cópias.\n\nAtenciosamente,\n\n\n{{me.name}}'],
      claim: ['Aviso de sinistro: {{c.name}}', '# Aviso de sinistro, apólice {{c.reference}}\n\nPrezados,\n\nEm [data], [o que aconteceu: um vazamento, um furto, um incêndio].\n\nOs danos:\n\n- [item, valor]\n- [item, valor]\n\nAnexo fotos, notas fiscais e [o boletim de ocorrência, em caso de furto]. Peço que me informem o que mais precisam e quando um perito pode vir, se necessário.\n\nAtenciosamente,\n\n\n{{me.name}}'],
      objection: ['Recurso contra a decisão [referência]', '# Recurso contra a decisão de [data], referência [referência]\n\nPrezados,\n\nVenho apresentar recurso contra a decisão acima, cuja cópia segue em anexo.\n\nMeus motivos:\n\n- [primeiro motivo]\n- [segundo motivo]\n\nPeço [que a decisão seja anulada / que seja alterada para …].\n\nPeço que confirmem o recebimento deste recurso.\n\nAtenciosamente,\n\n\n{{me.name}}'],
      access: ['Pedido de acesso aos meus dados pessoais', '# Pedido de acesso aos dados pessoais (art. 18 da LGPD)\n\nPrezados,\n\nCom base nos artigos 18 e 19 da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), solicito uma declaração completa de todos os dados pessoais que vocês tratam sobre mim, as finalidades do tratamento, com quem foram compartilhados, por quanto tempo serão guardados e de onde foram obtidos.\n\nMeus dados: {{me.name}}, {{me.email}}, número de cliente [número, se tiver].\n\nA LGPD prevê a resposta completa em até 15 dias.\n\nAtenciosamente,\n\n\n{{me.name}}'],
      warranty: ['Produto com defeito: [produto]', '# Produto com defeito: [produto]\n\nPrezados,\n\nEm [data da compra], comprei de vocês [produto] por [preço]. Segue cópia da nota fiscal.\n\nDesde [data], [o que está errado]. Usei o produto normalmente.\n\nDe acordo com o Código de Defesa do Consumidor (art. 18), solicito o conserto em até 30 dias ou a troca do produto, sem custo.\n\nAtenciosamente,\n\n\n{{me.name}}'],
      letter: ['Carta para {{to.name}}', '# Assunto: …\n\nPrezado(a) …,\n\n\n\nAtenciosamente,\n\n\n{{me.name}}'],
    },
  };
  // What Busy couldn't fill in, in [brackets] in the letter's language.
  const GAPS = {
    nl: { addressee: 'geadresseerde', name: 'naam', address: 'adres', postcode: 'postcode', city: 'plaats', email: 'e-mailadres', phone: 'telefoonnummer', reference: 'kenmerk', end: 'einddatum' },
    de: { addressee: 'Empfänger', name: 'Name', address: 'Adresse', postcode: 'PLZ', city: 'Ort', email: 'E-Mail', phone: 'Telefon', reference: 'Nummer', end: 'Enddatum' },
    es: { addressee: 'destinatario', name: 'nombre', address: 'dirección', postcode: 'código postal', city: 'ciudad', email: 'correo electrónico', phone: 'teléfono', reference: 'referencia', end: 'fecha de fin' },
    it: { addressee: 'destinatario', name: 'nome', address: 'indirizzo', postcode: 'CAP', city: 'città', email: 'email', phone: 'telefono', reference: 'riferimento', end: 'data di fine' },
    'pt-br': { addressee: 'destinatário', name: 'nome', address: 'endereço', postcode: 'CEP', city: 'cidade', email: 'e-mail', phone: 'telefone', reference: 'referência', end: 'data de término' },
  };
  // i18n: end
  H.gap = (k) => ((GAPS[window.BusyLang] || {})[k] || k);
  {
    const own = H.LETTER_TEXT[window.BusyLang];
    if (own) H.LETTERS.forEach((t) => { if (own[t.id]) { t.title = own[t.id][0]; t.body = HEAD + own[t.id][1]; } });
  }
  H.fill = (text, { me = {}, to = {}, c = {}, today = BW.today() } = {}) => {
    const s = Object.assign({}, me);
    // An address that already starts with the company's name doesn't repeat it.
    to = Object.assign({}, to);
    const lines = String(to.address || '').split('\n');
    if (to.name && lines[0].trim().toLowerCase() === String(to.name).trim().toLowerCase()) to.address = lines.slice(1).join('\n');
    const contract = Object.assign({}, c, { end: c.end ? BW.fmtDate(c.end, { day: 'numeric', month: 'long', year: 'numeric' }) : '' });
    return String(text).replace(/\{\{(\w+)\.?(\w*)\}\}/g, (all, a, b) => {
      if (a === 'today') return BW.fmtDate(today, { day: 'numeric', month: 'long', year: 'numeric' });
      const src = a === 'me' ? s : a === 'to' ? to : a === 'c' ? contract : null;
      const v = src && src[b];
      return v != null && String(v).trim() ? String(v) : `[${H.gap(b === 'name' && a === 'to' ? 'addressee' : b)}]`;
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
  H.moveTasks = (move) => H.MOVE_TASKS.map(([d, t], i) => ({ id: 't' + i, task: BW.t(t), due: isDate(move.date) ? BW.addDays(move.date, d) : '', done: false }));

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
  H.upcoming = ({ papers = [], contracts = [], upkeep = [], inventory = [], moves = [], members = [], tax = '' }, today, within = 60) => {
    const out = [];
    for (const pet of members.filter((m) => m.kind === 'pet')) for (const d of H.petDue(pet, today)) if (d.left <= within) out.push({ date: d.date, app: 'people', href: 'home-people.html', id: pet.id, emoji: H.species(pet.species)[1], text: `${pet.name}: ${d.what}`, left: d.left });
    for (const c of contracts) { const from = H.compareFrom(c, today); if (from && days(today, from) <= within && c.renews !== 'rolling' && !H.cancelBy(c, today)) out.push(from >= today ? { date: from, app: 'contracts', id: c.id, emoji: '⚡', text: `Compare energy deals: ${c.name || c.provider || 'energy'}`, left: days(today, from) } : { date: c.end, app: 'contracts', id: c.id, emoji: '⚡', text: `Energy deal ends: ${c.name || c.provider || 'energy'}`, left: days(today, c.end) }); }
    if (tax && H.TAX[tax]) { const t = H.taxDates(tax, today); if (t.left <= within) out.push({ date: t.due, app: 'tax', href: 'home-tax.html', id: '', emoji: '🧾', text: `Tax return: ${H.TAX[tax].form}`, left: t.left }); }
    for (const e of H.expiring(papers, today)) out.push({ date: e.date, app: 'papers', id: e.paper.id, emoji: H.kind(e.paper.kind)[1], text: `${e.paper.title || 'A document'} ${e.left < 0 ? 'expired' : 'expires'}`, left: e.left });
    for (const d of H.decisions(contracts, today, within)) out.push({ date: d.by, app: 'contracts', id: d.contract.id, emoji: d.kind === 'term' ? '🔁' : '✂️', text: H.decisionText(d), left: d.left });
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

  // ---------- the tray ----------
  // A file dropped in becomes a document in Paper Trail: saved in the folder, named after the file, its words read
  // where Busy can read them. The person then says whose it is and when it runs out.
  const TRAY_GUESS = [['id', /passport|paspoort|ausweis|pasaporte|passaporto|\bid\b|identi/i], ['insurance', /insur|polis|verzeker|versicher|seguro|assicur/i], ['contract', /contract|agreement|lease|huur|vertrag|contrato|contratto/i],
    ['money', /\btax|belasting|aanslag|\bsteuer(?!ung)|bescheid|impuesto|hacienda|\bimpost[ae]\b|tributo|receita federal|\bbank(?:afschrift|auszug|statement)?\b|\bbanco\b|\bbanca\b/i]];
  // "2026_tax_return.pdf": _ is a word character, so the name is read with spaces.
  H.trayKind = (name) => (TRAY_GUESS.find(([, rx]) => rx.test(String(name).replace(/[_-]+/g, ' '))) || ['other'])[0];
  H.fileIn = async (file) => {
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 80) || 'A document';
    const kind = H.trayKind(file.name);
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    const rec = { title, kind, files: [] };
    const path = `Papers/${H.kind(kind)[2]}/${BW.fileSafe(title)} ${BW.uid().slice(-4)}${ext}`;
    const r = await BW.store.writeFile(path, file, { download: false });
    if (r && r.saved) rec.files.push(path);
    if (BW.fileText && BW.fileText.CAN.test(file.name)) { try { const t = await BW.fileText.read(file.name, file); if (t) rec.text = t.slice(0, 200000); } catch (e) { /* kept without its words */ } }
    return BW.store.put('papers', rec);
  };
  H.trayHtml = (big) => `<section class="tray${big ? ' big' : ''}" data-tray tabindex="0" role="button" aria-label="${BW.t('Drop the post here')}"><span class="te" aria-hidden="true">📥</span><h2>${BW.t('Drop the post here')}</h2>
    <p>${BW.t('A letter, a contract, a receipt. Or take a picture of it with your phone and drop that in.')}</p>
    <p class="how"><b>${BW.t('Free:')}</b> ${BW.t('it is filed, and you add the date.')}<br><b>${BW.t('With Juno:')}</b> ${BW.t('she reads it, files it and drafts the reply.')}</p>
    <input type="file" multiple hidden data-tray-input></section>`;
  H.bindTray = (root, refresh) => {
    const zone = BW.$('[data-tray]', root), input = zone && BW.$('[data-tray-input]', zone);
    if (!zone) return;
    const take = async (files) => {
      files = Array.from(files || []);
      if (!files.length) return;
      // An edition with an expert may take the post itself (read it, file it, answer it).
      if (BW.trayTake) { try { if (await BW.trayTake(files)) return; } catch (e) { BW.error(e); } }
      if (BW.store.kind !== 'folder') BW.toast('Scans are kept when Busy saves to a folder.', '📁');
      let last = null;
      for (const f of files) { try { last = await H.fileIn(f); } catch (e) { BW.error(e); } }
      if (files.length === 1 && last) { location.href = `${BW.root}apps/papers/index.html#open/${last.id}`; return; }
      BW.toast(`${files.length} filed. Now say whose they are and when they run out.`, '🗂️');
      refresh();
    };
    zone.onclick = (e) => { if (e.target !== input) input.click(); };
    zone.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    input.onchange = () => take(input.files);
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('over'); };
    zone.ondragleave = () => zone.classList.remove('over');
    zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('over'); take(e.dataTransfer.files); };
  };

  // ---------- the household: everyone in it (2.1) ----------
  /* A household is any number of members: people and pets. A member looks after things ("who"), which is
     different from whose a document is ("person"). Records keep the member's id in `who`; an older record
     may hold a typed name there, which is shown as it was typed. */
  H.MEMBER_COLOURS = ['tomato', 'sky', 'mint', 'grape', 'sun', 'pink', 'teal'];
  H.SPECIES = [['dog', '🐶', 'Dog'], ['cat', '🐱', 'Cat'], ['rabbit', '🐰', 'Rabbit'], ['bird', '🐦', 'Bird'], ['fish', '🐟', 'Fish'], ['horse', '🐴', 'Horse'], ['other', '🐾', 'Other']];
  H.species = (id) => H.SPECIES.find((s) => s[0] === id) || H.SPECIES[H.SPECIES.length - 1];
  const PET_WORDS = [['dog', /\b(dog|hond|hund|perro|cane|cachorro|c[aã]o)\b/i], ['cat', /\b(cat|kat|poes|katze|kater|gato|gata|gatto|gatta)\b/i], ['rabbit', /\b(rabbit|konijn|kaninchen|conejo|coniglio|coelho)\b/i],
    ['bird', /\b(bird|vogel|p[aá]jaro|uccello|p[aá]ssaro|parrot|papegaai)\b/i], ['fish', /\b(fish|vis|fisch|pez|pesce|peixe)\b/i], ['horse', /\b(horse|paard|pferd|caballo|cavallo|cavalo|pony)\b/i]];
  /* The first members, from what the household typed when it started ("Noor, Mila (8), Biscuit the dog") and
     the owner's own name. Each gets a colour in turn. Returns plain records, not yet saved. */
  const PET_ARTICLE = '(?:' + ['the', 'our', 'my', 'de', 'het', 'onze', 'ons', 'mijn', 'der', 'die', 'das', 'den', 'unser', 'unsere', 'mein', 'meine', 'el', 'la', 'nuestro', 'nuestra', 'mi', 'il', 'lo', 'nostro', 'nostra', 'o', 'a', 'nosso', 'nossa'].join('|') + ')';
  // "Biscuit the dog", "onze hond Max", "Rex (dog)". A bare "Cat" or "Hans Vogel" is a person: nobody is dropped.
  const petIn = (name, note) => {
    for (const [species, rx] of PET_WORDS) {
      const word = rx.source;
      let m = new RegExp(`^(.+?)[\\s,]+${PET_ARTICLE}\\s+${word}\\s*$`, 'i').exec(name);
      if (m) return { species, name: m[1].trim() };
      m = new RegExp(`^${PET_ARTICLE}\\s+${word}\\s+(.+)$`, 'i').exec(name);
      if (m) return { species, name: m[m.length - 1].trim() };
      if (name && new RegExp(`^\\s*(?:${PET_ARTICLE}\\s+)?${word}\\s*$`, 'i').test(note)) return { species, name, noteUsed: true };
    }
    return null;
  };
  const memberId = (name) => { const slug = String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return slug ? `m-${slug}` : ''; };
  H.seedMembers = (ownerName, text) => {
    const out = [], seen = new Set();
    // The id comes from the name, so two renders, or two computers on one shared folder, seed the same records.
    const add = (m) => { const key = m.name.toLowerCase(); if (!m.name || seen.has(key)) return; seen.add(key); m.colour = H.MEMBER_COLOURS[out.length % H.MEMBER_COLOURS.length]; const id = memberId(m.name); if (id) m.id = id; out.push(m); };
    if (String(ownerName || '').trim()) add({ name: String(ownerName).trim().split(/\s+/)[0], kind: 'person' });
    String(text || '').split(/[,;\n]|\s+(?:and|en|und|y|e)\s+/).map((s) => s.trim()).filter(Boolean).forEach((part) => {
      const note = (part.match(/\(([^)]*)\)/) || [])[1] || '';
      const name = part.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      if (!name) return;
      const pet = petIn(name, note);
      add(Object.assign({ name: pet ? pet.name : name, kind: pet ? 'pet' : 'person' }, pet ? { species: pet.species } : {}, note && !(pet && pet.noteUsed) ? { notes: note } : {}));
    });
    return out;
  };
  H.people = (members) => members.filter((m) => m.kind !== 'pet');
  H.pets = (members) => members.filter((m) => m.kind === 'pet');
  H.member = (members, id) => members.find((m) => m.id === id) || null;
  // The name to show for a record's `who`: the member's name, or what was once typed there.
  H.whoName = (members, who) => { const m = H.member(members, who); return m ? m.name : String(who || ''); };
  // "Just mine": what this member looks after. `nobody` asks for what nobody looks after yet.
  H.lookedAfterBy = (list, id) => list.filter((x) => (id === 'nobody' ? !x.who : x.who === id));
  /* Who looks after what: for each person the things they carry, then what nobody carries yet. `lists` is
     { contracts: [...], upkeep: [...], papers: [...] }; ended or replaced things are left out by the caller. */
  H.loads = (members, lists) => {
    const all = [];
    Object.entries(lists).forEach(([kind, list]) => (list || []).forEach((x) => all.push({ kind, item: x, who: x.who || '' })));
    const rows = H.people(members).map((m) => ({ member: m, items: all.filter((a) => a.who === m.id) }));
    const known = new Set(H.people(members).map((m) => m.id));
    return { rows, nobody: all.filter((a) => !a.who || !known.has(a.who)), total: all.length };
  };
  /* A member who is in the shared costs cannot be taken out: every split and balance would change. */
  H.memberInCosts = (id, costs, settlements) => (costs || []).some((c) => c.paidBy === id || !(c.among || []).length || (c.among || []).includes(id))
    || (settlements || []).some((x) => x.from === id || x.to === id);
  /* After a member is removed: what they looked after stays, with nobody's name on it, and a document that
     only they saw is seen by everyone again (otherwise nobody could ever find it). */
  H.forgetMember = async (id) => {
    for (const name of ['contracts', 'upkeep', 'papers', 'letters']) {
      const theirs = (await BW.store.all(name).catch(() => [])).filter((x) => x.who === id);
      if (theirs.length) await BW.store.putMany(name, theirs.map((x) => Object.assign({}, x, { who: '' }, name === 'papers' ? { private: '' } : {})));
    }
    if (H.myself() === id) H.setMyself('');
  };
  // Which member this computer belongs to. Kept on the computer, never in the shared folder.
  H.myself = () => { try { return localStorage.getItem('bw.house.me') || ''; } catch (e) { return ''; } };
  H.setMyself = (id) => { try { if (id) localStorage.setItem('bw.house.me', id); else localStorage.removeItem('bw.house.me'); } catch (e) { /* stays unset */ } };
  // The members, read once per screen; the tools ask for them when they load.
  H.members = [];
  H.loadMembers = async () => { try { H.members = await BW.store.all('members'); } catch (e) { H.members = []; } return H.members; };
  /* The form field "Who looks after it?": the people of the household as chips. A household of one has no use for
     it, so it gets no field; and a name once typed by hand (an upkeep job's "the garage") keeps its text box. */
  H.whoField = (current, typed) => {
    const people = H.people(H.members);
    if (current && !H.member(H.members, current)) return [typed || { k: 'who', label: 'Who looks after it?' }];
    if (people.length < 2) return typed ? [typed] : [];
    return [{ k: 'who', label: 'Who looks after it?', type: 'chips', options: people.map((m) => [m.id, m.name]).concat([['', 'Nobody yet']]) }];
  };


  // Next vaccination or check for a pet, from its `care` list of { what, last, every (months), next }.
  H.petDue = (pet, today) => (pet.care || []).map((c) => ({ pet, what: c.what, date: isDate(c.next) ? c.next : isDate(c.last) ? BW.addPeriod(c.last, 'month', num(c.every) || 12) : '' }))
    .filter((d) => d.date).map((d) => Object.assign(d, { left: days(today, d.date) })).sort((a, b) => a.date.localeCompare(b.date));

  /* The sitter's booklet: everything someone looking after the pet needs, as lines for the PDF. */
  H.sitterLines = (pet, s, today) => {
    const L = [`# ${pet.name}`, [BW.t(H.species(pet.species)[2]), pet.born && BW.t(`born on ${BW.fmtDate(pet.born)}`)].filter(Boolean).join(' · '), ''];
    const sec = (title, text) => { if (String(text || '').trim()) { L.push(`# ${BW.t(title)}`, ''); String(text).split('\n').forEach((l) => L.push(l)); L.push(''); } };
    sec('Food', pet.food); sec('Medicines', pet.medicines); sec('Routines', pet.routines);
    L.push(`# ${BW.t('The vet')}`, '', [pet.vet, pet.vetPhone].filter(Boolean).join(' · ') || BW.t('Not filled in'), '');
    if (pet.chip) L.push(`# ${BW.t('Chip')}`, '', [pet.chip, pet.chipRegister].filter(Boolean).join(' · '), '');
    const care = H.petDue(pet, today);
    if (care.length) { L.push(`# ${BW.t('Vaccinations')}`, ''); care.forEach((d) => L.push(`- ${d.what}: ${BW.t(`next on ${BW.fmtDate(d.date)}`)}`)); L.push(''); }
    sec('Notes', pet.notes);
    L.push(`# ${BW.t('If anything happens')}`, '', [s.ownerName, s.phone, s.email].filter(Boolean).join(' · ') || BW.t('Write your phone number here'));
    return L.join('\n');
  };
  // Travelling in the EU with a dog, cat or ferret: the steps that apply everywhere. The destination may ask for more.
  H.PET_TRAVEL = ['A microchip, put in before the rabies vaccination', 'A valid rabies vaccination: after the first one, wait 21 days before travelling', 'An EU pet passport from the vet (passports from Great Britain no longer count for travel in the EU)',
    'Some countries also ask for a tapeworm treatment for dogs a few days before arrival: check the destination', 'Insurance and the vet’s number with you', 'Five animals at most, travelling with you or within five days of you'];
  H.PET_TRAVEL_LINK = 'https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/movements-within-eu_en';

  // ---------- shared costs (2.1) ----------
  /* Who paid what, split between any number of people. A cost: { date, what, amount, paidBy, split, among, shares }.
     split 'equal' divides between `among` (everyone when empty); 'income' uses each person's `share` (a weight the
     household sets once, such as 60 and 40: never the incomes themselves); 'shares' uses the cost's own weights. */
  const cents = (v) => Math.round(num(v) * 100);
  H.SPLITS = [['equal', 'Equally'], ['income', 'By income share'], ['shares', 'Our own split']];
  H.owedParts = (cost, members) => {
    const people = H.people(members);
    let ids = (cost.among && cost.among.length ? cost.among : people.map((m) => m.id)).filter((id) => people.some((m) => m.id === id));
    if (!ids.length) return {};
    let weight = () => 1;
    if (cost.split === 'income') weight = (id) => Math.max(0, num((H.member(members, id) || {}).share));
    if (cost.split === 'shares') weight = (id) => Math.max(0, num((cost.shares || {})[id]));
    let total = ids.reduce((s, id) => s + weight(id), 0);
    if (!total) { weight = () => 1; total = ids.length; }
    // Whole cents, and the cents left over go one each to the first people, so the parts always add up.
    const amount = cents(cost.amount), parts = {};
    let given = 0;
    ids.forEach((id) => { parts[id] = Math.floor(amount * weight(id) / total); given += parts[id]; });
    for (let i = 0; given < amount; i = (i + 1) % ids.length) { if (weight(ids[i]) > 0) { parts[ids[i]] += 1; given += 1; } }
    return parts;
  };
  /* Where everyone stands, in cents: positive means the household owes you, negative means you owe.
     A settlement { from, to, amount } is money handed over to make things even. */
  H.balance = (costs, settlements, members) => {
    const net = {};
    H.people(members).forEach((m) => { net[m.id] = 0; });
    (costs || []).forEach((c) => {
      if (!c.paidBy || !(c.paidBy in net)) return;
      const parts = H.owedParts(c, members);
      if (!Object.keys(parts).length) return;
      net[c.paidBy] += cents(c.amount);
      Object.entries(parts).forEach(([id, p]) => { net[id] -= p; });
    });
    (settlements || []).forEach((s) => { if (s.from in net && s.to in net) { net[s.from] += cents(s.amount); net[s.to] -= cents(s.amount); } });
    return net;
  };
  // The fewest payments that make everyone even: the one who owes most pays the one who is owed most, and so on.
  H.settleUp = (net) => {
    const owes = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => [id, -v]).sort((a, b) => b[1] - a[1]);
    const owed = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => [id, v]).sort((a, b) => b[1] - a[1]);
    const pays = [];
    let i = 0, j = 0;
    while (i < owes.length && j < owed.length) {
      const amount = Math.min(owes[i][1], owed[j][1]);
      if (amount > 0) pays.push({ from: owes[i][0], to: owed[j][0], amount: amount / 100 });
      owes[i][1] -= amount; owed[j][1] -= amount;
      if (!owes[i][1]) i++;
      if (!owed[j][1]) j++;
    }
    return pays;
  };
  H.costsOfMonth = (costs, month) => (costs || []).filter((c) => String(c.date || '').slice(0, 7) === month);

  // ---------- the renewal check (2.1) ----------
  /* What a contract cost before against what it costs now, per month. `lastCost` is the old price in the
     same period as `cost`. Returns null when there is nothing to compare. */
  H.renewalChange = (c) => {
    if (c.lastCost === '' || c.lastCost == null || !num(c.lastCost) || !num(c.cost)) return null;
    const per = { month: 1, quarter: 3, year: 12 }[c.per] || 1;
    const diff = (num(c.cost) - num(c.lastCost)) / per;
    return { monthly: Math.round(diff * 100) / 100, yearly: Math.round(diff * 12 * 100) / 100, pct: Math.round((num(c.cost) / num(c.lastCost) - 1) * 1000) / 10, up: diff > 0 };
  };
  // A fixed energy deal: start comparing in its last 49 days.
  H.compareFrom = (c, today) => (c.kind === 'energy' && isDate(c.end) && c.end >= today && !c.cancelledAt ? BW.addDays(c.end, -49) : '');

  // ---------- everyone, or just mine (2.1) ----------
  /* "Just mine" keeps what this member looks after and what nobody looks after yet, so nothing drops out of sight.
     The choice is kept on this computer. A household of one, or a computer that has not said who it is, sees everything. */
  H.view = () => { try { return localStorage.getItem('bw.house.view') === 'mine' ? 'mine' : 'all'; } catch (e) { return 'all'; } };
  H.setView = (v) => { try { localStorage.setItem('bw.house.view', v === 'mine' ? 'mine' : 'all'); } catch (e) { /* stays as it was */ } };
  H.forView = (list, members, me, view) => {
    if (view !== 'mine' || !me || !H.member(members, me) || H.people(members).length < 2) return list;
    return list.filter((x) => !x.who || x.who === me || !H.member(members, x.who));
  };
  // "Only me": a document marked private is left out of other people's lists and of the binder. It is tidiness, never a
  // lock: the file is still in the shared folder.
  H.visiblePapers = (papers, me) => papers.filter((p) => !p.private || !p.who || !me || p.who === me);
  H.viewSwitch = (members) => {
    if (H.people(members).length < 2) return '';
    const me = H.member(members, H.myself());
    if (!me) return `<p class="s view-note">${BW.t('Say who you are on the Household page to see just your own things.')} <a href="${BW.root}home-people.html">${BW.t('Household')}</a></p>`;
    const v = H.view();
    return `<div class="filters just-mine" data-view role="group" aria-label="${BW.t('Whose things')}"><button type="button" data-v="all" aria-pressed="${v === 'all'}">${BW.t('Everyone')}</button><button type="button" data-v="mine" aria-pressed="${v === 'mine'}">${BW.esc(me.name)}</button></div>`;
  };
  H.bindViewSwitch = (root, refresh) => { const el = BW.$('[data-view]', root); if (el) el.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { H.setView(b.dataset.v); refresh(); } }; };

  // ---------- tax time (2.1) ----------
  /* One date a year per country, and the papers worth keeping for it. Dates move a little each year in some countries
     (Spain, Brazil): those say so. Busy keeps papers and dates; it never gives tax advice and never files anything. */
  H.TAX = {
    uk: { name: 'United Kingdom', flag: '🇬🇧', opens: '04-06', due: '01-31', dueNextYear: true, form: 'Self Assessment', who: 'Only if you must file: self-employed, rent, untaxed income or gains, and some others.', link: 'https://www.gov.uk/self-assessment-tax-returns',
      gather: ['P60 from your employer (and P11D if you have benefits)', 'Interest and dividend statements', 'Rent received and what the rental cost', 'Pension payments and Gift Aid donations', 'Self-employed income and costs'],
      keep: ['Receipts for allowable business or rental costs', 'Gift Aid donations', 'Private pension payments'] },
    nl: { name: 'Nederland', flag: '🇳🇱', opens: '03-01', due: '05-01', form: 'Aangifte inkomstenbelasting', who: 'If the tax office invites you, or if you get money back.', link: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/aangifte-inkomstenbelasting/aangifte-inkomstenbelasting',
      gather: ['Jaaropgaaf from every employer or benefit', 'Year statement of the mortgage', 'WOZ value of your home (the letter from the council)', 'Bank and savings balances on 1 January', 'Gifts to charities (bank statements or receipts)'],
      keep: ['Gifts to registered charities', 'Healthcare costs that insurance did not pay', 'Study costs'],
      also: 'Allowances (toeslagen): tell the tax office when your income or household changes, so you do not have to pay back.' },
    de: { name: 'Deutschland', flag: '🇩🇪', opens: '01-01', due: '07-31', dueNextYear: true, form: 'Einkommensteuererklärung', who: 'If you must file, or to get money back: most people who file voluntarily get a refund.', link: 'https://www.elster.de',
      gather: ['Lohnsteuerbescheinigung from your employer', 'Bills for tradespeople and household help, paid by transfer (never cash)', 'Work costs above the automatic allowance', 'Donations, childcare, insurance payments'],
      keep: ['Tradespeople’s bills: only the labour counts, paid by transfer', 'Household services: cleaning, garden, care', 'Work costs: tools, travel, a work room', 'Donation receipts'] },
    es: { name: 'España', flag: '🇪🇸', opens: '04-08', due: '06-30', vary: true, form: 'Declaración de la Renta', who: 'Check the draft (borrador) the tax agency prepares, and add what it does not know.', link: 'https://sede.agenciatributaria.gob.es/Sede/Renta.html',
      gather: ['The draft (borrador) from the tax agency', 'Certificate of withholdings from your employer', 'Rent you pay, and the contract', 'Childcare and school costs', 'Donations and union fees'],
      keep: ['Receipts for your region’s own deductions (rent, childcare, donations): the draft leaves these out', 'Mortgage statements for older mortgages'] },
    it: { name: 'Italia', flag: '🇮🇹', opens: '04-30', due: '09-30', form: 'Modello 730 precompilato', who: 'The pre-filled return is ready from the end of April. Check it and add what is missing.', link: 'https://www.agenziaentrate.gov.it/portale/web/guest/schede/dichiarazioni/730-precompilato',
      gather: ['Certificazione Unica from your employer or pension', 'Medical receipts with your tax code', 'School, sport and nursery costs for the children', 'Mortgage interest and insurance'],
      keep: ['Medical costs paid by card or transfer (19% back above a small excess)', 'Receipts that carry your tax code (codice fiscale)'] },
    br: { name: 'Brasil', flag: '🇧🇷', opens: '03-15', due: '05-29', vary: true, form: 'Declaração do Imposto de Renda', who: 'If your income or assets were above the yearly limits. The pre-filled return helps.', link: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda',
      gather: ['Informes de rendimentos from employers and banks (by the end of February)', 'Medical and health insurance receipts', 'School and university receipts', 'Private pension statements'],
      keep: ['Medical receipts (no limit, but proof is needed)', 'Education receipts (up to the yearly limit per person)'] },
  };
  const COUNTRY_WORDS = [['uk', /united kingdom|\buk\b|england|scotland|wales|great britain|britain/i], ['nl', /nederland|netherlands|holland/i], ['de', /deutschland|germany/i],
    ['es', /españa|espana|spain/i], ['it', /italia|italy/i], ['br', /brasil|brazil/i]];
  /* Which country's tax time a household sees: the one it chose on the Tax time page ('none' switches it off),
     else the country it typed, else the language's own country. It never guesses: a country Busy has no dates
     for (Ireland, Belgium, Austria) and English without a country give none, and the page asks. */
  H.taxCountry = (s, lang) => {
    if (s && s.taxCountry === 'none') return '';
    if (s && H.TAX[s.taxCountry]) return s.taxCountry;
    const country = String((s && s.country) || '').trim();
    if (country) {
      if (/^england$/i.test(country)) return 'uk';
      const typed = COUNTRY_WORDS.find(([, rx]) => rx.test(country));
      return typed ? typed[0] : H.TAX[country.toLowerCase()] ? country.toLowerCase() : '';
    }
    return { nl: 'nl', de: 'de', es: 'es', it: 'it', 'pt-br': 'br' }[lang] || '';
  };
  // The next deadline from today, and when that season opens. For a deadline in the next calendar year (the UK, Germany)
  // the season belongs to the tax year before it.
  H.taxDates = (code, today) => {
    const t = H.TAX[code] || H.TAX.uk, y = Number(today.slice(0, 4));
    let due = `${y}-${t.due}`;
    if (due < today) due = `${y + 1}-${t.due}`;
    const dy = Number(due.slice(0, 4));
    let opens = `${dy}-${t.opens}`;
    if (opens > due) opens = `${dy - 1}-${t.opens}`;
    return { due, opens, left: days(today, due), open: today >= opens, year: code === 'uk' ? `${dy - 2}-${String(dy - 1).slice(2)}` : String(dy - 1) };
  };
  // The tax year a day belongs to: the calendar year, except in the UK, where it runs from 6 April ("2026-27").
  H.taxYearOf = (code, date) => {
    const y = Number(String(date).slice(0, 4));
    if (code !== 'uk') return String(y);
    const start = String(date).slice(5) >= '04-06' ? y : y - 1;
    return `${start}-${String(start + 1).slice(2)}`;
  };
  // Papers tagged for a tax year.
  H.taxPapers = (papers, year) => papers.filter((p) => String(p.taxYear || '') === String(year));

  H.lang = () => window.BusyLang || 'en';
  // ---------- the drop folder (2.1) ----------
  H.phoneGuide = () => BW.modal({ title: `📱 ${BW.t('Post from your phone')}`, wide: true, body: BW.html(`<div class="phone-guide">
    <p>${BW.t('Keep your home folder in iCloud Drive, OneDrive or Google Drive. Then a scan made on your phone lands on this computer by itself.')}</p>
    <ol><li>${BW.t('In your home folder, Busy makes a folder called “Drop here”.')}</li>
    <li><b>iPhone:</b> ${BW.t('open the Files app, go to that folder, tap ⋯ and choose “Scan Documents”. Save.')}</li>
    <li><b>Android:</b> ${BW.t('open the Google Drive or OneDrive app, go to that folder, tap + and choose “Scan”. Save.')}</li>
    <li>${BW.t('A PDF from an online inbox (the tax office, the council, the bank): save it into the same folder.')}</li>
    <li>${BW.t('Back on the computer, open the tray: what arrived is waiting there. One click files it.')}</li></ol>
    <p class="s">${BW.t('Busy itself never connects to the internet. Your cloud folder does the travelling.')}</p></div>`), actions: [{ label: 'Got it', kind: 'primary' }] });
  /* A folder inside the home folder that a phone can save into, when the home folder sits in iCloud Drive, OneDrive or
     Google Drive. What lands there is filed like anything dropped on the tray. */
  H.DROP = 'Drop here';
  // Made once, in folder mode, on whichever Home page opens first, so the phone has somewhere to save to before the
  // tray is ever opened (the phone guide says Busy makes it). Written only when it is missing.
  H.ensureDrop = async () => {
    if (BW.store.kind !== 'folder' || BW.store.readOnly || H._dropMade) return;
    H._dropMade = true;
    try { if (!(await BW.store.readFile(`${H.DROP}/.busy`).catch(() => null))) await BW.store.writeFile(`${H.DROP}/.busy`, new Blob(['Busy Home: scans saved here wait in the tray.']), { download: false }); } catch (e) { /* made later */ }
  };
  H.dropFiles = async () => { if (BW.store.kind !== 'folder') return []; try { return (await BW.store.listFiles(H.DROP)).filter((n) => !n.startsWith('.') && !/^desktop\.ini$/i.test(n)); } catch (e) { return []; } };
  H.fileDrops = async (names) => {
    let n = 0;
    if (BW.store.readOnly) return n;
    for (const name of names) {
      try {
        const blob = await BW.store.readFile(`${H.DROP}/${name}`);
        if (!blob || !blob.size) continue;
        const file = blob instanceof File ? blob : new File([blob], name, { type: blob.type || '' });
        const rec = await H.fileIn(file);
        if (rec && rec.files && rec.files.length) { await BW.store.removeFile(`${H.DROP}/${name}`); n++; }
      } catch (e) { BW.error(e); }
    }
    return n;
  };

  // ---------- Tuck, the Busy Home helper: a short celebration ----------
  // A small rendered clip (shared/media/tuck-cheer.mp4, made in the Busy Studio) with the good news.
  // Without motion (the system setting), a still of the same moment. Closes by itself.
  H.cheer = (title, text) => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const src = BW.root + 'shared/media/tuck-cheer';
    const el = BW.html(`<div class="tuck-cheer" role="status" aria-live="polite"><div class="card">
      ${calm ? `<img src="${src}.jpg" alt="">` : `<video src="${src}.mp4" poster="${src}.jpg" autoplay muted playsinline aria-hidden="true"></video>`}
      <div class="words"><b>${BW.esc(title)}</b><p>${BW.esc(text)}</p></div>
      <button type="button" class="close" data-close aria-label="Close">✕</button></div></div>`);
    document.body.append(el);
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    el.querySelector('[data-close]').onclick = close;
    setTimeout(close, 6500);
    if (!calm) BW.confetti({ y: innerHeight - 160 });
  };
})();
