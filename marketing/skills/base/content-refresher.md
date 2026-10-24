# Content Refresher

This skill helps identify and revitalize outdated content to reclaim lost rankings and traffic. It analyzes content freshness, identifies update opportunities, and guides the refresh process for maximum SEO and GEO impact.

**System role**: Optimization layer skill. It turns weak pages, structures, and technical issues into prioritized repair work.

## When This Must Trigger

Use this when the conversation involves any of these situations, even if the user does not use SEO terminology:

Use this whenever the task needs a diagnosis or repair plan that should feed directly into remediation work rather than a one-time opinion.

- Content has lost rankings or traffic over time
- Statistics and information are outdated
- Competitors have published better content
- Content needs updating for a new year
- Industry changes require content updates
- Adding new sections to existing content
- Converting old content for GEO optimization

## What This Skill Does

1. **Freshness Analysis**: Identifies outdated content needing updates
2. **Performance Tracking**: Finds content with declining traffic
3. **Gap Identification**: Spots missing information competitors have
4. **Update Prioritization**: Ranks content by refresh potential
5. **Refresh Recommendations**: Provides specific update guidance
6. **GEO Enhancement**: Updates content for AI citation potential
7. **Republishing Strategy**: Advises on date and promotion tactics

## Quick Start

Start with one of these prompts. Finish with a short handoff summary using the repository format in `Skill Contract`.

### Identify Content to Refresh

```
Find content on [domain] that needs refreshing
```

```
Which of my blog posts have lost the most traffic?
```

### Refresh Specific Content

```
Refresh this article for [current year]: [URL/content]
```

```
Update this content to outrank [competitor URL]: [your URL]
```

### Content Refresh Strategy

```
Create a content refresh strategy for [domain/topic]
```

## Skill Contract

**Expected output**: a scored diagnosis, prioritized repair plan, and a short handoff summary ready for the Learnings log.

- **Reads**: the current page or site state, symptoms, prior audits, and current priorities from `CLAUDE.md` and the shared `State Model` when available.
- **Writes**: a user-facing audit or optimization plan plus a reusable summary that can be stored under the Learnings log.
- **Promotes**: blocking defects, repeated weaknesses, and fix priorities to the Learnings log and the Learnings log.
- **Next handoff**: use the `Next Best Skill` below when the repair path is clear.

## Data Sources

> See `CONNECTORS.md` for tool category placeholders.

**With ~~analytics + ~~search console + ~~SEO tool connected:**
Claude can automatically pull historical traffic trends from ~~analytics, fetch impression and ranking data from ~~search console, retrieve keyword position history from ~~SEO tool, and identify content with declining performance. This enables data-driven refresh prioritization.

**With manual data only:**
Ask the user to provide:
1. Traffic data or screenshots showing performance trends
2. Ranking screenshots or history for key pages
3. Content publish dates and last update dates
4. List of pages the user suspects need refreshing

Proceed with the analysis using provided data. Note in the output which findings are from automated data vs. manual review.

## Instructions

When a user requests content refresh help:

1. **CORE-EEAT Quick Score: Identify Weak Dimensions**

   Before refreshing, run a quick CORE-EEAT assessment to focus effort on the weakest areas. Reference: `CORE-EEAT Benchmark`

   ```markdown
   ### CORE-EEAT Quick Assessment

   **Content**: [title or URL]
   **Content Type**: [type]

   Rapidly score each dimension (estimate 0-100):

   | Dimension | Quick Score | Key Weakness | Refresh Priority |
   |-----------|-----------|--------------|-----------------|
   | C: Contextual Clarity | [X]/100 | [main issue] | 🔴/🟡/🟢 |
   | O: Organization | [X]/100 | [main issue] | 🔴/🟡/🟢 |
   | R: Referenceability | [X]/100 | [main issue] | 🔴/🟡/🟢 |
   | E: Exclusivity | [X]/100 | [main issue] | 🔴/🟡/🟢 |
   | Exp: Experience | [X]/100 | [main issue] | 🔴/🟡/🟢 |
   | Ept: Expertise | [X]/100 | [main issue] | 🔴/🟡/🟢 |
   | A: Authority | [X]/100 | [main issue] | 🔴/🟡/🟢 |
   | T: Trust | [X]/100 | [main issue] | 🔴/🟡/🟢 |

   **Weakest Dimensions** (focus refresh here):
   1. [Dimension]: [what needs fixing]
   2. [Dimension]: [what needs fixing]

   **Refresh Strategy**: Focus on 🔴 dimensions first, then 🟡.

   _For full 80-item audit, use `content-quality-auditor`_
   ```

