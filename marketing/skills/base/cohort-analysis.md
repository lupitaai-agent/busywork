# Cohort Analysis

Cohorts reveal what aggregates hide. A blended conversion rate of 12% can mask one
channel at 28% and another at 3%. This skill surfaces those differences, anchors them
in time (so trends are visible), and produces a narrative that explains what changed
and why it changed.

**System role**: Tier 2 analytics skill. Produces diagnostic outputs that feed pipeline
review, budget allocation decisions, and board readouts.

---

## Step 0: Load Context

Read `the Brand Profile` for:
- ICP segments (ML Engineers, Enterprise Buyers, Research, Investor): these become
  natural cohort keys for customer analysis
- Four differentiators (price, location, no hidden fees, bare-metal): relevant when
  analysing which proof points drive conversion by cohort
- Brand voice: analytical outputs should match the "technically precise, evidence-first"
  standard; do not editorialize without data

---

## Step 1: Choose the Analysis Mode

Three distinct modes. Each uses different data, different cohort keys, and produces
different outputs. Confirm which one applies:

| Mode | Question It Answers | Primary Data Source |
|------|--------------------|--------------------|
| **Acquisition Cohort** | Which channels produce the best customers over time? | GA4 + CRM |
| **Content Cohort** | Which content drives pipeline in addition to traffic? | GA4 + CRM touch data |
| **Customer Cohort** | How do different customer segments retain and expand? | CRM + billing data |

If the question spans multiple modes (e.g. "which channels drive customers who expand"),
run Acquisition first, then Customer with segment filter.

---

## Step 2: Define the Cohort

A cohort is only useful if it is mutually exclusive and consistently defined.
Fill in this worksheet before pulling any data:

```markdown
### Cohort Definition Worksheet

**Analysis mode**: [Acquisition / Content / Customer]

**Cohort key** (what groups members):
[ ] Acquisition channel (organic, paid, referral, outbound, event)
[ ] Lead source as recorded in CRM
[ ] ICP segment (ML Engineers / Enterprise / Research)
[ ] Content piece or campaign
[ ] Sign-up / first-contact month (vintage)
[ ] Geographic region
[ ] Company size tier (SMB / mid-market / enterprise)
[ ] Product or service bought
[ ] Other: ___

**Cohort window**: [first contact date range, e.g. Jan 2025 - Mar 2026]
**Cohort granularity**: [monthly / quarterly]

**Inclusion rules** (who counts as a member):
- Minimum engagement: [e.g., "reached pricing page" / "booked a call" / "signed contract"]
- Segments to include: [all / specific ICP only]

**Exclusion rules** (who does not count):
- [e.g., "exclude internal test accounts," "exclude deals closed < $X ACV"]
- [e.g., "exclude cohorts with fewer than 10 members: too small to be meaningful"]

**Primary metric(s)**:
[ ] Conversion rate (lead → qualified → closed)
[ ] Time to close (days from first contact to signed)
[ ] ACV (average contract value at close)
[ ] Pipeline velocity ($ / day)
[ ] Retention rate at 3m / 6m / 12m
[ ] NRR (Net Revenue Retention) at 12m
[ ] Payback period
[ ] Content → pipeline attribution rate

**Comparison baseline**: [same cohort key, prior period / benchmark / industry average]
```

---

## Step 3: Data Sources and Pull Instructions

### GA4

For acquisition and content cohorts, pull from GA4 Explorations → Cohort Exploration:

1. **Cohort inclusion condition**: First touch (session source/medium) or first conversion event
2. **Cohort granularity**: Weekly or monthly depending on volume
3. **Metric**: Engaged sessions, conversion events, revenue (if e-commerce tracking is set up)
4. **Segments**: Apply ICP segment filters if GA4 has custom dimensions for company type

**GA4 dimensions most relevant for cohorts:**
- `session_source / session_medium`: acquisition channel
- `landing_page`: content cohort key (which piece drove first visit)
- `country / region`: geographic cohort
- Custom dimension: `user_segment` (if implemented: ML Engineers vs. Enterprise vs. Research)

**GA4 export to BigQuery** is the cleanest path for multi-period cohort analysis.
If connected, use this SQL pattern as a starting point:

