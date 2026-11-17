/* Busy Rentals: the logic for people who let one home or a few. The heart is the country pack: every duty a small
   landlord has in that country, how often it comes back, whether the tenant must get a copy, and the official page
   it comes from, with the date Busy last checked it. Tools and the expert read the same packs. Busy keeps dates,
   records and templates; it never gives legal or tax advice. No DOM here, so the tests can run all of it. */
(function () {
  'use strict';
  const BW = window.BW;
  const isDate = (v) => /^\d{4}-\d\d-\d\d$/.test(String(v || ''));
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const r2 = (v) => Math.round(v * 100) / 100;
  const R = (BW.rentals = {});
  R.days = days;
  /* A typed amount of money. Like BW.num, but one kind of separator followed by exactly three digits is thousands:
     "1.250" (Dutch, German) and "1,000" (English) are 1250 and 1000, never 1.25 and 1. "12,5", "12.50" and
     "1.250,50" stay what BW.num makes of them. Every rent, deposit, payment and cost in Busy Rentals is read with it. */
  R.amount = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v == null ? '' : v).replace(/[\s€$£]/g, '');
    const m = /^(-?)([1-9]\d{0,2})([.,])(\d{3}(?:\3\d{3})*)$/.exec(s);
    return m ? Number(m[1] + m[2] + m[4].split(m[3]).join('')) : BW.num(s);
  };
  const num = (v) => R.amount(v);

  /* ---------- the country packs ----------
     duty: { id, what, emoji, per: 'home' | 'tenancy', every: months (a check that comes back) or 0 with start: true
     (once at each new tenancy), handOver: days to give the tenant a copy (0 = before they move in), source, note,
     optional: true when it only applies to some homes (or not yet: the landlord ticks it), changing: true when the rule is being changed; due: 'YYYY-MM-DD'
     for a one-off deadline (done once it is recorded). Yearly dates for the landlord ('year') are { md: 'MM-DD',
     what, source }. 'know': rules worth knowing that carry no date of their own, each with its source. deposit.capWhat
     says the cap in words and which rent it is worked out from; rentWhat, when set, is the hint at the rent field.
     Rules marked changing must be checked again before each release. */
  R.PACKS = {
    england: {
      name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', currency: 'GBP', checked: '2026-11-16',
      duties: [
        { id: 'gas', emoji: '🔥', what: 'Gas safety check', per: 'home', every: 12, handOver: 28, source: 'https://www.hse.gov.uk/gas/landlords/gassaferecord.htm', note: 'By a Gas Safe engineer. A copy to the tenant within 28 days, and to a new tenant before they move in. Keep records for 2 years.' },
        { id: 'eicr', emoji: '⚡', what: 'Electrical safety check (EICR)', per: 'home', every: 60, handOver: 28, source: 'https://www.gov.uk/government/publications/electrical-safety-standards-in-the-private-rented-sector-guidance-for-landlords-tenants-and-local-authorities', note: 'At least every 5 years. A copy to the tenant within 28 days, and to a new tenant before they move in.' },
        { id: 'epc', emoji: '🏷️', what: 'Energy certificate (EPC)', per: 'home', every: 120, handOver: 0, source: 'https://www.gov.uk/guidance/domestic-private-rented-property-minimum-energy-efficiency-standard-landlord-guidance', note: 'Valid 10 years, minimum band E. Band C by 2030 is an aim, not yet a rule (changing).' },
        { id: 'alarms', emoji: '🚨', what: 'Smoke and carbon monoxide alarms tested', per: 'tenancy', start: true, source: 'https://www.gov.uk/government/publications/smoke-and-carbon-monoxide-alarms-explanatory-booklet-for-landlords', note: 'A smoke alarm on every storey with living space; a carbon monoxide alarm in every room with a fixed combustion appliance (not a gas cooker). Checked on the first day of each tenancy.' },
        { id: 'righttorent', emoji: '🪪', what: 'Right to Rent checks', per: 'tenancy', start: true, source: 'https://www.gov.uk/check-tenant-right-to-rent-documents', note: 'Every adult who will live there, before the tenancy starts.' },
        { id: 'terms', emoji: '📝', what: 'Written terms and the information sheet for tenants', per: 'tenancy', start: true, handOver: 0, source: 'https://www.gov.uk/assured-tenancy-agreements-a-guide-for-landlords/written-information-you-need-to-give-to-your-tenant', note: 'Since 1 May 2026 every tenancy is periodic. Check the current required information on gov.uk.' },
        { id: 'licence', emoji: '📜', what: 'Property licence, if your council requires one', per: 'home', every: 60, optional: true, source: 'https://www.gov.uk/house-in-multiple-occupation-licence', note: 'Mandatory for larger shared homes; some councils license all rented homes. Usually 5 years.' },
        { id: 'register', emoji: '🗂️', what: 'Register on the private rented sector database', per: 'home', every: 12, optional: true, changing: true, source: 'https://www.gov.uk/guidance/register-your-rental-property-service-guidance-for-landlords', note: 'Opens region by region from 15 December 2026 (the West Midlands first), with 3 months to register in each region; every landlord by 15 November 2027. £65 a home a year. Check gov.uk for your region, and tick this once it has opened there.' },
      ],
      year: [{ md: '01-31', what: 'Self Assessment: online return and payment', source: 'https://www.gov.uk/self-assessment-tax-returns/deadlines' },
        { md: '07-31', what: 'Self Assessment: second payment on account', source: 'https://www.gov.uk/understand-self-assessment-bill/payments-on-account' },
        { md: '10-05', what: 'Tell HMRC if you need to file for the first time', source: 'https://www.gov.uk/register-for-self-assessment' },
        { md: '08-07', what: 'Making Tax Digital: quarterly update (if it applies to you)', source: 'https://www.gov.uk/government/collections/making-tax-digital-for-income-tax', mtd: true },
        { md: '11-07', what: 'Making Tax Digital: quarterly update (if it applies to you)', source: 'https://www.gov.uk/government/collections/making-tax-digital-for-income-tax', mtd: true },
        { md: '02-07', what: 'Making Tax Digital: quarterly update (if it applies to you)', source: 'https://www.gov.uk/government/collections/making-tax-digital-for-income-tax', mtd: true },
        { md: '05-07', what: 'Making Tax Digital: quarterly update (if it applies to you)', source: 'https://www.gov.uk/government/collections/making-tax-digital-for-income-tax', mtd: true }],
      deposit: { capWeeks: 5, capWeeksHigh: 6, highRentYear: 50000, capWhat: 'At most 5 weeks’ rent, or 6 weeks when the rent is £50,000 a year or more.', protectDays: 30, protectWhat: 'Protect it in a government-approved scheme and give the prescribed information', returnDays: 10, returnWhat: 'Return within 10 days of agreeing the deductions', source: 'https://www.gov.uk/tenancy-deposit-protection' },
      rentReview: { what: 'Once a year at most, on the official form, with at least two months’ notice. The tenant can challenge it at the tribunal.', monthsBetween: 12, noticeMonths: 2, source: 'https://www.gov.uk/guidance/renting-out-your-property-guidance-for-landlords-and-letting-agents/rent-increases' },
      tax: { what: 'Self Assessment, the property pages', due: '01-31', source: 'https://www.gov.uk/renting-out-a-property/paying-tax' },
      know: [{ what: 'Right to Rent: a tenant with time-limited permission to stay needs a follow-up check before it ends.', source: 'https://www.gov.uk/check-tenant-right-to-rent-documents' },
        { what: 'Legionella: assess the risk of the water system and review it when something changes. The law sets no fixed rhythm.', source: 'https://www.hse.gov.uk/legionnaires/legionella-landlords-responsibilities.htm' },
        { what: 'Coming, not yet in force for private renting: a landlord ombudsman, the Decent Homes Standard and Awaab’s Law.', source: 'https://www.gov.uk/guidance/renters-rights-act-an-overview-for-landlords', changing: true }],
    },
    nl: {
      name: 'Nederland', flag: '🇳🇱', currency: 'EUR', checked: '2026-11-16',
      duties: [
        { id: 'label', emoji: '🏷️', what: 'Energy label', per: 'home', every: 120, handOver: 0, source: 'https://www.rvo.nl/onderwerpen/energielabel-woningen', note: 'Valid 10 years. Shown in the advert and given at letting; from 29 May 2026 also on renewing or extending a lease.' },
        { id: 'points', emoji: '🧮', what: 'Points check (woningwaarderingsstelsel)', per: 'home', start: true, source: 'https://www.huurcommissie.nl/huurcommissie-helpt/beleidsboeken_html', note: 'The points set the segment and the highest rent: social up to 143 points, middle rent 144 to 186, free sector from 187.' },
        { id: 'information', emoji: '📝', what: 'Written information for the tenant (Good Landlordship Act)', per: 'tenancy', start: true, handOver: 0, source: 'https://www.rijksoverheid.nl/vraag-en-antwoord/woning-verhuren/regels-voor-verhuurders-en-verhuurbemiddelaars', note: 'At signing: use of the home, the deposit and its return, service costs, contact details and the municipal reporting point.' },
        { id: 'alarms', emoji: '🚨', what: 'Smoke alarms on every storey', per: 'tenancy', start: true, source: 'https://www.rijksoverheid.nl/themas/bouwen-en-wonen/gezond-en-veilig-wonen/vraag-en-antwoord/gezonde-en-veilige-leefomgeving/hoeveel-rookmelders-moet-ik-in-mijn-huis-hebben', note: 'On every storey with a living room, bedroom or kitchen; the landlord makes sure they are there.' },
        { id: 'service', emoji: '📊', what: 'Yearly service-cost statement', per: 'tenancy', md: '06-30', handOver: 0, optional: true, source: 'https://www.volkshuisvestingnederland.nl/onderwerpen/huren-en-wonen/servicekosten', note: 'By 30 June, for the year before. A new service-cost law applies to leases signed from 1 January 2027 (changing).' },
        { id: 'permit', emoji: '📜', what: 'Letting permit, if your municipality requires one', per: 'home', start: true, optional: true, source: 'https://www.rijksoverheid.nl/vraag-en-antwoord/woning-verhuren/regels-voor-verhuurders-en-verhuurbemiddelaars', note: 'Some cities also require a permit to let a home within 4 years of buying it.' },
      ],
      year: [{ md: '05-01', what: 'Tax return (the home is in box 3)', source: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/belastingaangifte/content/kan-ik-nog-uitstel-aanvragen-belastingaangifte' },
        { md: '01-01', what: 'New yearly limits for middle and free-sector rent increases', source: 'https://www.rijksoverheid.nl/themas/bouwen-en-wonen/woning-huren/vraag-en-antwoord/woning-huren/welke-regels-gelden-er-voor-een-huurverhoging' },
        { md: '07-01', what: 'New yearly limit for social rent increases', source: 'https://www.rijksoverheid.nl/themas/bouwen-en-wonen/woning-huren/vraag-en-antwoord/woning-huren/welke-regels-gelden-er-voor-een-huurverhoging' }],
      rentWhat: 'The bare rent, without service costs: the deposit cap is worked out from it.',
      deposit: { capMonths: 2, capWhat: 'At most 2 months’ bare rent, without service costs.', returnDays: 14, returnDaysDeducting: 30, returnWhat: 'Return within 14 days, or 30 days when deducting, with a written specification', source: 'https://www.rijksoverheid.nl/vraag-en-antwoord/woning-verhuren/regels-voor-verhuurders-en-verhuurbemiddelaars' },
      rentReview: { what: 'Once every 12 months, within the yearly limit for the home’s segment (2026: social 4.1% from 1 July, middle rent 6.1%, free sector 4.4%). For social rent the written proposal reaches the tenant at least two months ahead.', monthsBetween: 12, noticeMonths: 2, source: 'https://www.rijksoverheid.nl/actueel/nieuws/2025/12/15/maximale-huurverhoging-2026-in-sociale-sector-41-middenhuur-61-en-vrije-sector-44' },
      tax: { what: 'Tax return, box 3 (the home’s value on 1 January)', due: '05-01', source: 'https://www.belastingdienst.nl/wps/wcm/connect/nl/belastingaangifte/content/kan-ik-nog-uitstel-aanvragen-belastingaangifte' },
      know: [{ what: 'A new lease is permanent unless one of the set exceptions applies; a temporary lease runs at most 2 years.', source: 'https://www.rijksoverheid.nl/themas/bouwen-en-wonen/woning-huren/vraag-en-antwoord/woning-verhuren/verschillende-soorten-huurcontracten-voor-een-woning', changing: true },
        { what: 'The energy label also counts in the points, so it affects the highest rent.', source: 'https://www.huurcommissie.nl/huurcommissie-helpt/beleidsboeken_html' }],
    },
    de: {
      name: 'Deutschland', flag: '🇩🇪', currency: 'EUR', checked: '2026-11-16',
      duties: [
        { id: 'energy', emoji: '🏷️', what: 'Energy certificate (Energieausweis)', per: 'home', every: 120, handOver: 0, source: 'https://www.gesetze-im-internet.de/geg/__80.html', note: 'Shown at the viewing, a copy for the new tenant, the key figures in the advert. Valid 10 years.' },
        { id: 'alarms', emoji: '🚨', what: 'Smoke alarm check', per: 'home', every: 12, source: 'https://www.gesetze-im-internet.de/', note: 'Required by every state’s building law; who services them, and how often, depends on the state. Usually yearly.' },
        { id: 'sweep', emoji: '🧹', what: 'Chimney sweep, as notified', per: 'home', every: 12, optional: true, source: 'https://www.gesetze-im-internet.de/schfhwg/__14a.html', note: 'Dates follow the official notice (Feuerstättenbescheid).' },
        { id: 'confirm', emoji: '📝', what: 'Move-in confirmation for the tenant (Wohnungsgeberbestätigung)', per: 'tenancy', start: true, handOver: 14, source: 'https://www.gesetze-im-internet.de/bmg/__19.html', note: 'The tenant needs it to register within 2 weeks.' },
        { id: 'handover', emoji: '🔑', what: 'Handover record (Übergabeprotokoll)', per: 'tenancy', start: true, source: 'https://www.gesetze-im-internet.de/bgb/__535.html', note: 'Not required by law; the key evidence when the tenancy ends.' },
        { id: 'heatmeters', emoji: '🌡️', what: 'Heat and hot-water meters that can be read remotely', per: 'home', due: '2026-12-31', optional: true, source: 'https://www.gesetze-im-internet.de/heizkostenv/__5.html', note: 'Where heating or hot water is shared and billed by use: meters fitted before 1 December 2021 that cannot be read remotely are retrofitted or replaced by 31 December 2026, unless that is technically impossible or unreasonably costly. Once they can be read remotely, tenants get a consumption report every month.' },
        { id: 'statement', emoji: '📊', what: 'Service-charge statement (Betriebskostenabrechnung)', per: 'tenancy', md: '12-31', handOver: 0, source: 'https://www.gesetze-im-internet.de/bgb/__556.html', note: 'Within 12 months of the end of the billing period (for a calendar year: by 31 December of the next year). Late means no back-payment. Heating split by use, and the CO2 cost split.' },
      ],
      year: [{ md: '07-31', what: 'Tax return with the rental annex (Anlage V) per home', source: 'https://www.gesetze-im-internet.de/ao_1977/__149.html' },
        { md: '02-15', what: 'Property tax (Grundsteuer), quarterly', source: 'https://www.gesetze-im-internet.de/grstg_1973/__28.html' },
        { md: '05-15', what: 'Property tax (Grundsteuer), quarterly', source: 'https://www.gesetze-im-internet.de/grstg_1973/__28.html' },
        { md: '08-15', what: 'Property tax (Grundsteuer), quarterly', source: 'https://www.gesetze-im-internet.de/grstg_1973/__28.html' },
        { md: '11-15', what: 'Property tax (Grundsteuer), quarterly', source: 'https://www.gesetze-im-internet.de/grstg_1973/__28.html' }],
      rentWhat: 'The rent without the service-charge advance: the deposit cap is worked out from it.',
      deposit: { capMonths: 3, capWhat: 'At most 3 months’ rent without the service-charge advance. The tenant may pay it in three parts.', separate: true, returnWhat: 'No fixed deadline in the law; courts accept a few months, and part may be kept back for an open service-charge statement', source: 'https://www.gesetze-im-internet.de/bgb/__551.html' },
      rentReview: { what: 'To the local comparison rent at the earliest 15 months after the last change, at most 20% in 3 years (15% in some areas). Or an index rent once a year, or agreed steps.', monthsBetween: 15, noticeMonths: 3, source: 'https://www.gesetze-im-internet.de/bgb/__558.html', changing: true },
      tax: { what: 'Income tax return with Anlage V', due: '07-31', source: 'https://www.gesetze-im-internet.de/ao_1977/__149.html' },
      know: [{ what: 'Rent cap at a new letting (Mietpreisbremse): in designated areas, at most 10% above the local comparison rent.', source: 'https://www.gesetze-im-internet.de/bgb/__556d.html' },
        { what: 'Drinking water: large hot-water systems in rented buildings with showers are tested for Legionella every 3 years.', source: 'https://www.gesetze-im-internet.de/trinkwv_2023/' },
        { what: 'Property tax can also be paid once a year on 1 July, if you ask for that by 30 September of the year before.', source: 'https://www.gesetze-im-internet.de/grstg_1973/__28.html' },
        { what: 'A reform of rent law (index rents, furnished and short lets) is before parliament.', source: 'https://www.bmjv.de/SharedDocs/Artikel/DE/Aktuelles/2026/0208_miete_II.html', changing: true }],
    },
  };
  R.pack = (code) => R.PACKS[code] || null;
  const COUNTRY_WORDS = [['england', /england|united kingdom|\buk\b|britain/i], ['nl', /nederland|netherlands|holland/i], ['de', /deutschland|germany/i]];
  // Which pack a home follows: its own country, else the landlord's, else the language. A country that is named
  // but has no pack ("Another country", Spain) gets none: it never falls back to the language's country.
  R.countryOf = (home, s, lang) => {
    for (const v of [home && home.country, s && s.country]) {
      if (!v) continue;
      if (R.PACKS[v]) return v;
      const hit = COUNTRY_WORDS.find(([, rx]) => rx.test(String(v)));
      return hit ? hit[0] : '';
    }
    return { nl: 'nl', de: 'de', en: 'england' }[lang] || '';
  };

  // ---------- tenancies ----------
  R.live = (tenancies, today) => tenancies.filter((t) => !t.endedAt || t.endedAt >= today);
  R.current = (home, tenancies, today) => R.live(tenancies.filter((t) => t.homeId === home.id), today).sort((a, b) => String(b.start).localeCompare(String(a.start)))[0] || null;

  // ---------- duties: what is due for one home ----------
  /* For each duty that applies to a home, the next date and its state. checks: records { homeId, tenancyId, duty, last,
     next, handedOverAt, handedOverTo }. A duty done every N months is due N months after it was last done (a booked
     next date wins); one done at each new tenancy is due on the tenancy's start; a yearly statement on its date in the
     year after the last one (or after the tenancy's first year); a one-off deadline on its date, and done once
     recorded. States: 'overdue', 'soon' (within 60 days), 'ok', 'unknown' (never recorded), 'done' (done for this
     tenancy). */
  // Does a recorded check count for this tenancy? One recorded for a tenancy counts for that tenancy only. One
  // without: a duty of the home itself (a permit) stays done; anything else from 60 days before the start.
  const forTenancy = (d, c, t, slack) => isDate(c.last) && (c.tenancyId ? c.tenancyId === t.id : d.per === 'home' || !isDate(t.start) || c.last >= BW.addDays(t.start, -slack));
  R.dutiesFor = (home, code, tenancies, checks, today) => {
    const pack = R.pack(code);
    if (!pack) return [];
    const t = R.current(home, tenancies, today);
    const out = [];
    for (const d of pack.duties) {
      if (d.optional && !(home.duties || []).includes(d.id)) continue;
      const mine = checks.filter((c) => c.homeId === home.id && c.duty === d.id).sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')));
      let last = mine[0] || null, date = '', state = 'unknown';
      if (d.due) {
        if (last && isDate(last.last)) { out.push({ duty: d, check: last, date: last.last, state: 'done', left: 0, handOver: R.handOverState(d, last, today, t) }); continue; }
        date = d.due;
      } else if (d.every) {
        date = last && isDate(last.next) ? last.next : last && isDate(last.last) ? BW.addPeriod(last.last, 'month', d.every) : '';
      } else if (d.start) {
        if (!t) continue;
        last = mine.find((c) => forTenancy(d, c, t, 60)) || null;
        if (last) { out.push({ duty: d, check: last, date: last.last, state: 'done', left: 0, handOver: R.handOverState(d, last, today, t) }); continue; }
        date = isDate(t.start) ? t.start : today;
      } else if (d.md) {
        // A yearly statement: the one for a year is due on this date in the year after. So the next one is due in the
        // year after the last one went out, or, when none has, in the year after the tenancy started. It can be overdue.
        if (!t) continue;
        last = mine.find((c) => forTenancy(d, c, t, 0)) || null;
        const base = last ? last.last : isDate(t.start) ? t.start : '';
        if (base) date = `${Number(base.slice(0, 4)) + 1}-${d.md}`;
        else { const y = Number(today.slice(0, 4)); date = `${y}-${d.md}` >= today ? `${y}-${d.md}` : `${y + 1}-${d.md}`; }
      }
      if (date) { const left = days(today, date); state = left < 0 ? 'overdue' : left <= 60 ? 'soon' : 'ok'; }
      out.push({ duty: d, check: last, date, state, left: date ? days(today, date) : null, handOver: last ? R.handOverState(d, last, today, t) : null });
    }
    const order = { overdue: 0, unknown: 1, soon: 2, ok: 3, done: 4 };
    return out.sort((a, b) => order[a.state] - order[b.state] || String(a.date).localeCompare(String(b.date)));
  };
  /* A copy the tenant must get (a gas certificate within 28 days): 'given' with its date, 'owed' with the date to give
     it by, or null. t is the tenancy the copy is for: null (nobody lives there) means no copy is owed; left out, the
     copy is judged without looking at who lives there, as before. A copy counts for the tenant it was given to
     (handedOverTo); a record without that counts when the check was recorded for this tenancy or the copy was given
     on or after its start, so a copy an earlier tenant got is still owed to the new one. A check from before the
     tenancy is owed by the start (for a duty done at the start: the start plus its days). */
  R.handOverState = (d, check, today, t) => {
    if (d.handOver == null || !check || !isDate(check.last) || t === null) return null;
    const start = t && isDate(t.start) ? t.start : '';
    const theirs = !t || (check.handedOverTo ? check.handedOverTo === t.id : check.tenancyId === t.id || !start || String(check.handedOverAt) >= start);
    if (isDate(check.handedOverAt) && check.handedOverAt >= check.last && theirs) return { state: 'given', date: check.handedOverAt };
    const by = !start || check.last >= start ? BW.addDays(check.last, d.handOver || 0) : d.start ? BW.addDays(start, d.handOver || 0) : start;
    return { state: 'owed', by, left: days(today, by) };
  };

  // ---------- the rent, and how it changed ----------
  /* A tenancy keeps its rent in `rent` (per `rentPer`: month or week) and, once the rent has changed, its history in
     `rents`: [{ from: 'YYYY-MM-DD', rent }], oldest first. Empty or missing means the rent was always `rent`. The
     latest entry is the current figure and always reads `rent` itself, so a correction typed in the tenancy form
     shows at once; earlier entries are what was charged before. */
  const rentsOf = (t) => (Array.isArray(t && t.rents) ? t.rents : []).filter((x) => x && isDate(x.from)).slice().sort((a, b) => a.from.localeCompare(b.from));
  // The rent (per week or per month, as agreed) that applied on a date. Without a date: the latest figure.
  R.rentAt = (t, date) => {
    const h = rentsOf(t);
    if (!h.length || !isDate(date)) return num(t.rent);
    let i = 0;
    while (i + 1 < h.length && h[i + 1].from <= date) i++;
    return i === h.length - 1 ? num(t.rent) : num(h[i].rent);
  };
  /* A new rent from a date. Returns a new tenancy object, not saved: the history starts with the old rent from the
     tenancy's start, the new entry is added in date order (the same date again replaces it), and `rent` and
     `lastRentChange` follow the latest entry. An amount that is not above zero or a date that is none changes nothing. */
  R.changeRent = (t, rent, from) => {
    const out = Object.assign({}, t), r = r2(num(rent));
    if (!(r > 0) || !isDate(from)) return out;
    const h = rentsOf(t).map((x) => ({ from: x.from, rent: num(x.rent) }));
    if (h.length) h[h.length - 1].rent = num(t.rent);
    else if (isDate(t.start) && t.start < from && num(t.rent)) h.push({ from: t.start, rent: num(t.rent) });
    const i = h.findIndex((x) => x.from === from);
    if (i >= 0) h[i].rent = r; else h.push({ from, rent: r });
    h.sort((a, b) => a.from.localeCompare(b.from));
    const last = h[h.length - 1];
    return Object.assign(out, { rents: h, rent: last.rent, lastRentChange: last.from });
  };
  // A rent change recorded by mistake: the latest entry goes and the rent is what it was before. Returns a new tenancy
  // object, not saved; a history of one entry (the rent since the start) is no history, so it is emptied.
  R.dropRent = (t) => {
    const h = rentsOf(t).map((x) => ({ from: x.from, rent: num(x.rent) }));
    if (h.length < 2) return Object.assign({}, t);
    h.pop();
    const last = h[h.length - 1];
    return Object.assign({}, t, { rents: h.length > 1 ? h : [], rent: last.rent, lastRentChange: h.length > 1 ? last.from : '' });
  };
  // The tenancy form's "Rent" is a correction of the current figure: the latest entry of the history follows it.
  // Changes the record it is given (the form's own copy, just before it is saved).
  R.syncRent = (t) => {
    const h = Array.isArray(t.rents) ? t.rents.filter((x) => x && isDate(x.from)).sort((a, b) => a.from.localeCompare(b.from)) : [];
    if (h.length) { h[h.length - 1].rent = num(t.rent); t.rents = h; }
    return t;
  };
  const PER = { month: 1, week: 52 / 12, year: 1 / 12 };
  const perOf = (t) => PER[t.rentPer || 'month'] || 1;
  // The rent as a monthly figure, for totals and the deposit cap: the latest rent, or with a date the rent of that day.
  const monthly = (t, date) => (isDate(date) ? R.rentAt(t, date) : num(t.rent)) * perOf(t);
  R.monthlyRent = monthly;
  // The rent as the tenant pays it, for the screens and letters: { amount, per: 'week' | 'month' } on a date.
  R.rentNow = (t, date) => (t.rentPer === 'week' ? { amount: r2(R.rentAt(t, date)), per: 'week' } : { amount: r2(monthly(t, date) || monthly(t)), per: 'month' });
  // The pay day of a monthly rent: a whole day from 1 to 31, else the 1st. In a shorter month it is the last day.
  R.payDay = (t) => { const n = Number(String(t && t.payDay != null ? t.payDay : '').trim()); return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 1; };
  // The money a home's amounts are in: its country's, else the landlord's own setting.
  R.currencyOf = (code, s) => (R.pack(code) || {}).currency || (s && s.currency) || undefined;

  // ---------- deposits ----------
  /* The most a deposit may be, from the rent: England 5 weeks (6 weeks when the rent is £50,000 a year or more), the
     Netherlands 2 months of the bare rent, Germany 3 months of the rent without the service-charge advance. */
  R.depositCap = (code, t) => {
    const p = R.pack(code), m = monthly(t);
    if (!p || !m) return null;
    // the year's rent to the cent, so a rent of exactly £50,000 a year is not a fraction of a penny under it
    const d = p.deposit, weeks = d.capWeeksHigh && r2(m * 12) >= d.highRentYear ? d.capWeeksHigh : d.capWeeks;
    return Math.round((weeks ? m * 12 / 52 * weeks : m * (d.capMonths || 0)) * 100) / 100;
  };
  /* Where a deposit stands: over the cap, to protect by (England: 30 days after it was received; gone once it is
     protected, and once it has been returned), to return by (the Netherlands: 14 or 30 days after the end; England:
     10 days after the deductions are agreed). */
  R.depositState = (code, t, today) => {
    const p = R.pack(code), out = { amount: num(t.deposit), cap: R.depositCap(code, t) };
    if (!p || !out.amount) return out;
    out.over = out.cap != null && out.amount > out.cap + 0.005;
    const got = isDate(t.depositReceived) ? t.depositReceived : t.start;
    if (p.deposit.protectDays && isDate(got) && !isDate(t.depositProtectedAt) && !isDate(t.depositReturnedAt)) { out.protectBy = BW.addDays(got, p.deposit.protectDays); out.protectLeft = days(today, out.protectBy); }
    if (isDate(t.endedAt) && !isDate(t.depositReturnedAt)) {
      if (p.deposit.returnDays && code === 'nl') { out.returnBy = BW.addDays(t.endedAt, t.deductions ? p.deposit.returnDaysDeducting : p.deposit.returnDays); out.returnLeft = days(today, out.returnBy); }
      out.returnWhat = p.deposit.returnWhat;
    }
    return out;
  };

  // ---------- rent ----------
  /* Everything that falls due, oldest first: { date, month, amount }. A monthly rent: one amount a month on the pay
     day (the month's last day when it has no such day; never before the tenancy starts), from the start month up to
     and including `toMonth` or the month the tenancy ended. A weekly rent: one amount on every pay day, the weekday of
     the start date, from the start to the end of `toMonth` or the day the tenancy ended. Each is the rent that
     applied on its own date. */
  const lastDay = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const charges = (t, toMonth) => {
    const out = [];
    if (!isDate(t.start) || !monthly(t)) return out;
    const end = isDate(t.endedAt) ? t.endedAt : '9999-12-31';
    if (t.rentPer === 'week') {
      for (let d = t.start, guard = 0; d.slice(0, 7) <= toMonth && d <= end && guard < 5300; d = BW.addDays(d, 7), guard++) out.push({ date: d, month: d.slice(0, 7), amount: r2(R.rentAt(t, d)) });
      return out;
    }
    const day = R.payDay(t);
    for (let m = t.start.slice(0, 7), guard = 0; m <= toMonth && m <= end.slice(0, 7) && guard < 1200; guard++) {
      const on = `${m}-${String(Math.min(day, lastDay(m))).padStart(2, '0')}`, date = on < t.start ? t.start : on;
      out.push({ date, month: m, amount: r2(monthly(t, date)) });
      m = BW.addPeriod(`${m}-01`, 'month', 1).slice(0, 7);
    }
    return out;
  };
  // The rent due per month up to and including `toMonth`: { month, due, amount }. `due` is the pay day; for a weekly
  // rent the first pay day in the month, with every pay day of the month in `dues` and their sum as the amount.
  R.rentDue = (t, toMonth) => {
    const out = [];
    for (const c of charges(t, toMonth)) {
      const m = out[out.length - 1];
      if (m && m.month === c.month) { m.amount = r2(m.amount + c.amount); m.dues.push(c.date); }
      else out.push({ month: c.month, due: c.date, amount: c.amount, dues: [c.date] });
    }
    return out;
  };
  /* A running balance. Everything the tenant paid goes to the oldest amount first, whatever month a payment was noted
     for, so two months paid at once, a payment ahead and a late catch-up all come out right. Each month: due, amount,
     paid (what the payments cover of it), open, late (part of it is still open after its pay day) and received (the
     payments noted for that month, as typed). Then: open (everything open after its pay day), monthsLate (months with
     something late), weeksLate (weekly rent only: the weeks still open), per ('week' or 'month'), paid (all payments)
     and credit (paid ahead of everything due up to the end of this month). */
  R.rentStatus = (t, payments, today) => {
    const cents = (v) => Math.round(num(v) * 100);
    const mine = payments.filter((p) => p.tenancyId === t.id), months = [], total = Math.max(0, mine.reduce((s, p) => s + cents(p.amount), 0));
    let left = total, open = 0, weeks = 0;
    for (const c of charges(t, today.slice(0, 7))) {
      const amount = cents(c.amount), got = Math.min(left, amount), rest = amount - got;
      left -= got;
      let m = months[months.length - 1];
      if (!m || m.month !== c.month) months.push(m = { month: c.month, due: c.date, amount: 0, paid: 0, open: 0, late: false, received: 0 });
      m.amount += amount; m.paid += got; m.open += rest;
      if (rest > 0 && c.date < today) { m.late = true; open += rest; weeks++; }
    }
    for (const m of months) {
      m.received = mine.filter((p) => (p.month || String(p.date || '').slice(0, 7)) === m.month).reduce((s, p) => s + cents(p.amount), 0) / 100;
      m.amount /= 100; m.paid /= 100; m.open /= 100;
    }
    const weekly = t.rentPer === 'week';
    return { months, open: open / 100, monthsLate: months.filter((m) => m.late).length, weeksLate: weekly ? weeks : 0, per: weekly ? 'week' : 'month', paid: total / 100, credit: left / 100 };
  };
  // "1 month late", "3 weeks late": how far behind, in the words of the rent's own rhythm.
  R.lateText = (st) => {
    const tr = (k) => (BW.t ? BW.t(k) : k), n = st.per === 'week' ? st.weeksLate : st.monthsLate;
    if (st.per === 'week') return n === 1 ? tr('1 week late') : tr(`${n} weeks late`);
    return n === 1 ? tr('1 month late') : tr(`${n} months late`);
  };

  // ---------- the rent review ----------
  // The earliest day a new rent can apply: the last change (or the start) plus the months the country asks for.
  R.rentReviewFrom = (code, t) => {
    const p = R.pack(code), base = isDate(t.lastRentChange) ? t.lastRentChange : t.start;
    return p && isDate(base) ? BW.addPeriod(base, 'month', p.rentReview.monthsBetween) : '';
  };

  // ---------- the landlord's year ----------
  // The yearly dates that are the landlord's own (tax, property tax), from today for a year.
  R.yearDates = (code, today, { mtd = false } = {}) => {
    const p = R.pack(code);
    if (!p) return [];
    const y = Number(today.slice(0, 4));
    return p.year.filter((x) => mtd || !x.mtd).map((x) => { const d = `${y}-${x.md}` >= today ? `${y}-${x.md}` : `${y + 1}-${x.md}`; return { date: d, what: x.what, source: x.source, left: days(today, d) }; })
      .sort((a, b) => a.date.localeCompare(b.date));
  };
  /* Everything with a date across all homes, for "This month" and the Dates page: duties, copies owed to tenants,
     deposits to protect or return, rent reviews that become possible, the landlord's yearly dates. */
  R.upcoming = ({ homes = [], tenancies = [], checks = [] }, s, lang, today, within = 60) => {
    const out = [], tr = (k) => (BW.t ? BW.t(k) : k);
    for (const h of homes) {
      const code = R.countryOf(h, s, lang), name = h.name || h.address || 'A home';
      for (const x of R.dutiesFor(h, code, tenancies, checks, today)) {
        if (x.date && x.state !== 'done' && x.left <= within) out.push({ date: x.date, left: x.left, emoji: x.duty.emoji, text: `${name}: ${tr(x.duty.what)}`, kind: 'duty', homeId: h.id, duty: x.duty.id });
        if (x.handOver && x.handOver.state === 'owed') out.push({ date: x.handOver.by, left: x.handOver.left, emoji: '📨', text: `${name}: ${tr(x.duty.what)}, ${tr('a copy for the tenant')}`, kind: 'handover', homeId: h.id, duty: x.duty.id });
      }
      for (const t of tenancies.filter((x) => x.homeId === h.id)) {
        const ds = R.depositState(code, t, today);
        if (ds.protectBy && ds.protectLeft <= within) out.push({ date: ds.protectBy, left: ds.protectLeft, emoji: '🛡️', text: `${name}: protect the deposit`, kind: 'deposit', homeId: h.id, tenancyId: t.id });
        if (ds.returnBy && ds.returnLeft <= within) out.push({ date: ds.returnBy, left: ds.returnLeft, emoji: '↩️', text: `${name}: return the deposit`, kind: 'deposit', homeId: h.id, tenancyId: t.id });
        const from = !t.endedAt && R.rentReviewFrom(code, t);
        if (from && days(today, from) <= within && days(today, from) >= -30) out.push({ date: from, left: days(today, from), emoji: '📈', text: `${name}: the earliest date to review the rent`, kind: 'review', homeId: h.id, tenancyId: t.id });
      }
    }
    const codes = [...new Set(homes.map((h) => R.countryOf(h, s, lang)).filter(Boolean))];
    for (const code of codes) for (const y of R.yearDates(code, today, { mtd: !!(s && s.mtd) })) if (y.left <= within) out.push({ date: y.date, left: y.left, emoji: '🧾', text: y.what, kind: 'year', source: y.source });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  };

  // ---------- check-in and check-out ----------
  /* A report of the home at the start or the end of a tenancy: each room's condition (good, fair, poor), notes and
     photos, the meter readings and the keys. At the end the two are laid side by side: a room that got worse is
     where a deduction might be discussed; one that is the same is not. Fair wear and tear is for people to judge. */
  R.ROOMS = ['Hallway', 'Living room', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bathroom', 'Toilet', 'Garden or balcony'];
  R.CONDITIONS = [['good', 'Good'], ['fair', 'Fair'], ['poor', 'Poor']];
  const RANK = { good: 3, fair: 2, poor: 1 };
  // Rooms are matched by name (capitals and spaces around it do not matter); two rooms with the same name are
  // matched in order, so the second "Bedroom" at the start is laid next to the second one at the end.
  R.compareReports = (a, b) => {
    const A = (a && a.rooms) || [], B = (b && b.rooms) || [], key = (r) => String(r.room || '').trim().toLowerCase(), used = new Set();
    const row = (x, y) => ({ room: (x || y).room, start: x, end: y, worse: !!(x && y && RANK[x.condition] && RANK[y.condition] && RANK[y.condition] < RANK[x.condition]), missing: !x || !y });
    const out = A.map((x) => { const j = B.findIndex((y, i) => !used.has(i) && key(y) === key(x)); if (j >= 0) used.add(j); return row(x, j >= 0 ? B[j] : null); });
    B.forEach((y, i) => { if (!used.has(i)) out.push(row(null, y)); });
    return out;
  };

  // ---------- letters to tenants ----------
  /* Short, friendly letters a landlord sends often. {{...}} is filled from the landlord's details, the home, the tenancy
     and today; what Busy cannot know stays in [brackets] for the person to fill in. One version per language of the
     three countries with a pack; the letter follows the home's country. Busy drafts; the landlord sends. */
  R.LETTERS = [
    { id: 'welcome', emoji: '👋', name: 'Welcome to the home', about: 'For a new tenant: who to call, when the rent is due, how to report a repair.' },
    { id: 'access', emoji: '🚪', name: 'A visit to the home', about: 'Asks for a time to visit for a check or a repair, with the reason.' },
    { id: 'repair', emoji: '🔧', name: 'About the repair', about: 'Thanks the tenant for reporting it and says what happens next and when.' },
    { id: 'copy', emoji: '📨', name: 'A copy of a certificate', about: 'Goes with a copy the tenant must get, such as the gas safety record.' },
    { id: 'deposit', emoji: '🛡️', name: 'The deposit at the end', about: 'What is returned, what is kept back and why, and when it is paid.' },
  ];
  R.LETTER_TEXT = {
    en: {
      welcome: ['Welcome to {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Welcome to your new home\n\nDear {{t.tenants}},\n\nWelcome to {{home.address}}. Here is what is useful to know.\n\n- The rent is {{t.rent}} a month, due on day {{t.payDay}} of each month.\n- For a repair, tell me as soon as you can: {{me.phone}} or {{me.email}}. In an emergency (a gas smell, a leak, no heating in winter) call straight away.\n- The meters are here: {{home.meters}}\n- [Anything else they should know: bins, the boiler, parking]\n\nI hope you will be very happy here.\n\nKind regards,\n\n{{me.name}}'],
      access: ['Visit to {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# A visit to the home\n\nDear {{t.tenants}},\n\nI would like to visit {{home.address}} on [day and date] at [time], for [the reason: the yearly gas safety check, a repair, an inspection]. It will take about [time].\n\nIf that time does not suit you, please let me know a time that does, and I will arrange it.\n\nKind regards,\n\n{{me.name}}\n{{me.phone}}'],
      repair: ['About the repair at {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# About the repair\n\nDear {{t.tenants}},\n\nThank you for letting me know about [what is wrong]. [Who] will come to look at it on [day and date], and I expect it to be fixed by [date].\n\nIf anything changes, or it gets worse in the meantime, please tell me straight away.\n\nKind regards,\n\n{{me.name}}\n{{me.phone}}'],
      copy: ['A copy for your records', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# A copy for your records\n\nDear {{t.tenants}},\n\nWith this letter you receive a copy of [the document: the gas safety record, the electrical safety report, the energy certificate] for {{home.address}}, dated [date].\n\nPlease keep it with your papers.\n\nKind regards,\n\n{{me.name}}'],
      deposit: ['Your deposit', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n[Their new address]\n\n{{today}}\n\n# Your deposit\n\nDear {{t.tenants}},\n\nThank you for living at {{home.address}}. Your deposit was {{t.deposit}}.\n\n- Returned to you: [amount]\n- Kept back: [amount], for [what, with the reason and the cost]\n\nThe amount will be paid into your account by [date]. If you do not agree with anything here, please tell me, so we can sort it out together.\n\nKind regards,\n\n{{me.name}}'],
    },
    nl: {
      welcome: ['Welkom in {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Welkom in uw nieuwe woning\n\nBeste {{t.tenants}},\n\nWelkom op het adres {{home.address}}. Dit is handig om te weten.\n\n- De huur is {{t.rent}} per maand, te betalen op de {{t.payDay}}e van elke maand.\n- Is er iets kapot? Laat het mij dan zo snel mogelijk weten: {{me.phone}} of {{me.email}}. Bij spoed (gaslucht, een lekkage, geen verwarming in de winter) belt u meteen.\n- De meters zitten hier: {{home.meters}}\n- [Wat ze verder moeten weten: afval, de ketel, parkeren]\n\nIk wens u veel woonplezier.\n\nMet vriendelijke groet,\n\n{{me.name}}'],
      access: ['Bezoek aan {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Een bezoek aan de woning\n\nBeste {{t.tenants}},\n\nGraag kom ik op [dag en datum] om [tijd] langs op {{home.address}}, voor [de reden: het jaarlijkse onderhoud van de ketel, een reparatie, een controle]. Het duurt ongeveer [tijdsduur].\n\nSchikt dat moment u niet? Laat mij dan weten wanneer het wel kan, dan regel ik het.\n\nMet vriendelijke groet,\n\n{{me.name}}\n{{me.phone}}'],
      repair: ['Over de reparatie in {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Over de reparatie\n\nBeste {{t.tenants}},\n\nHartelijk dank voor uw melding over [wat er mis is]. [Wie] komt ernaar kijken op [dag en datum], en ik verwacht dat het uiterlijk [datum] verholpen is.\n\nVerandert er iets, of wordt het in de tussentijd erger? Laat het mij dan meteen weten.\n\nMet vriendelijke groet,\n\n{{me.name}}\n{{me.phone}}'],
      copy: ['Een kopie voor uw administratie', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Een kopie voor uw administratie\n\nBeste {{t.tenants}},\n\nBij deze brief ontvangt u een kopie van [het document: het energielabel, het onderhoudsrapport] voor {{home.address}}, gedateerd [datum].\n\nBewaar de kopie bij uw papieren.\n\nMet vriendelijke groet,\n\n{{me.name}}'],
      deposit: ['Uw borg', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n[Hun nieuwe adres]\n\n{{today}}\n\n# Uw borg\n\nBeste {{t.tenants}},\n\nDank u wel voor de tijd dat u op {{home.address}} heeft gewoond. Uw borg bedroeg {{t.deposit}}.\n\n- U krijgt terug: [bedrag]\n- Ingehouden: [bedrag], voor [wat, met de reden en de kosten]\n\nHet bedrag wordt uiterlijk [datum] naar uw rekening overgemaakt. Bent u het ergens niet mee eens? Laat het mij dan weten, dan lossen we het samen op.\n\nMet vriendelijke groet,\n\n{{me.name}}'],
    },
    de: {
      welcome: ['Willkommen in {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Willkommen in Ihrer neuen Wohnung\n\nGuten Tag {{t.tenants}},\n\nherzlich willkommen in der Wohnung {{home.address}}. Hier das Wichtigste auf einen Blick:\n\n- Die Miete beträgt {{t.rent}} im Monat, fällig am {{t.payDay}}. eines jeden Monats.\n- Bei einem Schaden melden Sie sich bitte so bald wie möglich: {{me.phone}} oder {{me.email}}. In einem Notfall (Gasgeruch, ein Wasserschaden, keine Heizung im Winter) rufen Sie bitte sofort an.\n- Die Zähler befinden sich hier: {{home.meters}}\n- [Was sonst noch wichtig ist: Müll, Heizung, Parken]\n\nIch wünsche Ihnen eine schöne Zeit in der Wohnung.\n\nMit freundlichen Grüßen\n\n{{me.name}}'],
      access: ['Besuch in {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Ein Besuch in der Wohnung\n\nGuten Tag {{t.tenants}},\n\nich würde gern am [Tag und Datum] um [Uhrzeit] in die Wohnung {{home.address}} kommen, für [den Grund: die Prüfung der Rauchwarnmelder, eine Reparatur, eine Besichtigung]. Es dauert etwa [Dauer].\n\nWenn Ihnen der Termin nicht passt, nennen Sie mir bitte einen anderen, dann richte ich mich danach.\n\nMit freundlichen Grüßen\n\n{{me.name}}\n{{me.phone}}'],
      repair: ['Zur Reparatur in {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Zur Reparatur\n\nGuten Tag {{t.tenants}},\n\nvielen Dank für Ihre Meldung zu [was defekt ist]. [Wer] schaut es sich am [Tag und Datum] an, und ich rechne damit, dass es bis [Datum] behoben ist.\n\nWenn sich etwas ändert oder es in der Zwischenzeit schlimmer wird, geben Sie mir bitte sofort Bescheid.\n\nMit freundlichen Grüßen\n\n{{me.name}}\n{{me.phone}}'],
      copy: ['Eine Kopie für Ihre Unterlagen', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Eine Kopie für Ihre Unterlagen\n\nGuten Tag {{t.tenants}},\n\nmit diesem Schreiben erhalten Sie eine Kopie [des Dokuments: Energieausweis, Wohnungsgeberbestätigung] für {{home.address}} vom [Datum].\n\nBitte bewahren Sie sie bei Ihren Unterlagen auf.\n\nMit freundlichen Grüßen\n\n{{me.name}}'],
      deposit: ['Ihre Kaution', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n[Neue Anschrift der Mieter]\n\n{{today}}\n\n# Ihre Kaution\n\nGuten Tag {{t.tenants}},\n\nzum Ende des Mietverhältnisses in der Wohnung {{home.address}} möchte ich mich bei Ihnen bedanken. Ihre Kaution betrug {{t.deposit}}.\n\n- Rückzahlung an Sie: [Betrag]\n- Einbehalten: [Betrag], für [was, mit Grund und Kosten]\n\nDer Betrag wird bis zum [Datum] auf Ihr Konto überwiesen. Wenn Sie mit etwas nicht einverstanden sind, sagen Sie es mir bitte, dann klären wir es gemeinsam.\n\nMit freundlichen Grüßen\n\n{{me.name}}'],
    },
    es: {
      welcome: ['Bienvenida a {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Bienvenida a su nueva casa\n\nEstimado/a {{t.tenants}}:\n\nLe doy la bienvenida a {{home.address}}. Esto es lo que conviene saber.\n\n- El alquiler es de {{t.rent}} al mes y se paga el día {{t.payDay}} de cada mes.\n- Si algo se estropea, avíseme lo antes posible: {{me.phone}} o {{me.email}}. En caso de urgencia (olor a gas, una fuga, falta de calefacción en invierno), llame enseguida.\n- Los contadores están aquí: {{home.meters}}\n- [Lo que conviene saber además: la basura, la caldera, el aparcamiento]\n\nEspero que esté muy a gusto aquí.\n\nUn cordial saludo,\n\n{{me.name}}'],
      access: ['Visita a {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Una visita a la vivienda\n\nEstimado/a {{t.tenants}}:\n\nMe gustaría visitar la vivienda de {{home.address}} el [día y fecha] a las [hora], para [el motivo: la revisión anual del gas, una reparación, una inspección]. Durará aproximadamente [tiempo].\n\nSi esa hora no le viene bien, indíqueme otra que le convenga y lo organizo.\n\nUn cordial saludo,\n\n{{me.name}}\n{{me.phone}}'],
      repair: ['Sobre la reparación en {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Sobre la reparación\n\nEstimado/a {{t.tenants}}:\n\nGracias por avisarme de [lo que no funciona]. [Quién] vendrá a verlo el [día y fecha], y espero que quede arreglado para el [fecha].\n\nSi algo cambia o empeora mientras tanto, avíseme enseguida.\n\nUn cordial saludo,\n\n{{me.name}}\n{{me.phone}}'],
      copy: ['Una copia para sus archivos', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Una copia para sus archivos\n\nEstimado/a {{t.tenants}}:\n\nCon esta carta le envío una copia de [el documento: el certificado de seguridad del gas, el informe de la instalación eléctrica, el certificado energético] de la vivienda de {{home.address}}, con fecha [fecha].\n\nPor favor, consérvela con sus documentos.\n\nUn cordial saludo,\n\n{{me.name}}'],
      deposit: ['Su fianza', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n[Su nueva dirección]\n\n{{today}}\n\n# Su fianza\n\nEstimado/a {{t.tenants}}:\n\nGracias por haber vivido en {{home.address}}. Su fianza era de {{t.deposit}}.\n\n- Se le devuelve: [importe]\n- Se retiene: [importe], por [concepto, con el motivo y el coste]\n\nEl importe se ingresará en su cuenta a más tardar el [fecha]. Si no está de acuerdo con algo, dígamelo y lo resolvemos juntos.\n\nUn cordial saludo,\n\n{{me.name}}'],
    },
    it: {
      welcome: ['Il benvenuto in {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Il benvenuto nella nuova casa\n\nGentile {{t.tenants}},\n\nle do il benvenuto in {{home.address}}. Ecco cosa è utile sapere.\n\n- L’affitto è di {{t.rent}} al mese, da pagare il giorno {{t.payDay}} di ogni mese.\n- Se qualcosa si guasta, me lo segnali appena possibile: {{me.phone}} o {{me.email}}. In caso di urgenza (odore di gas, una perdita, niente riscaldamento in inverno), mi chiami subito.\n- I contatori sono qui: {{home.meters}}\n- [Cos’altro è utile sapere: i rifiuti, la caldaia, il parcheggio]\n\nLe auguro di trovarsi molto bene qui.\n\nCordiali saluti,\n\n{{me.name}}'],
      access: ['Visita a {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Una visita all’abitazione\n\nGentile {{t.tenants}},\n\nvorrei passare in {{home.address}} il [giorno e data] alle [ora], per [il motivo: il controllo annuale del gas, una riparazione, un’ispezione]. La visita durerà circa [durata].\n\nSe l’orario non le va bene, mi indichi quando le è comodo e mi organizzo.\n\nCordiali saluti,\n\n{{me.name}}\n{{me.phone}}'],
      repair: ['La riparazione in {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# La riparazione\n\nGentile {{t.tenants}},\n\nla ringrazio per avermi segnalato [il problema]. [Chi] verrà a controllare il [giorno e data], e conto che tutto sia risolto entro il [data].\n\nSe nel frattempo qualcosa cambia o peggiora, me lo dica subito.\n\nCordiali saluti,\n\n{{me.name}}\n{{me.phone}}'],
      copy: ['Una copia per i suoi documenti', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Una copia per i suoi documenti\n\nGentile {{t.tenants}},\n\nin allegato a questa lettera trova una copia di [il documento: il certificato di sicurezza del gas, il rapporto sull’impianto elettrico, l’attestato energetico] per {{home.address}}, con data [data].\n\nLa prego di conservarla tra i suoi documenti.\n\nCordiali saluti,\n\n{{me.name}}'],
      deposit: ['Il suo deposito', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n[Il suo nuovo indirizzo]\n\n{{today}}\n\n# Il suo deposito\n\nGentile {{t.tenants}},\n\nla ringrazio per aver abitato in {{home.address}}. Il deposito cauzionale era di {{t.deposit}}.\n\n- Restituito: [importo]\n- Trattenuto: [importo], per [cosa, con il motivo e il costo]\n\nL’importo sarà versato sul suo conto entro il [data]. Se non è d’accordo su qualcosa, me lo dica e troviamo insieme una soluzione.\n\nCordiali saluti,\n\n{{me.name}}'],
    },
    'pt-br': {
      welcome: ['Boas-vindas a {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Boas-vindas à sua nova casa\n\nPrezado(a) {{t.tenants}},\n\nSeja bem-vindo(a) a {{home.address}}. Seguem algumas informações úteis.\n\n- O aluguel é de {{t.rent}} por mês, com vencimento no dia {{t.payDay}} de cada mês.\n- Se precisar de algum reparo, avise-me o quanto antes: {{me.phone}} ou {{me.email}}. Em caso de emergência (cheiro de gás, vazamento, falta de aquecimento no inverno), ligue imediatamente.\n- Os medidores ficam aqui: {{home.meters}}\n- [O que mais é bom saber: o lixo, o aquecedor, o estacionamento]\n\nDesejo que você se sinta muito bem aqui.\n\nAtenciosamente,\n\n{{me.name}}'],
      access: ['Visita a {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Uma visita ao imóvel\n\nPrezado(a) {{t.tenants}},\n\nGostaria de visitar o imóvel em {{home.address}} em [dia e data], às [hora], para [o motivo: a verificação anual de segurança do gás, um reparo, uma vistoria]. A visita deve levar cerca de [duração].\n\nSe esse horário não for conveniente, peço que me informe outro que seja melhor para você, e eu reorganizo a visita.\n\nAtenciosamente,\n\n{{me.name}}\n{{me.phone}}'],
      repair: ['Sobre o reparo em {{home.name}}', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Sobre o reparo\n\nPrezado(a) {{t.tenants}},\n\nAgradeço por me avisar sobre [o problema]. [Quem] irá ao imóvel para verificar em [dia e data], e espero que esteja resolvido até [data].\n\nSe algo mudar ou piorar nesse meio-tempo, por favor, avise-me imediatamente.\n\nAtenciosamente,\n\n{{me.name}}\n{{me.phone}}'],
      copy: ['Uma cópia para os seus arquivos', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n{{home.address}}\n\n{{today}}\n\n# Uma cópia para os seus arquivos\n\nPrezado(a) {{t.tenants}},\n\nCom esta carta, você recebe uma cópia de [o documento: o certificado de segurança do gás, o laudo de segurança elétrica, o certificado energético] referente ao imóvel em {{home.address}}, com data de [data].\n\nPor favor, guarde-a com os seus documentos.\n\nAtenciosamente,\n\n{{me.name}}'],
      deposit: ['Sua caução', '{{me.name}}\n{{me.address}}\n\n{{t.tenants}}\n[Novo endereço do inquilino]\n\n{{today}}\n\n# Sua caução\n\nPrezado(a) {{t.tenants}},\n\nAgradeço pelo período em que você morou em {{home.address}}. A sua caução era de {{t.deposit}}.\n\n- Devolvido a você: [valor]\n- Retido: [valor], por [o quê, com o motivo e o custo]\n\nO valor será depositado na sua conta até [data]. Se não concordar com algum ponto, por favor, avise-me, para resolvermos juntos.\n\nAtenciosamente,\n\n{{me.name}}'],
    },
  };
  /* A rent paid by the week: the welcome letter's line about the rent, per language, as [the monthly line as it
     stands in the letter above, the weekly line that takes its place]. {{t.rent}} is then the weekly amount and
     {{t.payWeekday}} the weekday the tenancy started on. */
  R.LETTER_WEEKLY = {
    en: ['The rent is {{t.rent}} a month, due on day {{t.payDay}} of each month.', 'The rent is {{t.rent}} a week, due every {{t.payWeekday}}.'],
    nl: ['De huur is {{t.rent}} per maand, te betalen op de {{t.payDay}}e van elke maand.', 'De huur is {{t.rent}} per week, te betalen elke {{t.payWeekday}}.'],
    de: ['Die Miete beträgt {{t.rent}} im Monat, fällig am {{t.payDay}}. eines jeden Monats.', 'Die Miete beträgt {{t.rent}} pro Woche, fällig jeden {{t.payWeekday}}.'],
    es: ['El alquiler es de {{t.rent}} al mes y se paga el día {{t.payDay}} de cada mes.', 'El alquiler es de {{t.rent}} a la semana y se paga cada {{t.payWeekday}}.'],
    it: ['L’affitto è di {{t.rent}} al mese, da pagare il giorno {{t.payDay}} di ogni mese.', 'L’affitto è di {{t.rent}} alla settimana, da pagare ogni {{t.payWeekday}}.'],
    'pt-br': ['O aluguel é de {{t.rent}} por mês, com vencimento no dia {{t.payDay}} de cada mês.', 'O aluguel é de {{t.rent}} por semana, com vencimento semanal ({{t.payWeekday}}).'],
  };
  // The six languages a letter can be in. The rules in it stay the home's country's; only the words change.
  R.LETTER_LANGS = [['en', 'English'], ['nl', 'Nederlands'], ['de', 'Deutsch'], ['es', 'Español'], ['it', 'Italiano'], ['pt-br', 'Português (Brasil)']];
  // The language a letter starts in: the home's country (England, the Netherlands, Germany), else the app's language.
  R.letterLang = (code, uiLang) => ({ england: 'en', nl: 'nl', de: 'de' })[code] || (R.LETTER_TEXT[uiLang] ? uiLang : 'en');
  // A tenancy's own choice wins: a tenant may prefer another language than the landlord's.
  R.letterLangFor = (code, t, uiLang) => (t && R.LETTER_TEXT[t.letterLang] ? t.letterLang : R.letterLang(code, uiLang));
  R.fillLetter = (id, code, { s = {}, home = {}, t = {}, today, lang: asked, uiLang }) => {
    const lang = R.LETTER_TEXT[asked] ? asked : R.letterLangFor(code, t, uiLang);
    const L = R.LETTER_TEXT[lang], tpl = (L[id] || R.LETTER_TEXT.en[id]).slice();
    const day = today || BW.today(), rent = R.rentNow(t, day), weekly = rent.per === 'week', W = R.LETTER_WEEKLY[L[id] ? lang : 'en'];
    if (weekly && W) tpl[1] = tpl[1].replace(W[0], W[1]);
    // amounts and dates in the letter's own language, and the money in the country's currency, whatever the screen's language
    const cur = (R.pack(code) || {}).currency, money = (v) => (num(v) ? BW.money(num(v), cur, lang) : '');
    const v = {
      me: { name: s.ownerName || '', address: [s.address, [s.postcode, s.city].filter(Boolean).join(' ')].filter(Boolean).join('\n'), phone: s.phone || '', email: s.email || '' },
      home: { name: home.name || home.address || '', address: [home.address, [home.postcode, home.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || home.name || '', meters: home.meters || '' },
      t: { tenants: t.tenants || '', rent: money(rent.amount), payDay: String(R.payDay(t)), payWeekday: weekly && isDate(t.start) ? BW.fmtDate(t.start, { weekday: 'long' }, lang) : '', deposit: money(t.deposit) },
      today: BW.fmtDate(day, { day: 'numeric', month: 'long', year: 'numeric' }, lang),
    };
    const fill = (str) => str.replace(/\{\{(\w+)(?:\.(\w+))?\}\}/g, (m, a, b) => { const x = b ? (v[a] || {})[b] : v[a]; return x ? String(x) : `[${b || a}]`; });
    return { title: fill(tpl[0]), body: fill(tpl[1]), lang };
  };

  // ---------- file names ----------
  /* A name for a file or folder Busy Rentals saves: the parts that are filled in, joined, without anything a file
     system refuses and never starting with a dot (a home called ".." must not climb out of its folder). At most 80
     characters: a long first part (a title, a home's name) is cut, so what tells two files apart at the end (the
     tenant, the date) is kept. */
  R.fileName = (...parts) => {
    const p = parts.map((x) => BW.fileSafe(String(x == null ? '' : x))).filter(Boolean).map((x, i) => (i ? x.slice(0, 30).trim() : x));
    const tail = p.slice(1).join(' '), head = (p[0] || '').slice(0, Math.max(8, 80 - tail.length - 1)).trim();
    return [head, tail].filter(Boolean).join(' ').replace(/^[.\s]+/, '').trim() || 'Busy Rentals';
  };

  // ---------- one PDF style (the same as Busy Home's letters) ----------
  // body: lines; "# " is a heading, "- " a bullet. Returns a Blob. Needs shared/pdf.js on the page.
  R.pdf = (title, body, { footer = '' } = {}) => {
    const d = new BW.pdf.Doc(), W = d.W, Hh = d.H, M = 64, accent = '#F5A623';
    let y = 64, page = 1;
    const foot = () => { if (footer) d.text(footer, M, Hh - 32, { size: 7.5, color: '#9A97AC' }); d.text(String(page), W - M, Hh - 32, { size: 7.5, color: '#9A97AC', align: 'right' }); };
    const room = (h) => { if (y + h > Hh - 64) { foot(); d.addPage(); page++; y = 64; } };
    d.rect(0, 0, W, 8, { fill: accent });
    for (const raw of String(body).split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (!line) { y += 8; continue; }
      if (line.startsWith('# ')) {
        room(30); y += 8;
        d.wrap(line.slice(2), W - 2 * M, 13, true).forEach((l) => { d.text(l, M, y, { size: 13, bold: true, color: '#1E1B2E' }); y += 17; });
        y += 2; continue;
      }
      const bullet = /^[-*] /.test(line), text = bullet ? line.slice(2) : line, x = bullet ? M + 14 : M;
      d.wrap(text, W - M - x, 10.5).forEach((l, i) => { room(15); if (bullet && !i) d.rect(M + 3, y - 5, 4, 4, { fill: accent, r: 2 }); d.text(l, x, y, { size: 10.5, color: '#2B2840' }); y += 15; });
    }
    foot();
    return d.blob(title);
  };

  // ---------- costs and the tax year ----------
  // Cost categories, close to the lines the returns ask for. Busy groups; it never says what is deductible.
  R.COST_KINDS = [['repairs', '🔧', 'Repairs and maintenance'], ['insurance', '☂️', 'Insurance'], ['interest', '🏦', 'Mortgage interest'], ['service', '🧾', 'Service charges and ground rent'],
    ['utilities', '💡', 'Energy, water, council or property tax'], ['agent', '🤝', 'Agent and management fees'], ['legal', '⚖️', 'Legal and professional fees'], ['other', '📦', 'Other']];
  R.costKind = (id) => R.COST_KINDS.find((k) => k[0] === id) || R.COST_KINDS[R.COST_KINDS.length - 1];
  // A tax year's totals per home: rent received and costs by kind. England's tax year runs from 6 April.
  R.taxYearRange = (code, year) => (code === 'england' ? [`${year}-04-06`, `${Number(year) + 1}-04-05`] : [`${year}-01-01`, `${year}-12-31`]);
  // The tax year a day falls in (the year it starts in), and how a tax year is written: 2026, or 2026-27 in England.
  R.taxYearOf = (code, date) => (code === 'england' && date.slice(5) < '04-06' ? String(Number(date.slice(0, 4)) - 1) : date.slice(0, 4));
  R.taxYearLabel = (code, year) => (code === 'england' ? `${year}-${String(Number(year) + 1).slice(2)}` : String(year));
  const totals = (home, a, b, rentIn, costs) => {
    const byKind = {};
    costs.forEach((c) => { byKind[c.kind || 'other'] = (byKind[c.kind || 'other'] || 0) + num(c.amount); });
    const total = Object.values(byKind).reduce((s, v) => s + v, 0);
    return { home, from: a, to: b, rent: r2(rentIn), costs: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, r2(v)])), totalCosts: r2(total), net: r2(rentIn - total) };
  };
  R.taxYear = (code, year, { homes = [], tenancies = [], payments = [], costs = [] }) => {
    const [a, b] = R.taxYearRange(code, year), inside = (d) => isDate(d) && d >= a && d <= b;
    return homes.map((h) => {
      const ts = new Set(tenancies.filter((t) => t.homeId === h.id).map((t) => t.id));
      const rent = payments.filter((p) => ts.has(p.tenancyId) && inside(p.date)).reduce((s, p) => s + num(p.amount), 0);
      return totals(h, a, b, rent, costs.filter((c) => c.homeId === h.id && inside(c.date)));
    });
  };
  /* The tax year of every home, each in its own country's year and money: one block per country, { code, pack,
     currency, year, label, from, to, rows (R.taxYear's, one per home), noHome }. A home without a pack counts by the
     calendar year in the landlord's own currency. noHome is one more row (home: null) in the landlord's own block,
     or null: costs without a home or of a home that is gone, and rent of a tenancy whose home is gone, so nothing
     recorded is left out of the totals. `year` is the year each block's tax year starts in. */
  R.taxYears = (year, { homes = [], tenancies = [], payments = [], costs = [] }, s, lang) => {
    const own = R.countryOf({}, s, lang), codes = [...new Set(homes.map((h) => R.countryOf(h, s, lang)))];
    const ids = new Set(homes.map((h) => h.id)), homeOfTenancy = new Map(tenancies.map((t) => [t.id, t.homeId]));
    const looseCosts = costs.filter((c) => !ids.has(c.homeId)), looseRent = payments.filter((p) => !ids.has(homeOfTenancy.get(p.tenancyId)));
    if ((looseCosts.length || looseRent.length || !codes.length) && !codes.includes(own)) codes.push(own);
    return codes.map((code) => {
      const [from, to] = R.taxYearRange(code, year), inside = (d) => isDate(d) && d >= from && d <= to;
      const rows = R.taxYear(code, year, { homes: homes.filter((h) => R.countryOf(h, s, lang) === code), tenancies, payments, costs });
      const lc = code === own ? looseCosts.filter((c) => inside(c.date)) : [], lr = code === own ? looseRent.filter((p) => inside(p.date)) : [];
      const noHome = lc.length || lr.length ? totals(null, from, to, lr.reduce((sum, p) => sum + num(p.amount), 0), lc) : null;
      return { code, pack: R.pack(code), currency: R.currencyOf(code, s), year: String(year), label: R.taxYearLabel(code, year), from, to, rows, noHome };
    });
  };
})();
