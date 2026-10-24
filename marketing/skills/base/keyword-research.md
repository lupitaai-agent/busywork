# Keyword Research

Discovers, analyzes, and prioritizes keywords for SEO and GEO content strategies. Identifies high-value opportunities based on search volume, competition, intent, and business relevance.

**System role**: Research layer skill. It turns market signals into reusable strategic inputs for the rest of the library.

## When This Must Trigger

Use this when the conversation involves any of these situations, even if the user does not use SEO terminology:

Use this whenever the task needs reusable market intelligence that should influence strategy rather than answer a single ad hoc question.

- Starting a new content strategy or campaign
- Expanding into new topics or markets
- Finding keywords for a specific product or service
- Identifying long-tail keyword opportunities
- Understanding search intent for your industry
- Planning content calendars
- Researching keywords for GEO optimization

## What This Skill Does

1. **Keyword Discovery**: Generates comprehensive keyword lists from seed terms
2. **Intent Classification**: Categorizes keywords by user intent (informational, navigational, commercial, transactional)
3. **Difficulty Assessment**: Evaluates competition level and ranking difficulty
4. **Opportunity Scoring**: Prioritizes keywords by potential ROI
5. **Clustering**: Groups related keywords into topic clusters
6. **GEO Relevance**: Identifies keywords likely to trigger AI responses

## Quick Start

Start with one of these prompts. Finish with a short handoff summary using the repository format in `Skill Contract`.

### Basic Keyword Research

```
Research keywords for [topic/product/service]
```

```
Find keyword opportunities for a [industry] business targeting [audience]
```

### With Specific Goals

```
Find low-competition keywords for [topic] with commercial intent
```

```
Identify question-based keywords for [topic] that AI systems might answer
```

### Competitive Research

