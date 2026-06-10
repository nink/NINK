const { sendContactEmail } = require('../lib/send-verification-email');

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

function cleanText(value, max = 4000) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return reply(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const firstName = cleanText(body.first_name, 80);
    const lastName = cleanText(body.last_name, 80);
    const email = cleanText(body.email, 254).toLowerCase();
    const subject = cleanText(body.subject, 120);
    const message = cleanText(body.message, 4000);

    if (!firstName || !lastName || !email || !subject || !message) {
      return reply(res, 400, { ok: false, error: 'All fields are required.' });
    }
    if (!isValidEmail(email)) {
      return reply(res, 400, { ok: false, error: 'Please enter a valid email address.' });
    }

    await sendContactEmail({ firstName, lastName, email, subject, message });

    return reply(res, 200, {
      ok: true,
      message: 'Thanks for reaching out. We will get back to you soon.'
    });
  } catch (error) {
    return reply(res, 500, {
      ok: false,
      error: error.message || 'Unable to send message right now.'
    });
  }
};
