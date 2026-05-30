const {
  SUPABASE_KEY,
  normalizeEmail,
  normalizeName,
  isValidEmail,
  createVerificationToken,
  findByEmail,
  insertRegistration,
  updatePendingRegistration
} = require('../lib/waitlist-db');
const { sendVerificationEmail } = require('../lib/send-verification-email');

const SITE_URL = (process.env.SITE_URL || 'https://www.nink.com').replace(/\/$/, '');

function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  return JSON.parse(text);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, { ok: false, error: 'Method not allowed' });
  }

  if (!SUPABASE_KEY) {
    return reply(res, 500, { ok: false, error: 'Server is not configured for registrations yet.' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (_) {
    return reply(res, 400, { ok: false, error: 'Invalid JSON body' });
  }

  const firstName = normalizeName(body.first_name || body.firstName);
  const lastName = normalizeName(body.last_name || body.lastName);
  const email = normalizeEmail(body.email);

  if (!firstName || firstName.length > 80) {
    return reply(res, 400, { ok: false, error: 'Please enter your first name.' });
  }
  if (!lastName || lastName.length > 80) {
    return reply(res, 400, { ok: false, error: 'Please enter your last name.' });
  }
  if (!email || !isValidEmail(email)) {
    return reply(res, 400, { ok: false, error: 'Please enter a valid email address.' });
  }

  try {
    const existing = await findByEmail(email);

    if (existing?.email_verified_at) {
      return reply(res, 200, {
        ok: true,
        status: 'already_verified',
        message: 'This email is already confirmed. You can open DealCheck anytime.'
      });
    }

    const { token, expiresAt } = createVerificationToken();
    const verifyUrl = `${SITE_URL}/api/waitlist-verify?token=${encodeURIComponent(token)}`;

    if (existing) {
      await updatePendingRegistration(existing.id, {
        firstName,
        lastName,
        token,
        expiresAt
      });
    } else {
      await insertRegistration({
        firstName,
        lastName,
        email,
        token,
        expiresAt
      });
    }

    await sendVerificationEmail({ to: email, firstName, verifyUrl });

    return reply(res, 200, {
      ok: true,
      status: 'verification_sent',
      message: 'Check your email for a confirmation link. It may take a minute to arrive.'
    });
  } catch (err) {
    console.error('waitlist-register error:', err);
    return reply(res, 500, {
      ok: false,
      error: 'Could not complete registration. Please try again in a moment.'
    });
  }
};
