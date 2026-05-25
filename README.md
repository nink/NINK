# Nink.com (NINK repo)

Public brand site and **backend data jobs** for [nink.com](https://www.nink.com).

This repo is **not** the DealCheck app. The shopper-facing product (deals, barcode scan, filters) lives in a separate repo and deploys to [dealcheck.nink.com](https://dealcheck.nink.com).

---

## What this repo is for

| Role | Description |
|------|-------------|
| **Brand / marketing site** | Splash page at nink.com — may change over time as the Nink brand evolves |
| **Flyer ingestion APIs** | Serverless endpoints that pull grocery flyer data into Supabase |
| **Scheduled jobs** | Vercel cron triggers daily Walmart ingest (see `vercel.json`) |

`nink.com` and DealCheck are intentionally **separate** so the main site can morph (new positioning, landing pages, etc.) without touching the DealCheck prototype.

---

## Live URLs

| URL | Purpose |
|-----|---------|
| https://www.nink.com | Marketing / splash site (`index.html`, `style.css`) |
| https://www.nink.com/api/ingest-walmart | Walmart flyer ingest |
| https://www.nink.com/api/ingest-gianttiger | Giant Tiger flyer ingest |
| https://www.nink.com/api/ingest-foodbasics | Food Basics flyer ingest |
| https://www.nink.com/api/debug-foodbasics | Food Basics debug / diagnostics |

Ingest endpoints require `CRON_SECRET` (Vercel env var) via `?token=...` or `Authorization: Bearer ...`.

---

## Related project

| Item | Link |
|------|------|
| DealCheck app (UI) | https://dealcheck.nink.com |
| DealCheck source code | [github.com/nink/dealcheck](https://github.com/nink/dealcheck) |
| Database | Supabase project `nink` |

DealCheck **reads** flyer deals from Supabase. This repo **writes** flyer data via the ingest APIs.

---

## Repo layout

```
NINK/
├── index.html          # nink.com homepage
├── style.css           # Homepage styles
├── vercel.json         # Cron schedule + Vercel config
└── api/
    ├── ingest-walmart.js
    ├── ingest-gianttiger.js
    ├── ingest-foodbasics.js
    └── debug-foodbasics.js
```

---

## Deployment

- **Host:** [Vercel](https://vercel.com)
- **Domain:** nink.com (and www)
- **Secrets (Vercel → Settings → Environment Variables):**
  - `CRON_SECRET` — protects ingest URLs
  - `SUPABASE_URL` — Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY` — write access for ingest scripts

Do not commit secrets to this repo.

---

## Suggested GitHub repo description

Use this on the repo’s GitHub **About** section (click the gear icon next to “About” on [github.com/nink/NINK](https://github.com/nink/NINK)):

> Nink.com brand site + grocery flyer ingest APIs. DealCheck app is in the dealcheck repo.

**Topics (optional):** `nink`, `grocery`, `vercel`, `supabase`

---

## Status

Active development started May 2026. Older keyboard-project files from 2025 were removed; history may still show those commits.
