# Codex Instructions for Website Audit Project

## Goal

Use this folder to generate website audits using the provided template and rules.

When Codex starts, audit only the first assigned site: Rides2U.

Do not audit the other sites in `data/leads_to_audit.csv` until the user gives a new instruction.

## First Site To Audit

Name: Ryan Kreager
Email: ryan@rides2u.com
Company: Rides2U
Website: https://www.rides2u.com/

## Required Output File

Create this file:

`audits/rides2u-audit.md`

Also create a plain text copy when useful:

`audits/rides2u-audit.txt`

Also save Lighthouse outputs to:

- `lighthouse-results/rides2u-lighthouse.json`
- `lighthouse-results/rides2u-lighthouse.html`

## Audit Process

1. Read `rules/AI_RULES_AND_COMMUNICATION.md`.
2. Read `templates/AUDIT_TEMPLATE_FIGMA.txt`.
3. Audit only `https://www.rides2u.com/`.
4. Run Lighthouse/PageSpeed for the site.
5. Use the Lighthouse results in the Performance section.
6. Inspect the live site externally where possible.
7. Select only relevant issues from the template.
8. Keep `The Affects` and `The Fixes` aligned to the selected issue IDs.
9. Remove anything that is not relevant.
10. In the final audit, show selected issues with bracketed IDs, not normal numbered list formatting.
11. Save the final audit to `audits/rides2u-audit.md` and mirror it to `audits/rides2u-audit.txt` when a text file is useful.

## Lighthouse Command

Try this first:

```bash
npx lighthouse https://www.rides2u.com/ \
  --preset=desktop \
  --output=json \
  --output=html \
  --output-path=./lighthouse-results/rides2u-lighthouse \
  --chrome-flags="--headless"
```

If desktop is not desired, use mobile/default Lighthouse instead:

```bash
npx lighthouse https://www.rides2u.com/ \
  --output=json \
  --output=html \
  --output-path=./lighthouse-results/rides2u-lighthouse \
  --chrome-flags="--headless"
```

## Extract These Lighthouse Values

From the Lighthouse JSON extract:

- Performance score
- Accessibility score
- Best Practices score
- SEO score
- Largest Contentful Paint
- Total Blocking Time

Lighthouse scores are stored as decimals in JSON, so convert them to percentages.

Example:

- `0.63` becomes `63`
- `0.91` becomes `91`

Use the raw values to understand the site, but keep the client-facing audit to scores, main issues, effects, and fixes.

Examples:

- Avoid raw file-size units such as KiB/MB in the audit unless the user asks for technical detail.
- Avoid naming the website platform or hosting source unless it is truly relevant for the client.

## Optional Node Helper

You can use this after the Lighthouse JSON exists:

```js
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./lighthouse-results/rides2u-lighthouse.report.json', 'utf8'));
const c = data.categories;
const a = data.audits;
console.log({
  performance: Math.round(c.performance.score * 100),
  accessibility: Math.round(c.accessibility.score * 100),
  bestPractices: Math.round(c['best-practices'].score * 100),
  seo: Math.round(c.seo.score * 100),
  lcp: a['largest-contentful-paint']?.displayValue,
  tbt: a['total-blocking-time']?.displayValue,
  fcp: a['first-contentful-paint']?.displayValue,
  cls: a['cumulative-layout-shift']?.displayValue
});
```

## If Lighthouse Fails

Do not invent scores.

Write this in the Performance section:

`Speed test could not be completed. Scores need to be added manually.`

Then still complete the rest of the audit based on visible public-facing issues.

## Final Audit Requirements

The final audit must:

- Be easy to read as Markdown or plain text
- Use the Rides2U details
- Include Lighthouse results if available
- Include only relevant issues
- Be short and direct
- Use bracketed issue IDs for selected issues, for example `[2] The main visible content takes too long to load.`
- Avoid skipped numbered lists in the final client-facing issue lists
- Avoid excessive raw technical numbers and platform names
- Remove repetition across sections where possible
- Avoid backend/CMS/Webflow references
- Remove all template instructions
- Remove any unused issue options
- Remove square bracket placeholders, while keeping bracketed issue IDs when used

## Batch Accuracy Requirements

When auditing multiple sites, treat generated audits as drafts until verified.

Before saying the batch is ready:

- Confirm one text audit exists for every lead.
- Confirm every audit has the correct website, company, contact, and email.
- Confirm every saved Lighthouse score in the audit matches the Lighthouse JSON.
- Confirm the matching Lighthouse JSON and HTML files exist.
- Remove any issue that is not directly supported by Lighthouse, live page content, page source, sitemap/robots, public links, or rendered public-page evidence.
- If no issue is verified in a section, say no major issue was found from the external checks and do not add generic fixes for that section.
