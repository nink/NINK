const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xjaqmmkkdyynggawqxec.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function db(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text);
  try {
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return null;
  }
}

async function expireActiveDeals(retailer, nowIso) {
  const enc = encodeURIComponent(retailer);
  await db(`flyer_deals?retailer=eq.${enc}&valid_to=gte.${encodeURIComponent(nowIso)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ valid_to: nowIso })
  });
}

async function insertDeals(rows) {
  if (!rows.length) return;
  await db('flyer_deals', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(rows)
  });
}

module.exports = { db, expireActiveDeals, insertDeals, SUPABASE_KEY };
