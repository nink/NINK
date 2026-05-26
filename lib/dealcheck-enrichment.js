/**
 * Calls dealcheck enrichment backfill after flyer ingest uploads.
 * Requires CRON_SECRET and DEALCHECK_URL on the NINK Vercel project.
 */

async function runFlyerEnrichmentAfterIngest(options = {}) {
  const base = (process.env.DEALCHECK_URL || 'https://dealcheck.nink.com').replace(/\/$/, '');
  const token = process.env.CRON_SECRET;
  const retailer = options.retailer || null;
  const onlyMissing = options.onlyMissing !== false;
  const activeOnly = options.activeOnly !== false;
  const limit = Math.min(Number(options.limit || 200), 500);
  const maxBatches = Math.max(Number(options.maxBatches || 10), 1);

  if (!token) {
    return { ok: false, skipped: true, reason: 'CRON_SECRET not configured' };
  }

  let offset = 0;
  let batches = 0;
  let fetched = 0;
  let updated = 0;
  const errors = [];
  let done = false;

  while (!done && batches < maxBatches) {
    const params = new URLSearchParams({
      table: 'flyer_deals',
      limit: String(limit),
      offset: String(offset),
      token
    });
    if (onlyMissing) params.set('only_missing', '1');
    else params.set('only_missing', '0');
    if (activeOnly) params.set('active_only', '1');
    if (retailer) params.set('retailer', retailer);

    const response = await fetch(`${base}/api/backfill-enrichment?${params.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `DealCheck enrichment failed (${response.status})`);
    }

    fetched += data.fetched || 0;
    updated += data.updated || 0;
    errors.push(...(data.errors || []));
    done = data.done;
    offset = data.next_offset || 0;
    batches += 1;
    if (!data.fetched) break;
  }

  return {
    ok: true,
    retailer,
    fetched,
    updated,
    errors,
    batches,
    done,
    capped: !done && batches >= maxBatches
  };
}

module.exports = { runFlyerEnrichmentAfterIngest };
