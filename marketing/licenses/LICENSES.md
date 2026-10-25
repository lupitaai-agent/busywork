# Licences and credits for the Busy skill libraries (Marketing Studio and Olaf)

## Skills derived from Apache-2.0 licensed work
These 23 skills are based on skills released under the Apache License 2.0 (full text in
`APACHE-2.0.txt`), most of them from the open-source SEO/GEO skill set at
https://github.com/aaron-he-zhu/seo-geo-claude-skills, as adapted for our own skill library before Busy existed.
They ship in two forms: the Marketing Studio's playbooks (`marketing/skills/`) and Olaf's full skills (`olaf/skills/`).

**Changes made for the Studio:** brand-specific content removed or replaced with generic wording;
tool and file instructions that only apply to the original agent setup left in place but
overridden by the Studio's runtime rules; an upgrade layer added on top of each skill ("How this
skill applies the marketing laws", "Current best practice", "For a small business"); every skill now
runs under the Studio's marketing foundation.

- `alert-manager` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `author-authority`
- `backlink-analyzer` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `case-studies`
- `cohort-analysis`
- `competitor-analysis` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `content-gap-analysis` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `content-quality-auditor` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `content-refresher` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `content-writer`
- `copywriting`
- `domain-authority-auditor` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `entity-optimizer` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `geo-content-optimizer` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `internal-linking-optimizer` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `keyword-research` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `marketing-analytics`
- `meta-tags-optimizer` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `page-audit`
- `rank-tracker` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `schema-markup-generator` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `serp-analysis` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)
- `technical-seo-checker` (origin: https://github.com/aaron-he-zhu/seo-geo-claude-skills)

## Skills from our own earlier library (own work)
Adapted and anonymized the same way:

- `ab-test-setup`
- `ad-creative`
- `competitive-battlecards`
- `email-sequence`
- `newsroom`
- `paid-ads`
- `positioning-icp`
- `product-launch`
- `social-selling`
- `wordpress-article`

## New skills written for the Studio
category-entry-points, distinctive-assets, brand-health, marketing-plan, reach-planner,
local-presence, social-media, word-of-mouth, offers-promotions, pr-local-press, newsletter,
customer-research, image-prompts, creative-check.

## Inspiration (no text copied)
- coreyhaines31/marketingskills (MIT): the shared product-marketing context pattern and skill
  coverage informed the Brand Profile and the choice of new skills.
- Anthropic's marketing plugin (knowledge-work-plugins): campaign, brand-review and performance
  report structures informed the creative check and plan formats.

## The marketing foundation
Summarised in our own words from published marketing science (see `marketing/FOUNDATION.md`,
section 11). No text reproduced.
