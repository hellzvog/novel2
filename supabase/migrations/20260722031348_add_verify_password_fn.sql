/*
# Add verify_password function

## Overview
Adds a PL/pgSQL function that verifies a plaintext password against a
bcrypt hash using pgcrypto's crypt(). Used by the admin-auth edge function.
*/

CREATE OR REPLACE FUNCTION verify_password(plain_pass text, hash_pass text)
RETURNS boolean AS $$
BEGIN
  RETURN crypt(plain_pass, hash_pass) = hash_pass;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
