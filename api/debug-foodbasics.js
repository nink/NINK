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

module.exports = async function handler(req, res) {
  if (token(req) !== CRON_SECRET) return reply(res, 401, { ok: false, error: 'Unauthorized' });

  try {
    const page = await fetch(SOURCE_URL, {
      headers: {
        accept: 'text/html',
        'user-agent': 'Mozilla/5.0 DealCheckBot/0.1'
      }
    });

    const html = await page.text();
    const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    const prices = html.match(/\$\s*\d+(?:\.\d{1,2})?/g) || [];

    const interesting = [
      'flyer',
      'product',
      'price',
      'reebee',
      'flipp',
      'metro',
      'offer',
      'item',
      '__NEXT_DATA__',
      'window.__'
    ];

    const keywordHits = {};
    for (const word of interesting) {
      keywordHits[word] = html.toLowerCase().includes(word.toLowerCase());
    }

    return reply(res, 200, {
      ok: true,
      status: page.status,
      final_url: page.url,
      html_length: html.length,
      script_count: scripts.length,
      detected_prices: prices.length,
      price_sample: prices.slice(0, 20),
      keyword_hits: keywordHits,
      html_preview: html.slice(0, 3000)
    });
  } catch (error) {
    return reply(res, 500, { ok: false, error: error.message });
  }
};
