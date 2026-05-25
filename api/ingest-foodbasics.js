const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xjaqmmkkdyynggawqxec.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const SOURCE_URL = 'https://www.foodbasics.ca/flyer';

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

function walk(obj, rows) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) return obj.forEach(x => walk(x, rows));

  const name = obj.name || obj.productName || obj.title || obj.displayName || obj.label || obj.description;
  const rawPrice = obj.price || obj.salePrice || obj.currentPrice || obj.displayPrice || obj.pricing || obj.amount;
  const current = typeof rawPrice === 'number' ? rawPrice : price(JSON.stringify(rawPrice || ''));

  if (name && current && current > 0) {
    const img = obj.image || obj.imageUrl || obj.thumbnailUrl || obj.picture || obj.src || '';
    rows.push({
      retailer: 'Food Basics',
      product_name: clean(name),
      brand: clean(obj.brand || obj.brandName || ''),
      current_price: current,
      regular_price: price(JSON.stringify(obj.regularPrice || obj.wasPrice || '')),
      unit_price: clean(obj.unitPrice || obj.pricePerUnit || ''),
      category: clean(obj.category || obj.categoryName || ''),
      image_url: clean(typeof img === 'string' ? img : JSON.stringify(img)),
      source_url: SOURCE_URL,
      raw: { parser_version: 'foodbasics-json-v1', source_object: obj }
    });
  }

  Object.values(obj).forEach(v => walk(v, rows));
}

function parseRows(html) {
  const rows = [];
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const tag of scripts) {
    const body = tag.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    if (!/product|price|flyer|offers|items/i.test(body)) continue;
    const match = body.match(/\{[\s\S]*\}/);
    if (!match) continue;
    try { walk(JSON.parse(match[0]), rows); } catch (e) {}
  }

  const seen = new Set();
  return rows.filter(r => {
    const key = `${r.product_name}|${r.current_price}`.toLowerCase();
    if (!r.product_name || !r.current_price || seen.has(key)) return false;
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
    const rows = parseRows(html);
    if (rows.length) await insert(rows);

    return reply(res, 200, {
      ok: true,
      source: SOURCE_URL,
      retailer: 'Food Basics',
      parsed: rows.length,
      inserted: rows.length,
      sample: rows.slice(0, 10).map(r => ({ product_name: r.product_name, brand: r.brand, current_price: r.current_price, image_url: r.image_url }))
    });
  } catch (error) {
    return reply(res, 500, { ok: false, error: error.message });
  }
};
