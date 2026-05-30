const crypto = require('crypto');
const { db, SUPABASE_KEY } = require('./flyer-db');

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createVerificationToken() {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  return { token, expiresAt };
}

async function findByEmail(email) {
  const normalized = normalizeEmail(email);
  const rows = await db(
    `waitlist_registrations?email=eq.${encodeURIComponent(normalized)}&limit=1`
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findByToken(token) {
  const rows = await db(
    `waitlist_registrations?verification_token=eq.${encodeURIComponent(token)}&limit=1`
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function insertRegistration({ firstName, lastName, email, token, expiresAt }) {
  const now = new Date().toISOString();
  const rows = await db('waitlist_registrations', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email: normalizeEmail(email),
      verification_token: token,
      verification_token_expires_at: expiresAt,
      updated_at: now
    })
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function updatePendingRegistration(id, { firstName, lastName, token, expiresAt }) {
  const now = new Date().toISOString();
  const rows = await db(`waitlist_registrations?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      verification_token: token,
      verification_token_expires_at: expiresAt,
      updated_at: now
    })
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function markVerified(id) {
  const now = new Date().toISOString();
  const rows = await db(`waitlist_registrations?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      email_verified_at: now,
      verification_token: null,
      verification_token_expires_at: null,
      updated_at: now
    })
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = {
  SUPABASE_KEY,
  normalizeEmail,
  normalizeName,
  isValidEmail,
  createVerificationToken,
  findByEmail,
  findByToken,
  insertRegistration,
  updatePendingRegistration,
  markVerified
};
