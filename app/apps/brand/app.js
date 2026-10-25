/* Brand Kit: your colours, an email signature to paste, and business cards to print. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  const STYLES = [['classic', 'Classic'], ['bold', 'Bold'], ['minimal', 'Minimal']];

  BW.boot({ app: 'brand', onReady: render, onChange: (n) => { if (n === 'settings' || n === '*') render(); } });

  function render() {
    const s = BW.settings, c = s.brandColor || '#FF6B4A';
    const tints = [1, 0.75, 0.5, 0.25, 0.1].map((t) => BW.tint(c, t));
    main.innerHTML = `
      <div class="page-head"><div><h1><span class="title-emo">🎨</span> Brand Kit</h1><p class="lead">Look the same everywhere: in emails, on paper, in your pocket.</p></div></div>
      <div class="kit rise" style="--brand:${esc(c)}">
        <section class="card wide">
          <h2>✨ Your look</h2><p class="sub">These come from your business details. Every tool uses them.</p>
          <div class="brand-hero">
            <div class="logo-box">${s.logo ? `<img src="${s.logo}" alt="Your logo">` : esc(s.businessName)}</div>
            <div class="stack"><b style="font-size:1.3rem">${esc(s.businessName)}</b><small>Your colour: <code>${esc(c.toUpperCase())}</code></small>
              <button class="btn" data-edit>✏️ Change logo or colour</button></div>
          </div>
          <div class="tints">${tints.map((t, i) => `<button style="background:${t};color:${BW.isLight(t) ? '#1E1B2E' : '#fff'}" data-hex="${t}" title="Copy ${t}">${i === 0 ? 'Main ' : ''}${t.toUpperCase()}</button>`).join('')}</div>
          <p class="steps-mini">Click a colour to copy its code. Lighter shades work great as backgrounds.</p>
        </section>

        <section class="card">
          <h2>✉️ Email signature</h2><p class="sub">Every email you send becomes a tiny business card.</p>
          <form data-sig>${BW.fieldsHtml([
            { k: 'sigStyle', label: 'Style', type: 'chips', options: STYLES },
            { k: 'sigTitle', label: 'Your role', ph: 'e.g. Founder & designer' },
            { k: 'linkedin', label: 'LinkedIn link', ph: 'linkedin.com/in/you' },
            { k: 'instagram', label: 'Instagram name', ph: '@yourbusiness' },
            { k: 'sigLogoUrl', label: 'Logo web address (optional)', ph: 'https://yoursite.com/logo.png', hint: 'Email apps remove pictures stored inside a signature, so a logo needs a web address.' },
          ], Object.assign({ sigStyle: 'classic' }, s))}</form>
          <div class="sig-preview" data-sigprev></div>
          <div class="row-flex"><button class="btn btn-primary" data-copysig>📋 Copy signature</button></div>
          <p class="steps-mini"><b>Gmail:</b> ⚙️ Settings → See all settings → Signature → paste.<br><b>Outlook:</b> Settings → Mail → Compose and reply → paste.<br><b>Apple Mail:</b> Settings → Signatures → ＋ → paste.</p>
        </section>

        <section class="card">
          <h2>🪪 Business cards</h2><p class="sub">Print a sheet of ten at home, or send the PDF to a print shop.</p>
          <div class="cards-pair">
            <div class="bcard front">${s.logo ? `<img src="${s.logo}" alt="">` : `<div class="nm">${esc(s.businessName)}</div>`}</div>
            <div class="bcard back"><b>${esc(s.ownerName || s.businessName)}</b><span class="role">${esc(s.sigTitle || s.businessName)}</span>
              ${[s.phone, s.email, s.website, [s.address, s.city].filter(Boolean).join(', ')].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('')}
              ${s.website && BW.qr ? `<div class="card-qr">${BW.qr.svg(/^https?:/.test(s.website) ? s.website : 'https://' + s.website, 2)}</div>` : ''}</div>
          </div>
          <div class="row-flex" style="justify-content:center"><button class="btn btn-primary" data-cards>🖨️ Get the print sheet (PDF)</button></div>
          ${s.website ? '' : '<p class="steps-mini" style="text-align:center">💡 Add your website in Business details and the back gets a QR code people can scan.</p>'}
          <p class="steps-mini" style="text-align:center">Front and back each get their own page. Print double-sided on thick paper, then cut along the marks.</p>
        </section>
      </div>`;

    $('[data-edit]', main).onclick = BW.openSettings;
    $$('[data-hex]', main).forEach((b) => b.onclick = () => copyPlain(b.dataset.hex));
    const form = $('[data-sig]', main);
    BW.bindChips(form);
    const update = () => { $('[data-sigprev]', main).innerHTML = signature(Object.assign({}, s, BW.readFields(form, {}))); };
    const persist = BW.debounce(async () => {
      try { await BW.store.saveSettings(Object.assign({}, BW.settings, BW.readFields(form, {}))); } catch (e) { BW.error(e); }
    }, 600);
    form.addEventListener('input', () => { update(); persist(); });
    form.addEventListener('click', (e) => { if (e.target.closest('.choice-chips button')) setTimeout(() => { update(); persist(); }); });
    update();
    $('[data-copysig]', main).onclick = () => copyRich($('[data-sigprev]', main).innerHTML);
    $('[data-cards]', main).onclick = cards;
  }

  // Email signatures need tables and inline styles: that is what every mail app understands.
  function signature(s) {
    const c = s.brandColor || '#FF6B4A', link = (u) => (/^https?:\/\//.test(u) ? u : 'https://' + u);
    const name = esc(s.ownerName || s.businessName), role = esc(s.sigTitle || ''), biz = esc(s.businessName);
    const bits = [
      s.phone && `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}" style="color:#55516B;text-decoration:none">${esc(s.phone)}</a>`,
      s.email && `<a href="mailto:${esc(s.email)}" style="color:#55516B;text-decoration:none">${esc(s.email)}</a>`,
      s.website && `<a href="${esc(link(s.website))}" style="color:${esc(c)};text-decoration:none;font-weight:bold">${esc(s.website.replace(/^https?:\/\//, ''))}</a>`,
    ].filter(Boolean);
    const social = [
      s.linkedin && `<a href="${esc(link(s.linkedin))}" style="color:${esc(c)};text-decoration:none">LinkedIn</a>`,
      s.instagram && `<a href="https://instagram.com/${esc(s.instagram.replace(/^@/, ''))}" style="color:${esc(c)};text-decoration:none">Instagram</a>`,
    ].filter(Boolean);
    const logo = s.sigLogoUrl ? `<img src="${esc(s.sigLogoUrl)}" alt="${biz}" style="max-width:110px;max-height:60px;display:block">` : '';
    const font = 'font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#1E1B2E';
    if (s.sigStyle === 'minimal') {
      return `<table cellpadding="0" cellspacing="0" style="${font}"><tr><td><b>${name}</b>${role ? ` · ${role}` : ''} · ${biz}<br>${bits.join(' · ')}${social.length ? '<br>' + social.join(' · ') : ''}</td></tr></table>`;
    }
    if (s.sigStyle === 'bold') {
      return `<table cellpadding="0" cellspacing="0" style="${font}"><tr><td style="background:${esc(c)};padding:12px 16px;border-radius:10px">
        <span style="font-size:17px;font-weight:bold;color:${BW.isLight(c) ? '#1E1B2E' : '#FFFFFF'}">${name}</span><br><span style="color:${BW.isLight(c) ? '#1E1B2E' : '#FFFFFF'}">${role ? role + ' · ' : ''}${biz}</span></td></tr>
        <tr><td style="padding-top:8px">${bits.join(' &nbsp;|&nbsp; ')}${social.length ? '<br>' + social.join(' &nbsp;|&nbsp; ') : ''}</td></tr></table>`;
    }
    return `<table cellpadding="0" cellspacing="0" style="${font}"><tr>
      ${logo ? `<td style="padding-right:14px;vertical-align:top">${logo}</td>` : ''}
      <td style="border-left:3px solid ${esc(c)};padding-left:14px;vertical-align:top"><span style="font-size:16px;font-weight:bold">${name}</span><br>
      <span style="color:#55516B">${role ? role + ', ' : ''}${biz}</span><br>${bits.join('<br>')}${social.length ? '<br>' + social.join(' · ') : ''}</td></tr></table>`;
  }

  async function copyRich(html) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([$('[data-sigprev]').innerText], { type: 'text/plain' }) })]);
    } catch (e) {
      const range = document.createRange(); range.selectNodeContents($('[data-sigprev]'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); document.execCommand('copy'); sel.removeAllRanges();
    }
    BW.toast('Signature copied! Paste it into your email settings.', '✉️');
  }
  async function copyPlain(text) {
    await BW.copy(text); // the toast still shows the value if copying fails
    BW.toast(`${text.toUpperCase()} copied`, '🎨');
  }

  // Ten 85 x 55 mm cards per A4 page: fronts on page 1, backs mirrored on page 2 for double-sided printing.
  function cards() {
    const s = BW.settings, c = s.brandColor || '#FF6B4A';
    const mm = 72 / 25.4, cw = 85 * mm, ch = 55 * mm;
    const d = new BW.pdf.Doc(), W = d.W, H = d.H;
    const left = (W - 2 * cw) / 2, top = (H - 5 * ch) / 2;
    const marks = () => {
      for (let i = 0; i <= 2; i++) { const x = left + i * cw; d.line(x, top - 14, x, top - 4, { color: '#999999', lw: 0.4 }); d.line(x, H - top + 4, x, H - top + 14, { color: '#999999', lw: 0.4 }); }
      for (let j = 0; j <= 5; j++) { const y = top + j * ch; d.line(left - 14, y, left - 4, y, { color: '#999999', lw: 0.4 }); d.line(W - left + 4, y, W - left + 14, y, { color: '#999999', lw: 0.4 }); }
    };
    const each = (fn) => { for (let j = 0; j < 5; j++) for (let i = 0; i < 2; i++) fn(left + i * cw, top + j * ch, i); };
    each((x, y) => {
      d.rect(x, y + ch - 10, cw, 10, { fill: c });
      if (s.logo && s.logoW) { const k = Math.min((cw * 0.6) / s.logoW, (ch * 0.45) / s.logoH); const w = s.logoW * k, h = s.logoH * k; d.image(s.logo, s.logoW, s.logoH, x + (cw - w) / 2, y + (ch - 10 - h) / 2, w, h); }
      else d.text(s.businessName, x + cw / 2, y + ch / 2, { size: 15, bold: true, align: 'center' });
    });
    marks();
    d.addPage();
    // Backs are mirrored left-to-right so they line up with the fronts when printed double-sided.
    each((x, y, i) => {
      const bx = left + (1 - i) * cw;
      d.rect(bx, y, 7, ch, { fill: c });
      d.text(s.ownerName || s.businessName, bx + 20, y + 30, { size: 11, bold: true });
      d.text(s.sigTitle || s.businessName, bx + 20, y + 43, { size: 8, color: '#6B6880' });
      [s.phone, s.email, s.website, [s.address, s.city].filter(Boolean).join(', ')].filter(Boolean).slice(0, 4)
        .forEach((l, n) => d.text(l, bx + 20, y + 72 + n * 12, { size: 8 }));
      // A QR code to the website, so people can scan the card straight into their phone.
      if (s.website && BW.qr) { try { BW.qr.pdf(d, /^https?:/.test(s.website) ? s.website : 'https://' + s.website, bx + cw - 66, y + 46, 50); } catch (e) { /* card without code */ } }
    });
    marks();
    BW.download(d.blob(`${s.businessName} business cards`), BW.fileSafe(`${s.businessName} business cards`) + '.pdf');
    BW.toast('Your print sheet is downloading', '🖨️');
  }
})();
