/* The Six Kitchens: one for each language of Busy. Each has its story, how to say its dishes, pictures of its
   places and customs (made with AI, and labelled so), its regions, its pantry, how people eat, its calendar and its
   dishes. #<kitchen> opens one, #<kitchen>/<tab> one of its tabs, #passport the dishes you have cooked. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const K = BW.kitchen;
  const main = $('#main');
  const TABS = [['story', 'The story'], ['pictures', 'Pictures'], ['dishes', 'Dishes'], ['table', 'At the table'], ['regions', 'Regions'], ['pantry', 'The pantry'], ['abroad', 'Ingredients abroad'], ['calendar', 'Calendar']];
  let query = '', kind = '';

  BW.boot({ app: 'kitchens', onReady: route, onChange: route });
  window.addEventListener('hashchange', () => { query = ''; kind = ''; route(); });

  async function route() {
    const [id, tab] = decodeURIComponent(location.hash.slice(1)).split('/');
    const stamps = await K.stamps();
    if (id === 'passport') return passport(stamps);
    const k = K.kitchen(id);
    return k ? kitchen(k, tab || 'story', stamps) : overview(stamps);
  }

  function overview(stamps) {
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('The six kitchens')}</p><h1 class="big">${BW.t('Six languages, six kitchens. Where shall we go?')}</h1></div></div>
      <div class="kitchen-grid">${K.kitchens.map((k) => `<a class="card kitchen-card" href="#${k.id}"><span class="pic" style="background-image:url('${K.cover(k)}')"></span>
        <span class="txt"><b>${k.flag} ${esc(BW.t(k.name))}</b><span class="muted">${esc(BW.t(k.line))}</span><br><small class="faint">${K.dishesOf(k.id).length} ${BW.t('dishes')}</small></span></a>`).join('')}</div>
      <div style="margin-top:20px">${K.passportCard(stamps)}</div>
      <p class="faint">${BW.t(K.AI_NOTE)}</p></div>`;
  }

  function kitchen(k, tab, stamps) {
    const dishes = K.dishesOf(k.id);
    const groups = (list) => { const gs = [...new Set(list.map((x) => x.g))]; return gs.map((g) => `${g ? `<h3>${esc(g)}</h3>` : ''}${list.filter((x) => x.g === g).map((x) => `<p><b>${esc(x.t)}</b>${x.s ? `: ${esc(x.s)}` : ''}</p>`).join('')}`).join(''); };
    const body = {
      story: () => `<div class="story">${k.story.map((p) => `<p>${esc(p)}</p>`).join('')}${k.say ? `<p class="s"><b>${BW.t('Say it')}:</b> ${esc(k.say)}</p>` : ''}</div>`,
      pictures: () => `<div class="gallery">${k.pictures.map((p) => `<figure><img src="${K.pic(p.id)}" alt="${esc(p.title)}" loading="lazy" data-big="${esc(p.id)}"><figcaption>${esc(p.title)}</figcaption></figure>`).join('')}</div><p class="faint">${BW.t(K.AI_NOTE)}</p>`,
      dishes: () => dishList(dishes),
      table: () => groups(k.customs),
      regions: () => groups(k.regions),
      pantry: () => groups(k.pantry),
      abroad: () => `<p class="muted">${BW.t('Hard to find where you live? What to use instead. Close, never quite the same.')}</p>${K.swapsOf(k.id).map((x) => `<p><b>${esc(x.name)}</b>: ${esc(x.use)}</p>`).join('')}`,
      calendar: () => k.calendar.map((c) => `<div class="line"><span><b>${esc(c.feast || c.when)}</b>${c.feast ? ` <small class="muted">${esc(c.when)}</small>` : ''}${c.g ? ` <small class="muted">· ${esc(c.g)}</small>` : ''}<br><span class="muted">${esc(c.what)}</span></span></div>`).join(''),
    }[tab] || (() => '');
    const cooked = new Set(stamps.filter((s) => s.k === k.id).map((s) => s.dishId)).size;
    main.innerHTML = `<div class="part-page">
      <p><a href="#">← ${BW.t('The six kitchens')}</a></p>
      <div class="kitchen-hero" style="background-image:url('${K.cover(k)}')" role="img" aria-label="${esc(k.pictures[0] ? k.pictures[0].title : '')}"><span class="ai-label">${BW.t('Made with AI')}</span></div>
      <div class="part-head"><div><p class="hello">${k.flag} ${esc(BW.t(k.name))} · ${dishes.length} ${BW.t('dishes')} · ${cooked} ${BW.t('cooked')}</p><h1 class="big">${esc(BW.t(k.line))}</h1></div></div>
      <div class="tabs-row" role="tablist">${TABS.map(([id, label]) => `<a class="btn" role="tab" href="#${k.id}/${id}" aria-pressed="${tab === id}">${BW.t(label)}</a>`).join('')}</div>
      <section class="card" data-body>${body()}</section></div>`;
    if (tab === 'dishes') bindDishes(dishes);
    BW.$$('[data-big]', main).forEach((img) => { img.onclick = () => BW.modal({ title: esc(img.alt), wide: true, body: `<img class="big-pic" src="${K.pic(img.dataset.big)}" alt="${esc(img.alt)}"><p class="faint">${BW.t(K.AI_NOTE)}</p>` }); });
  }

  // The dishes of a kitchen, searchable by name, ingredient or region, and by kind.
  const KINDS = [['', 'All'], ['main|stew|roast|pie|stamppot|primo|secondo|meat|fish|rice|pasta', 'Mains'], ['soup|sopa|zuppa|suppe|caldo', 'Soups'], ['bread|pão|pan|brood|brot|pane', 'Breads'], ['cake|sweet|dessert|dolce|doce|biscuit|pastry|kuchen|torte|taart|koek|postre|tart', 'Sweets'], ['snack|tapa|street|side|contorno|antipast', 'Snacks and sides'], ['drink|bebida|getränk|bevanda', 'Drinks']];
  function dishList(dishes) {
    return `<div class="have"><input class="in" data-q placeholder="${BW.t('Search a dish, an ingredient or a region')}" value="${esc(query)}" aria-label="${BW.t('Search the dishes')}"></div>
      <div class="tabs-row">${KINDS.map(([re, label]) => `<button class="btn" data-kind="${esc(re)}" aria-pressed="${kind === re}">${BW.t(label)}</button>`).join('')}</div>
      <div class="dish-list" data-list>${listHtml(dishes)}</div>`;
  }
  function listHtml(dishes) {
    const q = K.words(query);
    const re = kind ? new RegExp(kind, 'i') : null;
    const hits = dishes.filter((d) => (!re || re.test(`${d._type || ''} ${d.type}`)) && (!q.length || q.every((w) => K.words(`${d.name} ${d.en} ${d._en || ''} ${d.ing} ${d._ing || ''} ${d.where} ${d.when} ${d.type}`).some((x) => x.startsWith(w)))));
    return hits.length ? hits.slice(0, 300).map((d) => `<button type="button" class="line link" data-dish="${esc(d.id)}" style="width:100%;text-align:left"><span><b>${esc(d.name)}</b><small>${esc([d.en !== d.name ? d.en : '', d.g, d.where].filter(Boolean).join(' · '))}</small></span><b>${esc(d.type)}</b></button>`).join('')
      : `<p class="muted">${BW.t('No dish matches that. Try one word, such as an ingredient.')}</p>`;
  }
  function bindDishes(dishes) {
    const list = $('[data-list]', main);
    const bindRows = () => BW.$$('[data-dish]', list).forEach((b) => { b.onclick = () => K.dishDrawer(K.dish(b.dataset.dish), route); });
    $('[data-q]', main).oninput = BW.debounce((e) => { query = e.target.value; list.innerHTML = listHtml(dishes); bindRows(); }, 150);
    BW.$$('[data-kind]', main).forEach((b) => { b.onclick = () => { kind = b.dataset.kind; BW.$$('[data-kind]', main).forEach((x) => x.setAttribute('aria-pressed', x === b)); list.innerHTML = listHtml(dishes); bindRows(); }; });
    bindRows();
  }

  function passport(stamps) {
    const byK = K.passport(stamps);
    main.innerHTML = `<div class="part-page">
      <p><a href="#">← ${BW.t('The six kitchens')}</a></p>
      <div class="part-head"><div><p class="hello">${BW.t('Your kitchen passport')}</p><h1 class="big">${BW.t(stamps.length ? 'Every dish you cooked, kitchen by kitchen.' : 'No stamps yet. Cook a dish and stamp it.')}</h1></div></div>
      <div class="kitchen-grid">${byK.map((p) => `<section class="card"><h2>${p.k.flag} ${esc(BW.t(p.k.name))}</h2>${ui.gauge((p.n / Math.max(1, p.of)) * 100, 'sun')}<p class="s">${p.n} ${BW.t('of')} ${p.of} ${BW.t('dishes')}</p>
        ${stamps.filter((s) => s.k === p.k.id).slice(-8).reverse().map((s) => ui.line(`🛂 ${esc(s.name || '')}`, BW.fmtDate(s.date, { day: 'numeric', month: 'short' }))).join('')}</section>`).join('')}</div></div>`;
  }
})();
