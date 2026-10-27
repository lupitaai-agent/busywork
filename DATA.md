# Busy data format

A business is a set of **collections**. Each collection is one JSON file in the business folder's
`data/` folder (or one `bw.data.<name>` entry in browser storage). The files are meant to be
readable by people, by other tools, and by future versions of Busy. This page is the contract;
[`app/shared/schema.js`](app/shared/schema.js) has the same thing field by field, and the tests
check the example business against it.

## The folder

```
My Business/
  data/            one <collection>.json per collection (below)
  receipts/        receipt photos and PDFs, named by the expense app
  backups/         busy-YYYY-MM-DD.json, one a day, the last 14 kept (older busywork-… copies age out too)
                   before-update-v<N>-….json, made before a data version update
                   before-restore-….json, made before a restore
  Olaf/            Olaf's workspace mirrored as markdown (paid edition only)
```

## Rules for anything that writes

1. **Records** are JSON objects with a string `id`. The store sets `createdAt` and `updatedAt`
   (ISO 8601). Collections are arrays of records, except `settings` and `meta`, which are one object.
2. **Keep fields you don't know.** Change a record by changing its fields, never by rebuilding it
   from the fields you know. That way a newer version's additions survive an older version's save.
3. **Types are loose:** a number typed into a form may be stored as text (`"12,50"`); read numbers
   with `BW.num()`. Dates are `YYYY-MM-DD`, months `YYYY-MM`, times ISO 8601.
4. **References** are ids: `clientId` points at a record in `clients`, and so on. A missing target
   means it was deleted; show the record without it.
5. **Example records** carry `example: true`, so "remove the example business" can find them.
6. **Changing the meaning or name of a field** needs a data version step (below), and a line here.

## Data versions

`data/meta.json` holds `{ dataVersion, savedBy, createdAt, updatedAt }`. Current version: **1**.

At start-up Busy compares the folder's `dataVersion` with its own `BW.DATA_VERSION`:

- **Lower:** it saves a full backup (`backups/before-update-v<N>-….json`), runs each update step
  in `MIGRATIONS` (core.js) in order, and records the version after each step. A step that stops
  halfway runs again next time, so steps must be safe to run twice.
- **Same:** nothing happens.
- **Higher** (the folder was saved by a newer version of Busy, say on another computer through Google
  Drive): the business opens **read-only**, with a bar saying so. Nothing can be saved until this
  copy is updated, so an old copy can never undo what a new one changed.

Data from before versions existed has no `meta` and counts as version 1.

| Version | Release | What changed |
|---|---|---|
| 1 | 0.9.0 | The format as described on this page |

## Backups

A backup is one JSON file with every collection under its own name, plus a few fields about the
file itself, which start with `_`:

```json
{ "_busywork": 1, "_made": "2026-10-25T09:00:00.000Z", "_app": "0.9.0",
  "meta": { "dataVersion": 1 }, "settings": { … }, "clients": [ … ], "invoices": [ … ] }
```

`_busywork` is the version of this envelope (1). Restoring writes each collection back; a backup
made by a newer data version is refused. A backup without `meta` is treated as version 1, and the
update steps run on the next start.

## Collections

### Core
- `meta`: the data version (above).
- `settings`: business details printed on documents (name, address, VAT and registration numbers,
  bank account, logo as a data URL) and preferences (currency, VAT rates as text such as
  `"21, 9, 0"`, payment terms in days, document language `en`/`nl`, brand colour, hourly rate,
  mileage rate, tax reserve, email signature fields).

- `licences`: licences for paid parts, one per record: `product` (`olaf`), `licenceId`, the
  signed `key` (`BWL1.…`) and the `licensee` it names. Checked offline against the public keys in
  the paid download; a record that no longer checks out is ignored, never deleted.

### Clients and money
- `clients`: the Client Book. Name, contact, email, phone, address, VAT number, language,
  payment days, default hourly rate, notes, and `source` (how they found you), which marketing uses.
