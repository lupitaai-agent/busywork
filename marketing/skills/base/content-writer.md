# Content Writer

Write marketing content that ranks in search **and** converts readers into customers. Every asset
produced by this skill is simultaneously SEO-optimised and conversion-focused, because those two
goals are not in conflict.

---

## Step 0: Load Brand Voice Context

**Before asking any questions**, check whether a brand voice or product marketing context file exists:

```
the Brand Profile
the Brand Profile
the Learnings log
```

Read in the order above, the first match wins. Use that context; only ask for information not
already covered or specific to this task.

---

## Step 1: Gather Requirements

Ask for or confirm the following. For blog posts and articles, focus on keyword brief. For
website copy (landing pages, homepages), focus on audience and conversion goal.

```markdown
### Content Brief

**Content Type**: [blog post / article / guide / landing page / homepage / feature page / pricing page / about page / product description]
**Topic / Page**: [what is this about]
**Primary Keyword** (if SEO content): [keyword]
**Secondary Keywords**: [2 to 5 related terms]
**Target Audience**: [who is reading this, what do they care about]
**Primary Goal**: [rank for keyword / convert visitors / educate / build trust]
**Primary CTA**: [what one action should the reader take]
**Tone & Voice**: [casual / professional / technical / bold, or read from brand context]
**Target Word Count**: [e.g. 1,200 words for a landing page, 2,000 for an article]
**Traffic Source** (website copy): [ads / organic / email: affects assumed knowledge]
**Proof Points Available**: [numbers, testimonials, case studies, customer quotes]
**Competitor URLs** (optional): [pages to beat or reference]
```

---

## Step 2: Apply Copywriting Principles

Every piece of content follows these rules, regardless of format:

| Principle | Rule |
|-----------|------|
| **Clarity over cleverness** | If clear vs. creative, choose clear |
| **Benefits over features** | Features = what it does. Benefits = what that means for the reader |
| **Specificity over vagueness** | "Cut reporting from 4 hours to 15 minutes" beats "save time" |
| **Customer language** | Use the words your audience uses: mirror voice-of-customer |
| **One idea per section** | Each section advances one argument |
| **Active voice** | "We generate reports" not "Reports are generated" |
| **No filler words** | Remove "very," "really," "almost," and every word on the banned list in the Brand Profile |
| **No exclamation points** | Confidence does not need exclamation marks |

---

## Step 3: SEO Planning (for articles, guides, blog posts)

For search-optimised content, plan keyword placement before writing:

```markdown
### Keyword Map

- Primary keyword → title, H1, first 100 words, ≥1 H2, conclusion
- Secondary keywords → H2 headings, body paragraphs
- LSI/semantic variants → natural placement throughout
- Questions (PAA) → use as H2/H3s or in FAQ section

### SERP Context
- Top results format: [what is currently ranking: guides, listicles, comparisons?]
- Common sections in top results: [list]
- SERP features present: [featured snippets, PAA, tables?]
- Content angle: [what unique perspective will make this worth ranking?]
```

---

## Step 4: Structure the Content

### For Articles & Blog Posts

```
H1: Primary keyword · compelling · under 60 chars
  Introduction (100 to 150 words): hook + promise + primary keyword in first 100 words
  [Table of Contents for articles with 3+ H2 sections]
  H2: Section 1 (secondary keyword)
    H3: Sub-topic
    H3: Sub-topic
  H2: Section 2
  ...
  H2: FAQ (3 to 5 questions with 40 to 60 word answers: optimised for featured snippets)
  H2: Conclusion (recap + primary keyword + clear CTA)
```

### For Website Copy (Landing Pages, Homepages, Feature Pages)

```
Above the fold:
  Headline: core value proposition, specific, benefit-led
  Subheadline: 1 to 2 sentences expanding on headline
  Primary CTA: [Action verb] + [what they get]

Core sections:
  Social Proof: logos, stats, short testimonials
  Problem/Pain: show you understand their situation
  Solution/Benefits: 3 to 5 key outcomes (not feature lists)
  How It Works: 3 to 4 steps, reduce perceived complexity
  Objection Handling: FAQ, comparisons, guarantees
  Final CTA: recap value, repeat CTA, risk reversal
```

**Headline formulas:**
- "{Achieve outcome} without {pain point}"
- "The {category} for {ICP audience}"
- "Never {unpleasant event} again"
- "{Question highlighting main pain point}"

