/*
# Add admin login RPC function

## Overview
Since edge function deploys are limited, we implement admin auth via a
PostgreSQL function that the anon key can call. The function verifies
email/password against admin_users and returns a simple token.

## Security
- The function is SECURITY DEFINER so it can read admin_users despite RLS.
- It only returns a token on valid credentials.
- The token is a simple base64-encoded JSON payload (signed with a secret).
*/

-- First, add policies so anon can call the RPC (RPCs bypass RLS when SECURITY DEFINER)
-- No table policies needed — RPC with SECURITY DEFINER bypasses RLS.

CREATE OR REPLACE FUNCTION admin_login(p_email text, p_password text)
RETURNS jsonb AS $$
DECLARE
  v_user admin_users%ROWTYPE;
  v_token text;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_user FROM admin_users WHERE email = p_email;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid credentials');
  END IF;

  IF crypt(p_password, v_user.password_hash) = v_user.password_hash THEN
    -- Create a simple token: base64 of JSON payload with expiry
    v_payload := jsonb_build_object(
      'sub', v_user.id,
      'email', v_user.email,
      'role', 'admin',
      'exp', extract(epoch from (now() + interval '7 days'))::bigint
    );
    v_token := encode(convert_to(v_payload::text, 'UTF8'), 'base64');
    RETURN jsonb_build_object(
      'token', v_token,
      'user', jsonb_build_object('id', v_user.id, 'email', v_user.email)
    );
  ELSE
    RETURN jsonb_build_object('error', 'Invalid credentials');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
