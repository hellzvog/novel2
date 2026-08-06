-- Fix: hmac() in the extensions schema expects (bytea, bytea, text) or
-- (text, text, text). We were passing (text, bytea, text) which doesn't
-- match. Cast the payload text to bytea using convert_to().

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
  v_payload_bytes bytea;
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
  v_payload_bytes := convert_to(v_payload_text, 'UTF8');
  v_signature := encode(hmac(v_payload_bytes, v_secret, 'sha256'), 'base64');

  RETURN encode(v_payload_bytes, 'base64') || '.' || v_signature;
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
  v_payload_bytes bytea;
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
    v_payload_bytes := decode(v_payload_b64, 'base64');
    v_payload_text := convert_from(v_payload_bytes, 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false);
  END;

  SELECT secret INTO v_secret FROM admin_token_secret WHERE id = 1;
  IF v_secret IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  v_expected_sig := encode(hmac(v_payload_bytes, v_secret, 'sha256'), 'base64');

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
