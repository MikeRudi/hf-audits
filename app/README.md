# Huck Finch Audits

Local app for reviewing the completed website audits and building new audits from the collected option bank.

## Run

From `audit_project_pack`:

```bash
npm run start:app
```

Open:

```text
http://localhost:5173
```

## Rebuild Data

If audit text files change, rebuild the app data:

```bash
npm run build:app-data
```

## Views

- `Audit Frames` shows each completed audit as a styled frame.
- `Template Library` shows the total reusable option bank collected from all 17 audits.
- `Build New Audit` lets you select or drag options into a new audit and copy the generated audit text.

When deployed with Vercel and Neon, audits, template-library edits, and manual score edits are saved through the API routes in `../api`.

Set one of these Vercel environment variables before deploying live editing:

```text
DATABASE_URL=your_neon_or_vercel_postgres_connection_string
POSTGRES_URL=your_vercel_postgres_connection_string
```

The API also accepts `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`.

If no database connection string is available, the app still works from the bundled audit JSON and saves draft builder state in browser local storage.
