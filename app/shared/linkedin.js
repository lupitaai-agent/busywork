/* LinkedIn, the honest way. LinkedIn lets other apps read almost nothing of a profile, and reading its
   pages with a script breaks its terms. But every member can download their own data (Settings →
   Data privacy → Get a copy of your data): a zip of CSV files. Busy reads that zip, in the browser,
   into the growth tools, and gives the profile back as copy-ready text with LinkedIn's limits.
   Nothing is sent anywhere. */
(function () {
  'use strict';
  const L = (BW.linkedin = {});

  // LinkedIn's length limits, in characters.
  L.LIMITS = { headline: 220, about: 2600, position: 2000, skills: 100 };
  L.HELP = 'https://www.linkedin.com/mypreferences/d/download-my-data';

  // ---------- CSV ----------
  // RFC 4180 with LinkedIn's quirks: a byte order mark, and notes above the header in Connections.csv.
  L.csv = (text) => {
    const rows = [], s = String(text || '').replace(/^﻿/, '');
    let row = [], cell = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  };
  // Records keyed by header, starting at the first row that looks like this file's header.
  L.table = (text, mustHave) => {
    const rows = L.csv(text), norm = (h) => h.trim().toLowerCase();
    const at = rows.findIndex((r) => mustHave.every((m) => r.some((h) => norm(h) === m)));
    if (at < 0) return [];
    const head = rows[at].map(norm);
    return rows.slice(at + 1).map((r) => Object.fromEntries(head.map((h, i) => [h, String(r[i] || '').trim()])));
  };
  const col = (rec, ...names) => { for (const n of names) if (rec[n]) return rec[n]; return ''; };

  // "Jan 2020" → 2020-01, "2019" → 2019, "12 Oct 2023" → 2023-10-12 (for days), else ''.
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  L.month = (v) => {
    const s = String(v || '').trim().toLowerCase();
    let m = /^([a-z]{3})[a-z]*\.? (\d{4})$/.exec(s);
    if (m && MONTHS.includes(m[1])) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}`;
    if ((m = /^(\d{4})-(\d\d)/.exec(s))) return `${m[1]}-${m[2]}`;
    if ((m = /^(\d{1,2})\/(\d{4})$/.exec(s))) return `${m[2]}-${m[1].padStart(2, '0')}`;
    if ((m = /^(\d{4})$/.exec(s))) return m[1];
    return '';
  };
  L.day = (v) => {
    const s = String(v || '').trim().toLowerCase(), m = /^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/.exec(s);
    if (m && MONTHS.includes(m[2])) return `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return /^\d{4}-\d\d-\d\d$/.test(s) ? s : '';
  };

  // ---------- the export, read ----------
  // files: { 'Profile.csv': text, … } (any folder prefix, any case). Returns what each part holds.
  L.parse = (files) => {
    const get = (name) => { const k = Object.keys(files).find((f) => f.toLowerCase().split('/').pop() === name.toLowerCase()); return k ? files[k] : ''; };
    const profile = L.table(get('Profile.csv'), ['first name'])[0] || {};
    const out = {
      profile: { name: [col(profile, 'first name'), col(profile, 'last name')].filter(Boolean).join(' '), headline: col(profile, 'headline'),
        about: col(profile, 'summary'), industry: col(profile, 'industry'), location: col(profile, 'geo location', 'location') },
      jobs: L.table(get('Positions.csv'), ['title']).map((r) => ({ type: 'job', title: col(r, 'title'), org: col(r, 'company name', 'company'), place: col(r, 'location'),
        start: L.month(col(r, 'started on', 'start date')), end: L.month(col(r, 'finished on', 'end date')), current: !col(r, 'finished on', 'end date'), bullets: bullets(col(r, 'description')) })).filter((x) => x.title),
      education: L.table(get('Education.csv'), ['school name']).map((r) => ({ type: 'education', title: [col(r, 'degree name'), col(r, 'notes') && !col(r, 'degree name') ? col(r, 'notes') : ''].filter(Boolean)[0] || col(r, 'school name'),
        org: col(r, 'school name'), start: L.month(col(r, 'start date', 'started on')), end: L.month(col(r, 'end date', 'finished on')), current: false, bullets: bullets(col(r, 'activities')) })).filter((x) => x.org),
      projects: L.table(get('Projects.csv'), ['title']).map((r) => ({ type: 'project', title: col(r, 'title'), org: '', start: L.month(col(r, 'started on')), end: L.month(col(r, 'finished on')), current: false,
        bullets: bullets([col(r, 'description'), col(r, 'url')].filter(Boolean).join('\n')) })).filter((x) => x.title),
      volunteering: L.table(get('Volunteering.csv'), ['role']).map((r) => ({ type: 'volunteer', title: col(r, 'role'), org: col(r, 'company name', 'organization'), start: L.month(col(r, 'started on')),
        end: L.month(col(r, 'finished on')), current: !col(r, 'finished on'), bullets: bullets(col(r, 'description')) })).filter((x) => x.title),
      skills: [...new Set(L.table(get('Skills.csv'), ['name']).map((r) => col(r, 'name')).filter(Boolean))],
      certificates: L.table(get('Certifications.csv'), ['name']).map((r) => ({ title: col(r, 'name'), provider: col(r, 'authority'), url: col(r, 'url'), doneAt: dayOf(col(r, 'started on')) })).filter((x) => x.title),
      languages: L.table(get('Languages.csv'), ['name']).map((r) => [col(r, 'name'), col(r, 'proficiency')].filter(Boolean).join(' (') + (col(r, 'proficiency') ? ')' : '')).filter(Boolean),
      connections: L.table(get('Connections.csv'), ['first name', 'last name']).map((r) => ({ name: [col(r, 'first name'), col(r, 'last name')].filter(Boolean).join(' '),
        org: col(r, 'company'), role: col(r, 'position'), email: col(r, 'email address'), linkedin: col(r, 'url', 'profile url'), connectedOn: L.day(col(r, 'connected on')) })).filter((x) => x.name),
    };
    out.found = ['jobs', 'education', 'projects', 'volunteering', 'skills', 'certificates', 'languages', 'connections'].some((k) => out[k].length) || !!(out.profile.headline || out.profile.about);
    return out;
  };
  // One line per point, whether LinkedIn kept the line breaks or the bullets ran into one line.
  const bullets = (s) => String(s || '').split(/\n|\s[•·▪]\s/).map((x) => x.replace(/^\s*[-–*•·▪]\s*/, '').trim()).filter(Boolean).join('\n');
  const dayOf = (v) => { const m = L.month(v); return m.length === 7 ? m + '-01' : m.length === 4 ? m + '-01-01' : ''; };

  // What is new compared with what is already in the folder, so importing twice adds nothing twice.
  L.plan = (p, have) => {
    const key = (...xs) => xs.map((x) => String(x || '').trim().toLowerCase()).join('|');
    const careerKeys = new Set((have.career || []).map((e) => key(e.type, e.title, e.org)));
    const skillKeys = new Set((have.skills || []).map((s) => key(s.name)));
    const learnKeys = new Set((have.learning || []).map((x) => key(x.title)));
    // A person is matched on the name: the company on LinkedIn is often newer than the one you noted.
    const contactKeys = new Set((have.contacts || []).map((c) => key(c.name)));
    return {
      career: p.jobs.concat(p.education, p.projects, p.volunteering).filter((e) => !careerKeys.has(key(e.type, e.title, e.org))),
      skills: p.skills.filter((n) => !skillKeys.has(key(n))),
      certificates: p.certificates.filter((c) => !learnKeys.has(key(c.title))),
      connections: p.connections.filter((c) => !contactKeys.has(key(c.name))),
    };
  };

  // ---------- the profile, back to LinkedIn ----------
  // Copy-ready sections from the person's own data, each with its limit.
  L.sections = ({ settings = {}, career = [], skills = [], wins = [] }) => {
    const G = BW.growth;
    const jobs = G.careerSort(career.filter((e) => e.type === 'job'));
    return {
      headline: settings.headline || '',
      about: settings.about || '',
      positions: jobs.map((e) => ({ id: e.id, title: e.title, org: e.org, period: G.period(e),
        text: String(e.bullets || '').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => '• ' + x.replace(/^[-•*]\s*/, '')).join('\n') })),
      skills: skills.slice().sort((a, b) => BW.num(b.level) - BW.num(a.level) || String(a.name).localeCompare(String(b.name))).map((s) => s.name),
      wins: wins.filter((w) => w.result).length,
    };
  };
  // A plain checklist, the way recruiters look at a profile. No score that pretends to be precise.
  L.checklist = (sec, settings = {}) => {
    const items = [];
    const add = (ok, text, tip) => items.push({ ok: !!ok, text, tip });
    const h = sec.headline.trim();
    add(h && h.length >= 40, 'A headline that says what you do and what you’re good at', h ? (h.length < 40 ? 'Longer than a job title: add what you’re known for or heading to.' : '') : 'Write one: role, speciality, and the result you bring.');
    add(h.length <= L.LIMITS.headline, `Headline within ${L.LIMITS.headline} characters`, h.length > L.LIMITS.headline ? `It is ${h.length}.` : '');
    const a = sec.about.trim();
    add(a.length >= 300, 'An About section of a few short paragraphs', a ? 'Add what you do, two results with numbers, and what you’re looking for.' : 'Write one, or let Ivy draft it from your wins.');
    add(a.length <= L.LIMITS.about, `About within ${L.LIMITS.about} characters`, a.length > L.LIMITS.about ? `It is ${a.length}.` : '');
    add(sec.positions.length, 'Your jobs are listed', 'Add them in the CV Builder, or import your LinkedIn data.');
    const bare = sec.positions.slice(0, 3).filter((p) => !p.text);
    add(sec.positions.length && !bare.length, 'Your recent jobs say what you achieved, not only the title', bare.length ? `No lines yet for: ${bare.map((p) => p.title).join(', ')}.` : '');
    const numbers = sec.positions.slice(0, 3).some((p) => /\d/.test(p.text));
    add(numbers, 'At least one result with a number in your recent jobs', 'Numbers stand out: hours saved, customers, sales, ratings.');
    add(sec.skills.length >= 5, 'At least five skills', `You have ${sec.skills.length} in your Skills Map.`);
    add(settings.targetRole && (h + ' ' + a).toLowerCase().includes(String(settings.targetRole).toLowerCase().split(' ')[0]), 'Your profile mentions the role you’re heading for', settings.targetRole ? `Use the words “${settings.targetRole}” in your headline or About.` : 'Set the role you’d like next in ⚙️ Your details.');
    return items;
  };

  // ---------- the import, on screen ----------
  L.importFlow = ({ onDone } = {}) => {
    const { $, esc } = BW;
    const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    const box = BW.html(`<div class="stack" style="--gap:12px">
      <p>Bring your career, skills, certificates and profile in from LinkedIn, in about ten minutes. You download your own data from LinkedIn and choose the file here. Busy reads it on this computer: nothing is sent anywhere.</p>
      <ol class="steps-list"><li>On LinkedIn, open <b>Settings → Data privacy → Get a copy of your data</b>.</li>
        <li>Pick <b>“Want something in particular?”</b> and tick Profile, Positions, Education, Skills and Certifications. Add <b>Connections</b> if you want your network in Contacts.</li>
        <li>LinkedIn emails you a link, usually within minutes. Download the zip.</li>
        <li>Choose the zip here (or the CSV files inside it).</li></ol>
      <div class="row-flex"><button type="button" class="btn" data-open-li>↗ Open LinkedIn’s download page</button>
        <label class="btn btn-primary">📦 Choose the LinkedIn zip<input type="file" accept=".zip,.csv,application/zip,text/csv" multiple hidden data-li-file></label></div>
      <div data-li-out></div></div>`);
    const m = BW.modal({ title: '💼 Import from LinkedIn', body: box, wide: true, actions: [{ label: 'Close', kind: 'ghost' }] });
    $('[data-open-li]', box).onclick = () => BW.openUrl(L.HELP);
    $('[data-li-file]', box).onchange = async (e) => {
      const out = $('[data-li-out]', box);
      out.innerHTML = '<p class="faint">⏳ Reading…</p>';
      let files = {};
      try {
        for (const f of e.target.files) {
          if (/\.zip$/i.test(f.name)) Object.assign(files, await BW.fileText.unzip(new Uint8Array(await f.arrayBuffer()), (n) => /\.csv$/i.test(n)));
          else files[f.name] = await f.text();
        }
      } catch (err) { out.innerHTML = `<p>🤔 Busy couldn’t open that file. Is it the zip LinkedIn sent? (${esc(err.message || err)})</p>`; return; }
      const p = L.parse(files);
      if (!p.found) { out.innerHTML = '<p>🤔 No LinkedIn data found in that file. Choose the zip from LinkedIn’s email, or the CSV files inside it.</p>'; return; }
      const [career, skills, learning, contacts] = await Promise.all(['career', 'skills', 'learning', 'contacts'].map((n) => BW.store.all(n)));
      const plan = L.plan(p, { career, skills, learning, contacts });
      const s = BW.settings;
      const opt = (k, on, label, n) => `<label class="row" style="cursor:pointer"><input type="checkbox" data-take="${k}" ${on ? 'checked' : ''} ${n === 0 ? 'disabled' : ''}><span class="main"><b>${label}</b>${n === 0 ? '<small class="faint">Nothing new</small>' : ''}</span></label>`;
      const nC = plan.career.length, kinds = (t) => plan.career.filter((x) => x.type === t).length;
      const parts = [kinds('job') && n(kinds('job'), 'job', 'jobs'), kinds('education') && `${kinds('education')} education`, kinds('project') && n(kinds('project'), 'project', 'projects'), kinds('volunteer') && `${kinds('volunteer')} volunteering`].filter(Boolean);
      out.innerHTML = `<h3 class="section-title"><span>✅</span>Found in your LinkedIn data</h3><div class="list">
        ${opt('career', true, `💼 Career: ${parts.join(', ') || 'nothing new'}`, nC)}
        ${opt('skills', true, `🧠 ${n(plan.skills.length, 'skill', 'skills')} for your Skills Map (you set the levels)`, plan.skills.length)}
        ${opt('certificates', true, `🎓 ${n(plan.certificates.length, 'certificate', 'certificates')}, as finished learning`, plan.certificates.length)}
        ${p.profile.headline ? opt('headline', !s.headline, `✍️ Headline: “${esc(p.profile.headline.slice(0, 90))}${p.profile.headline.length > 90 ? '…' : ''}”${s.headline ? ' (replaces yours)' : ''}`) : ''}
        ${p.profile.about ? opt('about', !s.about, `📝 Your About text (${p.profile.about.length} characters)${s.about ? ', replacing what you have' : ''}`) : ''}
        ${p.languages.length ? opt('languages', true, `🗣️ Languages: ${esc(p.languages.join(', '))}, to put on your CV`) : ''}
        ${p.connections.length ? opt('connections', false, `🤝 ${n(plan.connections.length, 'connection', 'connections')} into Contacts, without reminders`, plan.connections.length) : ''}
        </div><p class="faint" style="margin-top:8px">Importing twice adds nothing twice. You can change or delete anything afterwards.</p>
        <p style="margin-top:12px"><button type="button" class="btn btn-primary btn-big" data-li-go>Import</button></p>`;
      $('[data-li-go]', out).onclick = async () => {
        const take = (k) => { const c = $(`[data-take="${k}"]`, out); return c && c.checked && !c.disabled; };
        const done = [];
        try {
          if (take('career')) { await BW.store.putMany('career', plan.career.map((x) => Object.assign({ source: 'linkedin' }, x))); done.push(n(plan.career.length, 'career entry', 'career entries')); }
          if (take('skills')) { await BW.store.putMany('skills', plan.skills.map((name) => ({ name, level: '', target: '', source: 'linkedin' }))); done.push(n(plan.skills.length, 'skill', 'skills')); }
          if (take('certificates')) { await BW.store.putMany('learning', plan.certificates.map((c) => ({ title: c.title, kind: 'certificate', provider: c.provider, url: c.url, status: 'done', doneAt: c.doneAt, sessions: [], skillIds: [], source: 'linkedin' }))); done.push(n(plan.certificates.length, 'certificate', 'certificates')); }
          if (take('connections')) { await BW.store.putMany('contacts', plan.connections.map((c) => ({ name: c.name, org: c.org, role: c.role, email: c.email, linkedin: c.linkedin, how: 'linkedin', tags: 'linkedin', notes: c.connectedOn ? `Connected on LinkedIn on ${c.connectedOn}.` : '', log: [] }))); done.push(n(plan.connections.length, 'contact', 'contacts')); }
          const ns = Object.assign({}, s);
          if (take('headline')) ns.headline = p.profile.headline;
          if (take('about')) ns.about = p.profile.about;
          if (take('languages')) ns.languages = p.languages.join('\n');
          if (!ns.ownerName && p.profile.name) ns.ownerName = p.profile.name;
          if (!ns.city && p.profile.location) ns.city = p.profile.location;
          ns.linkedinImportedAt = BW.today();
          await BW.store.saveSettings(ns); BW.settings = await BW.store.settings();
          if (take('headline') || take('about')) done.push('your profile');
        } catch (err) { return BW.error(err); }
        m.close();
        BW.confetti();
        BW.toast(done.length ? `Imported ${done.join(', ')}.` : 'Nothing new to import.', '💼');
        if (onDone) onDone();
      };
    };
  };
})();
