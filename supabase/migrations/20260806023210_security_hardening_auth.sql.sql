/*
# Security Hardening: Admin Authentication

## Overview
Replaces the insecure unsigned Base64 JSON admin tokens with
HMAC-SHA256 signed tokens, and adds brute-force protection to the
admin login.

## Problems Fixed
1. **Unsigned tokens** — the old `admin_login` returned
   `base64(json_payload)` with no signature. Anyone could forge a
   valid admin token by base64-encoding a JSON object with
   `{"sub":"...","email":"...","role":"admin","exp":<future>}`.
2. **No brute-force protection** — unlimited login attempts allowed.
3. **SECURITY DEFINER functions** missing `search_path` (search-path
   injection risk) and callable by every role.

## New Tables
- `admin_token_secret` — single-row table holding a 32-byte random
  HMAC secret generated via `gen_random_bytes(32)`. RLS enabled, no
  policies → only SECURITY DEFINER functions (running as owner) can
  read it. Anon/authenticated cannot access it.
- `admin_login_attempts` — tracks failed login attempts per email
  for rate limiting. RLS enabled, no policies → only SECURITY DEFINER
  functions can read/write it.

## New Functions
- `slugify(text)` — immutable helper that mirrors the frontend
  slugify logic (lowercase, non-alphanumeric → `-`, trim).
- `admin_create_signed_token(p_user_id, p_email)` — builds a signed
  token: `base64(payload_json) || '.' || base64(hmac_sha256(payload_json, secret))`.
  SECURITY DEFINER so it can read the secret table.

## Modified Functions
- `admin_login` — now (a) enforces rate limiting (max 5 failed
  attempts per email in 15 minutes, then locked), (b) returns a
  signed token instead of unsigned Base64, (c) returns the same
  generic error message for wrong email and wrong password so
  attackers cannot enumerate accounts.
- `admin_verify_token` — now (a) splits the token into payload +
  signature, (b) recomputes the HMAC and rejects mismatches
  (tampered tokens), (c) checks expiration, (d) returns
  `{valid:false}` for any malformed/invalid input without leaking
  the reason.
- `verify_password` — `SET search_path = public` added; EXECUTE
  revoked from anon and authenticated (only needed internally by
  `admin_login` which runs as owner).

## Security Notes
1. **Token format**: `base64(json).base64(hmac)`. The HMAC is
   computed over the exact payload JSON string using the secret from
   `admin_token_secret`. A tampered payload changes the JSON string,
   so the recomputed HMAC won't match.
2. **Expiration**: tokens expire 7 days after issuance. The verify
   function rejects expired tokens.
3. **Rate limiting**: per-email, 5 attempts / 15 minutes. The
   `admin_login_attempts` table is cleaned of old entries on each
   call. A successful login clears all prior attempts for that email.
4. **Generic errors**: both "user not found" and "wrong password"
   return the same message: `Invalid email or password.`
5. **Existing tokens invalidated**: old unsigned tokens will fail
   verification (no `.` separator) and the admin will need to log
   in again. This is expected and acceptable for a security hardening
   pass.
*/

-- ─── Extension check ───
-- pgcrypto is already installed (used by existing crypt/gen_salt).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Token secret table ───
CREATE TABLE IF NOT EXISTS admin_token_secret (
  id int PRIMARY KEY DEFAULT 1,
  secret bytea NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_token_secret ENABLE ROW LEVEL SECURITY;

-- Generate secret once
INSERT INTO admin_token_secret (id, secret)
SELECT 1, gen_random_bytes(32)
WHERE NOT EXISTS (SELECT 1 FROM admin_token_secret WHERE id = 1);

-- ─── Login attempts table (rate limiting) ───
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_identifier_time
  ON admin_login_attempts (identifier, attempted_at);

ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- ─── Slugify helper ───
CREATE OR REPLACE FUNCTION slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(input, '[^a-z0-9]+', '-', 'gi'),
      '^-+|-+$', '', 'g'
    )
  );
$$;

