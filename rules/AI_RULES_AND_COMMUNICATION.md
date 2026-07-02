# Rules for AI Website Audits

## Purpose

This project audits websites from a public-facing perspective. The output should be short, practical, and client-facing.

The audit should focus on:

- Performance
- Site style and experience
- Animation, movement, and interactions
- Code and third-party scripts
- Asset and media performance
- SEO and crawlability
- Website standards and visible quality issues

Do not create a content strategy audit unless specifically asked.

## Tone

Use direct, practical language.

The audit should sound like a professional web developer reviewing the site and identifying what can be improved.

Avoid:

- Overly technical wording when plain English works better
- Raw technical measurements in the client-facing audit unless they are easy to understand
- Platform names or build-tool names unless the client specifically needs them
- Long explanations
- Repeating the same point across multiple sections
- Generic filler
- Guessing issues that were not checked
- Mentioning backend access, CMS access, analytics access, or Webflow access
- Leaving placeholder text in the final audit

When using Lighthouse/PageSpeed findings, translate technical details into plain language.

Examples:

- Say `The homepage is heavy` instead of listing raw page weight in KiB or MB.
- Say `Large background video is slowing the first view` instead of naming the hosting platform or video segment format.
- Say `A high amount of unused code is loading` instead of listing exact unused JavaScript kilobytes.
- Put performance observations into Main Issues, The Affects, or The Fixes.

## Placeholder Rule

Anything inside square brackets must be replaced with real audit content, unless it is a bracketed issue ID such as `[2]`.

Examples:

- `[COMPANY NAME]` becomes `Rides2U`
- `[WEBSITE URL]` becomes `https://www.rides2u.com/`
- `[Score]` becomes the actual Lighthouse score
- `[Main loading issue]` becomes the actual audit issue

Never leave square bracket placeholders in a finished client audit. Bracketed issue IDs are allowed.

## Selectable Issue System

Each audit section contains:

1. An issue list with bracketed issue IDs
2. `The Affects`
3. `The Fixes`

Use the issue IDs to keep the audit aligned.

Example:

If issues `[2]` and `[6]` are selected, only keep affects and fixes that include `[2]` or `[6]`.

In the finished audit, selected issues should be shown like this:

`[2] The main visible content takes too long to load.`

Do not use normal numbered lists for selected issues, because skipped numbers look broken to the reader.

Remove anything that does not apply.

## Messaging Direction

Select one messaging model:

### Problem-Led
Best when the company solves a clear pain point and the visitor needs to understand the problem before they understand the solution.

### Product-Led
Best when the company has one clear product and the website needs to explain what it does, why it is better, and why people should choose it.

### Platform-Led
Best when the company has multiple products, services, or features that should be positioned as one complete solution.

## Lighthouse Rules

Run Lighthouse or PageSpeed before completing the Performance section.

Use the mobile report by default unless otherwise instructed.

Include:

- Performance score
- Accessibility score
- Best Practices score
- SEO score
- Largest Contentful Paint
- Total Blocking Time

The raw Lighthouse values should be checked and saved, but the client-facing audit should only include the selected score values, main issues, effects, and fixes.

Do not invent Lighthouse scores or metrics.

If Lighthouse fails, write: `Speed test could not be completed. Scores need to be added manually.`

## Evidence Rules

Only include issues that can be checked externally from the live website, browser DevTools, page source, Lighthouse/PageSpeed, sitemap, and indexed search results.

Do not claim internal build issues unless they are visible from the public site.

Accuracy is more important than filling every section. If a section has no externally verified issue, write that no major issue was found from the external checks and do not add generic fixes.

Do not infer visual, UX, animation, proof, trust, sitemap, staging, or platform issues from loose patterns. Include them only when there is direct public evidence such as a visible page issue, Lighthouse failure, broken public link, page source, rendered page structure, or sitemap/indexing result.

Before delivering a batch, verify:

- Every audit has the correct lead details.
- Every score matches the saved Lighthouse JSON.
- Every Lighthouse JSON and HTML report exists.
- No audit contains raw technical clutter unless the user asked for it.
- No video, script, accessibility, SEO, or link claim appears without matching evidence.

## Output Rules

The final audit should be easy to read as a text or Markdown file. It does not need to be Figma-ready unless the user asks for that.

Remove all instructions from the final audit.

Keep section headings consistent with the template unless the user asks for a clearer text-file format.

Before finishing, review the audit for repetition. If two sections say the same thing, keep the clearest version and remove the weaker one.
