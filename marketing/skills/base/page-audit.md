# Page Audit

A single audit that covers both dimensions a page needs to succeed: **ranking** and **converting**.
SEO tells you how to get people there. CRO tells you what happens when they arrive. Auditing
them separately misses the interaction, a page that ranks but does not convert is as broken as
one that converts for the tiny audience that finds it.

---

## Step 0: Load Context

Check for brand/product context files before asking questions:
```
the Brand Profile
the Brand Profile
the Learnings log
```
Read in the order above, the first match wins.

---

## Step 1: Audit Setup

Confirm or ask:

```markdown
### Audit Setup

**Page URL or Content**: [URL or paste content]
**Page Type**: [blog post / landing page / homepage / pricing / feature / about]
**Primary Keyword** (SEO target): [keyword]
**Primary Conversion Goal**: [sign up / request demo / purchase / download / contact sales]
**Traffic Source**: [organic / paid / email / social: affects messaging match expectations]
**Current Situation**: [rankings dropped / not converting / pre-publish check / general review]
**Heatmap/Session Data Available?**: [yes/no: if yes, paste key findings]
```

---

## Part A: SEO Audit

### A1. Title Tag

| Criterion | Status | Notes |
|-----------|--------|-------|
| 50 to 60 characters | ✅/⚠️/❌ | |
| Primary keyword included | ✅/⚠️/❌ | Position: front/middle/end |
| Unique across site | ✅/⚠️/❌ | |
| Compelling and click-worthy | ✅/⚠️/❌ | |
| Matches search intent | ✅/⚠️/❌ | |

**Title Score**: [X]/10 | **Recommended title**: "[suggestion]"

### A2. Meta Description

| Criterion | Status | Notes |
|-----------|--------|-------|
| 150 to 160 characters | ✅/⚠️/❌ | |
| Primary keyword included | ✅/⚠️/❌ | |
| Call-to-action present | ✅/⚠️/❌ | |
| Accurately describes page | ✅/⚠️/❌ | |

**Meta Score**: [X]/10 | **Recommended description**: "[suggestion]" ([X] chars)

### A3. Header Structure

Map current hierarchy (H1 → H2 → H3), then check:

| Criterion | Status | Notes |
|-----------|--------|-------|
| Single H1 | ✅/⚠️/❌ | Found: [X] H1s |
| H1 includes primary keyword | ✅/⚠️/❌ | |
| Logical hierarchy (no skipped levels) | ✅/⚠️/❌ | |
| H2s include secondary keywords | ✅/⚠️/❌ | [X]/[Y] contain keywords |
| Headers are descriptive (not generic) | ✅/⚠️/❌ | |

**Header Score**: [X]/10

### A4. Keyword Placement

| Location | Primary Keyword | Secondary Keywords | Notes |
|----------|-----------------|--------------------|-------|
| Title tag | ✅/❌ | N/A | |
| H1 | ✅/❌ | | |
| First 100 words | ✅/❌ | | |
| ≥1 H2 | ✅/❌ | | |
| Body paragraphs | density: [X]% | | |
| Image alt text | ✅/❌ | | |
| Conclusion | ✅/❌ | | |

### A5. Content Quality (CORE-EEAT Quick Scan)

| ID | Standard | Status |
|----|----------|--------|
| C01 | Title promise matches content | ✅/⚠️/❌ |
| C02 | Core answer in first 150 words | ✅/⚠️/❌ |
| O01 | H1→H2→H3, no level skipping | ✅/⚠️/❌ |
| O02 | TL;DR / Findings present | ✅/⚠️/❌ |
| O06 | Paragraphs 3 to 5 sentences; one topic per section | ✅/⚠️/❌ |
| R01 | ≥5 precise numbers with units | ✅/⚠️/❌ |
| R02 | ≥1 external citation per 500 words | ✅/⚠️/❌ |
| R04 | Every claim backed by evidence | ✅/⚠️/❌ |

### A6. Internal + External Links

