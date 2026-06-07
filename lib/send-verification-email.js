const RESEND_API_URL = 'https://api.resend.com/emails';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendResendEmail({ apiKey, from, to, subject, html }) {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Resend error ${response.status}`);
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return null;
  }
}

async function sendVerificationEmail({ to, firstName, verifyUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Nink <hello@nink.com>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const safeName = escapeHtml(firstName || 'there');
  const safeUrl = escapeHtml(verifyUrl);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:560px">
      <p style="font-size:28px;font-weight:900;color:#ff4f9a;margin:0 0 16px">nink<span style="font-size:14px">♥</span></p>
      <p>Hi ${safeName},</p>
      <p>Thanks for signing up for early access to Nink. Confirm your email to get your link to DealCheck:</p>
      <p style="margin:28px 0">
        <a href="${safeUrl}" style="background:#ff4f9a;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:700">
          Confirm email &amp; open DealCheck
        </a>
      </p>
      <p style="color:#555;font-size:14px">Or copy this link into your browser:<br><a href="${safeUrl}">${safeUrl}</a></p>
      <p style="color:#777;font-size:13px">This link expires in 48 hours. If you did not request access, you can ignore this email.</p>
    </div>
  `.trim();

  return sendResendEmail({
    apiKey,
    from,
    to: [to],
    subject: 'Confirm your Nink early access',
    html
  });
}

async function sendSignupNotificationEmail({ firstName, lastName, email, isResubmit = false }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Nink <hello@nink.com>';
  const notifyTo = process.env.WAITLIST_NOTIFY_EMAIL || 'peter@nink.com';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const safeFirst = escapeHtml(firstName);
  const safeLast = escapeHtml(lastName);
  const safeEmail = escapeHtml(email);
  const label = isResubmit ? 'Waitlist re-registration' : 'New waitlist signup';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:560px">
      <p style="font-weight:700;margin:0 0 12px">${label}</p>
      <p style="margin:0"><strong>Name:</strong> ${safeFirst} ${safeLast}</p>
      <p style="margin:8px 0 0"><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
      <p style="color:#777;font-size:13px;margin-top:16px">A confirmation email was sent to this address.</p>
    </div>
  `.trim();

  return sendResendEmail({
    apiKey,
    from,
    to: [notifyTo],
    subject: `Nink: ${label} — ${firstName} ${lastName}`,
    html
  });
}

module.exports = { sendVerificationEmail, sendSignupNotificationEmail };