**CTA formula:** [Action Verb] + [What They Get] + [Qualifier if needed]
- Strong: "Start Free Trial," "Get the Complete Guide," "See Pricing for My Team"
- Weak (avoid): Submit, Sign Up, Learn More, Click Here, Get Started

---

## Step 5: Write the Content

Write the full content following the structure above. During writing:

- Apply CORE-EEAT standards inline (see checklist below)
- Information Gain check: work in at least one first-party data point that no competitor
  can copy: platform benchmarks, pricing observations, usage data, or customer results.
  Verify the figure against the fact register or a primary source before using it. If nothing
  first-party fits the topic, ask for a data point or flag the gap in the draft rather than
  inventing one
- Include 2 to 5 internal link suggestions with anchor text
- Include 2 to 3 external authoritative source references, formatted per the mandatory Sources block below
- For website copy: annotate key decisions (why this headline, which principle it applies)
- For CTAs: provide 2 to 3 options with rationale

### Sources section (mandatory format, every time, for every destination)

Any time this skill produces HTML output (blog posts, landing pages, investor portal pages, or any other page-based deliverable), external citations end in a live, clickable Sources block, not a plain list. This is the format from the first draft, never a later formatting pass:

```html
<h3>Sources</h3>
<ul>
<li><a href="[FULL absolute URL]" target="_blank" rel="noopener">[Source name/publication, date if relevant: what specific claim or figure it supports]</a></li>
<li><a href="[FULL absolute URL]" target="_blank" rel="noopener">[Source name/publication, date if relevant: what specific claim or figure it supports]</a></li>
</ul>
```

Rules:
- The heading is a real `<h3>Sources</h3>` tag, never a plain bold line, never a markdown list with domain names as plain text.
- Every source is a complete, absolute URL (`https://...`) inside a real `<a href="...">`. A bare domain name written as plain text (for example "nvidianews.nvidia.com" with no href) is a defect.
- Every `<a>` includes `target="_blank" rel="noopener"`.
- The link text names the source and states what it backs: publication or organisation, date where relevant, and the specific figure or claim, not a bare or undescribed URL.
- If the output is plain text or Markdown rather than HTML (for example a brief destined for another format), still list every source as a real Markdown link (`[Source name: what it supports](https://...)`), never a bare domain name. Convert to the `<h3>`/`<ul>`/`<a>` form the moment the content moves into an HTML deliverable.
- This applies to every content type this skill produces, blog articles, landing pages, and investor content alike. It is not specific to the WordPress packaging step.

### Table styling (mandatory format whenever this skill produces a data table)

Any table this skill outputs, comparison tables, spec tables, metrics tables, follows the same house style regardless of destination:
- Header row (`<th>`): `background:#3b61ad` (brand blue), white text, bold. Never `#1a202c` or black, never unstyled.
- Body rows: zebra-striped `#ffffff` / `#f1f5f9`, first column bold on `#fafbfd`, borders `1px solid #e2e8f0`.
- See `wordpress-article` skill for the exact copy-paste HTML template. Use it verbatim, do not improvise a different table style.

---

## Step 6: CORE-EEAT Self-Check

Before delivering, verify these 16 standards:

| ID | Standard | Check |
|----|----------|-------|
| C01 | Title promise matches content delivery | ✅ / ⚠️ / ❌ |
| C02 | Core answer in first 150 words | ✅ / ⚠️ / ❌ |
| C06 | Audience explicitly addressed | ✅ / ⚠️ / ❌ |
| C10 | Conclusion answers opening question + gives next steps | ✅ / ⚠️ / ❌ |
| O01 | H1→H2→H3 hierarchy, no level skipping | ✅ / ⚠️ / ❌ |
| O02 | TL;DR / Findings box present (articles) | ✅ / ⚠️ / ❌ |
| O06 | Each section covers one topic; paragraphs 3 to 5 sentences | ✅ / ⚠️ / ❌ |
| O09 | No filler; consistent terminology | ✅ / ⚠️ / ❌ |
| R01 | ≥5 precise numbers with units | ✅ / ⚠️ / ❌ |
| R02 | ≥1 external citation per 500 words | ✅ / ⚠️ / ❌ |
| R04 | Every claim backed by evidence | ✅ / ⚠️ / ❌ |
| R07 | Full names for people/orgs/products | ✅ / ⚠️ / ❌ |
| C03 | ≥3 query variants (synonyms, long-tail) covered | ✅ / ⚠️ / ❌ |
| O08 | Table of contents with jump links (articles) | ✅ / ⚠️ / ❌ |
| O10 | Images/videos have captions | ✅ / ⚠️ / ❌ |
| E07 | Downloadable template, checklist, or tool included (guides) | ✅ / ⚠️ / ❌ |
| M26A | Named author with verifiable credentials attributed | ✅ / ⚠️ / ❌ |
| M26B | Information Gain: content adds ≥1 original data point, perspective, or insight not already in top-ranking results | ✅ / ⚠️ / ❌ |
| S01 | Sources rendered as `<h3>Sources</h3>` + `<ul><li><a target="_blank" rel="noopener">`, not a bare domain or plain list | ✅ / ⚠️ / ❌ |
| S02 | Any table uses `#3b61ad` blue headers with zebra-striped rows, never black or unstyled | ✅ / ⚠️ / ❌ |

