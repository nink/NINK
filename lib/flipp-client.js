const FLIPP_BASE = 'https://backflipp.wishabi.com/flipp';
const DEFAULT_POSTAL = normalizePostal(process.env.FLIPP_POSTAL_CODE || 'L4N6B7');

function normalizePostal(v) {
  return String(v || '').replace(/\s+/g, '').toUpperCase();
}

const SEARCH_TERMS = [
  'milk', 'eggs', 'bread', 'butter', 'cheese', 'yogurt', 'chicken', 'beef', 'pork', 'bacon',
  'ham', 'sausage', 'salmon', 'shrimp', 'tuna', 'lettuce', 'tomatoes', 'potatoes', 'onions',
  'peppers', 'carrots', 'bananas', 'apples', 'grapes', 'strawberries', 'cereal', 'pasta', 'rice',
  'flour', 'sugar', 'oil', 'juice', 'coffee', 'tea', 'frozen', 'pizza', 'chips', 'crackers',
  'soup', 'deli', 'produce', 'organic', 'snacks', 'cream', 'water'
];

const RETAILER_NAMES = {
  foodbasics: 'Food Basics',
  sobeys: 'Sobeys',
  metro: 'Metro',
  nofrills: 'No Frills',
  freshco: 'FreshCo',
  superstore: 'Real Canadian Superstore',
  gianttiger: 'Giant Tiger',
  walmart: 'Walmart Canada',
  farmboy: 'Farm Boy',
  zehrs: 'Zehrs',
  loblaws: 'Loblaws'
};

const STORE_CONFIG = {
  foodbasics: { merchantId: 2265 },
  sobeys: { merchantId: 2072 },
  metro: { merchantId: 2269 },
  nofrills: { merchantId: 2332 },
  freshco: { merchantId: 2267 },
  superstore: { merchantId: 2271 },
  gianttiger: { merchantId: 991, groceryOnly: true },
  walmart: { merchantId: 234 },
  farmboy: { merchantId: 2711 },
  zehrs: { merchantId: 2340 },
  loblaws: { merchantId: 2018 }
};

function clean(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function priceNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const m = String(v).replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

function isoDate(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}

function dealLabel(pct) {
  if (pct == null) return 'Flyer price';
  if (pct >= 30) return 'Stock up';
  if (pct >= 15) return 'Good';
  return 'Small saving';
}

function isGroceryFlippItem(item) {
  if (item.item_type !== 'flyer') return false;
  const l1 = String(item._L1 || '');
  if (l1 && !/food|beverage|grocery|tobacco/i.test(l1)) return false;
  const name = String(item.name || '');
  const junk = /\b(curtain|patio|hammer|drill|sheet set|luggage|lego|nozzle|hose|paint|lamp|rug|tool)\b/i;
  if (junk.test(name)) return false;
  return priceNum(item.current_price) > 0 && name.length > 2;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'NinkDealCheck/1.0 (+https://www.nink.com)'
    }
  });
  if (!response.ok) throw new Error(`Flipp ${response.status} for ${url}`);
  return response.json();
}

async function fetchFlyers(postal = DEFAULT_POSTAL) {
  const code = normalizePostal(postal);
  const data = await fetchJson(`${FLIPP_BASE}/data?locale=en-ca&postal_code=${encodeURIComponent(code)}`);
  return data.flyers || [];
}

function isFlyerActive(flyer, now = new Date()) {
  const end = flyer?.valid_to ? new Date(flyer.valid_to) : null;
  if (!end || Number.isNaN(end.getTime())) return true;
  return end.getTime() >= now.getTime() - 6 * 60 * 60 * 1000;
}

function pickWeeklyFlyer(flyers, merchantId) {
  const mid = Number(merchantId);
  const candidates = flyers.filter((f) => {
    if (Number(f.merchant_id) !== mid) return false;
    if (!isFlyerActive(f)) return false;
    const cats = f.categories || [];
    return cats.includes('Groceries') || cats.some((c) => /grocer/i.test(c));
  });

  if (!candidates.length) return null;

  const weekly = candidates.filter((f) => /weekly|eflyer|\bflyer\b|\bad\b/i.test(String(f.name || '')));
  const pool = weekly.length ? weekly : candidates;
  return pool.sort((a, b) => new Date(b.valid_to) - new Date(a.valid_to))[0] || null;
}