2. **Identify Content Refresh Candidates**

   ```markdown
   ## Content Refresh Analysis
   
   ### Refresh Candidate Identification
   
   **Criteria for Content Refresh**:
   - Published more than 6 months ago
   - Contains dated information (years, statistics)
   - Declining traffic trend
   - Lost keyword rankings
   - Outdated references or broken links
   - Missing topics competitors now cover
   - No GEO optimization
   
   ### Content Audit Results
   
   | Content | Published | Last Updated | Traffic Trend | Priority |
   |---------|-----------|--------------|---------------|----------|
   | [Title 1] | [date] | [date] | ↓ -45% | 🔴 High |
   | [Title 2] | [date] | Never | ↓ -30% | 🔴 High |
   | [Title 3] | [date] | [date] | ↓ -20% | 🟡 Medium |
   | [Title 4] | [date] | [date] | → 0% | 🟡 Medium |
   
   ### Refresh Prioritization Matrix
   
   ```
   High Traffic + High Decline = 🔴 Refresh Immediately
   High Traffic + Low Decline = 🟡 Schedule Refresh
   Low Traffic + High Decline = 🟡 Evaluate & Decide
   Low Traffic + Low Decline = 🟢 Low Priority
   ```
   ```

3. **Analyze Individual Content for Refresh**

   ```markdown
   ## Content Refresh Analysis: [Title]
   
   **URL**: [URL]
   **Published**: [date]
   **Last Updated**: [date]
   **Word Count**: [X]
   
   ### Performance Metrics
   
   | Metric | 6 Mo Ago | Current | Change |
   |--------|----------|---------|--------|
   | Organic Traffic | [X]/mo | [X]/mo | [+/-X]% |
   | Avg Position | [X] | [X] | [+/-X] |
   | Impressions | [X] | [X] | [+/-X]% |
   | CTR | [X]% | [X]% | [+/-X]% |
   
   ### Keywords Analysis
   
   | Keyword | Old Position | Current Position | Change |
   |---------|--------------|------------------|--------|
   | [kw 1] | [X] | [X] | ↓ [X] |
   | [kw 2] | [X] | [X] | ↓ [X] |
   | [kw 3] | [X] | [X] | ↓ [X] |
   
   ### Why This Content Needs Refresh
   
   1. **Outdated information**: [specific examples]
   2. **Competitive gap**: [what competitors added]
   3. **Missing topics**: [new subtopics to cover]
   4. **SEO issues**: [current optimization problems]
   5. **GEO potential**: [AI citation opportunities]
   ```

4. **Identify Specific Updates Needed**

   ```markdown
   ## Refresh Requirements
   
   ### Outdated Elements
   
   | Element | Current | Update Needed |
   |---------|---------|---------------|
   | Year references | "[old year]" | Update to [current year] |
   | Statistics | "[old stat]" | Find current data |
   | Tool mentions | "[old tool]" | Add newer tools |
   | Links | [X] broken | Fix or replace |
   | Screenshots | Outdated UI | Recapture |
   
   ### Missing Information
   
   **Topics competitors now cover that you do not**:
   
   | Topic | Competitor Coverage | Words Needed | Priority |
   |-------|---------------------|--------------|----------|
   | [Topic 1] | 3/5 competitors | ~300 words | High |
   | [Topic 2] | 2/5 competitors | ~200 words | Medium |
   | [Topic 3] | 4/5 competitors | ~400 words | High |
   
   ### SEO Updates Needed
   
   - [ ] Update title tag with current year
   - [ ] Refresh meta description
   - [ ] Add new H2 sections for [topics]
   - [ ] Update internal links to newer content
   - [ ] Add FAQ section for featured snippets
   - [ ] Refresh images and add new alt text
   
   ### GEO Updates Needed
   
   - [ ] Add clear definition at start
   - [ ] Include quotable statistics with sources
   - [ ] Add Q&A formatted sections
   - [ ] Update sources with current citations
   - [ ] Create standalone factual statements
   ```

