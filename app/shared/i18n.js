/* Busy in other languages, in the browser. The apps are written in English; this translates what a page shows
   (text, placeholders, labels, alt texts, the page title) into the chosen language, also everything a tool
   draws later, with the words from shared/i18n/<lang>.js (made by i18n/i18n.py from i18n/<lang>.json).
   A word list entry with {0} is a pattern: "{0} open invoices" also translates "3 open invoices".

   The language: the one chosen in Busy (kept in the browser as busy.lang), else the browser's or computer's
   own language when Busy has it (Dutch, German, Spanish, Italian, Brazilian Portuguese), else English. A page
   of the website in another language says its language itself (data-lang). Loaded before core.js; a plain
   script, so it also works from files on disk and in the desktop apps. Nothing is sent anywhere.

   What people type themselves is never translated: inputs, editors, and anything marked translate="no"
   (the invoice and the letter on paper keep their own document language). */
(function () {
  'use strict';
  var me = document.currentScript;
  var SUPPORTED = ['nl', 'de', 'es', 'it', 'pt-br'];
  var HTML_LANG = { nl: 'nl', de: 'de', es: 'es', it: 'it', 'pt-br': 'pt-BR', en: 'en' };

  function choose() {
    if (me && me.dataset.lang) return me.dataset.lang;
    try { var c = localStorage.getItem('busy.lang'); if (c && (c === 'en' || SUPPORTED.indexOf(c) >= 0)) return c; } catch (e) { /* private window */ }
    var l = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
    var k = l.slice(0, 2) === 'pt' ? 'pt-br' : l.slice(0, 2);
    return SUPPORTED.indexOf(k) >= 0 ? k : 'en';
  }
  var lang = choose();
  window.BusyLang = lang;
  window.BusyLanguages = [['en', 'English'], ['nl', 'Nederlands'], ['de', 'Deutsch'], ['es', 'Español'], ['it', 'Italiano'], ['pt-br', 'Português (Brasil)']];
  // Choosing a language: kept in this browser (or this app) and the page starts again in it.
  window.BusySetLanguage = function (l) { try { localStorage.setItem('busy.lang', l); } catch (e) { /* ignore */ } location.reload(); };
  window.BusyI18n = { lang: lang, t: function (s) { return s; } };
  if (lang === 'en') return;
  document.documentElement.lang = HTML_LANG[lang];
  if (!window.BUSY_I18N || window.BUSY_I18N.lang !== lang) {
    // The words, before the page goes on (a plain script tag: it works from files too).
    var src = me ? me.src.replace(/i18n\.js(\?.*)?$/, 'i18n/' + lang + '.js') : '';
    if (src) document.write('<script src="' + src + '"><\/script>');
  }

  var exact = null, buckets = null, any = [];
  function prepare() {
    if (exact) return true;
    var W = (window.BUSY_I18N && window.BUSY_I18N.lang === lang && window.BUSY_I18N.words) || null;
    if (!W) return false;
    exact = Object.create(null); buckets = Object.create(null);
    Object.keys(W).forEach(function (k) {
      if (!/\{\d+\}/.test(k)) { exact[k] = W[k]; return; }
      var lit = k.replace(/\{\d+\}/g, '').trim();
      if (!lit) return;
      var order = [];
      var rx = new RegExp('^' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\d+)\\\}/g, function (m, n) { order.push(+n); return '(.+?)'; }) + '$');
      var p = { rx: rx, v: W[k], order: order, len: k.length };
      var first = k.charAt(0);
      if (first === '{') any.push(p); else (buckets[first] = buckets[first] || []).push(p);
    });
    var byLen = function (a, b) { return b.len - a.len; };
    any.sort(byLen); Object.keys(buckets).forEach(function (c) { buckets[c].sort(byLen); });
    return true;
  }
  // A key: the exact text, else a {0} pattern (its gaps translated too), else the text after an emoji or
  // symbol in front ("🪪 ID and passport"), else each part of a " · " line on its own.
  function look(key, depth) {
    var v = exact[key];
    if (v !== undefined || depth > 2) return v;
    var list = (buckets[key.charAt(0)] || []).concat(any);
    for (var i = 0; i < list.length; i++) {
      var hit = list[i].rx.exec(key);
      if (!hit) continue;
      v = list[i].v;
      for (var j = 0; j < list[i].order.length; j++) {
        var val = hit[j + 1], t = /[A-Za-z]/.test(val) ? look(val, depth + 1) : undefined;
        v = v.split('{' + list[i].order[j] + '}').join(t !== undefined ? t : val);
      }
      return v;
    }
    var pre = /^([^A-Za-z\u00C0-\u024F"“‘'(¿¡]+)(\S[\s\S]*)$/.exec(key);
    if (pre && pre[1].trim()) { var rest = look(pre[2], depth + 1); if (rest !== undefined) return pre[1] + rest; }
    if (key.indexOf(' · ') > 0) {
      var parts = key.split(' · '), changed = false;
      for (var k = 0; k < parts.length; k++) { var p = /[A-Za-z]/.test(parts[k]) ? look(parts[k], depth + 1) : undefined; if (p !== undefined) { parts[k] = p; changed = true; } }
      if (changed) return parts.join(' · ');
    }
    return undefined;
  }
  function tr(s) {
    if (!s || !prepare()) return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), key = m[2].replace(/\s+/g, ' ');
    if (!key || !/[A-Za-z]/.test(key)) return s;
    var v = look(key, 0);
    return v === undefined ? s : m[1] + v + m[3];
  }
  window.BusyI18n.t = tr;

  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  function skipped(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.tagName] || e.isContentEditable || e.getAttribute('translate') === 'no') return true;
    }
    return false;
  }
  // What this script wrote itself is never translated again (a translation can look like an English pattern).
  var mine = new WeakMap();
  function text(node) {
    if (mine.get(node) === node.data || !node.parentNode || skipped(node.parentNode)) return;
    var t = tr(node.data);
    if (t !== node.data) { node.data = t; mine.set(node, t); }
  }
  function attrs(el) {
    if (skipped(el)) return;
    var done = mine.get(el) || {};
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a && done[ATTRS[i]] !== a) { var t = tr(a); if (t !== a) { el.setAttribute(ATTRS[i], t); done[ATTRS[i]] = t; mine.set(el, done); } }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return text(root);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skipped(root)) return; attrs(root); }
    var w = document.createTreeWalker(root, 5 /* elements and text */, null), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) text(n); else attrs(n); }
  }
  var lastTitle = '';
  function start() {
    if (!prepare()) return;
    walk(document.body);
    if (document.title) document.title = lastTitle = tr(document.title);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'childList') for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
        else if (r.type === 'characterData') text(r.target);
        else if (r.type === 'attributes' && r.target.nodeType === 1) attrs(r.target);
      }
      if (document.title && document.title !== lastTitle) { lastTitle = tr(document.title); if (lastTitle !== document.title) document.title = lastTitle; }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
