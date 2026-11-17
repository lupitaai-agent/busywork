/* The household: everyone at home, people and pets, any number of them, and who looks after what. A member
   is given a colour; contracts, documents, upkeep jobs and letters carry the name of the one who looks after
   them. "This is me" is remembered on this computer only, so each person sees their own things first. */
(function () {
  'use strict';
  const { $, $$, esc, ui } = BW;
  const H = BW.house;
  const main = $('#main');
  let members = [], lists = {};

  BW.boot({ part: 'people', onReady: render, onChange: render });

  const KINDS = { contracts: ['🔁', 'contracts', (c) => c.name || c.provider || 'A contract'], upkeep: ['🛠️', 'upkeep', (j) => j.task || 'A job'], papers: ['🗂️', 'papers', (p) => p.title || 'A document'] };
  const link = (a) => `<a class="line" href="apps/${KINDS[a.kind][1]}/index.html#open/${a.item.id}"><span>${KINDS[a.kind][0]} ${esc(KINDS[a.kind][2](a.item))}</span><b></b></a>`;

  async function load() {
    const today = BW.today();
    const [m, contracts, upkeep, papers] = await Promise.all(['members', 'contracts', 'upkeep', 'papers'].map((n) => BW.store.all(n).catch(() => [])));
    members = m;
    lists = { contracts: contracts.filter((c) => H.contractState(c, today) !== 'ended'), upkeep, papers: H.visiblePapers(papers, H.myself()).filter((p) => !p.replaced && (p.expires || p.reviewAt)) };
    // The first time: start from what the household typed when it set Busy up.
    // Once only: when the members collection has never been made. A household that removes everyone keeps an
    // empty one and is not given them back; and nothing an older version wrote (the settings) is touched.
    if (!members.length && !(await BW.store.collections().catch(() => [])).includes('members')) {
      const seed = H.seedMembers(BW.settings.ownerName, BW.settings.household);
      if (seed.length) { try { await BW.store.putMany('members', seed); members = await BW.store.all('members'); } catch (e) { /* shown empty, nothing lost */ } }
    }
  }

  async function render() {
    await load();
    const today = BW.today(), me = H.myself();
    const people = H.people(members), pets = H.pets(members), l = H.loads(members, lists);
    const card = (m) => {
      const mine = l.rows.find((r) => r.member.id === m.id), n = mine ? mine.items.length : 0;
      return `<section class="card member" style="--who:var(--${esc(m.colour || 'hair')})">
        <button type="button" class="member-head" data-edit="${m.id}"><span class="dot" aria-hidden="true"></span><b>${esc(m.name)}</b>${m.id === me ? `<span class="chip chip-sun">${BW.t('This is me')}</span>` : ''}</button>
        <p class="s">${esc(m.role || '')}${m.role ? ' · ' : ''}${n} ${BW.t(n === 1 ? 'thing to look after' : 'things to look after')}</p>
        ${mine && n ? mine.items.slice(0, 5).map(link).join('') + (n > 5 ? `<p class="s">${BW.t(`and ${n - 5} more`)}</p>` : '') : ''}
        <div class="member-acts">${m.id === me ? '' : `<button type="button" class="btn btn-ghost" data-me="${m.id}">${BW.t('This is me')}</button>`}${n && people.length > 1 ? `<button type="button" class="btn btn-ghost" data-hand="${m.id}">${BW.t('Hand over')}</button>` : ''}</div>
      </section>`;
    };
    const pet = (m) => {
      const due = H.petDue(m, today)[0];
      return `<section class="card member" style="--who:var(--${esc(m.colour || 'hair')})">
        <button type="button" class="member-head" data-edit="${m.id}"><span aria-hidden="true">${H.species(m.species)[1]}</span><b>${esc(m.name)}</b></button>
        <p class="s">${esc([BW.t(H.species(m.species)[2]), m.vet && `${BW.t('Vet')}: ${m.vet}`].filter(Boolean).join(' · '))}</p>
        ${due ? ui.line(`💉 ${esc(due.what)}`, H.when(due.left)) : `<p class="s">${BW.t('Add a vaccination and Busy says when the next one is due.')}</p>`}
        <div class="member-acts"><button type="button" class="btn btn-ghost" data-booklet="${m.id}">📄 ${BW.t('Sitter’s booklet')}</button><button type="button" class="btn btn-ghost" data-travel="${m.id}">✈️ ${BW.t('Travelling')}</button></div>
      </section>`;
    };
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('The household')}</p><h1 class="big">${BW.t(people.length > 1 ? 'Everyone at home, and who looks after what.' : 'Who lives here?')}</h1></div>
        <div class="start-row"><button type="button" class="btn" data-new="person">🧑 ${BW.t('Add a person')}</button><button type="button" class="btn" data-new="pet">🐾 ${BW.t('Add a pet')}</button><a class="btn" href="apps/costs/index.html">🧮 ${BW.t('Shared Costs')}</a></div></div>
      ${members.length ? '' : `<section class="card"><h2>${BW.t('Start with yourself.')}</h2><p class="s">${BW.t('Then add everyone who shares the household: a partner, children, a grandparent, housemates. Each gets a colour, and every contract and job can carry the name of the one who looks after it.')}</p></section>`}
      <div class="members">${people.map(card).join('')}${pets.map(pet).join('')}</div>
      ${l.nobody.length && people.length > 1 ? `<section class="card">${ui.k(BW.t('Nobody looks after these yet'))}${l.nobody.slice(0, 8).map(link).join('')}${l.nobody.length > 8 ? `<p class="s">${BW.t(`and ${l.nobody.length - 8} more`)}</p>` : ''}<p class="s">${BW.t('Open one and pick a name.')}</p></section>` : ''}
      ${people.length > 1 ? `<section class="card">${ui.k(BW.t('How it works with more people'))}<p class="s">${BW.t('Keep the home folder in a shared cloud folder and everyone opens it on their own computer. “This is me” is remembered on each computer, so each person sees their own things first.')}</p></section>` : ''}
    </div>`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ kind: b.dataset.new, colour: H.MEMBER_COLOURS[members.length % H.MEMBER_COLOURS.length] }));
    $$('[data-edit]', main).forEach((b) => b.onclick = () => edit(H.member(members, b.dataset.edit)));
    $$('[data-me]', main).forEach((b) => b.onclick = () => { H.setMyself(b.dataset.me); render(); });
    $$('[data-hand]', main).forEach((b) => b.onclick = () => handOver(H.member(members, b.dataset.hand)));
    $$('[data-booklet]', main).forEach((b) => b.onclick = async () => { const p = H.member(members, b.dataset.booklet); try { await H.savePdf('Home', `${p.name} ${BW.t('sitter’s booklet')}`, H.pdf(p.name, H.sitterLines(p, BW.settings, BW.today()), { footer: BW.t('Made with Busy Home') })); } catch (e) { BW.error(e); } });
    $$('[data-travel]', main).forEach((b) => b.onclick = () => { const p = H.member(members, b.dataset.travel); BW.modal({ title: `✈️ ${esc(p.name)}`, wide: true, body: BW.html(`<div><p>${BW.t('Travelling in the EU with a dog, cat or ferret:')}</p><div class="check-list">${H.PET_TRAVEL.map((x) => `<label class="check-item"><input type="checkbox"><span class="main">${esc(BW.t(x))}</span></label>`).join('')}</div><p class="s" style="margin-top:10px"><a href="${H.PET_TRAVEL_LINK}" target="_blank" rel="noopener">${BW.t('The EU’s own page')} ↗</a> · ${BW.t('Outside the EU the rules differ: ask the vet in good time.')}</p></div>`), actions: [{ label: 'Close', kind: 'primary' }] }); });
  }

  const COLOURS = () => H.MEMBER_COLOURS.map((c) => [c, BW.t({ tomato: 'Red', sky: 'Blue', mint: 'Green', grape: 'Purple', sun: 'Yellow', pink: 'Pink', teal: 'Teal' }[c])]);
  function edit(m) {
    const isPet = m.kind === 'pet';
    BW.recordDrawer({
      collection: 'members', rec: Object.assign({ kind: 'person', care: [] }, m), title: isPet ? 'A pet' : 'A member of the household', newTitle: isPet ? 'Add a pet' : 'Add a person',
      fields: isPet ? [
        { k: 'name', label: 'Name', ph: 'e.g. Biscuit', required: true },
        { k: 'species', label: 'What is it?', type: 'chips', options: H.SPECIES.map((s) => [s[0], `${s[1]} ${s[2]}`]) },
        { k: 'born', label: 'Born on', type: 'date' },
        { k: 'chip', label: 'Chip number', ph: '15 digits' },
        { k: 'chipRegister', label: 'Registered with', ph: 'The chip register' },
        { k: 'passport', label: 'Passport number' },
        { k: 'vet', label: 'Vet', ph: 'The practice’s name' },
        { k: 'vetPhone', label: 'Vet’s phone' },
        { k: 'food', label: 'Food', type: 'textarea', ph: 'What, how much, when', span: 2 },
        { k: 'medicines', label: 'Medicines', type: 'textarea', ph: 'What, how much, when. As the vet prescribed.', span: 2 },
        { k: 'routines', label: 'Routines', type: 'textarea', ph: 'Walks, where it sleeps, what it is afraid of', span: 2 },
        { k: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ] : [
        { k: 'name', label: 'Name', ph: 'e.g. Noor', required: true },
        { k: 'role', label: 'Who is this?', ph: 'e.g. partner, daughter, grandfather, housemate' },
        { k: 'colour', label: 'Colour', type: 'chips', options: COLOURS() },
        { k: 'share', label: 'Share of shared costs', ph: 'e.g. 60', hint: 'Only for splitting by income: a weight such as 60 and 40. Busy never asks what anyone earns.' },
        { k: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ],
      isComplete: (r) => !!String(r.name || '').trim(),
      bottom: (r) => (isPet && r.id ? `<h3 style="margin:18px 0 8px">💉 ${BW.t('Vaccinations and checks')}</h3><div data-care></div><button type="button" class="btn" data-care-add style="margin-top:8px">+ ${BW.t('Add one')}</button>` : ''),
      // The drawer hands over (box, record, save). The list of vaccinations redraws itself here.
      bind: (box, r) => {
        const list = $('[data-care]', box), add = $('[data-care-add]', box);
        if (!list) return;
        const draw = () => {
          list.innerHTML = `<div class="list">${(r.care || []).map((c, i) => `<div class="file-row"><span>💉</span><span class="main">${esc(c.what || '')}${c.last ? ' · ' + BW.fmtDate(c.last) : ''}</span><button type="button" class="btn btn-ghost" data-care-del="${i}" aria-label="Remove">✕</button></div>`).join('')}</div>`;
          $$('[data-care-del]', list).forEach((b) => b.onclick = async () => { r.care = (r.care || []).filter((_, i) => i !== Number(b.dataset.careDel)); try { await BW.store.put('members', r); } catch (e) { BW.error(e); } draw(); });
        };
        draw();
        add.onclick = () => careModal(r, draw);
      },
      confirmDelete: 'Remove from the household? What they looked after stays, with nobody’s name on it.',
      // Someone in the shared costs stays: without them every split and balance would change.
      canDelete: async (r) => {
        if (r.kind === 'pet') return true;
        const [costs, settlements] = await Promise.all(['costs', 'settlements'].map((n) => BW.store.all(n).catch(() => [])));
        if (!H.memberInCosts(r.id, costs, settlements)) return true;
        BW.modal({ title: esc(r.name || ''), body: `<p>${BW.t(`${esc(r.name || '')} is in the shared costs, so the name stays. Hand over what they look after instead.`)}</p>`, actions: [{ label: 'Close', kind: 'primary' }] });
        return false;
      },
      onClose: async (r) => { if (r && r.deleted) { try { await H.forgetMember(r.id); } catch (e) { BW.error(e); } } render(); },
    });
  }
  function careModal(pet, redraw) {
    const box = BW.html(`<div class="grid-2">
      <label class="field span-2"><span>${BW.t('What')}</span><input class="in" data-w placeholder="${BW.t('e.g. Rabies vaccination, yearly check-up')}"></label>
      <label class="field"><span>${BW.t('Last done on')}</span><input class="in" type="date" data-l value="${BW.today()}"></label>
      <label class="field"><span>${BW.t('Again after (months)')}</span><input class="in" inputmode="numeric" data-e value="12"></label></div>`);
    BW.modal({ title: `💉 ${esc(pet.name || '')}`, body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Add', kind: 'primary', onClick: async () => {
      const what = $('[data-w]', box).value.trim(); if (!what) return false;
      pet.care = (pet.care || []).concat([{ what, last: $('[data-l]', box).value, every: BW.num($('[data-e]', box).value) || 12 }]);
      try { await BW.store.put('members', pet); } catch (e) { BW.error(e); return false; }
      if (redraw) redraw();
    } }] });
  }

  // Everything one person looks after moves to another: before a long trip, a hospital stay, or for good.
  function handOver(from) {
    const others = H.people(members).filter((m) => m.id !== from.id);
    const box = BW.html(`<div><p style="margin-bottom:12px">${BW.t('Everything with this name on it gets the other name. You can hand it back the same way.')}</p>
      <div class="check-list">${others.map((m, i) => `<label class="check-item"><input type="radio" name="to" value="${m.id}" ${i ? '' : 'checked'}><span class="main"><b>${esc(m.name)}</b></span></label>`).join('')}</div></div>`);
    BW.modal({ title: `${BW.t('Hand over from')} ${esc(from.name)}`, body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Hand over', kind: 'primary', onClick: async () => {
      const to = ($('input[name=to]:checked', box) || {}).value; if (!to) return false;
      try {
        for (const name of ['contracts', 'upkeep', 'papers', 'letters']) {
          const mine = (await BW.store.all(name)).filter((x) => x.who === from.id);
          if (mine.length) await BW.store.putMany(name, mine.map((x) => Object.assign({}, x, { who: to })));
        }
      } catch (e) { BW.error(e); return false; }
      BW.toast(`${esc(H.whoName(members, to))} ${BW.t('looks after it now.')}`, '🤝');
      render();
    } }] });
  }
})();
