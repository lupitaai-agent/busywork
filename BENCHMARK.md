# Busy benchmark and upgrade list

*2026-10-23. Compares the website (homepage), the in-app home and the eleven tools with
best-in-class products. Only what competitors do very well to extremely well.*

Status: ✅ built in this round · 🔜 on the roadmap

---

## 1. Where we stand (audit)

**Strengths to keep**
- A playful, consistent design system; every tool feels like part of one product.
- Truly private: no account, no server, plain files. No competitor offers this.
- Tools already talk to each other (hours → invoice, quote → invoice, invoices + expenses → dashboard).
- Tiny and fast: the whole suite is a ~100 KB download with no libraries.

**Gaps found**

| Area | Finding |
|---|---|
| Website | One long page. No page per tool, so nothing ranks for searches like “free invoice generator” or “mileage log template”. No meta/OG tags, structured data, sitemap or robots.txt. No proof, no “what does this replace” story, no audience sections, no workflow story. |
| In-app home | Good “today” strip, but no first-run guidance (checklist), no way to explore with example data, no search across tools. |
| Navigation | You can only move between tools via the home screen. No global search, no keyboard shortcuts, no quick “new …” action. |
| Safety | Delete is permanent with no undo. No automatic backups. Two open tabs could overwrite each other’s save. Dialogs don’t trap keyboard focus. |
| Invoices | Missing what every paid tool has: saved products/services, discounts, partial payments/deposits, recurring invoices, payment reminders, credit notes, scan-to-pay. |
| Time | No billable/non-billable, no rounding, no weekly timesheet, no “continue” button, timer invisible in other tabs. |
| Expenses | Can’t pass an expense on to a client; no “paid privately”. |
| Money | No VAT return overview, no ageing of unpaid invoices, no cash-flow forecast. |
| Board, docs, subs, trips, stock | Basic. Missing checklists (Trello), insert-field menus (PandaDoc), subscription → expense, frequent routes (MileIQ), stock history and barcode scanning (Sortly). |

**Technical deep dive**

| Topic | Finding | Action |
|---|---|---|
| Data integrity | Each save re-reads and rewrites a collection inside a per-tab queue. Two tabs saving the same collection at the same moment can lose one change. | ✅ Web Locks API around every read-modify-write (works across tabs). |
| Backups | None. A deleted file or bad sync means data loss. | ✅ Daily snapshot in `backups/`, keep 14, restore from the storage menu. |
| Undo | Deletes are final. | ✅ Undo toast on every delete. |
| Security (XSS) | All user text goes through `BW.esc()` before reaching HTML; checked every tool. No `eval`, no remote scripts in the tools. | Keep the rule: never put user text into HTML without `esc`. |
| Accessibility | Dialogs close with Escape but don’t trap focus or return it. Board drag-and-drop has a keyboard alternative (status chips). | ✅ Focus trap + focus return. 🔜 full screen-reader pass. |
| Performance | Whole-collection JSON rewrite per save. Fine up to thousands of records; the slowest real-world case (≈5,000 invoices) is still well under 100 ms. | 🔜 Split per-year files if a customer ever gets there. |
| Offline / install | Downloaded version is offline by nature. Hosted “try online” version can’t be installed. | ✅ Web app manifest + service worker for the hosted copy. |
| SEO | No per-tool pages, no structured data, no sitemap. | ✅ 11 product pages, JSON-LD, sitemap, robots. |

---

## 2. Benchmarks: what the best do extremely well

