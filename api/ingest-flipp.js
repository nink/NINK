const { ingestStore, STORE_CONFIG } = require('../lib/flipp-client');
const { expireActiveDeals, insertDeals, SUPABASE_KEY } = require('../lib/flyer-db');

const CRON_SECRET = process.env.CRON_SECRET;

function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data, null, 2));
}

function isAuthorized(req) {
  if (!CRON_SECRET) return false;
  const authHeader = req.headers.authorization || '';
  const url = new URL(req.url, 'https://www.nink.com');
  const token = url.searchParams.get('token');
  return authHeader === `Bearer ${CRON_SECRET}` || token === CRON_SECRET || req.headers['user-agent'] === 'vercel-cron/1.0';
}

module.exports = async function handler(req, res) {
  if (!SUPABASE_KEY) return reply(res, 500, { ok: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
  if (!isAuthorized(req)) return reply(res, 401, { ok: false, error: 'Unauthorized' });

  const url = new URL(req.url, 'https://www.nink.com');
  const store = String(url.searchParams.get('store') || '').toLowerCase().replace(/[^a-z]/g, '');
  const all = url.searchParams.get('all') === '1';

  const keys = all ? Object.keys(STORE_CONFIG) : store ? [store] : [];
  if (!keys.length) {
    return reply(res, 400, {
      ok: false,
      error: 'Pass ?store=foodbasics (or sobeys, metro, nofrills, freshco, superstore, gianttiger, walmart, farmboy, zehrs) or ?all=1'
    });
  }

  const results = [];
  const now = new Date().toISOString();

  try {
    for (const key of keys) {
      if (!STORE_CONFIG[key]) {
        results.push({ ok: false, store: key, error: 'Unknown store' });
        continue;
      }

      const result = await ingestStore(key);
      if (!result.ok || !result.deals?.length) {
        results.push({ ...result, inserted: 0 });
        continue;
      }

      await expireActiveDeals(result.retailer, now);
      await insertDeals(result.deals);

      results.push({
        ok: true,
        store: key,
        retailer: result.retailer,
        flyer: result.flyer,
        parsed: result.parsed,
        inserted: result.deals.length,
        sample: result.deals.slice(0, 5).map((d) => ({
          product_name: d.product_name,
          current_price: d.current_price,
          valid_from: d.valid_from,
          valid_to: d.valid_to
        }))
      });
    }

    const ok = results.some((r) => r.inserted > 0);
    return reply(res, ok ? 200 : 502, { ok, ran_at: now, results });
  } catch (error) {
    return reply(res, 500, { ok: false, error: error.message, results });
  }
};
