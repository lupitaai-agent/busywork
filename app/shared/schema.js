/* The shape of a Busywork business: every collection, who writes it, and its fields.
   This is the contract for anything else that reads or writes a business folder: a sync service, a
   phone app, an importer, a future version of Busywork. DATA.md explains it in words; the tests
   check the example business against it and check that every collection the apps use is listed.

   Rules every writer keeps:
   - A record is a plain JSON object with a string `id`; the store adds `createdAt` and `updatedAt`.
   - Keep fields you don't know. Change a record by changing its fields, never by rebuilding it, so
     a newer version's additions survive an older version's save.
   - Field types are loose on purpose: a number typed into a form may arrive as text ("12.50").
     Read numbers with BW.num(). Dates are YYYY-MM-DD, months YYYY-MM, times ISO 8601.
   - Changing what a field means, or renaming one, needs a data version step (core.js, MIGRATIONS).

   Types: id, ref:<collection>, text, num, bool, date, month, time, list, object. */
(function () {
  'use strict';
  const BW = (window.BW = window.BW || {});
  const R = 'records', O = 'object';
  const party = { name: 'text', contact: 'text', email: 'text', address: 'text', postcode: 'text', city: 'text', country: 'text', vat: 'text' };

  const COLLECTIONS = {
    meta: { app: 'core', shape: O, about: 'Which data version this business is in, and which Busywork saved it last.',
      fields: { dataVersion: 'num', savedBy: 'text', createdAt: 'time', updatedAt: 'time', restoredAt: 'time' } },
    settings: { app: 'core', shape: O, about: 'The business details on every document, and app preferences.',
      fields: { businessName: 'text', ownerName: 'text', email: 'text', phone: 'text', website: 'text', address: 'text', postcode: 'text', city: 'text', country: 'text',
        vatNumber: 'text', regNumber: 'text', iban: 'text', bic: 'text', currency: 'text', vatRates: 'text', paymentDays: 'num', quoteDays: 'num', docLang: 'text',
        brandColor: 'text', logo: 'text', logoW: 'num', logoH: 'num', hourlyRate: 'num', timeRound: 'num', taxReserve: 'num', kmRate: 'num',
        sigTitle: 'text', sigStyle: 'text', sigLogoUrl: 'text', instagram: 'text', linkedin: 'text' } },
    clients: { app: 'clients', shape: R, about: 'The Client Book: who you work for and how they found you.',
      fields: Object.assign({}, party, { phone: 'text', lang: 'text', paymentDays: 'num', rate: 'num', notes: 'text', source: 'text' }) },
    invoices: { app: 'invoices', shape: R, about: 'Invoices, quotes (kind quote) and credit notes (kind credit).',
      fields: { kind: 'text', number: 'text', status: 'text', currency: 'text', lang: 'text', clientId: 'ref:clients', client: 'object',
        issueDate: 'date', dueDate: 'date', validUntil: 'date', sentAt: 'date', paidAt: 'date', items: 'list', discount: 'num', reverseCharge: 'bool', notes: 'text',
        payments: 'list', reminders: 'list', repeat: 'object', payLink: 'text', creditFor: 'ref:invoices', creditForNumber: 'text', invoiceId: 'ref:invoices' } },
    catalog: { app: 'invoices', shape: R, about: 'Saved invoice lines you use often.', fields: { name: 'text', price: 'num', vat: 'num' } },
    time: { app: 'time', shape: R, about: 'Time entries; billed ones point at their invoice.',
      fields: { date: 'date', clientId: 'ref:clients', desc: 'text', dur: 'text', rate: 'num', billable: 'bool', invoiceId: 'ref:invoices' } },
    expenses: { app: 'expenses', shape: R, about: 'Costs, with the receipt kept as a file in receipts/.',
      fields: { date: 'date', vendor: 'text', amount: 'num', vatRate: 'num', category: 'text', paidBy: 'text', clientId: 'ref:clients', notes: 'text', receipt: 'text', invoiceId: 'ref:invoices', items: 'list' } },
    subscriptions: { app: 'subscriptions', shape: R, about: 'Things you pay for every month or year.',
      fields: { name: 'text', amount: 'num', cycle: 'text', nextDate: 'date', category: 'text', status: 'text', vatRate: 'num', url: 'text', notes: 'text' } },
    trips: { app: 'trips', shape: R, about: 'Business trips for the mileage allowance.',
      fields: { date: 'date', from: 'text', to: 'text', km: 'num', roundTrip: 'num', purpose: 'text', clientId: 'ref:clients' } },
    stock: { app: 'stock', shape: R, about: 'Things you sell or use, with how many are left.',
      fields: { name: 'text', emoji: 'text', sku: 'text', qty: 'num', min: 'num', cost: 'num', price: 'num', category: 'text', location: 'text', notes: 'text' } },
    stockmoves: { app: 'stock', shape: R, about: 'Every change to a stock count, newest last.',
      fields: { itemId: 'ref:stock', date: 'time', change: 'num', reason: 'text', after: 'num' } },
    projects: { app: 'projects', shape: R, about: 'Projects, shared by the Project Planner, the Project Board and Olaf.',
      fields: { name: 'text', emoji: 'text', color: 'text', clientId: 'ref:clients', notes: 'text', goal: 'text', doneMeans: 'text', start: 'date', due: 'date',
        budgetHours: 'num', ownerId: 'ref:people', status: 'text', health: 'text', template: 'text', source: 'text' } },
    tasks: { app: 'projects', shape: R, about: 'Tasks: cards on the Project Board, bars on the Planner timeline.',
      fields: { title: 'text', status: 'text', projectId: 'ref:projects', order: 'num', start: 'date', due: 'date', doneAt: 'date', hot: 'bool', notes: 'text', checklist: 'list',
        milestoneId: 'ref:milestones', assigneeId: 'ref:people', hours: 'num', after: 'list', link: 'text', source: 'text', sync: 'object' } },
    milestones: { app: 'projects', shape: R, about: 'The promises of a project: a title and a date.',
      fields: { projectId: 'ref:projects', title: 'text', due: 'date', done: 'bool', order: 'num' } },
    people: { app: 'projects', shape: R, about: 'The team: who can be given a task, and their hours a week for projects.',
      fields: { name: 'text', role: 'text', email: 'text', hours: 'num', color: 'text' } },
    projectlog: { app: 'projects', shape: R, about: 'Per project: risks, decisions and weekly updates.',
      fields: { projectId: 'ref:projects', kind: 'text', date: 'date', title: 'text', text: 'text', likelihood: 'num', impact: 'num', next: 'text', owner: 'text', state: 'text', health: 'text', by: 'text' } },
    documents: { app: 'docs', shape: R, about: 'Letters and agreements made from a template.',
      fields: { templateId: 'text', clientId: 'ref:clients', title: 'text', body: 'text', legal: 'bool' } },
    doctemplates: { app: 'docs', shape: R, about: 'Templates the owner saved.', fields: { name: 'text', title: 'text', body: 'text' } },
    mktprofile: { app: 'marketing', shape: R, about: 'One record (id brand): the brand profile every marketing skill reads.',
      fields: { onboarded: 'bool', category: 'text', offer: 'text', price: 'text', area: 'text', market: 'text', cycle: 'text', buyers: 'text', words: 'text',
        ceps: 'list', assets: 'list', tone: 'list', useWords: 'text', avoidWords: 'text', proof: 'text', barriers: 'list', barrierNotes: 'text', competitors: 'list',
        channels: 'list', budget: 'text', hours: 'text', goals: 'text', learnings: 'list', changelog: 'list', skillNotes: 'object' } },
    mktplan: { app: 'marketing', shape: R, about: 'The marketing year plan: one action per record. Olaf reads and writes it too.',
      fields: { month: 'month', title: 'text', channel: 'text', cost: 'num', cep: 'text', status: 'text', reach: 'text', notes: 'text', by: 'text', fromAI: 'bool', taskId: 'ref:tasks' } },
    mktwaves: { app: 'marketing', shape: R, about: 'Brand survey rounds: which buying situations people link to you.',
      fields: { date: 'date', n: 'num', ceps: 'list', rows: 'list' } },
    mktruns: { app: 'marketing', shape: R, about: 'Skill results the owner saved.', fields: { skillId: 'text', title: 'text', model: 'text', cost: 'num', text: 'text' } },
    mktnumbers: { app: 'marketing', shape: R, about: 'Marketing numbers per month, typed in or imported. Keys are listed in mkt-insights.js (METRICS).',
      fields: { month: 'month', note: 'text', by: 'text', gbpViews: 'num', gbpCalls: 'num', gbpDirections: 'num', gbpClicks: 'num', reviews: 'num', rating: 'num',
        visits: 'num', searchClicks: 'num', followers: 'num', reach: 'num', subscribers: 'num', openRate: 'num', enquiries: 'num', spend: 'num' } },
    mktcontent: { app: 'marketing', shape: R, about: 'The content calendar: one post per record.',
      fields: { date: 'date', channel: 'text', title: 'text', cep: 'text', text: 'text', status: 'text', by: 'text', taskId: 'ref:tasks' } },
    mktsettings: { app: 'marketing', shape: R, about: 'One record (id settings): marketing goals.', fields: { goalNew: 'num' } },
    licences: { app: 'core', shape: R, about: 'Signed licences for paid parts (Olaf), checked offline. Every computer that opens the business is licensed.',
      fields: { product: 'text', licenceId: 'text', key: 'text', licensee: 'text' } },
    'olaf-files': { app: 'olaf', shape: R, about: "Olaf's workspace: one markdown file per record, by path.", fields: { path: 'text', content: 'text', status: 'text' } },
    'olaf-sessions': { app: 'olaf', shape: R, about: 'Conversations with Olaf, kept exactly as sent so they can continue.',
      fields: { skillId: 'text', title: 'text', finished: 'bool', cost: 'num', model: 'text', files: 'list', system: 'list', messages: 'list', view: 'list' } },
    'olaf-setup': { app: 'olaf', shape: R, about: "One record (id setup): which setup steps the owner skipped.", fields: { skipped: 'list' } },
  };
  // Fields the store itself manages, and the example flag the example business carries.
  const COMMON = { id: 'id', createdAt: 'time', updatedAt: 'time', example: 'bool' };

  const isNum = (v) => typeof v === 'number' ? isFinite(v) : typeof v === 'string' && (v.trim() === '' || !isNaN(Number(v.replace(',', '.'))));
  const TYPES = {
    id: (v) => typeof v === 'string' && v.length > 0, text: (v) => typeof v === 'string', num: isNum, bool: (v) => typeof v === 'boolean',
    date: (v) => v === '' || /^\d{4}-\d\d-\d\d/.test(v), month: (v) => v === '' || /^\d{4}-\d\d/.test(v), time: (v) => typeof v === 'string' && !isNaN(Date.parse(v)),
    list: Array.isArray, object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  };

  BW.schema = {
    COLLECTIONS, COMMON,
    // Problems with one record, as readable lines; an empty list means it fits. Unknown fields are fine.
    check(name, rec) {
      const c = COLLECTIONS[name];
      if (!c) return [`${name} is not a known collection`];
      const out = [];
      if (c.shape === R && !TYPES.id(rec && rec.id)) out.push(`${name}: a record without an id`);
      const fields = Object.assign({}, c.shape === R ? COMMON : {}, c.fields);
      for (const [k, t] of Object.entries(fields)) {
        if (rec[k] == null) continue;
        const type = t.startsWith('ref:') ? 'text' : t;
        if (!TYPES[type](rec[k])) out.push(`${name}.${k} should be ${t}, is ${JSON.stringify(rec[k]).slice(0, 40)}`);
      }
      return out;
    },
  };
})();
