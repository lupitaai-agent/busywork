/* The Recipe Box: your own recipes and the family's. Each can carry its story, who it came from, the country and
   kitchen it belongs to, a photo (of the dish, or of grandmother's handwritten card), and the kitchen gear it
   needs. Cooking mode shows one step at a time, large, keeps the screen on and runs a timer for any step that names
   minutes. The family cookbook prints every family recipe as one PDF.
   #open/<id> opens a recipe, #new starts one, #paste reads a pasted recipe. Photos are files in the folder:
   Recipe photos/<id>.jpg. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const K = BW.kitchen;
  const main = $('#main');
  const KITCHEN_OPTS = [['', 'Not one of the six']].concat(K.kitchens.map((k) => [k.id, `${k.flag} ${k.name}`]));
  const GEAR_OPTS = [['', 'Any kitchen'], ['oven', 'Needs an oven'], ['hob', 'On the hob'], ['onepot', 'One pot'], ['airfryer', 'Air fryer']];
  const FIELDS = [
    { k: 'name', label: 'Name of the dish', ph: 'e.g. Oma’s apple tart', span: 2, required: true },
    { k: 'kitchen', label: 'Which kitchen', type: 'select', options: KITCHEN_OPTS },
    { k: 'country', label: 'Country or region', ph: 'e.g. Limburg, Sicily, Minas Gerais' },
    { k: 'from', label: 'Whose recipe', ph: 'e.g. Oma Ria, Dad, a neighbour' },
    { k: 'family', label: 'In the family cookbook', type: 'select', options: [['', 'No'], ['yes', 'Yes']] },
    { k: 'serves', label: 'Serves', type: 'number', ph: '4' },
    { k: 'minutes', label: 'Time (minutes)', type: 'number', ph: '45' },
    { k: 'gear', label: 'Kitchen', type: 'select', options: GEAR_OPTS },
    { k: 'tags', label: 'Tags', ph: 'e.g. Sunday, vegetarian, Christmas' },
    { k: 'ingredients', label: 'Ingredients (one per line)', type: 'textarea', span: 2, ph: '500 g floury potatoes\n1 kg curly kale\n1 smoked sausage' },
    { k: 'steps', label: 'Steps (one per line)', type: 'textarea', span: 2, ph: 'Peel the potatoes and boil them for 20 minutes.\nCook the kale for 15 minutes.' },
    { k: 'story', label: 'The story', type: 'textarea', span: 2, ph: 'Where it comes from, who made it, when it was eaten.' },
    { k: 'source', label: 'Where it was found', ph: 'A book, a web page, a card in the drawer' },
  ];
  let query = '', onlyFamily = false;

  BW.boot({ app: 'recipes', onReady: route, onChange: route });
  window.addEventListener('hashchange', route);

  async function route() {
    const h = location.hash.slice(1);
    const list = await BW.store.all('recipes').catch(() => []);
    if (h === 'new') { history.replaceState(null, '', location.pathname); edit({}); }
    if (h === 'paste') { history.replaceState(null, '', location.pathname); paste(); }
    if (h.startsWith('open/')) { const r = list.find((x) => x.id === h.slice(5)); if (r) return view(r); }
    overview(list);
  }

  function overview(list) {
    const q = K.words(query);
    const hits = list.filter((r) => (!onlyFamily || r.family === 'yes') && (!q.length || q.every((w) => K.words(`${r.name} ${r.from} ${r.country} ${r.tags} ${r.ingredients}`).some((x) => x.startsWith(w)))))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const fam = list.filter((r) => r.family === 'yes');
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('Recipe box')}</p><h1 class="big">${BW.t(list.length ? 'Your recipes, and the family’s.' : 'Start with the one everybody asks for.')}</h1></div>
        <div class="start-row"><a class="btn btn-primary" href="#new">📖 ${BW.t('A recipe')}</a><a class="btn" href="#paste">📋 ${BW.t('Paste a recipe')}</a>${fam.length ? `<button class="btn" data-book>📕 ${BW.t('Family cookbook (PDF)')}</button>` : ''}</div></div>
      ${list.length ? `<div class="have"><input class="in" data-q placeholder="${BW.t('Search your recipes')}" value="${esc(query)}" aria-label="${BW.t('Search your recipes')}"></div>
        <div class="tabs-row"><button class="btn" data-fam="0" aria-pressed="${!onlyFamily}">${BW.t('All')} · ${list.length}</button><button class="btn" data-fam="1" aria-pressed="${onlyFamily}">👪 ${BW.t('Family recipes')} · ${fam.length}</button></div>
        <section class="card">${hits.map((r) => { const k = K.kitchen(r.kitchen); return ui.line(`${k ? k.flag : '📖'} <b>${esc(r.name)}</b>${r.from ? ` <small class="muted">· ${esc(r.from)}</small>` : ''}`, r.minutes ? `${esc(r.minutes)} min` : '', `#open/${r.id}`); }).join('') || `<p class="muted">${BW.t('Nothing found.')}</p>`}</section>`
      : `<section class="card"><p>${BW.t('Add your own recipes, and the family’s: photograph grandmother’s handwritten card, write down the story and the country it came from. Tonight then matches them to what you have, and the family cookbook prints them all as one PDF, a lovely gift.')}</p></section>`}
    </div>`;
    const qi = $('[data-q]', main);
    if (qi) qi.oninput = BW.debounce((e) => { query = e.target.value; overview(list); const n = $('[data-q]', main); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200);
    BW.$$('[data-fam]', main).forEach((b) => { b.onclick = () => { onlyFamily = b.dataset.fam === '1'; overview(list); }; });
    const book = $('[data-book]', main); if (book) book.onclick = () => cookbook(fam).catch(BW.error);
  }

  const photoPath = (r) => `Recipe photos/${r.id}.jpg`;
  async function photoUrl(r) {
    if (!r.photo) return '';
    try { const b = await BW.store.readFile(photoPath(r)); return b ? URL.createObjectURL(b) : ''; } catch (e) { return ''; }
  }

  async function view(r) {
    const k = K.kitchen(r.kitchen), pic = await photoUrl(r);
    const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
    main.innerHTML = `<div class="part-page">
      <p><a href="#">← ${BW.t('Recipe box')}</a></p>
      ${pic ? `<img class="big-pic" src="${pic}" alt="" style="max-height:420px;object-fit:cover;margin-bottom:14px">` : ''}
      <div class="part-head"><div><p class="hello">${k ? `${k.flag} ${esc(BW.t(k.name))}` : '📖'}${r.country ? ` · ${esc(r.country)}` : ''}${r.from ? ` · ${BW.t('from')} ${esc(r.from)}` : ''}</p><h1 class="big">${esc(r.name)}</h1></div>
        <div class="start-row"><button class="btn btn-primary" data-cook ${lines(r.steps).length ? '' : 'disabled'}>👩‍🍳 ${BW.t('Cooking mode')}</button><button class="btn" data-plan>🗓️ ${BW.t('Plan it')}</button><button class="btn" data-stamp>🛂 ${BW.t('I cooked this')}</button><button class="btn btn-ghost" data-edit>✏️ ${BW.t('Edit')}</button></div></div>
      <div class="today"><div>
        <section class="card"><h2>${BW.t('Steps')}</h2>${lines(r.steps).map((s, i) => `<p><b>${i + 1}.</b> ${esc(s)}</p>`).join('') || `<p class="muted">${BW.t('No steps yet.')}</p>`}</section>
        ${r.story ? `<section class="card"><h2>${BW.t('The story')}</h2><p>${esc(r.story)}</p></section>` : ''}
      </div><aside class="side-col">
        <section class="card">${ui.k(`${BW.t('Ingredients')}${r.serves ? ` · ${BW.t('serves')} ${esc(r.serves)}` : ''}`)}${lines(r.ingredients).map((x) => `<p class="s">• ${esc(x)}</p>`).join('') || `<p class="muted">${BW.t('None yet.')}</p>`}</section>
        <section class="card">${ui.k(BW.t('Photo'))}<p class="s">${BW.t('A photo of the dish, or of the handwritten card.')}</p><label class="btn">📷 ${BW.t(r.photo ? 'Change the photo' : 'Add a photo')}<input type="file" accept="image/*" data-photo hidden></label></section>
        ${r.minutes ? `<section class="card">${ui.line('⏱️ ' + BW.t('Time'), `${esc(r.minutes)} min`)}</section>` : ''}
      </aside></div></div>`;
    $('[data-edit]', main).onclick = () => edit(r);
    $('[data-plan]', main).onclick = () => K.planIt({ recipeId: r.id, name: r.name, k: r.kitchen || '' });
    $('[data-stamp]', main).onclick = async () => { try { await K.stamp(Object.assign({ k: r.kitchen }, r), 'recipe'); BW.toast(BW.t('Stamped in your passport'), '🛂'); } catch (e) { BW.error(e); } };
    $('[data-cook]', main).onclick = () => cookingMode(r, lines(r.steps));
    $('[data-photo]', main).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { await BW.store.writeFile(photoPath(r), await asJpeg(f)); await BW.store.put('recipes', Object.assign(r, { photo: true })); BW.toast(BW.t('Photo saved'), '📷'); view(r); } catch (err) { BW.error(err); }
    };
  }

  function edit(r) {
    BW.recordDrawer({ collection: 'recipes', rec: r, fields: FIELDS, title: BW.t('Recipe'), newTitle: BW.t('A new recipe'),
      onSaved: (rec, isNew) => { if (isNew) location.hash = `open/${rec.id}`; }, onClose: () => route() });
  }

  // A recipe pasted from anywhere: lines that start with an amount are ingredients, the rest are steps.
  function paste() {
    BW.modal({ title: `📋 ${BW.t('Paste a recipe')}`, body: `<p class="s">${BW.t('Paste the recipe’s text. Busy puts the lines that start with an amount under ingredients and the rest under steps; you can move anything afterwards.')}</p><textarea class="in" rows="12" data-txt style="width:100%"></textarea>`,
      actions: [{ label: BW.t('Never mind'), kind: 'ghost' }, { label: BW.t('Make it a recipe'), kind: 'primary', onClick: async () => {
        const lines = $('[data-txt]', document.body).value.split('\n').map((x) => x.trim()).filter(Boolean);
        if (!lines.length) return false;
        const amount = /^[\d½¼¾⅓⅔]|^(a |an |one |two |three |pinch|handful|\d)/i;
        const rec = { name: lines[0].slice(0, 80), ingredients: lines.slice(1).filter((l) => amount.test(l) && l.length < 90).join('\n'), steps: lines.slice(1).filter((l) => !(amount.test(l) && l.length < 90)).join('\n'), source: BW.t('Pasted') };
        try { const saved = await BW.store.put('recipes', rec); location.hash = `open/${saved.id}`; } catch (e) { BW.error(e); }
      } }] });
  }

  // One step at a time, large, the screen kept on, and a timer when a step names minutes.
  async function cookingMode(r, steps) {
    let i = 0, lock = null, tick = null, left = 0;
    try { if (navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed here */ }
    const box = BW.html(`<div class="cook-mode" role="dialog" aria-modal="true" aria-label="${BW.t('Cooking mode')}"><div class="top"><b>${esc(r.name)}</b><span data-n></span><button class="btn" data-x>✕ ${BW.t('Close')}</button></div>
      <div class="step"><p data-s></p><div data-t></div></div><div class="nav"><button class="btn" data-prev>← ${BW.t('Back')}</button><button class="btn btn-primary" data-next>${BW.t('Next')} →</button></div></div>`);
    document.body.append(box);
    const stop = () => { clearInterval(tick); tick = null; };
    const close = () => { stop(); if (lock) lock.release().catch(() => {}); box.remove(); document.removeEventListener('keydown', keys); };
    const draw = () => {
      stop();
      $('[data-s]', box).textContent = steps[i];
      $('[data-n]', box).textContent = `${BW.t('Step')} ${i + 1} ${BW.t('of')} ${steps.length}`;
      const m = steps[i].match(/(\d+)\s*(?:min|minute|minuten|minuti|minutos|minutes)/i);
      $('[data-t]', box).innerHTML = m ? `<button class="btn" data-go>⏱️ ${BW.t('Start a timer')}: ${m[1]} min</button> <span class="timer" data-left></span>` : '';
      const go = $('[data-go]', box);
      if (go) go.onclick = () => { left = Number(m[1]) * 60; stop(); tick = setInterval(() => { left--; const el = $('[data-left]', box); if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 0) { stop(); BW.toast(BW.t('Time is up'), '⏰'); } }, 1000); };
      $('[data-prev]', box).disabled = i === 0;
      $('[data-next]', box).textContent = i === steps.length - 1 ? `${BW.t('Done')} ✓` : `${BW.t('Next')} →`;
    };
    const keys = (e) => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); $('[data-next]', box).click(); } if (e.key === 'ArrowLeft') $('[data-prev]', box).click(); if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', keys);
    $('[data-x]', box).onclick = close;
    $('[data-prev]', box).onclick = () => { if (i > 0) { i--; draw(); } };
    $('[data-next]', box).onclick = () => { if (i < steps.length - 1) { i++; draw(); } else close(); };
    draw();
  }

  // A photo as a JPEG of at most 1600 px, so the folder stays small and the cookbook can carry it.
  function asJpeg(file) {
    return new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => { const s = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => (b ? ok(b) : no(new Error('No photo'))), 'image/jpeg', 0.85); URL.revokeObjectURL(img.src); };
      img.onerror = () => no(new Error(BW.t('That file is not a photo Busy can read.')));
      img.src = URL.createObjectURL(file);
    });
  }
  const dataUrl = (blob) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
  const size = (url) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.src = url; });

  // The family cookbook: a title page, then one recipe per page with its story and photo.
  async function cookbook(list) {
    const doc = new BW.pdf.Doc(), W = doc.W, M = 56;
    const family = (BW.settings.ownerName || '').split(' ').slice(-1)[0];
    doc.rect(0, 0, W, doc.H, { fill: '#1E1B2E' });
    doc.rect(M, 220, 64, 64, { fill: '#FFC93C', r: 16 });
    doc.text(BW.t('The family cookbook'), M, 340, { size: 34, bold: true, color: '#FFF6E9' });
    if (family) doc.text(family, M, 380, { size: 20, color: '#FFC93C' });
    doc.text(`${list.length} ${BW.t(list.length === 1 ? 'recipe' : 'recipes')} · ${BW.fmtDate(BW.today(), { month: 'long', year: 'numeric' })}`, M, 410, { size: 12, color: '#FFF6E9' });
    for (const r of list.sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
      doc.addPage();
      let y = M + 10;
      const k = K.kitchen(r.kitchen);
      const para = (txt, sz, bold, gap) => { for (const l of doc.wrap(txt, W - 2 * M, sz, bold)) { if (y > doc.H - M) { doc.addPage(); y = M; } doc.text(l, M, y, { size: sz, bold }); y += sz * 1.4; } y += gap || 4; };
      para(r.name, 22, true, 6);
      para([k ? BW.t(k.name) : '', r.country, r.from ? `${BW.t('from')} ${r.from}` : '', r.serves ? `${BW.t('serves')} ${r.serves}` : ''].filter(Boolean).join(' · '), 10, false, 12);
      if (r.photo) {
        try {
          const url = await dataUrl(await BW.store.readFile(photoPath(r)));
          const [pw, ph] = await size(url);
          const w = W - 2 * M, h = Math.min(260, (w * ph) / pw);
          doc.image(url, pw, ph, M, y, (h * pw) / ph, h); y += h + 14;
        } catch (e) { /* a missing photo leaves the page without one */ }
      }
      if (r.story) para(r.story, 11, false, 12);
      para(BW.t('Ingredients'), 13, true);
      String(r.ingredients || '').split('\n').filter((x) => x.trim()).forEach((l) => para(`• ${l.trim()}`, 11, false, 0));
      y += 10;
      para(BW.t('Steps'), 13, true);
      String(r.steps || '').split('\n').filter((x) => x.trim()).forEach((l, i) => para(`${i + 1}. ${l.trim()}`, 11, false, 2));
    }
    BW.download(doc.blob(BW.t('The family cookbook')), `${BW.fileSafe(BW.t('The family cookbook'))}.pdf`);
    BW.toast(BW.t('Your family cookbook is downloading'), '📕');
  }
})();
