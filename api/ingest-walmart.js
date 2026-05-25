const crypto = require("crypto");

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjaqmmkkdyynggawqxec.supabase.co";

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const SOURCE_URL =
  "https://www.walmart.ca/en/shop/weekly-flyer-features/6000196190101";

function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data, null, 2));
}

function getToken(req) {
  return new URL(req.url, "https://www.nink.com").searchParams.get("token");
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toPrice(value) {
  const match = String(value || "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

function makeIsoPlusDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeFingerprint(rows) {
  const payload = rows
    .map((row) => `${row.product_name}|${row.current_price}|${row.regular_price || ""}`)
    .sort()
    .join("\n");

  return crypto.createHash("sha256").update(payload).digest("hex");
}

function walk(obj, rows) {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    obj.forEach((x) => walk(x, rows));
    return;
  }

  const name =
    obj.name ||
    obj.productName ||
    obj.title ||
    obj.displayName ||
    obj.usItemName ||
    obj.productTitle;

  const priceRaw =
    obj.price ||
    obj.salePrice ||
    obj.currentPrice ||
    obj.displayPrice ||
    obj.priceString ||
    obj.finalPrice;

  const price =
    typeof priceRaw === "number" ? priceRaw : toPrice(JSON.stringify(priceRaw));

  if (name && price !== null && price > 0) {
    rows.push({
      retailer: "Walmart Canada",
      product_name: clean(name),
      brand: clean(obj.brand || obj.brandName || ""),
      current_price: price,
      regular_price: toPrice(
        JSON.stringify(
          obj.wasPrice ||
            obj.regularPrice ||
            obj.listPrice ||
            obj.priceInfo?.wasPrice ||
            ""
        )
      ),
      unit_price: clean(obj.unitPrice || obj.pricePerUnit || obj.priceInfo?.unitPrice || ""),
      category: clean(
        obj.category?.path?.map((p) => p.name).join(" > ") ||
          obj.category ||
          obj.categoryName ||
          obj.department ||
          ""
      ),
      image_url: clean(
        obj.imageUrl ||
          obj.thumbnailUrl ||
          obj.productImageUrl ||
          obj.imageInfo?.thumbnailUrl ||
          obj.image ||
          ""
      ),
      source_url: SOURCE_URL,
      raw: {
        parser_version: "product-json-v2",
        source_object: obj,
      },
    });
  }

  Object.values(obj).forEach((v) => walk(v, rows));
}

function parseProductDeals(html) {
  const rows = [];
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const tag of scripts) {
    const body = tag
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "");

    if (
      !body.includes("product") &&
      !body.includes("price") &&
      !body.includes("__NEXT_DATA__")
    ) {
      continue;
    }

    const jsonMatch = body.match(/\{[\s\S]*\}/);
    if (!jsonMatch) continue;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      walk(parsed, rows);
    } catch (_) {}
  }

  const seen = new Set();

  return rows
    .filter((row) => row.product_name && row.current_price)
    .filter((row) => {
      const key = `${row.product_name}|${row.current_price}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 300);
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) throw new Error(text);

  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function getLatestWalmartFingerprint() {
  const rows = await supabaseFetch(
    "flyer_deals?select=raw,product_name&retailer=eq.Walmart%20Canada&order=scraped_at.desc&limit=50"
  );

  const realRow = (rows || []).find(
    (row) => !String(row.product_name || "").startsWith("Walmart flyer detected price")
  );

  return realRow?.raw?.flyer_fingerprint || null;
}

async function expireActiveWalmartRows(nowIso) {
  await supabaseFetch(
    `flyer_deals?retailer=eq.Walmart%20Canada&valid_to=gte.${encodeURIComponent(nowIso)}`,
    {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ valid_to: nowIso }),
    }
  );
}

async function insertRows(rows) {
  await supabaseFetch("flyer_deals", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
}

module.exports = async function handler(req, res) {
  if (!SUPABASE_KEY) {
    return reply(res, 500, {
      ok: false,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const authorizedByToken = getToken(req) === CRON_SECRET;
  const authorizedByVercelCron = req.headers["user-agent"] === "vercel-cron/1.0";

  if (!authorizedByToken && !authorizedByVercelCron) {
    return reply(res, 401, {
      ok: false,
      error: "Unauthorized",
    });
  }

  try {
    const page = await fetch(SOURCE_URL, {
      headers: {
        accept: "text/html",
        "user-agent": "Mozilla/5.0 DealCheckBot/0.1",
      },
    });

    const html = await page.text();

    if (!page.ok) {
      return reply(res, 502, {
        ok: false,
        error: "Walmart fetch failed",
        status: page.status,
      });
    }

    if (
      html.includes("Press & Hold") ||
      html.includes("Access Denied") ||
      html.includes("Robot or human")
    ) {
      return reply(res, 502, {
        ok: false,
        error: "Walmart bot protection page returned",
      });
    }

    const parsedRows = parseProductDeals(html);

    if (parsedRows.length === 0) {
      return reply(res, 200, {
        ok: true,
        source: SOURCE_URL,
        parser: "product-json-v2",
        inserted: 0,
        message: "No product rows parsed. Existing active deals were not changed.",
      });
    }

    const nowIso = new Date().toISOString();
    const validToIso = makeIsoPlusDays(7);
    const fingerprint = makeFingerprint(parsedRows);
    const previousFingerprint = await getLatestWalmartFingerprint();

    if (fingerprint === previousFingerprint) {
      return reply(res, 200, {
        ok: true,
        source: SOURCE_URL,
        changed: false,
        inserted: 0,
        fingerprint,
        message: "Walmart flyer data has not changed. No duplicate rows inserted.",
      });
    }

    const rows = parsedRows.map((row) => ({
      ...row,
      valid_from: nowIso,
      valid_to: validToIso,
      raw: {
        ...row.raw,
        flyer_fingerprint: fingerprint,
        detected_at: nowIso,
      },
    }));

    await expireActiveWalmartRows(nowIso);
    await insertRows(rows);

    return reply(res, 200, {
      ok: true,
      source: SOURCE_URL,
      changed: true,
      parser: "product-json-v2",
      fingerprint,
      valid_from: nowIso,
      valid_to: validToIso,
      inserted: rows.length,
      sample: rows.slice(0, 10).map((row) => ({
        product_name: row.product_name,
        brand: row.brand,
        current_price: row.current_price,
        regular_price: row.regular_price,
        unit_price: row.unit_price,
      })),
    });
  } catch (error) {
    return reply(res, 500, {
      ok: false,
      error: error.message,
    });
  }
};
