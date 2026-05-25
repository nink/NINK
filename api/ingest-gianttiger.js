const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xjaqmmkkdyynggawqxec.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const SOURCE_URL = 'https://www.gianttiger.com/pages/flyer';

function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data, null, 2));
}

function token(req) {
  return new URL(req.url, 'https://www.nink.com').searchParams.get('token');
}

function clean(v) {
  return String(v || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function price(v) {
  const m = String(v || '').replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

function findImage(obj) {
  const raw = obj.image || obj.imageUrl || obj.featured_image || obj.featuredImage || obj.src || obj.url || '';
  if (typeof raw === 'string') return raw.startsWith('//') ? 'https:' + raw : raw;
  if (raw && typeof raw === 'object') return findImage(raw);
  return '';
}

function walk(obj, rows) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) return obj.forEach(x => walk(x, rows));

  const name = obj.title || obj.name || obj.productName || obj.displayName || obj.handle;
  const rawPrice = obj.price || obj.compare_at_price || obj.salePrice || obj.currentPrice || obj.amount;
  let current = typeof rawPrice === 'number' ? rawPrice : price(JSON.stringify(rawPrice || ''));

  if (current && current > 1000) current = current / 100;

  if (name && current && current > 0) {
    rows.push({
      retailer: 'Giant Tiger',
      product_name: clean(name),
      brand: clean(obj.vendor || obj.brand || obj.brandName || ''),
      current_price: current,
      regular_price: price(JSON.stringify(obj.compare_at_price || obj.regularPrice || obj.wasPrice || '')),
      unit_price: clean(obj.unitPrice || obj.pricePerUnit || ''),
      category: clean(obj.product_type || obj.category || obj.categoryName || ''),
      image_url: clean(findImage(obj)),
      source_url: SOURCE_URL,
      raw: { parser_version: 'gianttiger-json-v1', source_object: obj }
    });
  }

  Object.values(obj).forEach(v => walk(v, rows));
}

function parseRows(html) {
  const rows = [];
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const tag of scripts) {
    const body = tag.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    if (!/product|price|variant|Shopify|flyer|item/i.test(body)) continue;

    const jsonBlocks = body.match(/\{[\s\S]*?\}/g) || [];
    for (const block of jsonBlocks.slice(0, 200)) {
      try { walk(JSON.parse(block), rows); } catch (e) {}
    }

    const big = body.match(/\{[\s\S]*\}/);
    if (big) {
      try { walk(JSON.parse(big[0]), rows); } catch (e) {}
    }
  }

  const seen = new Set();
  return rows.filter(r => {
    const key = `${r.product_name}|${r.current_price}`.toLowerCase();
    if (!r.product_name || !r.current_price || seen.has(key)) return false;
    if (r.product_name.length < 3) return false;
    seen.add(key);
    return true;
  }).slice(0, 200);
}

async function insert(rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/flyer_deals`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error(await r.text());
}

module.exports = async function handler(req, res) {
  if (!SUPABASE_KEY) return reply(res, 500, { ok: false, error: 'Missing Supabase service key' });
  if (token(req) !== CRON_SECRET) return reply(res, 401, { ok: false, error: 'Unauthorized' });

  try {
    const page = await fetch(SOURCE_URL, { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 DealCheckBot/0.1' } });
    const html = await page.text();

    if (!page.ok) return reply(res, 502, { ok: false, error: 'Source fetch failed', status: page.status, preview: html.slice(0, 500) });

    const rows = parseRows(html);
    if (rows.length) await insert(rows);

    return reply(res, 200, {
      ok: true,
      source: SOURCE_URL,
      retailer: 'Giant Tiger',
      parsed: rows.length,
      inserted: rows.length,
      sample: rows.slice(0, 10).map(r => ({ product_name: r.product_name, brand: r.brand, current_price: r.current_price, image_url: r.image_url }))
    });
  } catch (error) {
    return reply(res, 500, { ok: false, error: error.message });
  }
};
