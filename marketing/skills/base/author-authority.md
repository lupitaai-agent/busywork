# Author Authority

Google's March 2026 Core Update re-weighted author expertise as a first-class ranking signal.
Content attributed to named humans with verifiable credentials, a consistent publishing history,
and cross-platform presence outperforms identical anonymous content. This skill audits, builds,
and maintains those signals.

**System role**: Cross-cutting skill. Run once to establish baseline, then quarterly to maintain.
Feeds into every content workflow: every piece content-writer produces should carry the output
of this skill's author profile.

---

## When This Matters Most

- Starting a new content programme (establish the author profile before the first post goes live)
- Content scores well on CORE-EEAT but still is not ranking: author attribution is often the gap
- Preparing for a domain authority push
- Solo CMO or small team where one person's byline will appear on most content
- Any time the question is "why does their content rank and ours does not?"

---

## Step 1: Load Brand Context

Read `the Brand Profile` for company positioning, ICP, and tone.

Author authority work must be consistent with the brand, the author's personal positioning
should amplify the company's positioning, not contradict it.

---

## Step 2: Author Audit

Gather information about the author across all surfaces. Ask for or confirm:

```markdown
### Author Audit Setup

**Author name**: [full name]
**Job title**: [current title, company]
**LinkedIn URL**: [linkedin.com/in/...]
**Company website author page** (if exists): [URL]
**Current author bio on site**: [paste or "none"]
**Current author schema on site**: [paste or "none"]
**Articles published under this name** (company blog, guest posts): [list or "none yet"]
**Industry publications where author has appeared**: [list or "none"]
**Speaking or podcast appearances**: [list or "none"]
**Domain being assessed**: [domain]
```

---

## Step 3: Score Current E-E-A-T Author Signals

Score each signal as **Strong / Partial / Missing**:

```markdown
## E-E-A-T Author Signal Audit: [Author Name]
Audit date: [date]

### Experience Signals
| Signal | Status | Evidence |
|--------|--------|----------|
| First-person perspective in published content | Strong/Partial/Missing | |
| Published experience narratives (war stories, lessons) | Strong/Partial/Missing | |
| Demonstrable domain track record (years in role/industry) | Strong/Partial/Missing | |

### Expertise Signals
| Signal | Status | Evidence |
|--------|--------|----------|
| Author bio present on all published articles | Strong/Partial/Missing | |
| Bio includes verifiable credentials (title, company, tenure) | Strong/Partial/Missing | |
| LinkedIn profile complete and consistent with site bio | Strong/Partial/Missing | |
| LinkedIn content published in the domain (posts, articles) | Strong/Partial/Missing | |
| Guest posts / bylines on industry publications | Strong/Partial/Missing | |
| Quoted as an expert in external coverage | Strong/Partial/Missing | |

### Authoritativeness Signals
| Signal | Status | Evidence |
|--------|--------|----------|
| Author schema markup (Person JSON-LD) on site | Strong/Partial/Missing | |
| Author page on company website | Strong/Partial/Missing | |
| sameAs links connecting site to LinkedIn, company profiles | Strong/Partial/Missing | |
| Consistent author name format across all properties | Strong/Partial/Missing | |
| Knowledge Graph / AI systems recognise the author | Strong/Partial/Missing | |

### Trust Signals
| Signal | Status | Evidence |
|--------|--------|----------|
| Content attributed to author (not "Staff Writer" or brand account) | Strong/Partial/Missing | |
| Published content discloses author's relevant background | Strong/Partial/Missing | |
| No conflicting or contradictory information about author across platforms | Strong/Partial/Missing | |

### Overall E-E-A-T Author Score: [X]/16 signals Strong
```

---

## Step 4: Generate Author Assets

Produce the following assets immediately: these can be used in the next piece of content
and should be saved to the Learnings log:

### 4a: Short Bio (40 to 60 words)

For use in article bylines and author attribution blocks:

```
[Author Name] is [Title] at [Company]. [1 to 2 sentences on specific domain expertise
and what they spend their time on.] [Optional: 1 line on external recognition
,  publications, speaking, industry roles.] [What they care about most in one line.]
```

**Example bio (structure only — adapt name, title, and company):**
> [Name] is [role] at [business], [what the business does in one plain sentence]. [One line of proof: years of experience, a notable project, a qualification.]

### 4b: Long Bio (100 to 150 words)

For use on author pages and LinkedIn profile summaries:

```
[Author Name] is [Title] at [Company]: [one-line company description].

[2 to 3 sentences on professional background: what they have worked on, what markets or
problems they know deeply, how they got here.]

[1 to 2 sentences on current focus: what questions they are trying to answer, what
they care about in the market right now.]

[1 line on external recognition, speaking, publications: if available.]

[Optional closing: what they think matters for the audience they write for.]
```

### 4c: Person Schema Markup (JSON-LD)

