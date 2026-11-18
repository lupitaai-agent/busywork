/* The shape of a Busy business: every collection, who writes it, and its fields.
   This is the contract for anything else that reads or writes a business folder: a sync service, a
   phone app, an importer, a future version of Busy. DATA.md explains it in words; the tests
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
    meta: { app: 'core', shape: O, about: 'Which data version this business is in, and which Busy saved it last.',
      fields: { dataVersion: 'num', savedBy: 'text', createdAt: 'time', updatedAt: 'time', restoredAt: 'time' } },
    settings: { app: 'core', shape: O, about: 'The business details on every document, and app preferences.',
      fields: { businessName: 'text', ownerName: 'text', email: 'text', phone: 'text', website: 'text', address: 'text', postcode: 'text', city: 'text', country: 'text',
        vatNumber: 'text', regNumber: 'text', iban: 'text', bic: 'text', currency: 'text', vatRates: 'text', paymentDays: 'num', quoteDays: 'num', docLang: 'text',
        brandColor: 'text', logo: 'text', logoW: 'num', logoH: 'num', hourlyRate: 'num', timeRound: 'num', taxReserve: 'num', kmRate: 'num',
        sigTitle: 'text', sigStyle: 'text', sigLogoUrl: 'text', instagram: 'text', linkedin: 'text',
        suite: 'text', household: 'text', headline: 'text', targetRole: 'text', goal: 'text', learnHoursWeek: 'num', moment: 'text', momentDate: 'date', about: 'text', languages: 'text', linkedinImportedAt: 'date', taxCountry: 'text', taxTicks: 'object', mtd: 'text',
        kitchenHousehold: 'object', kitchenGear: 'object' } },
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
    licences: { app: 'core', shape: R, about: 'Signed licences for paid parts (Olaf, Ivy), checked offline. Every computer that opens the folder is licensed.',
      fields: { product: 'text', licenceId: 'text', key: 'text', licensee: 'text' } },
    'olaf-files': { app: 'olaf', shape: R, about: "Olaf's workspace: one markdown file per record, by path.", fields: { path: 'text', content: 'text', status: 'text' } },
    'olaf-sessions': { app: 'olaf', shape: R, about: 'Conversations with Olaf, kept exactly as sent so they can continue.',
      fields: { skillId: 'text', title: 'text', finished: 'bool', cost: 'num', model: 'text', files: 'list', system: 'list', messages: 'list', view: 'list' } },
    'ivy-files': { app: 'ivy', shape: R, about: "Ivy's own files: profile.md, notes.md and output/, one markdown file per record, by path.", fields: { path: 'text', content: 'text' } },
    'ivy-sessions': { app: 'ivy', shape: R, about: 'Conversations with Ivy, kept exactly as sent so they can continue.',
      fields: { skillId: 'text', title: 'text', system: 'list', messages: 'list', view: 'list', cost: 'num', changes: 'list', finished: 'bool', model: 'text' } },
    'olaf-setup': { app: 'olaf', shape: R, about: "One record (id setup): which setup steps the owner skipped.", fields: { skipped: 'list' } },
    // Busy Growth (a growth folder): the person's own knowledge base, learning, skills and wins.
    library: { app: 'library', shape: R, about: 'The Library: links, notes and files (kept in library/), tagged by topic and skill.',
      fields: { kind: 'text', title: 'text', url: 'text', path: 'text', fileName: 'text', size: 'num', notes: 'text', highlights: 'text', text: 'text',
        tags: 'text', skillIds: 'list', status: 'text', addedAt: 'date', readAt: 'date', textTried: 'bool' } },
    learning: { app: 'learning', shape: R, about: 'Things to learn: courses, books, videos and projects, with the hours spent on each.',
      fields: { title: 'text', kind: 'text', provider: 'text', url: 'text', skillIds: 'list', start: 'date', due: 'date', hoursPlanned: 'num',
        status: 'text', doneAt: 'date', notes: 'text', sessions: 'list' } },
    skills: { app: 'skills', shape: R, about: 'The Skills Map: each skill with its level and target (1 to 5).',
      fields: { name: 'text', category: 'text', level: 'num', target: 'num', notes: 'text' } },
    wins: { app: 'wins', shape: R, about: 'The Wins Log: achievements with the result, the proof and the skills they show.',
      fields: { date: 'date', title: 'text', what: 'text', result: 'text', proof: 'text', skillIds: 'list', tags: 'text' } },
    applications: { app: 'jobs', shape: R, about: 'The Job Tracker: one application per record, from saved to offer.',
      fields: { company: 'text', role: 'text', url: 'text', location: 'text', salary: 'text', source: 'text', contact: 'text', status: 'text', savedAt: 'date', appliedAt: 'date',
        nextDate: 'date', nextStep: 'text', closedAt: 'date', reachedInterview: 'bool', heardBack: 'bool', adText: 'text', notes: 'text', letter: 'text',
        cvId: 'ref:cvs', contactId: 'ref:contacts', interest: 'num', storyIds: 'list', history: 'list' } },
    career: { app: 'cv', shape: R, about: 'Career history, shared by every CV version: jobs, education, projects, volunteering.',
      fields: { type: 'text', title: 'text', org: 'text', place: 'text', start: 'month', end: 'month', current: 'bool', bullets: 'text' } },
    cvs: { app: 'cv', shape: R, about: 'CV versions: which career entries, skills and wins each one shows.',
      fields: { name: 'text', headline: 'text', summary: 'text', include: 'list', skillIds: 'list', winIds: 'list', extras: 'text' } },
    stories: { app: 'stories', shape: R, about: 'Interview stories in the STAR shape, often grown from a win.',
      fields: { title: 'text', situation: 'text', task: 'text', action: 'text', result: 'text', skillIds: 'list', winId: 'ref:wins', tags: 'text', practised: 'num', lastPractised: 'date' } },
    contacts: { app: 'contacts', shape: R, about: 'Contacts: the people in your network, when you last talked and when to catch up.',
      fields: { name: 'text', how: 'text', role: 'text', org: 'text', email: 'text', phone: 'text', linkedin: 'text', every: 'num', nextDate: 'date',
        lastContact: 'date', tags: 'text', notes: 'text', log: 'list' } },
    reviews: { app: 'review', shape: R, about: 'Weekly reviews: one per week, with that week’s numbers and the plan for the next.',
      fields: { week: 'date', went: 'text', hard: 'text', energy: 'num', next: 'text', nextDone: 'list', focusSkillId: 'ref:skills',
        minutes: 'num', finished: 'num', wins: 'num', applied: 'num', read: 'num' } },
    // Busy Home (a home folder): the household's paperwork.
    papers: { app: 'papers', shape: R, about: 'Paper Trail: important documents, with their scans in Papers/ and the date they expire.',
      fields: { title: 'text', kind: 'text', person: 'text', reference: 'text', issued: 'date', expires: 'date', reviewAt: 'date', files: 'list', text: 'text',
        where: 'text', tags: 'text', notes: 'text', replaced: 'text', who: 'ref:members', taxYear: 'text', private: 'text' } },
    contracts: { app: 'contracts', shape: R, about: 'Contracts & Renewals: what the household pays for, when it renews and the notice to cancel.',
      fields: { name: 'text', kind: 'text', provider: 'text', reference: 'text', cost: 'num', per: 'text', start: 'date', end: 'date', renews: 'text', renewMonths: 'num',
        notice: 'num', noticeUnit: 'text', cancelledAt: 'date', keptFor: 'date', paperId: 'ref:papers', address: 'text', website: 'text', phone: 'text', notes: 'text', who: 'ref:members', lastCost: 'num' } },
    upkeep: { app: 'upkeep', shape: R, about: 'Home Upkeep: recurring jobs, when they were last done and the log.',
      fields: { task: 'text', area: 'text', every: 'num', last: 'date', next: 'date', who: 'text', notes: 'text', log: 'list' } },
    inventory: { app: 'inventory', shape: R, about: 'Home Inventory: what the household owns, room by room, with photos and receipts in Inventory/.',
      fields: { name: 'text', room: 'text', kind: 'text', brand: 'text', model: 'text', serial: 'text', bought: 'date', price: 'num', value: 'num', warrantyUntil: 'date',
        photos: 'list', receipt: 'text', notes: 'text' } },
    letters: { app: 'letters', shape: R, about: 'Letters the household wrote, from a template, with the addressee and the contract they are about.',
      fields: { template: 'text', title: 'text', to: 'text', toAddress: 'text', contractId: 'ref:contracts', body: 'text', sentAt: 'date', who: 'ref:members' } },
    moves: { app: 'moving', shape: R, about: 'Moving Planner: one record per move, with its checklist and who to tell.',
      fields: { date: 'date', from: 'text', to: 'text', tasks: 'list', tell: 'list', finished: 'bool', notes: 'text' } },
    binder: { app: 'binder', shape: R, about: 'Just in Case: what the family would need to know, one entry per record by section.',
      fields: { section: 'text', title: 'text', text: 'text' } },
    // Busy Rentals (a rentals folder): the homes someone lets, their tenancies, rent, checks and costs.
    homes: { app: 'homes', shape: R, about: 'Homes & Tenancies: each home that is let, with its country and the optional duties that apply to it.',
      fields: { name: 'text', address: 'text', postcode: 'text', city: 'text', country: 'text', kind: 'text', duties: 'list', keys: 'text', meters: 'text', suppliers: 'text', insurance: 'text', notes: 'text' } },
    tenancies: { app: 'homes', shape: R, about: 'A tenancy of one home: who lives there, the rent, the deposit and the dates.',
      fields: { homeId: 'ref:homes', tenants: 'text', email: 'text', phone: 'text', start: 'date', endedAt: 'date', rent: 'num', rentPer: 'text', rents: 'list', payDay: 'num', lastRentChange: 'date',
        deposit: 'num', depositReceived: 'date', depositHeld: 'text', depositRef: 'text', depositProtectedAt: 'date', deductions: 'text', depositReturnedAt: 'date', letterLang: 'text', notes: 'text' } },
    rentpayments: { app: 'rent', shape: R, about: 'Rent received: the tenancy, the month it is for, the date and the amount.',
      fields: { tenancyId: 'ref:tenancies', month: 'month', date: 'date', amount: 'num', note: 'text' } },
    checks: { app: 'homes', shape: R, about: 'A duty done for a home (a gas check, an energy label): when, the next date if booked, when the tenant got a copy.',
      fields: { homeId: 'ref:homes', tenancyId: 'ref:tenancies', duty: 'text', last: 'date', next: 'date', handedOverAt: 'date', handedOverTo: 'ref:tenancies', by: 'text', files: 'list', notes: 'text' } },
    rentletters: { app: 'rentletters', shape: R, about: 'Letters to tenants: from a template, filled with the home and the tenancy.',
      fields: { template: 'text', tenancyId: 'ref:tenancies', to: 'text', title: 'text', body: 'text', lang: 'text', sentAt: 'date' } },
    reports: { app: 'homes', shape: R, about: 'A check-in or check-out report of a home: rooms with condition, notes and photos, meters and keys.',
      fields: { homeId: 'ref:homes', tenancyId: 'ref:tenancies', kind: 'text', date: 'date', rooms: 'list', meters: 'text', keys: 'text', notes: 'text' } },
    rentcosts: { app: 'rentcosts', shape: R, about: 'Costs of a home, by kind, with the receipt.',
      fields: { homeId: 'ref:homes', date: 'date', what: 'text', kind: 'text', amount: 'num', receipt: 'text', note: 'text' } },
    // Busy Kitchen (a kitchen folder; not released: KITCHEN_LIVE): the household's own recipes, the week plan, the
    // shopping list, the pantry and the passport. The six kitchens and their dishes are built in (shared/kitchen-data.js).
    recipes: { app: 'recipes', shape: R, about: 'Recipe Box: a recipe of your own or the family\u2019s, with its story, the kitchen and country it belongs to, and a photo.',
      fields: { name: 'text', kitchen: 'text', country: 'text', from: 'text', family: 'text', serves: 'num', minutes: 'num', gear: 'text', tags: 'text', ingredients: 'text', steps: 'text', story: 'text', source: 'text', photo: 'bool', salNew: 'bool' } },
    plan: { app: 'plan', shape: R, about: 'Week plan: a dinner on a day, either one of your recipes or a dish of the six kitchens.',
      fields: { date: 'date', recipeId: 'ref:recipes', dishId: 'text', name: 'text', k: 'text', leftovers: 'bool' } },
    shopping: { app: 'plan', shape: R, about: 'Shopping list: one thing to buy, and the dinner it is for.',
      fields: { text: 'text', for: 'text', done: 'bool' } },
    pantry: { app: 'pantry', shape: R, about: 'Pantry: what is in the fridge, the freezer or the cupboard, with its use-by date; leftovers marked.',
      fields: { name: 'text', where: 'text', useBy: 'date', qty: 'text', leftover: 'text', note: 'text' } },
    cooked: { app: 'kitchens', shape: R, about: 'The kitchen passport: a stamp for a dish of the six kitchens or a recipe, on the day it was cooked.',
      fields: { dishId: 'text', recipeId: 'ref:recipes', k: 'text', name: 'text', date: 'date', how: 'text', note: 'text' } },
    members: { app: 'people', shape: R, about: 'The household: everyone in it, people and pets. A member looks after things (`who` on other records).',
      fields: { name: 'text', kind: 'text', colour: 'text', role: 'text', born: 'date', share: 'num', notes: 'text', species: 'text', chip: 'text', chipRegister: 'text',
        vet: 'text', vetPhone: 'text', passport: 'text', food: 'text', medicines: 'text', routines: 'text', care: 'list' } },
    costs: { app: 'costs', shape: R, about: 'Shared Costs: who paid what, and how it is split between the people of the household.',
      fields: { date: 'date', what: 'text', amount: 'num', paidBy: 'ref:members', split: 'text', among: 'list', shares: 'object', note: 'text' } },
    settlements: { app: 'costs', shape: R, about: 'Shared Costs: money one member handed another to make things even.',
      fields: { date: 'date', from: 'ref:members', to: 'ref:members', amount: 'num', note: 'text' } },
  };
  // Fields the store itself manages, and the example flag the example business carries.
  const COMMON = { id: 'id', createdAt: 'time', updatedAt: 'time', example: 'bool' };

  const isNum = (v) => typeof v === 'number' ? isFinite(v) : typeof v === 'string' && (v.trim() === '' || !isNaN(Number(v.replace(',', '.'))));
  const TYPES = {
    id: (v) => typeof v === 'string' && v.length > 0, text: (v) => typeof v === 'string', num: isNum, bool: (v) => typeof v === 'boolean',
    date: (v) => v === '' || /^\d{4}-\d\d-\d\d/.test(v), month: (v) => v === '' || /^\d{4}(-\d\d)?$/.test(v), time: (v) => typeof v === 'string' && !isNaN(Date.parse(v)),
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
