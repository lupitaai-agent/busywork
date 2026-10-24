# Newsroom

Your daily content radar. Scans industry news, surfaces what is worth writing about,
drafts the angles, and handles all production automatically. Your job is one decision:
which story and which angle. Everything else is automated.

---

## Step 1: Load Configuration

Read the Learnings log to get:
- Keyword list to search (currently scoped to Brand, Branding, Brand Strategy, and Marketing: see the file for the exact list, and do not hardcode topics here instead of reading it)
- Publication threshold (default: 5 sources)
- Audience preference
- Default content category
- Any excluded topics or sources

Also read `the Brand Profile` for brand voice and ICP context.

This skill intentionally does not hardcode a topic list of its own. the Learnings log
is the single source of truth for what gets scanned, and it is meant to be edited directly
as the business's priorities change. If that file is ever missing or empty, ask the owner what
to scan for rather than falling back to a guessed or remembered topic list.

---

## Step 2: Scan for Topics

Search for recent news (last 24 to 48 hours) across each keyword cluster from the config.

For each topic found, count independent sources covering it.
**Only surface topics with [threshold] or more independent sources.**

Assess relevance: does this topic connect to the business's category and its category entry points (from the Brand Profile), its customers, or
its competitive environment? Filter out noise.

Aim to surface **2 to 4 qualifying topics maximum**. Quality over quantity.

---

## Step 3: Generate Narrative Angles

For each qualifying topic, generate **2 to 3 short narrative angles**: different ways
the business could respond to or own this story.

Format for presentation:

```
📰 TOPIC: [Topic headline: what happened]
Sources: [X publications] · [time ago]

  Angle A: [Angle name]
  "[One sentence pitch: what the article says and why it is worth writing]"
  Best for: [Brand & Marketing Research / Deep Dive / Product Update / etc.]
  Buying situation it connects to: [category entry point from the Brand Profile]

  Angle B: [Angle name]
  "[One sentence pitch]"
  Best for: [category]
  ICP: [audience]

  Angle C: [Angle name] (optional)
  "[One sentence pitch]"
  Best for: [category]
  ICP: [audience]
```

---

## Step 4: OWNER DECISION POINT

Present all qualifying topics and their angles. Ask:

> "Which angle would you like to develop today? Reply with the topic number
> and angle letter (e.g. '1B'), or 'skip all' if nothing feels right today."

**Wait for the owner's response before proceeding.**

If he picks an angle: confirm the selection and proceed to Step 5.
If he says skip all: acknowledge, note it in the session, end the newsroom run.
If he wants to combine angles: ask him to describe the combined angle in one sentence,
then use that as the brief for content-writer.

---

## Step 5: Automated Production Chain

Run the following automatically, without interrupting the owner between steps.
Show a brief status line as each step completes.

```
✓ content-writer: drafting [title]...
✓ geo-content-optimizer: optimising for AI citations...
✓ meta-tags-optimizer: writing title tag + meta description...
✓ content-quality-auditor: running CORE-EEAT audit...
```

### content-writer inputs
- Selected angle as the brief
- Target keyword (derived from the topic)
- ICP from the angle selection
- Content category from the angle selection
- Full brand context from product-marketing-context.md
- Instruction: avoid AI writing tells listed in brand voice

### geo-content-optimizer
Run on the finished draft. Optimise for AI citation (ChatGPT, Perplexity,
Google AI Overviews). Add definition, Q&A, and statistical elements where relevant.

### meta-tags-optimizer
Generate: title tag (under 60 chars, keyword-first), meta description (150 to 160 chars,
includes primary keyword + CTA), OG title and description for social sharing.

### content-quality-auditor
Run full CORE-EEAT audit. Produce:
- Overall score (0 to 100)
- Pass/warn/fail on each dimension
- List of items to fix before publishing (if any)
- Ship / No-ship verdict

---

## Step 6: Deposit in the Studio's saved results

Write the following entry to the Learnings log under **Pending Review**:

```
| [#] | [Title] | [Category] | Newsroom | [Score]/100 | [Today's date] | Pending |
```

Then present the full draft to the owner in the session:

```
✅ Draft ready: [Title]
CORE-EEAT Score: [X]/100 · [Ship / Revise verdict]

[Full article text]

---
META
Title tag: [title tag]
Meta description: [meta description]
OG title: [og title]

---
QUALITY FLAGS (if any)
[List any items the auditor flagged for attention]

---
To approve: say "approve this"
To edit: make your changes and say "save approved version"
To send back for revision: say "revise: [your note]"
```

---

## Scheduling Note (for onboarding)

During onboarding, ask:

> "Would you like the newsroom to run automatically on a schedule, or
> would you prefer to trigger it manually each day?"
>
> Options:
> - **Manual**: type "newsroom" whenever you want a scan
> - **Daily morning**: runs automatically, results waiting when you open Claude
> - **Daily evening**: runs at end of day, ready for next morning

If a schedule is chosen, use the `schedule` skill to create a recurring task.
Note the schedule setting in the Learnings log.

---

## Error Handling

**No topics found today:** State it clearly: "Nothing hit the 5-source threshold
today. The keywords scanned were [list, from the Learnings log]. You can lower
the threshold in newsroom-config.md or trigger manually tomorrow."

**Quality score below 60:** Do not deposit in review queue as-is. Flag it: "This draft
scored [X]/100: below the publish threshold. Here is what needs fixing: [list]. Should I
revise automatically or would you like to adjust the brief?"

**the owner skips all angles:** Acknowledge and close. No draft is produced.
Log the skip in a brief note at the bottom of newsroom-config.md for pattern tracking.

---

## Step 7: Dashboard Sync

After topics are surfaced (Step 3) AND after a draft is deposited (Step 6),
run `dashboard-sync` to update the dashboard state:

**After Step 3 (topics surfaced):**
- Update `newsroom.lastRun`, `newsroom.topicsFound`, `newsroom.topics[]`
- Each topic entry includes: id, title, sourceCount, timeAgo, category, briefCmd
- **IMPORTANT: Topic IDs must be date-stamped and unique per scan.**
  Use format `news-YYYYMMDD-N` (e.g. `news-20260807-0`, `news-20260807-1`).
  Never reuse generic IDs like `news-live-0`, the browser caches dismissed IDs in
  localStorage and will silently hide any topic whose ID was dismissed in a previous session.

**After Step 6 (draft deposited):**
- Add the new item to `reviewQueue.items[]`
- Increment `reviewQueue.pending`

End with: "✓ Dashboard updated: hit ↺ Refresh to see today's topics and
the new draft in the the Studio's saved results."

---

## Next Best Skills
- **inbox-writer**: if the owner has his own material to work from instead of news
- **content-quality-auditor**: to re-audit after the owner edits the draft
- **competitor-analysis**: if a topic reveals a competitive angle worth deep research