Generate the full Person schema and save it for use on the author page:

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "[Full Name]",
  "jobTitle": "[Job Title]",
  "worksFor": {
    "@type": "Organization",
    "name": "[Company Name]",
    "url": "[https://company.com]"
  },
  "url": "[https://company.com/about/author-name]",
  "sameAs": [
    "[https://linkedin.com/in/author]",
    "[https://twitter.com/author: if relevant]"
  ],
  "description": "[Short bio text: 1 sentence]",
  "knowsAbout": [
    "[Primary expertise topic 1]",
    "[Primary expertise topic 2]",
    "[Primary expertise topic 3]"
  ]
}
```

**Implementation note:** Place this schema in a `<script type="application/ld+json">` block
on the author's page AND in the `<head>` of every article they write.

---

## Step 5: Prioritised Action Plan

Based on the audit in Step 3, produce a prioritised fix list:

### Critical (do before publishing next article)

These are the signals with the highest ranking impact that are easiest to implement:

```markdown
| Action | Effort | Impact | Notes |
|--------|--------|--------|-------|
| Add author attribution to all existing articles (change from the company/brand name to "[Name], CMO") | Low | Very High | Edit author field in CMS |
| Add Person schema to author page and article templates | Low | High | Paste schema from Step 4c |
| Add short bio to article footer or sidebar | Low | High | Use bio from Step 4b |
| Update LinkedIn headline and About section to match site bio | Low | Medium-High | Consistency signal |
```

### High Priority (within 30 days)

```markdown
| Action | Effort | Impact | Notes |
|--------|--------|--------|-------|
| Create dedicated author page on company site | Medium | High | Link from all articles |
| Publish 2 to 3 LinkedIn articles on core expertise topics | Medium | High | Mirror key insights from site content |
| Identify 3 to 5 industry publications to pitch guest posts | Medium | High | See Step 6 for recommendations |
```

### Strategic (within 90 days)

```markdown
| Action | Effort | Impact | Notes |
|--------|--------|--------|-------|
| Guest posts live on 2+ industry publications | High | Very High | Builds cross-platform author presence |
| Author quoted in industry coverage or report | High | High | PR and analyst outreach |
| Speaking appearance or podcast (even small) | High | Medium-High | Creates "sameAs" signal via event schema |
```

---

## Step 6: Publication Opportunities

Recommend specific publications relevant to the author's domain. Build the tier list for the business's own category (local press, trade magazines, sector associations, well-read blogs and newsletters):

**Tier 1: Highest authority, most effort to place:**
- The Register, Ars Technica, Wired (technical long-form)
- TechCrunch, VentureBeat (company/market narrative angle)
- MIT Technology Review (deep technical analysis)

**Tier 2: Strong domain authority, more accessible:**
- The New Stack (infrastructure practitioners)
- InfoQ (enterprise architecture and ML infrastructure)
- Towards Data Science (ML engineering community)
- Weights & Biases blog (ML ops and infrastructure)

**Tier 3: Syndication and community (quickest to place, good for LinkedIn amplification):**
- Dev.to (technical community)
- Hacker News (submit own posts: high variance but high reward)
- LinkedIn Articles (owned, immediate, increasingly cited by AI systems)

**Content angles most likely to get accepted:**
- Original benchmark data ("we measured X and found Y that contradicts common wisdom")
- Cost analysis with real numbers ("the real cost of training a 70B model: a breakdown")
- Behind-the-scenes stories ("what we learned from our busiest week ever")
- Comparisons backed by real experience ("repair or replace: what 300 jobs taught us")

---

## Step 7: Quarterly Maintenance Checklist

Save this as a recurring reminder in the Learnings log or schedule via the
`schedule` skill:

```markdown
## Author Authority Quarterly Review

- [ ] Review all articles published this quarter: author attribution correct on all?
- [ ] LinkedIn: published at least 2 articles/posts in the author's name?
- [ ] Any guest posts placed this quarter? Log URLs in the Learnings log
- [ ] Any media mentions or quotes? Log URLs in the Learnings log
- [ ] Author schema still valid, no job title changes, URL changes?
- [ ] Run entity-optimizer to check Knowledge Graph presence for author name
- [ ] Any new expertise topics to add to knowsAbout in Person schema?
```

---

## Save Results

After completing the audit and producing author assets, write to the Learnings log:

```markdown
# Author Profile: [Author Name]
Last updated: [date]

## Short Bio
[40-60 word bio]

## Long Bio
[100-150 word bio]

## Person Schema
[JSON-LD block]

## E-E-A-T Score
[X]/16 signals Strong: last audited [date]

## Published Work
[Running list of articles, guest posts, media mentions with URLs and dates]

## Next Review Date
[Date: 90 days from today]
```

---

## Next Best Skills

- **content-writer**: every article produced should include the Author Attribution Block
  from this skill
- **entity-optimizer**: check and build the author's Knowledge Graph presence
- **geo-content-optimizer**: LinkedIn content produced under the author's name can be
  optimised for AI citations alongside the main domain content
