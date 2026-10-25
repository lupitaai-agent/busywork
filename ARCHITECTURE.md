# Busywork architecture

How Busywork is built, why, and how it can grow into a desktop app, a store app or a cloud service
without starting again. Read with [DATA.md](DATA.md) (the data format) and [README.md](README.md)
(building and publishing).

## Principles

1. **The owner's data stays with the owner.** Business data lives in a folder on their computer
   (or in their browser while they try it out), as JSON a person can read. No server of ours sits
   between the owner and their data. Every future version keeps this possible, even if a cloud
   option is added next to it.
2. **Opens from a double-click.** The tools are plain scripts that run from a downloaded folder
   (`file://`), with no build step, no packages and no install. The same files run on the website
   and inside any future app shell.
3. **One data contract.** Whatever reads or writes a business (this app, a phone app, a sync
   service, an importer) follows DATA.md and `app/shared/schema.js`. Changes to it go through data
   versions, never through quiet edits.
4. **Seams, not forks.** What differs between a browser tab, a desktop app, a phone app and a
   hosted version is kept behind four small seams (below). A new target fills in the seams; the
   apps don't change.
5. **The paid part ships only to those who paid.** Olaf lives in a private repository; the free
   repository and website can't contain its instructions, and the build proves it.
6. **Checked before published.** One command (`python3 check.py`) runs every check; GitHub runs the
   same command and publishes nothing when it fails.

## The layers

```
 pages            app/index.html, app/apps/<tool>/index.html + app.js, Olaf (private repo)
   │
 shared UI        core.js: top bar, modals, drawers, forms, toasts, command palette, onboarding
   │              ai.css/ai.js chat UI, mkt-*.js marketing dashboard, insights, content calendar
   │
 services         BW.store (records)          BW.ai (Claude)           BW.platform (download, links, clipboard)
                  BW.migrate (data versions)  BW.entitlements (paid)   BW.problems / BW.diagnostics
   │
 seams            storage driver              AI transport             platform, entitlements
   │                  │                           │                        │
 today            folder (File System Access) direct to Anthropic,     browser tab / installed
                  or this browser             owner's own key          web app; Olaf by files
```

All scripts are classic scripts that attach to one global, `BW`, and load in the order the page
lists them (`core.js` first). The tests check that every page loads what it needs in that order.

## The four seams

A shell (desktop, phone, test, hosted version) sets `window.BW_HOST` before `core.js` loads:

```js
window.BW_HOST = {
  driver: async () => myDriver,             // where the business lives
  platform: { kind, download, openUrl, copy }, // what differs per platform
  aiTransport: { name, needsKey, send },    // how a request reaches Claude
  entitlements: { edition(feature) },      // what this copy may use
};
```

Anything left out keeps the browser default. Each seam has tests showing a replacement works.

| Seam | Contract | Today | Later |
|---|---|---|---|
| Storage driver | `readJSON`, `writeJSON`, `list`, `readFile`, `writeFile`, `listFiles`, `removeFile` (core.js) | `folder`, `browser`, `memory` (tests) | native files in a desktop shell, app storage on a phone, a sync service |
| Platform | `kind`, `download`, `openUrl`, `copy` | browser | native save dialog, system browser, native clipboard |
| AI transport | `send(body, { key, beta, signal })` returns the API's stream | `direct`: browser to Anthropic with the owner's key | `proxy(url)`: a server that holds the key and bills per use (already written, not switched on) |
| Entitlements | `edition('olaf')` is `'full'`, `'demo'` or `null` | which files are installed | a signed licence file, an app-store receipt, an account |

## Data

- One JSON file per collection, read-modify-write per save, one save at a time per tab and a
  browser-wide lock per collection, so two open tabs never lose each other's changes.
- `data/meta.json` records the data version. Start-up runs update steps after a full backup; a
  business saved by a newer Busywork opens read-only. See DATA.md.
- Daily backups in `backups/` (folder mode), plus download and restore.
- Writers keep fields they don't know, so versions can share a folder.

## Security

- **The API key** stays in the browser that uses it (`localStorage`, never in the business folder
  or a backup), is sent only to `api.anthropic.com`, and is masked in problem reports.
- **A strict Content Security Policy on every tool page:** scripts only from Busywork's own files,
  no inline scripts, network only to Anthropic, no plugins, no forms posting anywhere. An injected
  script can't run, and if one did, it couldn't send the key anywhere. Checked in Chrome (the policy
  holds from `file://`, and every tool page runs clean under it), and a test keeps it on every page.