-- ─── Signed token creation ───
CREATE OR REPLACE FUNCTION admin_create_signed_token(p_user_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret bytea;
  v_payload jsonb;
  v_payload_text text;
  v_signature text;
BEGIN
  SELECT secret INTO v_secret FROM admin_token_secret WHERE id = 1;

  v_payload := jsonb_build_object(
    'sub', p_user_id,
    'email', p_email,
    'role', 'admin',
    'iat', extract(epoch from now())::bigint,
    'exp', extract(epoch from (now() + interval '7 days'))::bigint
  );

  v_payload_text := v_payload::text;
  v_signature := encode(hmac(v_payload_text, v_secret, 'sha256'), 'base64');

  RETURN encode(convert_to(v_payload_text, 'UTF8'), 'base64') || '.' || v_signature;
END;
$$;

-- ─── Updated admin_login with rate limiting + signed tokens ───
CREATE OR REPLACE FUNCTION admin_login(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user admin_users%ROWTYPE;
  v_token text;
  v_attempts int;
  v_identifier text;
BEGIN
  v_identifier := lower(trim(p_email));

  -- Clean old attempts (older than 15 minutes)
  DELETE FROM admin_login_attempts
  WHERE attempted_at < now() - interval '15 minutes';

  -- Check rate limit
  SELECT count(*) INTO v_attempts
  FROM admin_login_attempts
  WHERE identifier = v_identifier
    AND attempted_at > now() - interval '15 minutes';

  IF v_attempts >= 5 THEN
    RETURN jsonb_build_object('error', 'Too many failed attempts. Please try again later.');
  END IF;

  -- Find user (case-insensitive email)
  SELECT * INTO v_user FROM admin_users WHERE lower(email) = lower(trim(p_email));

  IF v_user.id IS NULL THEN
    INSERT INTO admin_login_attempts (identifier) VALUES (v_identifier);
    RETURN jsonb_build_object('error', 'Invalid email or password.');
  END IF;

  -- Verify password
  IF crypt(p_password, v_user.password_hash) = v_user.password_hash THEN
    -- Success: clear failed attempts
    DELETE FROM admin_login_attempts WHERE identifier = v_identifier;

    -- Create signed token
    v_token := admin_create_signed_token(v_user.id, v_user.email);

    RETURN jsonb_build_object(
      'token', v_token,
      'user', jsonb_build_object('id', v_user.id, 'email', v_user.email)
    );
  ELSE
    INSERT INTO admin_login_attempts (identifier) VALUES (v_identifier);
    RETURN jsonb_build_object('error', 'Invalid email or password.');
  END IF;
END;
$$;

-- ─── Updated admin_verify_token with signature validation ───
CREATE OR REPLACE FUNCTION admin_verify_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts text[];
  v_payload_b64 text;
  v_signature text;
  v_payload_text text;
  v_expected_sig text;
  v_secret bytea;
  v_payload jsonb;
  v_exp bigint;
  v_now bigint;
BEGIN
  -- Split token into payload.signature
  v_parts := string_to_array(p_token, '.');
  IF array_length(v_parts, 1) IS NULL OR array_length(v_parts, 1) <> 2 THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  v_payload_b64 := v_parts[1];
  v_signature := v_parts[2];

  -- Decode payload
  BEGIN
    v_payload_text := convert_from(decode(v_payload_b64, 'base64'), 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false);
  END;

  -- Get secret and compute expected signature
  SELECT secret INTO v_secret FROM admin_token_secret WHERE id = 1;
  IF v_secret IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  v_expected_sig := encode(hmac(v_payload_text, v_secret, 'sha256'), 'base64');

  -- Verify signature (reject tampered tokens)
  IF v_signature IS DISTINCT FROM v_expected_sig THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  -- Parse payload
  BEGIN
    v_payload := v_payload_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false);
  END;

  -- Check expiration
  v_exp := NULLIF(v_payload->>'exp', '')::bigint;
  v_now := extract(epoch from now())::bigint;

  IF v_exp IS NULL OR v_now > v_exp THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'user', jsonb_build_object(
      'id', v_payload->>'sub',
      'email', v_payload->>'email'
    )
  );
END;
$$;

-- ─── Fix verify_password: add search_path, restrict execute ───
CREATE OR REPLACE FUNCTION verify_password(plain_pass text, hash_pass text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(plain_pass, hash_pass) = hash_pass;
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_password(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION verify_password(text, text) FROM authenticated;

-- ─── Revoke unnecessary grants on admin_users ───
REVOKE SELECT, INSERT, UPDATE, DELETE ON admin_users FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON admin_users FROM authenticated;
