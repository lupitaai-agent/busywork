// Dumps the apps' built-in content (checklists, letters, country rules, questions) as JSON for site_pages.py.
'use strict';
const { busywork } = require('../tests/harness.js');
if (process.argv[2] !== "mails") (async () => {
  const { BW } = await busywork(['shared/house.js', 'shared/rentals.js', 'shared/growth.js', 'shared/projects.js']);
  const H = BW.house, R = BW.rentals, G = BW.growth;
  const out = {
    home: { move: H.MOVE_TASKS, who: H.WHO_TO_TELL, binder: H.BINDER, starter: H.STARTER, areas: H.AREAS, letters: H.LETTERS, letterText: H.LETTER_TEXT },
    rentals: { packs: R.PACKS, letters: R.LETTERS, letterText: R.LETTER_TEXT },
    growth: { questions: G.QUESTIONS },
    projects: BW.pm && BW.pm.TEMPLATES,
  };
  process.stdout.write(JSON.stringify(out, null, 1));
})();

// The invoice emails live inside the invoices app; they are pure functions, so they can be called with fill-in labels.
module.exports.mails = function () {
  const fs = require('fs'), vm = require('vm');
  const src = fs.readFileSync(__dirname + '/../app/apps/invoices/app.js', 'utf8');
  const a = src.indexOf('const MAILS = {'), b = src.indexOf('\n  };', a);
  const MAILS = vm.runInNewContext('(' + src.slice(a + 'const MAILS = '.length, b + 4) + ')');
  const L = {
    en: ['[invoice number]', '[amount]', '[due date]', '[number]', '[your name]', '[account number]'],
    nl: ['[factuurnummer]', '[bedrag]', '[vervaldatum]', '[aantal]', '[je naam]', '[rekeningnummer]'],
    de: ['[Rechnungsnummer]', '[Betrag]', '[Fälligkeitsdatum]', '[Anzahl]', '[dein Name]', '[Kontonummer]'],
    es: ['[número de factura]', '[importe]', '[fecha de vencimiento]', '[número]', '[tu nombre]', '[número de cuenta]'],
    it: ['[numero della fattura]', '[importo]', '[data di scadenza]', '[numero]', '[il tuo nome]', '[numero di conto]'],
    'pt-br': ['[número da fatura]', '[valor]', '[data de vencimento]', '[número]', '[seu nome]', '[número da conta]'],
  };
  const out = {};
  for (const [lang, [no, amount, due, late, sign, iban]] of Object.entries(L)) {
    const M = MAILS[lang] || MAILS.en;
    const pay = ' ' + M.pay({ iban, name: sign, no });
    const o = { hi: M.hi(''), no, amount, due, dueShort: due, late, sign, valid: due, p1: '\n\n' + pay.trim(), p2: '\n\n' + pay.trim() };
    out[lang] = { invoice: ['', M.invoice(o)], friendly: M.friendly(o), firm: M.firm(o), final: M.final(o) };
  }
  return out;
};
if (process.argv[2] === 'mails') process.stdout.write(JSON.stringify(module.exports.mails(), null, 1));