```sql
SELECT
  FORMAT_DATE('%Y-%m', DATE(user_first_touch_timestamp_micros/1000000)) AS cohort_month,
  traffic_source.source AS acquisition_source,
  COUNT(DISTINCT user_pseudo_id) AS cohort_size,
  COUNTIF(event_name = 'generate_lead') AS leads_generated,
  SAFE_DIVIDE(COUNTIF(event_name = 'generate_lead'), COUNT(DISTINCT user_pseudo_id)) AS conversion_rate
FROM `your_project.analytics_XXXXXXX.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20250101' AND '20260420'
GROUP BY 1, 2
ORDER BY 1, 2
```

Replace `generate_lead` with the conversion event name used in the GA4 implementation.

### Amplitude

For product usage or trial cohorts (if the company has a trial or onboarding flow):

1. **Cohort type**: New user cohorts grouped by signup month
2. **Retention metric**: % of users who returned and performed a key event (e.g., "booked again") in weeks 1, 2, 4, 8
3. **Segments**: Plan type, company size, or ICP segment (if user properties are set)
4. **Export**: Use Amplitude's CSV export or API for cohort retention tables

### CRM Export

For pipeline and customer cohorts:

Required fields in the export:
- Lead/opportunity ID
- First touch date (or lead creation date)
- Lead source / UTM source
- Stage dates (MQL → SQL → Demo → Proposal → Closed)
- ACV at close
- Close date
- Customer segment / ICP classification
- NRR at 6m and 12m (from billing system: may need a join)

**If CRM data is not yet structured for cohort analysis**, the most important immediate
fix is to ensure lead source is captured consistently at lead creation: this is the most
common data quality issue that makes acquisition cohorts unreliable.

---

## Step 4: Build the Cohort Table

### Acquisition Cohort Table (standard heatmap format)

```
Cohort       | Size | Month 1 | Month 2 | Month 3 | Month 6 | Month 12 | ACV Avg | Notes
-------------|------|---------|---------|---------|---------|----------|---------|------
Jan 2025 Org |  48  | 100%    | 71%     | 52%     | 38%     | 29%      | $42k    |
Jan 2025 Paid|  31  | 100%    | 58%     | 41%     | 22%     | 14%      | $28k    |
Feb 2025 Org |  55  | 100%    | 74%     | 57%     | 41%     |: | $44k    |
...
```

**How to read this table:**
- Each row is one cohort (channel × month)
- Month 1 is always 100% (baseline)
- Subsequent months show the % of the original cohort still active / still converting
- A steep drop in Month 2 → Month 3 signals a specific friction point
- Compare curves across channels: organic typically shows higher retention than paid for B2B infrastructure

**Heatmap colour coding (for spreadsheet or BI tool):**
- 75 to 100%: Green (#4CAF50)
- 50 to 74%: Yellow (#FFC107)
- 25 to 49%: Orange (#FF9800)
- 0 to 24%: Red (#F44336)

### Content Cohort Table

```
Content Piece        | Sessions | Leads | Pipeline $ | Deals Closed | CAC (Content) | Notes
---------------------|----------|-------|------------|--------------|---------------|------
[Title - published]  | 2,847    | 47    | $312,000   | 3            | $1,230        |
[Title - published]  | 1,203    | 19    | $88,000    | 1            | $890          |
...
```

**Content attribution caveat:** First-touch attribution overstates top-of-funnel content;
last-touch understates it. For a considered B2B buying journey, linear multi-touch
attribution (equal weight across all touches) is the most defensible model until you
have evidence for a different weighting.

### Customer Cohort Table (NRR / Retention)

```
Cohort       | Count | ACV at Close | ACV at 6m | ACV at 12m | NRR 12m | Exp/Con Split
-------------|-------|-------------|-----------|------------|---------|---------------
Q1 2025 Ent  |  12   | $840k       | $910k     | $1.05m     | 125%    | 4 exp / 0 churn
Q1 2025 SMB  |   8   | $96k        | $88k      | $71k       | 74%     | 1 exp / 2 churn
Q2 2025 Ent  |  15   | $1.1m       | $1.2m     |: |: | Pending 12m
...
```

---

## Step 5: Normalize for Confounders

Raw cohort data misleads when external factors differ across cohort windows.
Check and adjust for:

**Seasonality:** Q4 cohorts in B2B SaaS often show faster initial conversion (budget
pressure) but lower 12-month retention. Q1 cohorts often take longer to convert but
retain better. Note any patterns without over-adjusting, the pattern itself is signal.

**Deal mix:** If ACV increased significantly mid-period (e.g., enterprise push in Q3 2025),
segment by deal size tier before comparing conversion rates. Comparing a cohort of $10k
SMB deals to one of $200k enterprise deals is not a fair cohort comparison.

**Market events:** Note any product launches, pricing changes, competitor moves, or
major content campaigns that coincide with a cohort's acquisition window. Annotate
these in the Narrative Layer (Step 7).

**Cohort maturity:** Only compare cohorts at the same age. A Jan 2025 cohort at 12 months
should not be compared to a Dec 2025 cohort at 2 months: they are at different stages
of the conversion curve.

---

## Step 6: Visualisation Guidance

### Heatmap (retention/conversion over time)

Best for: showing all cohorts at once, spotting systematic trends vs. one-off anomalies.

- Rows: cohort (channel × month or vintage month)
- Columns: periods (Month 1 through Month 12+)
- Values: retention rate, conversion rate, or NRR
- Colour scale: Red → Yellow → Green (see Step 4)

**Tools:** Google Sheets conditional formatting, Amplitude's native cohort chart,
Looker Studio heatmap table, or Python/pandas with seaborn.

### Waterfall Table (period-over-period delta)

Best for: board readouts showing what changed and by how much.

```
Metric          | Q4 2025  | Q1 2026  | Delta   | Driver
----------------|----------|----------|---------|--------
Pipeline ($)    | $2.1m    | $2.4m    | +$300k  | Organic cohort expansion
Organic leads   | 312      | 341      | +29     | New technical content
Paid leads      | 87       | 71       | -16     | Budget reallocation
Enterprise ACV  | $92k     | $108k    | +$16k   | Larger deal sizes
```

### Overlapping Curves (cohort comparison)

Best for: comparing two specific cohorts directly: e.g., "organic Jan 2025 vs.
organic Jan 2026" or "Enterprise Q1 2025 vs. Enterprise Q1 2026."

- X axis: months since cohort start
- Y axis: retention % or cumulative ACV
- One line per cohort
- Divergence point = where the cohorts behave differently → investigate

---

## Step 7: Narrative Layer

Raw numbers without context mislead. Every cohort output needs an annotation layer.

### Standard Annotation Format

```markdown
## Cohort Analysis: [Type]: [Date Range]
Prepared by: [Name], CMO, [Company]
Date: [Today]

