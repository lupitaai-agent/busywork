/* Example data for Busy Rentals: Femke Mulder, an accidental landlord in Haarlem. She moved in with her partner and
   let her own flat in Utrecht; she inherited her mother's flat in Amersfoort, whose tenants have just moved out.
   So the demo shows a tenancy running well (one month's rent still to come in), and one at its end (the check-out
   against the check-in, the deposit to return by its date). Made up, with no real names. Dates are relative to
   today, so there is always something coming up. Used by the website demo only; not in any download. Every record
   carries example: true. */
(function () {
  'use strict';
  const BW = window.BW;
  const day = (n) => BW.addDays(BW.today(), n);
  const month = (n) => BW.addPeriod(BW.today(), 'month', n);
  const first = (n) => `${month(n).slice(0, 7)}-01`;

  BW.rentalsExamples = {
    settings: {
      suite: 'rentals', ownerName: 'Femke Mulder', country: 'nl', address: 'Kastanjelaan 5', postcode: '2000 AA', city: 'Haarlem',
      email: 'femke@example.com', phone: '+31 6 1234 5678', currency: 'EUR',
    },
    async load() {
      const R = BW.rentals, today = BW.today();
      const ex = (o) => Object.assign({ id: BW.uid(), example: true }, o);

      // The two homes. Utrecht is in an owners' association, so it has the yearly service-cost statement.
      const utrecht = ex({ name: 'Flat Utrecht', address: 'Bloemstraat 22-II', postcode: '3500 AA', city: 'Utrecht', country: 'nl', kind: 'flat', duties: ['service'],
        keys: '2 front door, 2 flat, 1 bike shed. A spare set with my sister.', meters: 'Electricity and gas in the hallway cupboard; water under the kitchen sink.',
        suppliers: 'Owners’ association: Example VvE Beheer, 030 111 2222. Plumber: Example Loodgieters, 030 333 4444.', insurance: 'Building through the owners’ association; landlord contents with Example Insurance.' });
      const amersfoort = ex({ name: 'Flat Amersfoort', address: 'Beukenlaan 7', postcode: '3800 AA', city: 'Amersfoort', country: 'nl', kind: 'flat',
        keys: '3 front door, 1 storage room.', meters: 'All in the storage room downstairs.', notes: 'Mum’s flat, inherited. No owners’ association.' });
      const homes = [utrecht, amersfoort];

      // Utrecht: let for fourteen months, rent on the 1st; €1,200 at first, €1,250 since two months ago (the yearly
      // review), so the ledger shows that earlier months keep the old rent. Amersfoort: the tenants left five days ago.
      const yara = R.changeRent(ex({ homeId: utrecht.id, tenants: 'Yara Smit & Daan Kok', email: 'yara@example.com', phone: '+31 6 2222 3333', start: first(-14), rent: 1200, payDay: 1,
        deposit: 2400, depositReceived: first(-14), depositHeld: 'A separate savings account', notes: 'Both work in Utrecht. They asked about a cat: yes, if they let me know.' }), 1250, first(-2));
      const lucas = ex({ homeId: amersfoort.id, tenants: 'Lucas Brouwer', email: 'lucas@example.com', start: first(-30), endedAt: day(-5), rent: 980, payDay: 1,
        deposit: 1960, depositReceived: first(-30), depositHeld: 'A separate savings account', deductions: 'Burn mark on the kitchen worktop: €150, quote attached.',
        notes: 'Moved to Groningen for work. Asked for the deposit to the same account.' });
      const tenancies = [yara, lucas];

      // What is done. Amersfoort's energy label was never found among Mum's papers, so it shows as unknown.
      const june = `${today.slice(0, 4)}-06-20` <= today ? `${today.slice(0, 4)}-06-20` : `${Number(today.slice(0, 4)) - 1}-06-20`;
      const checks = [
        ex({ homeId: utrecht.id, duty: 'label', last: month(-40), handedOverAt: first(-14), handedOverTo: yara.id, by: 'Example Energielabels', notes: 'Label B.' }),
        ex({ homeId: utrecht.id, tenancyId: yara.id, duty: 'points', last: first(-15), notes: '152 points: middle rent. Highest rent at the time worked out on the government’s rent check.' }),
        ex({ homeId: utrecht.id, tenancyId: yara.id, duty: 'information', last: first(-14), handedOverAt: first(-14), handedOverTo: yara.id }),
        ex({ homeId: utrecht.id, tenancyId: yara.id, duty: 'alarms', last: first(-14), notes: 'Tested together on the first day.' }),
        ex({ homeId: utrecht.id, tenancyId: yara.id, duty: 'service', last: june, handedOverAt: june, handedOverTo: yara.id, notes: 'Owners’ association advance €65 a month; €38 back to the tenants.' }),
        ex({ homeId: amersfoort.id, tenancyId: lucas.id, duty: 'points', last: first(-31), notes: '139 points.' }),
        ex({ homeId: amersfoort.id, tenancyId: lucas.id, duty: 'information', last: first(-30), handedOverAt: first(-30), handedOverTo: lucas.id }),
        ex({ homeId: amersfoort.id, tenancyId: lucas.id, duty: 'alarms', last: first(-30) }),
      ];

      // Rent: every month in, except this month's in Utrecht, so the ledger has something to show.
      const rentpayments = [];
      for (const [t, until] of [[yara, BW.addPeriod(first(0), 'month', -1).slice(0, 7)], [lucas, lucas.endedAt.slice(0, 7)]]) {
        R.rentDue(t, until).forEach((m, i) => rentpayments.push(ex({ tenancyId: t.id, month: m.month, date: BW.addDays(m.due, i % 4 === 3 ? 2 : 0), amount: m.amount })));
      }

      // The check-in and check-out of Amersfoort: the kitchen got worse, the rest is as it was.
      const rooms = (list) => list.map(([room, condition, notes]) => ({ room, condition, notes, photos: [] }));
      const reports = [
        ex({ homeId: amersfoort.id, tenancyId: lucas.id, kind: 'in', date: lucas.start, meters: 'Electricity 41,220; gas 9,870; water 1,204', keys: '3 front door, 1 storage room',
          rooms: rooms([['Hallway', 'good', 'Freshly painted.'], ['Living room', 'good', 'Oak floor, with a small scratch by the window on the left.'], ['Kitchen', 'good', 'Worktop as new. Oven and hob clean.'],
            ['Bedroom 1', 'good', ''], ['Bathroom', 'fair', 'Grout by the shower discoloured.'], ['Toilet', 'good', '']]) }),
        ex({ homeId: amersfoort.id, tenancyId: lucas.id, kind: 'out', date: lucas.endedAt, meters: 'Electricity 46,035; gas 11,912; water 1,388', keys: '3 front door, 1 storage room: all back',
          rooms: rooms([['Hallway', 'good', ''], ['Living room', 'good', 'Same scratch by the window; nothing new.'], ['Kitchen', 'fair', 'Burn mark on the worktop, about 5 cm, left of the hob.'],
            ['Bedroom 1', 'good', 'Picture hooks removed and filled.'], ['Bathroom', 'fair', 'As at the start.'], ['Toilet', 'good', '']]) }),
      ];

      // The demo's own words in the visitor's language (the word lists hold them), before the letters are filled.
      const tr = (v) => (typeof v === 'string' && BW.t ? BW.t(v) : v);
      const WORDS = ['name', 'notes', 'note', 'keys', 'meters', 'suppliers', 'insurance', 'what', 'deductions', 'depositHeld', 'by'];
      for (const r of [...homes, ...tenancies, ...checks, ...reports]) {
        for (const k of WORDS) if (r[k]) r[k] = tr(r[k]);
        if (r.rooms) r.rooms = r.rooms.map((x) => Object.assign(x, { room: tr(x.room), notes: tr(x.notes) }));
      }

      // Letters: the welcome Yara and Daan got, and the deposit letter for Lucas, still a draft.
      const welcome = R.fillLetter('welcome', 'nl', { s: this.settings, home: utrecht, t: yara, today: first(-14) });
      const deposit = R.fillLetter('deposit', 'nl', { s: this.settings, home: amersfoort, t: lucas, today });
      const rentletters = [
        ex({ template: 'welcome', tenancyId: yara.id, to: yara.tenants, title: welcome.title, body: welcome.body, lang: welcome.lang, sentAt: first(-14) }),
        ex({ template: 'deposit', tenancyId: lucas.id, to: lucas.tenants, title: deposit.title, body: deposit.body, lang: deposit.lang }),
      ];

      // This year's costs, so the tax year has numbers (the Netherlands: the calendar year).
      const year = today.slice(0, 4), inYear = (d) => (d.slice(0, 4) === year ? d : `${year}-01-${d.slice(8, 10)}`);
      const rentcosts = [
        ex({ homeId: utrecht.id, date: inYear(month(-9)), what: 'Owners’ association, first half', kind: 'service', amount: 390 }),
        ex({ homeId: utrecht.id, date: inYear(month(-3)), what: 'Owners’ association, second half', kind: 'service', amount: 390 }),
        ex({ homeId: utrecht.id, date: inYear(month(-7)), what: 'Landlord contents insurance', kind: 'insurance', amount: 96 }),
        ex({ homeId: utrecht.id, date: inYear(day(-40)), what: 'New boiler valve', kind: 'repairs', amount: 145, note: 'Example Loodgieters. Receipt in the folder.' }),
        ex({ homeId: amersfoort.id, date: inYear(month(-8)), what: 'Property tax (owner’s part)', kind: 'utilities', amount: 412 }),
        ex({ homeId: amersfoort.id, date: inYear(month(-6)), what: 'Building insurance', kind: 'insurance', amount: 228 }),
        ex({ homeId: amersfoort.id, date: inYear(day(-12)), what: 'Notary: the inheritance papers', kind: 'legal', amount: 350 }),
      ];

      for (const r of rentcosts) for (const k of ['what', 'note']) if (r[k]) r[k] = tr(r[k]);
      const put = [['homes', homes], ['tenancies', tenancies], ['checks', checks], ['rentpayments', rentpayments], ['reports', reports], ['rentletters', rentletters], ['rentcosts', rentcosts]];
      for (const [name, list] of put) if (list.length) await BW.store.putMany(name, list);
    },
  };
})();
