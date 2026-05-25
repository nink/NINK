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
  const url = new URL(req.url, "https://www.nink.com");
  return url.searchParams.get("token");
}

function toPrice(text) {
  const match = String(text).match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
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

    const priceMatches = html.match(/\$\s*\d+(?:\.\d{1,2})?/g) || [];

    const rows = priceMatches.slice(0, 50).map((price, index) => ({
      retailer: "Walmart Canada",
      product_name: `Walmart flyer detected price ${index + 1}`,
      current_price: toPrice(price),
      source_url: SOURCE_URL,
      raw: {
        detected_price: price,
        parser_version: "basic-price-v1",
      },
    }));

    if (rows.length > 0) {
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
        return reply(res, 500, {
          ok: false,
          error: "Supabase insert failed",
          details: await inserted.text(),
        });
      }
    }

    return reply(res, 200, {
      ok: true,
      source: SOURCE_URL,
      detected_prices: priceMatches.length,
      inserted: rows.length,
      sample: rows.slice(0, 5),
    });
  } catch (error) {
    return reply(res, 500, {
      ok: false,
      error: error.message,
    });
  }
};