### What the data shows
[2 to 3 sentences: the top-line finding. Lead with the most actionable insight.]

### What drove it
[For each material divergence between cohorts, give the likely driver. Be specific.
"Organic cohorts from Q1 2025 converted 23% faster than Q1 2024: coincides with
the launch of the price calculator page in December 2024."]

### What to watch
[2 to 3 forward-looking signals, not predictions. E.g., "Q4 2025 enterprise cohort
is tracking 15% ahead of the Q4 2024 equivalent at the same maturity point."]

### Recommended actions
[Maximum 3. Prioritised. E.g.:
1. Scale the organic channel: 12m NRR 22% higher than paid; CAC-to-LTV ratio favours
   budget shift.
2. Investigate Month 2 to 3 drop in paid cohorts: conversion stalls at the demo stage;
   may be a qualification or ICP targeting issue.
3. Flag Q1 2025 SMB cohort churn for CS review: 74% NRR at 12m suggests a product-fit
   gap for that segment.]

### Open questions
[What this analysis cannot answer yet: e.g., "We do not have clean lead source data
before August 2025: cohorts prior to that window should be treated as directional only."]
```

---

## Step 8: Audience-Appropriate Readout Format

The same analysis needs different packaging for different audiences.

### CMO Self-Review (working document)

Full detail. All tables, all cohorts, all normalization notes. This is the diagnostic layer.
Include the open questions and data quality caveats: they matter for decision quality.

**Length:** As long as it needs to be. Completeness over brevity.
**Format:** Markdown or spreadsheet: whatever is easiest to interrogate.
**Where to save:** the Learnings log[type].md`

### Exec / Leadership Readout (CEO, CRO)

Lead with decisions, not data. Three slides maximum:
1. What changed (waterfall table)
2. Why it changed (top 2 to 3 drivers)
3. What we are doing about it (recommended actions)

Suppress the methodology. They will ask if they want it.

**Length:** 200 to 400 words or equivalent slide copy.

### Board / Investor Readout

Lead with trajectory, not problems. Boards want to see the trend is right and
that you understand the levers.

- Use period-over-period comparisons (Q1 2026 vs. Q1 2025): easier to grasp
- Highlight NRR by segment if enterprise NRR is strong: it is the clearest signal
  of product-market fit
- Do not present a declining cohort without the recovery plan alongside it
- Apply investor messaging rules from `the Brand Profile`

**Length:** 150 to 300 words or equivalent slide copy.

---

## Step 9: Diagnostic Checklist

Before delivering any cohort output:

```markdown
### Cohort Analysis Pre-Flight

| Check | Status | Notes |
|-------|--------|-------|
| Cohorts are mutually exclusive, no overlap in membership | ✅/❌ | |
| Each cohort has at least 10 members (minimum for reliability) | ✅/⚠️/❌ | Flag small cohorts |
| Comparison cohorts are at the same maturity point | ✅/❌ | |
| Seasonality and deal mix noted and adjusted where material | ✅/⚠️/❌ | |
| Data quality issues documented in Open Questions | ✅/❌ | |
| Narrative layer complete: drivers identified alongside deltas | ✅/❌ | |
| Recommended actions are specific and numbered (max 3) | ✅/❌ | |
| Readout format matches the audience | ✅/❌ | |
```

---

## Save Results

Write the completed cohort analysis to the Learnings log[type].md`:
- Cohort definition worksheet
- Full tables
- Narrative annotation
- Recommended actions
- Open questions and data quality notes
- Date and author

If the analysis reveals a material insight that should influence strategy (e.g. "organic
consistently outperforms paid for enterprise customers: this should shift Q3 budget"),
promote that finding to the Learnings log as a logged strategic decision.

---

## Next Best Skills

- **marketing-analytics**: if the cohort finding needs to be framed in the context
  of overall marketing performance (traffic, pipeline, MQLs)
- **marketing-analytics**: if the cohort reveals a stage-specific conversion drop
  that needs deeper pipeline reporting
- **investor-content**: if NRR or ACV cohort results are strong enough to reference
  in an investor milestone update
- **content-writer**: if the cohort reveals a high-performing content piece that
  should be expanded into a full content programme