- **Escaping:** everything the owner typed, and everything Claude writes, is escaped before it
  becomes HTML (`BW.esc`, `BW.md`, the form builder). Tests try injected markup.
- **Untrusted content:** web pages, search results and inbox files are data to Olaf, never
  instructions (in its prompt and in the skills). Skills ship with the app and never update
  themselves.
- **The website** gets a lighter policy (no plugins, no `<base>` hijack, forms only to the
  waitlist) because the ad network loads its own scripts; the key never lives on those pages.
- **Paid text stays private:** the private build fingerprints every Olaf-only sentence; the public
  build refuses to publish a page containing one.

## Testing

| What | How | Where |
|---|---|---|
| Logic (money, dates, store, versions, AI client, marketing numbers, exports, schema, seams, security rules) | `node --test` in a sandbox with a small fake browser; no packages | `tests/*.test.js` |
| Olaf's loop and workspace | the same sandbox, Claude replaced by scripted answers | private repo `tests/olaf.test.js` |
| Build and leak check | Python `unittest` | `tests/test_build.py`, private `tests/test_build.py` |
| Everything, before publishing | `python3 check.py` | locally and in GitHub Actions |
| Pages in a real browser | by hand or with the browser pane: layout at phone, tablet and desktop widths, console clean | not automated yet (see below) |

## Decisions

1. **Plain scripts, no build, no modules.** Module scripts don't load from `file://`, and a build
   step would make "download and double-click" impossible. Cost: one global and a fixed load order,
   which the tests guard.
2. **One JSON file per collection.** Readable, easy to back up, syncs through Google Drive or
   Dropbox. Cost: every save rewrites the collection; fine to many thousands of records, not to
   millions. A future driver can store records differently behind the same contract.
3. **Claude straight from the browser with the owner's key.** No server, no data passing through
   us, honest costs. Cost: the owner needs a key. The proxy transport is ready for when that matters.
4. **Free and paid in two repositories.** The free one can be public; the paid one never is. The
   website shows Olaf as a demo built from the private repo, without instructions.
5. **Data versions with a read-only guard.** A folder shared between computers through a sync
   service will meet two versions of Busywork; the newer data must win.
6. **Seams instead of target-specific copies.** One codebase for browser, store and cloud.

## How far away each future is

| Future | Distance | What is ready | What is missing |
|---|---|---|---|
| **Microsoft Store (and Google Play)** as an installable web app | **Near** | The hosted copy is already an installable web app (manifest, offline worker) | The live website; packaging with PWABuilder; store listings, privacy text, icons in store sizes |
| **Mac App Store / Microsoft Store as a desktop app** (Tauri or Electron shell) | **Medium** | All four seams; the apps need no changes | A shell with a native file driver (sandboxed folder access on the Mac), store receipts for Olaf in the entitlements seam, code signing and notarisation, an update channel |
| **Licence keys for Olaf** without a server | **Near** | Entitlements seam; switched-off licence screen in Olaf | A payment provider that issues keys (Lemon Squeezy, Paddle), and checking a signed licence file in the app with a public key, so it works offline |
| **Phone apps (iOS, Android)** | **Far** | Data format, store contract, AI transport | Phones can't open a folder the same way: a phone driver and probably sync; layouts designed for phones first; Apple requires in-app purchase for unlocking Olaf (Apple takes 15 to 30%) |
| **Cloud sync between devices** | **Far** | Records have ids and `updatedAt`; drivers are swappable; data versions | Deleted records need to leave a marker (`deletedAt`) so a sync can tell "deleted" from "not here yet": that is data version 2. Then a sync service, accounts, encryption so we still can't read the data, conflict handling |
| **Fully hosted Busywork (accounts, our servers)** | **Far, and against principle 1** | The proxy transport; a cloud driver would fit the seam | Servers, accounts, billing, security work, privacy law (we'd hold business data). Possible as an option next to local, not instead of it |
| **Olaf without the owner's own key** (we pay Claude, owner pays us monthly) | **Medium** | The proxy transport is written and tested | A small server that holds the key, meters use per licence and stops at a limit; a subscription price |
| **Other languages** | **Medium** | Documents already switch per client (English, Dutch); Olaf follows the business's language | The tools' own screens are written in English inline; the strings need moving into language files |
| **Team Mode** (several people, one business) | **Far** | Locks per collection inside one browser | Different people on different computers need real sync with merging (see cloud sync) |
| **Automated browser tests** | **Near** | The checks above; the responsive audit script we used by hand | Adding Playwright would add a dependency to the repo; worth it once there is a team or many contributors |