**Auto-fix silently (document in Changes Made block):**
- Meta description >160 chars → rewrite preserving keyword + CTA
- Title >60 chars → shorten preserving primary keyword
- Keyword density >2% → replace with semantic variants
- Paragraphs >5 sentences → split at natural break
- Missing TOC on 3+ H2 articles → generate with anchor links

**Ask before changing:**
- H1 wording (brand voice impact)
- Tone shifts (formal ↔ casual)
- Removing/replacing external links
- Content length ±30% from target
- Claims that cannot be verified against cited source

---

## Step 7: Deliver Output

Structure the output as:

1. **The content** (full draft, formatted for the content type)
2. **Author Attribution Block** (for all articles and blog posts):
   ```
   Byline: [Name], [Title], [Company] (default author unless another is specified; pull the
   default from the Brand Profile or the Learnings log)
   Bio (40 to 60 words, default): Pull the company description and author background from
   the Brand Profile and the Learnings log State the
   author's title, what they lead (content, brand, demand, etc.), and one line of company
   description. Extend with expertise areas from the Learnings log once confirmed.
   Author schema: JSON-LD Person schema with the author's name, jobTitle, worksFor set to the
   company name, url pointing to the site author page, and sameAs linking to their LinkedIn
   profile (confirm the URL from the Learnings log; flag if missing).
   Publishing note: Publish under the author's name, not a generic brand account.
   ```
   *Why this matters: Google's March 2026 Core Update re-weighted author expertise as a primary
   ranking signal. Named human authors with verifiable credentials outperform anonymous
   brand-attributed content. If no author name is available, flag this as a quality gap.*
3. **SEO summary** (for articles): keyword placement, meta title + description, word count, CORE-EEAT score
4. **Copy annotations** (for website copy): rationale for headline, CTA choices, key structural decisions
5. **Alternatives**: 2 to 3 headline and CTA variants
6. **Changes Made** block (if auto-fixes were applied)
7. **Next step recommendation**: run `content-quality-auditor` before publishing

---

## Page-Specific Notes

| Page Type | Key Focus |
|-----------|-----------|
| Homepage | Multiple audiences; broadest value prop; clear paths for different intents |
| Landing page | Single message, single CTA; match headline to traffic source |
| Pricing page | Help visitors choose; address "which plan is right for me?"; make recommended plan obvious |
| Feature page | Feature → benefit → outcome; show use cases; clear try/buy path |
| About page | Story of why you exist; connect mission to customer benefit; still include a CTA |
| Blog post | Search intent match; front-load value; data and examples; FAQ for snippets |
| How-to guide | Sequential steps; visual structure; checklist or template as download |
| Comparison | Honest framing; help reader make the right choice, even if it is not always you |

---

## Dashboard Sync

After delivering a completed draft, deposit it to the review queue and update the `vf-state` JSON block in `the Studio`:

1. Add an entry to `reviewQueue.items[]`:
```json
{
  "id": "draft-<YYYYMMDD>-<n>",
  "title": "<article or page title>",
  "category": "<Guide | Deep Dive | News | Client Story>",
  "source": "content-writer",
  "score": <CORE_EEAT_score_from_Step_6>,
  "date": "<DD Mon YYYY>",
  "status": "pending"
}
```
2. Increment `reviewQueue.pending` by 1.
3. Update `lastSynced` to the current ISO timestamp.
4. Also update the Learnings log with the new entry.

Always end with:
> ✓ Dashboard updated: hit ↺ Refresh to see the draft in your review queue.

## Next Best Skills

- **content-quality-auditor**: run before publishing; 80-item quality gate
- **geo-content-optimizer**: after writing, optimise for AI citations (ChatGPT, Perplexity)
- **meta-tags-optimizer**: write title tags, meta descriptions, OG tags
- **page-audit**: if the page also needs SEO health + conversion rate review
