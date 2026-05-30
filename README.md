# Nink.com (NINK repo)

Public brand site and **backend data jobs** for [nink.com](https://www.nink.com).

This repo is **not** the DealCheck app. The shopper-facing product (deals, barcode scan, filters) lives in a separate repo and deploys to [dealcheck.nink.com](https://dealcheck.nink.com).

---

## What this repo is for

| Role | Description |
|------|-------------|
| **Brand / marketing site** | Splash page at nink.com with email-verified early access registration |
| **Waitlist API** | Collects first name / last name / email, sends confirmation email, redirects to DealCheck after verify |
| **Flyer ingestion APIs** | Serverless endpoints that pull grocery flyer data into Supabase |
| **Scheduled jobs** | Flyer ingest crons moved to [dealcheck.nink.com](https://dealcheck.nink.com) (Flipp, Walmart, PC Express) |

`nink.com` and DealCheck are intentionally **separate** so the main site can morph (new positioning, landing pages, etc.) without touching the DealCheck prototype.

---

## Live URLs

| URL | Purpose |
|-----|---------|
| https://www.nink.com | Marketing / splash site (`index.html`, `style.css`) |
| https://dealcheck.nink.com/api/ingest-flipp?store=foodbasics | Flipp flyer ingest (all `store=` keys on DealCheck) |
| https://dealcheck.nink.com/api/ingest-walmart | Walmart flyer scrape |

Ingest endpoints require `CRON_SECRET` (Vercel env var) via `?token=...` or `Authorization: Bearer ...`.

---

## Related project

| Item | Link |
|------|------|
| DealCheck app (UI) | https://dealcheck.nink.com |
| DealCheck source code | [github.com/nink/dealcheck](https://github.com/nink/dealcheck) |
| Database | Supabase project `nink` |

DealCheck **reads and writes** flyer deals via ingest APIs on [dealcheck.nink.com](https://dealcheck.nink.com). This repo is the public brand site only.

---

## Repo layout

```
NINK/
├── index.html          # nink.com homepage (early access registration form)
├── register.js         # Client-side waitlist form handler
├── style.css           # Homepage styles
├── schema-waitlist-registrations-migration.sql
├── vercel.json         # Cron schedule + Vercel config
├── lib/
│   ├── waitlist-db.js
│   └── send-verification-email.js
└── api/
    ├── waitlist-register.js
    ├── waitlist-verify.js
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
  - `SUPABASE_SERVICE_ROLE_KEY` — write access for ingest + waitlist
  - `RESEND_API_KEY` — sends confirmation emails ([resend.com](https://resend.com))
  - `RESEND_FROM_EMAIL` — e.g. `Nink <hello@nink.com>` (domain must be verified in Resend)
  - `SITE_URL` — optional, defaults to `https://www.nink.com`
  - `DEALCHECK_URL` — optional, defaults to `https://dealcheck.nink.com`
  - `FLIPP_POSTAL_CODE` — your market postal code (e.g. `M5H2N2`, no space)

Do not commit secrets to this repo.

### Waitlist setup (one-time)

1. Run `schema-waitlist-registrations-migration.sql` in the Supabase SQL editor.
2. Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the **NINK** Vercel project.
3. Verify your sending domain in Resend so confirmation emails deliver reliably.

Flow: visitor registers on nink.com → receives email → clicks confirm link → redirected to DealCheck. Direct access to `dealcheck.nink.com` still works for now.

---

## Suggested GitHub repo description

Use this on the repo’s GitHub **About** section (click the gear icon next to “About” on [github.com/nink/NINK](https://github.com/nink/NINK)):

> Nink.com brand site + grocery flyer ingest APIs. DealCheck app is in the dealcheck repo.

**Topics (optional):** `nink`, `grocery`, `vercel`, `supabase`

---

## Status

Active development started May 2026. Older keyboard-project files from 2025 were removed; history may still show those commits.
