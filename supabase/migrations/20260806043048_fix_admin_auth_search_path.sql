-- Fix: crypt() and gen_salt() live in the `extensions` schema, but the
-- SECURITY DEFINER admin auth functions set search_path = public only,
-- so they fail with "function crypt(text, text) does not exist".
-- Include `extensions` in the search_path for all affected functions.

CREATE OR REPLACE FUNCTION admin_login(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

CREATE OR REPLACE FUNCTION admin_create_signed_token(p_user_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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

CREATE OR REPLACE FUNCTION admin_verify_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
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
  v_parts := string_to_array(p_token, '.');
  IF array_length(v_parts, 1) IS NULL OR array_length(v_parts, 1) <> 2 THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  v_payload_b64 := v_parts[1];
  v_signature := v_parts[2];

  BEGIN
    v_payload_text := convert_from(decode(v_payload_b64, 'base64'), 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false);
  END;

  SELECT secret INTO v_secret FROM admin_token_secret WHERE id = 1;
  IF v_secret IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  v_expected_sig := encode(hmac(v_payload_text, v_secret, 'sha256'), 'base64');

  IF v_signature IS DISTINCT FROM v_expected_sig THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  BEGIN
    v_payload := v_payload_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false);
  END;

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

CREATE OR REPLACE FUNCTION verify_password(plain_pass text, hash_pass text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  RETURN crypt(plain_pass, hash_pass) = hash_pass;
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_password(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION verify_password(text, text) FROM authenticated;
