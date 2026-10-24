# Marketing Analytics

Measurement has two jobs: knowing *what to track*, and knowing *what the numbers mean*. This skill
covers both. Use it to build a solid tracking foundation, or to turn existing data into stakeholder
reports that drive decisions.

---

## Two Modes

**Mode A: Set Up or Audit Tracking**
Use when starting fresh, fixing broken events, planning UTMs, or building a tracking plan.

**Mode B: Generate Performance Report**
Use when creating monthly/quarterly reports, board updates, or dashboards.

Tell me which mode you need, or describe what you are trying to do and I will pick the right path.

---

# Mode A: Analytics Setup & Tracking

## A1: Initial Assessment

Before implementing anything, understand:

```markdown
### Tracking Setup Context

**Tools in use**: [GA4 / GTM / Mixpanel / Amplitude / Segment / other]
**Key conversions to track**: [signups / demo requests / purchases / downloads]
**Tech stack**: [Next.js / WordPress / Webflow / custom / other]
**Who implements**: [dev team / marketing / I do it myself]
**Privacy/compliance requirements**: [EU/GDPR / CCPA / other]
**Current state**: [nothing set up / partial / broken / needs audit]
```

## A2: Core Tracking Principles

| Principle | Rule |
|-----------|------|
| Track for decisions, not data | Every event should answer a question you will act on |
| Start with questions | What do you need to know? Work backwards |
| Name things consistently | Establish conventions before implementing |
| Quality over quantity | Clean data beats more data |
| No PII in events | Never pass email, name, or ID in event properties |

## A3: Tracking Plan

Build this before touching any code:

```markdown
# [Site] Tracking Plan: v1.0: [Date]

## Key Conversions
| Conversion | Event Name | Trigger |
|------------|------------|---------|
| Signup completed | signup_completed | /dashboard first load |
| Demo requested | demo_requested | Form submit on /demo |
| Contact form | contact_submitted | Contact page form |

## Marketing Site Events
| Event Name | Properties | Trigger |
|------------|------------|---------|
| cta_clicked | button_text, location | Any CTA button click |
| page_viewed | page_title, page_location | Automatic (GA4) |
| form_submitted | form_type, form_location | Any form submit |
| pricing_viewed | plan_highlighted | /pricing page load |

## UTM Convention
- Format: lowercase_underscores
- source: google / linkedin / newsletter / blog
- medium: cpc / email / social / organic
- campaign: [launch-name] or [content-topic]
- content: hero_cta / footer_link / sidebar_banner
```

**Event naming format**: `object_action`: e.g., `signup_completed`, `cta_clicked`, `demo_requested`

## A4: GA4 Implementation

### Quick Setup
1. Create GA4 property and data stream
2. Install gtag.js directly or via GTM
3. Enable enhanced measurement (scroll, outbound clicks, file downloads)
4. Configure custom events
5. Mark key events as Conversions in Admin

### Custom Event Code (gtag)
```javascript
gtag('event', 'signup_completed', {
  'method': 'email',
  'plan': 'free',
  'source': 'landing_page'
});
```

### GTM Data Layer Pattern
```javascript
dataLayer.push({
  'event': 'form_submitted',
  'form_name': 'demo_request',
  'form_location': 'pricing_page'
});
```

## A5: UTM Parameter Strategy

| Parameter | Purpose | Example |
|-----------|---------|---------|
| utm_source | Traffic source | google, linkedin, newsletter |
| utm_medium | Channel | cpc, email, social, organic |
| utm_campaign | Campaign name | q2_launch, bare_metal_guide |
| utm_content | Differentiate versions | hero_cta, footer_link |
| utm_term | Paid search keyword | emergency_plumber |

**Rule**: lowercase everything, shows or hyphens only, document every UTM in a spreadsheet.

## A6: Validation Checklist

Before going live:
- [ ] Events firing on correct triggers (check GA4 DebugView)
- [ ] Property values populating correctly
- [ ] No duplicate events
- [ ] Works on mobile
- [ ] Conversions recording correctly
- [ ] No PII in any event properties
- [ ] Consent mode configured if EU/UK traffic
- [ ] UTM builder shared with team and documented

## A7: Privacy & Consent

- Cookie consent required for EU/UK/CA visitors
- Enable IP anonymisation in GA4
- Use consent mode (gtag consent): delay events until consent
- Collect only what you will actually use
- Configure data retention (14 months recommended)

---

# Mode B: Performance Reporting

## B1: Report Setup

```markdown
### Report Parameters

**Domain**: [domain]
**Report Period**: [e.g. March 2026]
**Comparison Period**: [e.g. February 2026 or March 2025]
**Audience**: [Executive / Marketing team / Technical / Board]
**Data Sources Available**:
  - [ ] Google Search Console
  - [ ] GA4 / analytics
  - [ ] Ahrefs / SEO tool
  - [ ] Manual data (paste below)
```

## B2: Executive Summary

