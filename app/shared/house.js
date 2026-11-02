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
  H.when = (left) => (left === 0 ? 'today' : left === 1 ? 'tomorrow' : left > 0 ? (left > 540 ? `in ${Math.round(left / 365)} years` : left > 60 ? `in ${Math.round(left / 30)} months` : `in ${left} days`) : left === -1 ? 'yesterday' : `${-left} days ago`);
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
  H.upcoming = ({ papers = [], contracts = [], upkeep = [], inventory = [], moves = [] }, today, within = 60) => {
    const out = [];
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