```
What keywords is [competitor URL] ranking for that I should target?
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

**With ~~SEO tool + ~~search console connected:**
Automatically pull historical search volume data, keyword difficulty scores, SERP analysis, current rankings from ~~search console, and competitor keyword overlap. The skill will fetch seed keyword metrics, related keyword suggestions, and search trend data.

**With manual data only:**
Ask the user to provide:
1. Seed keywords or topic description
2. Target audience and geographic location
3. Business goals (traffic, leads, sales)
4. Current domain authority (if known) or site age
5. Any known keyword performance data or search volume estimates

Proceed with the full analysis using provided data. Note in the output which metrics are from automated collection vs. user-provided data.

## Instructions

When a user requests keyword research:

At the start of each phase, announce: **[Phase X/8: Name]** so the user can track progress.

### Phase 1/8: Scope

   Ask clarifying questions if not provided:
   - What is your product/service/topic?
   - Who is your target audience?
   - What is your business goal? (traffic, leads, sales)
   - What is your current domain authority? (new site, established, etc.)
   - Any specific geographic targeting?
   - Preferred language?

### Phase 2/8: Discover

   Start with:
   - Core product/service terms
   - Problem-focused keywords (what issues do you solve?)
   - Solution-focused keywords (how do you help?)
   - Audience-specific terms
   - Industry terminology

### Phase 3/8: Variations

   For each seed keyword, generate variations:
   
   ```markdown
   ## Keyword Expansion Patterns
   
   ### Modifiers
   - Best [keyword]
   - Top [keyword]
   - [keyword] for [audience]
   - [keyword] near me
   - [keyword] [year]
   - How to [keyword]
   - What is [keyword]
   - [keyword] vs [alternative]
   - [keyword] examples
   - [keyword] tools
   
   ### Long-tail Variations
   - [keyword] for beginners
   - [keyword] for small business
   - Free [keyword]
   - [keyword] software/tool/service
   - [keyword] template
   - [keyword] checklist
   - [keyword] guide
   ```

### Phase 4/8: Classify

   Categorize each keyword:

   | Intent | Signals | Example | Content Type |
   |--------|---------|---------|--------------|
   | Informational | what, how, why, guide, learn | "what is SEO" | Blog posts, guides |
   | Navigational | brand names, specific sites | "google analytics login" | Homepage, product pages |
   | Commercial | best, review, vs, compare | "best SEO tools [current year]" | Comparison posts, reviews |
   | Transactional | buy, price, discount, order | "buy SEO software" | Product pages, pricing |

### Phase 5/8: Score

   Score each keyword (1-100 scale):

   ```markdown
   ### Difficulty Factors
   
   **High Difficulty (70-100)**
   - Major brands ranking
   - High domain authority competitors
   - Established content (1000+ backlinks)
   - Paid ads dominating SERP
   
   **Medium Difficulty (40-69)**
   - Mix of authority and niche sites
   - Some opportunities for quality content
   - Moderate backlink requirements
   
   **Low Difficulty (1-39)**
   - Few authoritative competitors
   - Thin or outdated content ranking
   - Long-tail variations
   - New or emerging topics
   ```

#### Opportunity Score

   Formula: `Opportunity = (Volume × Intent Value) / Difficulty`

   **Intent Value** assigns a numeric weight by search intent:
   - Informational = 1
   - Navigational = 1
   - Commercial = 2
   - Transactional = 3

   ```markdown
   ### Opportunity Matrix
   
   | Scenario | Volume | Difficulty | Intent | Priority |
   |----------|--------|------------|--------|----------|
   | Quick Win | Low-Med | Low | High | ⭐⭐⭐⭐⭐ |
   | Growth | High | Medium | High | ⭐⭐⭐⭐ |
   | Long-term | High | High | High | ⭐⭐⭐ |
   | Research | Low | Low | Low | ⭐⭐ |
   ```

### Phase 6/8: GEO-Check: AI Answer Overlap

   Keywords likely to trigger AI responses:
   
   ```markdown
   ### GEO-Relevant Keywords
   
   **High GEO Potential**
   - Question formats: "What is...", "How does...", "Why is..."
   - Definition queries: "[term] meaning", "[term] definition"
   - Comparison queries: "[A] vs [B]", "difference between..."
   - List queries: "best [category]", "top [number] [items]"
   - How-to queries: "how to [action]", "steps to [goal]"
   
   **AI Answer Indicators**
   - Query is factual/definitional
   - Answer can be summarized concisely
   - Topic is well-documented online
   - Low commercial intent
   ```

### Phase 7/8: Cluster

   Group keywords into content clusters:

   ```markdown
   ## Topic Cluster: [Main Topic]
   
   **Pillar Content**: [Primary keyword]
   - Search volume: [X]
   - Difficulty: [X]
   - Content type: Comprehensive guide
   
   **Cluster Content**:
   
   ### Sub-topic 1: [Secondary keyword]
   - Volume: [X]
   - Difficulty: [X]
   - Links to: Pillar
   - Content type: [Blog post/Tutorial/etc.]
   
   ### Sub-topic 2: [Secondary keyword]
   - Volume: [X]
   - Difficulty: [X]
   - Links to: Pillar + Sub-topic 1
   - Content type: [Blog post/Tutorial/etc.]
   
   [Continue for all cluster keywords...]
   ```

### Phase 8/8: Deliver

   Produce a report containing: Executive Summary, Top Keyword Opportunities (Quick Wins, Growth, GEO), Topic Clusters, Content Calendar, and Next Steps.

   **Quality bar**: every recommendation must include at least one specific number. If it reads like the left column, rewrite it before including.

   | ❌ Generic (rewrite before including) | ✅ Actionable |
   |---|---|
   | "Target long-tail keywords for better results" | "Target 'project management for nonprofits' (vol: 320, KD: 22), no DR>40 sites in top 10" |
   | "This keyword has good potential" | "Opportunity 8.4: vol 4,800, KD 28, transactional intent: gap analysis shows no content updated since 2023 in top 5" |
   | "Consider creating content around this topic" | "Write '[Tool A] vs [Tool B] for small teams': 1,200/mo searches, current #1 is a 2022 article with 12 backlinks" |
   | "Optimize your page for this keyword" | "Add primary keyword to H1 (currently missing), write a 40-word direct answer in paragraph 1, add 3 internal links from your /blog/ cluster" |

   > **Reference**: See `references/example-report.md` for the full report template and example.

## Validation Checkpoints

### Input Validation
- [ ] Seed keywords or topic description clearly provided
- [ ] Target audience and business goals specified
- [ ] Geographic and language targeting confirmed
- [ ] Domain authority or site maturity level established

### Output Validation
- [ ] Every recommendation cites specific data points (not generic advice)
- [ ] Search volume and difficulty scores included for each keyword
- [ ] Keywords grouped by intent and mapped to content types
- [ ] Topic clusters show clear pillar-to-cluster relationships
- [ ] Source of each data point clearly stated (~~SEO tool data, user-provided, or estimated)

## Example

> **Reference**: See `references/example-report.md` for a complete example report for "project management software for small businesses".

### Advanced Usage

- **Intent Mapping**: `Map all keywords for [topic] by search intent and funnel stage`
- **Seasonal Analysis**: `Identify seasonal keyword trends for [industry]`
- **Competitor Gap**: `What keywords do [competitor 1], [competitor 2] rank for that I am missing?`
- **Local Keywords**: `Research local keywords for [business type] in [city/region]`

## Tips for Success

1. **Start with seed keywords** that describe your core offering
2. **Do not ignore long-tail** - they often have highest conversion rates
3. **Match content to intent** - informational queries need guides, not sales pages
4. **Group into clusters** for topical authority
5. **Prioritize quick wins** to build momentum and credibility
6. **Include GEO keywords** in your strategy for AI visibility
7. **Review quarterly** - keyword dynamics change over time

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

- `Keyword Intent Taxonomy`: Complete intent classification with signal words and content strategies
- `Topic Cluster Templates`: Hub-and-spoke architecture templates for pillar and cluster content
- `Keyword Prioritization Framework`: Priority scoring matrix, categories, and seasonal keyword patterns
- `Example Report`: Complete example keyword research report for project management software

## Next Best Skill

- **Primary**: `competitor-analysis`: turn keyword opportunities into a competitive benchmark.
