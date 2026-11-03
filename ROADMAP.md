# Busy roadmap

"Busy" is a working name. It is set in one place: `BW.brand` in `app/shared/core.js`
(plus the website's page titles).

## Done

- All eleven tools, sharing one design system and one business folder.
- Round 2 (benchmark upgrade, see `BENCHMARK.md`): ⌘K search everywhere, ＋ New, undo, daily backups
  and restore, multi-tab-safe saving, keyboard shortcuts, light/dark switch, example data, a
  getting-started checklist, installable offline web version; recurring invoices, reminders, part
  payments, discounts, credit notes, products & services, client defaults, scan-to-pay QR codes and
  pay-now links; billable/rounding/week view in time; pass-on costs; VAT overview, ageing and
  forecast; checklists on cards; insert-field menu; 12-month subscription timeline; frequent trips;
  stock history and barcode scanning.
- Marketing Studio: the twelfth tool, an AI marketing team on the owner's own Claude key, built on
  proven brand growth science (`marketing/FOUNDATION.md`) with 47 anonymized, upgraded and vetted skills.
- Website: a product page per tool (generated from `website/content/tools.json`), tools index,
  calculator, workflow and audience sections, footer sitemap, structured data, sitemap and robots.

- Olaf (2026-10-24): the AI marketing expert, now part of Busy and running in the browser
  (`app/apps/olaf/`, how it works in `olaf/README.md`). Growth coach, 52 skills (61 with the project skills since 2026-10-25) on the marketing
  foundation, its own workspace in the owner's folder, web search and fetch through Anthropic,
  sales numbers from Busy invoices. Product page `website/olaf.html`; the homepage, the Studio
  page, every tool page and the download page show the free vs guided choice.
- One repository, ready for GitHub Pages (`README.md`, `.github/workflows/pages.yml`).
- Shared marketing dashboard (2026-10-24): one plan, one set of monthly numbers and one list of
  work in both the Studio and Olaf (`app/shared/mkt-dash.js`); Olaf's setup checklist and the
  "your marketing is set up" endpoint. Tested end to end on a real key with a fresh business.
- Insights and content (2026-10-24): `shared/mkt-insights.js` (new customers by source from the
  Client Book's "How did they find you?", revenue, repeat share, cost per new customer, goal,
  monthly numbers by hand or CSV import, "what stands out", channel health cards with their
  skills) and `shared/mkt-content.js` (a content calendar). Free: AI help per post or month on the
  owner's key. Olaf: fills the calendar and reviews the month itself.

- Project Planner (2026-10-25): the thirteenth tool (`app/apps/projects/`, sums in
  `app/shared/projects.js`). Same projects and cards as the Project Board, plus a brief with a time
  budget, milestones, a timeline you drag (what waits for a task moves along), people and workload,
  health with reasons, risks and decisions, and a weekly update drafted from the plan; six templates;
  calendar and spreadsheet export. Olaf runs it with nine project skills of our own (kick-off,
  weekly check-in, recovery, risk review, notes to tasks, client update, task brief, close) and
  project tools on the same plan. Research and the vetting of outside skills: the Olaf repository's
  `docs/project-research.md`.

- Six languages (2026-11-02, release 0.9.4): Dutch, German, Spanish, Italian and Brazilian Portuguese
  next to English, for the website, the games and every free tool, with local rules per country
  (`i18n/`, `app/shared/i18n.js`). The experts answer in the chosen language.

- The big update (2026-11-03, release 0.9.5): every screen in six languages, Olaf, Ivy and Juno included
  (busywork-olaf i18n/experts.py); the puzzles in their room (website/assets/games/room.js, a live three.js board
  in the Puzzle Parlour's frame); a short Unreal film opening every place, by time of day and per language where a
  sign has words (busy-studio render_loops.sh, loops_web.py; social copies in Busy HQ/releases/social); all four
  seasons for the street and every room, picked by the date and flipped for Brazil (render_places.sh with
  BUSY_SEASON, seasons_web.py); the website's signs painted into the films in each language.
  Not yet: seasons in the apps' own room pictures and in the experts' rooms; films for the apps.

## Next up

### 0. The places and the characters (built 2026-11-01, not pushed yet)
All six characters come from Meshy and go out together. Done, waiting for the push:
- The rooms rendered in the morning, by day and in the evening, each with its depth and its lights
  (busy-studio `render_places.sh`, `place_web.py`). The pictures follow the clock, the characters stand
  behind the furniture and are lit like the room, and the room moves a little with the pointer
  (`app/shared/scene.js`, also used by `website/assets/place.js`).
- The apps' home screens: the guide stands live in the front room (Tuck, Rivet, Pim), also when the app is
  opened from a file and in the desktop apps. Still pictures with reduced motion or without WebGL.
- The paid apps: Olaf, Ivy and Juno live in their rooms upstairs and act out what the AI is doing
  (thinking, writing, done, saved). Only in the paid downloads (`busywork-olaf/experts/`).
- Fixed: on phones the guide walks over to the thing to tap, so both stay in view; tapping the picture does
  the room's thing, and on Busy Street a second tap goes through the door.

Next for the places:
- Room objects that follow the user's own data (the stock shelf empties, invoices pile up on the counter,
  the trellis grows a leaf per skill, a drawer label glows before something expires).
- Short rendered clips for big moments, like Tuck's "Cancelled in time!" cheer, for the other places.
- More moves from Meshy: a real Typing, Carrying a box and Pointing for Tuck; a clear point for Pim; a
  sitting or writing move for the experts.

### 0b. Being found, and growing (decided 2026-11-01)
Done: hidden search data checked on every page (products with price, questions, breadcrumbs), one page
per tool for Busy Home and Busy Growth, a short footer (two tools per suite), the free guide next to the
paid expert high on every suite page, and the facts for AI assistants (`llms.txt`, `llms-full.txt`).
Later, in this order of thinking:
- **Markets first:** check which countries and languages are most interesting for Busy before choosing.
- **A Dutch version** of the site and the apps (or the language that research points to).
- **Short videos of the characters** (15–30 seconds, rendered in the Busy Studio) for social media.
- **A privacy-friendly visitor counter** on the website only, to see which pages and downloads work.
- **Listings:** software directories, then the Mac App Store and Microsoft Store.
- **Selling the experts:** checkout (EU VAT) and licence keys, plus Apple notarisation so the apps open
  without a warning. The paid Mac apps are built (busywork-olaf/desktop/build-paid.py).
- **The places:** rooms that follow your own data, rendered clips for big moments, better moves from Meshy.
- **iPhone apps** for the free suites first (a Capacitor wrapper, files in iCloud Drive), the experts later.

### 1. Project Planner, next steps
- Hours spent: link Time Tracker entries to a task (the "track time on this" button already knows
  the task), then show budget against hours spent per project.
- Invoice from a project: turn finished milestones of a client project into invoice lines.
- Real-key test of Olaf's project skills: a kick-off and two weekly check-ins on the example
  studio; cost per conversation.
- Team members on different computers need sync (see Team Mode and ARCHITECTURE.md).

### 2. Payments, the rest
Scan-to-pay QR codes and pay-now links are done. Still to do: automatic “paid” status from the
bank or from Mollie/Stripe. That needs a server or a bank connection, so it is a paid option at best.

### 3. Olaf and the Marketing Studio: next steps
- Test both with a real Claude key: tone of answers, onboarding as a conversation, a full
  "Start my journey" and a weekly check-in, the cost per conversation.
- Checkout for Olaf (€149 once; free during early access until then): a payment provider that
  handles EU VAT (Lemon Squeezy or Paddle) and a licence key the app checks in the browser. A static
  site cannot make that check impossible to get around; accepted for a one-time small-business price.
- Olaf in the download works from `file://` too; check folder mode in Chrome and Edge with a real
  business folder (the `Olaf/` copies of its files).
- Measure how many Studio users open Olaf (a privacy-friendly counter on the website only).
- Survey helper: generate a ready Google Form from the brand-health questions.
- Insights next: compare months side by side, a printable monthly report, more CSV formats
  tested against real exports (Google Business Profile, Search Console, Meta, Mailchimp).
- Content language: posts always follow the business's language (decided 2026-10-24).
- Posting: copy and open the platform, a QR code to the phone (posts up to ~330 bytes; longer ones by
  email), calendar reminders (.ics) and a CSV export. Posting directly needs the platforms' logins on
  a server: a possible paid extra later.
- Olaf is a separate private repository (`busywork-olaf`); this repo holds only its demo and the
  fingerprints for the leak check. Checkout: set `OLAF_CHECKOUT_URL` and switch on `LICENCE.required`.
- Example data for the Studio and Olaf (a pretend brand profile, plan and journey) for demos.
- Have the Apache-2.0 credits in `marketing/licenses/` checked before launch.

### 4. AI Helper (bring your own Claude key)
AI buttons inside the tools: read a receipt photo, draft the invoice email or reminder, turn notes
into a proposal. One “Claude API key” field in settings, stored only in the user's own folder.

### 5. Team mode with Google Sheets
Google sign-in does not work from a file opened from disk, so this runs from the hosted copy
(https). Use only the `drive.file` permission to avoid Google's heavy review.

### 6. Smaller items from the benchmark
Dutch interface · PDF style choice · Peppol/UBL e-invoices · signatures on documents · idle
detection · client tags and statements · spreadsheet import for stock · odometer readings ·
billing kilometres to clients · year-on-year comparison · social share image · comparison pages.

## Ads and money

- **Website:** Google AdSense slots are built in (`website/assets/site.js`, `ADSENSE`).
  To switch on: apply for AdSense with the live domain, add `ads.txt` to the site root,
  fill in the publisher id and ad unit ids, and switch on AdSense's own consent message
  for EU/UK visitors (AdSense → Privacy & messaging). Finish `privacy.html` first.
- **Inside the tools:** AdSense is not allowed in downloadable software, and it cannot
  serve on files opened from disk. The tools have a sponsor slot under every tool
  (never inside invoices or other output). It shows our own cards today; directly sold
  sponsors go in `BW.sponsors` in `app/shared/core.js` and ship with each release.
- Possible later: a paid "Pro" pack (AI features, payments, team mode).

## Before launch

- [ ] Pick the real brand name and domain
- [ ] Test "a folder on my computer" by double-clicking `index.html` in Chrome and Edge,
      including the daily copy in `backups/` and “Restore a backup”
- [ ] Push the repository to GitHub and switch Pages to "GitHub Actions" (see `README.md`);
      the workflow passes the real address as `SITE_URL`
- [ ] Try barcode scanning on a phone or Mac with a camera
- [ ] Finish `website/privacy.html` (company details, contact)
- [ ] Have an accountant check the invoice layout and the VAT wording (NL and EN)
- [ ] Apply for AdSense once the site is live
