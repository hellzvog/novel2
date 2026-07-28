/*
# Add admin token verify RPC

## Overview
Adds a function to verify an admin token (base64-encoded JSON) and
return the user info if valid and not expired.
*/

CREATE OR REPLACE FUNCTION admin_verify_token(p_token text)
RETURNS jsonb AS $$
DECLARE
  v_payload jsonb;
  v_exp bigint;
  v_now bigint;
BEGIN
  BEGIN
    v_payload := convert_from(decode(p_token, 'base64'), 'UTF8')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('valid', false);
  END;

  v_exp := (v_payload->>'exp')::bigint;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
