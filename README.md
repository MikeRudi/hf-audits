# Website Audit Project Pack

This folder contains the reusable website audit template, rules for AI output, Codex instructions, and the lead list for upcoming audits.

## Folder Structure

- `templates/` — reusable audit templates for text, Markdown, and optional Figma output.
- `rules/` — rules for AI communication, audit standards, and wording.
- `codex/` — Codex startup instructions and the first task to run.
- `data/` — lead list of all websites to audit.
- `audits/` — generated completed audits go here.
- `app/` — the Huck Finch audit web app.
- `api/` — Vercel serverless API routes for live audit data.
- `lighthouse-results/` — Lighthouse JSON/HTML outputs go here.

## Live App

The app is designed to deploy on Vercel and store live data in Neon.

- `GET /api/state` loads audits, the template library, and manual scores.
- `PUT /api/state` saves library changes and manual score changes.
- `POST /api/audits` saves new or edited audits.
- Neon/Postgres needs a connection-string environment variable in Vercel. The API accepts `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, or `POSTGRES_URL_NON_POOLING`.
- If no database connection string is available, the app falls back to the bundled `app/data/audits.json` and browser local storage.

For local static testing:

```bash
npm run start:app
```

For Vercel-style local testing after Vercel is linked:

```bash
npm run dev
```

## Current Audit Style

Audits should be short, plain-language, and easy to read as text or Markdown.

- Use bracketed issue IDs such as `[2]` instead of normal numbered lists when selected issues skip numbers.
- Translate raw Lighthouse details into client-friendly language.
- Avoid unnecessary platform names, file-size units, and technical measurements in the client-facing audit.
- Remove repeated points so each section adds something useful.

## Current Startup Task

When Codex starts, it should only audit this first site:

- Company: Rides2U
- Contact: Ryan Kreager
- Email: ryan@rides2u.com
- Website: https://www.rides2u.com/

Do not audit the rest of the lead list until instructed.
