/* The game in other languages. Whole sentences from levels.js and lines.js are swapped before the game starts; anything the code writes on screen is swapped as it appears.
   Words: i18n/<lang>.json ({English: translation}), the paid edition's in ai/i18n/<lang>.json. English needs nothing. Names stay. */
(() => {
  const LANGS = ['nl', 'de', 'es', 'it', 'pt-br'];
  const pick = () => {
    let saved = null; try { saved = localStorage.getItem('busy.lang'); } catch (e) { /* private window */ }
    const want = (saved || navigator.language || 'en').toLowerCase();
    if (want.startsWith('pt')) return 'pt-br';
    const two = want.slice(0, 2);
    return LANGS.includes(two) ? two : 'en';
  };
  const SKIP = new Set(['id', 'room', 'who', 't', 'tool', 'place', 'src', 'key', 'by', 'for', 'frees', 'team', 'offstage', 'glb', 'flag', 'need', 'run', 'scene', 'line', 'stow', 'can', 'kind', 'wake', 'sea', 'time', 'moves', 'joinAt', 'if', 'tools', 'hurt', 'mat', 'anim', 'do', 'prop', 'carry', 'item', 'gate', 'door', 'lever', 'opens', 'needs', 'starts', 'keeps', 'meanings', 'words', 'tests', 'where', 'effects', 'answers', 'meaning', 'free', 'keep', 'flagged']);
  const lang = pick();
  let words = {}, patterns = [];
  const compile = () => {
    patterns = [];
    for (const k of Object.keys(words)) {
      if (!/\{(\d+|[a-z]+)\}/.test(k) || words[k] === k || k.replace(/\{(\d+|[a-z]+)\}/g, '').trim().length < 3) continue;
      const order = []; const re = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\d+|[a-z]+)\}/g, (m, n) => { order.push(n); return '(.*?)'; });
      patterns.push({ re: new RegExp('^' + re + '$'), order, to: words[k] });
    }
  };
  const t = (s) => {
    if (lang === 'en' || typeof s !== 'string') return s;
    if (words[s] !== undefined) return words[s];
    for (const p of patterns) { const m = s.match(p.re); if (m) { let out = p.to; p.order.forEach((n, i) => { out = out.replace(`{${n}}`, t(m[i + 1])); }); return out; } }
    return s;
  };
  // every string inside a plain object or array, in place, leaving code words alone
  const walk = (o) => {
    if (lang === 'en' || !o) return o;
    if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === 'string') o[i] = t(v); else walk(v); }); return o; }
    if (typeof o === 'object') for (const k of Object.keys(o)) { if (SKIP.has(k)) continue; const v = o[k]; if (typeof v === 'string') o[k] = t(v); else if (v && typeof v === 'object') walk(v); }
    return o;
  };
  // A scene's words by their place: its replies and labels are named after what they mean ('who', 'wake'), and those names look like code to walk.
  const SCENE_TEXT = ['name', 'ask', 'reply', 'miss', 'label', 'after', 'checking', 'prefix', 'by'];
  const each = (v) => (typeof v === 'string' ? t(v) : Array.isArray(v) ? v.map(each) : v && typeof v === 'object' ? (v.say !== undefined ? { ...v, say: each(v.say) } : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, each(x)]))) : v);
  const scene = (sc) => {
    if (lang === 'en') return sc;
    const rest = {};
    for (const k of Object.keys(sc)) {
      if (SCENE_TEXT.includes(k) || k.startsWith('habit_')) sc[k] = each(sc[k]);
      else if (k === 'options') sc.options = sc.options.map((o) => ({ ...o, label: t(o.label) }));
      else rest[k] = sc[k];
    }
    walk(rest);
    for (const k of Object.keys(rest)) sc[k] = rest[k];
    return sc;
  };
  const textNode = (n) => { const raw = n.nodeValue, s = raw.trim(); if (!s) return; const out = t(s); if (out !== s) n.nodeValue = raw.replace(s, out); };
  const element = (el) => {
    if (el.nodeType === 3) { textNode(el); return; }
    if (el.nodeType !== 1 || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'INPUT' && el.type !== 'text') return;
    for (const a of ['aria-label', 'title', 'placeholder']) if (el.hasAttribute(a)) { const v = el.getAttribute(a), out = t(v); if (out !== v) el.setAttribute(a, out); }
    for (const c of el.childNodes) element(c);
  };
  const watch = () => {
    if (lang === 'en') return;
    element(document.body);
    new MutationObserver((list) => { for (const m of list) { if (m.type === 'characterData') textNode(m.target); else for (const n of m.addedNodes) element(n); } }).observe(document.body, { subtree: true, childList: true, characterData: true });
    document.documentElement.lang = lang;
  };
  const load = async (url) => { if (lang === 'en') return; try { const r = await fetch(url.replace('{lang}', lang)); if (r.ok) { Object.assign(words, await r.json()); compile(); } } catch (e) { /* stays in English */ } };
  const ready = load('i18n/{lang}.json').then(() => { walk(window.SNIP_LINES); walk(window.SNIP_LEVELS); watch(); });
  const setLang = (l) => { try { localStorage.setItem('busy.lang', l); } catch (e) { /* private window */ } location.reload(); };
  window.SNIP_I18N = { lang, LANGS, t, walk, scene, load, ready, setLang };
})();
