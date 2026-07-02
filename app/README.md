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

Set this Vercel environment variable before deploying live editing:

```text
DATABASE_URL=your_neon_connection_string
```

If `DATABASE_URL` is not available, the app still works from the bundled audit JSON and saves draft builder state in browser local storage.
