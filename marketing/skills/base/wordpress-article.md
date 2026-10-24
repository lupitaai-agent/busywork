# WordPress Article Skill

This skill produces a complete, publication-ready WordPress code file (`.md`) for a blog article. The file is pasted directly into WordPress → Code editor (Gutenberg) or an HTML widget (Elementor). It must be correct on first generation: no schema retrofitting, no entity fixes, no internal linking passes needed after the fact.

---

## Step 0: Load Brand Voice (mandatory)

**Before writing any prose**, read the brand voice file:

```
the Brand Profile
```

This file governs all writing decisions. Key rules it contains that are non-negotiable for every article:
- No em dashes in any form (the Unicode character, the HTML entity, and the double hyphen approximation)
- Contractions are allowed and expected where they read naturally ("you're," "it's," "don't"): most small businesses talk to customers, not procurement committees (confirm against brand-voice.md)
- No setup-and-subvert constructions (contrast-reversal sentences that define a thing by what it is not)
- No banned AI vocabulary (see the full list in brand-voice.md)
- Transition words in 30%+ of sentences: vary across categories, do not repeat the same word more than 3 times
- Lead with the finding: conclusion first, evidence second, context third
- Active voice for all claims and findings
- No competitor names: refer to "what most businesses experience with a traditional agency or a stack of separate tools"
- Minimum 1 external citation per 500 words; no vague attribution ("analysts say"): name the source

Do not proceed to writing the body until this file has been read.

---

## Before You Write Anything

**Check the live article index first.** You will need it for internal links.

The site structure may change over time, so this skill deliberately does not hardcode a list of published articles. Instead:

1. Fetch the live site's article or research index (check `[SITE-URL]/[articles-index]` and `the Brand Profile` → Site Structure for whatever the current confirmed index page is).
2. Extract every published article URL you can confirm is actually live.
3. These are the **only URLs you may link to** from within the article body. Do not link to any article that is not confirmed live: it will produce a 404.
4. If you cannot confirm the index (site not yet live, structure not yet rebuilt), skip internal links entirely rather than inventing a plausible-looking URL. Note the gap for the owner instead of guessing.

---

## File Structure

Every `.md` file has exactly four parts, in this order:

```
1. Yoast fields (metadata table)
2. Step 1: Schema block (JSON-LD, paste into WordPress Code tab)
3. Step 2: Body (HTML, paste into WordPress Visual/Code editor) — the live Sources section lives inside this HTML, as its final block. It is not a separate paste.
4. Step 3: Sources (reference list, for internal fact-checking and the fact register only. It mirrors the `<h3>Sources</h3>` block already embedded at the end of Step 2. It is never pasted into WordPress on its own, and it is never the only place the sources appear.)
```

---

## Part 1: Yoast Fields

```markdown
## Yoast fields

| Field | Value |
|---|---|
| Focus keyphrase | [primary keyword, 2-4 words] |
| SEO title | [≤60 chars, include keyphrase near start] |
| Meta description | [≤160 chars, include keyphrase, value proposition] |
| Slug | [kebab-case, no /blog/ prefix, no trailing words like "guide"] |
| Image alt text | [describe the actual image, include keyphrase] |
```

Slug rules:
- Format: `keyword-phrase-year` or `keyword-phrase`: never `/blog/keyword`
- Canonical URL will be: `[SITE-URL]/[slug]/` — **confirm the exact path structure against the live site before publishing.** `(ask the owner)`
- Match the slug to how the article will appear on the live article index

---

## Part 2: Schema Block (Step 1)

Paste this as a `<script>` tag in WordPress → Code tab (Gutenberg) or in an HTML widget (Elementor).

The schema block always contains **three types in a single `@graph` array**:

