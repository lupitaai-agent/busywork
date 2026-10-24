/* A small PDF writer, so invoices become real PDF files without any library.
   It draws text in the built-in Helvetica fonts and embeds the logo as JPEG.
   Text widths come from the browser's Arial/Helvetica, which share the same metrics. */
(function () {
  'use strict';
  const BW = window.BW;
  const W = 595.28, H = 841.89; // A4 in points

  // Helvetica speaks WinAnsi, not Unicode: map the characters that differ and replace the rest.
  const WIN = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F, 0x202F: 0x20, 0x2009: 0x20, 0x2007: 0x20, 0x2212: 0x2D };
  function winAnsi(str) {
    let out = '';
    for (const ch of String(str)) {
      const c = ch.codePointAt(0);
      // Emoji and other symbols are dropped rather than printed as "?".
      if (WIN[c] === undefined && c >= 0x2000) continue;
      const b = WIN[c] !== undefined ? WIN[c] : (c >= 0x20 && c < 0x7F) || (c >= 0xA0 && c <= 0xFF) ? c : c < 0x20 ? 0x20 : 0x3F;
      out += String.fromCharCode(b);
    }
    return out;
  }
  function pdfString(s) {
    let o = '(';
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      if (ch === '(' || ch === ')' || ch === '\\') o += '\\' + ch;
      else if (c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0');
      else o += ch;
    }
    return o + ')';
  }
  const n = (v) => (Math.round(v * 100) / 100).toString();
  function rgb(hex) {
    hex = String(hex || '#000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16) / 255 || 0);
  }
  const rgbOp = (hex, op) => rgb(hex).map((v) => v.toFixed(3)).join(' ') + ' ' + op;
  // Mix a colour with white: t=0 is white, t=1 is the colour.
  BW.tint = (hex, t) => '#' + rgb(hex).map((v) => Math.round(255 - (255 - v * 255) * t).toString(16).padStart(2, '0')).join('');
  // True when dark ink reads better on this colour than white does (WCAG contrast).
  BW.isLight = (hex) => {
    const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return (lum + 0.05) / 0.0626 > 1.05 / (lum + 0.05); // 0.0626 = luminance of the ink colour #1E1B2E + 0.05
  };

  const measure = document.createElement('canvas').getContext('2d');
  function width(str, size, bold) {
    measure.font = (bold ? 'bold ' : '') + '100px Helvetica, Arial, sans-serif';
    return (measure.measureText(String(str)).width / 100) * size;
  }

  function Doc() { this.pages = []; this.images = []; this.links = []; this.addPage(); }
  Doc.prototype = {
    W, H,
    addPage() { this.page = []; this.pages.push(this.page); },
    op(s) { this.page.push(s); },
    width,
    // y is the text baseline, measured from the top of the page.
    text(str, x, y, o = {}) {
      const size = o.size || 10, bold = !!o.bold;
      str = String(str == null ? '' : str);
      const w = width(str, size, bold);
      if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2;
      this.op(`BT /${bold ? 'F2' : 'F1'} ${n(size)} Tf ${rgbOp(o.color || '#1E1B2E', 'rg')} ${n(x)} ${n(H - y)} Td ${pdfString(winAnsi(str))} Tj ET`);
      return w;
    },
    wrap(str, maxW, size, bold) {
      const lines = [];
      for (const para of String(str || '').split(/\r?\n/)) {
        let line = '';
        for (const word of para.split(/\s+/)) {
          const tryLine = line ? line + ' ' + word : word;
          if (width(tryLine, size, bold) <= maxW || !line) line = tryLine;
          else { lines.push(line); line = word; }
        }
        lines.push(line);
      }
      return lines;
    },
    rect(x, y, w, h, o = {}) {
      const r = Math.min(o.r || 0, w / 2, h / 2), b = H - y - h, k = 0.5523 * r;
      let path;
      if (!r) path = `${n(x)} ${n(b)} ${n(w)} ${n(h)} re`;
      else path = [
        `${n(x + r)} ${n(b)} m`, `${n(x + w - r)} ${n(b)} l`, `${n(x + w - r + k)} ${n(b)} ${n(x + w)} ${n(b + r - k)} ${n(x + w)} ${n(b + r)} c`,
        `${n(x + w)} ${n(b + h - r)} l`, `${n(x + w)} ${n(b + h - r + k)} ${n(x + w - r + k)} ${n(b + h)} ${n(x + w - r)} ${n(b + h)} c`,
        `${n(x + r)} ${n(b + h)} l`, `${n(x + r - k)} ${n(b + h)} ${n(x)} ${n(b + h - r + k)} ${n(x)} ${n(b + h - r)} c`,
        `${n(x)} ${n(b + r)} l`, `${n(x)} ${n(b + r - k)} ${n(x + r - k)} ${n(b)} ${n(x + r)} ${n(b)} c`, 'h',
      ].join(' ');
      const paint = o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S';
      this.op(`q ${o.fill ? rgbOp(o.fill, 'rg') : ''} ${o.stroke ? rgbOp(o.stroke, 'RG') + ' ' + n(o.lw || 1) + ' w' : ''} ${path} ${paint} Q`);
    },
    line(x1, y1, x2, y2, o = {}) {
      this.op(`q ${rgbOp(o.color || '#DDDDDD', 'RG')} ${n(o.lw || 0.75)} w ${n(x1)} ${n(H - y1)} m ${n(x2)} ${n(H - y2)} l S Q`);
    },
    // A clickable area (x, y from the top) that opens url in the reader's browser.
    link(x, y, w, h, url) { this.links.push({ page: this.pages.length - 1, rect: [x, H - y - h, x + w, H - y], url }); },
    // dataUrl must be a JPEG.
    image(dataUrl, pw, ph, x, y, w, h) {
      const bin = atob(dataUrl.split(',')[1]); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      this.images.push({ bytes, w: pw, h: ph });
      this.op(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(H - y - h)} cm /Im${this.images.length - 1} Do Q`);
    },
    blob(title) {
      const parts = []; let len = 0; const offsets = [];
      const put = (p) => { if (typeof p === 'string') { const b = new Uint8Array(p.length); for (let i = 0; i < p.length; i++) b[i] = p.charCodeAt(i) & 255; p = b; } parts.push(p); len += p.length; };
      const I = this.images.length, P = this.pages.length;
      const imgId = (i) => 5 + i, pageId = (p) => 5 + I + p * 2, infoId = 5 + I + P * 2, linkId = (i) => infoId + 1 + i;
      const obj = (id, body) => { offsets[id] = len; put(`${id} 0 obj\n`); (Array.isArray(body) ? body : [body]).forEach(put); put('\nendobj\n'); };

      put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
      obj(2, `<< /Type /Pages /Kids [${this.pages.map((_, p) => pageId(p) + ' 0 R').join(' ')}] /Count ${P} >>`);
      obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      this.images.forEach((im, i) => obj(imgId(i), [
        `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`,
        im.bytes, '\nendstream',
      ]));
      const xobj = I ? `/XObject << ${this.images.map((_, i) => `/Im${i} ${imgId(i)} 0 R`).join(' ')} >>` : '';
      this.pages.forEach((ops, p) => {
        const content = ops.join('\n');
        const annots = this.links.map((l, i) => (l.page === p ? `${linkId(i)} 0 R` : '')).filter(Boolean);
        obj(pageId(p), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xobj} >> /Contents ${pageId(p) + 1} 0 R${annots.length ? ` /Annots [${annots.join(' ')}]` : ''} >>`);
        obj(pageId(p) + 1, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
      });
      obj(infoId, `<< /Title ${pdfString(winAnsi(title || ''))} /Producer ${pdfString(BW.brand.name)} >>`);
      this.links.forEach((l, i) => obj(linkId(i), `<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(n).join(' ')}] /Border [0 0 0] /A << /S /URI /URI ${pdfString(winAnsi(l.url))} >> >>`));
      const last = infoId + this.links.length;

      const xref = len;
      put(`xref\n0 ${last + 1}\n0000000000 65535 f \n`);
      for (let id = 1; id <= last; id++) put(String(offsets[id]).padStart(10, '0') + ' 00000 n \n');
      put(`trailer\n<< /Size ${last + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF`);
      return new Blob(parts, { type: 'application/pdf' });
    },
  };

  BW.pdf = { Doc };

  // ---------- invoice and quote layout ----------
  const LABELS = {
    en: { invoice: 'Invoice', quote: 'Quote', no: 'No.', from: 'From', billTo: 'Bill to', quoteFor: 'Prepared for', date: 'Date', due: 'Due date', valid: 'Valid until',
      desc: 'Description', qty: 'Qty', price: 'Price', vat: 'VAT', amount: 'Amount', subtotal: 'Subtotal', total: 'Total', vatLine: 'VAT {r}%',
      reverse: 'VAT reverse-charged', pay: 'Please transfer {total} before {due} to {iban} in the name of {name}, mentioning {number}.',
      validNote: 'This quote is valid until {valid}.', page: 'Page', reg: 'Reg. no.', vatNo: 'VAT no.', bic: 'BIC',
      credit: 'Credit note', creditFor: 'This credit note corrects invoice {number}.', discount: 'Discount {p}%', paid: 'Already paid', due2: 'Still to pay',
      scan: 'Scan to pay with your banking app', payOnline: 'Pay online:' },
    nl: { invoice: 'Factuur', quote: 'Offerte', no: 'Nr.', from: 'Van', billTo: 'Factuur aan', quoteFor: 'Offerte voor', date: 'Datum', due: 'Vervaldatum', valid: 'Geldig tot',
      desc: 'Omschrijving', qty: 'Aantal', price: 'Prijs', vat: 'Btw', amount: 'Bedrag', subtotal: 'Subtotaal', total: 'Totaal', vatLine: 'Btw {r}%',
      reverse: 'Btw verlegd', pay: 'Graag {total} vóór {due} overmaken naar {iban} t.n.v. {name}, onder vermelding van {number}.',
      validNote: 'Deze offerte is geldig tot {valid}.', page: 'Pagina', reg: 'KvK', vatNo: 'Btw-nr.', bic: 'BIC',
      credit: 'Creditnota', creditFor: 'Deze creditnota corrigeert factuur {number}.', discount: 'Korting {p}%', paid: 'Al betaald', due2: 'Nog te betalen',
      scan: 'Scan en betaal met je bank-app', payOnline: 'Online betalen:' },
  };
  BW.docLabels = (lang) => LABELS[lang] || LABELS.en;
  const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => (o[k] == null ? '' : o[k]));

  BW.pdf.invoice = (inv, s) => {
    const L = BW.docLabels(s.docLang), d = new Doc();
    const accent = s.brandColor || '#FF6B4A', ink = '#1E1B2E', grey = '#6B6880', faint = '#9A97AC';
    const M = 50, R = W - M;
    const money = (v) => BW.money(v, inv.currency || s.currency, s.docLang);
    const date = (iso) => BW.fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' }, s.docLang);
    const t = BW.invoiceTotals(inv);
    const c = inv.client || {};
    const isQuote = inv.kind === 'quote', isCredit = inv.kind === 'credit';
    const title = isQuote ? L.quote : isCredit ? L.credit : L.invoice;

    const footer = (pageNo) => {
      d.line(M, H - 48, R, H - 48, { color: '#E6E3EE' });
      const bits = [s.businessName, s.regNumber && `${L.reg} ${s.regNumber}`, s.vatNumber && `${L.vatNo} ${s.vatNumber}`, s.email, s.website].filter(Boolean).join('  ·  ');
      d.text(bits, M, H - 32, { size: 7.5, color: faint });
      d.text(`${L.page} ${pageNo}`, R, H - 32, { size: 7.5, color: faint, align: 'right' });
    };

    // header band
    d.rect(0, 0, W, 10, { fill: accent });
    let y = 46;
    if (s.logo && s.logoW) {
      const k = Math.min(170 / s.logoW, 58 / s.logoH);
      d.image(s.logo, s.logoW, s.logoH, M, y, s.logoW * k, s.logoH * k);
    } else {
      d.text(s.businessName, M, y + 24, { size: 20, bold: true, color: ink });
    }
    d.text(title.toUpperCase(), R, y + 22, { size: 24, bold: true, color: accent, align: 'right' });
    d.text(`${L.no} ${inv.number}`, R, y + 40, { size: 10, color: grey, align: 'right' });
    y = 140;

    // parties and dates
    const block = (x, label, lines, maxW) => {
      d.text(label.toUpperCase(), x, y, { size: 7.5, bold: true, color: faint });
      let yy = y + 16;
      lines.filter(Boolean).forEach((ln, i) => {
        for (const part of d.wrap(ln, maxW, 9.5, i === 0)) { d.text(part, x, yy, { size: 9.5, bold: i === 0, color: i === 0 ? ink : grey }); yy += 13; }
      });
      return yy;
    };
    const fromEnd = block(M, L.from, [s.businessName, s.ownerName !== s.businessName && s.ownerName, s.address, [s.postcode, s.city].filter(Boolean).join(' '), s.country, s.email, s.phone], 160);
    const toEnd = block(M + 175, isQuote ? L.quoteFor : L.billTo, [c.name, c.contact, c.address, [c.postcode, c.city].filter(Boolean).join(' '), c.country, c.vat && `${L.vatNo} ${c.vat}`], 160);
    const dates = [[L.date, date(inv.issueDate)], [isQuote ? L.valid : L.due, date(isQuote ? inv.validUntil : inv.dueDate)]];
    dates.forEach(([k, v], i) => {
      d.text(k.toUpperCase(), R, y + i * 34, { size: 7.5, bold: true, color: faint, align: 'right' });
      d.text(v, R, y + i * 34 + 15, { size: 9.5, bold: true, color: ink, align: 'right' });
    });
    y = Math.max(fromEnd, toEnd, y + 60) + 26;

    // line items
    const col = { desc: M + 12, qty: 340, price: 410, vat: 460, amt: R - 12 };
    const head = () => {
      d.rect(M, y, R - M, 26, { fill: BW.tint(accent, 0.14), r: 8 });
      const o = { size: 8, bold: true, color: ink };
      d.text(L.desc.toUpperCase(), col.desc, y + 17, o);
      d.text(L.qty.toUpperCase(), col.qty, y + 17, { ...o, align: 'right' });
      d.text(L.price.toUpperCase(), col.price, y + 17, { ...o, align: 'right' });
      if (!inv.reverseCharge) d.text(L.vat.toUpperCase(), col.vat, y + 17, { ...o, align: 'right' });
      d.text(L.amount.toUpperCase(), col.amt, y + 17, { ...o, align: 'right' });
      y += 38;
    };
    head();
    let pageNo = 1;
    for (const it of (inv.items || []).filter((i) => i.desc || BW.num(i.price))) {
      const lines = d.wrap(it.desc || '-', col.qty - col.desc - 50, 9.5);
      const rowH = lines.length * 13 + 12;
      if (y + rowH > H - 170) { footer(pageNo++); d.addPage(); y = 50; head(); }
      lines.forEach((ln, i) => d.text(ln, col.desc, y + i * 13, { size: 9.5, color: ink }));
      const qty = BW.num(it.qty);
      d.text(String(qty).replace('.', s.docLang === 'nl' ? ',' : '.'), col.qty, y, { size: 9.5, color: grey, align: 'right' });
      d.text(money(BW.num(it.price)), col.price, y, { size: 9.5, color: grey, align: 'right' });
      if (!inv.reverseCharge) d.text(BW.num(it.vat) + '%', col.vat, y, { size: 9.5, color: grey, align: 'right' });
      d.text(money(qty * BW.num(it.price)), col.amt, y, { size: 9.5, bold: true, color: ink, align: 'right' });
      y += rowH;
      d.line(M + 12, y - 10, R - 12, y - 10, { color: '#EEEBF3' });
    }

    // totals
    if (y > H - 230) { footer(pageNo++); d.addPage(); y = 60; }
    y += 6;
    const tx = R - 210;
    const trow = (k, v) => { d.text(k, tx, y, { size: 9.5, color: grey }); d.text(v, col.amt, y, { size: 9.5, color: ink, align: 'right' }); y += 18; };
    trow(L.subtotal, money(t.lines));
    if (t.discount) trow(fill(L.discount, { p: BW.num(inv.discount) }), '- ' + money(t.discount));
    t.vat.forEach((v) => trow(fill(L.vatLine, { r: v.rate }), money(v.amount)));
    if (inv.reverseCharge) trow(L.reverse, money(0));
    const onAccent = BW.isLight(accent) ? ink : '#FFFFFF';
    d.rect(tx - 12, y - 6, R - tx + 12, 34, { fill: accent, r: 10 });
    d.text(L.total, tx, y + 15, { size: 11, bold: true, color: onAccent });
    d.text(money(t.total), col.amt, y + 15, { size: 13, bold: true, color: onAccent, align: 'right' });
    y += 56;
    const paid = BW.paymentsOf(inv).reduce((a, p) => a + BW.num(p.amount), 0), balance = BW.balanceOf(inv);
    if (!isQuote && !isCredit && paid > 0 && balance > 0) { trow(L.paid, '- ' + money(paid)); d.text(L.due2, tx, y, { size: 10.5, bold: true }); d.text(money(balance), col.amt, y, { size: 10.5, bold: true, align: 'right' }); y += 30; }

    // scan-to-pay QR code (SEPA, euro only) and pay-now link
    const canQr = !isQuote && !isCredit && s.iban && (inv.currency || s.currency) === 'EUR' && balance > 0 && BW.qr;
    const payLink = !isQuote && !isCredit && balance > 0 && inv.payLink;
    // The QR code sits on the right; the payment sentence and pay-now link wrap beside it on the left.
    let textW = R - M, qrBottom = 0;
    if (canQr || payLink) {
      if (y > H - 190) { footer(pageNo++); d.addPage(); y = 60; }
      const qs = 78;
      if (canQr) {
        try {
          BW.qr.pdf(d, BW.qr.epc({ name: s.businessName, iban: s.iban, bic: s.bic, amount: balance, text: `${title} ${inv.number}` }), R - qs, y - 8, qs);
          d.text(L.scan, R - qs / 2, y + qs + 6, { size: 7, color: grey, align: 'center' });
          textW = R - M - qs - 24; qrBottom = y + qs + 20;
        } catch (e) { /* the bank details are still printed below */ }
      }
      if (payLink) {
        d.text(L.payOnline, M, y, { size: 9.5, bold: true, color: ink });
        const shown = inv.payLink.replace(/^https?:\/\//, '').slice(0, 60);
        const w = d.text(shown, M, y + 14, { size: 9.5, color: '#2a5bd7' });
        d.line(M, y + 16, M + w, y + 16, { color: '#2a5bd7', lw: 0.5 });
        d.link(M, y + 4, w, 14, /^https?:/.test(inv.payLink) ? inv.payLink : 'https://' + inv.payLink);
        y += 34;
      }
    }

    // payment line and notes
    const say = (text, o = {}) => {
      for (const ln of d.wrap(text, y < qrBottom ? textW : R - M, o.size || 9.5, o.bold)) {
        if (y > H - 70) { footer(pageNo++); d.addPage(); y = 60; }
        d.text(ln, M, y, { size: o.size || 9.5, bold: o.bold, color: o.color || grey }); y += 14;
      }
      y += 8;
    };
    if (isCredit && inv.creditFor) say(fill(L.creditFor, { number: inv.creditForNumber || '' }), { color: ink });
    if (!isQuote && !isCredit && s.iban && balance > 0) {
      say(fill(L.pay, { total: money(balance), due: date(inv.dueDate), iban: s.iban + (s.bic ? ` (${L.bic} ${s.bic})` : ''), name: s.businessName, number: inv.number }), { color: ink });
    }
    if (isQuote && inv.validUntil) say(fill(L.validNote, { valid: date(inv.validUntil) }), { color: ink });
    if (inv.notes) say(inv.notes);
    y = Math.max(y, qrBottom);
    footer(pageNo);
    return d.blob(`${title} ${inv.number}`);
  };
})();