- `invoices`: invoices, quotes (`kind: "quote"`) and credit notes (`kind: "credit"`). `number`
  counts per year and kind (`2026-001`, `Q2026-001`, `C2026-001`). `client` is a copy of the client's
  details at the time of sending, so old invoices never change. `items` are lines
  `{ id, desc, qty, price, vat }`; `payments` `{ date, amount }`; `reminders` `{ date, tone }`;
  `repeat` `{ on, every: week|month|quarter|year, next }` for recurring invoices. Status:
  `draft`, `sent`, `paid` (quotes: `accepted`, `declined`). `creditFor` and `invoiceId` link
  a credit note to its invoice and an accepted quote to the invoice made from it.
- `catalog`: saved lines to add to invoices quickly.
- `time`: time entries; `dur` is `h:mm`; billed entries carry the `invoiceId`.
- `expenses`: costs with VAT rate and category; `receipt` is a path inside the folder
  (`receipts/…`); `paidBy` is `business` or `private`.
- `subscriptions`: repeating costs with `cycle` and `nextDate`.
- `trips`: mileage with `km` and `roundTrip` (1 or 2).

### Stock and projects
- `stock`: items with quantity, minimum, cost and price.
- `stockmoves`: every change to a count, with the reason and the count after.
- `projects`: shared by the Project Planner, the Project Board and Olaf. The brief: `goal`,
  `doneMeans`, `start`, `due` (deadline), `budgetHours` (a time budget: what it is worth, not what it
  takes), `ownerId` (a person), `status` (`active`, `paused`, `done`) and `health` (empty: worked out
  from the plan; or `green`, `amber`, `red` set by hand).
- `tasks`: cards on the Board, bars on the Planner's timeline. `status` is `todo`, `doing`,
  `waiting` or `done` (`doneAt` is the day it was done); `start` and `due` (a task with only `due`
  is one day long); `milestoneId`; `assigneeId` (a person); `hours` (estimate; none counts as 2);
  `after` (ids of tasks it waits for); `checklist` items are `{ id, text, done }`.
  Marketing work is linked in: every `mktplan` action and `mktcontent` post has a task in the
  project with `source: "marketing"`. The task carries `link` (`plan:<id>` or `content:<id>`) and
  `sync` (title, when and status at the last link); the marketing item carries `taskId`. Title, date
  and done-or-not follow whichever side changed (the newer change when both did); a marketing item
  whose `taskId` points nowhere had its task deleted on purpose and is not linked again
  (`BW.pm.linkMarketing` in `shared/projects.js`).
- `milestones`: per project, a `title`, a `due` date and `done`.
- `people`: the team, without accounts: `name`, `role`, `email`, `hours` a week for project work
  (none counts as 32).
- `projectlog`: per project, one record per risk (`kind: "risk"`, `likelihood` and `impact` 1 to 3,
  `next` step, `owner`, `state` open/closed), decision (`kind: "decision"`, `title`, `text` why) or
  weekly update (`kind: "update"`, `health`, `text`).
- `documents` and `doctemplates`: letters and agreements, and templates the owner saved.

### Marketing (shared by the free Marketing Studio and Olaf)
- `mktprofile`: one record, the brand profile: category, offer, area, buyers, the buying
  situations people are in when they think of a business like this (`ceps`), distinctive assets,
  tone, proof, barriers, competitors, channels, budget, goals, learnings.
- `mktplan`: the year plan, one action per record, by `month` with channel, cost and status
  (`planned`, `live`, `done`); `by` and `fromAI` say who added it.
- `mktwaves`: brand survey rounds.
- `mktruns`: skill results the owner saved.
- `mktnumbers`: one record per `month` with the numbers the owner tracks (keys in
  `mkt-insights.js` METRICS: Google profile views and calls, reviews, rating, visits, followers,
  reach, subscribers, open rate, enquiries, spend).
- `mktcontent`: the content calendar, one post per record with `date`, `channel`, `text` and
  `status` (`idea`, `draft`, `ready`, `posted`).
- `mktsettings`: one record with the marketing goal (`goalNew`: new customers per month).

