# Content Gap Analysis

Identifies content opportunities by analyzing gaps between a site's content and competitors'. Surfaces missing topics, untapped keywords, and content formats worth creating.

**System role**: Research layer skill. It turns market signals into reusable strategic inputs for the rest of the library.

## When This Must Trigger

Use this when the conversation involves any of these situations, even if the user does not use SEO terminology:

Use this whenever the task needs reusable market intelligence that should influence strategy rather than answer a single ad hoc question.

- Planning content strategy and editorial calendar
- Finding quick-win content opportunities
- Understanding where competitors outperform you
- Identifying underserved topics in your niche
- Expanding into adjacent topic areas
- Prioritizing content creation efforts
- Finding GEO opportunities competitors miss

## What This Skill Does

1. **Keyword Gap Analysis**: Finds keywords competitors rank for that you do not
2. **Topic Coverage Mapping**: Identifies topic areas needing more content
3. **Content Format Gaps**: Reveals missing content types (videos, tools, guides)
4. **Audience Need Mapping**: Matches gaps to audience journey stages
5. **GEO Opportunity Detection**: Finds AI-answerable topics you are missing
6. **Priority Scoring**: Ranks gaps by impact and effort
7. **Content Calendar Creation**: Plans gap-filling content schedule

## Quick Start

Start with one of these prompts. Finish with a short handoff summary using the repository format in `Skill Contract`.

### Basic Gap Analysis

```
Find content gaps between my site [URL] and [competitor URLs]
```

```
What content am I missing compared to my top 3 competitors?
```

### Topic-Specific Analysis

```
Find content gaps in [topic area] compared to industry leaders
```

```
What [content type] do competitors have that I do not?
```

### Audience-Focused

```
What content gaps exist for [audience segment] in my niche?
```

## Skill Contract

**Expected output**: a prioritized research brief, evidence-backed findings, and a short handoff summary ready for the Learnings log.

- **Reads**: user goals, target market inputs, available tool data, and prior strategy from `CLAUDE.md` and the shared `State Model` when available.
- **Writes**: a user-facing research deliverable plus a reusable summary that can be stored under the Learnings log.
- **Promotes**: durable keyword priorities, competitor facts, entity candidates, and strategic decisions to `CLAUDE.md`, the Learnings log, and the Learnings log; hand canonical entity work to `entity-optimizer`.
- **Next handoff**: use the `Next Best Skill` below when the findings are ready to drive action.

## Data Sources

> **Note:** All integrations are optional. This skill works without any API keys: users provide data manually when no tools are connected.

> See `CONNECTORS.md` for tool category placeholders.

**With ~~SEO tool + ~~search console + ~~analytics + ~~AI monitor connected:**
Automatically pull your site's content inventory from ~~search console and ~~analytics (indexed pages, traffic per page, keywords ranking), competitor content data from ~~SEO tool (ranking keywords, top pages, backlink counts), and AI citation patterns from ~~AI monitor. Keyword overlap analysis and gap identification can be automated.

**With manual data only:**
Ask the user to provide:
1. Your site URL and content inventory (list of published content with topics)
2. Competitor URLs (3-5 sites)
3. Your current traffic and keyword performance (if available)
4. Known content strengths and weaknesses
5. Industry context and business goals

Proceed with the full analysis using provided data. Note in the output which metrics are from automated collection vs. user-provided data.

## Instructions

When a user requests content gap analysis:

1. **Define Analysis Scope**

   Clarify parameters:
   
   ```markdown
   ### Analysis Parameters
   
   **Your Site**: [URL]
   **Competitors to Analyze**: [URLs or "identify for me"]
   **Topic Focus**: [specific area or "all"]
   **Content Types**: [blogs, guides, tools, videos, or "all"]
   **Audience**: [target audience]
   **Business Goals**: [traffic, leads, authority, etc.]
   ```

2. **Audit Your Existing Content**

   Document total indexed pages, content by type and topic cluster, top performing content, and content strengths/weaknesses.