```markdown
## [Domain] Marketing Performance: [Period]

### Overall Rating: [Strong / Good / Watch / Action Required]

| Metric | This Period | Prior Period | Change | Target | Status |
|--------|------------|--------------|--------|--------|--------|
| Organic Traffic | | | | | |
| Keywords Top 10 | | | | | |
| Organic Conversions | | | | | |
| Domain Rating | | | | | |
| AI Citations (GEO) | | | | | |

### Key Wins
- 

### Watch Areas
- 

### Immediate Actions
- 
```

## B3: Traffic Performance

Report: total organic sessions, users, pageviews, bounce rate, period-over-period change.
Breakdown by: traffic source, device type, top performing pages.

## B4: Keyword Rankings

Report: keywords in top 3 / top 10 / top 20 / top 50.
Highlight: biggest movers up and down, SERP feature wins (featured snippets, PAA).

## B5: GEO / AI Visibility

Report: number of AI citations (ChatGPT, Perplexity, Google AI Overviews) where the domain
appears. Track by topic cluster. Note: if GEO tracking not yet set up, flag as "Not yet measured."

### Manual GEO Tracking Protocol (monthly)

No dedicated GEO analytics tool is required. Run this process on the first Monday of each month:

**Step 1: Build your query set (do this once, then reuse)**

Identify 10 to 15 queries your ideal customers ask that your content targets. These become your
permanent tracking queries. For example:
- "best AI marketing platform for small business"
- "how to do SEO without hiring an agency"
- "AI content generation tools for small business"
- "alternatives to a marketing agency retainer"
- "best marketing automation for SMBs"

Document them in the Learnings log. Do not change the list month-to-month
,  consistency is what makes the trend line meaningful.

**Step 2: Run each query in each AI platform**

Check in a private/incognito window to reduce personalisation bias:

| Platform | What to Check | How to Record |
|----------|--------------|---------------|
| Google AI Overview | Does the domain appear in the AI Overview sources list? | Yes / No / Not triggered |
| Perplexity | Is the domain cited in the answer? Is it in the top 3 citations? | Yes (rank) / No |
| ChatGPT Browse | Does a ChatGPT response cite the domain when answering the query? | Yes / No / Browse not triggered |
| Bing Copilot | Is the domain cited? | Yes / No |

**Step 3: Log results in the monthly tracking table**

```markdown
## GEO Tracking Log: [Month YYYY]
Tracked: [date]

| Query | Google AIO | Perplexity | ChatGPT | Bing | Notes |
|-------|-----------|------------|---------|------|-------|
| [query 1] | Yes | Yes (#2) | No | Yes | |
| [query 2] | Not triggered | No | No | No | New competitor appearing |
| ...

**Summary**
- Total queries tracked: [N]
- Google AIO citations: [X]/[N] ([X]%)
- Perplexity citations: [X]/[N] ([X]%)
- ChatGPT citations: [X]/[N] ([X]%)
- Month-over-month change: [+X / -X / flat]
- Queries lost citation this month: [list]
- Queries gained citation this month: [list]
```

Save to: the Learnings log

**Step 4: Act on the results**

- Citation lost: check if the page was updated, if a competitor published something fresher,
  or if the content needs a `speakable` schema or a more direct answer in the opening paragraph.
- Never cited: the content likely lacks a direct, quotable answer to the query: see `geo-content-optimizer`.
- Consistently cited: protect these pages: do not let them go stale; update them quarterly.

**Monthly time investment:** 45 to 60 minutes. Worth doing before any board report or
content planning session to show GEO trajectory alongside traditional SEO metrics.

## B6: Content Performance

Report: new content published, top performing pieces by traffic/conversions, content needing
attention (declining traffic), CORE-EEAT score averages if audits have been run.

## B7: Backlinks

Report: total referring domains, new links acquired, notable wins, toxic links flagged.

## B8: Recommendations

Structure all recommendations as:

| Priority | Action | Owner | Expected Impact | Deadline |
|----------|--------|-------|-----------------|----------|
| Immediate | | | | |
| This Month | | | | |
| This Quarter | | | | |

---

## Save Results

After delivering a report or tracking setup, ask: "Save these results for future sessions?"

If yes, write a dated summary to the Learnings log[domain]-report.md` containing:
- One-line performance verdict
- Top 3 to 5 actions
- Open loops or anomalies

---

## Dashboard Sync

After completing a GEO tracking run or SEO report, run `dashboard-sync`:

**After GEO tracking (B5):**
- Update `geo.score` (cited/tracked × 100), `geo.queriesTracked`, `geo.queriesCited`, `geo.lastRun`

**After page-audit / SEO score:**
- Update `seo.score`, `seo.lastRun`

**After performance report:**
- Update `lastSynced` to now

End with: "✓ Dashboard updated: hit ↺ Refresh to see the latest scores."

---

## Next Best Skills

- **alert-manager**: set up automated monitoring rules based on report findings
- **page-audit**: deep-dive audit on specific underperforming pages
- **cohort-analysis**: for pipeline/revenue/retention analysis (finance/ops focused)
- **geo-content-optimizer**: improve AI visibility scores if GEO metrics are low