- Internal links: [count]: Recommended additions: [list]
- External links: [count]: Authority level of sources: [assessment]
- Broken links: [any found]

### A7. Technical On-Page

| Element | Status | Notes |
|---------|--------|-------|
| URL clean and keyword-containing | ✅/⚠️/❌ | |
| Canonical tag correct | ✅/⚠️/❌ | |
| Mobile rendering | ✅/⚠️/❌ | |
| Page speed signals | ✅/⚠️/❌ | |
| Image alt text present | ✅/⚠️/❌ | |
| Schema markup present | ✅/⚠️/❌ | |

**SEO Score: [X]/100**

---

## Part B: Conversion Audit

### B1. Value Proposition Clarity (Highest Impact)

- Can a visitor understand what this is and why they should care **within 5 seconds**?
- Is the primary benefit specific and differentiated, or vague ("simplify your workflow")?
- Is it written in customer language, or company language?

**Finding**: [clear / unclear / missing] | **Issue**: [describe]

### B2. Headline Effectiveness

- Does it communicate the core value proposition?
- Is it specific enough to be meaningful?
- Does it match the traffic source's messaging?

**Headline options if rewrite needed** (provide 2 to 3):
- Option A: [copy]: [rationale]
- Option B: [copy]: [rationale]

### B3. CTA Placement, Copy, Hierarchy

| Element | Finding |
|---------|---------|
| Primary CTA visible above fold? | ✅/❌ |
| CTA copy communicates value (beyond the action)? | ✅/❌ |
| Single clear primary action? | ✅/❌ |
| CTAs repeated at decision points? | ✅/❌ |
| Primary vs. secondary CTA hierarchy clear? | ✅/❌ |

**CTA alternatives** (if rewrite needed):
- Strong: "[Action verb] + [what they get]"

### B4. Trust Signals & Social Proof

| Type | Present? | Placement Quality |
|------|----------|------------------|
| Customer logos | ✅/❌ | |
| Testimonials (specific, attributed) | ✅/❌ | |
| Case study numbers | ✅/❌ | |
| Review scores | ✅/❌ | |
| Security/compliance badges | ✅/❌ | N/A if not relevant |

### B5. Objection Handling

Common objections not addressed on this page:
- [ ] Price / value concern
- [ ] "Will this work for my situation?"
- [ ] Implementation complexity
- [ ] "What if it does not work?" / risk

### B6. Friction Points

| Source | Found? | Severity |
|--------|--------|----------|
| Too many form fields | ✅/❌ | High/Med/Low |
| Unclear next steps after CTA | ✅/❌ | |
| Navigation distracts from conversion goal | ✅/❌ | |
| Mobile experience issues | ✅/❌ | |
| Page load visible issues | ✅/❌ | |

**CRO Score: [X]/100**

---

## Combined Fix Priority List

Consolidate both audits into a single action list, ordered by expected impact:

### Critical: Fix Immediately
(Issues that are likely blocking rankings OR conversions significantly)

1. [SEO/CRO] [Issue] → [Specific fix] → [Expected impact]

### High Priority: Fix This Sprint

2. [Issue] → [Fix] → [Impact]

### Quick Wins: Low Effort, Meaningful Gain

3. [Issue] → [Fix] → [Impact]

### Test: Hypotheses Worth A/B Testing

4. [Hypothesis]: do not assume, validate first

### Minor: Nice to Have

5. [Issue] → [Fix]

---

## Save Results

After delivering audit findings, ask: "Save these results for future sessions?"

If yes, write a dated summary to the Learnings log[page-slug].md` containing:
- One-line verdict (SEO score + CRO score)
- Top 3 to 5 actions
- Open loops or blockers

---

## Next Best Skills

- **content-refresher**: turn SEO findings into concrete content edits
- **content-writer**: if the page needs a full copy rewrite
- **ab-test**: to test CRO hypotheses properly before shipping
- **technical-seo-checker**: for deeper technical audit (crawlability, Core Web Vitals, sitemaps)
