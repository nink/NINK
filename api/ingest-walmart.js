const crypto = require("crypto");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xjaqmmkkdyynggawqxec.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const { runFlyerEnrichmentAfterIngest } = require("../lib/dealcheck-enrichment");
const SOURCE_URL = "https://www.walmart.ca/en/shop/weekly-flyer-features/6000196190101";

function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data, null, 2));
}
function token(req) { return new URL(req.url, "https://www.nink.com").searchParams.get("token"); }
function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
function price(v) {
  const m = String(v || "").replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}
function round1(v) { return Number.isFinite(v) ? Math.round(v * 10) / 10 : null; }
function plusDays(days) { return new Date(Date.now() + days * 86400000).toISOString(); }
function categoryText(obj) {
  if (Array.isArray(obj.category?.path)) return obj.category.path.map(p => p.name).filter(Boolean).join(" > ");
  return clean(obj.category || obj.categoryName || obj.department || "");
}
function fingerprint(rows) {
  const payload = rows.map(r => `${r.product_name}|${r.current_price}|${r.regular_price || ""}`).sort().join("\n");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function walk(obj, rows) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) return obj.forEach(x => walk(x, rows));

  const name = obj.name || obj.productName || obj.title || obj.displayName || obj.usItemName || obj.productTitle;
  const rawCurrent = obj.price || obj.salePrice || obj.currentPrice || obj.displayPrice || obj.priceString || obj.finalPrice || obj.priceInfo?.linePrice;
  const current = typeof rawCurrent === "number" ? rawCurrent : price(JSON.stringify(rawCurrent || ""));

  if (name && current && current > 0) {
    const regular = price(JSON.stringify(obj.wasPrice || obj.regularPrice || obj.listPrice || obj.priceInfo?.wasPrice || ""));
    const savingsAmount = typeof obj.priceInfo?.savingsAmt === "number" ? obj.priceInfo.savingsAmt : (regular && regular > current ? round1(regular - current) : null);
    const savingsPercent = regular && regular > current ? round1(((regular - current) / regular) * 100) : null;
    const catText = categoryText(obj);

    rows.push({
      retailer: "Walmart Canada",
      product_name: clean(name),
      brand: clean(obj.brand || obj.brandName || ""),
      current_price: current,
      regular_price: regular,
      savings_amount: savingsAmount,
      savings_percent: savingsPercent,
      unit_price: clean(obj.unitPrice || obj.pricePerUnit || obj.priceInfo?.unitPrice || ""),
      deal_label: clean(obj.flag || obj.badge?.text || obj.priceInfo?.linePriceDisplay || ""),
      offer_id: clean(obj.offerId || ""),
      walmart_item_id: clean(obj.usItemId || obj.id || ""),
      availability: clean(obj.availabilityStatusV2?.display || obj.availabilityStatusDisplayValue || ""),
      category: catText,
      category_path: clean(obj.category?.categoryPathId || catText),
      image_url: clean(obj.imageUrl || obj.thumbnailUrl || obj.productImageUrl || obj.imageInfo?.thumbnailUrl || obj.image || ""),
      source_url: SOURCE_URL,
      raw: { parser_version: "product-json-v3", source_object: obj }
    });
  }
  Object.values(obj).forEach(v => walk(v, rows));
}

function parse(html) {
  const rows = [];
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const tag of scripts) {
    const body = tag.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    if (!body.includes("product") && !body.includes("price") && !body.includes("__NEXT_DATA__")) continue;
    const m = body.match(/\{[\s\S]*\}/);
    if (!m) continue;
    try { walk(JSON.parse(m[0]), rows); } catch (_) {}
  }
  const seen = new Set();
  return rows.filter(r => r.product_name && r.current_price).filter(r => {
    const key = `${r.product_name}|${r.current_price}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 300);
}

async function db(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text);
  try { return JSON.parse(text); } catch (_) { return null; }
}

async function latestFingerprint() {
  const rows = await db("flyer_deals?select=raw,product_name&retailer=eq.Walmart%20Canada&order=scraped_at.desc&limit=50");
  const real = (rows || []).find(r => !String(r.product_name || "").startsWith("Walmart flyer detected price"));
  return real?.raw?.flyer_fingerprint || null;
}
async function expireOld(now) {
  await db(`flyer_deals?retailer=eq.Walmart%20Canada&valid_to=gte.${encodeURIComponent(now)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ valid_to: now })
  });
}
async function insert(rows) {
  await db("flyer_deals", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(rows) });
}

module.exports = async function handler(req, res) {
  if (!SUPABASE_KEY) return reply(res, 500, { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" });
  const ok = token(req) === CRON_SECRET || req.headers["user-agent"] === "vercel-cron/1.0";
  if (!ok) return reply(res, 401, { ok: false, error: "Unauthorized" });

  try {
    const page = await fetch(SOURCE_URL, { headers: { accept: "text/html", "user-agent": "Mozilla/5.0 DealCheckBot/0.1" } });
    const html = await page.text();
    if (!page.ok) return reply(res, 502, { ok: false, error: "Walmart fetch failed", status: page.status });
    if (html.includes("Press & Hold") || html.includes("Access Denied") || html.includes("Robot or human")) return reply(res, 502, { ok: false, error: "Walmart bot protection page returned" });

    const parsed = parse(html);
    if (!parsed.length) return reply(res, 200, { ok: true, inserted: 0, message: "No product rows parsed. Existing active deals unchanged." });

    const now = new Date().toISOString();
    const validTo = plusDays(7);
    const fp = fingerprint(parsed);
    const previous = await latestFingerprint();
    if (fp === previous) return reply(res, 200, { ok: true, changed: false, inserted: 0, fingerprint: fp, message: "Walmart flyer unchanged. No duplicate rows inserted." });

    const rows = parsed.map(r => ({ ...r, valid_from: now, valid_to: validTo, raw: { ...r.raw, flyer_fingerprint: fp, detected_at: now } }));
    await expireOld(now);
    await insert(rows);

    let enrichment = { skipped: true };
    try {
      enrichment = await runFlyerEnrichmentAfterIngest({
        retailer: "Walmart Canada",
        onlyMissing: true,
        activeOnly: true,
        maxBatches: 10
      });
    } catch (error) {
      enrichment = { ok: false, error: error.message };
    }

    return reply(res, 200, { ok: true, changed: true, parser: "product-json-v3", inserted: rows.length, fingerprint: fp, valid_from: now, valid_to: validTo, enrichment, sample: rows.slice(0, 10) });
  } catch (error) {
    return reply(res, 500, { ok: false, error: error.message });
  }
};