3. **Analyze Competitor Content**

   For each competitor: document content volume, monthly traffic, content distribution by type, topic coverage vs. yours, and unique content they have.

4. **Identify Keyword Gaps**

   Find keywords competitors rank for that you do not. Categorize into High Priority (high volume, achievable difficulty), Quick Wins (lower volume, low difficulty), and Long-term (high volume, high difficulty). Include keyword overlap analysis.

5. **Map Topic Gaps**

   Create a topic coverage comparison matrix across all competitors. For each missing topic cluster, document business relevance, competitor coverage, opportunity size, sub-topics, and recommended pillar/cluster approach.

6. **Identify Content Format Gaps**

   Compare format distribution (guides, tutorials, comparisons, case studies, tools, templates, video, infographics, research) against competitors and industry averages. For each gap, assess effort and expected impact.

7. **Analyze GEO/AI Gaps**

   Identify topics where competitors get AI citations but you do not. Document missing Q&A content, definition/explanation content, and comparison content. Score each by traditional SEO value and GEO value.

8. **Map to Audience Journey**

   Compare funnel stage coverage (Awareness, Consideration, Decision, Retention) against competitor averages. Detail specific gaps at each stage.

9. **Prioritize and Create Action Plan**

   Produce a final report with: Executive Summary, Prioritized Gap List (Tier 1 Quick Wins, Tier 2 Strategic Builds, Tier 3 Long-term), Content Calendar, and Success Metrics.

   > **Reference**: See `references/analysis-templates.md` for detailed templates for each step.

## Validation Checkpoints

### Input Validation
- [ ] Your content inventory is complete or representative sample provided
- [ ] Competitor URLs identified (minimum 2-3 competitors)
- [ ] Analysis scope defined (specific topics or comprehensive)
- [ ] Business goals and priorities clarified

### Output Validation
- [ ] Every recommendation cites specific data points (not generic advice)
- [ ] Gap analysis compares like-to-like content (topic clusters to topic clusters)
- [ ] Priority scoring based on measurable criteria (volume, difficulty, business fit)
- [ ] Content calendar maps gaps to realistic timeframes
- [ ] Source of each data point clearly stated (~~SEO tool data, ~~analytics data, ~~AI monitor data, user-provided, or estimated)

## Example

> **Reference**: See `references/example-report.md` for a complete example analyzing SaaS marketing blog gaps vs. HubSpot and Drift.

## Advanced Analysis

### Competitive Cluster Comparison

```
Compare our topic cluster coverage for [topic] vs top 5 competitors
```

### Temporal Gap Analysis

```
What content have competitors published in the last 6 months that we have not covered?
```

### Intent-Based Gaps

```
Find gaps in our [commercial/informational] intent content
```

## Tips for Success

1. **Focus on actionable gaps** - Not all gaps are worth filling
2. **Consider your resources** - Prioritize based on ability to execute
3. **Quality over quantity** - Better to fill 5 gaps well than 20 poorly
4. **Track what works** - Measure gap-filling success
5. **Update regularly** - Gaps change as competitors publish
6. **Include GEO opportunities** - Cover AI search surfaces as well as traditional search

### Save Results

After delivering findings to the user, ask:

> "Save these results for future sessions?"

If yes, write a dated summary to the Learnings log<topic>.md` containing:
- One-line headline finding
- Top 3-5 actionable items
- Open loops or blockers
- Source data references

If any findings should influence ongoing strategy, recommend promoting key conclusions to the Learnings log.

## Reference Materials

- `Analysis Templates`: Detailed templates for each analysis step (inventory, competitor content, keyword gaps, topic gaps, format gaps, GEO gaps, journey, prioritized report)
- `Gap Analysis Frameworks`: Content audit matrices, funnel mapping, and gap prioritization scoring methodologies
- `Example Report`: Complete example analyzing SaaS marketing blog gaps vs. HubSpot and Drift

## Next Best Skill

- **Primary**: `content-writer`: turn missing topics into a draft or content roadmap.