| Product | What they do extremely well | What we take from it |
|---|---|---|
| **FreshBooks, Invoice Ninja, Square Invoices** | Recurring invoices, automatic reminders on a days-overdue cadence, partial payments and deposits, saved items, client-specific terms. | Recurring invoices, reminder emails in three tones, deposits/partial payments, a products & services list, client defaults. |
| **Moneybird** (NL) | One-click payment reminder, pay-online links on invoices, VAT return overview, credit notes. | Reminder button, pay-now link + SEPA scan-to-pay QR code, VAT overview per quarter, credit notes. |
| **Toggl Track, Harvest** | Start/stop from anywhere, billable rates, rounding rules, weekly timesheet, “continue” on an old entry, keyboard shortcuts. | Billable switch, rounding (6/15 min), week view, continue button, timer in the tab title, `S` to start/stop. |
| **Expensify, Dext** | Snap-and-forget receipts, rebill expenses to clients, reimbursable vs company-paid. | “Pass on to client” (lands on their next invoice), “paid privately” flag. 🔜 AI receipt reading. |
| **QuickBooks, Moneybird dashboards** | Cash-flow forecast, ageing receivables, tax overview. | 90-day forecast, unpaid-invoice ageing, VAT return overview. |
| **Trello, Linear** | Checklists in cards, filters, archive, keyboard-first, command palette (⌘K). | Card checklists, search filter, “clear done”, ⌘K across the whole suite. |
| **Notion, Linear, Raycast** | ⌘K command palette, undo toasts, getting-started checklist, example templates. | ⌘K everywhere, undo, home checklist, example data. |
| **PandaDoc** | Template library with variables you insert from a menu. | Insert-field menu, more templates. |
| **Rocket Money** | Upcoming charges calendar, cancel nudges. | 12-month renewal timeline; “log this payment as an expense”. |
| **MileIQ** | One-tap frequent trips. | Frequent routes as one-tap chips. |
| **Sortly** | Stock movement history (“item flow”), barcode scanning, low-stock report, folders. | Movement history with reasons, categories, barcode scanning where the browser supports it. |
| **Stripe, Linear, Notion websites** | One clear promise, product shown in motion, proof near the CTA, a page per product, strong footer sitemap. | Product pages, proof strip, workflow story, footer sitemap. |
| **Invoice Simple, Harvest, Bonsai** | A free tool page per search intent (“free invoice generator”, “invoice template for X”) that pairs the explanation with the tool itself. | Each product page targets one search intent, explains what the document must contain, and links straight into the tool. |

---

## 3. The upgrade list

### Website
- ✅ W1 A product page for each tool, generated from one data file by `build.py`, plus a tools index.
- ✅ W2 Tools menu in the nav and a full footer sitemap.
- ✅ W3 “What this replaces” calculator: tick the subscriptions you’d otherwise pay for.
- ✅ W4 Workflow story: hours → invoice → paid → dashboard.
- ✅ W5 Audience section: freelancers, shops & makers, small studios.
- ✅ W6 Honest proof strip (size, trackers, price, tools). No invented testimonials; add real ones when they exist.
- ✅ W7 SEO basics: meta descriptions, Open Graph, JSON-LD (SoftwareApplication, FAQPage), sitemap.xml, robots.txt, ads.txt template.
- ✅ W8 “Try this tool online” deep links on every product page.
- 🔜 W9 Social share image. 🔜 W10 Comparison pages (“Busy vs …”). 🔜 W11 Dutch version of the site.

### Whole suite
- ✅ C1 ⌘K / Ctrl+K command palette in every tool: jump anywhere, create anything, find any client, invoice, document or task.
- ✅ C2 ＋ New button in the top bar.
- ✅ C3 Undo after every delete.
- ✅ C4 Multi-tab-safe saving (Web Locks).
- ✅ C5 Automatic daily backups in the business folder, with restore.
- ✅ C6 Keyboard focus stays inside dialogs and returns afterwards.
- ✅ C7 Keyboard shortcuts (`N` new, `/` search, `?` help) in every tool.
- ✅ C8 Light / dark / automatic theme switch.
- ✅ C9 Example data: explore everything with a pretend business, remove it in one click.
- ✅ C10 Getting-started checklist on the home screen.
- ✅ C11 Installable, offline-capable hosted version (PWA).
- 🔜 C12 Dutch interface. 🔜 C13 Google Sheets team mode.

### Invoices & Quotes
- ✅ I1 Products & services list with type-ahead on invoice lines.
- ✅ I2 Discount per invoice.
- ✅ I3 Partial payments and deposits, with “still to pay”.
- ✅ I4 Recurring invoices (weekly to yearly), drafted automatically.
- ✅ I5 Payment reminders: friendly, firm and final, ready in your email.
- ✅ I6 Credit notes.
- ✅ I7 Scan-to-pay QR code (EPC/SEPA) and a pay-now link on the PDF.
- ✅ I8 Client defaults: payment terms, hourly rate and invoice language per client.
- 🔜 I9 Choice of PDF styles. 🔜 I10 Peppol/UBL e-invoice export.

