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
        JSON.stringify(obj.wasPrice || obj.regularPrice || obj.listPrice || "")
      ),
      unit_price: clean(obj.unitPrice || obj.pricePerUnit || ""),
      category: clean(obj.category || obj.categoryName || obj.department || ""),
      image_url: clean(
        obj.imageUrl ||
          obj.thumbnailUrl ||
          obj.productImageUrl ||
          obj.image ||
          ""
      ),
      source_url: SOURCE_URL,
      raw: {
        parser_version: "product-json-v1",
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

function fallbackPriceRows(html) {
  const prices = html.match(/\$\s*\d+(?:\.\d{1,2})?/g) || [];

  return prices
    .map((price, index) => ({
      retailer: "Walmart Canada",
      product_name: `Walmart flyer detected price ${index + 1}`,
      current_price: toPrice(price),
      source_url: SOURCE_URL,
      raw: {
        detected_price: price,
        parser_version: "fallback-price-v1",
      },
    }))
    .filter((row) => row.current_price && row.current_price > 0)
    .slice(0, 50);
}

async function insertRows(rows) {
  const inserted = await fetch(`${SUPABASE_URL}/rest/v1/flyer_deals`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(rows),
  });

  if (!inserted.ok) {
    throw new Error(await inserted.text());
  }
}

module.exports = async function handler(req, res) {
  if (!SUPABASE_KEY) {
    return reply(res, 500, {
      ok: false,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  if (getToken(req) !== CRON_SECRET) {
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

    let rows = parseProductDeals(html);
    let parser = "product-json-v1";

    if (rows.length === 0) {
      rows = fallbackPriceRows(html);
      parser = "fallback-price-v1";
    }

    if (rows.length > 0) {
      await insertRows(rows);
    }

    return reply(res, 200, {
      ok: true,
      source: SOURCE_URL,
      parser,
      inserted: rows.length,
      sample: rows.slice(0, 10).map((row) => ({
        product_name: row.product_name,
        brand: row.brand,
        current_price: row.current_price,
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
