/*
# Create admin user with identity row (fixed)

## Overview
Creates the admin user in auth.users + auth.identities. The identities.email
column is generated from identity_data->>'email', so we must NOT insert it
directly.

## Credentials
- Email: admin@lumennovel.com
- Password: LumenNovel2026!
*/

DO $$
DECLARE
  admin_id uuid;
  inst_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@lumennovel.com';

  IF admin_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      is_anonymous
    ) VALUES (
      inst_id,
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@lumennovel.com',
      crypt('LumenNovel2026!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      false
    )
    RETURNING id INTO admin_id;

    -- Identity row: email column is generated from identity_data->>'email'
    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at,
      id
    ) VALUES (
      admin_id::text,
      admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@lumennovel.com'),
      'email',
      now(),
      now(),
      now(),
      gen_random_uuid()
    );
  END IF;

  -- Profile with is_admin = true
  INSERT INTO profiles (id, email, is_admin)
  SELECT id, email, true FROM auth.users WHERE email = 'admin@lumennovel.com'
  ON CONFLICT (id) DO UPDATE SET is_admin = true;
END $$;