5. **Create Refresh Plan**: Structural changes, content additions, statistics/links/images to update

   > **Reference**: See `references/refresh-templates.md` for the full refresh plan template (Step 5).

6. **Write Refresh Content**: Updated introduction, new sections, refreshed statistics, new FAQ section

   > **Reference**: See `references/refresh-templates.md` for the refresh content writing template (Step 6).

7. **Optimize for GEO During Refresh**: Clear definitions, quotable statements, Q&A sections, updated citations

   > **Reference**: See `references/refresh-templates.md` for the GEO enhancement template (Step 7).

8. **Generate Republishing Strategy**: Date strategy (update/add "last updated"/keep original), technical implementation, promotion plan

   > **Reference**: See `references/refresh-templates.md` for the republishing strategy template (Step 8).

9. **Create Refresh Report**: Summary of changes, updates completed, expected outcomes, next review date

   > **Reference**: See `references/refresh-templates.md` for the refresh report template (Step 9).

## Validation Checkpoints

### Input Validation
- [ ] Target content URL or title clearly identified
- [ ] Historical performance data available (traffic trends, rankings)
- [ ] Content publish/update dates known
- [ ] If comparing to competitors, competitor URLs provided

### Output Validation
- [ ] Every recommendation cites specific data points (not generic advice)
- [ ] Outdated elements identified with specific examples and replacement data
- [ ] All suggested additions include word counts and section locations
- [ ] Source of each data point clearly stated (~~analytics data, ~~search console, ~~SEO tool, user-provided, or estimated)

## Example

> **Reference**: See `references/refresh-example.md` for a full worked example (cloud hosting refresh) and the comprehensive content refresh checklist.

## Tips for Success

1. **Prioritize by ROI** - Refresh high-potential content first
2. **Do more than add dates** - Make substantial improvements
3. **Beat competitors** - Add what they have and more
4. **Track results** - Monitor ranking changes post-refresh
5. **Schedule regular audits** - Check content health quarterly
6. **Optimize for GEO** - Every refresh is a GEO opportunity

> **Reference data**: For content decay signal taxonomy, lifecycle stages, refresh vs. rewrite decision framework, and update strategy by content type, see `references/content-decay-signals.md`.

### Save Results

After delivering audit or optimization findings to the user, ask:

> "Save these results for future sessions?"

If yes, write a dated summary to the Learnings log<topic>.md` containing:
- One-line verdict or headline finding
- Top 3-5 actionable items
- Open loops or blockers
- Source data references

If any veto-level issue was found (CORE-EEAT T04, C01, R10 or CITE T03, T05, T09), also append a one-liner to the Learnings log without asking.

**Gate check recommended**: Run content-quality-auditor on refreshed content before republishing.

## Reference Materials

- `Content Decay Signals`: Decay indicators, lifecycle stages, and refresh triggers by content type
- `Refresh Templates`: Detailed output templates for steps 5-9 (refresh plan, content writing, GEO enhancement, republishing, report)
- `Refresh Example & Checklist`: Full worked example and pre/post-refresh checklist

## Dashboard Sync

After delivering the refreshed draft, deposit it to the review queue and update the `vf-state` JSON block in `the Studio`:

1. Add an entry to `reviewQueue.items[]`:
```json
{
  "id": "draft-<YYYYMMDD>-<n>",
  "title": "<refreshed article title>",
  "category": "<Guide | Deep Dive | News | Client Story>",
  "source": "refresh",
  "score": <CORE_EEAT_score_if_run_else_0>,
  "date": "<DD Mon YYYY>",
  "status": "pending"
}
```
2. Increment `reviewQueue.pending` by 1.
3. Update `lastSynced` to the current ISO timestamp.
4. Also update the Learnings log with the new entry.

Always end with:
> ✓ Dashboard updated: hit ↺ Refresh to see the draft in your review queue.

## Next Best Skill

- **Primary**: `content-quality-auditor`: re-score the refreshed content before shipping.
