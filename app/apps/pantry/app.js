/* The Pantry: what is in the fridge, the freezer and the cupboard, each with its use-by date, and leftovers marked
   as such. What goes off within three days comes first, and Tonight puts it to use. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const main = $('#main');
  const WHERE = [['fridge', '🧊 Fridge'], ['freezer', '❄️ Freezer'], ['cupboard', '🥫 Cupboard']];
  const FIELDS = [
    { k: 'name', label: 'What', ph: 'e.g. spinach, minced beef, rice', required: true },
    { k: 'where', label: 'Where', type: 'select', options: WHERE },
    { k: 'useBy', label: 'Use by', type: 'date' },
    { k: 'qty', label: 'How much', ph: 'e.g. 500 g, half a bag' },
    { k: 'leftover', label: 'Leftovers', type: 'select', options: [['', 'No'], ['yes', 'Yes, from a meal']] },
    { k: 'note', label: 'Note', ph: 'e.g. from Sunday’s roast' },
  ];

  BW.boot({ app: 'pantry', onReady: render, onChange: render });

  async function render() {
    const list = (await BW.store.all('pantry').catch(() => [])).filter((p) => !p.gone);
    const today = BW.today(), soon = BW.addDays(today, 3);
    const first = list.filter((p) => p.useBy && p.useBy <= soon).sort((a, b) => a.useBy.localeCompare(b.useBy));
    BW.partCount('week', first.length);
    const row = (p) => `<div class="line"><span>${p.leftover === 'yes' ? '🍲 ' : ''}<b>${esc(p.name)}</b>${p.qty ? ` <small class="muted">· ${esc(p.qty)}</small>` : ''}${p.note ? ` <small class="muted">· ${esc(p.note)}</small>` : ''}</span>
      <span style="display:flex;gap:6px;align-items:center">${p.useBy ? `<b${p.useBy < today ? ' style="color:var(--tomato)"' : ''}>${BW.fmtDate(p.useBy, { day: 'numeric', month: 'short' })}</b>` : ''}<button class="btn" data-open="${esc(p.id)}">✏️</button><button class="btn" data-used="${esc(p.id)}" title="${BW.t('Used up')}">✓</button></span></div>`;
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('Pantry')}</p><h1 class="big">${BW.t(first.length ? 'Use these first. The rest can wait.' : list.length ? 'Everything is fresh for now.' : 'What is in the fridge?')}</h1></div>
        <div class="start-row"><button class="btn btn-primary" data-new>🧺 ${BW.t('Add something')}</button><a class="btn" href="../../kitchen.html">🍳 ${BW.t('What can I cook?')}</a></div></div>
      ${first.length ? `<section class="card use-first"><h2>${BW.t('Use first')}</h2>${first.map(row).join('')}</section>` : ''}
      ${WHERE.map(([w, label]) => { const ls = list.filter((p) => (p.where || 'fridge') === w).sort((a, b) => String(a.useBy || '9').localeCompare(String(b.useBy || '9'))); return `<section class="card"><h2>${BW.t(label)} <small>· ${ls.length}</small></h2>${ls.map(row).join('') || `<p class="muted">${BW.t('Nothing here.')}</p>`}</section>`; }).join('')}
      <p class="faint">${BW.t('Use-by dates are on the packet; leftovers keep about three days in the fridge. When in doubt, throw it out.')}</p></div>`;
    $('[data-new]', main).onclick = () => edit({ where: 'fridge' });
    BW.$$('[data-open]', main).forEach((b) => { b.onclick = () => edit(list.find((p) => p.id === b.dataset.open)); });
    BW.$$('[data-used]', main).forEach((b) => { b.onclick = async () => { const p = list.find((x) => x.id === b.dataset.used); try { await BW.store.remove('pantry', p.id); BW.toast(`${esc(p.name)}: ${BW.t('used up')}`, '✓', { label: BW.t('Undo'), run: () => BW.store.put('pantry', p) }); } catch (e) { BW.error(e); } }; });
  }

  function edit(p) {
    BW.recordDrawer({ collection: 'pantry', rec: p, fields: FIELDS, title: BW.t('In the pantry'), newTitle: BW.t('Add to the pantry'), onClose: render });
  }
})();
