-- Waitlist / early-access registrations for nink.com
-- Run once in Supabase SQL Editor (project: nink)

CREATE TABLE IF NOT EXISTS waitlist_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  email_verified_at timestamptz,
  verification_token text,
  verification_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_registrations_email_lower_idx
  ON waitlist_registrations (lower(email));

CREATE INDEX IF NOT EXISTS waitlist_registrations_token_idx
  ON waitlist_registrations (verification_token)
  WHERE verification_token IS NOT NULL;