### Client Book
- ✅ CL1 Per-client payment terms, hourly rate and invoice language.
- 🔜 CL2 Tags and filters. 🔜 CL3 Statement of all open invoices.

### Time Tracker
- ✅ T1 Billable / not billable. ✅ T2 Rounding (none, 6 or 15 minutes). ✅ T3 Timer in the browser tab title.
- ✅ T4 Week view (timesheet). ✅ T5 Continue an earlier entry. ✅ T6 `S` starts and stops. ✅ T7 Uses the client’s own rate.
- 🔜 T8 Idle detection. 🔜 T9 Link time to projects.

### Receipts & Expenses
- ✅ E1 Pass an expense on to a client: it lands on their next invoice. ✅ E2 “Paid privately” (to pay yourself back).
- 🔜 E3 AI reads the receipt (with your own Claude key).

### Money Dashboard
- ✅ M1 VAT return overview per quarter (Dutch box numbers). ✅ M2 Ageing of unpaid invoices. ✅ M3 90-day cash-flow forecast.
- 🔜 M4 Year-on-year comparison.

### Project Board
- ✅ B1 Checklists inside cards. ✅ B2 Search filter. ✅ B3 Clear done cards. ✅ B4 “Track time on this” starts the timer.

### Document Maker
- ✅ D1 Insert-field menu. ✅ D2 More templates (price list, project brief, meeting notes). 🔜 D3 Signatures.

### Brand Kit
- ✅ BR1 QR code to your website on the back of your business cards. 🔜 BR2 One-page brand guide PDF.

### Subscriptions
- ✅ S1 “Log this payment as an expense”. ✅ S2 12-month renewal timeline.

### Trip Log
- ✅ TR1 Frequent routes as one-tap chips. 🔜 TR2 Odometer readings. 🔜 TR3 Bill kilometres to a client.

### Stock Keeper
- ✅ ST1 Stock history with reasons (sold, received, counted). ✅ ST2 Categories. ✅ ST3 Barcode scanning (Chrome on Mac, Android, ChromeOS).
- 🔜 ST4 Import from a spreadsheet.

---

## Sources
- [NerdWallet: best invoicing software 2026](https://www.nerdwallet.com/business/software/best/invoicing-software) · [Agiled: invoicing software ranked](https://agiled.app/blog/best-invoicing-software-for-small-businesses)
- [Onderneming.nl: Moneybird review](https://www.onderneming.nl/boekhoudprogramma/moneybird/)
- [Harvest vs Toggl](https://www.getharvest.com/resources/harvest-vs-toggl) · [Clockify vs Toggl vs Harvest](https://clockify.me/blog/apps-tools/clockify-vs-toggl-vs-harvest/)
- [Veza Digital: SaaS homepage examples 2026](https://vezadigital.com/post/best-saas-homepage-design-examples) · [Lovable: SaaS website best practices](https://lovable.dev/en/guides/saas-website-best-practices)
- [EPC069-12 QR code guidelines](https://europeanpaymentscouncil.eu/sites/default/files/kb/file/2022-09/EPC069-12%20v3.0%20Quick%20Response%20Code%20-%20Guidelines%20to%20Enable%20the%20Data%20Capture%20for%20the%20Initiation%20of%20an%20SCT_0.pdf) · [Segno: EPC QR codes](https://segno.readthedocs.io/en/stable/epc-qrcodes.html)
- [Invoice Simple: SEO invoice template page](https://invoicesimple.com/invoice-template/seo-invoice) · [Harvest: invoice generator for SEO specialists](https://www.getharvest.com/invoices/invoice-generator-for-seo-specialists)
- [Sortly](https://sortly.com/business) · [Sortly inventory control](https://sortly.com/inventory-control-system)
- [Command palette pattern](https://www.saasui.design/glossary/command-palette) · [Trello keyboard shortcuts](https://support.atlassian.com/ja/trello/docs/using-keyboard-shortcuts-in-trello/)