async function fetchFlyerItems(postal, merchantId, flyerId, groceryOnly = false) {
  const seen = new Map();
  const code = normalizePostal(postal);

  for (const term of SEARCH_TERMS) {
    const url =
      `${FLIPP_BASE}/items/search?locale=en-ca&postal_code=${encodeURIComponent(code)}` +
      `&merchant_id=${merchantId}&q=${encodeURIComponent(term)}`;
    const data = await fetchJson(url);

    for (const item of data.items || []) {
      if (flyerId && item.flyer_id !== flyerId) continue;
      if (flyerId && Number(item.merchant_id) !== Number(merchantId)) continue;
      if (groceryOnly && !isGroceryFlippItem(item)) continue;
      if (!groceryOnly && item.item_type !== 'flyer') continue;
      if (!groceryOnly && !(priceNum(item.current_price) > 0)) continue;

      const key = String(item.flyer_item_id || item.id || `${item.name}|${item.current_price}`);
      seen.set(key, item);
    }
  }

  return [...seen.values()];
}

function mapFlippItemToDeal(item, retailer, flyer) {
  const current = priceNum(item.current_price);
  const regular = priceNum(item.original_price);
  let savings_amount = null;
  let savings_percent = null;
  if (regular && regular > current) {
    savings_amount = Math.round((regular - current) * 100) / 100;
    savings_percent = Math.round(((regular - current) / regular) * 1000) / 10;
  }

  const validFrom = isoDate(item.valid_from || flyer?.valid_from) || isoDate(new Date().toISOString());
  const validTo = isoDate(item.valid_to || flyer?.valid_to) || validFrom;

  return {
    retailer,
    product_name: clean(item.name),
    brand: '',
    current_price: current,
    regular_price: regular,
    unit_price: clean(item.post_price_text || item.pre_price_text || ''),
    category: clean(item._L2 || item._L1 || ''),
    image_url: clean(item.clean_image_url || item.clipping_image_url || ''),
    source_url: `https://flipp.com/flyers/groceries`,
    valid_from: validFrom,
    valid_to: validTo,
    savings_amount,
    savings_percent,
    deal_label: clean(item.sale_story || '') || dealLabel(savings_percent),
    offer_id: String(item.flyer_item_id || item.id || ''),
    scraped_at: new Date().toISOString(),
    raw: {
      parser_version: 'flipp-api-v1',
      flipp_flyer_id: item.flyer_id,
      flipp_item_id: item.flyer_item_id || item.id,
      merchant_id: item.merchant_id,
      source_object: {
        name: item.name,
        sale_story: item.sale_story,
        _L1: item._L1,
        _L2: item._L2
      }
    }
  };
}

async function ingestStore(storeKey, postal = DEFAULT_POSTAL) {
  const config = STORE_CONFIG[storeKey];
  const retailer = RETAILER_NAMES[storeKey];
  if (!config || !retailer) throw new Error(`Unknown store key: ${storeKey}`);

  const code = normalizePostal(postal);
  const flyers = await fetchFlyers(code);
  let flyer = pickWeeklyFlyer(flyers, config.merchantId);

  if (!flyer) {
    const merchantFlyers = flyers.filter((f) => Number(f.merchant_id) === Number(config.merchantId));
    return {
      ok: false,
      store: storeKey,
      retailer,
      postal_code: code,
      error: 'No active weekly grocery flyer found on Flipp',
      debug: {
        flipp_flyers_total: flyers.length,
        merchant_flyers: merchantFlyers.map((f) => ({
          id: f.id,
          name: f.name,
          valid_to: f.valid_to,
          categories: f.categories
        }))
      }
    };
  }

  let items = await fetchFlyerItems(code, config.merchantId, flyer.id, !!config.groceryOnly);

  // Fallback: some banners return items under a sibling flyer id in search results
  if (!items.length) {
    items = await fetchFlyerItems(code, config.merchantId, null, !!config.groceryOnly);
  }

  const deals = items
    .map((item) => mapFlippItemToDeal(item, retailer, flyer))
    .filter((d) => d.product_name && d.current_price > 0);

  const seen = new Set();
  const unique = deals.filter((d) => {
    const key = `${d.product_name}|${d.current_price}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ok: true,
    store: storeKey,
    retailer,
    postal_code: code,
    flyer: { id: flyer.id, name: flyer.name, valid_from: isoDate(flyer.valid_from), valid_to: isoDate(flyer.valid_to) },
    parsed: unique.length,
    deals: unique
  };
}

module.exports = {
  DEFAULT_POSTAL,
  SEARCH_TERMS,
  STORE_CONFIG,
  RETAILER_NAMES,
  ingestStore,
  fetchFlyers,
  pickWeeklyFlyer
};