> ⚠️ **CRITICAL: SpeakableSpecification placement:** `SpeakableSpecification` must ONLY appear as a `speakable` property nested inside `BlogPosting`. It must NEVER appear as a standalone node in the `@graph` array. Google cannot parse a standalone `SpeakableSpecification` and will flag it as "unparsable structured data", invalidating the schema. The correct pattern is shown below: `speakable` is a property of `BlogPosting`, not a sibling of it.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BlogPosting",
      "@id": "[SITE-URL]/[SLUG]/#article",
      "headline": "[Article headline: matches H1]",
      "description": "[Meta description: same as Yoast field]",
      "datePublished": "[YYYY-MM-DD]",
      "dateModified": "[YYYY-MM-DD]",
      "author": {
        "@type": "Person",
        "name": "[AUTHOR NAME]",
        "jobTitle": "[AUTHOR ROLE]",
        "sameAs": "[AUTHOR LINKEDIN URL]",
        "worksFor": { "@type": "Organization", "name": "[BUSINESS NAME]", "url": "[SITE-URL]" }
      },
      "publisher": {
        "@type": "Organization",
        "name": "[BUSINESS NAME]",
        "url": "[SITE-URL]",
        "logo": {
          "@type": "ImageObject",
          "url": "[SITE-URL]/path/to/logo.png"
        }
      },
      "image": {
        "@type": "ImageObject",
        "url": "[SITE-URL]/wp-content/uploads/[IMAGE-FILENAME].webp",
        "width": 1200,
        "height": 627
      },
      "mainEntityOfPage": { "@type": "WebPage", "@id": "[SITE-URL]/[SLUG]/" },
      "keywords": "[keyphrase, related terms, comma-separated]",
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": [".speakable-summary", ".speakable-finding"]
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "[Question text: matches H3 in FAQ section exactly]",
          "acceptedAnswer": { "@type": "Answer", "text": "[Answer: 1-4 sentences, plain factual language. No HTML, no CSS, no links, no promotional claims.]" }
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "[SITE-URL]/" },
        { "@type": "ListItem", "position": 2, "name": "Articles", "item": "[SITE-URL]/articles/" },
        { "@type": "ListItem", "position": 3, "name": "[Article title]", "item": "[SITE-URL]/[SLUG]/" }
      ]
    }
  ]
}
</script>
```

**Critical details:**
- The blog/articles breadcrumb URL above (`[SITE-URL]/articles/`) is a working assumption based on the current site structure noted in `product-marketing-context.md`. Confirm it against the live site before publishing.
- `datePublished` and `dateModified` are set to the planned publish date; the editor updates `dateModified` on revisions
- Use the exact slug from the Yoast fields table, no `/blog/` prefix
- Aim for 5 to 8 FAQ items; repeat the Question/Answer block as needed
- The JSON-LD FAQPage must mirror the visible FAQ exactly: same questions, same wording. Do not add questions in the schema that are not present on the page.

---

## Part 3: Body (Step 2)

### Speakable classes: how they work

Two CSS classes trigger AI speakable signals. Apply them in WordPress as follows:

**In Gutenberg (standard posts):** Add `speakable-summary` and `speakable-finding` via the block's Advanced → Additional CSS class(es) field.

**In Elementor (page-builder posts):** Add the class via the widget's Advanced tab → CSS Classes field. Do not add a `class=""` attribute directly to the HTML inside the widget: Elementor strips it.

### `.speakable-summary`, the key-finding div

Place this immediately after the opening paragraph, before the first H2. It is the lime-bordered box that states the single most important finding of the article.

```html
<div class="speakable-summary" style="background:#22232A;border-left:4px solid #CAFF15;padding:16px 20px;margin:24px 0;font-size:15px;color:#ffffff;line-height:1.7;">
  <strong>[One-sentence key finding, the article's core claim stated directly]</strong><br>
  [2-3 sentences expanding on the finding. Include at least one specific number. Write for a reader who will only read this box.]
</div>
```

### `.speakable-finding`, the first key claim paragraph

Apply the `speakable-finding` class to the first substantive paragraph that makes the article's primary claim. This is the paragraph an AI would read aloud to answer the question the article is optimised for. It should:
- Start with the claim, not with context
- Include the business name if the paragraph is about what they sell
- Be 2-4 sentences, self-contained

In the `.md` file, mark the relevant paragraph with a comment: `<!-- speakable-finding: apply class in Elementor Advanced tab -->`

### Brand anchor div

Use this once per article, typically in the "What This Means" or conclusion section. It connects the editorial content to what the business actually sells, without being a hard sales paragraph.

**The wording is not written here.** Use the canonical About block verbatim from
`the Brand Profile` → "Canonical About block". If that field is still
a `[FILL]` placeholder, onboarding has not run: ask the owner for the About text rather than
writing one, and never invent a description of their business.

```html
<div class="brand-anchor" style="background:[BRAND-PANEL-BG];border-left:4px solid [BRAND-ACCENT];padding:16px 20px;margin:24px 0;font-size:15px;line-height:1.7;">
  [Canonical About block, verbatim from the Brand Profile]
</div>
```

Colours come from the Brand Profile → Visual Identity. Do not hardcode a palette.

Adjust the surrounding framing to fit the article's context, but keep the About-block wording itself word-for-word.

### Table styling (mandatory — dark/lime house style, never the old blue)

Every data table uses the brand's own palette from the Brand Profile → Visual Identity. Use the primary accent for the header row and keep body rows on the background colour. A highly saturated accent is a highlight, not a background fill: do not set a table header to a full-bleed neon, it is hard to read at that scale.

Optional caption line, placed immediately above the table:

```html
<p style="font-size:11px;font-weight:700;color:#9a9bA5;text-transform:uppercase;letter-spacing:0.08em;margin:24px 0 8px;">Table 1: [short caption describing what the table shows]</p>
```

Table template (copy this structure for every table, adjust column count and content only):

```html
<table style="width:100%;border-collapse:collapse;margin:0 0 32px;font-size:14px;">
<thead><tr>
<th style="background:#22232A;color:#CAFF15;font-weight:700;text-align:left;padding:11px 14px;font-size:13px;border-bottom:2px solid #CAFF15;">[Column 1 header]</th>
<th style="background:#22232A;color:#CAFF15;font-weight:700;text-align:left;padding:11px 14px;font-size:13px;border-bottom:2px solid #CAFF15;">[Column 2 header]</th>
<th style="background:#22232A;color:#CAFF15;font-weight:700;text-align:left;padding:11px 14px;font-size:13px;border-bottom:2px solid #CAFF15;">[Column 3 header]</th>
</tr></thead>
<tbody>
<tr><td style="padding:10px 14px;border-bottom:1px solid #33343d;font-weight:700;color:#ffffff;background:#2A2B33;">[Row label]</td><td style="padding:10px 14px;border-bottom:1px solid #33343d;background:#1A1B1F;color:#ffffff;">[Value]</td><td style="padding:10px 14px;border-bottom:1px solid #33343d;background:#1A1B1F;color:#ffffff;">[Value]</td></tr>
<tr><td style="padding:10px 14px;border-bottom:1px solid #33343d;font-weight:700;color:#ffffff;background:#2A2B33;">[Row label]</td><td style="padding:10px 14px;border-bottom:1px solid #33343d;background:#22232A;color:#ffffff;">[Value]</td><td style="padding:10px 14px;border-bottom:1px solid #33343d;background:#22232A;color:#ffffff;">[Value]</td></tr>
</tbody>
</table>
```

Rules:
- Header row (`<th>`): dark background (`#22232A`), lime (`#CAFF15`) text, bold, with a 2px lime bottom border for definition. Never a solid lime background, never plain white/light styling.
- First column of each body row is bold, white text, on the card background (`#2A2B33`) to read as a row label.
- Remaining body cells alternate between `#1A1B1F` and `#22232A` row-by-row for readability, white text throughout. Do not use a single flat dark block with no zebra striping on tables of 4+ rows.
- Borders are `1px solid #33343d` (subtle dark slate), never a heavy black or bright border.
- Comparison tables (two products/options side by side) follow the same header and border rules; only the column count changes.

If an existing draft has an old blue (`#3b61ad`) or light table header, this is the fix: replace it with the dark/lime header above, and apply the dark zebra-striped `<td>` backgrounds.

### CTA block

End the body with this CTA before the FAQ section:

```html
<div style="background:#1A1B1F;border:1px solid #2A2B33;border-radius:4px;padding:24px 28px;margin:40px 0;text-align:center;">
  <p style="color:#ffffff;font-weight:700;font-size:16px;margin:0 0 16px;">[One-line value proposition relevant to this article's topic]</p>
  <a href="[SITE-URL]" style="display:inline-block;background:#CAFF15;color:#1A1B1F;font-weight:700;font-size:14px;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:3px;margin:0 8px;">[CTA TEXT]</a>
</div>
```

CTA text and destination come from `the Brand Profile` → Sales Motion & CTAs. Link only to URLs confirmed live. Never invent a subdomain (e.g. `portal.`, `app.`) or guess a contact email: a dead CTA is worse than no CTA.

### FAQ section

The FAQ H3 headings must match the `"name"` field in the FAQPage schema exactly: copy-paste, do not paraphrase.

```html
<h2>Frequently Asked Questions</h2>

<h3>[Question matching schema]</h3>
<p>[Answer: 1-4 sentences, factual and plain.]</p>
```

#### FAQ writing rules

The FAQ is a visible content section first, and the JSON-LD is a structured mirror of it. Write the FAQ for the page, then copy it into the schema: never the other way around.

**Questions (5 to 8 per article):**
- Each question must be directly about the article's main topic
- Prefer real user intent: "Why does this matter for a small business?", "What changed in 2026?", "How does this affect a business's marketing spend?"
- Avoid generic questions like "What is marketing?" unless the article is specifically about that
- Use the same key terms and entities as the article body: do not introduce new concepts in the FAQ that are not covered in the article

**Answers (1 to 4 sentences each):**
- Plain language, factual, direct
- If an answer runs long, split it into two separate FAQ items instead
- No calls to action, promotional claims, or sales language
- No links inside FAQ answers
- The business may be mentioned factually in 1 to 2 answers where it is genuinely the relevant answer. Do not force a brand mention into every answer: the About block handles entity reinforcement.
- Reflect current year and context: avoid outdated statistics

**Schema mirror rule:**
- The JSON-LD FAQPage must contain the same questions and answers as the visible FAQ, in the same wording
- Do not add extra questions to the JSON-LD that are not on the page
- Do not include nested HTML, CSS classes, inline styles, or comments inside the JSON `"text"` field

### About block

End every article with this standardised About block. Word-for-word consistency across all articles is required: it is the primary entity reinforcement signal for AI citation.

```html
<hr>

<h3>About [BUSINESS NAME]</h3>
<p>[Canonical About block, verbatim from the Brand Profile] <a href="[SITE URL]">Learn more at [DOMAIN]</a>.</p>
```

Both the business name and the About text come from
`the Brand Profile`. If they are still `[FILL]` placeholders,
stop and ask the owner — do not write a description of their business for them.

### Sources section (mandatory — the true last block of the Step 2 body)

Every article ends with a live, clickable Sources section, placed inside the Step 2 HTML, after the FAQ section. This is not the same thing as the Step 3 reference list at the bottom of the .md file: the reader-facing version below is what actually ships to WordPress.

```html
<h3>Sources</h3>
<ul>
<li><a href="[FULL absolute URL]" target="_blank" rel="noopener">[Source name/publication, date if relevant: what specific claim or figure it supports]</a></li>
<li><a href="[FULL absolute URL]" target="_blank" rel="noopener">[Source name/publication, date if relevant: what specific claim or figure it supports]</a></li>
</ul>
```

Rules:
- The heading is a real `<h3>Sources</h3>` tag, styled like every other H3 in the article. Never a plain bold line, never a markdown `###`, never left as unstyled text.
- Every source is a real `<li><a>` list item with a complete, absolute URL (`https://...`). A bare domain name with no `href` (for example, writing "example.com" as plain text instead of a link) is a defect and must be fixed.
- Every `<a>` includes `target="_blank" rel="noopener"` so the source opens in a new tab without exposing `window.opener`.
- One `<li>` per source. List them in the order first cited in the body, or grouped logically if that reads better.
- The link text names the source and states what it backs: publication or organisation, date where relevant, and the specific figure or claim it supports. Do not use bare, undescribed URLs as the link text.
- This section is mandatory on every article with external citations. An article that cites sources in the body but has no clickable Sources block at the end is incomplete.
- The Step 3 list later in the .md file must contain the exact same sources as this HTML block: it is a reference copy for the fact register, not an alternate or additional list.

If an existing draft has sources as a plain, non-clickable list under a "Step 3: Sources" markdown heading only (with no matching HTML block inside Step 2), this is the fix: build the `<h3>Sources</h3>` + `<ul><li><a>` block above from that list, insert it at the end of the Step 2 body after the FAQ, and keep the Step 3 markdown list as the internal reference copy.

---

## Entity Description: Canonical

Entity consistency is the single strongest signal for AI citation: the same business described
the same way, every time. That description is **not stored in this file** — it lives in
`the Brand Profile` so one edit updates every skill at once.

**Before writing, load these fields:**

| Field | Source |
|---|---|
| Business name | `product-marketing-context.md` → The Company → Name |
| Canonical About block | `product-marketing-context.md` → Canonical "About" block |
| Category | `product-marketing-context.md` → Category |
| What they sell | `product-marketing-context.md` → What You Actually Do |
| Site URL | `product-marketing-context.md` → Website |
| Named author | the Learnings log |
| Colours | `brand-voice.md` → Visual Identity |

Use the About block **verbatim** wherever it appears. Consistency matters more than variety here.

**If any of those fields is still `[FILL]`:** onboarding has not been completed. Stop and ask the
owner for the missing facts. Never write a description of someone's business for them, and never
invent a category, a founding story, or a tagline to fill a gap.

**Never invent proof.** Customer names, testimonials, usage statistics, and results must come from
the Learnings log. If a claim needs a number that does not exist there, flag it rather
than inventing one — a fabricated statistic in a published article is the worst possible outcome
for a small business's credibility.

---

## Internal Linking Rules

**Rule 1: Only link to confirmed live articles.**
Before writing the article, fetch the live article index (see "Before You Write Anything" above). Build your link list from what is actually published today. This list changes as content is published: do not rely on a cached or remembered list, always re-check.

**Rule 2: Use the confirmed canonical URL format.**
Use `[SITE-URL]/[slug]/` unless the live site's actual structure (confirmed at fetch time) shows otherwise. `(ask the owner)`

**Rule 3: Inline anchor text over standalone "read more" links.**
Link on meaningful anchor text within a sentence. Example: link "AI-visibility" to the GEO article, not a standalone "Read our GEO article here."

**Rule 4: 2 to 4 internal links per article.**
Enough to distribute equity and signal topical relationship; not so many that they feel forced.

**No hardcoded article list.**
Earlier versions of this skill hardcoded a list of "current published articles." That list is deliberately removed here: a stale hardcoded list silently produces 404s. Always fetch the live index instead.

---

## Quality checklist before delivering the file

- [ ] Yoast slug matches the `@id` and `mainEntityOfPage` in schema
- [ ] BreadcrumbList uses a URL confirmed against the live site (not assumed from memory)
- [ ] FAQ has 5 to 8 questions
- [ ] All FAQ questions reflect real user intent, not generic ("What is marketing?") questions
- [ ] All FAQ answers are 1 to 4 sentences, factual, no promotional language, no links
- [ ] All FAQ `"name"` fields in schema match H3 headings in the body exactly
- [ ] JSON-LD FAQPage contains no more questions than the visible FAQ on the page
- [ ] No nested HTML, CSS, or links inside JSON-LD `"text"` fields
- [ ] FAQ uses the same key terms and entities as the article body
- [ ] `.speakable-summary` div is present after the opening paragraph
- [ ] `.speakable-finding` paragraph is marked with a comment
- [ ] brand anchor div is present in the conclusion section
- [ ] About block uses the canonical entity description word-for-word
- [ ] No invented customer names, testimonials, or usage stats if none exist in the Learnings log
- [ ] All internal links are to confirmed live articles (checked against the live index, not a hardcoded list)
- [ ] Every table header (`<th>`) uses the dark/lime house style (`#22232A` background, `#CAFF15` text and bottom border), never the old blue or an unstyled default
- [ ] Table body rows use the dark zebra pattern (`#1A1B1F` / `#22232A`) with `#33343d` borders, first column bold on `#2A2B33`
- [ ] CTA links only to confirmed-live URLs: no invented subdomain or guessed email address
- [ ] A live `<h3>Sources</h3>` + `<ul><li><a href="..." target="_blank" rel="noopener">` block is present inside the Step 2 body, as the final section, after the FAQ
- [ ] Every source link is a complete absolute URL, not a bare domain name written as plain text
- [ ] The Step 3 reference list matches the sources actually linked inside Step 2, it is not a separate or additional set
- [ ] `datePublished` is set to a real date (ask if unknown: do not guess)