### Busy Growth (a growth folder)
A growth folder holds one person's growth, not a business. Its `settings` add `suite: "growth"`,
`headline` (what they do now), `targetRole`, `goal` and `learnHoursWeek`. Files kept in the Library
sit in `library/` inside the folder; files dropped there outside Busy are picked up as records.
- `library`: the Library. `kind` is `link`, `note` or `file`; `url`, `path` (`library/…`) and
  `fileName`; `notes` (why it matters), `highlights`, `text` (the words of text, PDF, Word and other
  Office files, for search; `textTried` once Busy has tried), `tags` (comma-separated text), `skillIds`, `status` (`to-read`, `reading`, `read`),
  `addedAt`, `readAt`.
- `learning`: things to learn: `title`, `kind` (`course`, `book`, `video`, `project`, `certificate`,
  `other`), `provider`, `url`, `skillIds`, `start`, `due`, `hoursPlanned`, `status` (`planned`,
  `doing`, `done`, `dropped`), `doneAt`, `notes`, and `sessions`: `{ date, minutes }` per sitting.
- `skills`: the Skills Map: `name`, `category`, `level` and `target`, each 1 (aware) to 5 (expert).
- `wins`: the Wins Log: `date`, `title`, `what`, `result`, `proof`, `skillIds`, `tags`.
- `applications`: the Job Tracker. `company`, `role`, `url`, `location`, `salary`, `source`, `contact`;
  `status` is `saved`, `applied`, `interview`, `offer`, or closed as `accepted`, `rejected`, `withdrawn`,
  `no-answer`; `savedAt`, `appliedAt`, `closedAt`; `nextDate` and `nextStep` (the follow-up, set a week
  after applying); `reachedInterview` and `heardBack` for the stats; `adText` (the pasted job ad),
  `notes`, `letter` (the cover letter); `cvId` (the CV version sent), `contactId` (who you know there), `storyIds`; `history`:
  `{ date, status }` per move.
- `career`: the career history every CV version picks from: `type` (`job`, `education`, `project`,
  `volunteer`), `title`, `org`, `place`, `start` and `end` (months), `current`, `bullets` (one per line).
- `cvs`: CV versions: `name`, `headline`, `summary`, `include` (career ids shown; absent means all),
  `skillIds` and `winIds` (in the order shown), `extras` (one per line). PDFs are saved in `CVs/`.
- `stories`: interview stories: `title`, `situation`, `task`, `action`, `result`, `skillIds`, `winId`
  (the win it grew from), `tags`, `practised` (times) and `lastPractised`.
- `contacts`: the network: `name`, `how` (`colleague`, `manager`, `mentor`, `recruiter`, `friend`,
  `event`, `other`), `role`, `org`, `email`, `phone`, `linkedin`, `tags`, `notes`; `every` (keep in touch
  every N months, empty for no reminder), `nextDate` (a set catch-up date, which wins over `every`),
  `lastContact`, and `log`: `{ date, note }` per chat, newest first.
- `reviews`: weekly reviews, one per week: `week` (its Monday), `went`, `hard`, `energy` (1 to 5),
  `next` (next week's plan, one per line), `nextDone` (the line numbers ticked off a week later),
  `focusSkillId`, and that week's numbers as they were: `minutes` learned, `finished`, `wins`, `applied`, `read`.
  Growth settings also hold `phone` and `city`, for the CV.

### Olaf (paid edition)
- `olaf-files`: Olaf's workspace, one markdown file per record by `path`.
- `olaf-sessions`: conversations, kept exactly as sent so they can continue (the newest 15
  finished ones are kept).
- `olaf-setup`: which setup steps the owner skipped.

## Kept outside the business folder

These belong to one browser, never to the business, and are never in a backup:
the Claude API key (`bw.claudeKey`), AI model and monthly limit, AI spend per month, the theme,
the storage choice (`bw.mode`; the folder handle itself is in IndexedDB), the last 30 problems for
the problem report (`bw.problems`), and small reminders such as when Olaf was last suggested.
