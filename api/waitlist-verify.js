const { SUPABASE_KEY, findByToken, markVerified } = require('../lib/waitlist-db');

const SITE_URL = (process.env.SITE_URL || 'https://www.nink.com').replace(/\/$/, '');
const DEALCHECK_URL = (process.env.DEALCHECK_URL || 'https://dealcheck.nink.com').replace(/\/$/, '');

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

function errorPage(title, message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Nink</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header class="site-header">
    <a class="logo" href="/"><img src="/images/nink-logo.png?v=3" alt="NINK" width="129" height="42"></a>
  </header>
  <main class="verify-page">
    <section class="verify-card">
      <h1>${title}</h1>
      <p>${message}</p>
      <a class="button primary" href="/">Back to nink.com</a>
    </section>
  </main>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method not allowed');
    return;
  }

  const url = new URL(req.url || '/', SITE_URL);
  const token = String(url.searchParams.get('token') || '').trim();

  if (!token) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(errorPage('Invalid link', 'This confirmation link is missing a token. Please register again from the homepage.'));
    return;
  }

  if (!SUPABASE_KEY) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(errorPage('Server error', 'Registration is not configured yet. Please try again later.'));
    return;
  }

  try {
    const row = await findByToken(token);

    if (!row) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(errorPage('Invalid link', 'This confirmation link is not valid. It may have already been used.'));
      return;
    }

    if (row.email_verified_at) {
      return redirect(res, DEALCHECK_URL);
    }

    const expiresAt = row.verification_token_expires_at
      ? new Date(row.verification_token_expires_at).getTime()
      : 0;

    if (!expiresAt || expiresAt < Date.now()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(errorPage(
        'Link expired',
        'This confirmation link has expired. Go back to nink.com and sign up again to receive a new email.'
      ));
      return;
    }

    await markVerified(row.id);
    return redirect(res, DEALCHECK_URL);
  } catch (err) {
    console.error('waitlist-verify error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(errorPage('Server error', 'Something went wrong confirming your email. Please try the link again.'));
  }
};
